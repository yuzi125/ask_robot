from dataclasses import dataclass
from os import getenv
from typing import Any, Type, TypeVar

from ava.utils.vector.base import VectorDatabase
from ava.utils.vector.postgres.postgres_vector import PostgresVectorDatabase
from ava.utils.vector.postgres.sql.database import (create_session_maker,
                                                    create_vector_db_engine)

T = TypeVar("T")

EMBEDDING_MODEL_DIMENSION_MAP: dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536
}
COLLECTION_MAP: dict[str, dict[tuple[str, str, type], VectorDatabase]] = {
    "default": {},
    "crawler": {},
    "knowledge": {}
}


@dataclass
class DatabaseConfig:
    pool_size: int
    max_overflow: int
    process_type: str


# 這個 default 是給 api 使用的，應對高併發查詢需要開比較大
DEFAULT_API_DATABASE_CONFIG = DatabaseConfig(
    pool_size=int(getenv("API_VECTOR_DATABASE_POOL_SIZE", 450)),
    max_overflow=int(getenv("API_VECTOR_DATABASE_MAX_OVERFLOW", 50)),
    process_type='default')
DEFAULT_CRAWLER_DATABASE_CONFIG = DatabaseConfig(
    pool_size=int(getenv("CRAWLER_VECTOR_DATABASE_POOL_SIZE", 35)),
    max_overflow=int(getenv("CRAWLER_VECTOR_DATABASE_MAX_OVERFLOW", 10)),
    process_type='crawler')
DEFAULT_KNOWLEDGE_DATABASE_CONFIG = DatabaseConfig(
    pool_size=int(getenv("KNOWLEDGE_VECTOR_DATABASE_POOL_SIZE", 35)),
    max_overflow=int(getenv("KNOWLEDGE_VECTOR_DATABASE_MAX_OVERFLOW", 10)),
    process_type='knowledge')


# TODO: 這邊的實作有點糟糕，未來需要重構
class VectorDatabaseFactory:
    _target_class: Type[VectorDatabase] | None = None
    _engine: Any = None
    _session_maker: Any = None

    @classmethod
    def get_vector_database(
        cls,
        *,
        collection_name: str,
        embedding_model: str = "text-embedding-3-large",
        collection_class: Type[T],
        config: DatabaseConfig = DEFAULT_API_DATABASE_CONFIG
    ) -> VectorDatabase:
        if (collection_name, embedding_model,
                collection_class) in COLLECTION_MAP[config.process_type]:
            return COLLECTION_MAP[config.process_type][(collection_name,
                                                        embedding_model,
                                                        collection_class)]
        if embedding_model not in EMBEDDING_MODEL_DIMENSION_MAP:
            raise ValueError(f"Unknown embedding model: {embedding_model}")
        if cls._target_class is None:
            raise ValueError("VectorDatabaseFactory is not initialized")
        if cls._engine is None or cls._session_maker is None:
            cls._engine = create_vector_db_engine(
                pool_size=config.pool_size, max_overflow=config.max_overflow)
            cls._session_maker = create_session_maker(cls._engine)

        instance = cls._target_class(
            engine=cls._engine,
            session_maker=cls._session_maker,
            collection_name=collection_name,
            embedding_model=embedding_model,
            vector_dim=EMBEDDING_MODEL_DIMENSION_MAP[embedding_model],
            collection_class=collection_class)
        COLLECTION_MAP[config.process_type][(collection_name, embedding_model,
                                             collection_class)] = instance
        return instance

    @classmethod
    def initialize(cls):
        vector_storage_engine: str | None = getenv("VECTOR_STORAGE_ENGINE")
        assert vector_storage_engine is not None
        if vector_storage_engine == "postgres":
            cls._target_class = PostgresVectorDatabase
        else:
            raise ValueError(f"Unknown database type: {vector_storage_engine}")

    @staticmethod
    def _get_db_config(process_type: str = "default") -> DatabaseConfig:
        configs: dict[str, DatabaseConfig] = {
            'knowledge': DEFAULT_KNOWLEDGE_DATABASE_CONFIG,
            'crawler': DEFAULT_CRAWLER_DATABASE_CONFIG,
            'default': DEFAULT_API_DATABASE_CONFIG
        }
        return configs.get(process_type, configs['default'])
