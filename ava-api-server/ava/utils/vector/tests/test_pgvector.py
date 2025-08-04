import os
import sys
from random import randint
from typing import Any, Generator, Iterator
from uuid import uuid4

import dotenv
import numpy as np
import pytest

dotenv.load_dotenv(".env.pytest")

# 這是為了符合目前 ava 的結構
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..')))

from ava.utils.vector import (EmbeddingDocument, InsertEmbeddingDocument,
                              SearchContentDocument, SearchMetadataDocument,
                              UpdateEmbeddingDocument, VectorDatabase,
                              VectorDatabaseFactory)
from ava.utils.vector.postgres import PostgresVectorDatabase
from ava.utils.vector.postgres.sql import BaseEmbeddingItem

RANDOM_DATA_SIZE = 200
RANDOM_UUIDS: list[str] = [str(uuid4()) for _ in range(RANDOM_DATA_SIZE)]
RANDOM_DOCUMENTS: list[InsertEmbeddingDocument] = [
    InsertEmbeddingDocument(
        id=id,
        embedding=np.random.rand(3072).tolist(),
        metadata={
            "name": f"test_{i}",
            "odd": "1" if i % 2 == 0 else "0"
        },
        content=
        f"test content generate by {i}, and it is a test content, uuid:{id}")
    for i, id in enumerate(RANDOM_UUIDS)
]


@pytest.fixture(scope="function")
def setup_vector_database() -> Generator[VectorDatabase, Any, None]:
    VectorDatabaseFactory._target_class = PostgresVectorDatabase
    vd: VectorDatabase = VectorDatabaseFactory.get_vector_database(
        embedding_model="text-embedding-3-large",
        collection_name=str(uuid4()),
        collection_class=BaseEmbeddingItem)
    assert vd.get_embedding_count() == 0, "Collection is not empty"
    vd.insert_embedding_data(data=RANDOM_DOCUMENTS)
    yield vd
    try:
        vd.delete_collection()
    except Exception as e:
        pass


@pytest.mark.order(1)
def test_insert_embedding_data(setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    before_count: int = vd.get_embedding_count()
    vd.insert_embedding_data(data=[
        InsertEmbeddingDocument(id=str(uuid4()),
                                metadata={
                                    "name": "test",
                                    "odd": "1"
                                },
                                embedding=np.random.rand(3072).tolist(),
                                content="test content")
    ])
    after_count: int = vd.get_embedding_count()
    assert before_count + 1 == after_count, "Insert count is not equal to before count + insert count"


@pytest.mark.order(2)
def test_search_content(setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    test_search_content: Iterator[SearchContentDocument] = vd.search_content(
        query="test content generate by 1", k=4)
    len_of_result = 0
    for _ in test_search_content:
        len_of_result += 1
    assert len_of_result == 4, "Search result count is not equal to k"
    scores: list[float] = [doc.score for doc in test_search_content]
    assert scores == sorted(
        scores, reverse=True), "Scores are not sorted in descending order"


@pytest.mark.order(3)
def test_search_by_id(setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    test_search_by_id: EmbeddingDocument | None = vd.search_by_id(
        id=RANDOM_UUIDS[randint(0, RANDOM_DATA_SIZE - 1)])
    assert test_search_by_id is not None, "No document found with the specified id"
    test_not_exist_id_search: EmbeddingDocument | None = vd.search_by_id(
        id="not_exist_id")
    assert test_not_exist_id_search is None, "Document found with the not_exist_id"


@pytest.mark.order(4)
def test_search_by_ids(setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    random_search_count: int = randint(1, RANDOM_DATA_SIZE)
    test_search_by_ids: Iterator[EmbeddingDocument] = vd.search_by_ids(
        ids=RANDOM_UUIDS[:random_search_count])
    len_of_result = 0
    for _ in test_search_by_ids:
        len_of_result += 1
    assert len_of_result == random_search_count, "Search result count is not equal to the specified count"


@pytest.mark.order(5)
def test_update_embedding_data(setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    origin_data: EmbeddingDocument | None = vd.search_by_id(id=RANDOM_UUIDS[0])
    assert origin_data is not None, "No document found with id when updating"
    new_meta: dict[str, Any] = origin_data.metadata
    new_meta["is_modified"] = "true"
    vd.update_embedding_data(data=[
        UpdateEmbeddingDocument(
            id=RANDOM_UUIDS[0], metadata=new_meta, content=origin_data.content)
    ])
    updated_data: EmbeddingDocument | None = vd.search_by_id(
        id=RANDOM_UUIDS[0])
    assert updated_data is not None, "No document found with id after updating"
    assert updated_data.metadata == new_meta, "Metadata is not updated"


@pytest.mark.order(6)
def test_search_content_by_threshold(
        setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    test_search_content_by_threshold: Iterator[
        SearchContentDocument] = vd.search_content_by_score_threshold(
            query="test content generate by 1", score_threshold=0.15, k=5)
    len_of_result = 0

    for doc in test_search_content_by_threshold:
        assert doc.score >= 0.15, f"Found a document with score {doc.score} which is not greater than 0.15"
        len_of_result += 1
    assert len_of_result <= 5

    scores: list[float] = [
        doc.score for doc in test_search_content_by_threshold
    ]
    assert scores == sorted(
        scores, reverse=True), "Scores are not sorted in descending order"


@pytest.mark.order(7)
def test_search_by_metadata(setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    test_search_metadata: Iterator[
        SearchMetadataDocument] = vd.search_by_metadata(
            metadata_query={"odd": "0"})
    len_of_result = 0
    for _ in test_search_metadata:
        len_of_result += 1
    assert len_of_result > 0, "No documents found with the specified metadata"
    assert len_of_result >= vd.get_embedding_count(
    ) // 2, "Search result count is not equal to half of the total count"


@pytest.mark.order(8)
def test_delete_embedding_by_ids(
        setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    random_delete_count: int = randint(1, RANDOM_DATA_SIZE)
    if random_delete_count % 2 != 0:  # 確保是偶數，不然後面的測試會失敗
        random_delete_count += 1
    test_delete: int = vd.delete_embedding_by_ids(
        ids=RANDOM_UUIDS[:random_delete_count])
    assert test_delete == random_delete_count, "Delete count is not equal to the expected count"
    assert vd.get_embedding_count(
    ) == RANDOM_DATA_SIZE - random_delete_count, "Delete count is not equal to the expected count"


@pytest.mark.order(9)
def test_delete_embedding_by_metadata(
        setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    before_count: int = vd.get_embedding_count()
    test_delete_metadata: int = vd.delete_embedding_by_metadata(
        metadata_query={"odd": "1"})
    assert test_delete_metadata == before_count // 2, "Delete count is not equal to the expected count"


@pytest.mark.order(10)
def test_clear_collection(setup_vector_database: VectorDatabase) -> None:
    vd: VectorDatabase = setup_vector_database
    vd.clear_collection()
    assert vd.get_embedding_count() == 0, "Collection is not empty"
