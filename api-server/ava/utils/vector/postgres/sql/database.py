from logging import Logger, getLogger
from os import getenv
import os
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import scoped_session
from sqlalchemy.orm import sessionmaker as SessionMaker
import platform

logger: Logger = getLogger("ava_vector_database")


def create_vector_db_engine(pool_size: int = 35,
                            max_overflow: int = 10) -> Engine:
    logger.info(
        f"Creating db engine with pool_size={pool_size}, max_overflow={max_overflow}"
    )

    db_connection_string: str | None = getenv("POSTGRES_VECTOR_DATABASE_URL")
    assert db_connection_string, "No POSTGRES_VECTOR_DATABASE_URL found in env"

    _echo_env: str | None = getenv("POSTGRES_VECTOR_DATABASE_DEBUG")
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
        logger.exception("pgvector db init error.....", exc_info=ex)
        raise


def create_session_maker(engine: Engine) -> scoped_session:
    if platform.system() == "Linux":
        # 僅在 Linux 系統上使用 gevent-aware scopefunc
        from gevent import getcurrent

        def gevent_scopefunc():
            return id(getcurrent())

        return scoped_session(SessionMaker(engine, expire_on_commit=False),
                              scopefunc=gevent_scopefunc)
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
