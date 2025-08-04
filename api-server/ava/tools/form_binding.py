from json import dumps as json_dumps
from json import loads as json_loads
from logging import Logger, getLogger
from typing import Iterator, Sequence
from uuid import uuid4

from ava.clients.sql.crud import (
    delete_form_binding_by_doc_form_id, edit_form_configuration_enabled,
    insert_form_binding, select_dataset_from_folder_name,
    select_datasets_folder_from_id, select_datasets_from_id,select_model_list_from_id,
    select_form_binding_from_id, update_parent_chunks_metadata)
from ava.clients.sql.schema import (Dataset_Schema,
                                    FormBindingAssociation_Schema,ModelList_Schema)
from ava.utils.vector import (InsertEmbeddingDocument, SearchContentDocument,
                              SearchMetadataDocument, UpdateEmbeddingDocument,
                              VectorDatabase, VectorDatabaseFactory)
from ava.utils.vector.postgres.sql import BaseEmbeddingItem

logger: Logger = getLogger("ava_app")


def bind_form_doc(form_id: str, datasets_id: str, doc_id: str,
                  binding_type: int, session):
    row_dataset: Dataset_Schema | None = select_datasets_from_id(
        datasets_id=datasets_id, session=session)
    assert row_dataset

    
    
    collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
        collection_name=row_dataset.folder_name,
        collection_class=BaseEmbeddingItem,
        embedding_model=row_dataset.config_jsonb.get("embedding_model",
                                                     "text-embedding-3-large")
                                                     )
    chunks: Iterator[SearchMetadataDocument] = collection.search_by_metadata(
        metadata_query={"upload_documents_id": doc_id})
    replace_chunks: list[SearchMetadataDocument] = []
    for chunk in chunks:
        if "binding_form" not in chunk.metadata:
            chunk.metadata["binding_form"] = json_dumps([form_id])
            update_parent_chunks_metadata(
                node_id=chunk.metadata["parent_node"],
                metadata=chunk.metadata,
                session=session)
        else:
            form_ids = json_loads(chunk.metadata["binding_form"])
            if form_id not in form_ids:
                form_ids.append(form_id)
                chunk.metadata["binding_form"] = json_dumps(form_ids)
                update_parent_chunks_metadata(
                    node_id=chunk.metadata["parent_node"],
                    metadata=chunk.metadata,
                    session=session)
        replace_chunks.append(chunk)
    logger.debug(
        f"bind_form_doc, chunk number: {len(replace_chunks)}, doc_id: {doc_id}, form_id: {form_id}"
    )
    collection.update_embedding_data(data=[
        UpdateEmbeddingDocument(
            id=chunk.id, metadata=chunk.metadata, content=chunk.content)
        for chunk in chunks
    ])
    insert_form_binding(id=str(uuid4()),
                        form_id=form_id,
                        dataset_id=datasets_id,
                        document_id=doc_id,
                        binding_type=binding_type,
                        session=session)


def delete_form(form_id, session):
    form_bindings: Sequence[
        FormBindingAssociation_Schema] = select_form_binding_from_id(
            form_id=form_id, session=session)
    for form_binding in form_bindings:
        folder_name: str | None = select_datasets_folder_from_id(
            datasets_id=form_binding.dataset_id, session=session)
        assert folder_name
        unbind_form_doc(form_binding.form_id,
                        folder_name,
                        form_binding.document_id,
                        session=session)
    edit_form_configuration_enabled(form_id=form_id,
                                    is_enable=0,
                                    session=session)


def unbind_form_doc(form_id, datasets_id, doc_id, session):

    row_dataset: Dataset_Schema | None = select_datasets_from_id(
        datasets_id=datasets_id, session=session)
    assert row_dataset
    


    collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
        collection_name=row_dataset.folder_name,
        collection_class=BaseEmbeddingItem,
        embedding_model=row_dataset.config_jsonb.get("embedding_model","text-embedding-3-large")
        )
    
    chunks: Iterator[SearchMetadataDocument] = collection.search_by_metadata(
        metadata_query={"upload_documents_id": doc_id})
    replace_chunks: list[SearchMetadataDocument] = []
    for chunk in chunks:
        if "binding_form" in chunk.metadata:
            form_ids: list = json_loads(chunk.metadata["binding_form"])
            if form_id in form_ids:
                form_ids.remove(form_id)
                chunk.metadata["binding_form"] = json_dumps(form_ids)
                update_parent_chunks_metadata(
                    node_id=chunk.metadata["parent_node"],
                    metadata=chunk.metadata,
                    session=session)
        replace_chunks.append(chunk)
    collection.update_embedding_data(data=[
        UpdateEmbeddingDocument(
            id=chunk.id, metadata=chunk.metadata, content=chunk.content)
        for chunk in replace_chunks
    ])
    delete_form_binding_by_doc_form_id(form_id=form_id,
                                       document_id=doc_id,
                                       session=session)
