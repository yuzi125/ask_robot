import json
from hashlib import sha256
from threading import Lock

import redis
from ava.utils.vector.cache import EmbeddingCache


class RedisEmbeddingCache(EmbeddingCache):

    def __init__(self, *, redis_client: redis.Redis):
        self.redis_client: redis.Redis = redis_client
        self.lock = Lock()

    def get_embedding_cache(self, query: str) -> list[float] | None:
        """
        從 Redis 中根據查詢字符串的哈希值檢索嵌入數據。

        Args:
            query (str): 查詢字符串。

        Returns:
            list[float] | None : 如果找到嵌入數據，返回嵌入數據列表；否則返回 None。
        """
        hash_key: str = sha256(query.encode("utf-8")).hexdigest()
        try:
            with self.lock:
                value = self.redis_client.get(hash_key)
                if value is not None:
                    return json.loads(value)  #type: ignore
        except redis.RedisError as e:
            print(f"Redis Cache error: {e}")
        except json.JSONDecodeError as e:
            print(f"Redis Cache JSON decode error: {e}")
        return None

    def set_embedding_cache(self, query: str, embedding: list[float]) -> None:
        """
        將 embedding 存到 Redis ， key 為查詢字符串的哈希值。

        Args:
            query (str): 查詢字符串。
            embedding (list[float]): 要存的 embedding。
        """
        hash_key: str = sha256(query.encode("utf-8")).hexdigest()
        try:
            self.redis_client.set(hash_key, json.dumps(embedding))
        except redis.RedisError as e:
            print(f"Redis Cache error: {e}")
        except TypeError as e:
            print(f"Redis Cache JSON serialization error: {e}")
