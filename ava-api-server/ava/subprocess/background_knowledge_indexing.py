from concurrent.futures import ThreadPoolExecutor
from logging import Logger, getLogger
from os import chdir, cpu_count, getenv, getpid
from pathlib import Path
from random import uniform as random_uniform
from signal import SIGINT, SIGTERM, signal
from sys import exit, path
from time import sleep
from typing import NoReturn, Sequence

from os import getenv

from ava.clients.sql.crud import select_and_lock_knowledge_tasks
from ava.clients.sql.database import (create_db_engine, create_session_maker,
                                      scoped_session, session_scope)
from ava.clients.sql.schema import UploadDocuments_Schema
from ava.tools.indexing import restart_knowledge_indexing
from ava.utils.logger_config import setup_logging
from ava.utils.vector.vector_database_factory import VectorDatabaseFactory

logger: Logger
thread_pool_executor: ThreadPoolExecutor
is_executor_shutdown: bool = False
session_maker: scoped_session


def background_knowledge_indexing_task() -> None:
    logger.debug("start background_crawler_indexing_task")
    while True:
        try:
            if is_executor_shutdown:
                return

            upload_documents = []
            with session_scope(session_maker) as session:
                try:
                    upload_documents = select_and_lock_knowledge_tasks(
                        limit=thread_max_workers, session=session)
                except Exception as ex:
                    logger.exception(f"Error selecting knowledge tasks: {ex}")
                    sleep(random_uniform(1.0, 3.0))
                    continue

            if upload_documents:
                try:
                    restart_knowledge_indexing(
                        thread_pool_executor, [u[0] for u in upload_documents],
                        session_maker)
                except Exception as ex:
                    logger.exception(f"Error processing knowledge tasks: {ex}")

        except Exception as ex:
            logger.exception(f"crawler_indexing_background_task error",
                             exc_info=ex)
        finally:
            sleep(random_uniform(1.0, 3.0))


def signal_handler(sig, frame) -> NoReturn:
    global is_executor_shutdown
    logger.info(f'crawler_indexing_background_process receiver signal: {sig}')
    is_executor_shutdown = True
    thread_pool_executor.shutdown(wait=True)
    exit(0)


if __name__ == "__main__":
    env: str | None = getenv("ENVIRONMENT")
    assert env in ["dev", "test", "prod",
                   "khh"], f"ENVIRONMENT[{env}] must be dev/test/prod/khh."
    setup_logging(env)
    logger = getLogger("ava_knowledge_indexing")
    logger.info(f"start knowledge_indexing_background_process, pid:{getpid()}")
    signal(SIGINT, signal_handler)
    signal(SIGTERM, signal_handler)
    session_maker = create_session_maker(
        create_db_engine(int(getenv("KNOWLEDGE_DATABASE_POOL_SIZE", 30)),
                         int(getenv("KNOWLEDGE_DATABASE_MAX_OVERFLOW", 10))))
    current_cpu_count: int = cpu_count() or 1

    worker_amount = int(getenv("API_SERVER_WORKER_AMOUNT", 1))

    if current_cpu_count:
        thread_max_workers: int = max(
            5, int(int((current_cpu_count * 1.5) // worker_amount) *
                   0.3))  # 預期 knowledge indexing 分配 30% loading
    else:
        thread_max_workers = 8
    thread_pool_executor = ThreadPoolExecutor(max_workers=thread_max_workers)
    VectorDatabaseFactory.initialize()
    background_knowledge_indexing_task()
