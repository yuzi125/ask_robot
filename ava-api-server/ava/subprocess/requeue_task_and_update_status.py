from concurrent.futures import ThreadPoolExecutor, as_completed
from logging import Logger, getLogger
from os import chdir, cpu_count, getenv, getpid
from pathlib import Path
from random import uniform as random_uniform
from signal import SIGINT, SIGTERM, signal
from sys import exit, path
from threading import Thread
from time import sleep
from typing import NoReturn, Sequence

from ava.clients.sql.crud import (
    check_and_update_crawler_attachment_status,
    check_and_update_crawler_status, find_stale_crawler_attachment_task,
    find_stale_crawler_content_task, find_stale_knowledge_task,
    select_not_finished_crawler_attachment_sync_tasks,
    select_not_finished_crawler_sync_tasks)
from ava.clients.sql.database import (create_db_engine, create_session_maker,
                                      scoped_session, session_scope)
from ava.clients.sql.schema import (CrawlerAttachment_Schema,
                                    CrawlerDocumentsContent_Schema,
                                    UploadDocuments_Schema)
from ava.tools.indexing import (requeue_crawler_attachment_task,
                                requeue_crawler_content_task,
                                requeue_knowledge_task)
from ava.utils.logger_config import setup_logging
from ava.utils.vector.vector_database_factory import VectorDatabaseFactory

logger: Logger
thread_pool_executor: ThreadPoolExecutor
is_executor_shutdown: bool = False
session_maker: scoped_session


def validate_and_finalize_sync():
    try:
        if is_executor_shutdown:
            return

        sync_ids = []
        with session_scope(session_maker) as session:
            try:
                sync_ids = select_not_finished_crawler_sync_tasks(
                    session=session)
            except Exception as ex:
                logger.exception(
                    f"Error selecting unfinished crawler sync tasks: {ex}")
                return

        for sync_id in sync_ids:
            try:
                with session_scope(session_maker) as session:
                    check_and_update_crawler_status(
                        crawler_synchronize_id=sync_id, session=session)
            except Exception as ex:
                logger.exception(
                    f"Error updating status for sync_id {sync_id}: {ex}")
    except Exception as ex:
        logger.exception(f"validate_and_finalize_sync error", exc_info=ex)


def validate_and_finalize_attachment_sync():
    try:
        if is_executor_shutdown:
            return

        sync_ids = []
        with session_scope(session_maker) as session:
            try:
                sync_ids = select_not_finished_crawler_attachment_sync_tasks(
                    session=session)
            except Exception as ex:
                logger.exception(
                    f"Error selecting unfinished attachment sync tasks: {ex}")
                return

        for sync_id in sync_ids:
            try:
                with session_scope(session_maker) as session:
                    check_and_update_crawler_attachment_status(
                        crawler_attachment_synchronize_id=sync_id,
                        session=session)
            except Exception as ex:
                logger.exception(
                    f"Error updating status for attachment sync_id {sync_id}: {ex}"
                )
    except Exception as ex:
        logger.exception(f"validate_and_finalize_attachment_sync error",
                         exc_info=ex)


def requeue_stuck_crawler_indexing_tasks():
    try:
        if is_executor_shutdown:
            return

        stale_tasks = []
        with session_scope(session_maker) as session:
            try:
                stale_tasks = find_stale_crawler_content_task(session=session)
            except Exception as ex:
                logger.exception(
                    f"Error finding stale crawler content tasks: {ex}")
                return

        if stale_tasks:
            future_to_task = {}
            for task in stale_tasks:
                future = thread_pool_executor.submit(
                    requeue_crawler_content_task, task, session_maker)
                future_to_task[future] = task

            for future in as_completed(future_to_task):
                task = future_to_task[future]
                try:
                    future.result()
                except Exception as ex:
                    logger.error(
                        f"Error requeuing crawler content task {task.id}: {ex}"
                    )
    except Exception as ex:
        logger.exception(f"requeue_stuck_crawler_indexing_tasks error",
                         exc_info=ex)


def requeue_stuck_crawler_attachment_indexing_tasks():
    try:
        if is_executor_shutdown:
            return

        stale_tasks = []
        with session_scope(session_maker) as session:
            try:
                stale_tasks = find_stale_crawler_attachment_task(
                    session=session)
            except Exception as ex:
                logger.exception(
                    f"Error finding stale crawler attachment tasks: {ex}")
                return

        if stale_tasks:
            future_to_task = {}
            for task in stale_tasks:
                future = thread_pool_executor.submit(
                    requeue_crawler_attachment_task, task, session_maker)
                future_to_task[future] = task

            for future in as_completed(future_to_task):
                task = future_to_task[future]
                try:
                    future.result()
                except Exception as ex:
                    logger.error(
                        f"Error requeuing crawler attachment task {task.id}: {ex}"
                    )
    except Exception as ex:
        logger.exception(
            f"requeue_stuck_crawler_attachment_indexing_tasks error",
            exc_info=ex)


def requeue_stuck_knowledge_indexing_tasks():
    try:
        if is_executor_shutdown:
            return

        stale_tasks = []
        with session_scope(session_maker) as session:
            try:
                stale_tasks = find_stale_knowledge_task(session=session)
            except Exception as ex:
                logger.exception(f"Error finding stale knowledge tasks: {ex}")
                return

        if stale_tasks:
            future_to_task = {}
            for task in stale_tasks:
                future = thread_pool_executor.submit(requeue_knowledge_task,
                                                     task, session_maker)
                future_to_task[future] = task

            for future in as_completed(future_to_task):
                task = future_to_task[future]
                try:
                    future.result()
                except Exception as ex:
                    logger.error(
                        f"Error requeuing knowledge task {task.id}: {ex}")
    except Exception as ex:
        logger.exception(f"requeue_stuck_knowledge_indexing_tasks error",
                         exc_info=ex)


def background_loop_task():
    while True:
        try:
            validate_and_finalize_sync()
        except Exception as ex:
            logger.exception(f"validate_and_finalize_sync error", exc_info=ex)
        try:
            validate_and_finalize_attachment_sync()
        except Exception as ex:
            logger.exception(f"validate_and_finalize_attachment_sync error",
                             exc_info=ex)
        try:
            requeue_stuck_crawler_indexing_tasks()
        except Exception as ex:
            logger.exception(f"requeue_stuck_crawler_indexing_tasks error",
                             exc_info=ex)
        try:
            requeue_stuck_knowledge_indexing_tasks()
        except Exception as ex:
            logger.exception(f"requeue_stuck_knowledge_indexing_tasks error",
                             exc_info=ex)
        try:
            requeue_stuck_crawler_attachment_indexing_tasks()
        except Exception as ex:
            logger.exception(
                f"requeue_stuck_crawler_attachment_indexing_tasks error",
                exc_info=ex)
        sleep(random_uniform(5.0, 30.0))


def signal_handler(sig, frame) -> NoReturn:
    global is_executor_shutdown
    logger.info(f'requeue_and_update_status_process receiver signal: {sig}')
    is_executor_shutdown = True
    thread_pool_executor.shutdown(wait=True)
    exit(0)


if __name__ == "__main__":
    env: str | None = getenv("ENVIRONMENT")
    assert env in ["dev", "test", "prod",
                   "khh"], f"ENVIRONMENT[{env}] must be dev/test/prod/khh."
    setup_logging(env)
    logger = getLogger("ava_requeue_and_update_task")
    logger.info(
        f"start requeue_and_update_task_background_process, pid:{getpid()}")
    signal(SIGINT, signal_handler)
    signal(SIGTERM, signal_handler)
    session_maker = create_session_maker(
        create_db_engine(int(getenv("REQUEUE_DATABASE_POOL_SIZE", 30)),
                         int(getenv("REQUEUE_DATABASE_MAX_OVERFLOW", 10))))
    current_cpu_count: int = cpu_count() or 1

    worker_amount = int(getenv("API_SERVER_WORKER_AMOUNT", 1))

    if current_cpu_count:
        thread_max_workers: int = max(
            6, int(int((current_cpu_count * 1.5) // worker_amount) *
                   0.2))  # 預期 requeue update status 分配 20% loading
    else:
        thread_max_workers = 8
    thread_pool_executor = ThreadPoolExecutor(max_workers=thread_max_workers)
    VectorDatabaseFactory.initialize()
    background_loop_task()
