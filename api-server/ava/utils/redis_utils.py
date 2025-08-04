import socket
from functools import partial
from logging import Logger, getLogger
from typing import Callable

from ava.utils import env_utils
from redis import ConnectionPool, Redis
from redis.backoff import EqualJitterBackoff
from redis.client import PubSub
from redis.exceptions import ConnectionError, TimeoutError
from redis.retry import Retry

pool = ConnectionPool(host=env_utils.get_redis_host(),
                      port=env_utils.get_redis_port(),
                      password=env_utils.get_redis_password(),
                      max_connections=3000)

REDIS_RETRY_POLICY = Retry(backoff=EqualJitterBackoff(),
                           retries=100,
                           supported_errors=(ConnectionError, TimeoutError,
                                             socket.timeout))

logger: Logger = getLogger("ava_app")


def get_redis_client() -> Redis:
    return Redis(connection_pool=pool)


def listen_to_redis_channel(redis_client: Redis, channel_name: str,
                            do_func: Callable[[], None]) -> None:
    pubsub: PubSub = redis_client.pubsub()
    pubsub.subscribe(channel_name)
    for item in pubsub.listen():
        try:
            if item["type"] == "message":
                logger.info(
                    "register_redis_handler_channel receive refresh message")
                do_func()
            elif item["type"] == "subscribe":
                logger.info(
                    f"register_redis_handler_channel subscribe channel {channel_name} success"
                )
        except Exception as ex:
            logger.error(f"redis error, err: {ex}")


def fail_handle(error) -> None:
    logger.error(f"redis fail handle: {error}")


def get_redis_client_with_retry() -> Redis:
    return REDIS_RETRY_POLICY.call_with_retry(get_redis_client, fail_handle)


def register_redis_handler_channel(do_func: Callable[[], None],
                                   channel_name: str) -> None:
    try:
        redis_client: Redis = get_redis_client_with_retry()
        REDIS_RETRY_POLICY.call_with_retry(
            partial(listen_to_redis_channel, redis_client, channel_name,
                    do_func), fail_handle)
    except Exception as ex:
        logger.error(f"redis error, err: {ex}")
