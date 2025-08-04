from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Generator, Iterable, Iterator, Protocol, Type, TypeVar ,List
from os import getenv

import tiktoken
from openai import OpenAI
from openai import AzureOpenAI
from openai.types.create_embedding_response import CreateEmbeddingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import Engine, select
import json

from ava.clients.sql.schema import ModelList_Schema
from ava.clients.sql.database import session_scope, create_db_engine, create_session_maker
from ava.config import Config


T = TypeVar("T")


@dataclass
class CollectionLimit:
    collection_name: str
    limit: int
    score_threshold: float
    priority: int


class VectorDatabase(Protocol):

    @property
    def collection_name(self) -> str:
        """Collection name of the vector database."""
        ...

    @property
    def embedding_model(self) -> str:
        """Embedding model name used by this collection."""
        ...

    # TODO:這邊趕時間目前寫的很糟糕，違反了 SOLID 原則，後續需要重構，底層類別不應該依賴高層類別的實作將 engine 和 session_maker 傳入
    def __init__(self, *, engine: Any, session_maker: Any,
                 collection_name: str, embedding_model: str, vector_dim: int,
                 collection_class: Type[T]) -> None:
        ...

    def search_embedding_cache_by_score_threshold(
            self,
            *,
            expert_id: str,
            query_embedding: list[float],
            score_threshold: float,
            k: int = 5) -> Iterator[SearchContentDocument]:
        ...

    def search_content_by_score_threshold(
            self,
            *,
            collections_limits: list[CollectionLimit],
            query: str,
            metadata_query: dict | None = None,
            score_threshold: float,
            k: int = 5) -> Iterator[SearchContentDocument]:
        ...

    def search_content(self,
                       *,
                       collections_limits: list[CollectionLimit],
                       query: str,
                       metadata_query: dict | None = None,
                       k: int = 5) -> Iterator[SearchContentDocument]:
        ...

    def search_embedding_by_score_threshold(
            self,
            *,
            collections_limits: list[CollectionLimit],
            query_embedding: list[float],
            metadata_query: dict | None = None,
            k: int = 5) -> Iterator[SearchContentDocument]:
        ...

    def search_embedding(self,
                         *,
                         collections_limits: list[CollectionLimit],
                         query_embedding: list[float],
                         metadata_query: dict | None = None,
                         k: int = 5) -> Iterator[SearchContentDocument]:
        ...

    def search_by_metadata(
            self, *,
            metadata_query: dict[str,
                                 Any]) -> Iterator[SearchMetadataDocument]:
        ...

    def search_by_id(self, *, id: str) -> EmbeddingDocument | None:
        ...

    def search_by_ids(self, *, ids: list[str]) -> Iterator[EmbeddingDocument]:
        ...

    def delete_embedding_by_ids(self, *, ids: list[str]) -> int:
        ...

    def delete_cache_embedding_by_metadata(
            self, *, expert_id: str, metadata_query: dict[str, Any]) -> int:
        ...

    def delete_embedding_by_metadata(self, *,
                                     metadata_query: dict[str, Any]) -> int:
        ...

    def insert_embedding_cache_data(self, *,
                                    data: InsertEmbeddingDocument) -> int:
        ...

    def insert_embedding_data(self,
                              *,
                              data: Iterable[InsertEmbeddingDocument],
                              batch_size: int = 500) -> int:
        ...

    def get_embedding_count(self) -> int:
        ...

    def clear_collection(self) -> None:
        ...

    def delete_collection(self) -> None:
        ...

    def update_embedding_data(self,
                              *,
                              data: Iterable[UpdateEmbeddingDocument],
                              batch_size: int = 500) -> None:
        ...

    @classmethod
    def from_config(cls, *, config: dict[str, Any]) -> VectorDatabase:
        ...


class EmbeddingDocument(BaseModel):
    """
    表示一筆資料
    """
    id: str
    metadata: dict[str, Any]
    content: str
    is_cache: bool = False

    def __hash__(self) -> int:
        return hash(self.id)

    def __eq__(self, o: object) -> bool:
        if not isinstance(o, EmbeddingDocument):
            return False
        return self.id == o.id


class SearchContentDocument(EmbeddingDocument):
    """
    表示根據內容搜尋到的一筆資料
    """
    score: float


class SearchMetadataDocument(EmbeddingDocument):
    """
    表示根據 metadata 搜尋到的一筆資料
    """
    pass


class InsertEmbeddingDocument(EmbeddingDocument):
    """
    表示要被插入的一筆資料
    """
    embedding: list[float]
    pass


class UpdateEmbeddingDocument(EmbeddingDocument):
    """
    表示要被更新的一筆資料
    """
    pass


def get_openai_embeddings(contents: list[str],
                          embedding_model: str = "text-embedding-3-large",
                          batch_size: int = 500) -> Iterator[list[float]]:
    """
        reference: https://platform.openai.com/docs/guides/embeddings/embedding-models
    """
    MAX_TOKENS:int = 8191

    try:
        encoding: tiktoken.Encoding = tiktoken.encoding_for_model(
            embedding_model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    exceeds_token_limit: bool = any(
        len(encoding.encode(content)) > MAX_TOKENS for content in contents)
    if exceeds_token_limit:
        raise ValueError(
            f"Content exceeds token limit of {MAX_TOKENS} tokens for model {embedding_model}"
        )

    client = OpenAI()

    for i in range(0, len(contents), batch_size):
        batch: list[str] = contents[i:i + batch_size]
        response: CreateEmbeddingResponse = client.embeddings.create(
            input=batch, model=embedding_model)
        for item in response.data:
            yield item.embedding



def get_azure_openai_embeddings(
    contents: list[str],
    embedding_model_id: int,
    session: Session,
    batch_size: int = 500,
) -> Iterator[List[float]]:

    """
    產生 Azure OpenAI Embeddings
    參考: https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/embeddings
    """
    MAX_TOKENS:int = 8191
    
    
    stmt = select(ModelList_Schema).where(
            ModelList_Schema.id ==  embedding_model_id,
            ModelList_Schema.model_type == "embedding",
        )
    model = session.execute(stmt).scalars().first()
        
    if not model:
        raise ValueError(f"找不到 embedding 模型配置: { embedding_model_id}")
    
    # 從數據庫配置中提取必要的信息
    if hasattr(model, 'config'):
        config = json.loads(model.config) if isinstance(model.config, str) else model.config
    
    deployment_name = config.get("deployment_name")
    azure_endpoint = config.get("endpoint")
    azure_api_key = config.get("api_key")
    
    if not all([deployment_name, azure_endpoint, azure_api_key]):
        raise ValueError(f"{model.model_name} 模型配置不完整，缺少必要參數")

    # Ensure values are strings to satisfy type requirements
    deployment_name = str(deployment_name)
    azure_endpoint = str(azure_endpoint)
    azure_api_key = str(azure_api_key)

    try:
        encoding = tiktoken.encoding_for_model(model.model_name)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    exceeds_token_limit = any(
        len(encoding.encode(content)) > MAX_TOKENS for content in contents)
    if exceeds_token_limit:
        raise ValueError(
            f"內容已超過最大 token 限制 {MAX_TOKENS}，目前模型：{model.model_name}")

    client = AzureOpenAI(
        azure_deployment=deployment_name,
        api_key=azure_api_key,
        azure_endpoint=azure_endpoint
    )

    for i in range(0, len(contents), batch_size):
        batch = contents[i:i + batch_size]
        response = client.embeddings.create(
            input=batch,
            model=deployment_name
        )
        for item in response.data:
            yield item.embedding
