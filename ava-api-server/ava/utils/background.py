import subprocess
from logging import Logger, getLogger
from sys import executable as sys_executable
from threading import Thread
from typing import Optional
import os

logger: Logger = getLogger("ava_app")


class BackgroundProcess:

    def __init__(self, script_path: str, process_name: str):
        self.script_path = script_path
        self.process_name = process_name
        self.process: Optional[subprocess.Popen] = None
        self.should_run = True
        self.log_thread: Optional[Thread] = None

    def _log_output(self, pipe, prefix: str):
        try:
            for line in iter(pipe.readline, ''):
                if line:
                    logger.info(
                        f"{self.process_name} {prefix}: {line.strip()}")
        except Exception as e:
            logger.error(
                f"Error reading {prefix} from {self.process_name}: {e}")

    def start(self):
        if self.should_run and (self.process is None
                                or self.process.poll() is not None):
            self.process = subprocess.Popen(
                [sys_executable, self.script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                bufsize=1,  # 行緩衝
                env=os.environ.copy(),  # 明確傳遞當前環境變數
            )
            logger.info(
                f"Started {self.process_name} process (PID: {self.process.pid})"
            )

            # 啟動兩個線程來處理輸出
            stdout_thread = Thread(target=self._log_output,
                                   args=(self.process.stdout, "stdout"),
                                   daemon=True)
            stderr_thread = Thread(target=self._log_output,
                                   args=(self.process.stderr, "stderr"),
                                   daemon=True)
            stdout_thread.start()
            stderr_thread.start()

    def stop(self):
        self.should_run = False
        if self.process:
            self.process.terminate()
            self.process.wait()
            # 關閉管道
            if self.process.stdout:
                self.process.stdout.close()
            if self.process.stderr:
                self.process.stderr.close()
            self.process = None
            logger.info(f"Stopped {self.process_name} process")
