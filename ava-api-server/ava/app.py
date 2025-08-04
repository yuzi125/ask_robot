import asyncio
import base64
import glob
import hashlib
import importlib
import json
import logging.config
import logging.handlers
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import uuid
from collections import defaultdict
from copy import copy
from datetime import datetime
from itertools import islice
from multiprocessing import Queue
from os import getenv
from pathlib import Path
from sys import exit
from time import sleep
from typing import Any, Generator, Iterator, Sequence
from urllib.parse import urljoin, urlparse

import aiopg
import numpy as np
import psycopg2
import requests
from ava.clients.sql.crud import (append_bot_message_chat,
                                  get_history_message_nextval,
                                  get_translation_task,
                                  get_user_translation_tasks,
                                  insert_cache_history, insert_history_message,
                                  insert_history_message_type,
                                  insert_translation_task,
                                  select_crawler_by_id,
                                  select_crawler_documents_extra_from_id,
                                  select_datasets_from_id,
                                  select_expert_from_id,
                                  select_image_from_uuid,
                                  select_model_list_from_id,
                                  select_parent_chunk_from_id,
                                  select_parent_chunks_from_ids,
                                  select_settings_from_key,
                                  select_user_completion_history,
                                  selet_all_enable_experts,
                                  update_translation_task_status,
                                  select_image_from_uuid)
from ava.clients.sql.database import (create_db_engine, create_session_maker,
                                      scoped_session, session_scope)
from ava.clients.sql.schema import (BotMessage_Schema, Crawler_Schema,
                                    Dataset_Schema, DocumentImageStore_Schema,
                                    Expert_Schema, ModelList_Schema,
                                    ParentChunks_Schema, Settings_Schema,
                                    TranslationTasks_Schema, DocumentImageStore_Schema)
from ava.config import TestConfig, get_search_kwargs_or_default
from ava.exceptions.AvaError import MyException, SemanticException
from ava.handlers.AvaHandler import AvaHandler, LoginTypeNotSatisfiedException
from ava.handlers.CSCERPWebApiRunner import CSCERPWebApiRunner
from ava.handlers.DragonERPWebApiRunner import DragonERPWebApiRunner
from ava.handlers.FileTranslationRunner import FileTranslationRunner
from ava.handlers.HandlerProcessor import HandlerProcessor
from ava.handlers.Knowledge import KnowledgeHandler
from ava.handlers.skills.CommonConfig import MappingNotFoundException
from ava.handlers.ThemeColorGenerator import ThemeColorGenerator
from ava.model.dscom import User
from ava.model.knowledge import DataSet, get_datasets
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from ava.tools.file_upload import upload_files
from ava.tools.form_binding import bind_form_doc, delete_form, unbind_form_doc
from ava.tools.indexing import (cancel_crawler_attachment_indexing,
                                cancel_crawler_indexing,
                                contact_extra_to_crawler_document,
                                delete_expert_cache, delete_knowledge_indexing,
                                disable_crawler_attachment,
                                disable_crawler_attachment_content,
                                disable_crawler_content,
                                disable_crawler_indexing,
                                form_binding_indexing, remove_crawle_document,
                                remove_crawler_attachment,
                                remove_crawler_document_content)
from ava.utils import config_utils, env_utils, feedback_utils, intent_utils
from ava.utils.AzureOpenAIHandler import (AzureDocumentsAgent,
                                          run_azure_openai_model_stream,
                                          run_azure_upload_files_not_stream)
from ava.utils.background import BackgroundProcess
from ava.utils.ClaudeHandler import ClaudeHandler
from ava.utils.GeminiDocumentsAgent import GeminiDocumentsAgent
from ava.utils.GeminiHandler import GeminiHandler
from ava.utils.GPTHandler import GPTHandler
from ava.utils.logger_config import (get_log_files_name, read_log_file,
                                     setup_logging)
from ava.utils.model_utils import get_model_and_params
from ava.utils.OpenRouterHandler import OpenRouterHandler
from ava.utils.prometheus import *
from ava.utils.redis_utils import (get_redis_client_with_retry,
                                   register_redis_handler_channel)
from ava.utils.return_message_style import error_msg, info_msg, success_msg
from ava.utils.translation_status import TranslationStatus
from ava.utils.TunnelFormAgent import TunnelFormAgent
from ava.utils.TunnelSkillAgent import TunnelSkillAgent
from ava.utils.TwccFFmHandler import run_ffm_model_stream
from ava.utils.utils import LoggerUtils
from ava.utils.vector import (CollectionLimit, EmbeddingDocument,
                              SearchMetadataDocument, VectorDatabase,
                              VectorDatabaseFactory, get_openai_embeddings)
from ava.utils.vector.base import SearchContentDocument
from ava.utils.vector.cache import RedisEmbeddingCache
from ava.utils.vector.postgres.sql import BaseEmbeddingItem
from ava.utils.vector.postgres.sql.database import \
    create_session_maker as create_vector_session_maker
from ava.utils.vector.postgres.sql.database import create_vector_db_engine
from flask import (Flask, Response, copy_current_request_context, g, jsonify,
                   render_template, request, session)
from flask_cors import CORS
from flask_session import Session
from openai import AzureOpenAI, OpenAI
from prometheus_flask_exporter import PrometheusMetrics
from redis import Redis, StrictRedis
from sqlalchemy import text


def get_user(current_user:Any) -> tuple[Any,str]: 
    try:
        API_SUCCESS_COUNTER.inc()  # 計算成功的 API 呼叫次數
        if isinstance(current_user, str):
            json_obj = json.loads(current_user)
            del json_obj["cookie"]
            user: User = User(json_obj["userInfo"])
            return user,""
        elif isinstance(current_user, bytes):
            json_obj = json.loads(current_user.decode())
            del json_obj["cookie"]
            user: User = User(json_obj["userInfo"])
            return user,""
        else:
            user = current_user
            return user,""
    except Exception as ex:
        API_ERROR_COUNTER.inc()  # 錯誤計數
        logger.error(f"api user_info error: {ex}")
        return None,str(ex)

REDIS_CHANNEL_NAME ="HANDLER_REFRESH"

# Create logger for the main application
env = env_utils.get_key("ENVIRONMENT")  # dev, test, prod
assert env in ["dev", "test", "prod","khh"], f"ENVIRONMENT[{env}] must be dev/test/prod/khh."

setup_logging(env)
VectorDatabaseFactory.initialize()
logger = logging.getLogger("ava_app")
whisper_logger = logging.getLogger("whisper")
handleProcessor:HandlerProcessor

session_maker: scoped_session
vector_session_maker: scoped_session
is_executor_shutdown = False

background_processes:list[BackgroundProcess]= []
class NoMetricsFilter(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        # 檢查記錄訊息是否包含 "GET /metrics" 或 "GET /health"
        return not (('GET /metrics' in message) or ('GET /health' in message))

# 設置過濾器到 Werkzeug 的日誌記錄器
logging.getLogger('werkzeug').addFilter(NoMetricsFilter())
class AvaApp(Flask):
    handleProcessor: HandlerProcessor
    metrics: PrometheusMetrics
    pass

def signal_handler(sig, frame):
    logger.info(f'api-server receiver signal: {sig}')

    for process in background_processes:
        process.stop() 
    logging.shutdown()
    exit(0)

def monitor_processes():
    while True:
        for process in background_processes:
            try:
                if process.process and process.process.poll() is not None:
                    logger.warning(f"{process.process_name} process died unexpectedly, restarting...")
                    process.start()
            except Exception as ex:
                logger.error(f"Error monitoring {process.process_name} process: {ex}")
        time.sleep(30) 

def cleanup_prometheus_multiproc_dir():
    is_windows = os.name == 'nt'
    if is_windows:
        prometheus_multiproc_dir = os.getenv("PROMETHEUS_MULTIPROC_DIR", "C:\\tmp\\prometheus_multiproc")
    else:
        prometheus_multiproc_dir = os.getenv("PROMETHEUS_MULTIPROC_DIR", "/tmp/prometheus_multiproc")
    files = glob.glob(os.path.join(prometheus_multiproc_dir, '*'))
    for f in files:
        os.remove(f)
        
def create_app(test_config=None) -> Flask:
    global session_maker,vector_session_maker,handleProcessor
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    test_config = test_config or TestConfig()

    session_maker = create_session_maker(
        create_db_engine(
            test_config.DATABASE_POOL_SIZE,
            test_config.DATABASE_MAX_OVERFLOW
        )
    )
    vector_session_maker = create_vector_session_maker(
        create_vector_db_engine(
            pool_size=test_config.VECTOR_DATABASE_POOL_SIZE, 
            max_overflow=test_config.VECTOR_DATABASE_MAX_OVERFLOW
        )
    )
    with session_scope(session_maker) as session:
        while True:
            logger.info("waiting for db ready")
            try:
                row: Settings_Schema | None = select_settings_from_key(key="is_db_ready",session=session)
                assert row
                if str(row.value) == "1":
                    break
            except Exception as ex:
                logger.error(ex)
            sleep(3)
    db_connection_string = getenv("POSTGRES_VECTOR_DATABASE_URL")
    assert db_connection_string, "No POSTGRES_VECTOR_DATABASE_URL found in env"

    app = AvaApp(__name__)
    app.config.from_object(test_config)
    PrometheusMetrics(app)
    app.config["LOG_LEVEL"] = "DEBUG"
    if not os.path.exists("./log"):
        os.makedirs("./log")

    # 暫時先這樣寫死建立3072的vector table，之後再說
    with psycopg2.connect(db_connection_string) as conn:
        with conn.cursor() as cur:
            create_table_query = """
                CREATE TABLE IF NOT EXISTS public.chunk_openai_3072_vectors (
                        embedding public.halfvec(3072) null,
                        id varchar(50) NOT NULL,
                        collection_name varchar(50) NOT NULL,
                        "content" varchar NOT NULL,
                        meta_data jsonb NOT NULL,
                        text_search_zh tsvector NULL,
                        text_search_en tsvector NULL,
                        create_time timestamptz NOT NULL DEFAULT now(),
                        update_time timestamptz NOT NULL DEFAULT now(),
                        CONSTRAINT chunk_openai_3072_vectors_pkey PRIMARY KEY (id, collection_name)
                );
            """
            create_index_query = """
                CREATE INDEX IF NOT EXISTS chunk_openai_3072_vectors_collection_name_idx 
                    ON public.chunk_openai_3072_vectors USING btree (collection_name);
                CREATE INDEX IF NOT EXISTS chunk_openai_3072_vectors_embedding_hnsw_idx 
                    ON public.chunk_openai_3072_vectors USING hnsw (embedding halfvec_cosine_ops) WITH (m='32', ef_construction='100');
                CREATE INDEX IF NOT EXISTS chunk_openai_3072_vectors_text_search_zh_idx
                    ON public.chunk_openai_3072_vectors USING gin (text_search_zh);
                CREATE INDEX IF NOT EXISTS chunk_openai_3072_vectors_text_search_en_idx
                    ON public.chunk_openai_3072_vectors USING gin (text_search_en);
            """
            cur.execute(create_table_query)
            cur.execute(create_index_query)
            
            max_retries = 10
            retry_count = 0
            while retry_count < max_retries:
                try:
                    # 嘗試獲取表的排他鎖以避免併發衝突
                    cur.execute("LOCK TABLE pg_trigger IN EXCLUSIVE MODE;")
                    
                    cur.execute("""
                    CREATE OR REPLACE FUNCTION update_text_search_fields() RETURNS trigger AS $$
                    BEGIN
                      NEW.text_search_zh := to_tsvector('jiebacfg', NEW.content);
                      NEW.text_search_en := to_tsvector('english', NEW.content);
                      RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;
                    """)

                    cur.execute("""
                        DO $$
                        BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_text_search'
                        ) THEN
                            CREATE TRIGGER trg_update_text_search
                            BEFORE INSERT OR UPDATE ON chunk_openai_3072_vectors
                            FOR EACH ROW
                            EXECUTE FUNCTION update_text_search_fields();
                        END IF;
                        END
                        $$;
                    """)
                    conn.commit()
                    break  # 操作成功，跳出循環
                except psycopg2.errors.InternalError as e:
                    # 捕獲併發更新錯誤
                    if "tuple concurrently updated" in str(e) and retry_count < max_retries - 1:
                        logger.warning(f"併發更新衝突，正在重試 ({retry_count+1}/{max_retries})...")
                        conn.rollback()  # 回滾當前事務
                        retry_count += 1
                        sleep(1.0 + (retry_count * 0.5))  # 使用遞增延遲避免再次衝突
                    else:
                        logger.error(f"在建立觸發器時出現無法恢復的錯誤: {e}")
                        raise  # 重新拋出錯誤
    handleProcessor = HandlerProcessor(session_maker)
    threading.Thread(
        target=register_redis_handler_channel,
        args=(handleProcessor.refresh_handlers, REDIS_CHANNEL_NAME),
        daemon=True).start()
    logger.info("CREATE_APP in Flask")

    # cleanup_prometheus_multiproc_dir()

    # if os.name == 'nt':
    #     prometheus_multiproc_dir = os.getenv("PROMETHEUS_MULTIPROC_DIR", "C:\\tmp\\prometheus_multiproc")
    # else:
    #     prometheus_multiproc_dir = os.getenv("PROMETHEUS_MULTIPROC_DIR", "/tmp/prometheus_multiproc") 
    # os.makedirs(prometheus_multiproc_dir, exist_ok=True)
    # os.environ["PROMETHEUS_MULTIPROC_DIR"] = prometheus_multiproc_dir

    # multiprocess.MultiProcessCollector(metrics_registry)
    app.handleProcessor = handleProcessor
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
    app.config["SESSION_REDIS"] = StrictRedis(
        host=app.config["REDIS_HOST"], port=app.config["REDIS_PORT"], db=0,password=app.config["REDIS_PASSWORD"])
    app.secret_key = env_utils.get_flask_secret_key()
    Session(app)
    
    knowledge_indexing_process_num = os.getenv("KNOWLEDGE_INDEXING_PROCESS_NUM", 1)
    for i in range(int(knowledge_indexing_process_num)):
        process = BackgroundProcess(
            str(Path(__file__).parent.parent / "ava" / "subprocess" / "background_knowledge_indexing.py"),
            f"knowledge_indexing_{i}"
        )
        process.start()
        background_processes.append(process)

    # 啟動爬蟲 indexing background process
    crawler_indexing_process_num = os.getenv("CRAWLER_INDEXING_PROCESS_NUM", 1)
    for i in range(int(crawler_indexing_process_num)):
        process = BackgroundProcess(
            str(Path(__file__).parent.parent / "ava" / "subprocess" / "background_crawler_indexing.py"),
            f"crawler_indexing_{i}"
        )
        process.start()
        background_processes.append(process)
    
    # 啟動 crawler attachment indexing background process
    crawler_attachment_indexing_process_num = os.getenv("CRAWLER_ATTACHMENT_INDEXING_PROCESS_NUM", 1)
    for i in range(int(crawler_attachment_indexing_process_num)):
        process = BackgroundProcess(
            str(Path(__file__).parent.parent / "ava" / "subprocess" / "background_crawler_attachment_indexing.py"),
            f"crawler_attachment_indexing_{i}"
        )
        process.start()
        background_processes.append(process)
        
    # 啟動 requeue 與 update crawler sync status background process
    requeue_update_status_process_num = os.getenv("REQUEUE_UPDATE_STATUS_PROCESS_NUM", 1)
    for i in range(int(requeue_update_status_process_num)):
        process = BackgroundProcess(
            str(Path(__file__).parent.parent / "ava" / "subprocess" / "requeue_task_and_update_status.py"),
            f"requeue_update_status_{i}"
        )
        process.start()
        background_processes.append(process)

    threading.Thread(target=monitor_processes, daemon=True).start()
    return app

def append_assistant_message(messages, msg):
    messages.append({"role": "assistant", "content": msg})
    return messages

def reset_messages(messages):
    messages.clear()

def append_user_message(messages, msg):
    messages.append({"role": "user", "content": msg})
    return messages

def complete_chunk(
    chat_uuid,
    llm_model_params,
    expert_data,
    user,
    messages,
    user_input,
    history_message_id,
    llm_model_list_id:int,
    llm_model_vendor:str,
    llm_model="gpt-4o"
):
    with session_scope(session_maker) as session:
        if llm_model_vendor == "anthropic":
            handler = ClaudeHandler()
            system_prompt = messages[0]["content"]
            if isinstance(messages[-1]["content"], list):
                for i in range(1,len(messages[-1]["content"])):
                    data = messages[-1]["content"][i]["image_url"]["url"]
                    base64_data = data.split(",")[1]
                    media_type = data.split(";")[0].split(":")[1]
                    messages[-1]["content"][i] = {
                        "type":"image",
                         "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64_data,
                        },
                    }
                message = messages[-1]["content"]
            else:
                message = messages[-1]["content"]
            response = handler.run_model_stream(session=session,model_list_id= llm_model_list_id,chat_uuid=chat_uuid,user=user,user_input=user_input,expert_data=expert_data,message_content=message,system_prompt=system_prompt,model_params=llm_model_params,model=llm_model,history_message_id=history_message_id)
            
        elif llm_model_vendor == "openai":
            GPT = GPTHandler(api_key=env_utils.get_openai_key())
            response = GPT.run_gptModel_stream(
                session,
                chat_uuid,
                user,
                messages=messages,
                user_input=user_input,
                model=llm_model,
                expert_data=expert_data,
                model_list_id = llm_model_list_id,
                params=llm_model_params,
                history_message_id=history_message_id
            )
        elif llm_model_vendor == "azure" or llm_model_vendor == "caf-azure":
            system_prompt = messages[0]["content"]
            message = messages[-1]["content"]
            response = run_azure_openai_model_stream(session=session,model_list_id= llm_model_list_id,chat_uuid=chat_uuid,user=user,user_input=user_input,expert_data=expert_data
                                                    ,model_key=llm_model,system_prompt=system_prompt,user_prompts=[message],model_params=llm_model_params,history_message_id=history_message_id)
        elif llm_model_vendor == "twcc":
            system_prompt = messages[0]["content"]
            message = messages[-1]["content"]
            response = run_ffm_model_stream(session=session,model_list_id= llm_model_list_id,chat_uuid=chat_uuid,user=user,user_input=user_input,expert_data=expert_data
                                                    ,model_key=llm_model,system_prompt=system_prompt,user_prompts=[message],model_params=llm_model_params,history_message_id=history_message_id)
        elif llm_model_vendor == "local":
            with session_scope(session_maker) as session:
                row_expert: Expert_Schema | None = select_expert_from_id(expert_id=expert_data["expert_id"],session=session)
                assert row_expert
            expert_model_config = load_expert_model_config(expert_id=expert_data["expert_id"])
            expert_llm_params = expert_model_config["search"]["params"]
            base_url = expert_llm_params.get("base_url")
            api_key = expert_llm_params.get("api_key")
            max_tokens = expert_llm_params.get("max_tokens")
            extra_body = expert_llm_params.get("extra_body")
            assert base_url, "local model base_url is not set"
            if api_key:
                api_key = api_key
            else:
                api_key = "LOCAL"
            if max_tokens:
                llm_model_params["max_tokens"] = max_tokens
            if extra_body:
                llm_model_params["extra_body"] = extra_body
            local_model_handler = GPTHandler(api_key =api_key,base_url=base_url)
            response = local_model_handler.run_gptModel_stream(
                session=session,
                chat_uuid=chat_uuid,
                user=user,
                messages=messages,
                user_input=user_input,
                model=llm_model,
                expert_data=expert_data,
                model_list_id = llm_model_list_id,
                params=llm_model_params,
                history_message_id=history_message_id
            )
        elif llm_model_vendor == "google":
            google_api_key = env_utils.get_google_api_key()
            if google_api_key is None:
                raise RuntimeError("缺少 Gemini 相關環境變數")            
            handler = GeminiHandler(api_key=google_api_key)
            system_prompt = messages[0]["content"]
            try:
                message_for_gemini = GeminiHandler.convert_message_to_gemini_format(messages[-1])
            except Exception as e:
                logger.error(f"convert_message_to_gemini_format error: {e}")
                message_for_gemini = messages[-1]
            response = handler.run_gemini_model_stream(
                session=session,
                chat_uuid=chat_uuid,
                user=user,
                user_input=user_input,
                expert_data=expert_data,
                system_prompt=system_prompt,
                message_content=message_for_gemini,
                model_params=llm_model_params,
                model_list_id=llm_model_list_id,
                model=llm_model,
                history_message_id=history_message_id
            )
        elif llm_model_vendor == "openrouter":
            # OpenRouter 是一個 LLM API 路由服務，允許訪問多種模型
            # 可以通過 model 參數指定具體的模型，例如 "anthropic/claude-3-opus" 或 "openai/gpt-4-turbo"
            # 更多資訊請參考：https://openrouter.ai/docs
            handler = OpenRouterHandler()
            response = handler.run_openrouter_model_stream(
                session=session,
                chat_uuid=chat_uuid,
                user=user,
                messages=messages,
                user_input=user_input,
                expert_data=expert_data,
                model_list_id=llm_model_list_id,
                model=llm_model,
                params=llm_model_params,
                history_message_id=history_message_id
            )
        else:
            raise RuntimeError(f"未支援的模型 {llm_model}")
        return response

def complete(chat_uuid, user, gpt_params, messages, user_input, category,
             expert_data,model_list_id):
    GPT = GPTHandler(api_key=env_utils.get_openai_key())
    with session_scope(session_maker) as session:
        response = GPT.run_gptModel(
            session=session,
            user=user,
            model_list_id = model_list_id,
            messages=messages,
            user_input=user_input,
            model="gpt-4o",
            expert_data=expert_data,
            chat_uuid=chat_uuid,
            params=gpt_params
        )
    logger.info(f"complete response {response}")
    return response

app = create_app()

cors = CORS(app, resources={r"/api/*": {"origins": "http://localhost:5000"}})

def get_form(form_data):
    # data = {'data': {'hidden': '下週四要請假一天', '請假事由': '家裡修水電', '假別': '休假'}, 'type': 'form'}
    # Initialize an empty list to store the joined strings
    result = []
    result_data:str = ""
    # Loop through the items in the 'data' dictionary
    for key, value in form_data["data"].items():
        # Exclude the 'hidden' key
        # 先增加state的判斷 之後可以增加需求
        if key != "hidden" and key != "state":
            if key == "fields":
                if value.get("singleSelect"):
                    result.insert(0,f"{value['singleSelect']}")
            if key == "form":
                for k, v in value.items():
                    result.append(f"{k}: {v}")
            if key == "comVal":
                result.append(f"{value}")
    # Join the result list into a single string
    if "data" in form_data and form_data["data"].get("hiden"):
        hidden = "".join(form_data["data"]["hidden"])
        result_data = hidden + " " + ", ".join(result)
    else:
        result_data = ", ".join(result)
    # logger.info(
    #     f"app.py get_form hidden + ' ' + ', '.join(result) {hidden + ' ' + ', '.join(result)}"
    # )
    return result_data
    # return ", ".join(result)

def get_handler_processor(expert_id):
    return handleProcessor.get_handlers(expert_id)

def bot(history_message_id,chat_uuid,expert_id,
        user: User,
        incoming_msg,
        chat_context,
        scope_datasets: list[str]| None,
        is_stream: bool = True,
        cookies=None,is_mcp:bool=False):
    logger.info(
        f"uuid:{chat_uuid} expert_id:{expert_id}, {user}, incoming:{incoming_msg}, context:{chat_context}"
    )
    category = -1
    handler = None
    try:
        logger.debug("Step 5.1 : bot get default expert model config",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        with session_scope(session_maker) as session:
            default_setting = select_settings_from_key(
                key="default_expert_model_config",session=session)
            assert default_setting
            str_config = default_setting.value
            current_model_config: dict = json.loads(str_config)
            model_params = current_model_config["model_params"]
    except Exception as ex:
        logger.error(f"get default expert model config error, err: {ex}")
        model_params = app.config["MODEL_PARAMS"]
    return_model_params={}
    try:
        # TODO 資料集多來源會出現問題
        logger.debug("Step 5.2 : bot get handler processor",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        ava_handlers = get_handler_processor(expert_id)
        logger.debug("Step 5.3 : bot get handler processor finished",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        if isinstance(incoming_msg, str):
            logger.debug("Step 5.4 : bot determine input message type",extra={"history_message_id":history_message_id,"expert_id":expert_id,})
            if len(ava_handlers) == 1:
                logger.debug("Step 5.5 : bot determine input message type finished",extra={"history_message_id":history_message_id,"expert_id":expert_id,"incoming_msg":incoming_msg,"category":0})
                # TODO: 這邊以後要改成讀專家的intent
                category = 0
            else:
                with session_scope(session_maker) as session:
                    category = intent_utils.intent_classifier(
                        chat_uuid, expert_id, user, incoming_msg, ava_handlers,session)
                logger.debug("Step 5.5 : bot determine input message type finished",extra={"history_message_id":history_message_id,"expert_id":expert_id,"incoming_msg":incoming_msg,"category":category})
            logger.info(f"intent_utils.category: {category}")
            # session["last_category"] = category
            messages = []
            cmd = int(category)
            if cmd == 99:
                raise NotImplementedError("抱歉，無法理解您的問題。請重新描述或提供更多資訊。")
        else:
            cmd = 0
            messages = []
        logger.debug("Step 5.6 : bot before copy handler",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        handler = copy(ava_handlers[cmd])
        handler.construct_instructions(messages)
        logger.debug("Step 5.7 : bot after copy handler and construct instructions",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        logger.info(f"handler: {handler}")
        if handler.set_llm_config():
            model_params = handler.get_llm_model_params()
        logger.debug("Step 5.8 : bot before load expert model config",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        expert_model_config = load_expert_model_config(expert_id=expert_id)
        logger.debug("Step 5.9 : bot after load expert model config",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        llm_model :str = expert_model_config["search"]["model"]
        k = get_search_kwargs_or_default(expert_model_config["search"], "k")
        score_threshold = get_search_kwargs_or_default(expert_model_config["search"], "score_threshold")
        cache_threshold: float = get_search_kwargs_or_default(expert_model_config["search"], "cache_threshold")
        return_model_params= model_params.copy()
        return_model_params.update({"model": llm_model,"prompt":handler.get_system_prompt(),"k":k,"score_threshold":score_threshold,"cache_threshold":cache_threshold})
        logger.debug("Step 5.10 : bot before execute_by_category",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        assistant_message = execute_by_category(history_message_id,chat_uuid, expert_id, user,
                                                incoming_msg, handler,
                                                chat_context,scope_datasets, cookies)
        logger.debug("Step 5.11 : bot after execute_by_category",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        datasource = ""
        
    except LoginTypeNotSatisfiedException as se:
        logger.error(f"msg: {str(se)} , category:{category}")
        return (f"您缺少以下登入身分: {error_msg(",".join(se.missing_types))} \n\n {info_msg("請使用以下身分登入或進行身分綁定")}", False, category, "ERROR",False,return_model_params),handler
    except MyException as se:
        return (str(se), False, category, "ERROR",False,return_model_params),handler
    except SemanticException as se:
        return ("請提供詳細資料: \n\n" + str(se), False, category, "ERROR",False,return_model_params),handler
    except (AssertionError, ValueError,RuntimeError) as ae:
        logger.error(f"msg: {str(ae)} , category:{category}")
        logger.error(traceback.print_exc())

        with session_scope(session_maker) as session:
            expert_row: Expert_Schema | None = select_expert_from_id(expert_id=expert_id,session=session)
            assert expert_row
            all_experts: Sequence[Expert_Schema] = selet_all_enable_experts(session=session)
            all_experts_id: list[str] = [expert.id for expert in all_experts]
        show_recommendation = expert_row.config_jsonb.get("show_recommended_experts",False)
        if show_recommendation:
            recommendation_experts = expert_row.config_jsonb.get("recommendation_experts",[])
            if not recommendation_experts:
                recommendation_experts = [{"id":expert.id,"name":expert.name} for expert in all_experts if expert.id != expert_id]
            else:
                recommendation_experts = [item for item in recommendation_experts if item["id"] in all_experts_id]
            result: list = [str(ae),{"type": "html_json"}]
            html_json_component : list = [{
                "tag": "html",
                "text": "試著問問其他專家",
                "after_new_line":True
            }]
            html_json_component.extend([{
                "tag": "button",
                "text": expert["name"],
                "action": "switchExpert",
                "args": [expert["id"],incoming_msg]
            } for expert in recommendation_experts])
            result.append(html_json_component)
            return (result, False, category, "NOANSWER",False,return_model_params),handler
        else:
            return (str(ae), False, category, "NOANSWER",False,return_model_params),handler
    except (NotImplementedError, Exception) as e:
        msg = str(e)
        if msg == "401":
            msg = "請重新登入"  # TODO: i18n
        else:
            # 錯誤訊息處理
            with session_scope(session_maker) as session:
                expert_row: Expert_Schema | None = select_expert_from_id(expert_id=expert_id,session=session)
                assert expert_row
                _msg = expert_row.config_jsonb.get("suggest_question") or config_utils.get_suggestion()
                
                result: list = [_msg]
                logger.error(f"msg: {str(e)} , category:{category}")
                logger.error(traceback.print_exc())

                # 檢查是否要顯示推薦專家
                show_recommendation = expert_row.config_jsonb.get("show_recommended_experts", False)
                if show_recommendation:
                    all_experts: Sequence[Expert_Schema] = selet_all_enable_experts(session=session)
                    all_experts_id: list[str] = [expert.id for expert in all_experts]
                    recommendation_experts = expert_row.config_jsonb.get("recommendation_experts", [])
                    
                    if not recommendation_experts:
                        recommendation_experts = [{"id": expert.id, "name": expert.name} for expert in all_experts if expert.id != expert_id]
                    else:
                        recommendation_experts = [item for item in recommendation_experts if item["id"] in all_experts_id]
                    
                    # 構建推薦專家HTML JSON區段
                    html_json_component: list = [{
                        "tag": "html",
                        "text": "試著問問其他專家",
                        "after_new_line": True
                    }]
                    
                    html_json_component.extend([{
                        "tag": "button",
                        "text": expert["name"],
                        "action": "switchExpert",
                        "args": [expert["id"], incoming_msg]
                    } for expert in recommendation_experts])
                    
                    result.append({"type": "html_json"})
                    result.append(html_json_component)
            
            return (result, False, category, "ERROR", False, return_model_params),handler

    return complete_chat(history_message_id, handler, chat_uuid, expert_id, user, messages,
                         incoming_msg, assistant_message, datasource,
                         is_stream,is_mcp),handler

def select_user_memory_context(user_id,expert_id,session)->list[dict[str,str]]:
    user_completion_history = select_user_completion_history(user_id=user_id,expert_id=expert_id,session=session)
    prompt_user_messages = []
    for history in user_completion_history[::-1]:
        prompt_user_messages.append({"role": "user", "content": history.user_input})
        prompt_user_messages.append({"role": "assistant", "content": history.expert_output})
    return prompt_user_messages


def complete_chat(
        history_message_id,
        handler,
        chat_uuid,
        expert_id,
        user,
        messages,
        user_input,
        assistant_message,
        datasource,
        is_stream: bool = True,
        is_mcp: bool = False
    ):
    logger.debug("Step 5.12 : enter complete_chat",extra={"history_message_id":history_message_id,"expert_id":expert_id})
    expert_data = {
        "expert_id": expert_id,
        "expert_model": handler.get_dataset_folder_name()
        or str(handler),
        "expert_model_type": handler.get_expert_model_type(),
    }
    try:
        with session_scope(session_maker) as session:
            default_setting = select_settings_from_key(key="default_expert_model_config",session=session)
            assert default_setting
            str_config = default_setting.value
            current_model_config: dict = json.loads(str_config)
            model_params = current_model_config["model_params"]
    except Exception as ex:
        logger.error(f"get default expert model config error, err: {ex}")
        model_params = app.config["MODEL_PARAMS"]
    if handler.set_llm_config():
        model_params = handler.get_llm_model_params()
    # 這邊為不需要額外經過GPT的事件
    if handler.return_directly():
        # 技能或非串流(通常是cache)
        logger.debug("Step 5.13a : complete_chat before return_directly",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        is_cache: bool = isinstance(handler,KnowledgeHandler)
        return_model_params = {}
        if is_cache:
            expert_model_config = load_expert_model_config(expert_id=expert_data["expert_id"])
            llm_model :str = expert_model_config["search"]["model"]
            k:int = get_search_kwargs_or_default(expert_model_config["search"], "k")
            score_threshold = get_search_kwargs_or_default(expert_model_config["search"], "score_threshold")
            cache_threshold = get_search_kwargs_or_default(expert_model_config["search"], "cache_threshold")
            return_model_params= model_params.copy()
            return_model_params.update({
                "model": llm_model,
                "prompt":handler.get_system_prompt(),
                "k":k,"score_threshold":score_threshold,"cache_threshold":cache_threshold
            })
        # 這邊是為了要增加到算token的部分
        entry = ModelTokenLogEntry(
            model_list_id=handler.get_llm_model_list_id(),
            users_id=user.uid,
            model="no_model",
            classify="action",
            prompt_token=0,
            completion_token=0,
            user_input=user_input,
            expert_id=expert_data["expert_id"],
            expert_model=expert_data["expert_model"],
            expert_model_type=expert_data["expert_model_type"],
            price=0,
            chat_uuid=chat_uuid,
        )
        with session_scope(session_maker) as session:
            LoggerUtils.log_token_info(entry,session)
        logger.debug("Step 5.14 : complete_chat after log_token_info",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        reset_messages(messages)

        need_join = isinstance(assistant_message, str)  # 統一轉成 list 如果最終需要str 再join回來的標記
        if not isinstance(assistant_message, list):
            assistant_message = [assistant_message]
        # if handler.data_source() is not None and handler.data_source() != "":
        #     assistant_message.append(handler.data_source())
        if handler.extra_append_after_answer(
        ) is not None and handler.extra_append_after_answer() != "":
            assistant_message.append(handler.extra_append_after_answer())
        if handler.extra_append_component_after_all(
        ) is not None and handler.extra_append_component_after_all() != "":
            assistant_message.extend(
                handler.extra_append_component_after_all())
        if handler.append_form_binding() is not None and handler.append_form_binding() != "":
            assistant_message.extend(handler.append_form_binding())
        if handler.get_source_chunk() is not None and handler.get_source_chunk() != "":
            _source_chunk = handler.get_source_chunk()
            if is_mcp:
                _source_chunk = _source_chunk[1]
                backend_host: str | None = os.getenv("IMAGE_DOWNLOAD_DOMAIN")
                assert backend_host, "AVA_BACKEND_URL is not set"
                if backend_host and not backend_host.endswith('/'):
                    backend_host += '/'
                collect_files = {
                    item["metadata"]["originalname"]:item["metadata"]["filename"]
                    for file_level in _source_chunk
                    for chunk_group in file_level
                    for item in chunk_group
                    if "metadata" in item and "filename" in item["metadata"]
                }
                result_source_files = {}
                for original_filename,filename in collect_files.items():
                    result_source_files[original_filename] = urljoin(backend_host,f"download/{filename}")
                assistant_message.append(result_source_files)
            else:
                assistant_message.extend(_source_chunk)
        if handler.get_extra_chunk() is not None and handler.get_extra_chunk() != "":
            assistant_message.extend(handler.get_extra_chunk())
        if need_join:
            assistant_message = "".join(assistant_message)
        logger.debug("Step 5.15 : complete_chat  return_directly end",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        return assistant_message, False, datasource, handler.get_llm_model(),is_cache,return_model_params

    memory_context = []
    enable_context_history =False
    try:
        with session_scope(session_maker) as _session:
            row_expert: Expert_Schema | None = select_expert_from_id(expert_id=expert_id,session=_session)
            assert row_expert
            if isinstance(row_expert.config_jsonb,dict):
                expert_config_json:dict = row_expert.config_jsonb
            elif isinstance(row_expert.config_jsonb,str):
                expert_config_json:dict = json.loads(row_expert.config_jsonb)
        enable_context_history = expert_config_json.get("enable_context_history",False)
    except:
        pass
    if enable_context_history:
        memory_context = select_user_memory_context(user_id=user.uid,expert_id=expert_id,session=session)
    if isinstance(assistant_message, list):
        # 這行就是在改 system prompt 不要懷疑
        messages[0]["content"] = f"{messages[0]["content"]}{assistant_message[0]}"
        if memory_context:
            messages.extend(memory_context)
        if isinstance(handler, KnowledgeHandler) and len(assistant_message) > 2:
            backend_host: str | None = getenv("IMAGE_DOWNLOAD_DOMAIN")
            assert backend_host, "AVA_BACKEND_URL is not set"
            if backend_host and not backend_host.endswith('/'):
                backend_host += '/'            
            user_message_content = [{"type":"text", "text":assistant_message[1]}]
            with session_scope(session_maker) as session:
                for image_uuid in assistant_message[2][:10]: # 最多取10張圖片
                    image_row: DocumentImageStore_Schema | None = select_image_from_uuid(image_uuid=image_uuid,session=session)
                    assert image_row
                    base64_data = base64.b64encode(image_row.image_data).decode()
                    user_message_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url":
                            f"data:{image_row.content_type};base64,{base64_data}"
                        }
                    })
                    m = re.match(r"^image\/([a-zA-Z0-9\+\.-]+)$", image_row.content_type)
                    image_type = m.group(1) if m else "jpeg"
                    user_message_content.append({
                        "type": "text",
                        "text": f"這張圖的markdown顯示方式 ![{image_row.image_uuid}.{image_type}]({backend_host}download/{image_row.image_uuid})"
                    })
            if enable_context_history:
                img_prompt = """
                    #### 圖片引用判斷規則

                    請依據以下規則判斷是否在回覆中列出圖片來源。**只有當圖片與本次問題有明確關聯，且實際在回覆中被引用或說明時，才能列入圖片來源區塊。**

                    ---

                    ### 一、問題判定標準

                    - 本次提問以 `role: user` 為主，若其 `content` 中有任一 `text` 開頭為 `Q:`，則視為本次的「主問題」。
                    - 其他段落如「提供的圖片連結如下」等，為輔助上下文，不構成主問題。

                    ---

                    ### 二、圖片是否列入圖片來源的條件（必須同時符合）

                    1. Assistant 的回覆有**實際引用、分析或說明圖片中的資訊**。
                    2. 圖片內容與本次 `Q:` 問題主題有明確的語意關聯。
                    3. 僅因圖片存在於 context 或曾於其他問題中使用，不構成再次引用依據。

                    ---

                    ### 三、不得列入圖片來源的情況

                    - 回覆中未提及或說明圖片內容。
                    - 圖片與主問題主題明顯無關（如材料圖表與法律問題）。
                    - 圖片只出現在 context 附帶段落，如「圖片連結如下」，且未被實際使用。

                    ---

                    ### 四、圖片來源區塊格式規範

                    - 回覆中不得直接顯示圖片。
                    - 僅於回覆結尾統一列出圖片來源區塊，格式如下：
                    - 開頭為「圖片來源：」
                    - 每張圖片一行，格式為：`![圖片名稱](網址)`
                    - 禁止使用 ```markdown 標記或 HTML 標籤。
                    - 不可重複列出圖片。
                    - 若無符合條件的圖片，整個「圖片來源：」區塊應完全省略。

                    ---

                    ### 五、多輪對話限制

                    - Assistant 回覆時只依據「本次提問（即本輪 Q: 開頭的內容）」判斷是否使用圖片。
                    - 即使圖片在前一輪曾被引用，若本輪問題與其無關，仍不得在回覆中列出圖片來源。

                    ---

                    請嚴格依據上述規範輸出圖片來源內容，否則系統將無法正確解析。
                """
            else:
                img_prompt = """
                    ### 請回答問題後，依據下列規則**選擇性地**補上「圖片來源」區塊。若無符合條件，則省略該區塊。

                    僅在以下條件全部符合時，於回覆結尾加上「圖片來源：」區塊：

                    1. 回答中**實際說明、引用或分析**了圖片中的資訊。
                    2. 該圖片與 Q: 所描述的主題**有語意上的明確關聯**。
                    3. 圖片連結已出現在本次輸入內容中。

                    請注意：

                    - 若沒有引用圖片內容，請**完全不要生成圖片來源區塊**。
                    - 請勿在主體回答中顯示圖片，只能在回覆最後統一列出圖片名稱與網址。
                    - 圖片來源區塊格式如下（勿加 markdown 或 HTML）：

                    圖片來源：  
                    ![圖片名稱](圖片網址)

                    例外說明：

                    - 「Q:」開頭的段落為使用者的主問題，請以此作為回覆重點，其他段落為輔助敘述。
                """
            user_message_content.append({
                "type":"text",
                "text":img_prompt
            })
        else:
            user_message_content = assistant_message[1]
        messages.append({"role": "user", "content": user_message_content})
    else:
        if memory_context:
            messages.extend(memory_context)
        messages.append({"role": "user", "content": assistant_message})
    
    logger.debug(f"handler:{handler}")

    if is_stream and handler.is_streaming():
        logger.debug("Step 5.13b : complete_chat before streaming",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        expert_data = {
            "expert_id": expert_id,
            "expert_model": handler.get_dataset_folder_name()
            or str(handler),  # 如果有dataset_name 代表是資料集
            "expert_model_type": handler.get_expert_model_type(),
        }
        expert_model_config = load_expert_model_config(expert_id=expert_data["expert_id"])
        llm_model :str = expert_model_config["search"]["model"]
        llm_params_key :list[str] = ["max_tokens","temperature","frequency_penalty","top_p"]
        k: int = get_search_kwargs_or_default(expert_model_config["search"], "k")
        score_threshold: float = get_search_kwargs_or_default(expert_model_config["search"], "score_threshold")
        cache_threshold: float = get_search_kwargs_or_default(expert_model_config["search"], "cache_threshold")
        return_model_params= model_params.copy()
        return_model_params.update({
            "model": llm_model,
            "prompt":handler.get_system_prompt(),
            "k":k,"score_threshold":score_threshold,"cache_threshold":cache_threshold
        })
        redundent_key :list[str] = []
        for key in model_params.keys():
            if key not in llm_params_key:
                redundent_key.append(key)
        for key in redundent_key:
            del model_params[key]
        logger.debug("Step 5.14 : complete_chat before complete_chunk",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        streaming_data = complete_chunk(
            chat_uuid,
            model_params,
            expert_data,
            user,
            messages,
            user_input,
            history_message_id,
            expert_model_config["search"]["model_list_id"],
            expert_model_config["search"]["vendor"],
            llm_model
        )
        logger.debug("Step 5.15 : complete_chat after complete_chunk",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        result_streaming = save_streaming_data(handler,history_message_id, streaming_data,llm_model,handler.get_llm_model_params(),handler.get_system_prompt(),is_mcp)
        logger.debug("Step 5.16 : complete_chat after save_streaming_data",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        return result_streaming, True, datasource, handler.get_llm_model(),False,return_model_params
    else:
        # 現在沒用到
        result = complete(chat_uuid, user, model_params, messages, user_input,
                          datasource, expert_data,handler.get_llm_model_list_id())
        if not isinstance(result, list):
            result = [{"type": "data", "data": result}]
        expert_model_config = load_expert_model_config(expert_id=expert_data["expert_id"])
        llm_model :str = expert_model_config["search"]["model"]
        k:int = get_search_kwargs_or_default(expert_model_config["search"], "k")
        score_threshold: float = get_search_kwargs_or_default(expert_model_config["search"], "score_threshold")
        cache_threshold: float = get_search_kwargs_or_default(expert_model_config["search"], "cache_threshold")
        return_model_params= model_params.copy()
        return_model_params.update({
            "model": llm_model,
            "prompt":handler.get_system_prompt(),
            "k":k,"score_threshold":score_threshold,"cache_threshold":cache_threshold
        })
        return result, False, datasource, handler.get_llm_model(),False,return_model_params

def save_streaming_data(handle:AvaHandler,history_message_id, streaming_data,llm_model,model_params,model_prompt,is_mcp:bool=False):
    full_content = ""
    buffer = ""
    pattern = r'＄＠！<no_answer>(.*?)</no_answer>'
    specific_tag_detect = ['＄','＠','！']
    no_answer = False
    for content in streaming_data:
        content = content.replace("$","＄") # 模型 pretrain 的資料中偏好輸出半形的 $，所以做個取代
        if specific_tag_detect[0] in content or buffer:
            buffer += content
        else:
            full_content += content
            yield content
            continue
        match = re.search(pattern, buffer)
        if match:
            no_answer = match.group(1) == 'true'
            before_no_answer = buffer.split(match.group(0))[0]
            after_no_answer = buffer.split(match.group(0))[1] if len(buffer.split(match.group(0))) > 1 else ""
            if before_no_answer:
                yield before_no_answer  # 輸出＄＠！<no_answer>前的內容
            if after_no_answer:
                yield after_no_answer  # 輸出＄＠！<no_answer>後的內容
            full_content += buffer
    if extra_append_after_answer := handle.extra_append_after_answer():
        yield extra_append_after_answer
    # if (data_source := handle.data_source()):
    #     yield data_source
    if (form_binding :=handle.append_form_binding()):
        yield "</end>"
        yield json.dumps(form_binding[0], ensure_ascii=False)
        yield "</end>"
        yield json.dumps(form_binding[1], ensure_ascii=False)
        yield "</end>"
    
    if (source_chunk := handle.get_source_chunk()):
        if is_mcp:
            _source_chunk = source_chunk[1]
            backend_host: str | None = os.getenv("IMAGE_DOWNLOAD_DOMAIN")
            assert backend_host, "AVA_BACKEND_URL is not set"
            if backend_host and not backend_host.endswith('/'):
                backend_host += '/'
            collect_files = {
                item["metadata"]["originalname"]:item["metadata"]["filename"]
                for file_level in _source_chunk
                for chunk_group in file_level
                for item in chunk_group
                if "metadata" in item and "filename" in item["metadata"]
            }
            result_source_files = {}
            for original_filename,filename in collect_files.items():
                result_source_files[original_filename] = urljoin(backend_host,f"download/{filename}")
            yield json.dumps(result_source_files, ensure_ascii=False)
        else:
            if not handle.append_form_binding():
                yield "</end>"
            yield json.dumps(source_chunk[0], ensure_ascii=False)
            yield "</end>"
            yield json.dumps(source_chunk[1], ensure_ascii=False)
            yield "</end>"
    if (extra_chunk := handle.get_extra_chunk()) and not is_mcp:
        yield json.dumps(extra_chunk[0], ensure_ascii=False)
        yield "</end>"
        yield json.dumps(extra_chunk[1], ensure_ascii=False)
        yield "</end>"
    if extra_append_component := handle.extra_append_component_after_all():
        yield json.dumps(extra_append_component[0], ensure_ascii=False)
        yield "</end>"
        yield json.dumps(extra_append_component[1], ensure_ascii=False)
        yield "</end>"
    handle.stream_after(no_answer,full_content,history_message_id,llm_model,model_params,model_prompt)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/ava/api/mgt/doc")
def doc_manage():
    return render_template("docmgt.html")

@app.route("/ava/api/mgt/clean")
def clean():
    logger.info("clean session data")
    with app.app_context():
        # Clear all session data
        # redis_store.flushall()
        logger.info("Cleared all session data in Redis")
    return "Clean Finished!"

@app.route("/ava/api/mgt/config", methods=["POST", "GET"])
def mgt():
    message = "Welcome..."
    inputs = []
    keys = ["MAS_COOKIES", "TEST_COOKIES", "PROD_COOKIES"]
    if request.form.get("_action") == "save":
        for key in keys:
            value = request.form.get(key)
            if value != "":
                env_utils.set_key("AVA_" + key, value.strip()) #type: ignore
                inputs.append(key.replace("_COOKIES", ""))
    if len(inputs) > 0:
        fields = ",".join(inputs)
        message = f"設定 {fields} 成功"
    return render_template("config.html", message=message)


@app.route("/ava/api/document/translate",methods=["POST"])
def babeldoc_translate():
    try:
        """
        範例資料
        {
            "userID": "1234567890",
            "conversationID": "1234567890",
            "file_paths": [
                "chat/download/6b47997d-0d5e-4d59-b78f-bd2821c11105/a6202cbe-188d-41c0-8bf2-c35896b40aec/플렉서블 전자회로_1743594275589.pdf"
            ]
        }
        """
        json_body = request.get_json()
        userID = json_body.get("userID")
        conversationID = json_body.get("conversationID")
        file_paths = json_body.get("file_paths")
        lang_out = json_body.get("lang_out", "zh-TW")
        history_message_id = json_body.get("history_message_id")
        if not userID or not conversationID or not file_paths or not history_message_id:
            return jsonify({"status": "fail", "code": 400, "message": "Missing required fields"})
        
        FILE_SERVICE_URL = os.getenv("AVA_FILE_SERVICE_URL","")
        if not FILE_SERVICE_URL:
            return jsonify({"status": "fail", "code": 500, "message": "File service URL is not set"})
        
        # Generate unique task ID
        task_id = str(uuid.uuid4())

        # Create a persistent directory for translation files
        translation_dir = Path(__file__).parents[1] / "translation_files" / task_id
        translation_dir.mkdir(parents=True, exist_ok=True)
        
        # Create initial translation task record in database with PENDING status
        with session_scope(session_maker) as session:
            insert_translation_task(
                task_id=task_id,
                user_id=userID,
                room_id=conversationID,
                result_files=[],  # Initially empty
                message="Translation task created, downloading files...",
                history_message_id=history_message_id,
                session=session
            )
        
        # Download files
        file_names = []
        try:
            for file_path in file_paths:
                file_url = f"{FILE_SERVICE_URL}/{file_path}"
                file_name = file_path.split("/")[-1]
                file_names.append(file_name)
                file_path = translation_dir / file_name
                response = requests.get(file_url)
                with open(file_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                        
            # Update status after files are downloaded
            with session_scope(session_maker) as session:
                update_translation_task_status(
                    task_id=task_id,
                    status=TranslationStatus.PENDING.value,
                    message=f"Files downloaded: {', '.join(file_names)}",
                    session=session
                )
        except Exception as e:
            # Update status if downloading fails
            with session_scope(session_maker) as session:
                update_translation_task_status(
                    task_id=task_id,
                    status=TranslationStatus.ERROR.value,
                    message=f"Failed to download files: {str(e)}",
                    session=session
                )
            return jsonify({"status": "fail", "code": 500, "message": f"Failed to download files: {str(e)}"})
        
        config_path = Path(__file__).parents[1] / "config" / "babeldoc.toml"
        output_dir = translation_dir / "output"

        # Check if paths exist
        if not config_path.exists():
            with session_scope(session_maker) as session:
                update_translation_task_status(
                    task_id=task_id,
                    status=TranslationStatus.ERROR.value,
                    message=f"Config file not found at {config_path}",
                    session=session
                )
            return jsonify({"status": "fail", "code": 404, "message": f"Config file not found at {config_path}"})

        if not output_dir.exists():
            output_dir.mkdir(parents=True, exist_ok=True)

        # --files file1 --files file2 --files file3
        cmd = ["babeldoc", "--config", str(config_path), "--lang-out", lang_out]
        pdf_files = list(translation_dir.glob("*.pdf"))
        if not pdf_files:
            return jsonify({"status": "fail", "code": 400, "message": "No PDF files found in the translation directory"})
        for file_path in pdf_files:
            cmd.extend(["--files", str(file_path)])
        cmd.extend(["--output", str(output_dir)])

        # Start translation in background thread
        thread = threading.Thread(target=run_translation, args=(task_id, cmd, translation_dir, output_dir, userID, conversationID, file_paths))
        thread.daemon = True
        thread.start()
        
        return jsonify({
            "status": "success", 
            "code": 200, 
            "message": "Translation started in background",
            "data": {
                "task_id": task_id
            }
        })
    except Exception as e:
        logger.exception("Failed to start translation")
        # If we have a task_id, update its status
        if 'task_id' in locals():
            with session_scope(session_maker) as session:
                update_translation_task_status(
                    task_id=task_id,
                    status=TranslationStatus.ERROR.value,
                    message=f"Failed to start translation: {str(e)}",
                    session=session
                )
        return jsonify({"status": "fail", "code": 500, "message": str(e)})

def run_translation(task_id: str, cmd: list, translation_dir: Path, output_dir: Path, 
                    user_id: str, conversation_id: str, original_file_paths: list):
    try:
        with session_scope(session_maker) as session:
            update_translation_task_status(
                task_id=task_id,
                status=TranslationStatus.PROCESSING.value,
                message="Translation started...",
                session=session
            )
        # Run translation command
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        file_service_url = os.getenv("AVA_FILE_SERVICE_URL","")
        assert file_service_url, "AVA_FILE_SERVICE_URL is not set"
        if file_service_url and file_service_url.endswith('/'):
            file_service_url = file_service_url[:-1]
        if result.returncode == 0:
            # Translation succeeded
            with session_scope(session_maker) as session:
                update_translation_task_status(
                    task_id=task_id,
                    status=TranslationStatus.PROCESSING.value,
                    message="Translation completed, uploading results...",
                    session=session
                )
            
            # Upload results to file service
            try:
                backend_host_url: str | None = os.getenv("IMAGE_DOWNLOAD_DOMAIN")
                assert backend_host_url, "AVA_BACKEND_URL is not set"
                if backend_host_url and  backend_host_url.endswith('/'):
                    backend_host_url = backend_host_url[:-1]
                file_translations = []
                # Get all files in the output directory
                for file_path in output_dir.glob("*"):
                    if file_path.is_file():
                        # Prepare the file for upload
                        with open(file_path, "rb") as f:
                            files = {
                                "file": (file_path.name, f, "application/octet-stream")
                            }
                            data = {
                                "userId": user_id,
                                "conversationId": conversation_id
                            }
                            # Upload to file service
                            upload_url = f"{file_service_url}/chat/upload"
                            response = requests.post(upload_url, files=files, data=data)
                            if response.status_code != 200:
                                logger.error(f"Failed to upload file {file_path.name}: {response.text}")
                                with session_scope(session_maker) as session:
                                    update_translation_task_status(
                                        task_id=task_id,
                                        status=TranslationStatus.FAILED.value,
                                        message=f"Failed to upload file {file_path.name}",
                                        session=session
                                    )
                                continue
                            file_translations.append({
                                "file_name": file_path.name,
                                "file_url": f"{backend_host_url}/downloadChat/{user_id}?conversationId={conversation_id}&conversationFilename={file_path.name}"
                            })
                
                # All files uploaded successfully
                if file_translations:
                    # Update task status to completed with result files
                    with session_scope(session_maker) as session:
                        update_translation_task_status(
                            task_id=task_id,
                            status=TranslationStatus.COMPLETED.value,
                            message=f"Translation completed successfully, {len(file_translations)} files uploaded",
                            result_files=file_translations,
                            session=session
                        )
                    
                    # Add bot message to chat
                    bot_message_object = {
                        "time": int(datetime.now().timestamp() * 1000),
                        "sender": "bot",
                        "message": [
                            {
                                "html_json": [
                                    {
                                        "tag": "file_translation_success",
                                        "files": file_translations
                                    }
                                ]
                            }
                        ]
                    }
                    with session_scope(session_maker) as session:
                        append_bot_message_chat(
                            user_id=user_id, 
                            group_id=conversation_id, 
                            chat=bot_message_object, 
                            session=session
                        )
                else:
                    # No files were uploaded successfully
                    with session_scope(session_maker) as session:
                        update_translation_task_status(
                            task_id=task_id,
                            status=TranslationStatus.FAILED.value,
                            message="Translation completed but no files were uploaded",
                            session=session
                        )
            except Exception as e:
                # Failed to upload files
                logger.exception("Error uploading files to file service")
                with session_scope(session_maker) as session:
                    update_translation_task_status(
                        task_id=task_id,
                        status=TranslationStatus.FAILED.value,
                        message=f"Error uploading files to file service: {str(e)}",
                        session=session
                    )
                
                # Add error message to chat
                bot_message_object = {
                    "time": int(datetime.now().timestamp() * 1000),
                    "sender": "bot",
                    "message": [
                        {
                            "html_json": [
                                {
                                    "tag": "file_translation_error",
                                    "reason": f"Error uploading files: {str(e)}"
                                }
                            ]
                        }
                    ]
                }
                with session_scope(session_maker) as session:
                    append_bot_message_chat(
                        user_id=user_id, 
                        group_id=conversation_id, 
                        chat=bot_message_object, 
                        session=session
                    )
        else:
            # Translation failed
            with session_scope(session_maker) as session:
                update_translation_task_status(
                    task_id=task_id,
                    status=TranslationStatus.FAILED.value,
                    message=f"Translation failed: {result.stderr}",
                    session=session
                )
            
            # Add failure message to chat
            bot_message_object = {
                "time": int(datetime.now().timestamp() * 1000),
                "sender": "bot",
                "message": [
                    {
                        "html_json": [
                            {
                                "tag": "file_translation_failed",
                                "reason": result.stderr,
                                "files": [
                                    {
                                        "file_name": file_path.split("/")[-1],
                                        "file_url": f"{file_service_url}/{file_path}"
                                    }
                                    for file_path in original_file_paths
                                ]
                            }
                        ]
                    }
                ]
            }
            with session_scope(session_maker) as session:
                append_bot_message_chat(
                    user_id=user_id, 
                    group_id=conversation_id, 
                    chat=bot_message_object, 
                    session=session
                )
    except Exception as e:
        # Unexpected error during translation
        logger.exception("Translation process error")
        with session_scope(session_maker) as session:
            update_translation_task_status(
                task_id=task_id,
                status=TranslationStatus.ERROR.value,
                message=f"Translation process error: {str(e)}",
                session=session
            )
        
        # Add error message to chat
        bot_message_object = {
            "time": int(datetime.now().timestamp() * 1000),
            "sender": "bot",
            "message": [
                {
                    "html_json": [
                        {
                            "tag": "file_translation_error",
                            "reason": str(e)
                        }
                    ]
                }
            ]
        }
        with session_scope(session_maker) as session:
            append_bot_message_chat(
                user_id=user_id, 
                group_id=conversation_id, 
                chat=bot_message_object, 
                session=session
            )
    finally:
        # Clean up the translation files after completion
        try:
            shutil.rmtree(translation_dir, ignore_errors=True)
        except Exception as e:
            logger.error(f"Failed to clean up translation directory: {str(e)}")

@app.route("/ava/api/document/translate/status", methods=["GET"])
def babeldoc_status():
    """Get translation task status"""
    task_id = request.args.get("task_id")
    if not task_id:
        return jsonify({"status": "fail", "code": 400, "message": "Missing task_id"})

    try:
        with session_scope(session_maker) as session:
            task = get_translation_task(task_id=task_id, session=session)
            if not task:
                return jsonify({
                    "status": "fail",
                    "code": 404,
                    "message": "Task not found"
                })

            return jsonify({
                "status": "success",
                "code": 200,
                "data": {
                    "task_id": task.id,
                    "status": task.status,
                    "message": task.message,
                    "is_notified": task.is_notified,
                    "result_files": task.result_files,
                    "create_time": task.create_time.isoformat(),
                    "update_time": task.update_time.isoformat()
                }
            })

    except Exception as e:
        logger.exception("Failed to get translation status")
        return jsonify({
            "status": "fail",
            "code": 500,
            "message": str(e)
        })

@app.route("/ava/api/document/translate/tasks", methods=["GET"])
def babeldoc_tasks():
    """Get all translation tasks for a user"""
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"status": "fail", "code": 400, "message": "Missing user_id"})

    try:
        with session_scope(session_maker) as session:
            tasks = get_user_translation_tasks(user_id=user_id, session=session)
            return jsonify({
                "status": "success",
                "code": 200,
                "data": [{
                    "task_id": task.id,
                    "status": task.status,
                    "message": task.message,
                    "is_notified": task.is_notified,
                    "result_files": task.result_files,
                    "create_time": task.create_time.isoformat(),
                    "update_time": task.update_time.isoformat()
                } for task in tasks]
            })

    except Exception as e:
        logger.exception("Failed to get user translation tasks")
        return jsonify({
            "status": "fail",
            "code": 500,
            "message": str(e)
        })

@app.route("/health")
def health():
    return Response(
        json.dumps({"status": "ok"}),
        status=200,
        content_type="application/json",
    )

@app.route("/ava/api/logtest")
def logtest():
    logger.error("Error Test ava-app.log")
    return "OK"

class FormException(Exception):
    pass

@app.route("/ava/api/skillPost", methods=["POST"])
def skill_post():
    current_user = session.get("user_info")
    cookies = request.cookies
    client_ip = g.get('client_ip')
    if not current_user:
        return jsonify({"status": "fail", "code": 400, "message": "no login user_info"})
    
    user,error_msg = get_user(current_user)
    if error_msg:
        return jsonify({"status": "fail", "code": 500, "message": error_msg})
 
    user.cookies = cookies
    user.client_ip = client_ip
    json_body :dict= request.get_json()
    post_data = json_body.get("post_data",None)
    if post_data is None:
        return jsonify({"status": "fail", "code": 400, "message": "post_data is None"})
    try:
        expert_id : str = json_body["expert_id"]
        device = json_body.get("device",None)
        skill_name : str= post_data["next_skill"]
        data:dict = post_data["data"]
        skill_path: str | None = env_utils.get_key("SKILL_PATH")
        assert skill_path, "SKILL_PATH is not set"
        module_name: str = f"ava.handlers.skills.{skill_path}.{skill_name}"
        module = importlib.import_module(module_name)
        next_skill_class = getattr(module, skill_name)
        next_skill_instance = next_skill_class(**data)
        if getattr(next_skill_instance,"set_session_maker",None):
            assert session_maker is not None, "session_maker is None"
            next_skill_instance.set_session_maker(session_maker)
        handle_result = next_skill_instance.handle(user)
        return_msg = ""
        for msg in handle_result:
            if isinstance(msg, str):
                return_msg += msg
            else:
                return_msg += json.dumps(msg, ensure_ascii=False)
            return_msg += "</end>"
        with session_scope(session_maker) as _session:
            row_expert: Expert_Schema | None = select_expert_from_id(expert_id=expert_id,session=_session)
            assert row_expert
            if isinstance(row_expert.config_jsonb,dict):
                expert_config_json:dict = row_expert.config_jsonb
            elif isinstance(row_expert.config_jsonb,str):
                expert_config_json:dict = json.loads(row_expert.config_jsonb)
            insert_history_message(
                history_message_id=None,
                input_message=json.dumps(post_data,default=lambda x : "Searialization error", ensure_ascii=False),
                output_message=json.dumps(handle_result,default=lambda x : "Searialization error", ensure_ascii=False),
                expert_id=expert_id,
                users_id=user.uid,
                type=insert_history_message_type.SKILL,
                model_name=skill_name,
                link_level=expert_config_json.get("link_level",0),
                device=device,session=_session
            )
        return jsonify({ "data": return_msg})
    except Exception as ex:
        logger.error(f"skill_post error: {ex}", exc_info=True)
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})

def run_speedtest_async(duration: int, concurrent: int, result_queue: Queue, folder_names: list[str]):
    """在新的執行緒中運行非同步壓測"""
    async def execute_vector_speedtest():
        results = []
        
        # 使用現有的資料庫配置
        db_url = env_utils.get_key("POSTGRES_VECTOR_DATABASE_URL")
        assert db_url, "No POSTGRES_VECTOR_DATABASE_URL found in env"
        
        # 解析連線字串
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        db_config = {
            "database": parsed.path[1:],
            "user": parsed.username,
            "password": parsed.password,
            "host": parsed.hostname,
            "port": parsed.port,
            "maxsize":concurrent
        }

        async with aiopg.create_pool(**db_config) as pool:
            tasks = [worker(pool, duration, results, folder_names) for _ in range(concurrent)]
            await asyncio.gather(*tasks)

        # 計算統計結果
        total_requests = len(results)
        if total_requests > 0:
            avg_latency = sum(results) / total_requests
            min_latency = min(results)
            max_latency = max(results)
            qps = total_requests / duration
        else:
            avg_latency = min_latency = max_latency = qps = 0

        return {
            "total_requests": total_requests,
            "avg_latency": round(avg_latency, 4),
            "min_latency": round(min_latency, 4),
            "max_latency": round(max_latency, 4),
            "qps": round(qps, 2)
        }

    async def worker(pool, duration, results, folder_names):
        end_time = time.time() + duration
        while time.time() < end_time:
            await execute_query(pool, results, folder_names)

    async def execute_query(pool, results, folder_names):
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                collections_clause = ", ".join(f"'{name}'" for name in folder_names)
                random_embedding = np.random.rand(3072).tolist()
                start_time = time.perf_counter()
                await cur.execute("SET jit = off;")
                await cur.execute("SET hnsw.ef_search = 1000;")
                await cur.execute(f"""
                    SELECT 
                        id,
                        content,
                        meta_data,
                        1.0 - (embedding <=> '{random_embedding}') as adjusted_distance
                    FROM public.chunk_openai_3072_vectors
                    WHERE collection_name in ({collections_clause})
                        AND (embedding <=> '{random_embedding}') <= 0.999999
                    ORDER BY (embedding <=> '{random_embedding}')
                    LIMIT 125;
                """)
                await cur.fetchall()
                await cur.execute("SET jit = on;")
                end_time = time.perf_counter()
                results.append(end_time - start_time)

    # 在 Windows 上使用 ProactorEventLoop
    if sys.platform.startswith('win'):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    # 執行非同步程式
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        results = loop.run_until_complete(execute_vector_speedtest())
        result_queue.put({"status": "success", "data": results})
    except Exception as ex:
        logger.error(f"run_speedtest_async error: {ex}",exc_info=True)
        result_queue.put({"status": "error", "message": str(ex)})
    finally:
        loop.close()

@app.route("/ava/api/vector/search",methods=["POST"])
def vector_similarality_search():
    try:
        json_body = request.get_json()
        expert_id = json_body.get("expert_id")
        if not expert_id:
            return jsonify({"status": "fail", "code": 400, "message": "expert_id is not set"})
        query = json_body.get("query")
        if not query:
            return jsonify({"status": "fail", "code": 400, "message": "query is not set"})
        with session_scope(session_maker) as _session:
            row_expert: Expert_Schema | None = select_expert_from_id(expert_id=expert_id,session=_session)
            if not row_expert:
                return jsonify({"status": "fail", "code": 400, "message": f"expert_id:{expert_id} not found"})
            sql = _session.execute(text(f"""
                select d.folder_name from expert_datasets_mapping edm
                join datasets d on edm.datasets_id = d.id 
                where expert_id = '{expert_id}'
            """))
            folder_names = sql.scalars().all()
            if not folder_names:
                return jsonify({"status": "fail", "code": 400, "message": f"empty folder_names from expert_id:{expert_id}"})
            expert_model_config = load_expert_model_config(expert_id=expert_id)
            expert_score_threshold = get_search_kwargs_or_default(expert_model_config["search"], "score_threshold")
            k = get_search_kwargs_or_default(expert_model_config["search"], "k")
            datasets:list[DataSet] = get_datasets(expert_id=expert_id,session=_session)
            if not datasets:
                return jsonify({"status": "fail", "code": 400, "message": f"empty datasets from expert_id:{expert_id}"})
            collections_limits:list[CollectionLimit] =[
                CollectionLimit(collection_name=dataset.folder_name,
                    limit=dataset.config_jsonb['search_kwargs'].get("k", k)*5,
                    score_threshold=max(
                        dataset.config_jsonb['search_kwargs'].get("score_threshold", 0.3) or 0.3,
                        expert_score_threshold),
                    priority=dataset.config_jsonb.get('sort_priority',5)
                ) for dataset in datasets
            ]
            embedding_model = app.config["EMBEDDING_MODEL"]
            cache_key: str = f"{query}_{embedding_model}"
            cache_client: RedisEmbeddingCache = RedisEmbeddingCache(redis_client=get_redis_client_with_retry())
            cache_embedding: list[float] | None = cache_client.get_embedding_cache(cache_key)
            if not cache_embedding:
                get_embedding: Iterator = get_openai_embeddings([query], embedding_model)
                query_embedding: list[float] = next(get_embedding)
                cache_client.set_embedding_cache(cache_key, query_embedding)
            else:
                query_embedding = cache_embedding
            collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                        collection_name=datasets[0].folder_name, embedding_model=embedding_model,collection_class=BaseEmbeddingItem)
            child_nodes_iter: Iterator[SearchContentDocument] = collection.search_embedding_by_score_threshold(
                                collections_limits=collections_limits,
                                query_embedding=query_embedding
                            )
            parent_node_docs:list[SearchContentDocument] = []
            all_child_docs:list[SearchContentDocument] = []
            BATCH_SIZE = 1000
            while True:
                try:
                    batch_child_nodes = list(islice(child_nodes_iter, BATCH_SIZE))
                    all_child_docs.extend(batch_child_nodes)
                except Exception as e:
                    logger.error(f"Failed to get batch_child_nodes: {e}")
                    break
                if not batch_child_nodes:
                    break
                
                batch_parent_ids:list[int] = []
                parent_id_to_max_score: dict[int, float] = {}

                for child_node in batch_child_nodes:
                    parent_id = int(child_node.metadata["parent_node"])
                    batch_parent_ids.append(parent_id)
                    current_max_score: float = parent_id_to_max_score.get(parent_id, 0.0)
                    parent_id_to_max_score[parent_id] = max(current_max_score, child_node.score)
                    
                parent_chunks: Sequence[ParentChunks_Schema] = select_parent_chunks_from_ids(list(set(batch_parent_ids)), _session)
                hash_set =set()
                for parent in parent_chunks:
                    content_hash = hashlib.md5(parent.page_content.encode()).hexdigest()
                    if content_hash not in hash_set:
                        hash_set.add(content_hash)
                        parent_node_docs.append(
                            SearchContentDocument(
                                metadata=parent.meta_data,
                                content=parent.page_content,
                                id=str(parent.id),
                                score=parent_id_to_max_score.get(parent.id,0.0)
                            )
                        ) 
            parent_node_docs.sort(key=lambda x: x.score, reverse=True)
            all_child_docs.sort(key=lambda x: x.score, reverse=True)
            if isinstance(row_expert.config_jsonb,dict):
                expert_config_json:dict = row_expert.config_jsonb
            elif isinstance(row_expert.config_jsonb,str):
                expert_config_json:dict = json.loads(row_expert.config_jsonb)
            priority_setting = expert_config_json.get("dataset_priority_setting",None)
            if priority_setting  is not None:
                dataset_rank_docs: list[SearchContentDocument] = []
                datasets_level_map = {}
                
                # 創建資料集優先級對應表
                for dataset in datasets:
                    dataset_priority = int(dataset.config_jsonb.get("sort_priority", 5))
                    datasets_level_map[dataset.datasets_id] = dataset_priority
                
                candidate_num = 0
                
                # 根據設定比例進行篩選
                for level, proportion in enumerate(priority_setting, 1):
                    if candidate_num >= k:  # 如果已經達到候選文件的目標數量，則終止外層循環
                        break
                    
                    _num = int(k * proportion)
                    expect_num = _num + 1 if _num != int(_num) else _num  # 無條件進位
                    target_level_datasets = [dataset_id for dataset_id in datasets_level_map if datasets_level_map[dataset_id] == level]

                    subrank_docs = []
                    
                    for dataset_id in target_level_datasets:
                        if candidate_num >= k:  # 如果已經達到候選文件的目標數量，則終止內層循環
                            break
                        
                        # 篩選符合資料集ID的文檔
                        docs_from_dataset = [doc for doc in parent_node_docs if doc.metadata.get("datasets_id") == dataset_id]
                        docs_from_dataset = sorted(docs_from_dataset, key=lambda x: x.score, reverse=True)

                        for _doc in docs_from_dataset:
                            if candidate_num >= expect_num or candidate_num >= k:
                                break
                            subrank_docs.append(_doc)
                            candidate_num += 1
                    
                    dataset_rank_docs.extend(subrank_docs)
                
                # 檢查是否達到 k 個文件
                if candidate_num < k:
                    # 從剩餘的 parent_chunks 裡補足文件
                    remaining_docs = [doc for doc in parent_node_docs if doc not in dataset_rank_docs]
                    remaining_docs = sorted(remaining_docs, key=lambda x: x.score, reverse=True)
                    
                    # 遞補文件直到達到 k
                    for _doc in remaining_docs:
                        if candidate_num >= k:
                            break
                        dataset_rank_docs.append(_doc)
                        candidate_num += 1
                
                result_docs = dataset_rank_docs
            else:
                result_docs: list[SearchContentDocument] = parent_node_docs[:k]
            serialized_child_docs = [
                {
                    "content": doc.content,
                    "metadata": doc.metadata,
                    "score": doc.score
                } for doc in all_child_docs[:30]
            ]
            
            serialized_result_docs = [
                {
                    "content": doc.content, 
                    "metadata": doc.metadata,
                    "score": doc.score
                } for doc in result_docs
            ]
            source_chunks: list[dict[str, Any]] = []
            link_chunk_level = int(expert_config_json.get("link_chunk_level",0))
            for doc in result_docs:
                obj: dict[str, Any] = {"target": doc.model_dump()}
                
                prev_chunks = get_chunks_with_levels(doc.metadata.get("prev_node"), "prev_node", link_chunk_level)
                next_chunks = get_chunks_with_levels(doc.metadata.get("next_node"), "next_node", link_chunk_level)

                obj["prev"] = prev_chunks
                obj["next"] = next_chunks

                source_chunks.append(obj)
            def contact_and_remove_duplicates(source_chunks: list[dict[str, Any]]) -> tuple[dict[Any, Any], dict[Any, Any],dict[str,Any]]:
                hash_set = set()
                chunk_map = {}
                chunk_content = {}
                original_chunks = {}
                for chunk in source_chunks:
                    _inner_content = ""

                    for prev_chunk in chunk["prev"]:
                        chunk_content[prev_chunk["id"]] = prev_chunk["content"]
                        if prev_chunk["id"] not in original_chunks:
                            original_chunks[prev_chunk["id"]] = prev_chunk
                            original_chunks[prev_chunk["id"]]["is_target"] = False
                        _inner_content += f"\n{prev_chunk['content']}"
                    
                    _inner_content += f"\n{chunk['target']['content']}"
                    
                    for next_chunk in chunk["next"]:
                        chunk_content[next_chunk["id"]] = next_chunk["content"]
                        if next_chunk["id"] not in original_chunks:
                            original_chunks[next_chunk["id"]] = next_chunk
                            original_chunks[next_chunk["id"]]["is_target"] = False
                        _inner_content += f"\n{next_chunk['content']}\n"

                    _inner_content += "======"

                    chunk_content[chunk["target"]["id"]] = chunk["target"]["content"]
                    content_hash = hashlib.md5(_inner_content.encode()).hexdigest()

                    if (content_hash,chunk["target"]["metadata"]["datasets_id"],chunk["target"]["metadata"]["filename"]) not in hash_set:
                        hash_set.add((content_hash,chunk["target"]["metadata"]["datasets_id"],chunk["target"]["metadata"]["filename"]))
                        chunk_map[chunk["target"]["id"]] = chunk  # 只存儲 target 節點
                        original_chunks[chunk["target"]["id"]] = chunk["target"]
                        original_chunks[chunk["target"]["id"]]["is_target"] = True

                return chunk_content, chunk_map,original_chunks
            chunk_context_map, chunk_map,origin_chunk_map = contact_and_remove_duplicates(source_chunks)
            def build_chunk_graph(chunk_map: dict[str, Any]) -> dict[str, Any]:
                graph: dict[str, Any] = {}

                # 初始化所有 target 節點
                for chunk_id, chunk in chunk_map.items():
                    graph[chunk_id] = []

                for chunk_id, chunk in chunk_map.items():
                    # 處理 next 節點
                    for next_chunk in chunk.get("next", []):
                        next_id = next_chunk.get("id")
                        if next_id not in graph:
                            graph[next_id] = []
                        if next_id not in graph[chunk_id]:
                            graph[chunk_id].append(next_id)
                        if chunk_id not in graph[next_id]:
                            graph[next_id].append(chunk_id)

                    # 處理 prev 節點
                    for prev_chunk in chunk.get("prev", []):
                        prev_id = prev_chunk.get("id")
                        if prev_id not in graph:
                            graph[prev_id] = []
                        if chunk_id not in graph[prev_id]:
                            graph[prev_id].append(chunk_id)
                        if prev_id not in graph[chunk_id]:
                            graph[chunk_id].append(prev_id)

                return graph
            graph = build_chunk_graph(chunk_map)
            def find_connected_components(graph: dict[str, Any],chunk_map:dict[str,Any],chunk_level:int):
                visited = set()
                components = []

                # DFS 查找所有連通分量
                def dfs(node, component):
                    stack = [node]
                    while stack:
                        current = stack.pop()
                        if current not in visited:
                            visited.add(current)
                            component.append(current)
                            for neighbor in graph[current]:
                                if neighbor not in visited:
                                    stack.append(neighbor)
                sorted_nodes = sorted(graph.keys(), key=lambda x: int(x))
                for node in sorted_nodes:
                    if node not in visited:
                        component = []
                        dfs(node, component)
                        components.append(component)
                if chunk_level == 0:
                    merged_components = []
                    current_component = []
                    for component in components:
                        if not current_component:
                            current_component = component
                        else:
                            current_metadata = chunk_map[current_component[-1]]["target"]["metadata"]
                            new_metadata = chunk_map[component[0]]["target"]["metadata"]
                            if int(component[0]) - int(current_component[-1]) == 1 and current_metadata["datasets_id"] == new_metadata["datasets_id"] and current_metadata["filename"] == new_metadata["filename"]:
                                current_component.extend(component)
                            else:
                                merged_components.append(current_component)
                                current_component = component
                    if current_component:
                        merged_components.append(current_component)
                    return merged_components
                else:
                    return components
            connected_components = find_connected_components(graph,chunk_map,link_chunk_level)
            _file_connected_components = defaultdict(list)
            distinct_dataset_ids = {chunk.metadata['datasets_id'] for chunk in result_docs}
            row_dataset_dict = {dataset_id : select_datasets_from_id(datasets_id=dataset_id,session=_session) for dataset_id in distinct_dataset_ids}
            for file_level_component in connected_components:
                sorted_chunk_ids = sorted(file_level_component)
                _connected_chunks=[origin_chunk_map[chunk_id] for chunk_id in sorted_chunk_ids]
                if _connected_chunks:
                    for doc in _connected_chunks:
                        is_downloadable:bool = True          
                        if (row_dataset := row_dataset_dict.get(_connected_chunks[0]['metadata']['datasets_id'])) :
                            is_downloadable = row_dataset.config_jsonb.get("is_downloadable",True)       
                            doc['metadata']["is_downloadable"] = is_downloadable
                            doc['metadata']["datasets_name"] = row_dataset.name
                _file_connected_components[_connected_chunks[0]["metadata"]["filename"]].append(_connected_chunks)
            context = ["<context>\n"]
            def get_update_time(chunk_list):
                # 取得第一個 chunk 的 update_time
                first_chunk = chunk_list[0][0]
                update_time_str = first_chunk['metadata'].get('updated_at', '')
                if not update_time_str:
                    return datetime.min  # 如果沒有時間戳，排在最後
                try:
                    return datetime.strptime(update_time_str, '%Y-%m-%d')
                except ValueError:
                    return datetime.min  # 如果日期格式錯誤，排在最後
            _source_chunks =list(_file_connected_components.values())
            for _chunks in _source_chunks:
                _chunks.sort(key=lambda c : int(c[0]["id"]))
            _source_chunks.sort(key=get_update_time, reverse=True)
            for index,file_level_component in enumerate(_source_chunks,start=1):
                file_level_contnets = []
                block_tag_description = ""
                _crawler_title = file_level_component[0][0]['metadata'].get("crawler_title", None)
                _crawler_id = file_level_component[0][0]['metadata'].get("crawler_id",None) # 相容舊版的 chunk
                is_crawler_chunks: bool = file_level_component[0][0]['metadata'].get("chunk_type",'') == "crawler"
                _datasource_name = file_level_component[0][0]['metadata'].get("datasource_name", None)
                _datasource_url = file_level_component[0][0]['metadata'].get("datasource_url", None)
                _update_time = file_level_component[0][0]['metadata'].get("updated_at", None)
                final_apply_datasource_url = ""
                concat_datasource_str= ""
                if is_crawler_chunks:
                    if _crawler_title is None:
                        _row_crawler: Crawler_Schema | None = select_crawler_by_id(crawler_id=_crawler_id,session=_session)
                        assert _row_crawler, f"crawler_id: {_crawler_id} not found"
                        _crawler_title  =_row_crawler.title
                    concat_datasource_str = f"{_crawler_title}-{_datasource_name}" if _datasource_name else ""
                    final_apply_datasource_url = f'url="{_datasource_url}"'
                else:
                    if _datasource_name :
                        concat_datasource_str=_datasource_name
                    else:
                        concat_datasource_str = file_level_component[0][0]['metadata']['originalname']
                    if _datasource_url:
                        final_apply_datasource_url = _datasource_url
                    else:
                        if file_level_component[0][0]['metadata'].get("is_downloadable", True):
                            ava_host =  getenv("AVA_HOST")
                            if ava_host :
                                originalname:str = file_level_component[0][0]['metadata'].get('originalname',"")
                                filename :str= file_level_component[0][0]['metadata'].get('filename',"")
                                original_extension = originalname.split(".")[-1] if "." in originalname else ""
                                base_filename = ".".join(filename.split(".")[:-1]) if "." in filename else filename
                                final_apply_datasource_url = f'url="{ava_host}/ava/backend/download/{base_filename}.{original_extension}"'
                            else:
                                final_apply_datasource_url=""
                        else:
                            final_apply_datasource_url=""
                for connected_component in file_level_component:
                    for chunk in connected_component:
                        if (extra_ids:=chunk["metadata"].get("crawler_documents_extra_ids",[])):
                            for extra_id in extra_ids:
                                extra_chunk = select_crawler_documents_extra_from_id(crawler_documents_extra_id=extra_id,session=_session)
                                assert extra_chunk, f"extra_chunk not found, extra_id: {extra_id}"
                                file_level_contnets.append(extra_chunk.extra_text)
                                file_level_contnets.append("\n")
                        file_level_contnets.append(chunk_context_map[chunk["id"]])
                        file_level_contnets.append("...\n")
                block_tag_description = f'\n<block id={index} {final_apply_datasource_url} update_time="{_update_time}">\n{concat_datasource_str}\n{"\n".join(file_level_contnets)}\n</block>\n'
                context.append(block_tag_description)
            context.append("</context>\n")
            return jsonify({"status": "success", "child_docs": serialized_child_docs, "parent_docs": serialized_result_docs,"source_chunks":_source_chunks,"context":context})
    except Exception as ex:
        logger.error(f"vector_similar error: {ex}",exc_info=True)
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})

def get_chunks_with_levels(node_id, direction, levels):
    """
        Directly copy from Knowledge.py, it should be a util function.
    """
    chunks = []
    current_level = 0
    with session_scope(session_maker) as _session:
        while node_id and current_level < levels:
            # 查詢當前 node 的父節點或子節點
            _node: ParentChunks_Schema = select_parent_chunk_from_id(node_id=node_id,session=_session)
            
            # 構建 chunk 物件並加入結果集
            chunk = EmbeddingDocument(
                metadata=_node.meta_data, 
                content=_node.page_content,
                id=str(_node.id)
            ).model_dump()
            chunks.append(chunk)
            
            # 更新 node_id，根據方向查詢下一個節點（prev_node 或 next_node）
            node_id = chunk["metadata"].get(direction)
            
            # 遞增當前層級
            current_level += 1
    return chunks

@app.route("/ava/api/vector/word2vector",methods=["POST"])
def word_to_vector():
    try:
        json_body = request.get_json()
        word = json_body.get("word")
        if not word:
            return jsonify({"status": "fail", "code": 400, "message": "must set word"})
        embedding_model = json_body.get("embedding_model",app.config["EMBEDDING_MODEL"])
        cache_key: str = f"{word}_{embedding_model}"
        cache_client: RedisEmbeddingCache = RedisEmbeddingCache(
                redis_client=get_redis_client_with_retry())
        cache_embedding: list[
            float] | None = cache_client.get_embedding_cache(cache_key)
        if not cache_embedding:
            get_embedding: Iterator = get_openai_embeddings(
                [word], embedding_model)
            query_embedding: list[float] = next(get_embedding)
            cache_client.set_embedding_cache(cache_key, query_embedding)
            return jsonify({"status": "success", "query": word,"embedding":query_embedding})
        return jsonify({"status": "success", "query": word,"embedding":cache_embedding})
    except Exception as ex:
        logger.error(f"word_to_vector error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    
@app.route("/ava/api/vector/query", methods=["POST"])
def execute_vector_db_query():
    json_body = request.get_json()
    query_text = json_body.get("query")
    if not query_text:
        return jsonify({"status": "fail", "code": 400, "message": "query is not set"})

    try:
        with session_scope(vector_session_maker) as _session:
            query = _session.execute(text(query_text))

            if query.returns_rows:  # 確保查詢有返回行
                columns = query.keys()  # 取得欄位名稱
                result = [dict(zip(columns, row)) for row in query.fetchall()]  # 轉成字典
                return jsonify({"status": "success", "data": result})
            else:
                return jsonify({"status": "success", "message": "Query executed successfully"})

    except Exception as ex:
        logger.error(f"Vector query error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})

@app.route("/ava/api/vector/speedtest",methods=["POST"])
def vector_speedtest():
    """向量資料庫壓測 API"""
    json_body = request.get_json()
    expert_id = json_body.get("expert_id")
    if not expert_id:
        return jsonify({"status": "fail", "code": 400, "message": "expert_id is not set"})
        
    # 獲取資料集名稱列表
    with session_scope(session_maker) as _session:
        query = _session.execute(text(f"""
            select d.folder_name from expert_datasets_mapping edm
            join datasets d on edm.datasets_id = d.id 
            where expert_id = '{expert_id}'
        """))
        folder_names = query.scalars().all()
    
    try:
        # 設定測試參數
        duration = int(json_body.get("d", 30))
        concurrent = int(json_body.get("c", 5))
        
        # 使用 Queue 來獲取非同步執行結果
        result_queue = Queue()
        
        # 在新的執行緒中執行壓測
        thread = threading.Thread(
            target=run_speedtest_async,
            args=(duration, concurrent, result_queue, folder_names)
        )
        thread.start()
        thread.join()  # 等待執行完成
        
        # 獲取結果
        result = result_queue.get()
        if result["status"] == "error":
            raise Exception(result["message"])
            
        return jsonify({
            "status": "success",
            "code": 200,
            "data": {
                "folder_names": folder_names,
                "speedtest_results": result["data"]
            },
            "message": "Speedtest completed successfully"
        })
        
    except Exception as ex:
        logger.error(f"Vector speedtest error: {ex}",exc_info=True)
        return jsonify({
            "status": "fail", 
            "code": 500,
            "message": f"Error during speedtest: {str(ex)}"
        })

@app.route("/ava/api", methods=["POST"])
@API_EXECUTION_TIME_HISTOGRAM.time()  # 追蹤 API 執行時間
def api():
    API_REQUEST_COUNTER.inc()  # 增加 API 呼叫次數
    cookies = request.cookies
    logger.info(f"Received cookies:{cookies}")  
    client_ip = g.get('client_ip')
    current_user = session.get("user_info")
    if not current_user:
        return jsonify({"status": "fail", "code": 400, "message": "no login user_info"})
    user,error_message = get_user(current_user)
    if error_message:
        return jsonify({"status": "fail", "code": 500, "message": error_message})

    if user and "uid" in request.values:
        user.uid = request.values["uid"]
    user.cookies = cookies
    
    user.client_ip = client_ip
    logger.debug("csc_cookie: " + str(user.get_cookie("csc")))
    logger.debug(f"/api user_info:{user.userNo}")
    model = ""
    chat_uuid = str(uuid.uuid4())  # 生成 UUID
    @copy_current_request_context
    def generate_sse(input_message, return_body,history_message_id,record_model_params,handler):
        output = []
        for b in return_body:
            output.append(b)
            yield b

        if model == "ERROR":
            type = insert_history_message_type.ERROR
        elif model == "NOANSWER":
            type = insert_history_message_type.NOANSWER
        else:
            type = insert_history_message_type.OK
        with session_scope(session_maker) as _session:
            insert_history_message(
                history_message_id=history_message_id,
                input_message=input_message if isinstance(input_message,str) else json.dumps(input_message,default=lambda x : "Searialization error", ensure_ascii=False),
                output_message=json.dumps(output,default=lambda x : "Searialization error", ensure_ascii=False),
                expert_id=expert_id, #type: ignore
                users_id=user.uid,
                type=type,
                model_name=model,
                link_level=link_level,model_params=record_model_params,
                device=device,session=_session
            )
    @copy_current_request_context
    def save_output_content(history_message_id,return_body, streaming, context_output,
                            is_text_input, input_message, datasource):
        try:
            yield json.dumps({"type":"hmi"})
            yield "</end>"
            yield history_message_id
            yield "</end>"
            if isinstance(input_message, str):
                if streaming:
                    logger.debug("is streaming")
                    yield json.dumps({"type": "data"})
                    yield "</end>"
                    for content in return_body:
                        yield content  # 向前端发送每个 chunk 的内容
                    next(return_body, None)
                    yield json.dumps({
                        "type": "context",
                        "data": context_output
                    })
                    yield "</end>"
                else:
                    logger.debug("not streaming")
                    if isinstance(return_body, str):
                        logger.debug("isinstance str")
                        if is_text_input:
                            yield json.dumps({"type": "data"})
                            yield "</end>"
                        yield return_body + "</end>"
                    elif isinstance(return_body, list):  # card
                        logger.debug("isinstance list")
                        for data_block in return_body:
                            logger.debug(f"isinstance data_block: {data_block}")
                            if isinstance(data_block, str):
                                yield json.dumps({"type": "data"})
                                yield "</end>"
                                result = data_block
                            else:
                                result = json.dumps(data_block, ensure_ascii=False)
                            logger.debug(f"result: {result}")
                            yield result
                            yield "</end>"
                    elif isinstance(return_body, dict):
                        logger.debug("isinstance dict")
                        result = json.dumps(return_body, ensure_ascii=False)
                        logger.debug(f"result: {result}")
                        yield result + "</end>"
            else:
                yield from return_body
        except Exception as ex:
            logger.error(f"save_output_content error: {ex}")
            yield error_msg(str(ex))

    context = []
    logger.info(f"request.values['message']:{request.values['message']}")
    message = json.loads(request.values["message"])
    scope_datasets = message.get("scope_datasets",None)
    logger.debug("Step 0 : get history_message_id")
    logger.debug("Step 0.1: about to call session_maker()")
    try:
        with session_scope(session_maker) as _session:
            logger.debug("Step 0.2: session_maker() called successfully")
            history_message_id = str(get_history_message_nextval(session=_session))
            logger.debug(f"Step 0.3: get_history_message_nextval returned {history_message_id}")
    except Exception as ex:
        logger.error(f"get_history_message_nextval error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    logger.debug("Step 1 : extract message body",extra={"history_message_id":history_message_id})
    expert_id = request.values.get("expert_id",default=None)
    device = request.values.get("device",default=None)
    if "context" in request.values:
        context = json.loads(request.values["context"])
    logger.info(f"context:{context}")
    assert expert_id, "expert_id is not set"
    logger.debug("Step 2 : select specific expert",extra={"history_message_id":history_message_id,"expert_id":expert_id})
    with session_scope(session_maker) as _session:
        row_expert: Expert_Schema | None = select_expert_from_id(expert_id=expert_id,session=_session)
        assert row_expert
        if isinstance(row_expert.config_jsonb,dict):
            expert_config_json:dict = row_expert.config_jsonb
        elif isinstance(row_expert.config_jsonb,str):
            expert_config_json:dict = json.loads(row_expert.config_jsonb)
    logger.debug("Step 3 : get expert config",extra={"history_message_id":history_message_id,"expert_id":expert_id})
    link_level = expert_config_json.get("link_chunk_level",0)
    input_message = message.get("data",None)
    is_stream = message.get("stream", True)
    logger.debug("Step 4 : determine input message type",extra={"history_message_id":history_message_id,"input_message":input_message,"is_stream":is_stream,"message_type":message.get("type")})
    if message.get("type") == "form":
        SKILL_COMPLATE_COUNTER.inc()  # 計算技能完成次數
        if (next_skill_class_name:=input_message.get("next_skill",None)) is not None:
            skill_path = env_utils.get_key("SKILL_PATH")
            assert skill_path
            # TODO:中冠目前沒有用到這個地方，但要記得skill_path要調整成中冠
            module_name = f"ava.handlers.skills.{skill_path}.{next_skill_class_name}"
            module = importlib.import_module(module_name)
            next_skill_class = getattr(module, next_skill_class_name)
            next_skill_instance = next_skill_class()
            handle_result = next_skill_instance.handle(input_message,user)
            if not isinstance(input_message,str):
                input_message = json.dumps(input_message, ensure_ascii=False)
            with session_scope(session_maker) as _session:
                insert_history_message(
                    history_message_id=int(history_message_id),
                input_message=input_message, #type: ignore
                output_message=json.dumps(handle_result,default=lambda x : "Searialization error", ensure_ascii=False),
                expert_id=expert_id, #type: ignore
                users_id=user.uid,
                type=insert_history_message_type.SKILL,
                model_name=next_skill_class_name,
                link_level=link_level,
                device=device,session=_session
            )
            return Response(
                (f"{json.dumps(i, ensure_ascii=False)}</end>" for i in handle_result),
                content_type="text/event-stream; charset=utf-8",
            )
        else:
            input_message = get_form(message)
            logger.info(f"/api input_message:{input_message}")
    elif message.get("type") == "question":
        # 已棄用
        USER_QUESTION_COUNTER.inc()  # 計算問題提出次數
        qa_id = message["data"]["qa_id"]
        qa_type = message["data"]["qa_type"]
        input_message = (qa_id, qa_type)
        logger.info(f"/api input_message:{input_message}")
    elif message.get("type") == "tunnel":
        user_input = message["input_message"]
        logger.info(f"/api input_message:{user_input}")
        if (tunnel_type := message.get("tunnel_type","form")) == "form":
            TUNNEL_TRIGGER_COUNTER.inc()
            agent = TunnelFormAgent(message,user,expert_id,chat_uuid,session_maker) #type: ignore
            response_result:Any
            try:
                tunnel_result: dict[str, Any] | None = agent.handle_tunnel()
            except Exception as ex:
                TUNNEL_PROCESS_ERROR_COUNTER.inc()
                response_result = {"hmi":history_message_id,"state": "error", "return_message": f"發生錯誤，若有問題請聯繫管理員\n詳細原因:{str(ex)}"}
                return Response(
                    generate_tunnel_error_sse(str(ex),{"hmi":history_message_id,"state": "error", "return_message": f"發生錯誤，若有問題請聯繫管理員\n詳細原因:{str(ex)}"}),
                    content_type="text/event-stream",
                )
            else:
                response_result = tunnel_result
                response_result["hmi"] = history_message_id
                TUNNEL_GENERAL_SUCCESS_COUNTER.inc()
                return Response(
                    generate_tunnel_sse(response_result),
                    content_type="text/event-stream",
                )
            finally:
                if not isinstance(user_input,str):
                    user_input = json.dumps(user_input, ensure_ascii=False)
                with session_scope(session_maker) as _session:
                    insert_history_message(
                        history_message_id=int(history_message_id),
                        input_message=user_input, #type: ignore
                        output_message=json.dumps(response_result,default=lambda x : "Searialization error", ensure_ascii=False),
                        expert_id=expert_id, #type: ignore
                        users_id=user.uid,
                        type=insert_history_message_type.FORM,
                        model_name=agent.form_id,link_level=link_level,
                        device=device,session=_session
                    )
        elif tunnel_type == "skill":
            TUNNEL_SKILL_TRIGGER_COUNTER.inc()  # 隧道技能觸發次數計數
            agent = TunnelSkillAgent(message, user,cookies,session_maker)
            response_result: Any
            try:
                result: dict[str, Any] = agent.handle_tunnel()

            except MappingNotFoundException as ex:
                TUNNEL_MAPPING_ERROR_COUNTER.inc()  # 隧道映射錯誤計數
                response_result = {"hmi":history_message_id,"state": "error", "return_message": f"發生錯誤，若有問題請聯繫管理員\n詳細原因:{f'{ex.text} 不符合輸入規範，請依照目前支援的提示輸入'}"}
                return Response(
                    generate_tunnel_error_sse(
                        f"{ex.text} 不符合輸入規範，請依照目前支援的提示輸入",{
                            "hmi":history_message_id,"state": "error", 
                            "return_message": f"發生錯誤，若有問題請聯繫管理員\n詳細原因:{f'{ex.text} 不符合輸入規範，請依照目前支援的提示輸入'}"
                        }
                    ),
                    content_type="text/event-stream",
                )
            except Exception as ex:
                TUNNEL_GENERAL_ERROR_COUNTER.inc()  # 隧道一般錯誤計數
                response_result = {"hmi":history_message_id,"state": "error", "return_message": f"發生錯誤，若有問題請聯繫管理員\n詳細原因:{str(ex)}"}
                return Response(
                    generate_tunnel_error_sse(str(ex),{"hmi":history_message_id,"state": "error", "return_message": f"發生錯誤，若有問題請聯繫管理員\n詳細原因:{str(ex)}"}),
                    content_type="text/event-stream",
                )
            else:
                TUNNEL_SKILL_SUCCESS_COUNTER.inc()  # 隧道技能成功次數計數
                response_result = result
                response_result["hmi"] = history_message_id
                return Response(
                    generate_skill_tunnel_sse(response_result),
                    content_type="text/event-stream",
                )
            finally:
                if not isinstance(user_input, str):
                    user_input = json.dumps(user_input, ensure_ascii=False)
                with session_scope(session_maker) as _session:
                    insert_history_message(
                        history_message_id=int(history_message_id),
                        input_message=user_input,  # type: ignorepp step
                        output_message=json.dumps(
                            response_result, default=lambda x: "Searialization error", ensure_ascii=False),
                        expert_id=expert_id,  # type: ignore
                        users_id=user.uid,
                        type=insert_history_message_type.SKILL,
                        model_name=message["skill_id"],
                        link_level=link_level,
                        device=device,
                        session=_session
                    )
    elif message.get("type") == "document_qa_tunnel":
        state = message.get("state","")
        if state == "QA":
            user_input = message.get("input_message","")
        else:
            user_input = message.get("text","")

        try:
            expert_model_config = load_expert_model_config(expert_id=expert_id)
            llm_model_vendor = expert_model_config["search"]["vendor"]
            llm_model_name = expert_model_config["search"]["model"]
            llm_model_list_id = expert_model_config["search"]["model_list_id"]
            llm_system_prompt = expert_model_config["search"]['params']["system_prompt"]
            expert_data = {
                "expert_id": expert_id,
                "expert_model": "",
                "expert_model_type": 3,
            }

            model_params = {
                "max_tokens": expert_model_config["search"]["params"]["max_tokens"] or 16000,
                "temperature": expert_model_config["search"]["params"]["temperature"] or 0,
                "top_p": expert_model_config["search"]["params"]["top_p"] or 1,
                "frequency_penalty": expert_model_config["search"]["params"]["frequency_penalty"] or 0,
            }

            try:
                llm_model_list_id = int(llm_model_list_id)
            except (ValueError, TypeError):
                raise ValueError(f"The value of llm_model_list_id cannot be converted to an integer: {llm_model_list_id}")

            if llm_model_vendor == "google":
                llm_model_name = llm_model_name if llm_model_name else "models/gemini-2.5-pro-preview-03-25"
                agent = GeminiDocumentsAgent()
            elif llm_model_vendor == "openai":
                agent = GPTHandler(api_key=env_utils.get_openai_key())
            elif llm_model_vendor in ["azure", "caf-azure"]:
                agent = AzureDocumentsAgent()
            elif llm_model_vendor == "local":
                expert_llm_params = expert_model_config["search"]["params"]
                base_url = expert_llm_params.get("base_url")
                api_key = expert_llm_params.get("api_key")
                max_tokens = expert_llm_params.get("max_tokens")
                extra_body = expert_llm_params.get("extra_body")
                assert base_url, "documents_agent local model base_url is not set"
                if api_key:
                    api_key = api_key
                else:
                    api_key = "LOCAL"
                if max_tokens:
                    model_params["max_tokens"] = max_tokens
                if extra_body:
                    model_params["extra_body"] = extra_body
                agent = GPTHandler(api_key=api_key,base_url=base_url)                
            else:
                raise ValueError(f"Unsupported LLM model vendor: {llm_model_vendor}")

            def streaming_generator():
                insert_type = insert_history_message_type.OK
                content_collector = []

                with session_scope(session_maker) as _session:
                    original_generator = agent.handle(
                        session=_session,
                        chat_uuid=chat_uuid,
                        user=user,
                        message_data=message.get("data",[]),
                        user_input=user_input,
                        expert_data=expert_data,
                        model_list_id=llm_model_list_id,
                        model_name=llm_model_name,
                        history_message_id=history_message_id, 
                        expert_system_prompt=llm_system_prompt,
                        model_params=model_params
                    )

                    try:
                        for item in original_generator:
                            content_collector.append(item)
                            yield item
                    except Exception as ex:
                        logger.error(f"streaming_generator error: {ex}")
                        insert_type = insert_history_message_type.ERROR
                    finally:
                        try:
                            if not isinstance(user_input, str):
                                user_input_str = json.dumps(user_input, ensure_ascii=False)
                            else:
                                user_input_str = user_input

                            # 替換 hmi 對應的數字
                            for idx, item in enumerate(content_collector):
                                if item == "{\"type\": \"hmi\"}":
                                    if idx + 2 < len(content_collector) and content_collector[idx + 1] == "</end>":
                                        content_collector[idx + 2] = str(history_message_id)
                                    break

                            with session_scope(session_maker) as _session:
                                insert_history_message(
                                    history_message_id=int(history_message_id),
                                    input_message=user_input_str,
                                    output_message=json.dumps(content_collector, default=lambda x: "Serialization error", ensure_ascii=False),
                                    expert_id=expert_id,
                                    users_id=user.uid,
                                    type=insert_type,
                                    model_name="gemini-2.0-flash",
                                    link_level=link_level,
                                    device=device,
                                    session=_session
                                )
                        except Exception as ex:
                            logger.error(f"save_history error: {ex}")
            return Response(
                streaming_generator(),
                content_type="text/event-stream",
            )
                
        except Exception as ex:
            logger.error(f"documents_agent error: {ex}")
            response_result = {"hmi":history_message_id,"state": "error", "return_message": f"發生錯誤，若有問題請聯繫管理員。"}

            with session_scope(session_maker) as _session:
                if not isinstance(user_input, str):
                    user_input_str = json.dumps(user_input, ensure_ascii=False)
                else:
                    user_input_str = user_input
                    
                insert_history_message(
                    history_message_id=int(history_message_id),
                    input_message=user_input_str,
                    output_message=json.dumps(response_result, default=lambda x: "Serialization error", ensure_ascii=False),
                    expert_id=expert_id,
                    users_id=user.uid,
                    type=insert_history_message_type.ERROR,
                    model_name="gemini-2.0-flash",
                    link_level=link_level,
                    device=device,
                    session=_session
                )
                
            return Response(
                generate_tunnel_error_sse(str(ex),{"hmi":"-1","state": "error", "return_message": f"發生錯誤，若有問題請聯繫管理員\n詳細原因:{str(ex)}"}),
                content_type="text/event-stream",
            )

    is_text_input = message.get("type") == "text"
    if isinstance(context, str):
        context = json.loads(context)
    try:
        logger.debug("Step 5 : call bot",extra={ "history_message_id":history_message_id,"expert_id":expert_id,"is_stream":is_stream})
        (body, is_stream, datasource, model,is_cache,record_model_params),\
           handler = bot(history_message_id, chat_uuid, expert_id,user, input_message, context, 
                         scope_datasets, is_stream, cookies)
        if is_stream:
            logger.debug("Step 6 : is_stream save output content",extra={"history_message_id":history_message_id})
            API_SUCCESS_COUNTER.inc()  # 成功計數
            res = save_output_content(history_message_id,body, is_stream, context,
                                        is_text_input, input_message,
                                        datasource)
            logger.debug("Step 7 : generate sse",extra={"history_message_id":history_message_id})
            return Response(
                generate_sse(input_message,res,history_message_id,record_model_params,handler),
                content_type="text/event-stream",
            )
        else:
            logger.debug("Step 6 : not is_stream before save_output_content",extra={"history_message_id":history_message_id})
            if is_cache:
                assert isinstance(body,list)
                CACHE_HIT_COUNTER.inc()
                cache_id = body.pop(1) # 這是從 KnowledgeHandler 裡面是 cache 時的流程硬吐出來的，等流程重構要記得!!
            res = [ s for s in save_output_content(history_message_id,body, is_stream, context,
                    is_text_input, input_message, datasource)]
            logger.debug("Step 7 : not is_stream after save_output_content",extra={"history_message_id":history_message_id})
            outout_message = json.dumps(res,default=lambda x : "Searialization error", ensure_ascii=False)
            with session_scope(session_maker) as _session:
                if not is_cache :
                    insert_history_message(
                        history_message_id=int(history_message_id),
                        input_message=
                            input_message if isinstance(input_message, str) 
                            else json.dumps(input_message,default=lambda x : "Searialization error", ensure_ascii=False), #type: ignore
                        output_message=outout_message, 
                        expert_id=expert_id, #type: ignore
                        users_id=user.uid,
                        no_answer=model == "NOANSWER",
                        type= insert_history_message_type.ERROR if model == "ERROR" else insert_history_message_type.NOANSWER if model == "NOANSWER" else insert_history_message_type.OK,
                        model_name=model,
                        link_level=link_level,
                        model_params=record_model_params,
                        device=device,session=_session
                    )
                    logger.debug("Step 8 : insert_history_message end",extra={"history_message_id":history_message_id})
                else:
                    history_id: int = insert_history_message(
                        history_message_id=int(history_message_id),
                        input_message=input_message if isinstance(
                        input_message, str) else json.dumps(input_message,default=lambda x : "Searialization error", ensure_ascii=False), 
                        output_message=outout_message,
                        expert_id=expert_id,  #type: ignore
                        users_id=user.uid,
                        type=insert_history_message_type.CACHE,
                        model_name=model,
                        link_level=link_level,
                        model_params=record_model_params,
                        device=device,session=_session
                    )
                    logger.debug("Step 8 : insert_history_message end",extra={"history_message_id":history_message_id})
                    insert_cache_history(cache_id=cache_id,history_id=history_id,session=_session) #type: ignore
                    logger.debug("Step 9 : insert_cache_history end",extra={"history_message_id":history_message_id})
            API_SUCCESS_COUNTER.inc()  # 成功計數
            USER_QUESTION_COUNTER.inc()
            return "".join(res)
    except Exception as ex:
        API_ERROR_COUNTER.inc()  # API 內部錯誤計數
        logger.error(f"ava api error: {ex}")
        traceback.print_exc() 
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})

def filter_blank_fields(collect_fields: dict):
    fillter_array = [key for key, value in collect_fields.items() if value.get("value") == ""]
    if fillter_array :
        return fillter_array[0]
    else:
        return None

def generate_tunnel_error_sse(err_msg,err_result):
    yield json.dumps({"type": "tunnel"})
    yield "</end>"
    yield json.dumps(err_result, ensure_ascii=False)
    yield "</end>"
    yield json.dumps({"type":"hmi"})
    yield "</end>"
    yield err_result["hmi"]
    yield "</end>"
    yield json.dumps({"type": "data"})
    yield "</end>"
    yield error_msg(err_msg)
    yield "</end>"

def generate_tunnel_sse(form_result):
    yield json.dumps({"type": "tunnel"})
    yield "</end>"
    yield json.dumps(form_result, ensure_ascii=False)
    yield "</end>"
    result_message = form_result["return_message"]
    yield json.dumps({"type":"hmi"})
    yield "</end>"
    yield form_result["hmi"]
    yield "</end>"
    if isinstance(result_message,str):
        yield json.dumps({"type": "data"})
        yield "</end>"
        yield result_message
        yield "</end>"
    elif isinstance(result_message,list):
        yield json.dumps({"type":"html_json"})
        yield "</end>"
        yield json.dumps(result_message)
        yield "</end>"

def generate_skill_tunnel_sse(skill_result):
    yield json.dumps({"type": "tunnel"})
    yield "</end>"
    if skill_result["state"] == "filling":
        yield json.dumps(skill_result, ensure_ascii=False)
        yield "</end>"
        yield json.dumps({"type":"hmi"})
        yield "</end>"
        yield skill_result["hmi"]
        yield "</end>"
        yield json.dumps({"type": "data"})
        yield "</end>"
        yield skill_result["return_message"]
        yield "</end>"
        if ( button_tip :=skill_result.get("button_tip")) is not None:
            yield json.dumps({"type": "html_json"})
            yield "</end>"
            yield json.dumps(button_tip, ensure_ascii=False)
            yield "</end>"
    else:
        # 這邊就是技能已經送出的情況，為了怕自己改有問題，所以先抄上面的來用
        yield json.dumps({ "state": "aborted" })
        yield "</end>"
        yield json.dumps({"type": "hmi"})
        yield "</end>"
        yield skill_result["hmi"]
        yield "</end>"
        fill_records = skill_result["fill_records"]
        if fill_records:
            yield json.dumps({"type": "data"})
            yield "</end>"
            yield ' '.join([f'{success_msg(f'{key} : {value}')}' for key,value in fill_records.items()])
            yield "</end>"
        return_body = skill_result["skill_result"]
        if isinstance(return_body, str):
            yield json.dumps({"type": "data"})
            yield "</end>"
            yield return_body + "</end>"
        elif isinstance(return_body, list):  # card
            for data_block in return_body:
                if isinstance(data_block, str):
                    yield json.dumps({"type": "data"})
                    yield "</end>"
                    result = data_block
                else:
                    result = json.dumps(data_block, ensure_ascii=False)
                logger.debug(f"result: {result}")
                yield result
                yield "</end>"
        elif isinstance(return_body, dict):
            result = json.dumps(return_body, ensure_ascii=False)
            logger.debug(f"result: {result}")
            yield result + "</end>"


@app.route("/ava/api/disableCrawlerAttachmentContent",methods=["POST"])
def disable_crawler_attachment_content_api():
    try:
        data:dict[str,Any]= request.get_json()
        dataset_id = data.get("dataset_id",None)
        if not dataset_id:
            return jsonify({"status": "fail", "code": 400, "message": "dataset_id is None"})
        attachment_ids = data.get("crawler_attachment_ids",None)
        if not attachment_ids:
            return jsonify({"status": "fail", "code": 400, "message": "crawler_attachment_ids is None"})
        try:
            threading.Thread(target=disable_crawler_attachment_content,args=(dataset_id,attachment_ids,session_maker)).start()
            return jsonify({"status": "success", "code": 200, "message": "disableCrawlerAttachmentContent success"})
        except Exception as ex:
            logger.error(f"disableCrawlerAttachmentContent error: {ex}")
            return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    except Exception as ex:
        logger.error(f"disable_crawler_attachment_content_api error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    
@app.route("/ava/api/disableCrawlerAttachment",methods=["POST"])
def disable_crawler_attachment_api():
    try:
        data:dict[str,Any]= request.get_json()
        dataset_id = data.get("dataset_id",None)
        if not dataset_id:
            return jsonify({"status": "fail", "code": 400, "message": "dataset_id is None"})
        crawler_attachment_synchronize_ids = data.get("crawler_attachment_synchronize_ids",None)
        if not crawler_attachment_synchronize_ids:
            return jsonify({"status": "fail", "code": 400, "message": "crawler_attachment_ids is None"})
        try:
            threading.Thread(target=disable_crawler_attachment,args=(dataset_id,crawler_attachment_synchronize_ids,session_maker)).start()
            return jsonify({"status": "success", "code": 200, "message": "disableCrawlerAttachment success"})
        except Exception as ex:
            logger.error(f"disableCrawlerAttachment error: {ex}")
            return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    except Exception as ex:
        logger.error(f"disableCrawlerAttachment error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})

@app.route("/ava/api/disableCrawlerContent",methods=["POST"])
def disable_crawler_content_api():
    data:dict[str,Any]= request.get_json()
    dataset_id  = data.get("dataset_id",None)
    content_ids = data.get("crawler_document_content_ids",None)
    if not content_ids:
        return jsonify({"status": "fail", "code": 400, "message": "crawler_document_content_ids is None"})
    if not dataset_id:
        return jsonify({"status": "fail", "code": 400, "message": "dataset_id is None"})
    try:
        threading.Thread(target=disable_crawler_content,args=(dataset_id,content_ids,session_maker)).start()
        return jsonify({"status": "success", "code": 200, "message": "disableCrawlerContent success"})
    except Exception as ex:
        logger.error(f"disableCrawlerContent error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    
@app.route("/ava/api/removeCrawlerAttachment",methods=["POST"])
def remove_crawler_attachment_api():
    data:dict[str,Any]= request.get_json()
    dataset_id = data.get("dataset_id",None)
    if not dataset_id:
        return jsonify({"status": "fail", "code": 400, "message": "dataset_id is None"})
    attachment_ids = data.get("crawler_attachment_ids",None)
    if not attachment_ids:
        return jsonify({"status": "fail", "code": 400, "message": "crawler_attachment_ids is None"})
    try:
        threading.Thread(target=remove_crawler_attachment,args=(dataset_id,attachment_ids,session_maker)).start()
        return jsonify({"status": "success", "code": 200, "message": "removeCrawlerAttachment success"})
    except Exception as ex:
        logger.error(f"removeCrawlerAttachment error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})
        
@app.route("/ava/api/removeCrawlerContent", methods=["POST"])
def removeCrawlerDocumentComtent():
    data:dict[str,Any]= request.get_json()
    dataset_id  = data.get("dataset_id",None)
    crawler_document_ids = data.get("crawler_document_ids",None)
    if not crawler_document_ids:
        return jsonify({"status": "fail", "code": 400, "message": "crawler_document_ids is None"})
    try:
        threading.Thread(target=remove_crawler_document_content,args=(dataset_id,crawler_document_ids,session_maker)).start()
        return jsonify({"status": "success", "code": 200, "message": "removeCrawlerDocument success"})
    except Exception as ex:
        logger.error(f"removeCrawlerDocument error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    
@app.route("/ava/api/removeCrawlerDocument", methods=["POST"])
def removeCrawlerDocument():
    data:dict[str,Any]= request.get_json()
    dataset_id  = data.get("dataset_id",None)
    crawler_document_ids = data.get("crawler_document_ids",None)
    if not crawler_document_ids:
        return jsonify({"status": "fail", "code": 400, "message": "crawler_document_ids is None"})
    try:
        threading.Thread(target=remove_crawle_document,args=(dataset_id,crawler_document_ids,session_maker)).start()
        return jsonify({"status": "success", "code": 200, "message": "removeCrawlerDocument success"})
    except Exception as ex:
        logger.error(f"removeCrawlerDocument error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    
@app.route("/ava/api/disableCrawler",methods=["POST"])
def disable_crawler():
    data:dict[str,Any]= request.get_json()
    sync_ids = data.get("crawler_sync_ids",None)
    if not sync_ids:
        return jsonify({"status": "fail", "code": 400, "message": "crawler_sync_ids is None"})
    try:
        threading.Thread(target=disable_crawler_indexing,args=(sync_ids,session_maker)).start()
        return jsonify({"status": "success", "code": 200, "message": "disableCrawler success"})
    except Exception as ex:
        logger.error(f"disableCrawler error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})

@app.route("/ava/api/cancelCrawlerAttachment",methods=["POST"])
def cancel_crawler_attachment():
    data:dict[str,Any]= request.get_json()
    sync_ids = data.get("crawler_attachment_sync_ids",None)
    if not sync_ids:
        return jsonify({"status": "fail", "code": 400, "message": "crawler_attachment_sync_ids is None"})
    try:
        threading.Thread(target=cancel_crawler_attachment_indexing,args=(sync_ids,session_maker)).start()
        return jsonify({"status": "success", "code": 200, "message": "cancelCrawlerAttachment success"})
    except Exception as ex:
        logger.error(f"cancelCrawlerAttachment error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})

@app.route("/ava/api/cancelCrawler",methods=["POST"])
def cancel_crawler():
    data:dict[str,Any]= request.get_json()
    sync_ids = data.get("crawler_sync_ids",None)
    if not sync_ids:
        return jsonify({"status": "fail", "code": 400, "message": "crawler_sync_ids is None"})
    try:
        threading.Thread(target=cancel_crawler_indexing,args=(sync_ids,session_maker)).start()
        return jsonify({"status": "success", "code": 200, "message": "cancelCrawler success"})
    except Exception as ex:
        logger.error(f"cancelCrawler error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})

@app.route("/ava/api/stop", methods=["POST"])
def stop_request():
    API_REQUEST_COUNTER.inc()  # 增加 API 呼叫次數
    def generate_stop():
        API_SUCCESS_COUNTER.inc()  # 成功計數
        yield json.dumps({"type": "data"})
        yield "</end>"
        yield "取消成功"
        yield "</end>"

    return Response(generate_stop(), content_type="text/event-stream")

def load_expert_model_config(expert_id:str) -> dict[str, Any]:
    with session_scope(session_maker) as _session:
        row_expert: Expert_Schema | None = select_expert_from_id(expert_id=expert_id,session=_session)
        assert row_expert
        if isinstance(row_expert.config_jsonb,dict):
            expert_config_json:dict = row_expert.config_jsonb
        elif isinstance(row_expert.config_jsonb,str):
            expert_config_json:dict = json.loads(row_expert.config_jsonb)
        return get_model_and_params(expert_config_json=expert_config_json,session=_session)
    
@app.route("/ava/api/voice", methods=["POST"])
def upload():
    file = request.files["audio"]
    expert_id = request.form.get("expert_id")
    current_user = session.get("user_info")
    if not current_user:
        return jsonify({"status": "fail", "code": 400, "message": "no login user_info"})
    user,error_message = get_user(current_user)
    if error_message:
        return jsonify({"status": "fail", "code": 500, "message": error_message})
    
    voice_model_vendor : str = "openai"
    voice_model_name :str = "whisper-1"
    model_system_prompt:str = ""
    model_temperature: float = 0.0
    model_base_url = None
    if expert_id is not None:
        try:
            expert_model_config: dict[str, Any] = load_expert_model_config(expert_id)
            voice_model_vendor = expert_model_config["voice"]["vendor"]
            voice_model_name:str = expert_model_config["voice"]["model"]
            model_system_prompt = expert_model_config["voice"]["params"].get("system_prompt","")
            model_temperature = expert_model_config["voice"]["params"].get("temperature",0.0)
            if (base_url:=expert_model_config["voice"]["params"].get("base_url",None)):
                model_base_url = base_url
        except Exception as ex:
            logger.error(f"voice api load expert model config error: {ex}")
    folder_path = ("./data/uploads/" + datetime.now().strftime("%Y%m%d") +
            "/" + user.userNo + "/")
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)

    file_name = str(int(time.time() * 1000)) + ".wav"
    uploaded_file = folder_path + "/" + file_name
    file.save(uploaded_file)

    if voice_model_vendor == "openai":
        client = OpenAI(api_key=env_utils.get_openai_key())
    elif voice_model_vendor == "azure":
        client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),  
            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT"), # type: ignore
            azure_deployment= voice_model_name
        )
    elif voice_model_vendor == "caf-azure":
        client = AzureOpenAI(
            api_key=os.getenv("CAF_AZURE_OPENAI_API_KEY"),  
            azure_deployment= voice_model_name,
            azure_endpoint=os.getenv("CAF_AZURE_OPENAI_ENDPOINT")  #type: ignore
        )
    elif voice_model_vendor == "local":
        assert model_base_url,"Local voice model base url is not set."
        client = OpenAI(api_key="LOCAL",base_url=model_base_url)
    else:
        raise ValueError("Invalid voice model vendor.")
    
    with open(uploaded_file, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                prompt=model_system_prompt,
                temperature=model_temperature,
                model=voice_model_name,
                file=audio_file,
            )
    context = transcript.text
    whisper_logger.info(f"{user.userNo} - voice - {context}")
    return context
    
def execute_by_category(history_message_id,chat_uuid, expert_id, user: User, incoming_msg,
                        handler, chat_context: list, scope_datasets: list[str] | None, cookies=None):
    if isinstance(handler, KnowledgeHandler):
        KNOWLEDGE_TRIGGER_COUNTER.inc()  # 記錄知識庫觸發次數
        logger.debug("Step 5.10.1 : execute_by_category before handle",extra={"history_message_id":history_message_id,"expert_id":expert_id})
        with session_scope(vector_session_maker) as vect_session:
            msg = handler.handle(history_message_id, 
                    chat_uuid, expert_id, user, incoming_msg, chat_context, scope_datasets,vect_session)
        logger.debug("Step 5.10.2 : execute_by_category after handle",extra={"history_message_id":history_message_id,"expert_id":expert_id})
    elif isinstance(handler, CSCERPWebApiRunner):
        msg = handler.handle(chat_uuid, expert_id, user, incoming_msg, chat_context, cookies)
    elif isinstance(handler, DragonERPWebApiRunner):
        msg = handler.handle(chat_uuid, expert_id, user, incoming_msg,
                            chat_context, cookies)
    elif isinstance(handler, FileTranslationRunner):
        msg = handler.handle(history_message_id,chat_uuid, expert_id, user, incoming_msg,
                            chat_context)
    else:
        msg = handler.handle(chat_uuid, expert_id, user, incoming_msg, chat_context)
    logger.debug("execute_by_category")
    if handler.return_directly():
        chat_context.clear()

    return msg

@app.route("/ava/api/cache",methods=["DELETE"])
def delete_cache():
    try:
        data:dict[str,Any]= request.get_json()
        expert_id = data["expert_id"]
        delete_cache_ids: list[str] = data["cache_knowledge_ids"]
        if not expert_id or not delete_cache_ids:
            return jsonify({"status": "fail", "code": 400, "message": "Invalid delete cache request params."})
        threading.Thread(target=delete_expert_cache,args=(expert_id,delete_cache_ids)).start()
        return jsonify({"status": "success", "code": 202, "message": "Cache has been started to delete."})
    except Exception as ex:
        return jsonify({"status": "fail", "code": 400, "message": "Invalid delete cache request params."})

@app.route("/ava/api/uploads", methods=["POST"])
def upload_route():
    return upload_files()

@app.route("/ava/api/theme_color_generation", methods=["POST"])
def theme_color_generation():
    """
    使用GPT-4來生成主題配色建議
    """
    try:
        data = request.get_json()
        input_message = data.get("prompt", "")
        
        generator = ThemeColorGenerator()
        content = generator.generate_theme_color(input_message)

        return jsonify({
            "status": "success",
            "code": 200,
            "data": content,
            "message": "Theme color generation completed"
        })

    except Exception as ex:
        logger.error(f"Theme color generation error: {ex}")
        return jsonify({
            "status": "fail", 
            "code": 500,
            "message": str(ex)
        })

@app.route("/ava/api/deactivateIndexing", methods=["POST"])
def deactivateIndexing():
    logger.debug(f"request.url{request.url}")
    data = request.get_json()
    folder_name = data.get("folder_name", "")
    operation_files = data.get("operation_files", [])
    try:
        delete_knowledge_indexing(folder_name, operation_files,session_maker)
        return jsonify({
            "status": "success",
            "code": 200,
            "message": "indexing operations has benn completed."
        })
    except Exception as ex:
        logger.exception(f"deactivate indexing error, err: {ex}",exc_info=ex)
        return jsonify({
            "status": "fail",
            "code": 500,
            "message": "indexing operations has benn failed."
        })

@app.route("/ava/api/updateCrawlerExtraContent", methods=["POST"])
def updateCrawlerExtraContent():
    try:
        data = request.get_json()
        dataset_id : str = data.get("dataset_id")
        crawler_document_id : str = data.get("crawler_document_id")
        if not dataset_id or not crawler_document_id :
            return jsonify({
                "status": "fail",
                "code": 400,
                "message": "dataset_id, crawler_document_id is required."
            })
        threading.Thread(target=contact_extra_to_crawler_document,args=(dataset_id,crawler_document_id,session_maker)).start()
        return jsonify({
            "status": "success",
            "code": 200,
            "message": "update crawler extra content success."
        })
    except Exception as ex:
        logger.error(f"update crawler extra content error: {ex}")
        return jsonify({
            "status": "fail",
            "code": 500,
            "message": "update crawler extra content error."
        })

@app.route("/ava/api/chunks", methods=["GET"])
def get_chunks_of_document():
    try:
        datasets_id: str | None = request.args.get('datasets_id')
        upload_document_id: str | None = request.args.get('upload_document_id')
        if datasets_id is None or upload_document_id is None:
            return jsonify({
                "status": "fail",
                "code": 400,
                "message": "datasets_id or upload_document_id is required."
            })
        with session_scope(session_maker) as _session:
            row_dataset: Dataset_Schema | None = select_datasets_from_id(
                datasets_id=datasets_id,session=_session)
            assert row_dataset
        embedding_model = row_dataset.config_jsonb.get("embedding_model") or app.config["EMBEDDING_MODEL"]
        collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
            collection_name=row_dataset.folder_name,
            collection_class=BaseEmbeddingItem,
            embedding_model=embedding_model,
            config = VectorDatabaseFactory._get_db_config("default"))
        result_set = set()
        search_chunks: Iterator[SearchMetadataDocument] = collection.search_by_metadata(metadata_query={"upload_documents_id": upload_document_id})
        for chunk in search_chunks:
            result_set.add(chunk.metadata["parent_node"])
        return jsonify({
            "status": "success",
            "code": 200,
            "message": "get chunks of document success.",
            "data": list(result_set)
        })
    except Exception as ex:
        logger.error(f"get chunks of document error: {ex}")
        return jsonify({
            "status": "fail",
            "code": 500,
            "message": "get chunks of document error."
        })

@app.route("/ava/api/reloadDatasets", methods=["POST"])
def reloadDatasets():
    logger.info("reload handleProcessor")
    API_REQUEST_COUNTER.inc()  # 增加 API 呼叫次數
    # handleProcessor.refresh_handlers()
    try:
        redis_client: Redis = get_redis_client_with_retry()
        redis_client.publish(REDIS_CHANNEL_NAME, "refresh")
        
    except Exception as ex:
        API_ERROR_COUNTER.inc()  # 錯誤計數
        logger.error(f"reload datasets error:{ex}")
        return jsonify({
            "status": "fail",
            "code": 500,
            "message": "handleProcessor reload error"
        })
    else:
        API_SUCCESS_COUNTER.inc()  # 成功計數
        return jsonify({
            "status": "success",
            "code": 200,
            "message": "handleProcessor reload"
        })
    finally:
        redis_client.close()

@app.route("/ava/api/readLogData", methods=["POST"])
def readLogData():
    data = request.get_json()
    filename = data.get("filename", "ava_app.log")
    time = data.get("time", "")
    count = data.get("count", 0)
    sort = data.get("sort", "desc")
    data = read_log_file(filename, time, count, sort)
    response = jsonify({
        "status": "error",
        "code": 500,
        "message": "未撈到任何檔案名稱",
        "data": data,
    })
    if len(data):
        response = jsonify({
            "status": "success",
            "code": 200,
            "message": "查詢成功",
            "data": data,
        })
    return response

def generate_file_stream(file_path, chunk_size=8192):
    with open(file_path, 'rb') as file:
        while True:
            data = file.read(chunk_size)
            if not data:
                break
            yield data

@app.route("/ava/api/downloadLogFile", methods=["POST"])
def downloadLogFile():
    try:
        data = request.get_json()
        filepath = data.get("filename")
        if not filepath:
            return jsonify({
                "status": "error",
                "code": 400,
                "message": "未指定檔案名稱",
            })
        real_path : Path = Path(__file__).parents[1] / filepath
        if not real_path.is_file():
            return jsonify({
                "status": "error",
                "code": 404,
                "message": "檔案未找到",
            }), 404
        return Response(generate_file_stream(real_path), 
                        mimetype='application/octet-stream',
                        headers={"Content-Disposition": f"attachment; filename={os.path.basename(real_path)}"})
    except Exception as ex:
        logger.error(f"downloadLogFile error: {ex}")
        return jsonify({
            "status": "error",
            "code": 500,
            "message": "下載檔案失敗",
        })

@app.route("/ava/api/readLogFileName", methods=["POST"])
def readLogFileName():
    data = request.get_json()
    logFolder = data.get("folderName", "log")
    data = get_log_files_name(logFolder)
    response = jsonify({
        "status": "error",
        "code": 500,
        "message": "未撈到任何檔案名稱",
        "data": data,
    })
    if len(data): #type: ignore
        response = jsonify({
            "status": "success",
            "code": 200,
            "message": "查詢成功",
            "data": data,
        })
    return response

def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except ValueError:
        return False

@app.route("/index", methods=["GET"])
def index():
    logger.fatal("fatal Hello world !")
    return "<h1>Hello world</h1>"

@app.route("/threads")
def threads():
    num_threads = threading.active_count()
    threads = threading.enumerate()

    thread_list = []
    for thread in threads:
        thread_name = thread.name
        thread_id = thread.ident
        is_alive = thread.is_alive()

        thread_list.append({
            "name": thread_name,
            "id": thread_id,
            "is_alive": is_alive
        })

    return {"thread_num": num_threads, "threads": thread_list}

@app.after_request
def after_request(response):
    """Add Version headers to the response."""
    # response.headers.add("X-Ava-Version", app.config["CURRENT_VERSION"])
    # response.headers.add("X-Env", app.config["DEPLOY_ENV"])
    # session["my-value"] = "InfoChamp"
    return response

@app.before_request
def check_sso_status():
    # skip if mcp
    if "mcp" in request.path:
        return
    if request.path == "/ava/api/rag/prompt":
        return
    try:
        x_forwarded_for = request.headers.get('X-Forwarded-For')
        if x_forwarded_for:
            g.client_ip = x_forwarded_for.split(',')[0].strip()
        else:
            g.client_ip = request.remote_addr
        if request.content_type is not None:
            if request.content_type == 'application/json':
                json_data = request.get_json()
                if json_data and "ava_token" in json_data:
                    ava_token = json_data["ava_token"]
                else:
                    raise Exception("ava_token not found in JSON data")
            elif "multipart/form-data" in request.content_type:
                if "ava_token" in request.form:
                    ava_token = request.form["ava_token"]
                else:
                    logger.debug("ava_token not found in form data")
                    return
        else:
            if "ava_token" in request.values:
                ava_token = request.values["ava_token"]
            else:
                # logger.debug("ava_token not found in values")
                return
                # raise Exception("ava_token not found in form data")
    except Exception as e:
        logger.error(f"check_sso_status ava_token error: {e}")
        # raise e
        return
    else:
        try:
            redis_client: Redis = get_redis_client_with_retry()

            session["user_info"] = redis_client.get(ava_token)
        except Exception as ex:
            logger.error(f"check sso redis error:{ex}")
        finally:
            redis_client.close()
    return

@app.route("/app")
def app_page():
    logger.info("accessing /app to run check_sso_status !")
    return "after check_sso_status"

"""
新增表單跟dataset的綁定
"""
@app.route("/ava/api/form/bindFormDataset",methods=["POST"])
def bindFormDataset():
    """
        dataset_id: str, form_id: str,
        upload_documents_id: str, form_name: str,
        form_description: str, originalname: str,
        filename: str, upload_folder_id: str,
        datasource_url: str, datasource_name: str,
        separator: str
    """
    try:
        API_SUCCESS_COUNTER.inc()  # 計算成功的 API 呼叫次數
        data = request.get_json()
        dataset_id = data.get("datasets_id")
        form_id = data.get("form_id")
        upload_documents_id = data.get("upload_documents_id")
        form_name = data.get("form_name")
        form_description = data.get("form_description")
        originalname = data.get("originalname")
        filename = data.get("filename")
        upload_folder_id = data.get("upload_folder_id")
        datasource_url = data.get("datasource_url")
        datasource_name = data.get("datasource_name")
        separator = data.get("separator")
        threading.Thread(
                target=form_binding_indexing,
                args=(dataset_id, form_id, upload_documents_id, form_name, form_description, originalname, filename, upload_folder_id, datasource_url, datasource_name, separator),
            ).start()
    except Exception as ex:
        logger.error(f"bind form dataset error, err: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": "failed to binding form and dataset..."})
    else:
        return jsonify({
                "status": "success",
                "code": 201,
                "message": "Server has started form dataset binding"
            })

"""
新增表單跟doc綁定(form_id, folder_name , doc_id) => 把所有 folder_name collection 底下的 chunk metadata doc_id ==doc_id 的 加上 form_id
"""
@app.route("/ava/api/form/bindFormDoc", methods=["POST"])
def bindFormDoc():
    data = request.get_json()
    form_id = data.get("form_id")
    datasets_id = data.get("datasets_id")
    doc_id = data.get("doc_id")
    try:
        API_SUCCESS_COUNTER.inc()  # 計算成功的 API 呼叫次數
        with session_scope(session_maker) as _session:
            bind_form_doc(form_id, datasets_id, doc_id,2,_session)
    except Exception as ex:
        logger.error(f"bind form doc error, err: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": "error.."})
    else:
        return jsonify({
            "status": "success",
            "code": 200,
            "message": "form and doc has been binded."
        })

"""
解除表單與doc綁定(form_id, folder_name, doc_id) => 把所有 folder_name collection 底下的 chunk metadata doc_id ==doc_id 的 拿掉
"""
@app.route("/ava/api/form/unbindFormDoc", methods=["POST"])
def unbindFormDoc():
    data = request.get_json()
    form_id = data.get("form_id")
    datasets_id = data.get("datasets_id")
    doc_id = data.get("doc_id")
    try:
        API_SUCCESS_COUNTER.inc()  # 計算成功的 API 呼叫次數
        with session_scope(session_maker) as _session:
            unbind_form_doc(form_id, datasets_id, doc_id,_session)
    except Exception as ex:
        logger.error(f"unbind form doc error, err: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": "error.."})
    else:
        return jsonify({
            "status": "success",
            "code": 200,
            "message": "form and doc has been unbinded."
        })

"""
刪除表單(form_id) => 把所有 chunk metadata有綁這個表單的都把 form_id 移除 並 刪除資料庫紀錄
"""
@app.route("/ava/api/form/deleteForm", methods=["POST"])
def deleteForm():
    data = request.get_json()
    form_id = data.get("form_id")
    try:
        API_SUCCESS_COUNTER.inc()  # 計算成功的 API 呼叫次數
        with session_scope(session_maker) as _session:
            delete_form(form_id,_session)
    except Exception as ex:
        logger.error(f"delete form error, err: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": "error.."})
    else:
        return jsonify({
            "status": "success",
            "code": 200,
            "message": "form has been deleted."
        })

@app.route("/ava/api/serverHealthCheckList", methods=["GET"])
def serverHealthCheckList():
    try:
        redis = {}
        db = {}
        pgVector = {}

        try:
            redis_client: Redis = get_redis_client_with_retry()
            if redis_client.ping():
                redis['connect'] = True
            else:
                redis['connect'] = False
                redis['error-message'] = "redis 連接失敗"
        except Exception as e:
            redis['connect'] = False
            redis['error-message'] = e

        try:
            with session_scope(session_maker) as session:
                session.execute(text("SELECT 1")) 
            db['connect'] = True
        except Exception as e:
            db['connect'] = False
            db['error-message'] = e

        try:
            db_connection_string = getenv("POSTGRES_VECTOR_DATABASE_URL")
            assert db_connection_string, "No POSTGRES_VECTOR_DATABASE_URL found in env"
            with psycopg2.connect(db_connection_string) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")  # 執行簡單查詢測試
            pgVector['connect'] = True
        except Exception as e:
            pgVector['connect'] = False
            pgVector['error-message'] = e

        data = {
            "redis": redis,
            "db": db,
            "pgVector": pgVector,
        }
        print('serverHealthCheckList', data)
        return Response(json.dumps(data), status=200, content_type="application/json")
    except Exception as e:
        return Response(json.dumps({'message': e}))

@app.route("/ava/api/serverHealthRedisCheck", methods=["GET"])
def serverHealthRedisCheck():
    try:
        redis = {}

        try:
            redis_client: Redis = get_redis_client_with_retry()
            if redis_client.ping():
                redis['connect'] = True
            else:
                redis['connect'] = False
                redis['error-message'] = "redis 連接失敗"
        except Exception as e:
            redis['connect'] = False
            redis['error-message'] = e

        data = {"redis": redis}

        return Response(json.dumps(data), status=200, content_type="application/json")
    except Exception as e:
        return Response(json.dumps({'message': e}))

@app.route("/ava/api/serverHealthDbCheck", methods=["GET"])
def serverHealthDbCheck():
    try:
        db = {}

        try:
            with session_scope(session_maker) as session:
                session.execute(text("SELECT 1")) 
            db['connect'] = True
        except Exception as e:
            db['connect'] = False
            db['error-message'] = e

        data = {"db": db}

        return Response(json.dumps(data), status=200, content_type="application/json")
    except Exception as e:
        return Response(json.dumps({'message': e}))
    
@app.route("/ava/api/serverHealthpgVectorCheck", methods=["GET"])
def serverHealthpgVectorCheck():
    try:
        pgVector = {}

        try:
            db_connection_string = getenv("POSTGRES_VECTOR_DATABASE_URL")
            assert db_connection_string, "No POSTGRES_VECTOR_DATABASE_URL found in env"

            with psycopg2.connect(db_connection_string) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")  # 執行簡單查詢測試
            pgVector['connect'] = True
        except Exception as e:
            pgVector['connect'] = False
            pgVector['error-message'] = e

        data = {"pgVector": pgVector}

        return Response(json.dumps(data), status=200, content_type="application/json")
    except Exception as e:
        return Response(json.dumps({'message': e}))
    
@app.route("/ava/api/classify_feedbacks", methods=["POST"])
def classify_feedback():
    current_user = session.get("user_info")
    if not current_user:
        return jsonify({"status": "fail", "code": 400, "message": "no login user_info"})
    user,error_message = get_user(current_user)
    if error_message:
        return jsonify({"status": "fail", "code": 500, "message": error_message})
    
    data = request.get_json()
    feedbacks = data.get("feedbacks")
    logger.debug(f"feedbacks: {feedbacks}")
    questions: dict[str, str] = {}
    for feedback in feedbacks:
        key = next(iter(feedback))
        value = feedback[key]
        if isinstance(key, str) and isinstance(value, str):
            questions[key] = value

    with session_scope(session_maker) as s:
        result, unclassified_id_list, output_len, token, max_token = feedback_utils.feedback_classifier(user, questions, s)   
    
    logger.debug(f"result: {result}")
    return jsonify(
        {
            "status": "success", 
            "code": 200, 
            "input_len": len(questions),
            "output_len": output_len,
            "token": token,
            "max_token": max_token,
            "unclassified_id_list": unclassified_id_list,
            "message": result
        }
    )
      
@app.route("/ava/api/uploadFilesLlmApi", methods=["POST"])
def uploadFilesLlmApi():
    current_user = session.get("user_info")
    if not current_user:
        return jsonify({"status": "fail", "code": 400, "message": "no login user_info"})
    
    user,error_message = get_user(current_user)
    if error_message:
        return jsonify({"status": "fail", "code": 500, "message": error_message})

    if user and "uid" in request.values:
        user.uid = request.values["uid"]

    message = request.form.get("message")
    model_list_id = int(request.form.get("model_list_id") or 72)
    uploaded_files = request.files.getlist("files")
    chat_uuid = str(uuid.uuid4())
    model_params = app.config["MODEL_PARAMS"]

    if message is None:
        return jsonify({"status": "fail", "code": 400, "message": "message is required"})    

    response = None
    with session_scope(session_maker) as _session:
        row_model_list: ModelList_Schema | None = select_model_list_from_id(model_list_id=model_list_id, session=_session)
        if row_model_list:
            vendor = row_model_list.vendor
            model_name = row_model_list.model_name
        else:
            return jsonify({"status": "fail", "code": 400, "message": "model list not found"})

        if vendor == "google":
            google_api_key = env_utils.get_google_api_key()
            if google_api_key is None:
                raise RuntimeError("缺少 Gemini 相關環境變數")
            handler = GeminiHandler(api_key=google_api_key)
            response = handler.upload_files_not_stream(
                model_list_id=model_list_id,
                model=model_name,
                user=user,
                user_input=message,
                message_data=uploaded_files,
                chat_uuid=chat_uuid,
                session=_session
            )
        elif vendor in ["azure", "caf-azure"]:
            response = run_azure_upload_files_not_stream(
                model_list_id=model_list_id,
                model_name=model_name,
                user=user,
                user_input=message,
                message_data=uploaded_files,
                chat_uuid=chat_uuid,
                session=_session,
                model_params=model_params,
            )
        else:
            return jsonify({"status": "fail", "code": 400, "message": "model vendor not supported"})

    if response.get("code") == 200:
        return jsonify({"status": "success", "code": 200, "message": response.get("response")})
    else:
        return jsonify({"status": "fail", "code": response.get("code"), "message": response.get("error")})

@app.route("/ava/api/mcp", methods=["POST"])
def mcp_api():
    """MCP server tools API endpoint using SSE for streaming responses.
    
    This endpoint accepts two parameters:
    - expert_id: The ID of the expert to use for processing the message
    - message: The message text to process
    
    Returns a server-sent events (SSE) stream containing the response.
    """
    API_REQUEST_COUNTER.inc()
    
    # Get the JSON data from the request
    data = request.get_json()
    if not data:
        return jsonify({"status": "fail", "code": 400, "message": "Invalid JSON data"})
    
    # Extract required parameters
    expert_id = data.get("expert_id")
    message_data = data.get("message")
    conversation_id = data.get("conversation_id")
    user_id = data.get("user_id")
    metadata = data.get("metadata")
    
    if not expert_id or not message_data:
        return jsonify({"status": "fail", "code": 400, "message": "expert_id and message are required"})
    
    # Get user info
    # current_user = session.get("user_info")

    # fake user for mcp testing
    current_user = b'{"cookie":{"originalMaxAge":86400000,"expires":"2099-05-12T15:18:24.088Z","httpOnly":true,"path":"/"},"userType":"guest","userInfo":{"uid":"MCP_SERVER_ACCOUNT","nickname":"mcp_testing_account","user_no":"guest","sex":"1","avatar":null,"user_type":"guest"}}'
    if not current_user:
        return jsonify({"status": "fail", "code": 400, "message": "no login user_info"})
    
    user, error_message = get_user(current_user)
    if error_message:
        return jsonify({"status": "fail", "code": 500, "message": error_message})
    
    # Set user attributes
    user.cookies = request.cookies
    user.client_ip = g.get('client_ip')
    
    # Generate UUID for the chat
    chat_uuid = conversation_id or str(uuid.uuid4())
    
    # Create context for the response
    context = []
    
    # Get history message ID
    try:
        with session_scope(session_maker) as _session:
            history_message_id = get_history_message_nextval(session=_session)
    except Exception as ex:
        logger.error(f"get_history_message_nextval error: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": str(ex)})
    
    # Get expert config
    try:
        with session_scope(session_maker) as _session:
            row_expert: Expert_Schema | None = select_expert_from_id(expert_id=expert_id, session=_session)
            if not row_expert:
                return jsonify({"status": "fail", "code": 400, "message": f"Expert ID {expert_id} not found"})
            
            if isinstance(row_expert.config_jsonb, dict):
                expert_config_json = row_expert.config_jsonb
            elif isinstance(row_expert.config_jsonb, str):
                expert_config_json = json.loads(row_expert.config_jsonb)
            else:
                return jsonify({"status": "fail", "code": 500, "message": "Invalid expert configuration"})
        
        # Get link level from the expert config
        link_level = expert_config_json.get("link_chunk_level", 0)
    except Exception as ex:
        logger.error(f"Error getting expert config: {ex}")
        return jsonify({"status": "fail", "code": 500, "message": f"Error accessing expert configuration: {str(ex)}"})
    cookies = request.cookies
    # Define generator for SSE response
    def generate_mcp_sse():
        model = ""
        try:
            # Call bot function to process the message
            logger.info(f"MCP API calling bot for expert_id={expert_id}, message={message_data[:50]}...")
            (body, is_stream, datasource, model, is_cache, record_model_params), handler = bot(
                history_message_id, chat_uuid, expert_id, user, message_data, context, 
                None, True, cookies,True
            )
            
            # Return streamable response parts
            content_buffer = []
            for content in body:
                if isinstance(content, str):
                    # Format as proper SSE message
                    if content.strip():  # Only send non-empty content
                        yield f"data: {content}\n\n"
                        content_buffer.append(content)
                elif isinstance(content, dict):
                    json_content = json.dumps(content)
                    yield f"data: {json_content}\n\n"
                    content_buffer.append(json_content)
                else:
                    try:
                        str_content = str(content)
                        if str_content.strip():  # Only send non-empty content
                            yield f"data: {str_content}\n\n"
                            content_buffer.append(str_content)
                    except Exception as ex:
                        logger.error(f"Error converting content to string: {ex}")
            
            # Save history if needed
            if model == "ERROR":
                type = insert_history_message_type.ERROR
            elif model == "NOANSWER":
                type = insert_history_message_type.NOANSWER
            else:
                type = insert_history_message_type.OK
                
            # Insert the interaction into history
            with session_scope(session_maker) as _session:
                insert_history_message(
                    history_message_id=history_message_id,
                    input_message=message_data if isinstance(message_data, str) else json.dumps(message_data, default=lambda x: "Serialization error", ensure_ascii=False),
                    output_message="".join(content_buffer[:1000]) + ("..." if len(content_buffer) > 1000 else ""),
                    expert_id=expert_id,
                    users_id=user.uid,
                    type=type,
                    model_name=model,
                    link_level=link_level,
                    model_params=record_model_params,
                    device=data.get("device"),
                    session=_session
                )
                
            # Send completion event
            yield "data: [DONE]\n\n"
                
        except Exception as ex:
            API_ERROR_COUNTER.inc()
            logger.error(f"MCP API error: {ex}")
            error_json = json.dumps({"error": str(ex), "code": "internal_error"})
            yield f"data: {error_json}\n\n"
            yield "data: [DONE]\n\n"
            
            # Record error in history
            try:
                with session_scope(session_maker) as _session:
                    insert_history_message(
                        history_message_id=history_message_id,
                        input_message=message_data if isinstance(message_data, str) else json.dumps(message_data, default=lambda x: "Serialization error", ensure_ascii=False),
                        output_message=error_json,
                        expert_id=expert_id,
                        users_id=user.uid,
                        type=insert_history_message_type.ERROR,
                        model_name="ERROR",
                        link_level=link_level,
                        device=data.get("device"),
                        session=_session
                    )
            except Exception as inner_ex:
                logger.error(f"Failed to record error in history: {inner_ex}")
    
    # Return SSE response
    API_SUCCESS_COUNTER.inc()
    return Response(
        generate_mcp_sse(),
        content_type="text/event-stream",
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'  # Prevents proxy buffering for NGINX
        }
    )

RAG_PROMPT_API_KEY = "c8b5e9d7-4f2a-11ee-be56-0242ac120002_f1a2b3c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o"
SPECIAL_BACKDOOR_KEY = "65355e0a-d430-4197-b5d1-19ea1cbf42da"

@app.route("/ava/api/rag/prompt", methods=["POST"])
def get_rag_prompt():
    """
    獲取完整的 RAG prompt messages
    需要 X-API-KEY header 驗證
    """
    try:
        # 檢查 API Key
        api_key = request.headers.get('X-API-KEY')
        if not api_key or api_key != RAG_PROMPT_API_KEY:
            return jsonify({
                "status": "fail",
                "code": 403,
                "message": "Invalid or missing API key"
            }), 403
        
        # 檢查是否使用特殊 key 進行身分認證
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "fail",
                "code": 400,
                "message": "Request body is required"
            }), 400
        
        # 檢查特殊 key 認證
        special_key = data.get("user_key")
        if special_key == SPECIAL_BACKDOOR_KEY:
            # 使用特殊 key 創建管理員用戶
            user = User({
                "uid": "icsc-admin",
                "user_no": "icsc-admin",
                "userNo": "icsc-admin", 
                "name": "管理員專用帳號",
                "nickname": "管理員用帳號",
                "user_type": "member",
                "login_type": "system"
            })
            logger.info("Using special key authentication for RAG prompt API")
        else:
            # 使用一般 session 認證方式
            current_user = session.get("user_info")
            if not current_user:
                return jsonify({"status": "fail", "code": 400, "message": "no login user_info"})
            
            user, error_message = get_user(current_user)
            if error_message:
                return jsonify({"status": "fail", "code": 500, "message": error_message})
            
            # 設定用戶的額外屬性
            if user and "uid" in request.values:
                user.uid = request.values["uid"]
        
        # 解析請求數據 (data 已在上面解析過)
        expert_id = data.get("expert_id")
        query = data.get("query")
        get_answer = data.get("get_answer", False)  # 新增參數：是否要獲得原始答案
        
        if not expert_id or not query:
            return jsonify({
                "status": "fail",
                "code": 400,
                "message": "expert_id and query are required"
            }), 400
        
        # 生成必要的 ID
        chat_uuid = str(uuid.uuid4())
        history_message_id = None
        try:
            with session_scope(session_maker) as _session:
                history_message_id = str(get_history_message_nextval(session=_session))
        except Exception as ex:
            logger.error(f"get_history_message_nextval error: {ex}")
            return jsonify({"status": "fail", "code": 500, "message": str(ex)})

        if not history_message_id:
            return jsonify({
                "status": "fail",
                "code": 500,
                "message": "Failed to generate history_message_id"
            }), 500

        # 獲取 handler processor
        ava_handlers = get_handler_processor(expert_id)
        if not ava_handlers or len(ava_handlers) == 0:
            return jsonify({
                "status": "fail",
                "code": 404,
                "message": "No handlers found for the specified expert"
            }), 404
        
        # 假設使用第一個 handler (通常是 KnowledgeHandler)
        handler = copy(ava_handlers[0])
        
        if not isinstance(handler, KnowledgeHandler):
            return jsonify({
                "status": "fail",
                "code": 400,
                "message": "Expert is not a Knowledge-based expert"
            }), 400
        
        # 臨時禁用緩存和上下文歷史
        original_expert_config = {}
        try:
            handler.load_expert_model_config(expert_id)
            # 禁用相關功能
            handler.expert_config["enable_context_history"] = False
            handler.model_config["search"]["search_kwargs"]["cache_enabled"] = False
            handler.skip_cache = True
        except Exception as e:
            logger.warning(f"Failed to modify handler config: {e}")
        
        # 執行 Knowledge handler
        with session_scope(vector_session_maker) as vect_session:
            result = handler.handle(
                history_message_id=history_message_id,
                chat_uuid=chat_uuid,
                expert_id=expert_id,
                user=user,
                query=query,
                chat_context=[],
                scope_datasets=None,
                vect_session=vect_session
            )
        
        # 處理結果
        if isinstance(result, list) and len(result) >= 2:
            context = result[0]
            query_with_context = result[1]
            
            # 獲取 system prompt
            system_prompt = handler.get_system_prompt()
            
            # 構建 messages
            messages = [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user", 
                    "content": f"{context}\n{query_with_context}"
                }
            ]
            
            # 準備回應資料
            response_data = {
                "messages": messages,
                "expert_id": expert_id,
                "query": query,
                "has_images": len(result) > 2 and result[2] is not None
            }
            
            # 如果需要獲得原始答案，調用 LLM
            if get_answer:
                try:
                    logger.info(f"Getting original answer for query: {query}")
                    
                    # 獲取 LLM 相關配置
                    llm_model = handler.get_llm_model()
                    llm_model_params = handler.get_llm_model_params().copy()
                    llm_model_list_id = handler.get_llm_model_list_id()
                    llm_model_vendor = handler.get_llm_model_vendor()
                    
                    # 移除可能導致問題的參數，只保留 OpenAI API 支援的參數
                    openai_allowed_params = {
                        "temperature", "max_tokens", "top_p", "frequency_penalty", 
                        "presence_penalty", "stop", "logit_bias", "user", "seed",
                        "logprobs", "top_logprobs", "response_format", "tool_choice", "tools"
                    }
                    # 創建只包含允許參數的新字典
                    filtered_params = {k: v for k, v in llm_model_params.items() if k in openai_allowed_params}
                    
                    # 準備專家資料
                    expert_data = {
                        "expert_id": expert_id,
                        "expert_model": handler.get_dataset_folder_name() or str(handler),
                        "expert_model_type": handler.get_expert_model_type(),
                    }
                    
                    # 調用 LLM
                    with session_scope(session_maker) as _session:
                        original_answer = complete_chunk(
                            chat_uuid=chat_uuid,
                            llm_model_params=filtered_params,
                            expert_data=expert_data,
                            user=user,
                            messages=messages,
                            user_input=query,
                            history_message_id=int(history_message_id),
                            llm_model_list_id=llm_model_list_id,
                            llm_model_vendor=llm_model_vendor,
                            llm_model=llm_model
                        )
                    
                    # 收集完整的答案
                    full_answer = ""
                    for chunk in original_answer:
                        if isinstance(chunk, str):
                            full_answer += chunk
                    
                    response_data["original_answer"] = full_answer
                    logger.info(f"Original answer generated successfully, length: {len(full_answer)}")
                    
                except Exception as llm_error:
                    logger.error(f"Error getting original answer: {llm_error}")
                    response_data["original_answer_error"] = str(llm_error)
            
            return jsonify({
                "status": "success",
                "code": 200,
                "data": response_data,
                "message": "RAG prompt generated successfully"
            })
        else:
            return jsonify({
                "status": "fail",
                "code": 500,
                "message": "Failed to generate RAG prompt"
            }), 500
            
    except AssertionError as e:
        return jsonify({
            "status": "fail",
            "code": 400,
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"RAG prompt API error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            "status": "fail",
            "code": 500,
            "message": "Internal server error"
        }), 500

if app.config["TESTING"]:
    logger.info("App is running in TESTING mode")
if __name__ == "__main__":
    logger.info("Running Flask !")
    app.run(host="0.0.0.0", port=5001, debug=False)
   
