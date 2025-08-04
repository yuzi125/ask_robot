import json
from logging import Logger, getLogger
from threading import Lock
from typing import Any, Generic, Iterable, Iterator, Type, TypeVar

from ava.model.EmbeddingTokenLogEntry import EmbeddingTokenLogEntry
from ava.utils.prometheus.ava_metrics import VECTOR_SEARCH_DURATION_SECONDS
from ava.utils.redis_utils import get_redis_client_with_retry
from ava.utils.utils import split_chunks
from ava.utils.vector import (CollectionLimit, EmbeddingDocument,
                              InsertEmbeddingDocument, SearchContentDocument,
                              SearchMetadataDocument, UpdateEmbeddingDocument,
                              VectorDatabase, get_openai_embeddings)
from ava.utils.vector.cache import RedisEmbeddingCache
from ava.utils.vector.postgres.sql import (ChunkOpenAI3072Vector,
                                           check_partition_exists,
                                           create_partition,
                                           get_or_create_collection)
from ava.utils.vector.postgres.sql.database import Engine, scoped_session, session_scope
from ava.utils.vector.postgres.sql.halfvec import HalfVector
from gevent.pool import Pool
from sqlalchemy import and_, delete, func, insert, select, text, update
from sqlalchemy.orm.decl_api import DeclarativeBase
from sqlalchemy.orm.query import Query
from sqlalchemy.orm.session import Session
from sqlalchemy.sql.elements import ColumnElement

logger: Logger = getLogger("ava_vector_database")

T = TypeVar('T', bound=DeclarativeBase)


def build_jsonb_path(metadata_column, path_elements):
    # 依據 JSON 路徑元素生成表達式
    if len(path_elements) == 1:
        return metadata_column.op('->>')(path_elements[0])
    else:
        expr = metadata_column.op('->')(path_elements[0])
        for element in path_elements[1:-1]:
            expr = expr.op('->')(element)
        return expr.op('->>')(path_elements[-1])


class PostgresVectorDatabase(VectorDatabase, Generic[T]):

    @property
    def collection_name(self) -> str:
        return self._collection_name

    @property
    def embedding_model(self) -> str:
        return self._embedding_model

    @property
    def engine(self) -> Engine:
        return self._engine

    @property
    def session_maker(self) -> scoped_session[Session]:
        return self._session_maker

    def __init__(self, *, engine: Engine, session_maker: scoped_session,
                 embedding_model: str, collection_name: str, vector_dim: int,
                 collection_class: Type[T]) -> None:
        self._embedding_model: str = embedding_model
        self._collection_name: str = collection_name
        self._engine: Engine = engine
        self._session_maker: scoped_session = session_maker
        self.collection_class: Type[T] = collection_class
        self.vector_dim: int = vector_dim

        # 這是為了暫時先繼續檢查 cache collection 的建立，之後重寫架構整個換掉
        if self.collection_name.startswith("cache_"):
            self.collection: Type[T] = get_or_create_collection(
                collection_name, vector_dim, self.collection_class,
                session_maker)
        self.cache_client: RedisEmbeddingCache = RedisEmbeddingCache(
            redis_client=get_redis_client_with_retry())
        self.cache_client_lock = Lock()

    def search_content_by_score_threshold(
        self,
        *,
        collections_limits: list[tuple[str, int, float]],
        query: str,
        metadata_query: dict[str, Any] | None = None,
        k: int = 5,
    ) -> Iterator[SearchContentDocument]:
        """
            這個 function 暫時沒用，之後改
        """
        cache_key: str = f"{query}_{self.embedding_model}"
        cache_embedding: list[
            float] | None = self.cache_client.get_embedding_cache(cache_key)
        use_cache: bool = False
        if not cache_embedding:
            with self.cache_client_lock:
                cache_embedding = self.cache_client.get_embedding_cache(
                    cache_key)
                if not cache_embedding:
                    get_embedding: Iterator = get_openai_embeddings(
                        [query], self.embedding_model)

                    query_embedding: list[float] = next(get_embedding)

                    self.cache_client.set_embedding_cache(
                        cache_key, query_embedding)
                else:
                    query_embedding = cache_embedding  # Cache found during lock
        else:
            query_embedding = cache_embedding
            use_cache = True
        try:
            with session_scope(self.session_maker) as session:
                embedding_value = HalfVector._to_db(query_embedding)
                values_list = [
                    f"('{col}', {limit}, {threshold})"
                    for col, limit, threshold in collections_limits
                ]
                values_clause = ", ".join(values_list)
                query = f"""
                    WITH collection_limits AS (
                        SELECT 
                            collection_name,
                            row_limit,
                            threshold
                        FROM (
                            VALUES {values_clause}
                        ) AS t(collection_name, row_limit, threshold)
                    ),
                    ranked_results AS (
                        SELECT
                            v.id,
                            v.content,
                            v.meta_data,
                            v.collection_name,
                            1.0 - (v.embedding <=> '{embedding_value}'::halfvec) AS adjusted_distance,
                            ROW_NUMBER() OVER (
                                PARTITION BY v.collection_name
                                ORDER BY (v.embedding <=> '{embedding_value}'::halfvec) ASC
                            ) AS row_num
                        FROM
                            public.vector_openai_text_3_large_3072 v
                        INNER JOIN collection_limits cl
                            ON v.collection_name = cl.collection_name
                        WHERE
                            (v.embedding <=> '{embedding_value}'::halfvec) <= (1.0 - cl.threshold)
                    ),
                    final_results AS (
                        SELECT
                            r.id,
                            r.content,
                            r.meta_data,
                            r.collection_name,
                            r.adjusted_distance
                        FROM
                            ranked_results r
                        INNER JOIN collection_limits cl
                            ON r.collection_name = cl.collection_name
                        WHERE
                            r.row_num <= cl.row_limit
                    )
                    SELECT
                        id,
                        content,
                        meta_data,
                        collection_name,
                        adjusted_distance
                    FROM
                        final_results
                    ORDER BY
                        adjusted_distance DESC;
                """

                result = session.execute(text(query)).fetchall()

                if metadata_query:
                    for row in result:
                        if all(
                                str(row.meta_data.get(key)) == str(value)
                                for key, value in metadata_query.items()):
                            yield SearchContentDocument(id=row[0],
                                                        score=row[1],
                                                        content=row[2],
                                                        metadata=row[3],
                                                        is_cache=use_cache)
                else:
                    for row in result:
                        yield SearchContentDocument(id=row[0],
                                                    score=row[1],
                                                    content=row[2],
                                                    metadata=row[3],
                                                    is_cache=use_cache)
        except Exception as e:
            logger.error(
                f"PostgresVectorDatabase search_content_by_score_threshold error, err: {e}"
            )
            raise e

    def search_embedding_cache_by_score_threshold(
            self,
            *,
            expert_id: str,
            query_embedding: list[float],
            score_threshold: float,
            k: int = 5) -> Iterator[SearchContentDocument]:
        try:
            with session_scope(self.session_maker) as session:
                embedding_value = HalfVector._to_db(query_embedding)
                query = f"""
                    SELECT 
                        id,
                        1.0 - (embedding <=> '{embedding_value}'::halfvec(3072)) AS adjusted_distance,
                        content,
                        meta_data
                    FROM "public"."cache_{expert_id}"
                    WHERE (embedding <=> '{embedding_value}'::halfvec(3072)) <= (1.0 - {score_threshold})
                    ORDER BY (embedding <=> '{embedding_value}'::halfvec(3072))
                    LIMIT {k};     
                """

                result = session.execute(text(query)).fetchall()
            for row in result:
                yield SearchContentDocument(id=row[0],
                                            score=row[1],
                                            content=row[2],
                                            metadata=row[3])
        except Exception as e:
            logger.error(
                f"PostgresVectorDatabase search_content_by_score_threshold error, err: {e}"
            )
            raise e

    def search_embedding_by_score_threshold(
            self,
            *,
            collections_limits: list[CollectionLimit],
            query_embedding: list[float],
            metadata_query: dict[str, Any] | None = None,
            k: int = 5) -> Iterator[SearchContentDocument]:
        try:
            embedding_value = HalfVector._to_db(query_embedding)
            pool = Pool(size=8)

            def query_batch_collection(
                    collection_search_params: tuple[int, float, int],
                    collection_limits_batch: list[CollectionLimit]):
                row_limit, threshold, priority = collection_search_params
                collection_names = [
                    collection_limit.collection_name
                    for collection_limit in collection_limits_batch
                ]
                collections_clause = ", ".join(f"'{name}'"
                                               for name in collection_names)
                query = f"""
                    SELECT 
                        id,
                        content,
                        meta_data,
                        1.0 - (embedding <=> '{embedding_value}') as adjusted_distance
                    FROM public.chunk_openai_3072_vectors
                    WHERE collection_name in ({collections_clause})
                        AND (embedding <=> '{embedding_value}') <= ({1.0 - threshold})
                    ORDER BY embedding <=> '{embedding_value}'
                    LIMIT {row_limit * 5};
                """
                with session_scope(self.session_maker) as session:
                    session.execute(text("SET JIT = off;"))
                    session.execute(text("SET hnsw.ef_search =1000;"))
                    result = session.execute(text(query)).fetchall()
                    session.execute(text("SET JIT = on;"))
                return result

            # 將 collection_limits 根據 limit、threshold、priority 分批，一樣的 limit、threshold、priority 分到同一個 batch
            # 這樣可以減少 query 的次數，同時也可以減少 query 的複雜度
            collection_limits_batch: dict[tuple[int, float, int],
                                          list[CollectionLimit]] = {}
            for _collection_limits in collections_limits:
                if (_collection_limits.limit,
                        _collection_limits.score_threshold,
                        _collection_limits.priority
                    ) not in collection_limits_batch:
                    collection_limits_batch[_collection_limits.limit,
                                            _collection_limits.score_threshold,
                                            _collection_limits.priority] = [
                                                _collection_limits
                                            ]
                else:
                    collection_limits_batch[
                        _collection_limits.limit,
                        _collection_limits.score_threshold,
                        _collection_limits.priority].append(_collection_limits)

            def process_batch(collection_search_params: tuple[int, float, int],
                              collection_limits: list[CollectionLimit],
                              chunk_size: int = 100) -> list:
                results = []
                # 將 collection_limits 切分成較小的批次
                jobs = []
                for i in range(0, len(collection_limits), chunk_size):
                    chunk = collection_limits[i:i + chunk_size]
                    jobs.append(
                        pool.spawn(query_batch_collection,
                                   collection_search_params, chunk))

                # 收集結果
                for job in jobs:
                    results.extend(job.get())

                return results

            all_results = []
            # 對每個 search_params，分批處理其對應的 collection_limits
            for search_params, limits in collection_limits_batch.items():
                try:
                    batch_results = process_batch(search_params, limits)
                    all_results.extend(batch_results)
                except Exception as e:
                    logger.error(
                        f"Failed to process batch for params {search_params}: {e}"
                    )
                    raise

            all_results.sort(key=lambda x: x[3])
            if metadata_query:
                filtered_result = [
                    row for row in all_results if all(
                        row.meta_data.get(key) == str(value)
                        for key, value in metadata_query.items())
                ]
            else:
                filtered_result = all_results

            for item in filtered_result:
                yield SearchContentDocument(id=item[0],
                                            score=item[3],
                                            content=item[1],
                                            metadata=item[2])
        except Exception as e:
            logger.error(
                f"PostgresVectorDatabase search_content_by_score_threshold error, err: {e}"
            )
            raise e

    def search_embedding(self,
                         *,
                         collections_limits: list[CollectionLimit],
                         query_embedding: list[float],
                         metadata_query: dict[str, Any] | None = None,
                         k: int = 5) -> Iterator[SearchContentDocument]:
        try:
            return self.search_embedding_by_score_threshold(
                collections_limits=collections_limits,
                query_embedding=query_embedding,
                metadata_query=metadata_query,
                k=k)
        except Exception as e:
            logger.error(
                "PostgresVectorDatabase search_content error, err: {e}")
            raise e

    def search_by_id(self, *, id: str) -> EmbeddingDocument | None:
        with session_scope(self.session_maker) as session:
            try:
                result = session.execute(
                    select(ChunkOpenAI3072Vector).where(
                        ChunkOpenAI3072Vector.collection_name ==
                        self.collection_name,
                        ChunkOpenAI3072Vector.id == id)).one_or_none()
                if result:
                    return EmbeddingDocument(id=result.id,
                                             metadata=result.meta_data,
                                             content=result.content)
                else:
                    return None
            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase search_by_id error, err: {e}")
                raise e

    def search_by_ids(self, *, ids: list[str]) -> Iterator[EmbeddingDocument]:
        with session_scope(self.session_maker) as session:
            try:
                # 使用 yield_per 進行批次處理
                query = session.execute(
                    select(ChunkOpenAI3072Vector).where(
                        ChunkOpenAI3072Vector.collection_name
                        == self.collection_name,
                        ChunkOpenAI3072Vector.id.in_(ids)))

                for item in query.yield_per(500):
                    yield EmbeddingDocument(
                        id=item.id,  # type: ignore
                        metadata=item.meta_data,  # type: ignore
                        content=item.content)  # type: ignore
            except Exception as e:
                logger.exception(
                    f"PostgresVectorDatabase search_by_ids error, err: {e}",
                    exc_info=e)
                raise e

    def search_content(self,
                       *,
                       collections_limits: list[tuple[str, int, float]],
                       query: str,
                       metadata_query: dict[str, Any] | None = None,
                       k: int = 5) -> Iterator[SearchContentDocument]:
        try:
            logger.debug(f"search_content input text {query}")
            return self.search_content_by_score_threshold(
                collections_limits=collections_limits,
                query=query,
                metadata_query=metadata_query,
                k=k)
        except Exception as e:
            logger.error(
                "PostgresVectorDatabase search_content error, err: {e}")
            raise e

    def search_by_metadata(
            self, *,
            metadata_query: dict[str,
                                 Any]) -> Iterator[SearchMetadataDocument]:
        with session_scope(self.session_maker) as session:
            try:
                base_query = select(ChunkOpenAI3072Vector.id,
                                    ChunkOpenAI3072Vector.content,
                                    ChunkOpenAI3072Vector.meta_data).where(
                                        ChunkOpenAI3072Vector.collection_name
                                        == self.collection_name)

                # 處理 metadata 過濾條件
                for key, value in metadata_query.items():
                    path_elements = key.split('.')
                    if len(path_elements) == 1:
                        # 單層 metadata
                        base_query = base_query.where(
                            ChunkOpenAI3072Vector.meta_data[
                                path_elements[0]].astext == str(value))
                    else:
                        # 多層 metadata
                        path_expr = ChunkOpenAI3072Vector.meta_data[
                            path_elements[0]]
                        for element in path_elements[1:-1]:
                            path_expr = path_expr[element]
                        base_query = base_query.where(
                            path_expr[path_elements[-1]].astext == str(value))

                current_batch = []
                chunk_size = 500
                result = session.execute(base_query)

                # 使用 yield_per 進行批次處理，每次獲取 chunk_size 筆記錄
                for record in result.yield_per(chunk_size):
                    current_batch.append(
                        SearchMetadataDocument(id=record.id,
                                               metadata=record.meta_data,
                                               content=record.content))

                    # 當累積到一定數量時，一次性返回整批數據
                    if len(current_batch) >= chunk_size:
                        logger.debug(
                            f"Yielding batch of {len(current_batch)} records")
                        yield from current_batch
                        current_batch = []

                # 處理最後剩餘的記錄
                if current_batch:
                    logger.debug(
                        f"Yielding final batch of {len(current_batch)} records"
                    )
                    yield from current_batch

            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase search_by_metadata error, err: {e}"
                )
                raise e

    def delete_embedding_by_ids(self, *, ids: list[str]) -> int:
        with session_scope(self.session_maker) as session:
            try:
                result = session.execute(
                    delete(ChunkOpenAI3072Vector).where(
                        ChunkOpenAI3072Vector.collection_name
                        == self.collection_name,
                        ChunkOpenAI3072Vector.id.in_(ids)))
                session.commit()
                delete_count = result.rowcount
                logger.info(
                    f"delete_embedding_by_ids delete_count {delete_count}")
                return delete_count
            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase delete_embedding_by_ids error, err: {e}"
                )
                raise e

    def delete_cache_embedding_by_metadata(
            self, *, expert_id: str, metadata_query: dict[str, Any]) -> int:
        with session_scope(self.session_maker) as session:
            try:
                # 構建 metadata 條件
                conditions = []
                for key, value in metadata_query.items():
                    path_elements = key.split('.')
                    if len(path_elements) == 1:
                        # 單層 metadata
                        conditions.append(
                            f"meta_data->>'{path_elements[0]}' = '{str(value)}'"
                        )
                    else:
                        # 多層 metadata
                        path = '->'.join(
                            [f"'{element}'" for element in path_elements[:-1]])
                        last_element = path_elements[-1]
                        conditions.append(
                            f"meta_data->{path}->>{last_element} = '{str(value)}'"
                        )

                # 構建完整的 SQL 查詢
                where_clause = ' AND '.join(conditions)
                query = f"""
                    DELETE FROM "public"."cache_{expert_id}"
                    WHERE {where_clause}
                """

                # 執行刪除操作
                result = session.execute(text(query))
                session.commit()

                deleted_count = result.rowcount  # type: ignore
                logger.info(
                    f"Deleted {deleted_count} records from cache_{expert_id}")
                return deleted_count

            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase delete_cache_embedding_by_metadata error, err: {e}"
                )
                raise e

    def delete_embedding_by_metadata(self, *,
                                     metadata_query: dict[str, Any]) -> int:
        delete_targets: Iterator[
            SearchMetadataDocument] = self.search_by_metadata(
                metadata_query=metadata_query)
        delete_ids: list[str] = [doc.id for doc in delete_targets]
        logger.info(
            f"delete_embedding_by_metadata delete_count {len(delete_ids)}, metadata: {metadata_query}, delete_ids:{delete_ids}"
        )
        return self.delete_embedding_by_ids(ids=delete_ids)

    def update_embedding_data(self,
                              *,
                              data: Iterable[UpdateEmbeddingDocument],
                              batch_size: int = 500) -> None:
        with session_scope(self.session_maker) as session:
            try:
                current_batch = []

                for doc in data:
                    current_batch.append(doc)
                    if len(current_batch) >= batch_size:
                        self._execute_update_batch(session, current_batch)
                        current_batch = []

                if current_batch:
                    self._execute_update_batch(session, current_batch)

            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase update_embedding_data error, err: {e}"
                )
                raise e

    def _execute_update_batch(self, session: Session,
                              batch: list[UpdateEmbeddingDocument]) -> None:
        try:
            for d in batch:
                session.execute(
                    update(ChunkOpenAI3072Vector).where(
                        ChunkOpenAI3072Vector.collection_name ==
                        self.collection_name,
                        ChunkOpenAI3072Vector.id == d.id).values(
                            meta_data=d.metadata))
            session.commit()
            logger.info(
                f"update_embedding_data pre updated {len(batch)} items")
        except Exception as e:
            session.rollback()
            logger.error(
                f"PostgresVectorDatabase _execute_update_batch error, err: {e}"
            )
            raise e

    def insert_embedding_cache_data(self, *,
                                    data: InsertEmbeddingDocument) -> int:
        with session_scope(self.session_maker) as session:
            try:
                session.bulk_insert_mappings(
                    self.collection,  # type: ignore
                    [{
                        "id": data.id,
                        "meta_data": data.metadata,
                        "content": data.content,
                        "embedding": data.embedding
                    }])
                session.commit()
                return 1
            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase insert_embedding_cache_data error, err: {e}"
                )
                raise e

    def insert_embedding_data(self,
                              *,
                              data: Iterable[InsertEmbeddingDocument],
                              batch_size: int = 500) -> int:
        with session_scope(self.session_maker) as session:
            try:
                current_batch = []
                insert_count = 0

                for doc in data:
                    current_batch.append({
                        'id': doc.id,
                        'collection_name': self.collection_name,
                        'content': doc.content,
                        'meta_data': doc.metadata,
                        'embedding': doc.embedding
                    })

                    if len(current_batch) >= batch_size:
                        insert_count += self._execute_insert_batch(
                            session, current_batch)
                        current_batch = []

                if current_batch:
                    insert_count += self._execute_insert_batch(
                        session, current_batch)

                return insert_count

            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase insert_embedding_data error, err: {e}"
                )
                raise e

    def _execute_insert_batch(self, session: Session,
                              batch: list[dict[str, Any]]) -> int:
        try:
            session.bulk_insert_mappings(
                ChunkOpenAI3072Vector,  # type: ignore
                batch)
            session.commit()
            logger.info(f"insert_embedding_data inserted {len(batch)} items")
            return len(batch)
        except Exception as e:
            session.rollback()
            logger.error(
                f"PostgresVectorDatabase _execute_insert_batch error, err: {e}"
            )
            raise e

    def get_embedding_count(self) -> int:
        with session_scope(self.session_maker) as session:
            try:
                return session.execute(
                    select(
                        func.count()).select_from(ChunkOpenAI3072Vector).where(
                            ChunkOpenAI3072Vector.collection_name ==
                            self.collection_name)).scalar()  # type: ignore
            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase get_embedding_count error, err: {e}"
                )
                raise e

    def clear_collection(self) -> None:
        with session_scope(self.session_maker) as session:
            try:
                session.execute(
                    delete(ChunkOpenAI3072Vector).where(
                        ChunkOpenAI3072Vector.collection_name ==
                        self.collection_name))
                session.commit()
            except Exception as e:
                logger.error(
                    f"PostgresVectorDatabase clear_collection error err: {e}")
                raise e

    def delete_collection(self) -> None:
        self.clear_collection()

    @classmethod
    def from_config(cls, *, config: dict[str, Any]) -> VectorDatabase:
        return cls(**config)
