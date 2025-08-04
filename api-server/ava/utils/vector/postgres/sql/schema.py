from __future__ import annotations

import random
import string
import threading
from datetime import datetime
from logging import Logger, getLogger
from time import sleep
from typing import Any, Type, TypeVar

from ava.utils.redis_utils import get_redis_client_with_retry
from ava.utils.vector.postgres.sql import schema
from ava.utils.vector.postgres.sql.halfvec import HalfVector
from redis import Redis
from sqlalchemy import (TIMESTAMP, Index, PrimaryKeyConstraint, Result, String,
                        TextClause, func)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.dialects.postgresql.base import ischema_names
from sqlalchemy.orm import Mapped, Session, declarative_base, mapped_column
from sqlalchemy.orm.decl_api import DeclarativeBase, DeclarativeMeta
from sqlalchemy.schema import Table
from sqlalchemy.sql import func, text
from sqlalchemy.types import Float, String, UserDefinedType
from ava.clients.sql.database import SessionMaker, session_scope

__all__: list[str] = []

Base: DeclarativeMeta = declarative_base()

logger: Logger = getLogger("ava_vector_database")
lock = threading.Lock()


class BaseCacheItem(Base):
    __abstract__ = True
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    embedding: Mapped[HalfVector]
    related_chunk_ids: Mapped[list[str]] = mapped_column(JSONB)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


"""
    TODO : 如果有問題就要去他們官方看有沒有更新新版，因為懶得動 requirement 用搬的
    目前使用的是 V0.3.2
    https://github.com/pgvector/pgvector-python/tree/v0.3.2/
"""


class HALFVEC(UserDefinedType):
    cache_ok = True
    _string = String()

    def __init__(self, dim=None):
        super(UserDefinedType, self).__init__()
        self.dim = dim

    def get_col_spec(self, **kw):
        if self.dim is None:
            return 'HALFVEC'
        return 'HALFVEC(%d)' % self.dim

    def bind_processor(self, dialect):

        def process(value):
            return HalfVector._to_db(value, self.dim)

        return process

    def literal_processor(self, dialect):
        string_literal_processor = self._string._cached_literal_processor(
            dialect)
        assert string_literal_processor, "no string literal processor found"

        def process(value):
            return string_literal_processor(HalfVector._to_db(value, self.dim))

        return process

    def result_processor(self, dialect, coltype):

        def process(value):
            return HalfVector._from_db(value)

        return process

    class comparator_factory(UserDefinedType.Comparator):

        def l2_distance(self, other):
            return self.op('<->', return_type=Float)(other)

        def max_inner_product(self, other):
            return self.op('<#>', return_type=Float)(other)

        def cosine_distance(self, other):
            return self.op('<=>', return_type=Float)(other)

        def l1_distance(self, other):
            return self.op('<+>', return_type=Float)(other)


class BaseEmbeddingItem(Base):
    __abstract__ = True
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    embedding: Mapped[HalfVector] = mapped_column(HALFVEC, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSONB)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class ChunkOpenAI3072Vector(Base):
    __tablename__ = 'chunk_openai_3072_vectors'
    __table_args__ = (
        PrimaryKeyConstraint('id',
                             'collection_name',
                             name='chunk_openai_3072_vectors_pkey'),
        Index('chunk_openai_3072_vectors_collection_name_idx',
              'collection_name'),
        Index('chunk_openai_3072_vectors_text_search_zh_idx',
              'text_search_zh',
              postgresql_using='gin'),
        Index('chunk_openai_3072_vectors_text_search_en_idx',
              'text_search_en',
              postgresql_using='gin'),
    )

    id: Mapped[str] = mapped_column(String(50), nullable=False)
    collection_name: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    meta_data: Mapped[dict] = mapped_column(JSONB, nullable=False)

    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())

    # pgvector 儲存欄位（使用 halfvec 3072 維）
    embedding: Mapped[object] = mapped_column(HALFVEC(3072), nullable=True)

    # ✅ 中文全文搜尋欄位（pg_jieba）
    text_search_zh: Mapped[str] = mapped_column(TSVECTOR, nullable=True)

    # ✅ 英文全文搜尋欄位（english parser）
    text_search_en: Mapped[str] = mapped_column(TSVECTOR, nullable=True)


# for reflection
ischema_names['halfvec'] = HALFVEC


def random_string(length=20):
    return ''.join(
        random.choices(string.ascii_lowercase + string.digits, k=length))


def create_partition(session_maker,
                     *,
                     table_name: str = 'vector_openai_text_3_large_3072',
                     partition_name: str,
                     vector_dim: int = 3072) -> None:
    redis_client: Redis = get_redis_client_with_retry()
    lock_id: int = hash(table_name) & 0x7FFFFFFF
    max_retries: int = 300
    retry_count: int = 0
    lock_acquired: Any | None = None
    _lock = threading.Lock()
    lock_name: str = f"lock:{table_name}_{partition_name}"
    backoff = 0.1  # 初始退避時間
    lock_expiry_time = 120  # 先設120，之後再調整

    query = text(f"""
        CREATE TABLE IF NOT EXISTS public."{table_name}_{partition_name}"
            PARTITION OF public."{table_name}"
            FOR VALUES IN ('{partition_name}');
        CREATE INDEX IF NOT EXISTS "{random_string(30)}_hnsw"
            ON public."{table_name}_{partition_name}"
            USING hnsw (
                (embedding::halfvec({vector_dim})) halfvec_cosine_ops
            ) WITH (m=32, ef_construction=100);
    """)
    try:
        with session_scope(session_maker) as session:
            if check_partition_exists(
                    session,
                    table_name=table_name,
                    partition_name=f"{table_name}_{partition_name}"):
                return
        # 嘗試獲取分布式鎖，並保護表檢查和創建邏輯
        while retry_count < max_retries:
            try:
                lock_acquired = redis_client.set(lock_name,
                                                 lock_id,
                                                 ex=lock_expiry_time,
                                                 nx=True)
                if lock_acquired:
                    with _lock:  # 獲取線程鎖，保護接下來的邏輯
                        with session_scope(session_maker) as session:
                            if check_partition_exists(
                                    session,
                                    table_name=table_name,
                                    partition_name=
                                    f"{table_name}_{partition_name}"):
                                break
                            session.execute(query)
                            session.commit()
                            break

            except Exception as e:
                logger.error(
                    f"Error trying to acquire lock for {table_name}, attempt {retry_count}, err:{e}"
                )
                raise e
            retry_count += 1
            # 計算當前的等待時間並加入隨機抖動
            current_sleep_time: float = backoff + random.uniform(0, 0.1)
            logger.debug(
                f"Retry {retry_count} for lock {table_name}, sleeping for {current_sleep_time:.2f} seconds"
            )
            sleep(current_sleep_time)
            backoff = min(backoff * 2, 10)  # 指數增加退避時間，設置最大值避免過長等待

        if not lock_acquired:
            raise Exception(
                f"Could not acquire lock for {table_name} after {max_retries} retries"
            )
    except Exception as ex:
        session.rollback()
        logger.error(f"Error creating collection table {table_name}, err:{ex}")
        raise ex
    finally:
        if lock_acquired:
            try:
                redis_client.delete(lock_name)
                logger.debug(
                    f"Release lock for {table_name} successfully and close session"
                )
            except Exception as e:
                logger.error(f"Error releasing lock for {table_name}, err:{e}")
        redis_client.close()


def check_partition_exists(session: Session,
                           *,
                           table_name: str = 'vector_openai_text_3_large_3072',
                           partition_name: str) -> bool:
    query = text(f"""
        SELECT EXISTS (
            SELECT 1
            FROM pg_inherits i
            JOIN pg_class c ON i.inhrelid = c.oid
            WHERE i.inhparent = '{table_name}'::regclass
            AND c.relname = '{partition_name}'
        );
    """)
    result = session.execute(query)
    return result.scalar()  # type: ignore


def get_or_create_collection(table_name: str, vector_dim: int,
                             collection_class: Type[T],
                             session_maker) -> Type[T]:
    redis_client: Redis = get_redis_client_with_retry()
    lock_id: int = hash(table_name) & 0x7FFFFFFF
    max_retries: int = 300
    retry_count: int = 0
    lock_acquired: Any | None = None
    lock_name: str = f"lock:{table_name}"
    backoff = 0.1  # 初始退避時間
    lock_expiry_time = 120  # 先設120，之後再調整
    with session_scope(session_maker) as session:
        try:
            if not extension_exists(session):
                create_vector_extension(session)

            # 嘗試獲取分布式鎖，並保護表檢查和創建邏輯
            while retry_count < max_retries:
                try:
                    lock_acquired = redis_client.set(lock_name,
                                                     lock_id,
                                                     ex=lock_expiry_time,
                                                     nx=True)
                    if lock_acquired:
                        with lock:  # 獲取線程鎖，保護接下來的邏輯
                            table_exists = check_table_exists(
                                session, table_name)
                            if not table_exists:
                                table_class: Type[T] = create_meta_table_class(
                                    table_name, vector_dim, collection_class)
                                create_db_table(table_class, table_name,
                                                vector_dim, session)
                                setattr(schema, table_name, table_class)
                            else:
                                if table_name in Base.metadata.tables:
                                    table_class = getattr(schema, table_name)
                                else:
                                    table_class = create_meta_table_class(
                                        table_name, vector_dim,
                                        collection_class)
                                    setattr(schema, table_name, table_class)
                        break  # 成功創建或確定存在後退出循環
                except Exception as e:
                    logger.error(
                        f"Error trying to acquire lock for {table_name}, attempt {retry_count}, err:{e}"
                    )
                    raise e
                retry_count += 1
                # 計算當前的等待時間並加入隨機抖動
                current_sleep_time: float = backoff + random.uniform(0, 0.1)
                logger.debug(
                    f"Retry {retry_count} for lock {table_name}, sleeping for {current_sleep_time:.2f} seconds"
                )
                sleep(current_sleep_time)
                backoff = min(backoff * 2, 10)  # 指數增加退避時間，設置最大值避免過長等待

            if not lock_acquired:
                raise Exception(
                    f"Could not acquire lock for {table_name} after {max_retries} retries"
                )

            return table_class  #type: ignore
        except Exception as ex:
            session.rollback()
            logger.error(
                f"Error creating collection table {table_name}, err:{ex}")
            raise ex
        finally:
            if lock_acquired:
                try:
                    redis_client.delete(lock_name)
                    logger.debug(
                        f"Release lock for {table_name} successfully and close session"
                    )
                except Exception as e:
                    logger.error(
                        f"Error releasing lock for {table_name}, err:{e}")
            redis_client.close()


T = TypeVar('T', bound=DeclarativeBase)


def create_meta_table_class(table_name: str, vector_dim: int,
                            target_class: Type[T]) -> Type[T]:
    return type(
        table_name, (target_class, ), {
            '__tablename__': table_name,
            'embedding': mapped_column(HALFVEC(vector_dim))
        })  #type: ignore


def check_table_exists(session: Session, table_name: str) -> bool:
    query = text("""
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_name = :table_name
        )
    """)
    result = session.execute(query, {'table_name': table_name})
    return result.scalar()  # type: ignore


def create_db_table(table_class: Type[T], table_name: str, vector_dim: int,
                    session: Session) -> None:
    try:
        assert session.bind, "Database session is not bound to any engine."

        table: Table = table_class.__table__  # type: ignore
        # 創建表格
        if not check_table_exists(session, table_name):
            table.create(bind=session.bind, checkfirst=True)
            logger.info(f"Collection '{table_name}' created successfully.")
        else:
            logger.debug(
                f"Table '{table_name}' already exists, skipping creation.")

        # 檢查索引是否存在
        if not index_exists(session, table_name):
            # 添加 HNSW 索引
            create_index(session, table_name, vector_dim)
            logger.info(f"HNSW Index on '{table_name}' created successfully.")
        else:
            logger.debug(
                f"HNSW Index on '{table_name}' already exists, skipping creation."
            )

        session.commit()
    except Exception as ex:
        session.rollback()
        logger.error(
            f"Error creating table '{table_name}' and its Index, err: {ex}")
        raise ex


def index_exists(session: Session, table_name: str) -> bool:
    """檢查索引是否存在於表上。"""
    index_check_sql: TextClause = text(f"""
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = :table_name
        AND indexname = :index_name;
    """)
    return session.execute(index_check_sql, {
        'table_name': table_name,
        'index_name': f"{table_name}_embedding_hnsw_idx"
    }).scalar() is not None


def create_index(session: Session, table_name: str, vector_dim: int) -> None:
    """為指定的表創建 HNSW 索引。"""
    index_sql: TextClause = text(f"""
        CREATE INDEX "{table_name}_embedding_hnsw_idx"
        ON public."{table_name}" USING hnsw (
            (embedding::halfvec({vector_dim})) halfvec_cosine_ops 
        ) WITH (m=32, ef_construction=100);
    """)
    session.execute(index_sql)


def extension_exists(session: Session) -> bool:
    query = text("""
        SELECT EXISTS (
            SELECT 1
            FROM pg_extension
            WHERE extname = 'vector'
        )
    """)
    result = session.execute(query)
    return result.scalar()  # type: ignore


def create_vector_extension(session: Session) -> None:
    try:
        session.execute(text('CREATE EXTENSION IF NOT EXISTS vector'))
        session.commit()
        logger.debug("Vector extension created successfully")
    except Exception as ex:
        session.rollback()
        logger.error(f"Error creating vector extension, err:{ex}")
        raise ex
