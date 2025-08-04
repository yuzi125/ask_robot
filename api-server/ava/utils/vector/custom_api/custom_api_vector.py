from typing import Any

from ava.utils.vector import (EmbeddingDocument, InsertEmbeddingDocument,
                              SearchContentDocument, SearchMetadataDocument,
                              UpdateEmbeddingDocument, VectorDatabase)

#TODO : 這邊先預留給之後要透過 API 來存取的方式

class ApiServiceVectorDatabase(VectorDatabase):

    def __init__(self, *, collection_name: str, embedding_model: str,
                 vector_dim: int) -> None:
        ...

    def search_content_by_score_threshold(
            self,
            *,
            query: str,
            metadata_query: dict | None = None,
            score_threshold: float,
            k: int = 5) -> list[SearchContentDocument]:
        ...

    def search_content(self,
                       *,
                       query: str,
                       metadata_query: dict | None = None,
                       k: int = 5) -> list[SearchContentDocument]:
        ...

    def search_by_metadata(
            self, *,
            metadata_query: dict[str, Any]) -> list[SearchMetadataDocument]:
        ...

    def search_by_id(self, *, id: str) -> EmbeddingDocument | None:
        ...

    def search_by_ids(self, *, ids: list[str]) -> list[EmbeddingDocument]:
        ...

    def delete_embedding_by_ids(self, *, ids: list[str]) -> int:
        ...

    def delete_embedding_by_metadata(self, *,
                                     metadata_query: dict[str, Any]) -> int:
        ...

    def insert_embedding_data(self,
                              *,
                              data: list[InsertEmbeddingDocument],
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
                              data: list[UpdateEmbeddingDocument],
                              batch_size: int = 500) -> None:
        ...

    @classmethod
    def from_config(cls, *, config: dict[str, Any]) -> VectorDatabase:
        ...
