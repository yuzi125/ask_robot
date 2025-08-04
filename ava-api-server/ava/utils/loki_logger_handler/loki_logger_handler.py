import atexit
import logging
import queue
import random
import threading
import time

from ava.utils.loki_logger_handler.logger_formatter import LoggerFormatter
from ava.utils.loki_logger_handler.loki_request import LokiRequest
from ava.utils.loki_logger_handler.stream import Stream
from ava.utils.loki_logger_handler.streams import Streams


class LokiLoggerHandler(logging.Handler):

    def __init__(self,
                 url,
                 labels,
                 labelKeys=None,
                 timeout=10,
                 compressed=True,
                 defaultFormatter=LoggerFormatter(),
                 additional_headers=dict(),
                 max_retries=100,
                 backoff_factor=2,
                 max_backoff=600,
                 batch_size=500,
                 flush_interval=5,
                 min_batch_size=10):
        super().__init__()

        if labelKeys is None:
            labelKeys = {}

        self.labels = labels
        self.labelKeys = labelKeys
        self.timeout = timeout
        self.logger_formatter = defaultFormatter
        self.request = LokiRequest(url=url,
                                   compressed=compressed,
                                   additional_headers=additional_headers)

        self.last_flush_time: float = time.time()

        self.max_retries: int = max_retries
        self.backoff_factor: int = backoff_factor
        self.max_backoff: int = max_backoff
        self.batch_size: int = batch_size
        self.min_batch_size: int = min_batch_size
        self.flush_interval: int = flush_interval
        self._shutdown = threading.Event()
        self.buffer = queue.Queue()
        self.flush_thread = threading.Thread(target=self._flush, daemon=True)
        self.flush_thread.start()

    def emit(self, record):
        self._put(self.logger_formatter.format(record))

    def _flush(self):

        while not self._shutdown.is_set():
            current_time = time.time()
            buffer_size = self.buffer.qsize()

            should_flush = (
                buffer_size >= self.batch_size or  # 達到最大批次
                (
                    buffer_size >= self.min_batch_size and  # 達到最小批次且超時
                    current_time - self.last_flush_time
                    >= self.flush_interval))

            if should_flush:
                self._send()
                self.last_flush_time = current_time
            else:
                time.sleep(0.1)  # 降低 CPU 使用率

    def close(self):
        """當 logging.shutdown() 被調用時會觸發這個方法"""
        self._shutdown.set()
        if not self.buffer.empty():
            self._send()
        self.flush_thread.join(timeout=5)
        super().close()

    def _send(self):
        temp_streams = {}

        while not self.buffer.empty():
            log = self.buffer.get()
            if log.key not in temp_streams:
                stream = Stream(log.labels)
                temp_streams[log.key] = stream

            temp_streams[log.key].appendValue(log.line)

        if temp_streams:
            streams = Streams(temp_streams.values())
            payload = streams.serialize()
            self._send_with_retries(payload)

    def _send_with_retries(self, payload):
        retries = 0
        while retries < self.max_retries:
            try:
                self.request.send(payload)
                return
            except Exception as e:
                retries += 1
                wait_time = min(self.backoff_factor * (2**retries),
                                self.max_backoff)
                wait_time += random.uniform(0, 0.5)
                logging.warning(
                    f"Failed to send logs, retrying in {wait_time:.2f}s... ({retries}/{self.max_retries})"
                )
                time.sleep(wait_time)

        logging.error("Max retries reached. Failed to send logs.")

    def write(self, message):
        self.emit(message.record)

    def _put(self, log_record):
        labels = self.labels

        for key in self.labelKeys:
            if key in log_record.keys():
                if key == "level":
                    try:
                        labels[key] = log_record[key].lower()
                    except Exception as e:
                        labels[key] = log_record[key]
                else:
                    labels[key] = log_record[key]

        self.buffer.put(LogLine(labels, log_record))


class LogLine:

    def __init__(self, labels, line):
        self.labels = labels
        self.key = self.key_from_lables(labels)
        self.line = line

    def key_from_lables(self, labels):
        key_list = sorted(labels.keys())
        return "_".join(key_list)
