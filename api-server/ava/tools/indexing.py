import base64
import json
import logging
import os
import random
import re
import shutil
import tempfile
import threading
import fitz
import torch
import numpy as np
import gc
import platform
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from time import sleep
from typing import Any, Iterator, Sequence
from urllib.parse import urljoin
from uuid import uuid4
from io import BytesIO
from PIL import Image
from datetime import datetime
from functools import lru_cache

import charset_normalizer
import requests
from ava.clients.sql.crud import (
    delete_by_related_chunks, delete_extra_qa, delete_form_binding_by_id,
    delete_parent_chunk, get_parent_chunks_nextval, insert_document_image,
    insert_extra_qa, insert_parent_chunk, is_not_finished_crawler_sync_task,
    select_all_expert_id, select_cdqa_from_id, select_crawler_attachment_by_id,
    select_crawler_attachment_by_sync_id,
    select_crawler_attachment_synchronize_by_id, select_crawler_by_id,
    select_crawler_contents_by_doc_id, select_crawler_document_content_by_id,
    select_crawler_documents_by_sync_id,
    select_crawler_documents_extra_from_crawler_document_id,
    select_dataset_from_attachment_sync_id, select_dataset_from_sync_id,
    select_datasets_folder_from_id, select_datasets_from_folder_name,
    select_datasets_from_id, select_form_binding_from_doc_id,
    select_model_list_from_id, select_parent_chunk_from_id,
    select_settings_from_key, update_crawler_attachment_state_by_id,
    update_crawler_attachment_synchronize_state_by_id,
    update_crawler_content_state_by_doc_id, update_crawler_content_state_by_id,
    update_crawler_document_state, update_crawler_synchronize_state,
    update_parent_chunk_metadata, update_upload_document_is_enable,
    update_upload_document_status, insert_document_image,
    select_model_list_from_id)
from ava.clients.sql.database import scoped_session, session_scope
from ava.clients.sql.schema import (Crawler_Schema, CrawlerAttachment_Schema,
                                    CrawlerAttachmentSynchronize_Schema,
                                    CrawlerDocumentsContent_Schema,
                                    CrawlerDocumentsQAExtra_Schema,
                                    Dataset_Schema, DocumentImageStore_Schema,
                                    FormBindingAssociation_Schema,
                                    ModelList_Schema, ParentChunks_Schema,
                                    UploadDocuments_Schema,
                                    OcrDocumentsTokenLog_Schema)
from ava.model.EmbeddingTokenLogEntry import EmbeddingTokenLogEntry
from ava.model.OcrDocumentsTokenLogEntry import OcrDocumentsTokenLogEntry
from ava.tools.form_binding import bind_form_doc
from ava.utils.redis_utils import get_redis_client_with_retry
from ava.utils.utils import LoggerUtils
from ava.utils.vector import (EmbeddingDocument, InsertEmbeddingDocument,
                              SearchMetadataDocument, VectorDatabase,
                              VectorDatabaseFactory,
                              get_azure_openai_embeddings,
                              get_openai_embeddings)
from ava.utils.vector.postgres.sql import BaseEmbeddingItem
from langchain.text_splitter import (CharacterTextSplitter,
                                     RecursiveCharacterTextSplitter)
from langchain_community.document_loaders.pdf import PyPDFLoader
from langchain_core.documents.base import Document as langchain_Document
from langchain_text_splitters.base import TextSplitter
from langchain_openai import ChatOpenAI
from mistralai import Mistral
from openai import OpenAI
from redis import Redis
from metadata_extractor.anchor import (pdf_to_text_by_anchor, _pdf_report)
from doclayout_yolo import YOLOv10
from huggingface_hub import hf_hub_download

from ..clients.sql.schema import CrawlerDocumentsExtra_Schema

logger = logging.getLogger("ava_app")


def update_mapping_file(mapping_path, filenames_to_remove):
    with open(mapping_path, "r", encoding="utf-8") as f:
        mapping_data = json.load(f)

    for filename in filenames_to_remove:
        if filename in mapping_data:
            del mapping_data[filename]

    with open(mapping_path, "w", encoding="utf-8") as f:
        json.dump(mapping_data, f, ensure_ascii=False, indent=4)


def delete_knowledge_indexing(folder_name, operation_files,session_maker:scoped_session):
    with session_scope(session_maker) as session:
        row_dataset: Dataset_Schema | None = select_datasets_from_folder_name(
            folder_name=folder_name,session=session)
        assert row_dataset, f"folder_name: {folder_name}"
        


        collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
            collection_name=folder_name,
            collection_class=BaseEmbeddingItem,        
            embedding_model=row_dataset.config_jsonb.get("embedding_model",
                                                        "text-embedding-3-large")
            )
        
        # 紀錄所有的 parent node，等去重後拿來當作刪除 cache 的依據
        all_parent_nodes: list[EmbeddingDocument] = []
        for operation in operation_files:
            try:
                embedding_rows: Iterator[
                    SearchMetadataDocument] = collection.search_by_metadata(
                        metadata_query={
                            "upload_documents_id": operation["upload_documents_id"]
                        })
                collection.delete_embedding_by_ids(
                    ids=[row.id for row in embedding_rows])
                parent_node: list[ParentChunks_Schema] = [
                    select_parent_chunk_from_id(
                        node_id=int(child_doc.metadata["parent_node"]),session=session)
                    for child_doc in embedding_rows
                ]
                parent_node_docs: list[EmbeddingDocument] = [
                    EmbeddingDocument(
                        metadata=node.meta_data,
                        content=node.page_content,
                        id=str(node.id)) for node in parent_node
                ]
                all_parent_nodes.extend(parent_node_docs)
                if int(operation["is_delete"]) == 1:
                    update_upload_document_status(
                        upload_documents_id=operation["upload_documents_id"],
                        status=5,session=session)
                    update_upload_document_is_enable(
                        upload_documents_id=operation["upload_documents_id"],
                        is_enable=0,session=session)
                else:
                    update_upload_document_status(
                        upload_documents_id=operation["upload_documents_id"],
                        status=4,session=session)
                binding_row: FormBindingAssociation_Schema | None = select_form_binding_from_doc_id(
                    doc_id=operation["upload_documents_id"],session=session)
                if binding_row:
                    delete_form_binding_by_id(form_binding_id=binding_row.id,session=session)
            except Exception as ex:
                logger.error(
                    f"Error on delete_knowledge_indexing delete chromadb data: {ex}"
                )
                update_upload_document_status(upload_documents_id=operation,
                                            status=99,session=session)
        distinct_docs = list({doc.id: doc for doc in all_parent_nodes}.values())
        threading.Thread(target=delete_knowledge_cache,
                        args=(distinct_docs, session_maker)).start()
        return True


def delete_expert_cache(expert_id: str, cache_ids: list[str]) -> None:
    collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
        collection_name=f"cache_{expert_id}",
        collection_class=BaseEmbeddingItem)
    for cache_id in cache_ids:
        collection.delete_cache_embedding_by_metadata(
            expert_id=expert_id,
            metadata_query={"cache_knowledge_id": cache_id})


def delete_knowledge_cache(target_chunks: list[EmbeddingDocument],session_maker:scoped_session) -> None:
    with session_scope(session_maker) as session:
        cache_id_list: Sequence[str] = delete_by_related_chunks(
            chunk_ids_to_delete=[doc.id for doc in target_chunks],session=session)
        if cache_id_list:
            expert_ids: Sequence[str] = select_all_expert_id(session=session)
            collection_list: dict[str,VectorDatabase] = {
                expert_id: VectorDatabaseFactory.get_vector_database(
                    collection_name=f"cache_{expert_id}",
                    collection_class=BaseEmbeddingItem) for expert_id in expert_ids
            }
            for expert_id, collection in collection_list.items():
                for cache_id in cache_id_list:
                    collection.delete_cache_embedding_by_metadata(
                        expert_id=expert_id,
                        metadata_query={"cache_knowledge_id": cache_id})
        logger.info("delete_knowledge_cache end")


def form_binding_indexing(dataset_id: str, form_id: str,
                          upload_documents_id: str, form_name: str,
                          form_description: str, originalname: str,
                          filename: str, upload_folder_id: str,
                          datasource_url: str, datasource_name: str,
                          separator: str | None,session_maker:scoped_session) -> None:
    with session_scope(session_maker) as session:
        dataset: Dataset_Schema | None = select_datasets_from_id(
            datasets_id=dataset_id,session=session)
        assert dataset, f"dataset_id: {dataset_id}"
        datasets_config: dict = dataset.config_jsonb
        embedding_model: str = datasets_config.get(
            "embedding_model") or "text-embedding-3-large"
        embedding_model_id: int = datasets_config.get(
            "embedding_model_id") or 85
        logger.info(f"embedding_model {embedding_model}")

        #TODO: parent_chunk_size and child_chunk_size should be set in the dataset config
        parent_chunk_size = datasets_config.get("parent_chunk_size") or 700
        parent_chunk_overlap_size = datasets_config.get(
            "parent_chunk_overlap") or parent_chunk_size // 10
        child_chunk_size = datasets_config.get(
            "child_chunk_size") or parent_chunk_size // 5
        child_chunk_overlap_size = datasets_config.get("child_chunk_overlap") or 0
        if not separator:
            parent_node_text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=parent_chunk_size,
                chunk_overlap=parent_chunk_overlap_size,
            )
            child_node_text_splitters = RecursiveCharacterTextSplitter(
                chunk_size=child_chunk_size,
                chunk_overlap=child_chunk_overlap_size)
        else:
            parent_node_text_splitter = CharacterTextSplitter(
                separator,
                chunk_size=parent_chunk_size,
                chunk_overlap=parent_chunk_overlap_size,
            )
            child_node_text_splitters = CharacterTextSplitter(
                separator,
                chunk_size=child_chunk_size,
                chunk_overlap=child_chunk_overlap_size)

        document = langchain_Document(page_content=form_description,
                                    metadata={
                                        "filename": filename,
                                        "originalname": originalname,
                                        "datasource_url": datasource_url,
                                        "datasource_name": datasource_name,
                                        "upload_documents_id":upload_documents_id,
                                        "upload_folder_id": upload_folder_id,
                                        "chunk_type": "knowledge",
                                        "datasets_id": dataset_id
                                    })
        insert_documents: list[InsertEmbeddingDocument] = []
        child_docs_array: list[langchain_Document] = []
        parent_docs_array_split: list[
            langchain_Document] = parent_node_text_splitter.split_documents(
                [document])
        for doc in parent_docs_array_split:
            doc.metadata["node_type"] = "parent"
            next_val: int = get_parent_chunks_nextval(session=session)
            doc.metadata["node_id"] = next_val
            insert_parent_chunk(node_id=next_val,
                                    page_content=doc.page_content,
                                    metadata=doc.metadata,session=session)

            child_docs_array_split: list[
                langchain_Document] = child_node_text_splitters.split_documents(
                    [doc])
            for doc in child_docs_array_split:
                doc.page_content = f"{form_name} {doc.page_content}"
                doc.metadata["node_type"] = "child"
                doc.metadata["parent_node"] = next_val
                del doc.metadata["node_id"]
            child_docs_array.extend(child_docs_array_split)
        try:
            context: str = " ".join(doc.page_content
                                    for doc in parent_docs_array_split)
            entry = EmbeddingTokenLogEntry(
                model_id=embedding_model_id,
                model=embedding_model,
                datasets_id=dataset.id,
            )
            logger.debug(f"form_binding parent entry {entry}")
            logger.debug(f"form_binding parent context {context}")
            LoggerUtils.token_from_embedding(context, entry,session)
            context: str = " ".join(doc.page_content
                                    for doc in child_docs_array_split)
            entry = EmbeddingTokenLogEntry(model_id=embedding_model_id,
                                           model=embedding_model,
                                        datasets_id=dataset.id)
            logger.debug(f"form_binding child entry {entry}")
            logger.debug(f"form_binding child context {context}")
            LoggerUtils.token_from_embedding(context, entry,session)
        except Exception as ex:
            logger.error(f"Error token_from_embedding: {ex}")
            update_upload_document_status(upload_documents_id=upload_documents_id,
                                        status=99,session=session)
        else:
            max_retries = 10
            min_sleep_time = 30
            max_sleep_time = 60
            for attempt in range(1, max_retries + 1):
                try:
                    embeddings: Iterator[list[float]] = get_openai_embeddings(
                        [doc.page_content for doc in child_docs_array],
                        embedding_model)
                    insert_documents.extend([
                        InsertEmbeddingDocument(id=str(uuid4()),
                                                embedding=embedding,
                                                metadata=doc.metadata,
                                                content=doc.page_content)
                        for doc, embedding in zip(child_docs_array, embeddings)
                    ])
                    break
                except Exception as ex:
                    logger.error(f"Attempt {attempt} failed with error: {ex}")
                    if attempt < max_retries:
                        sleep_time = random.uniform(min_sleep_time, max_sleep_time)
                        sleep(sleep_time)
                    else:
                        update_upload_document_status(
                            upload_documents_id=upload_documents_id, status=99,session=session)
        collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
            embedding_model=embedding_model,
            collection_name=dataset.folder_name,
            collection_class=BaseEmbeddingItem)
        if insert_documents:
            try:
                insert_count: int = collection.insert_embedding_data(
                    data=insert_documents)
            except Exception as ex:
                logger.error(f"Error inserting data to vectorDB: {ex}")
            else:
                update_upload_document_status(
                    upload_documents_id=upload_documents_id, status=3,session=session)
                bind_form_doc(form_id, dataset.id, upload_documents_id, 1,session)
        else:
            update_upload_document_status(upload_documents_id=upload_documents_id,
                                        status=99,session=session)


def create_parent_node_text_splitter(default_separators, separator, index,
                                     chunk_size, chunk_overlap):
    return RecursiveCharacterTextSplitter(
        separators=default_separators +
        ([separator[index]] if separator[index] else []),
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

def clean_text(text):
    if text is None:
        return ''
    
    # 移除 NUL 字符
    text = text.replace('\x00', '')

    # 移除 emoji 和其他符號字符
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # 表情符號
        "\U0001F300-\U0001F5FF"  # 符號和象形文字
        "\U0001F680-\U0001F6FF"  # 交通工具和符號
        "\U0001F700-\U0001F77F"  # 其他符號
        "\U0001F780-\U0001F7FF"  # 設定字符
        "\U0001F800-\U0001F8FF"  # 警告符號
        "\U0001F900-\U0001F9FF"  # 表情符號2
        "\U0001FA00-\U0001FA6F"  # 標誌字符
        "\U0001FA70-\U0001FAFF"  # 其他符號
        "\U00002700-\U000027BF"  # Dingbats
        "\U0001F1E6-\U0001F1FF"  # 國旗
        "]+", flags=re.UNICODE
    )
    text = emoji_pattern.sub(r'', text)

    return text

def download_file_as_stream(resource_type: str, folder_path: str, file_name: str, download_url: str = os.getenv("AVA_FILE_SERVICE_URL","")) -> Path:
    """
    下載文件並將其保存到臨時文件中。

    :param resource_type: 文件的資源類型 (如 'crawler' 或 'doc')
    :param folder_path: 文件所在的目錄結構
    :param file_name: 文件名
    :param download_url: 下載 API 的 URL
    :return: 臨時保存的文件路徑 (Path 對象)
    """
    try:
        if not download_url:
            raise RuntimeError("Download URL is not set")
        if download_url.endswith("/"):
            download_url = download_url[:-1]
        full_download_url = f"{download_url}/download/{resource_type}"

        # 創建臨時目錄
        temp_dir = Path(tempfile.mkdtemp())  # 使用 pathlib 的 Path
        temp_file_path = temp_dir / file_name  # 使用 / 操作符拼接文件名
        # 構建 POST 請求的 payload
        payload = {
            "folder_path": folder_path,
            "filename": file_name
        }
        
        # 發送 POST 請求
        response: requests.Response = requests.post(full_download_url, json=payload, stream=True)
        response.raise_for_status()  # 檢查是否成功

       # 將文件流保存到臨時文件中
        with open(temp_file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:  # 避免空的 chunk
                    f.write(chunk)

        logger.info(f"File downloaded successfully and saved to {temp_file_path}")
        return temp_file_path

    except requests.exceptions.RequestException as e:
        logger.error(f"Error downloading file: {e}")
        raise RuntimeError(f"Error downloading file {file_name}") from e
    
def cleanup_temp_dir(temp_dir: Path):
    """
    清理臨時目錄及其內容。

    :param temp_dir: 要刪除的臨時目錄 (Path 對象)
    """
    try:
        shutil.rmtree(temp_dir)  # 刪除臨時目錄及其內容
        logger.info(f"Temporary directory {temp_dir} deleted successfully.")
    except Exception as e:
        logger.error(f"Error deleting temporary directory {temp_dir}: {e}")
def perform_ocr_file(file,folder_name,session) -> tuple[str, dict[str, str]]:
    """對檔案執行 OCR。"""
    if file.name.endswith('.pdf'):
        mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))
        uploaded_pdf = mistral_client.files.upload(
            file={
                "file_name": file.name,
                "content": open(file, "rb"),
            },
            purpose="ocr"
        )
        signed_url = mistral_client.files.get_signed_url(file_id=uploaded_pdf.id)
        ocr_response = mistral_client.ocr.process(
            model="mistral-ocr-latest",
            document={
                "type": "document_url",
                "document_url": signed_url.url,
            },
            include_image_base64=True
        )
        mistral_client.files.delete(file_id=uploaded_pdf.id)
    else:
        raise RuntimeError("Unsupported file type, only pdf is supported")

    raw_markdown,map_uuid_base64 = get_combined_markdown(ocr_response,folder_name,file.stem,session)
    return raw_markdown,map_uuid_base64

def replace_images_in_markdown(markdown_str: str, map_uuid_base64: dict,processing_image_num:int) -> str:
    """在 markdown 中替換圖片佔位符。"""

    image_recognition_prompt = """
        You are a multimodal reasoning assistant working in a scientific RAG (Retrieval-Augmented Generation) pipeline. 
        You will receive multiple images extracted from scientific PDFs, and a list of UUIDs corresponding to these images, ordered as [uuid_0, uuid_1, uuid_2, ...].
        Your task is to analyze and explain each image based on its type, and return the results as a flat JSON object.

        Each key should be the given UUID (not the image filename), and the value should be a plain text explanation of the image content.
        The UUIDs are provided in the same order as the images, so the first UUID maps to the first image, the second to the second, and so on.

        Do not include formatting like markdown, lists, or headers. The output must be clean, natural-sounding scientific text suitable for downstream NLP use.

        ---
        ### Image Type: Chemical Structure or Formula
        The image contains one or more chemical structures or formulas. Your task is to extract the structure and explain it clearly.

        1. Convert the structure into readable scientific text.
        2. Describe the molecule’s or polymer’s backbone and functional groups.
        3. Name recognizable components (e.g., BPDA, PMDA, ether, imide).
        4. If polymers, describe the repeating unit and bonding.
        5. If multiple structures are shown, compare their differences and infer potential functional implications.
        6. If a reaction is depicted, identify reactants, products, and structural transformation.

        ---
        ### Image Type: Graph or Chart
        The image contains a scientific graph (e.g., line, bar, scatter, or curve).

        1. Describe what the X-axis and Y-axis represent, including units and scale.
        2. Summarize what the graph shows: trends, inflection points, curves, and data groupings.
        3. Identify what each line, bar, or point refers to (based on the legend or labels).
        4. Infer what the graph implies about the underlying experiment or material behavior.
        5. If the graph compares multiple items, describe their relative performance or differences.

        ---
        ### Image Type: Scanned Document or Text
        The image contains scanned or rasterized text, such as a paragraph, caption, label, or full page.

        1. Use OCR to extract all text as accurately as possible.
        2. Preserve original word order and correct common OCR issues (e.g., "l" vs "1", spacing).
        3. Keep formatting only if it adds clarity (e.g., headings, bullet points).
        4. The goal is to make the text fully machine-readable and searchable.

        ---
        ### Output format:
        Return a flat JSON object with image filenames as keys and plain text descriptions as values.
        Please return the result as a raw JSON object only, without wrapping it in code blocks or markdown formatting. Do not include ```json or any triple backticks or new lines.

        Example:
        {
        "uuid_1": "This is a transmission graph comparing three materials from 300–500 nm...",
        "uuid_2": "The dissolution rate decreases in exposed areas as DNQ-1 increases...",
        "uuid_3": "This image shows the chemical structure of a polymer composed of..."
        }

    """
    base64_arr = list(map_uuid_base64.values())
    openai_client = OpenAI()
    # 每次從 base64_arr 取 10筆出來，並送往 gpt 多模態利用上方 prompt 取得結果
    for i in range(0,len(base64_arr),10):
        batch_base64_arr = base64_arr[i:i+10]
        try:
            img_base64_content =[
                        {
                            "type": "image_url",
                            "image_url": {
                                "url":
                                base64_str
                            }
                        } for base64_str in batch_base64_arr
                    ]
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role":
                    "system",
                    "content":
                    image_recognition_prompt
                }, {
                    "role":
                    "user",
                    "content":[{"type":"text","text":f"image uuid list: {map_uuid_base64.keys()}"}]+img_base64_content, #type: ignore
                }],
                max_tokens=5000,
                temperature=0,
                top_p=1,
                frequency_penalty=0)
            if response.choices[0].message.content:
                try:
                    json_result = json.loads(response.choices[0].message.content)
                    for index, (img_uuid, img_content) in enumerate(json_result.items()):
                        img_index = i+processing_image_num+index
                        img_name = f"img-{img_index}.jpeg"
                        markdown_str = markdown_str.replace(f"![{img_name}]({img_name})", f"{{{{image:{img_uuid}}}}}{img_content}") # {{uuid}}
                except Exception as e:
                    logger.error(f"Error on parsing image cognition result: {e}")
        except Exception as e:
            logger.error(f"Error on image cognition: {e}")
    return markdown_str

def get_combined_markdown(ocr_response,folder_name,file_name,session) -> tuple[str,dict[str,str]]:
    """組合所有頁面的 markdown。"""
    raw_markdowns = []
    processing_image_num = 0
    file_service_host = os.getenv("AVA_FILE_SERVICE_URL")
    assert file_service_host, "AVA_FILE_SERVICE_URL is not set"
    if file_service_host and not file_service_host.endswith('/'):
        file_service_host += '/'
    upload_api_url = f"{file_service_host}upload/doc"

    map_uuid_base64 = {}
    for page in ocr_response.pages:
        map_uuid_base64 = {}
        map_num_uuid = {}
        for img in page.images:
            img_uuid = uuid4().hex
            img_data = base64.b64decode(img.image_base64.split(',')[1])
            map_uuid_base64[img_uuid] = img.image_base64
            files = {
                'file': (f"{img_uuid}.jpeg", img_data, 'image/jpeg')
            }
            data = {
                'folder_path': f'{folder_name}/{file_name}/images'  # 指定儲存圖片的資料夾路徑
            }
            try:
                response = requests.post(upload_api_url, files=files, data=data)
                response.raise_for_status()
                insert_document_image(row=DocumentImageStore_Schema(upload_document_id=file_name,download_path=f'{folder_name}/{file_name}/images',image_uuid=img_uuid,image_data=img_data,content_type="image/jpeg"),session=session)
            except Exception as e:
                logger.error(f"Error on uploading image: {e}")
        raw_markdowns.append(replace_images_in_markdown(page.markdown, map_uuid_base64,processing_image_num))
        processing_image_num += len(map_uuid_base64)
    return "\n\n".join(raw_markdowns),map_uuid_base64

def is_scanned_pdf(pdf_path, avg_text_threshold=8):
    doc = None
    try:
        doc = fitz.open(pdf_path)
        total_text_length = 0
        page_count = len(doc)

        for page in doc:
            text = page.get_text()  # type: ignore
            total_text_length += len(text)

        if page_count == 0:
            return True  # 沒頁面，當掃描版處理

        avg_text_per_page = total_text_length / page_count
        return avg_text_per_page < avg_text_threshold
    except Exception as e:
        print(f"[Error] Cannot process {pdf_path}: {e}")
        return None
    finally:
        # 確保 PDF 文件句柄在任何情況下都能被正確關閉
        if doc is not None:
            try:
                doc.close()
            except Exception as close_ex:
                print(f"[Error] Cannot close PDF document {pdf_path}: {close_ex}")

def pdf_has_images(pdf_path):
    doc = None
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            images = page.get_images(full=True)
            if images:
                logger.debug(f"第 {page_num + 1} 頁發現圖片")
                del images
                return True
        return False
    except Exception as e:
        logger.error(f"Error on checking pdf has images: {e}")
        return False
    finally:
        # 確保 PDF 文件句柄在任何情況下都能被正確關閉
        if doc is not None:
            try:
                doc.close()
            except Exception as close_ex:
                logger.error(f"Error closing PDF document in pdf_has_images: {close_ex}")

def render_page_image(page, zoom: float = 2.0, max_size: int = 1024) -> tuple[bytes, str, Image.Image]:
    """
    將 PDF 頁面渲染成縮圖並轉為 JPEG bytes、base64 與 PIL 圖片。

    Args:
        page (fitz.Page): PDF 頁面。
        zoom (float, optional): 渲染縮放倍率。預設 2.0。
        max_size (int, optional): 縮圖最大邊尺寸。預設 1024 px。

    Returns:
        tuple: (img_bytes, img_base64, img_pil)
    """
    # 使用 zoom 設定渲染倍率
    matrix = fitz.Matrix(zoom, zoom)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    img_pil = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)

    del pixmap

    # 執行縮圖（最大邊不超過 max_size）
    img_pil.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    with BytesIO() as buffer:
        img_pil.save(buffer, format="JPEG", quality=95)
        img_bytes = buffer.getvalue()
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")

    return img_bytes, img_base64, img_pil

def save_block_with_caption(
    image: Image.Image,
    result,
):
    def image_to_base64(pil_image: Image.Image, format="JPEG"):
        with BytesIO() as buffer:
            pil_image.save(buffer, format=format)
            img_bytes = buffer.getvalue()
        base64_str = base64.b64encode(img_bytes).decode("utf-8")
        return base64_str

    def is_caption_label(label: str):
        return 'caption' in label.lower()

    def is_figure_label(label: str):
        return 'figure' in label.lower() and not is_caption_label(label)

    def match_pairs(target_boxes, caption_boxes):
        pairs = []
        used_caption_ids = set()
        matched_target_ids = set()

        for tgt_idx, tgt_box in target_boxes:
            tx1, ty1, tx2, ty2 = tgt_box
            target_width = tx2 - tx1
            target_height = ty2 - ty1

            best_match = None
            min_dist = float('inf')

            for cap_idx, cap_box in caption_boxes:
                if cap_idx in used_caption_ids:
                    continue
                cx1, cy1, cx2, cy2 = cap_box
                # 改用有重疊就好的判定，而不一定要是水平中心
                overlap_x = max(0, min(tx2, cx2) - max(tx1, cx1))
                if (overlap_x / target_width) <= 0:
                    continue
                # 改用絕對值讓上下的caption都可以被配對到
                dy = abs(cy1 - ty2)
                # 使用 target_height 來限制 caption 的距離，不再是用 y_margin ，怕會有縮放問題
                if dy < min_dist and dy < (1.0 * target_height):
                    best_match = (cap_idx, cap_box)
                    min_dist = dy

            if best_match:
                used_caption_ids.add(best_match[0])
                matched_target_ids.add(tgt_idx)
                pairs.append((tgt_idx, tgt_box, best_match[1]))

        return pairs, matched_target_ids
    
    def is_valid_result(result):
        """
        對 YOLO 的result進行檢查，確保有正確的boxes、classes、class_names。
        boxes = result.boxes.xyxy.cpu().numpy().astype(int)
        classes = result.boxes.cls.cpu().numpy().astype(int)
        class_names = result.names        
        """        
        boxes, classes = [], []
        class_names = {}

        try:
            if not hasattr(result, 'boxes') or result.boxes is None:
                logger.error("result.boxes is missing or None.")
                return boxes, classes, class_names

            if not hasattr(result.boxes, 'xyxy') or result.boxes.xyxy is None:
                logger.error("result.boxes.xyxy is missing or None.")
                return boxes, classes, class_names

            if not hasattr(result.boxes, 'cls') or result.boxes.cls is None:
                logger.error("result.boxes.cls is missing or None.")
                return boxes, classes, class_names

            boxes = result.boxes.xyxy.cpu().numpy().astype(int)
            classes = result.boxes.cls.cpu().numpy().astype(int)

            if len(boxes) == 0 or len(classes) == 0:
                logger.warning("Empty detection results: no boxes or classes.")
                return [], [], {}

            if not hasattr(result, 'names') or result.names is None:
                logger.error("result.names is missing or None.")
                return [], [], {}
            class_names = result.names

        except Exception as e:
            logger.error(f"Exception while extracting detection data: {e}")
            return [], [], {}

        return boxes, classes, class_names

    # === 建立輸出環境與變數 ===
    # 使用臨時列表存儲裁剪的圖片資料，包括位置資料
    temp_crops = []

    # === 擷取 YOLO 預測資訊 ===
    boxes, classes, class_names = is_valid_result(result)

    table_boxes, figure_boxes, caption_boxes = [], [], []

    if len(boxes) > 0 and len(classes) > 0 and class_names:
        for i, cls_id in enumerate(classes):
            label = class_names[cls_id]
            box = boxes[i]
            if label.lower() == 'table':
                table_boxes.append((i, box))
            elif is_figure_label(label):
                figure_boxes.append((i, box))
            elif is_caption_label(label):
                caption_boxes.append((i, box))

    # === 匹配配對結果 ===
    fig_pairs, matched_fig_ids = match_pairs(figure_boxes, caption_boxes)
    tbl_pairs, matched_tbl_ids = match_pairs(table_boxes, caption_boxes)

    # === 處理裁剪的圖塊 ===
    img_width, img_height = image.size
    def save_crop(x1, y1, x2, y2, type_label, index):
        x1 = max(0, min(x1, img_width))
        y1 = max(0, min(y1, img_height))
        x2 = max(x1, min(x2, img_width))
        y2 = max(y1, min(y2, img_height))

        if x2 <= x1 or y2 <= y1:
            logger.warning(f"Invalid crop region: ({x1}, {y1}, {x2}, {y2})")
            return

        crop = image.crop((x1, y1, x2, y2))
        uid = uuid4().hex
        filename = f"{uid}.jpg"
        base64_data = image_to_base64(crop)
        # 保存圖片資料與座標
        temp_crops.append({
            "filename": filename,
            "base64_data": base64_data,
            "y1": y1,  # 使用y1作為主要排序依據
            "x1": x1,  # 使用x1作為次要排序依據
        })

    for idx, (fig_id, fig_box, cap_box) in enumerate(fig_pairs):
        x1 = min(fig_box[0], cap_box[0])
        y1 = min(fig_box[1], cap_box[1])
        x2 = max(fig_box[2], cap_box[2])
        y2 = max(fig_box[3], cap_box[3])
        save_crop(x1, y1, x2, y2, "figure+caption", idx)

    for idx, (tbl_id, tbl_box, cap_box) in enumerate(tbl_pairs):
        x1 = min(tbl_box[0], cap_box[0])
        y1 = min(tbl_box[1], cap_box[1])
        x2 = max(tbl_box[2], cap_box[2])
        y2 = max(tbl_box[3], cap_box[3])
        save_crop(x1, y1, x2, y2, "table+caption", idx)

    # === 處理沒有配對 caption 的 table / figure ===
    for i, box in table_boxes:
        if i not in matched_tbl_ids:
            x1, y1, x2, y2 = box
            save_crop(x1, y1, x2, y2, "table", i)

    for i, box in figure_boxes:
        if i not in matched_fig_ids:
            x1, y1, x2, y2 = box
            save_crop(x1, y1, x2, y2, "figure", i)
            
    # 按照從上到下（y1值小到大），從左到右（x1值小到大）的順序排序
    temp_crops.sort(key=lambda x: (x["y1"], x["x1"]))
    
    # 創建最終返回的字典，不包含座標資料
    crop_images = {}
    for crop in temp_crops:
        crop_images[crop["filename"]] = crop["base64_data"]

    return crop_images

@lru_cache(maxsize=1)
def get_yolo_model():
    try:
        if platform.system().lower() == "windows":
            # windows 預設能連網，所以使用 hf_hub_download
            model_path = hf_hub_download(
                repo_id="juliozhao/DocLayout-YOLO-DocStructBench",
                filename="doclayout_yolo_docstructbench_imgsz1024.pt",
                revision="8c3299a30b8ff29a1503c4431b035b93220f7b11"
            )
        else:
            # docker 設定的路徑
            logger.info(f"欲刪除logger system: {platform.system()}")
            model_path = "/app/models/doclayout_yolo_docstructbench_imgsz1024.pt"
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"模型檔案不存在：{model_path}")

        return YOLOv10(model_path)
    except Exception as e:
        logger.error(f"YOLOv10 模型載入失敗: {e}")
        raise RuntimeError(f"YOLOv10 模型載入失敗: {e}")

def multi_model_ocr_file(file: Path, llm_model: str):
    metadata = {"images": {}, "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}}
    raw_markdowns = []
    scanpdf_start = datetime.now()
    pdf_document = None

    try:
        # 使用 PyMuPDF 打開 PDF 文件
        try:
            pdf_document = fitz.open(file)
        except Exception as e:
            print(f"PDF 打開失敗: {e}")
            print("退回到標準 OCR 處理。")
            raise

        # 多模態 prompt 設計
        multimodal_prompt = """
            你是一個多模態文檔理解專家。你的任務是分析一頁 PDF 轉換成的掃描圖片，並提取所有可見的文字內容、表格、圖表和其他視覺元素。
            請將你的回應組織成結構化的 Markdown 格式。
            請遵循以下規則：
            1. 仔細提取所有文字內容，保持原始格式，包括段落、標題和列表。
            2. 對於表格，使用 Markdown 表格語法重建它們。
            3. 對於圖片、圖表、公式或其他視覺元素，請依照以下方式處理：
            - 我將提供一個 UUID 清單，依照掃描頁面的排列順序（從上到下、從左到右）排列。
            - 每當遇到圖片、圖表、公式等視覺元素時，請依序從 UUID 清單中取出一個 UUID，插入 Markdown 佔位符。
            - 請使用 UUID 作為圖像檔案名稱，包含正確的副檔名（例如 `.jpeg`），如下所示格式：  
                ```
                ![fa6ff019-5eb8-4765-b928-a94b11cff1af.jpeg](fa6ff019-5eb8-4765-b928-a94b11cff1af.jpeg)
                ```
            - 插入後，請在括號下方簡要描述該視覺元素的主要內容。
            4. 請完全依照掃描頁面的原始排列順序處理內容，不可跳過或重排。
            5. 請確保每個視覺元素都恰好插入一個 UUID，不可重複使用或遺漏 UUID。
            6. 如果 UUID 用完而頁面上仍有新視覺元素，請標註 `[Missing UUID]`。
            7. 請完整保留掃描圖片中的所有資訊內容，不得主觀刪剪、潤飾或增刪原始資料。
            - 僅在符合前述規則（如圖片佔位符、Markdown 表格語法等）情況下，允許格式上的結構性轉換或插入，這些屬於對原始內容的**結構重建**，而非新增或刪除內容。
            - 禁止對內容進行主觀省略、總結、改寫或補充說明，除非在圖片佔位符下方提供的簡要描述中，作為說明用途存在，並應**限於客觀敘述該視覺元素的主要內容**。
            最後，不需要重新列出 UUID 清單。
            ---
            重要：  
            - 請嚴格按照提供的 UUID 清單順序消耗。
            - 不要自行生成新的 UUID。
            - 確保文本、表格、圖形、公式都保持文檔完整性。
        """
        # 對每一頁進行處理
        client = OpenAI()
        model = None
        logger.debug("ScanPDF Step 1: YOLOv10 model loading")

        # === 使用下載的方式 ===
        # base_dir = os.path.dirname(__file__)
        # model_path = os.path.join(base_dir, "../model/doclayout_yolo_docstructbench_imgsz1024.pt")
        # model_path = os.path.abspath(model_path)
        # if os.path.exists(model_path):
        #     model = YOLOv10(model_path)
        # else:
        #     logger.error(f"YOLOv10 模型文件不存在: {model_path}，將不進行圖像元素識別")
        #     raise RuntimeError(f"YOLOv10 模型文件不存在: {model_path}，將不進行圖像元素識別")

        # === 使用 hf_hub_download 的方式 ===
        model = get_yolo_model()
        
        logger.debug("ScanPDF Step 1.1: YOLOv10 model loaded")

        # 預處理所有頁面的圖像和YOLOv10結果
        page_data = []
        all_page_images = []
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        logger.debug(f"ScanPDF Step 2: YOLOv10 prediction start")
        
        # 第一階段：預處理所有頁面的圖像和YOLOv10結果
        yolo_start = datetime.now()
        for i in range(pdf_document.page_count):
            page = pdf_document[i]
            img_bytes, img_base64, img_pil = render_page_image(page)

            if (int(i) + 1) % 5 == 0:
                gc.collect()

            # 給 GPT 的 base64 URL
            img_url = f"data:image/jpeg;base64,{img_base64}"
            
            # 給 YOLOv10 提取figure or table
            try:
                result = model.predict(
                    np.array(img_pil),
                    imgsz=1024,
                    conf=0.2,
                    device=device
                )[0]
                
                page_images = save_block_with_caption(img_pil, result)
                
                # 合併到總圖像集合中
                metadata["images"].update(page_images)
                
                # 儲存此頁的資料供後續處理
                page_data.append({
                    "index": i,
                    "img_url": img_url,
                    "page_images": page_images
                })
                
                # 添加整頁圖像到處理清單
                all_page_images.append(img_url)
            except Exception as ex:
                logger.error(f"Error preprocessing page {i+1}: {ex}")
                raise RuntimeError(f"Error preprocessing page {i+1}: {ex}")
        yolo_end = datetime.now()
        logger.debug(f"yolo 耗時(秒): {(yolo_end - yolo_start).total_seconds()}")
        logger.debug(f"ScanPDF Step 2.1: YOLOv10 prediction end")
        logger.debug(f"ScanPDF Step 3: GPT-4o prediction start")

        # 第二階段：使用GPT-4o處理每一頁
        gpt_start = datetime.now()
        for page_info in page_data:
            i = page_info["index"]
            img_url = page_info["img_url"]
            page_images = page_info["page_images"]

            try:
                # 每張切圖都送入 GPT，一張圖 + UUID 一組訊息
                messages = []
                messages.append({
                    "role": "system",
                    "content": multimodal_prompt
                })

                for metadata_img_filename, metadata_img_b64 in page_images.items():
                    messages.append({
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{metadata_img_b64}"
                                }
                            },
                            {
                                "type": "text",
                                "text": f"這張圖對應 UUID：{metadata_img_filename}"
                            }
                        ]
                    })

                # 最後加入整頁圖像 + 結構化分析任務說明
                messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": img_url  # 整頁 base64
                            }
                        },
                        {
                            "type": "text",
                            "text": f"這是第 {i+1} 頁 PDF。請根據以上圖像與 UUID，完成 Markdown 格式的文檔重建任務，請勿刪減或新增內容。"
                        }
                    ]
                })

                # 送入 GPT-4o 多模態辨識（初步 Markdown）
                response = client.chat.completions.create(
                    model=llm_model,
                    messages=messages,
                    max_tokens=12800,
                    temperature=0)

                markdown_content = response.choices[0].message.content or ""
                raw_markdowns.append(markdown_content)
                
                # 累加token使用量
                metadata["token_usage"]["prompt_tokens"] += getattr(response.usage, "prompt_tokens", 0)
                metadata["token_usage"]["completion_tokens"] += getattr(response.usage, "completion_tokens", 0)
                metadata["token_usage"]["total_tokens"] += getattr(response.usage, "total_tokens", 0)
            except Exception as ex:
                logger.error(f"Error processing page {i+1}: {ex}")
                raise RuntimeError(f"Error processing page {i+1}: {ex}")
        gpt_end = datetime.now()
        logger.debug(f"gpt 耗時(秒): {(gpt_end - gpt_start).total_seconds()}")
        logger.debug(f"ScanPDF Step 3.1: GPT-4o prediction end")

        scanpdf_end = datetime.now()
        logger.debug(f"scanpdf 耗時(秒): {(scanpdf_end - scanpdf_start).total_seconds()}")

        # 確保返回正確的類型
        if not raw_markdowns:
            return "", {}

        return "\n\n".join(raw_markdowns), metadata

    except Exception as ex:
        logger.error(f"Error in multi_model_ocr_file: {ex}")
        raise RuntimeError(f"Error in multi_model_ocr_file: {ex}")
    finally:
        # 確保 PDF 文件句柄在任何情況下都能被正確關閉
        if pdf_document is not None:
            try:
                pdf_document.close()
                logger.debug("PDF document closed successfully")
            except Exception as close_ex:
                logger.error(f"Error closing PDF document: {close_ex}")

def process_and_store_images(metadata_images: dict, folder_name:str, file_name:str, session) -> list[str]:
    """
    處理 metadata['images'] 的圖片：
    - 將原始 filename 轉為 UUID
    - 儲存圖片 base64 到資料庫
    - 回傳包含相關 UUID 的列表
    """
    related_uuids = []
    file_service_host = os.getenv("AVA_FILE_SERVICE_URL")
    assert file_service_host, "AVA_FILE_SERVICE_URL is not set"
    if file_service_host and not file_service_host.endswith('/'):
        file_service_host += '/'
    upload_api_url = f"{file_service_host}upload/doc"
    
    for original_filename, image_info in metadata_images.items():
        # 檢查原始檔名是否為 UUID4 hex 格式（32個十六進制字符）
        base_name, _, ext = original_filename.rpartition('.')
        is_uuid_hex = False

        if base_name and len(base_name) == 32:
            try:
                # 使用正則表達式檢查是否為純十六進制字符串
                if re.fullmatch(r'[0-9a-fA-F]{32}', base_name):
                    is_uuid_hex = True
            except:
                is_uuid_hex = False

        # 如果原始檔名不是 UUID4 格式，生成新的
        img_uuid = base_name if is_uuid_hex else uuid4().hex
        img_data = base64.b64decode(image_info)
        related_uuids.append(img_uuid)

        # download.js沒給副檔名預設jpeg、Knowledge.py related_image_urls 寫死jpeg
        files = {
            'file': (f"{img_uuid}.jpeg", img_data, 'image/jpeg')
        }
        data = {
            'folder_path': f'{folder_name}/{file_name}/images'
        }
        try:
            response = requests.post(upload_api_url, files=files, data=data)
            response.raise_for_status()
            insert_document_image(row=DocumentImageStore_Schema(upload_document_id=file_name,download_path=f'{folder_name}/{file_name}/images',image_uuid=img_uuid,image_data=img_data,content_type="image/jpeg"),session=session)
        except Exception as e:
            logger.error(f"Error on uploading image: {e}")

    return related_uuids

def process_pdf_chunk(*,
    document_type:str, folder_name:str, file_name:str, file_mapping:dict[str,Any],
    content_replacement_list:dict[str,str], default_separators:list[str], single_separator_mode:bool, 
    single_separator, separators, parent_chunk_size:int, parent_chunk_overlap_size:int,
    child_chunk_size:int, child_chunk_overlap_size:int,
    embedding_model:str, embedding_model_id:int, datasets:Dataset_Schema, session, process_type:str):

    
    raw_model: ModelList_Schema | None = select_model_list_from_id(
    model_list_id=embedding_model_id,
    session=session
    )
    assert raw_model, f"embedding_model_id: {embedding_model_id}"
    vendor = raw_model.vendor

    contents: dict[Path, langchain_Document] = {}
    file_path: Path = download_file_as_stream("doc", folder_name, file_name)
    file_indexing_version = "V2"
    settings = select_settings_from_key(key="file_indexing_version",session=session)
    if settings and settings.value:
        file_indexing_version = settings.value.strip().upper()
    try:
        if document_type == "document":
            if file_path.suffix == ".pdf":
                # 是V2 但檔案是純文字的話，還是走原先的路。這樣省錢又較快
                if file_indexing_version == "V2":
                    file_indexing_version = "V2" if pdf_has_images(file_path) else "V1"

                if file_indexing_version == "V2":
                    llm_model = None
                    try:
                        # 目前只支援 openai 的模型
                        ocr_model_list_id_settings = select_settings_from_key(key="ocr_model_list_id",session=session)
                        if ocr_model_list_id_settings and ocr_model_list_id_settings.value:
                            ocr_model_list_id = int(ocr_model_list_id_settings.value)
                        else:
                            # 若沒有設定，則使用 gpt-4o
                            ocr_model_list_id = 1
                        row_model_list = select_model_list_from_id(model_list_id=ocr_model_list_id, session=session)
                        if not row_model_list or not row_model_list.model_name:
                            logger.error("Model or model name not found.")
                            update_upload_document_status(upload_documents_id=file_path.stem,
                                                        status=99,session=session)
                            return
                        llm_model = row_model_list.model_name
                    except Exception as e:
                        logger.error(f"Error on process pdf selecting model: {e}")
                        update_upload_document_status(upload_documents_id=file_path.stem,
                                                    status=99,session=session)
                        return

                    try:
                        fullpdf_start = datetime.now()
                        if is_scanned_pdf(file_path):
                            logger.info("scanned pdf")
                            text, metadata = multi_model_ocr_file(file_path, llm_model)
                        else:
                            logger.info("normal pdf")
                            normalpdf_start = datetime.now()
                            with open(file_path, 'rb') as f:
                                file_data = f.read()
                            with BytesIO(file_data) as pdf_bytes:
                                text, metadata = pdf_to_text_by_anchor(pdf_bytes,
                                                                llm=ChatOpenAI(model=llm_model),
                                                                use_image=True)
                            normalpdf_end = datetime.now()
                            logger.debug(f"normal pdf 耗時(秒): {(normalpdf_end - normalpdf_start).total_seconds()}")

                        entry = OcrDocumentsTokenLogEntry(
                            datasets_id=datasets.id,
                            upload_document_id=file_path.stem,
                            document_type=f"{document_type}/{file_path.suffix.lstrip('.')}",
                            model=llm_model,
                            model_list_id=ocr_model_list_id,
                            prompt_token=metadata.get("token_usage", {}).get("prompt_tokens", 0),
                            completion_token=metadata.get("token_usage", {}).get("completion_tokens", 0)
                        )
                        LoggerUtils.ocr_documents_log_token_info(entry, session)

                        if text and metadata:
                            metadata["related_image_uuids"] = process_and_store_images(
                                metadata.get("images", {}),
                                folder_name,
                                file_path.stem,
                                session)
                            # 處理完後，清空metadata中的images。因為前端後面會saveMessage，傳base64會爆炸。
                            metadata["images"] = {}
                            contents[file_path] = langchain_Document(
                                page_content=text,
                                metadata=metadata
                            )
                            fullpdf_end = datetime.now()
                            logger.debug(f"處理 pdf 耗時(秒): {(fullpdf_end - fullpdf_start).total_seconds()}")
                        else:
                            logger.info(f"PDF file {file_name} is empty")
                            update_upload_document_status(upload_documents_id=file_path.stem,
                                                        status=99,session=session)
                            return
                    except Exception as e:
                        logger.error(f"Error on document pdf: {e}")
                        update_upload_document_status(upload_documents_id=file_path.stem,
                                                    status=99,session=session)
                        raise RuntimeError(f"Error on document pdf: {e}")

                    # content,map_uuid_base64 = perform_ocr_file(file_path,folder_name,session)
                    # contents[file_path] = langchain_Document(
                    #     page_content=content,
                    #     metadata={"source": str(file_path)}
                    # )
                elif file_indexing_version == "V1":
                    loader = PyPDFLoader(str(file_path))
                    pages: Iterator[langchain_Document] = loader.lazy_load()
                    first_page: langchain_Document | None = next(pages, None)
                    if first_page:
                        del first_page.metadata["page"]
                        contents[file_path] = langchain_Document(
                            page_content=
                            f'{first_page.page_content}{"".join((p.page_content for p in pages))}',
                            metadata=first_page.metadata)
                    else:
                        logger.info(f"PDF file {file_name} is empty")
                        update_upload_document_status(upload_documents_id=file_path.stem,
                                                    status=99,session=session)                
            elif file_path.suffix == ".txt":
                # 處理 TXT 文件，檢測並使用正確編碼讀取
                try:
                    with open(file_path, 'rb') as raw_file:
                        result = charset_normalizer.detect(raw_file.read())

                    encoding = result.get('encoding', None)
                    
                    # 檢查是否獲得有效的編碼
                    if not isinstance(encoding, str):
                        raise RuntimeError(f"Unable to detect encoding for {file_path}")
                    
                    # 使用檢測到的編碼打開文件
                    with open(file_path, 'r', encoding=encoding) as txt_file:
                        text = txt_file.read()

                    txt_document = langchain_Document(page_content=text, metadata={"source": str(file_path)})
                    contents[file_path] = txt_document
                    
                except Exception as e:
                    logger.error(f"Error loading {file_path}: {e}")
                    update_upload_document_status(upload_documents_id=file_path.stem,
                                                status=99,session=session)
                    raise RuntimeError(f"Error loading {file_path}") from e
        elif document_type == "image":
            try:
                #TODO: 先寫死用 gpt-4o 模型，之後要改掉。原先是用 gpt-4o，所以這裡才會沿用。
                gpt_4o_model_list_id = 1
                llm_model = None
                try:
                    row_model_list = select_model_list_from_id(model_list_id=gpt_4o_model_list_id, session=session)
                    if not row_model_list or not row_model_list.model_name:
                        logger.error("document_type:image model or model name not found.")
                        update_upload_document_status(upload_documents_id=file_path.stem,
                                                    status=99,session=session)
                        return
                    llm_model = row_model_list.model_name
                except Exception as e:
                    logger.error(f"Error on process document_type:image selecting model: {e}")
                    update_upload_document_status(upload_documents_id=file_path.stem,
                                                status=99,session=session)
                    return
                
                client = OpenAI()
                with open(file_path, "rb") as image_file:
                    base64_encoding: str = base64.b64encode(
                        image_file.read()).decode('utf-8')

                response = client.chat.completions.create(
                    model=llm_model,
                    messages=[{
                        "role":
                        "system",
                        "content":
                        "用繁體中文將給定圖片中的所有能辨識的文字資訊輸出，若圖片內沒有任何文字資訊則輸出'無內容'、並在最後分析這張圖片對其做解釋"
                    }, {
                        "role":
                        "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url":
                                    f"data:image/jpeg;base64,{base64_encoding}"
                                }
                            },
                        ],
                    }],
                    max_tokens=3000,
                    temperature=0,
                    top_p=1,
                    frequency_penalty=0)
                if response.choices[0].message.content:
                    contents[file_path] = langchain_Document(
                        page_content=response.choices[0].message.content)
                    if response.usage:
                        entry = OcrDocumentsTokenLogEntry(
                            datasets_id=datasets.id,
                            upload_document_id=file_path.stem,
                            document_type=f"{document_type}/{file_path.suffix.lstrip('.')}",
                            model=llm_model,
                            model_list_id=gpt_4o_model_list_id,
                            prompt_token=response.usage.prompt_tokens,
                            completion_token=response.usage.completion_tokens
                        )
                        LoggerUtils.ocr_documents_log_token_info(entry, session)
                    else:
                        logger.error(f"document_type:image response.usage is empty")
                        update_upload_document_status(
                            upload_documents_id=file_path.stem, status=99,session=session)
                        return
                else:
                    logger.error(f"Image file {file_name} is empty")
                    update_upload_document_status(
                        upload_documents_id=file_path.stem, status=99,session=session)
                    return
            except Exception as ex:
                logger.exception(f"Error on image cognition", exc_info=ex)
                update_upload_document_status(upload_documents_id=file_path.stem,
                                            status=99,session=session)
                return
        else:
            logger.error(f"Unknown document type: {document_type}")
            update_upload_document_status(upload_documents_id=file_path.stem,
                                        status=99,session=session)
            return

        for pdf_content_document in contents.values():
            # 先清理掉 NUL 字符
            pdf_content_document.page_content = clean_text(pdf_content_document.page_content)
            
            # 檢查是否啟用內容替換功能
            enable_content_replacement = datasets.config_jsonb.get("enable_content_replacement_list", True)
            if enable_content_replacement == True and content_replacement_list:
                for key, value in content_replacement_list.items():
                    try:
                        pdf_content_document.page_content = re.sub(
                            key, value, pdf_content_document.page_content)
                    except re.error:
                        pdf_content_document.page_content = pdf_content_document.page_content.replace(
                            key, value)
                    
                    # 再次清理文本，防止替換操作引入新的無效字符
                    pdf_content_document.page_content = clean_text(pdf_content_document.page_content)

        logger.debug(f"pdf_contents: {contents}")

        child_node_text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=child_chunk_size, chunk_overlap=child_chunk_overlap_size)
        backend_host: str | None = os.getenv("IMAGE_DOWNLOAD_DOMAIN")
        assert backend_host, "AVA_BACKEND_URL is not set"
        if backend_host and not backend_host.endswith('/'):
            backend_host += '/'
        for i, (pdf_path, pdf_content_document) in enumerate(contents.items()):
            effective_separators: list[str]
            if single_separator_mode:
                effective_separators = [single_separator] + default_separators if single_separator else default_separators
            else:
                effective_separators = [separators[i]] + default_separators if separators[i] else default_separators  # type: ignore

            parent_node_text_splitter = RecursiveCharacterTextSplitter(
                separators=effective_separators,
                chunk_size=parent_chunk_size,
                chunk_overlap=parent_chunk_overlap_size,
            )
            document_mapping = file_mapping.get(pdf_path.name)
            assert document_mapping, f"pdf_path: {pdf_path.name}"
            document_mapping["chunk_type"] = "knowledge"
            pdf_content_document.metadata.update(document_mapping)
            logger.info(f"document metadata: {pdf_content_document.metadata}")
            parent_docs_array_split: list[
                langchain_Document] = parent_node_text_splitter.split_documents(
                    [pdf_content_document])
            if document_type == "image":
                for i in range(len(parent_docs_array_split)):
                    parent_docs_array_split[i].page_content += f"\n![{document_mapping["originalname"]}]({urljoin(backend_host,f"download/{document_mapping["filename"]}")})"
            child_docs_array: list[
                langchain_Document] = split_child_doc_from_parent(
                    parent_docs_array_split, child_node_text_splitter,session)
            try:
                log_token_embedding(embedding_model_id, embedding_model, datasets.id, child_docs_array,
                                    "child",session)
            except Exception as ex:
                logger.error(f"Error token_from_embedding: {ex}")
                update_upload_document_status(upload_documents_id=pdf_path.stem,
                                            status=99,session=session)
            else:
                max_retries = 10
                min_sleep_time = 30
                max_sleep_time = 60
                for attempt in range(1, max_retries + 1):
                    try:
                        if vendor == "openai":
                            embeddings: Iterator[list[float]] = get_openai_embeddings(
                                [doc.page_content for doc in child_docs_array],
                                embedding_model)
                        elif vendor == "azure":
                            embeddings: Iterator[list[float]] = get_azure_openai_embeddings(
                                [doc.page_content for doc in child_docs_array],
                                embedding_model_id,session)                       
                        break
                    except Exception as ex:
                        logger.error(f"Attempt {attempt} failed with error: {ex}")
                        if attempt < max_retries:
                            sleep_time = random.uniform(min_sleep_time,
                                                        max_sleep_time)
                            sleep(sleep_time)
                        else:
                            update_upload_document_status(
                                upload_documents_id=pdf_path.stem, status=99,session=session)
                collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                    collection_name=folder_name,
                    collection_class=BaseEmbeddingItem,
                    embedding_model=embedding_model,
                    config=VectorDatabaseFactory._get_db_config(process_type))
                collection.insert_embedding_data(
                    data=(InsertEmbeddingDocument(id=doc.metadata["node_id"],
                                                embedding=embedding,
                                                metadata=doc.metadata,
                                                content=doc.page_content)
                        for doc, embedding in zip(child_docs_array, embeddings)))
                update_upload_document_status(upload_documents_id=pdf_path.stem,
                                            status=3,session=session)
        return contents
    except Exception as ex:
        logger.error(f"Error processing pdf chunk: {ex}", exc_info=True)
        raise ex
    finally:
        cleanup_temp_dir(file_path.parent)

def run_single_knowledge_indexing(
        raw_upload_document: UploadDocuments_Schema,session_maker,process_type="default") -> None:
    with session_scope(session_maker) as session:
        folder_name: str | None = select_datasets_folder_from_id(datasets_id=raw_upload_document.datasets_id,session=session)
        assert folder_name, f"datasets_id: {raw_upload_document.datasets_id}"
        raw_dataset: Dataset_Schema | None = select_datasets_from_id(datasets_id=raw_upload_document.datasets_id,session=session)
        assert raw_dataset, f"datasets_id: {raw_upload_document.datasets_id}"

        embedding_model_id = int(raw_dataset.config_jsonb.get("embedding_model_id", 85))

        raw_model: ModelList_Schema | None = select_model_list_from_id(
            model_list_id=embedding_model_id,
            session=session
        )
        assert raw_model, f"embedding_model_id: {embedding_model_id}"

        if raw_upload_document.document_type == "document":
            if raw_upload_document.filename.endswith(".txt"):
                file_name: str = raw_upload_document.filename  # 如果是 .txt 副檔名則保持不變
            else:
                file_name: str = raw_upload_document.filename.split(".")[0] + ".pdf"  # 不是 .txt 的話轉成 .pdf
        else:
            file_name: str = raw_upload_document.filename  # 圖片保持原始檔名

        try:
            logger.info("restore run_single_knowledge_indexing start")
            file_mapping = {
                file_name: {
                    "filename": file_name,
                    "originalname": raw_upload_document.originalname,
                    "upload_documents_id": raw_upload_document.id,
                    "upload_folder_id": raw_upload_document.upload_folder_id,
                    "separator": raw_upload_document.separator,
                    "datasets_id": raw_upload_document.datasets_id,
                    "datasource_type": "A",
                    "datasource_url": raw_upload_document.datasource_url,
                    "datasource_name": raw_upload_document.datasource_name
                }
            }
            datasets_config: dict[str, Any] = raw_dataset.config_jsonb
            
            embedding_model: str = raw_model.model_name or "text-embedding-3-large"
            # embedding_model: str = datasets_config.get("embedding_model") or "text-embedding-3-large"
            content_replacement_list: dict = json.loads(datasets_config.get("content_replacement_list", "{}")) or {}
            parent_chunk_size, parent_chunk_overlap_size,\
                child_chunk_size, child_chunk_overlap_size = get_chunk_sizes(datasets_config)
            default_separators: list[str] = ["\n\n", "\n", " ", ""]

            process_pdf_chunk(
                document_type=raw_upload_document.document_type,
                folder_name=folder_name,
                file_name=file_name,
                file_mapping=file_mapping,
                content_replacement_list=content_replacement_list,
                default_separators=default_separators,
                single_separator_mode=True,
                single_separator=raw_upload_document.separator,
                separators=None,
                parent_chunk_size=parent_chunk_size,
                parent_chunk_overlap_size=parent_chunk_overlap_size,
                child_chunk_size=child_chunk_size,
                child_chunk_overlap_size=child_chunk_overlap_size,
                embedding_model=embedding_model,
                embedding_model_id=embedding_model_id,
                datasets=raw_dataset,
                session=session,
                process_type=process_type
            )
            logger.info("restore run_single_knowledge_indexing end")
        except Exception as ex:
            logger.error(
                f"restore run_single_knowledge_indexing failed, error: {ex}")
            update_upload_document_status(
                upload_documents_id=raw_upload_document.id, status=99,session=session)
            return


def requeue_knowledge_task(task: UploadDocuments_Schema,session_maker:scoped_session):
    try:
        with session_scope(session_maker) as session:
            lock_name: str = f"ava:knowledge_{task.id}_lock"
            redis_client: Redis = get_redis_client_with_retry()
            expire_time: int = 60 * 5
            if redis_client.set(lock_name, "1", nx=True, ex=expire_time):
                logger.info(f"requeue_knowledge_task start: {task.id}")
                stop_event = threading.Event()
                threading.Thread(target=renew_lock,
                                args=(redis_client, lock_name, expire_time,
                                    stop_event)).start()
                update_upload_document_status(upload_documents_id=task.id,
                                            status=2,session=session)
                stop_event.set()
                redis_client.delete(lock_name)
                logger.info(f"requeue_knowledge_task end: {task.id}")
    except Exception as ex:
        logger.error(f"Error requeue_knowledge_task: {ex}")
    finally:
        redis_client.close()


def restart_knowledge_indexing(
        executor: ThreadPoolExecutor,
        upload_documents: list[UploadDocuments_Schema],
        session_maker
        ) -> None:
    future_result = [
        executor.submit(run_single_knowledge_indexing, upload_document,session_maker,"knowledge")
        for upload_document in upload_documents
    ]
    for future in as_completed(future_result):
        try:
            future.result()
        except Exception as ex:
            logger.error(f"Error restarting knowledge indexing: {ex}")

def restart_crawler_attachment_task(
        executor: ThreadPoolExecutor, row_dataset: Dataset_Schema,
        row_attachments: list[CrawlerAttachment_Schema],session_maker: scoped_session):
    if not row_attachments:
        return
    embedding_model = row_dataset.config_jsonb.get(
        "embedding_model") or "text-embedding-3-large"
    embedding_model_id = int(row_dataset.config_jsonb.get("embedding_model_id", 85))
    collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
        collection_name=row_dataset.folder_name,
        collection_class=BaseEmbeddingItem, 
        embedding_model=embedding_model,
        config=VectorDatabaseFactory._get_db_config("crawler"))
    future_result = [
        executor.submit(run_single_restore_crawler_attachment, row_dataset,
                        row_attachment, embedding_model_id, collection,session_maker)
        for row_attachment in row_attachments
    ]
    for future in as_completed(future_result):
        try:
            future.result()
        except Exception as ex:
            logger.error(f"Error restarting crawler attachment indexing: {ex}")

def run_single_restore_crawler_attachment(
        row_dataset: Dataset_Schema, row_attachment: CrawlerAttachment_Schema,
        embedding_model_id: int, collection: VectorDatabase,session_maker: scoped_session):
    file_path: Path = download_file_as_stream(resource_type="crawler",folder_path=row_attachment.upload_folder_id,file_name=row_attachment.filename)
    loader = PyPDFLoader(str(file_path))
    pages: Iterator[langchain_Document] = loader.lazy_load()
    first_page: langchain_Document | None = next(pages, None)
    pdf_content_document = None
    if not first_page:
        logger.error(f"Error loading crawler attachment: {file_path}")
        return
    else:
        del first_page.metadata["page"]
        pdf_content_document = langchain_Document(
            page_content=
            f'{first_page.page_content}{"".join((p.page_content for p in pages))}',
            metadata=first_page.metadata)
    if not pdf_content_document:
        logger.error(f"Error loading crawler attachment: {file_path}")
        return
    pdf_content_document.metadata.update( {"chunk_type": "crawler_attachment",
                    "datasource_type": "B",
                    "datasource_url": row_attachment.attachment_href,
                    "datasource_name": row_attachment.attachment_link_text,
                    "originalname": row_attachment.filename,
                    "page_url":row_attachment.page_url,
                    "page_title":row_attachment.page_title,
                    "filename":row_attachment.filename,
                    "datasets_id": row_dataset.id,
                    "crawler_attachment_id": row_attachment.id,
                    "crawler_attachment_synchronize_id": row_attachment.crawler_synchronize_id,
                })
    datasets_config: dict[str, Any] = row_dataset.config_jsonb
    content_replacement_list: dict = json.loads(
        datasets_config.get("content_replacement_list", "{}")) or {}
    pdf_content_document.page_content = clean_text(pdf_content_document.page_content)
    
    # 檢查是否啟用內容替換功能
    enable_content_replacement = datasets_config.get("enable_content_replacement_list", True)
    if enable_content_replacement is not False and content_replacement_list:
        for key, value in content_replacement_list.items():
            try:
                pdf_content_document.page_content = re.sub(
                    key, value, pdf_content_document.page_content)
            except re.error:
                pdf_content_document.page_content = pdf_content_document.page_content.replace(
                    key, value)
            
            # 再次清理文本，防止替換操作引入新的無效字符
            pdf_content_document.page_content = clean_text(pdf_content_document.page_content)
    child_chunk_size, child_chunk_overlap_size, parent_chunk_size, parent_chunk_overlap_size = get_chunk_sizes(
        datasets_config)
    child_node_text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=child_chunk_size, chunk_overlap=child_chunk_overlap_size)
    parent_node_text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=parent_chunk_size, chunk_overlap=parent_chunk_overlap_size)
    parent_docs_array_split: list[langchain_Document] = parent_node_text_splitter.split_documents(
        [pdf_content_document])
    with session_scope(session_maker) as session:
        child_docs_array: list[langchain_Document] = split_child_doc_from_parent(
            parent_docs_array_split, child_node_text_splitter,session)
        try:    
            embedding_model = row_dataset.config_jsonb.get("embedding_model") or "text-embedding-3-large"
            embeddings: Iterator[list[float]] = get_openai_embeddings(
                [doc.page_content for doc in child_docs_array],
                embedding_model)
            log_token_embedding(embedding_model_id, embedding_model, row_dataset.id,
                                child_docs_array, "child",session)
        except Exception as ex:
            logger.error(f"Error token_from_embedding: {ex}")
            update_crawler_attachment_state_by_id(crawler_attachment_id=row_attachment.id,
                                                state=99,session=session)
            return
        try:
            collection.insert_embedding_data(
                data=(InsertEmbeddingDocument(id=doc.metadata["node_id"],
                                            embedding=embedding,
                                            metadata=doc.metadata,
                                            content=doc.page_content)
                    for doc, embedding in zip(child_docs_array, embeddings)))
            update_crawler_attachment_state_by_id(crawler_attachment_id=row_attachment.id,
                                                state=3,session=session)
        except Exception as ex:
            logger.error(f"Error insert_embedding_data: {ex}")
            update_crawler_attachment_state_by_id(crawler_attachment_id=row_attachment.id,
                                                state=99,session=session)
            return
def restart_crawler_content_task(
        executor: ThreadPoolExecutor, row_dataset: Dataset_Schema,
        row_contents: list[CrawlerDocumentsContent_Schema],session_maker: scoped_session):
    if not row_contents:
        return
    embedding_model = row_dataset.config_jsonb.get(
        "embedding_model") or "text-embedding-3-large"
    collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
        collection_name=row_dataset.folder_name,
        collection_class=BaseEmbeddingItem,
        embedding_model=embedding_model,
        config=VectorDatabaseFactory._get_db_config("crawler"))
    
    # 改进: 使用线程本地存储来跟踪每个线程的任务和状态
    future_to_content = {}
    
    for row_content in row_contents:
        future = executor.submit(
            run_single_restore_crawler_content, 
            row_dataset,
            row_content, 
            embedding_model, 
            collection,
            session_maker
        )
        future_to_content[future] = row_content
    
    for future in as_completed(future_to_content):
        row_content = future_to_content[future]
        try:
            future.result()
        except Exception as ex:
            logger.error(f"Error restarting crawler indexing for content {row_content.id}: {ex}")
            
            # 在主线程中处理失败的内容，确保状态被正确更新
            try:
                with session_scope(session_maker) as recovery_session:
                    # 更新失败的内容状态为错误
                    update_crawler_content_state_by_id(
                        crawler_content_id=row_content.id,
                        state=99,
                        session=recovery_session
                    )
                    # 更新文档状态
                    update_crawler_document_state(
                        crawler_document_id=row_content.crawler_documents_id,
                        state=99,
                        session=recovery_session
                    )
            except Exception as recovery_ex:
                logger.error(f"Failed to update error state for content {row_content.id}: {recovery_ex}")

def requeue_crawler_attachment_task(task: CrawlerAttachment_Schema,session_maker:scoped_session):
    try:
        with session_scope(session_maker) as session:
            lock_name: str = f"ava:crawler_attachment_{task.id}_lock"
            redis_client: Redis = get_redis_client_with_retry()
            expire_time: int = 60 * 5
            if redis_client.set(lock_name, "1", nx=True, ex=expire_time):
                logger.info(f"requeue_crawler_attachment_task start: {task.id}")
                stop_event = threading.Event()
                threading.Thread(target=renew_lock,
                                args=(redis_client, lock_name, expire_time,
                                    stop_event)).start()
                update_crawler_attachment_state_by_id(crawler_attachment_id=task.id, state=2,session=session)
                stop_event.set()
                redis_client.delete(lock_name)
                logger.info(f"requeue_crawler_attachment_task end: {task.id}")
    except Exception as ex:
        logger.error(f"Error requeue_crawler_attachment_task: {ex}")
    finally:
        redis_client.close()

def requeue_crawler_content_task(task: CrawlerDocumentsContent_Schema,session_maker:scoped_session):
    try:
        with session_scope(session_maker) as session:
            lock_name: str = f"ava:crawler_content_{task.id}_lock"
            redis_client: Redis = get_redis_client_with_retry()
            expire_time: int = 60 * 5
            if redis_client.set(lock_name, "1", nx=True, ex=expire_time):
                logger.info(f"requeue_crawler_content_task start: {task.id}")
                stop_event = threading.Event()
                threading.Thread(target=renew_lock,
                                args=(redis_client, lock_name, expire_time,
                                    stop_event)).start()
                update_crawler_content_state_by_id(crawler_content_id=task.id, state=2,session=session)
                stop_event.set()
                redis_client.delete(lock_name)
                logger.info(f"requeue_crawler_content_task end: {task.id}")
    except Exception as ex:
        logger.error(f"Error requeue_crawler_content_task: {ex}")
    finally:
        redis_client.close()


def run_single_restore_crawler_content(
        row_dataset: Dataset_Schema,
        row_content: CrawlerDocumentsContent_Schema, embedding_model: str,
        collection: VectorDatabase,session_maker: scoped_session) -> None:
    logger.info(f"Starting restore crawler content for content_id: {row_content.id}")
    try:
        with session_scope(session_maker) as session:
            try:
                row_crawler: Crawler_Schema | None = select_crawler_by_id(crawler_id=row_content.crawler_id,session=session)
                assert row_crawler, f"crawler_id: {row_content.crawler_id}"
                parent_chunk_size, parent_chunk_overlap_size, child_chunk_size, child_chunk_overlap_size = get_chunk_sizes(
                row_dataset.config_jsonb)
                parent_node_text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=parent_chunk_size,
                    chunk_overlap=parent_chunk_overlap_size,
                )
                child_node_text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=child_chunk_size,
                    chunk_overlap=child_chunk_overlap_size)
                parent_docs_array_split: list[langchain_Document] = []
                _row_title = row_content.title
                _row_text = row_content.text[:100]
                if _row_title.strip() == _row_text.strip():
                    _row_datasource_name = _row_title
                else:
                    _row_datasource_name = f"{_row_title} - {_row_text}"
                meta_data: dict[str, Any] = {
                    "chunk_type": "crawler",
                    "datasource_url": row_content.url,
                    "datasource_name":_row_datasource_name,
                    "datasource_type": "B",
                    "datasets_id": row_dataset.id,
                    "crawler_documents_content_id": row_content.id,
                    "crawler_synchronize_id": row_content.crawler_synchronize_id,
                    "crawler_documents_id": row_content.crawler_documents_id,
                    "crawler_id": row_content.crawler_id,
                    "crawler_title":row_crawler.title
                }
                meta_data.update(row_content.meta_data)
                split_texts = parent_node_text_splitter.split_text(row_content.content)
                for text in split_texts:
                    parent_docs_array_split.append(
                        langchain_Document(page_content=text, metadata=meta_data))
                
                child_docs_array: list[
                    langchain_Document] = split_child_doc_from_parent(
                        parent_docs_array_split, child_node_text_splitter, session, row_crawler.title)
                
                # 获取embedding_model_id
                embedding_model_id = int(row_dataset.config_jsonb.get("embedding_model_id", 85))
                # token计算也放在当前事务中
                log_token_embedding(embedding_model_id, embedding_model, row_dataset.id,
                                    child_docs_array, "child", session)
                embeddings_result = None
                max_retries = 10
                min_sleep_time = 30
                max_sleep_time = 60

                for attempt in range(1, max_retries + 1):
                    try:
                        embeddings_result = get_openai_embeddings(
                            [doc.page_content for doc in child_docs_array],
                            embedding_model)
                        break
                    except Exception as ex:
                        logger.error(f"Content {row_content.id}: Attempt {attempt} for OpenAI embeddings failed with error: {ex}")
                        if attempt < max_retries:
                            sleep_time = random.uniform(min_sleep_time, max_sleep_time)
                            sleep(sleep_time)
                        else:
                            with session_scope(session_maker) as session:
                                update_crawler_document_state(crawler_document_id=row_content.crawler_documents_id, state=99, session=session)
                                update_crawler_content_state_by_id(crawler_content_id=row_content.id, state=99, session=session)
                            return
                if embeddings_result:
                    try:
                        collection.insert_embedding_data(
                            data=(InsertEmbeddingDocument(id=doc.metadata["node_id"],
                                                        embedding=embedding,
                                                        metadata=doc.metadata,
                                                        content=doc.page_content)
                                for doc, embedding in zip(child_docs_array, embeddings_result)))
                        
                        with session_scope(session_maker) as session:
                            update_crawler_content_state_by_id(crawler_content_id=row_content.id,
                                                        state=3, session=session)
                        logger.info(f"Successfully completed restore crawler content for content_id: {row_content.id}")
                    except Exception as ex:
                        logger.error(f"Error inserting embeddings or updating status for content {row_content.id}: {ex}")
                        with session_scope(session_maker) as session:
                            update_crawler_document_state(crawler_document_id=row_content.crawler_documents_id, state=99, session=session)
                            update_crawler_content_state_by_id(crawler_content_id=row_content.id, state=99, session=session)
            except Exception as ex:
                logger.error(f"Error on run_single_restore_crawler_content: {ex}")
                update_crawler_document_state(crawler_document_id=row_content.crawler_documents_id,state=99,session=session)
                update_crawler_content_state_by_id(crawler_content_id=row_content.id,
                                            state=99,session=session)

    except Exception as ex:
        logger.error(f"Critical error in run_single_restore_crawler_content for content {row_content.id}: {ex}")
        try:
            with session_scope(session_maker) as session:
                update_crawler_document_state(crawler_document_id=row_content.crawler_documents_id, state=99, session=session)
                update_crawler_content_state_by_id(crawler_content_id=row_content.id, state=99, session=session)
        except Exception as final_ex:
            logger.error(f"Failed to update error state for content {row_content.id} in final error handler: {final_ex}")

def split_child_doc_from_parent(
        parent_docs: list[langchain_Document],
        child_doc_splitter: TextSplitter,session,chunk_prefix: str= "") -> list[langchain_Document]:
    len_of_parent_docs = len(parent_docs)
    parent_next_val_list: list[int] = [
        get_parent_chunks_nextval(session=session) for _ in range(len_of_parent_docs)
    ]
    result_child_docs: list[langchain_Document] = []
    for i, doc in enumerate(parent_docs):
        doc.metadata["node_type"] = "parent"
        doc.metadata["node_id"] = parent_next_val_list[i]
        if i == 0:
            doc.metadata["prev_node"] = None
        else:
            doc.metadata["prev_node"] = parent_next_val_list[i - 1]

        if i == len_of_parent_docs - 1 or len_of_parent_docs == 1:
            doc.metadata["next_node"] = None
        else:
            doc.metadata["next_node"] = parent_next_val_list[i + 1]
        insert_parent_chunk(node_id=parent_next_val_list[i],
                                page_content=doc.page_content,
                                metadata=doc.metadata,session=session)
        child_docs_array_split: list[
            langchain_Document] = child_doc_splitter.split_documents([doc])
        len_of_child_doc: int = len(child_docs_array_split)
        child_uuid_list: list[str] = [
            str(uuid4()) for _ in range(len_of_child_doc)
        ]
        for j, child_doc in enumerate(child_docs_array_split):
            if chunk_prefix:
                child_doc.page_content = f"{chunk_prefix} {child_doc.page_content}"
            if child_doc.metadata["datasource_type"] == "A":
                child_doc.page_content = f"{child_doc.metadata['originalname']} {child_doc.page_content}"
            elif child_doc.metadata["datasource_type"] == "B":
                child_doc.page_content = f"{child_doc.metadata['datasource_name']} {child_doc.page_content}"
            child_doc.metadata["node_type"] = "child"
            child_doc.metadata["parent_node"] = parent_next_val_list[i]
            child_doc.metadata["node_id"] = child_uuid_list[j]
            if j == 0:
                child_doc.metadata["prev_node"] = None
            else:
                child_doc.metadata["prev_node"] = child_uuid_list[j - 1]
            if j == len_of_child_doc - 1 or len_of_child_doc == 1:
                child_doc.metadata["next_node"] = None
            else:
                child_doc.metadata["next_node"] = child_uuid_list[j + 1]

        result_child_docs.extend(child_docs_array_split)
    return result_child_docs

def contact_extra_to_crawler_document(dataset_id:str,crawler_document_id: str,session_maker: scoped_session) -> None:
    with session_scope(session_maker) as session:
        row_dataset: Dataset_Schema | None = select_datasets_from_id(
                                datasets_id=dataset_id,
                                session=session)
        assert row_dataset, f"contact_extra_to_crawler_document error, dataset_id: {dataset_id}"
        rows_extra: Sequence[CrawlerDocumentsExtra_Schema] = select_crawler_documents_extra_from_crawler_document_id(crawler_document_id=crawler_document_id,session=session)
        embedding_model = row_dataset.config_jsonb.get("embedding_model") or "text-embedding-3-large"
        embedding_model_id = int(row_dataset.config_jsonb.get("embedding_model_id", 85))
        collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
            collection_name=row_dataset.folder_name,
            collection_class=BaseEmbeddingItem,
            embedding_model=embedding_model
        )
        try:
            search_result: Iterator[SearchMetadataDocument] = collection.search_by_metadata(
                metadata_query={
                    "crawler_documents_id": crawler_document_id
                })
            search_result_list: list[SearchMetadataDocument] = list(search_result)
            target_chunk: SearchMetadataDocument = search_result_list[0]
            new_metadata = target_chunk.metadata.copy()
            metadata_bind_extra_ids = []
            extra_contents: list[str] = []
            for row in rows_extra:
                if row.is_included_in_large_chunk:
                    if row.id not in metadata_bind_extra_ids:
                        metadata_bind_extra_ids.append(row.id)
                extra_contents.append(row.extra_text)
            new_metadata["crawler_documents_extra_ids"] = metadata_bind_extra_ids
            origin_parent_node = new_metadata.get("parent_node")
            assert origin_parent_node, f"contact_extra_to_crawler_document error, origin_parent_node: {origin_parent_node}"
            row_parent_chunk: ParentChunks_Schema | None = select_parent_chunk_from_id(node_id=origin_parent_node,session=session)
            assert row_parent_chunk, f"contact_extra_to_crawler_document error, row_parent_chunk: {row_parent_chunk}"
            new_metadata["parent_node"] = row_parent_chunk.id
            parent_chunk_size, parent_chunk_overlap_size, child_chunk_size, child_chunk_overlap_size = get_chunk_sizes(
            row_dataset.config_jsonb)
            child_node_text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=child_chunk_size, chunk_overlap=child_chunk_overlap_size
            )
            parent_content: str = row_parent_chunk.page_content
            parent_metadata = row_parent_chunk.meta_data.copy()
            parent_metadata["crawler_documents_extra_ids"] = metadata_bind_extra_ids
            update_parent_chunk_metadata(node_id=row_parent_chunk.id,metadata=parent_metadata,session=session)
            child_docs_array_split: list[
            langchain_Document] = child_node_text_splitter.split_documents([langchain_Document(
                        page_content=parent_content,
                        metadata=parent_metadata)])
            len_of_child_doc: int = len(child_docs_array_split)
            child_uuid_list: list[str] = [
                str(uuid4()) for _ in range(len_of_child_doc)
            ]
            for j, child_doc in enumerate(child_docs_array_split):
                child_doc.metadata = new_metadata.copy()
                if j == 0:
                    child_doc.metadata["prev_node"] = None
                    child_doc.page_content = f"\n{"\n".join(extra_contents)}\n{child_doc.page_content}"
                else:
                    child_doc.metadata["prev_node"] = child_uuid_list[j - 1]
                if child_doc.metadata["datasource_type"] == "A":
                    child_doc.page_content = f"{child_doc.metadata['originalname']} {child_doc.page_content}"
                elif child_doc.metadata["datasource_type"] == "B":
                    child_doc.page_content = f"{child_doc.metadata['datasource_name']} {child_doc.page_content}"
                child_doc.metadata["node_id"] = child_uuid_list[j]
                if j == len_of_child_doc - 1 or len_of_child_doc == 1:
                    child_doc.metadata["next_node"] = None
                else:
                    child_doc.metadata["next_node"] = child_uuid_list[j + 1]
            try:
                log_token_embedding(embedding_model_id, embedding_model, row_dataset.id,
                                    child_docs_array_split, "child",session)
            except Exception as ex:
                logger.error(f"Error token_from_embedding: {ex}")
                update_crawler_document_state(crawler_document_id=crawler_document_id,state=99,session=session)
                return
            max_retries = 10
            min_sleep_time = 30
            max_sleep_time = 60
            for attempt in range(1, max_retries + 1):
                try:
                    embeddings: Iterator[list[float]] = get_openai_embeddings(
                        [doc.page_content for doc in child_docs_array_split],
                        embedding_model)
                    break
                except Exception as ex:
                    logger.error(f"Attempt {attempt} failed with error: {ex}")
                    if attempt < max_retries:
                        sleep_time = random.uniform(min_sleep_time, max_sleep_time)
                        sleep(sleep_time)
                    else:
                        update_crawler_document_state(crawler_document_id=crawler_document_id,state=99,session=session)
                        return

            collection.insert_embedding_data(
                data=(InsertEmbeddingDocument(id=doc.metadata["node_id"],
                                            embedding=embedding,
                                            metadata=doc.metadata,
                                            content=doc.page_content)
                    for doc, embedding in zip(child_docs_array_split, embeddings)))
            collection.delete_embedding_by_ids(ids=[doc.id for doc in search_result_list])
            update_crawler_document_state(
                crawler_document_id=crawler_document_id, state=3,session=session)
            update_crawler_content_state_by_doc_id(crawler_documents_id=crawler_document_id,state=3,session=session)
        except Exception as ex:
            logger.error(f"Error on contact_extra_to_crawler_document: {ex}")
            update_crawler_document_state(
                    crawler_document_id=crawler_document_id, state=99,session=session)
            return
        
def get_chunk_sizes(
        datasets_config: dict[str, Any]) -> tuple[int, int, int, int]:
    parent_chunk_size: int = datasets_config.get("parent_chunk_size") or 700
    parent_chunk_overlap_size: int = datasets_config.get(
        "parent_chunk_overlap") or parent_chunk_size // 10
    child_chunk_size: int = datasets_config.get(
        "child_chunk_size") or parent_chunk_size // 5
    child_chunk_overlap_size: int = datasets_config.get(
        "child_chunk_overlap") or 0
    return parent_chunk_size, parent_chunk_overlap_size, child_chunk_size, child_chunk_overlap_size


def log_token_embedding(embedding_model_id: int, model_name: str,  datasets_id: str,
                        docs_array_split: list[langchain_Document],
                        node_type: str,session) -> None:
    context = " ".join(doc.page_content for doc in docs_array_split)
    entry = EmbeddingTokenLogEntry(model_id=embedding_model_id,
                                   model=model_name,
                                   datasets_id=datasets_id)
    logger.debug(f"{node_type} entry {entry}")
    logger.debug(f"{node_type} context {context}")
    LoggerUtils.token_from_embedding(context, entry,session)


def disable_crawler_attachment_content(dataset_id:str,crawler_attachment_ids:list[str],session_maker:scoped_session):
    """
        特定爬蟲附件的禁用
    """
    try:
        with session_scope(session_maker) as session:
            row_dataset: Dataset_Schema | None = select_datasets_from_id(
                    datasets_id=dataset_id,session=session)
            assert row_dataset, f"datasets_id: {dataset_id}"
            embedding_model = row_dataset.config_jsonb.get(
                "embedding_model") or "text-embedding-3-large"
            collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                collection_name=row_dataset.folder_name,
                collection_class=BaseEmbeddingItem,
                embedding_model=embedding_model)
        
            for crawler_attachment_id in crawler_attachment_ids:
                row_crawler_attachment: CrawlerAttachment_Schema | None = select_crawler_attachment_by_id(
                    crawler_attachment_id=crawler_attachment_id,session=session)
                assert row_crawler_attachment, f"crawler_attachment_id: {crawler_attachment_id}"
                collection.delete_embedding_by_metadata(
                    metadata_query={
                        "crawler_attachment_id": crawler_attachment_id
                    })
                update_crawler_attachment_state_by_id(crawler_attachment_id=crawler_attachment_id,state=4,session=session)

    except Exception as ex:
        logger.error(f"Error on disable_crawler_attachment_content: {ex}")

def disable_crawler_attachment(dataset_id:str,crawler_attachment_synchronize_ids:list[int],session_maker:scoped_session):
    """
        特定爬蟲附件的禁用
    """
    try:
        with session_scope(session_maker) as session:
            row_dataset: Dataset_Schema | None = select_datasets_from_id(
                    datasets_id=dataset_id,session=session)
            assert row_dataset, f"datasets_id: {dataset_id}"
            embedding_model = row_dataset.config_jsonb.get(
                "embedding_model") or "text-embedding-3-large"
            collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                collection_name=row_dataset.folder_name,
                collection_class=BaseEmbeddingItem,
                embedding_model=embedding_model)
            for crawler_attachment_synchronize_id in crawler_attachment_synchronize_ids:
                row_crawler_attachment_synchronize: CrawlerAttachmentSynchronize_Schema | None = select_crawler_attachment_synchronize_by_id(
                    crawler_attachment_synchronize_id=crawler_attachment_synchronize_id,session=session)
                assert row_crawler_attachment_synchronize, f"crawler_attachment_synchronize_id: {crawler_attachment_synchronize_id}"
                collection.delete_embedding_by_metadata(
                    metadata_query={
                        "crawler_attachment_synchronize_id": crawler_attachment_synchronize_id
                    })
                update_crawler_attachment_synchronize_state_by_id(crawler_attachment_synchronize_id=crawler_attachment_synchronize_id,state=4,session=session)
    except Exception as ex:
        logger.error(f"Error on disable_crawler_attachment: {ex}")
            

def disable_crawler_content(dataset_id: str,
                            crawler_document_content_ids: list[str],session_maker:scoped_session):
    """
        特定爬蟲文件的禁用
    """
    try:
        with session_scope(session_maker) as session:
            row_dataset: Dataset_Schema | None = select_datasets_from_id(
                datasets_id=dataset_id,session=session)
            assert row_dataset, f"datasets_id: {dataset_id}"
            embedding_model = row_dataset.config_jsonb.get(
                "embedding_model") or "text-embedding-3-large"
            collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                collection_name=row_dataset.folder_name,
                collection_class=BaseEmbeddingItem,
                embedding_model=embedding_model)
            for crawler_content_id in crawler_document_content_ids:
                _raw = select_crawler_document_content_by_id(
                    crawler_document_id=crawler_content_id,session=session)
                if _raw is not None:
                    try:
                        collection.delete_embedding_by_metadata(
                            metadata_query={
                                "crawler_documents_content_id": crawler_content_id
                            })
                        assert _raw, f"crawler_document_id: {crawler_content_id}"
                        update_crawler_document_state(
                            crawler_document_id=_raw.crawler_documents_id, state=4,session=session)
                    except Exception as ex:
                        logger.error(f"Error on disable_crawler_content: {ex}")
                        update_crawler_document_state(
                            crawler_document_id=_raw.crawler_documents_id,
                            state=99,session=session)
    except Exception as ex:
        logger.error(f"Error on disable_crawler_content: {ex}")

def remove_crawler_attachment(dataset_id:str,crawler_attachment_ids:list[str],session_maker:scoped_session):
    """
        移除爬蟲附件
    """
    try:
        with session_scope(session_maker) as session:
            raw_dataset: Dataset_Schema | None = select_datasets_from_id(
                datasets_id=dataset_id,session=session)
            assert raw_dataset, f"datasets_id: {dataset_id}"
            collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                collection_name=raw_dataset.folder_name,
                collection_class=BaseEmbeddingItem,
                embedding_model=raw_dataset.config_jsonb.get("embedding_model") or "text-embedding-3-large")
            for crawler_attachment_id in crawler_attachment_ids:
                try:
                    update_crawler_attachment_state_by_id(
                        crawler_attachment_id=crawler_attachment_id, state=6,session=session)
                    collection.delete_embedding_by_metadata(metadata_query={
                        "crawler_attachment_id": crawler_attachment_id  
                    })
                except Exception as ex:
                    logger.error(f"Error on remove_crawler_attachment: {ex}")
    except Exception as ex:
        logger.error(f"Error on remove_crawler_attachment: {ex}")

def remove_crawler_document_content(
        dataset_id: str, crawler_document_content_ids: list[str],session_maker:scoped_session) -> None:
    """
        移除爬蟲文件
    """
    try:
        with session_scope(session_maker) as session:
            raw_dataset: Dataset_Schema | None = select_datasets_from_id(
                datasets_id=dataset_id,session=session)
            assert raw_dataset, f"datasets_id: {dataset_id}"
            collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                collection_name=raw_dataset.folder_name,
                collection_class=BaseEmbeddingItem,
                embedding_model=raw_dataset.config_jsonb.get("embedding_model")
                or "text-embedding-3-large")
            for crawler_document_content_id in crawler_document_content_ids:
                try:
                    update_crawler_content_state_by_doc_id(
                        crawler_documents_id=crawler_document_content_id, state=6,session=session)
                    collection.delete_embedding_by_metadata(metadata_query={
                        "crawler_documents_content_id":
                        crawler_document_content_id
                    })
                except Exception as ex:
                    logger.error(f"Error on remove_crawler_document_content: {ex}")
    except Exception as ex:
        logger.error(f"Error on remove_crawler_document_content: {ex}")


def remove_crawle_document(dataset_id: str,
                           crawler_document_ids: list[str],session_maker:scoped_session) -> None:
    """
        移除爬蟲文件
    """
    try:
        with session_scope(session_maker) as session:
            raw_dataset: Dataset_Schema | None = select_datasets_from_id(
                datasets_id=dataset_id,session=session)
            assert raw_dataset, f"datasets_id: {dataset_id}"
            collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                collection_name=raw_dataset.folder_name,
                collection_class=BaseEmbeddingItem,
                embedding_model=raw_dataset.config_jsonb.get("embedding_model")
                or "text-embedding-3-large")
            for crawler_document_id in crawler_document_ids:
                try:
                    update_crawler_document_state(
                        crawler_document_id=crawler_document_id, state=6,session=session)
                    collection.delete_embedding_by_metadata(
                        metadata_query={
                            "crawler_documents_id": crawler_document_id
                        })
                except Exception as ex:
                    logger.error(f"Error on remove_crawle_document: {ex}")
    except Exception as ex:
        logger.error(f"Error on remove_crawle_document: {ex}")


def disable_crawler_indexing(crawler_sync_ids: list[int],session_maker:scoped_session) -> None:
    """
        整個爬蟲的禁用
    """
    with session_scope(session_maker) as session:
        row_dataset: Dataset_Schema | None = select_dataset_from_sync_id(
            crawler_synchronize_id=crawler_sync_ids[0],session=session
        )  # 這邊拿 [0] 是因為這一整批應該都要是來自於同一個 dataset 的 crawler_sync_id
        assert row_dataset, f"crawler_sync_id: {crawler_sync_ids[0]}"
        embedding_model = row_dataset.config_jsonb.get(
            "embedding_model") or "text-embedding-3-large"
        collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
            collection_name=row_dataset.folder_name,
            collection_class=BaseEmbeddingItem,
            embedding_model=embedding_model)
        try:
            for cs_id in crawler_sync_ids:
                collection.delete_embedding_by_metadata(
                    metadata_query={"crawler_synchronize_id": cs_id})
                update_crawler_synchronize_state(crawler_synchronize_id=cs_id,
                                                state=4,session=session)
                for doc in select_crawler_documents_by_sync_id(
                        crawler_synchronize_id=cs_id,session=session):
                    update_crawler_document_state(crawler_document_id=doc.id,
                                                state=4,session=session)
                    for content in select_crawler_contents_by_doc_id(
                            crawler_document_id=doc.id,session=session):
                        update_crawler_content_state_by_id(crawler_content_id=content.id,
                                                    state=4,session=session)
        except Exception as ex:
            logger.error(f"Error on disable_crawler_indexing: {ex}")

def cancel_crawler_attachment_indexing(crawler_attachment_sync_ids: list[int],session_maker:scoped_session) -> None:
    """
        爬蟲附件的取消加入
    """
    with session_scope(session_maker) as session:
        row_dataset: Dataset_Schema | None = select_dataset_from_attachment_sync_id(
            crawler_attachment_synchronize_id=crawler_attachment_sync_ids[0],session=session
        )  # 這邊拿 [0] 是因為這一整批應該都要是來自於同一個 dataset 的 crawler_sync_id
        assert row_dataset, f"crawler_sync_id: {crawler_attachment_sync_ids[0]}"
        embedding_model = row_dataset.config_jsonb.get(
            "embedding_model") or "text-embedding-3-large"
        collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
            collection_name=row_dataset.folder_name,
            collection_class=BaseEmbeddingItem,
            embedding_model=embedding_model)
        try:
            for cs_id in crawler_attachment_sync_ids:
                collection.delete_embedding_by_metadata(
                    metadata_query={"crawler_attachment_synchronize_id": cs_id})
                update_crawler_attachment_synchronize_state_by_id(crawler_attachment_synchronize_id=cs_id,
                                                state=9,session=session)
                for attachment in select_crawler_attachment_by_sync_id(
                        crawler_attachment_synchronize_id=cs_id,session=session):
                    update_crawler_attachment_state_by_id(crawler_attachment_id=attachment.id,
                                                state=9,session=session)
        except Exception as ex:
            logger.error(f"Error on cancel_crawler_attachment_indexing: {ex}")

def cancel_crawler_indexing(crawler_sync_ids: list[int],session_maker:scoped_session) -> None:
    """
        爬蟲的取消加入
    """
    with session_scope(session_maker) as session:
        row_dataset: Dataset_Schema | None = select_dataset_from_sync_id(
            crawler_synchronize_id=crawler_sync_ids[0],session=session
        )  # 這邊拿 [0] 是因為這一整批應該都要是來自於同一個 dataset 的 crawler_sync_id
        assert row_dataset, f"crawler_sync_id: {crawler_sync_ids[0]}"
        embedding_model = row_dataset.config_jsonb.get(
            "embedding_model") or "text-embedding-3-large"
        collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
            collection_name=row_dataset.folder_name,
            collection_class=BaseEmbeddingItem,
            embedding_model=embedding_model)
        try:
            for cs_id in crawler_sync_ids:
                collection.delete_embedding_by_metadata(
                    metadata_query={"crawler_synchronize_id": cs_id})
                update_crawler_synchronize_state(crawler_synchronize_id=cs_id,
                                                state=9,session=session)
                for doc in select_crawler_documents_by_sync_id(
                        crawler_synchronize_id=cs_id,session=session):
                    update_crawler_document_state(crawler_document_id=doc.id,
                                                state=9,session=session)
                    for content in select_crawler_contents_by_doc_id(
                            crawler_document_id=doc.id,session=session):
                        update_crawler_content_state_by_id(crawler_content_id=content.id,
                                                    state=9,session=session)
        except Exception as ex:
            logger.error(f"Error on disable_crawler_indexing: {ex}")



def renew_lock(redis_client: Redis, lock_key: str, expire_time: int,
               stop_event: threading.Event) -> None:
    """定期續租鎖"""
    while not stop_event.is_set():
        sleep(expire_time / 2)
        redis_client.expire(lock_key, expire_time)
