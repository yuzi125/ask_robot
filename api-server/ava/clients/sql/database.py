from functools import wraps
from logging import Logger, getLogger
from os import getenv
from typing import Callable, Optional, TypeVar

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, scoped_session
from sqlalchemy.orm import sessionmaker as SessionMaker
from typing_extensions import ParamSpec
import platform
from contextlib import contextmanager

logger: Logger = getLogger("db_connector")


def create_db_engine(pool_size: int = 20, max_overflow: int = 5) -> Engine:
    logger.info(
        f"Creating db engine with pool_size={pool_size}, max_overflow={max_overflow}"
    )
    db_connection_string: Optional[str] = getenv("DB_CONNECTION_STRING")
    assert db_connection_string, "No DB_CONNECTION_STRING found in env"
    _echo_env: Optional[str] = getenv("SQLALCHEMY_DEBUG_ECHO")
    if not _echo_env:
        echo: bool = False
    else:
        echo: bool = True if _echo_env == 'true' else False
    try:
        engine: Engine = create_engine(db_connection_string,
                                       pool_size=pool_size,
                                       max_overflow=max_overflow,
                                       pool_timeout=90,
                                       pool_recycle=1800,
                                       echo=echo,
                                       pool_pre_ping=True)
        return engine
    except Exception as ex:
        logger.exception("create db engine error.....", exc_info=ex)
        raise


def create_session_maker(engine: Engine) -> scoped_session:
    if platform.system() == "Linux":
        # 僅在 Linux 系統上使用 gevent-aware scopefunc
        try:
            from gevent import getcurrent

            def gevent_scopefunc():
                return id(getcurrent())

            scopefunc = gevent_scopefunc
        except ImportError:
            logger.warning("gevent is not installed, using default scopefunc")
            scopefunc = None  # 預設為 None，使用 thread-local
        return scoped_session(SessionMaker(engine, expire_on_commit=False),
                              scopefunc=scopefunc)
    else:
        # Windows 或其他平台使用預設 thread-local scope
        return scoped_session(SessionMaker(engine, expire_on_commit=False))


@contextmanager
def session_scope(session_maker):
    session = session_maker()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        logger.exception("Session operation error", exc_info=e)
        raise
    finally:
        session.close()
        session_maker.remove()
