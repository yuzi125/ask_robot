from concurrent.futures import ThreadPoolExecutor
from logging import Logger, getLogger
from os import chdir, cpu_count, getenv, getpid
from pathlib import Path
from random import uniform as random_uniform
from signal import SIGINT, SIGTERM, signal
from sys import exit, path
from time import sleep
from typing import NoReturn, Sequence

# 為了引入 ava 底下的東西
root = str(Path(__file__).parents[2].resolve())
chdir(root)
path.append(root)

from ava.clients.sql.crud import (
    select_and_lock_crawler_attachment_tasks,
    select_dataset_from_attachment_sync_id,
    select_not_finished_crawler_attachment_sync_tasks)
from ava.clients.sql.database import (create_db_engine, create_session_maker,
                                      scoped_session, session_scope)
from ava.clients.sql.schema import CrawlerAttachment_Schema, Dataset_Schema
from ava.tools.indexing import restart_crawler_attachment_task
from ava.utils.logger_config import setup_logging
from ava.utils.vector.vector_database_factory import VectorDatabaseFactory

logger: Logger
thread_pool_executor: ThreadPoolExecutor
is_executor_shutdown: bool = False
session_maker: scoped_session


def background_crawler_attachment_indexing_task() -> None:
    assert thread_pool_executor, "executor must be initialized."
    logger.debug("start crawler_attachment_indexing_background_task")
    while True:
        try:
            if is_executor_shutdown:
                return

            crawler_attachment_sync_ids = []
            with session_scope(session_maker) as session:
                try:
                    crawler_attachment_sync_ids = select_not_finished_crawler_attachment_sync_tasks(
                        session=session)
                except Exception as ex:
                    logger.exception(
                        f"Error selecting attachment sync tasks: {ex}")
                    sleep(random_uniform(1.0, 3.0))
                    continue

            for crawler_attachment_sync_id in crawler_attachment_sync_ids:
                try:
                    row_dataset = None
                    with session_scope(session_maker) as session:
                        try:
                            row_dataset = select_dataset_from_attachment_sync_id(
                                crawler_attachment_synchronize_id=
                                crawler_attachment_sync_id,
                                session=session)
                        except Exception as ex:
                            logger.exception(
                                f"Error selecting dataset for attachment sync_id {crawler_attachment_sync_id}: {ex}"
                            )
                            continue

                    if not row_dataset:
                        logger.warning(
                            f"Dataset not found for attachment sync_id {crawler_attachment_sync_id}"
                        )
                        continue

                    crawler_attachments = []
                    with session_scope(session_maker) as session:
                        try:
                            crawler_attachments = select_and_lock_crawler_attachment_tasks(
                                crawler_attachment_sync_id=
                                crawler_attachment_sync_id,
                                limit=thread_max_workers,
                                session=session)
                        except Exception as ex:
                            logger.exception(
                                f"Error selecting crawler attachments for sync_id {crawler_attachment_sync_id}: {ex}"
                            )
                            continue

                    if crawler_attachments:
                        restart_crawler_attachment_task(
                            thread_pool_executor, row_dataset,
                            [c[0] for c in crawler_attachments], session_maker)

                except Exception as ex:
                    logger.exception(
                        f"Error processing attachment sync_id {crawler_attachment_sync_id}: {ex}"
                    )

        except Exception as ex:
            logger.exception(f"crawler_indexing_background_process error",
                             exc_info=ex)
        finally:
            sleep(random_uniform(1.0, 3.0))


def signal_handler(sig, frame) -> NoReturn:
    global is_executor_shutdown
    logger.info(
        f'crawler_attachment_indexing background process receiver signal: {sig}'
    )
    is_executor_shutdown = True
    thread_pool_executor.shutdown(wait=True)
    exit(0)


if __name__ == "__main__":
    env: str | None = getenv("ENVIRONMENT")
    assert env in ["dev", "test", "prod",
                   "khh"], f"ENVIRONMENT[{env}] must be dev/test/prod/khh."
    setup_logging(env)
    logger = getLogger("ava_crawler_indexing")
    logger.info(
        f"start crawler_attachment_indexing_background_process, pid:{getpid()}"
    )
    signal(SIGINT, signal_handler)
    signal(SIGTERM, signal_handler)
    session_maker = create_session_maker(
        create_db_engine(int(getenv("CRAWLER_DATABASE_POOL_SIZE", 30)),
                         int(getenv("CRAWLER_DATABASE_MAX_OVERFLOW", 10))))
    current_cpu_count: int = cpu_count() or 1

    worker_amount = int(getenv("API_SERVER_WORKER_AMOUNT", 1))

    if current_cpu_count:
        thread_max_workers: int = max(
            10, int(int((current_cpu_count * 1.5) // worker_amount) *
                    0.5))  # 預期 crawler indexing 分配 50% loading
    else:
        thread_max_workers = 8
    thread_pool_executor = ThreadPoolExecutor(max_workers=thread_max_workers)
    VectorDatabaseFactory.initialize()
    background_crawler_attachment_indexing_task()
