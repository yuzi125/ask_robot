from typing import Any, Protocol


class EmbeddingCache(Protocol):

    def __init__(self, *, cache_client: Any):
        ...

    def get_embedding_cache(self, query: str) -> list[float] | None:
        ...

    def set_embedding_cache(self, query: str, embedding: list[float]) -> None:
        ...
