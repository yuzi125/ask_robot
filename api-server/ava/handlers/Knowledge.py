import hashlib
import logging
import re
import secrets
import threading
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from itertools import islice
from json import loads as json_loads
from os import getenv
from time import sleep
from typing import Any, Iterator, Sequence
from urllib.parse import urljoin
from uuid import uuid4

import jieba
from ava.clients.sql.crud import (
    insert_cached_knowledge, insert_message_chunk_mapping,
    insert_user_completion_history, select_cache_knowledge_by_ids_and_model,
    select_cached_knowledge_from_id_and_model_and_params_and_level,
    select_crawler_by_id, select_crawler_documents_extra_from_id,
    select_datasets_from_id, select_default_prompt_by_id,
    select_expert_from_id, select_form_config_from_ids,
    select_history_message_by_id, select_parent_chunk_from_id,
    select_parent_chunks_from_ids, select_settings_from_key,
    select_user_completion_history, touch_cache_update_time,
    update_history_message_answer_status)
from ava.clients.sql.database import scoped_session, session_scope
from ava.clients.sql.schema import (CachedKnowledge_Schema, Crawler_Schema,
                                    DefaultPrompt_Schema,
                                    FormConfiguration_Schema,
                                    MessageChunkMapping_Schema,
                                    ParentChunks_Schema, Settings_Schema,
                                    UserCompletionHistory_Schema)
from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.model.ExpertEmbeddingTokenLogEntry import ExpertEmbeddingTokenLogEntry
from ava.model.knowledge import DataSet, get_datasets
from ava.utils import env_utils
from ava.utils.DateReplacer import DateReplacer
from ava.utils.GPTHandler import GPTHandler
from ava.utils.model_utils import get_model_and_params
from ava.utils.redis_utils import get_redis_client_with_retry
from ava.utils.stop_words import CHINESE_STOPWORDS, ENGLISH_STOPWORDS
from ava.utils.utils import LoggerUtils
from ava.utils.vector import (CollectionLimit, EmbeddingDocument,
                              InsertEmbeddingDocument, SearchContentDocument,
                              VectorDatabase, VectorDatabaseFactory,
                              get_openai_embeddings)
from ava.utils.vector.cache import RedisEmbeddingCache
from ava.utils.vector.postgres.sql import BaseEmbeddingItem
from sqlalchemy.sql import text

doc_logger = logging.getLogger("doc")
logger = logging.getLogger("ava_app")
vector_database_logger = logging.getLogger("ava_vector_database")


def get_page_contents(docs:list[EmbeddingDocument]):
    contents = ""
    for i, doc in enumerate(docs, 1):
        contents += f"\n{doc.content}\n======\n"
    return contents


def load_knowledge_handlers(expert_id, embeddings: str,session_maker:scoped_session):
    with session_scope(session_maker) as session:
        expert_datasets = get_datasets(expert_id,session)
        # collect all dataset in expert_datasets
        all_datasets = []
        for dataset in expert_datasets:
            all_datasets.append(dataset)
        logger.debug(f"all_datasets: {all_datasets}")

    assert len(all_datasets) > 0, "No datasets binding in that expert."
    return [
        KnowledgeHandler(embeddings, all_datasets,expert_id,session_maker)
    ]


class KnowledgeHandler(AvaHandler):

    def __init__(self, embeddings: str, datasets: list[DataSet],expert_id:str,session_maker:scoped_session) -> None:
        # TODO: 目前的做法是撈第一個就不撈了，但這樣會只吃第一個的參數
        logger.debug(f"KnowledgeHandler __init__")
        self.session_maker = session_maker
        self.retriever = None
        self.datasets = datasets
        assert len(self.datasets) > 0, "No datasets found."
        self.dataset = self.datasets[0]
        self.embeddings = embeddings
        _collections:list[VectorDatabase] = []
        self.expert_id = expert_id
        self.model_config = {}
        self.expert_config = {}
        self.dataset_mapping:dict[str,str] = {}
        self.revert_dataset_mapping:dict[str,str] = {}
        self.related_image_uuids = []
        self.related_image_urls = []
        self.current_user: User | None = None
        for dataset in self.datasets:
            self.dataset_mapping[dataset.datasets_id] = dataset.name
            self.revert_dataset_mapping[dataset.name] = dataset.datasets_id
            collection: VectorDatabase = VectorDatabaseFactory.get_vector_database(
                collection_name=dataset.folder_name, embedding_model=dataset.config_jsonb.get("embedding_model","text-embedding-3-large"),collection_class=BaseEmbeddingItem)
            _collections.append(collection)
        self.collections: list[VectorDatabase] = _collections
        self.cache_collection : VectorDatabase = VectorDatabaseFactory.get_vector_database(
            collection_name=f"cache_{expert_id}", embedding_model="text-embedding-3-large",collection_class=BaseEmbeddingItem)
        self.has_cache: bool = False
        self.form_binding = ""
        self.source_chunk: list = []
        self.extra_chunk: list= []
        self.result_chunk :list[SearchContentDocument] = []
        self.query : str = ""
        self.query_embedding: list[float] = []
        self.cache_client: RedisEmbeddingCache = RedisEmbeddingCache(
            redis_client=get_redis_client_with_retry())
        self.skip_cache: bool = False
        logger.debug(f"KnowledgeHandler __init__ done")
    def remove_spaces_and_new_lines(self,text:str):
        text = text.replace(" ", "")
        lines = text.split("\n")
        non_empty_lines = [line for line in lines if line.strip() != ""]
        return "".join(non_empty_lines)
    def get_knowledge_cache_result(self,query:str,original_chunks:list[SearchContentDocument],skip_cache:bool=False)-> tuple[str,str,str,bool] | None:
        if skip_cache:
            return None
        with session_scope(self.session_maker) as session:
            cache_enabled: bool = self.model_config["search"]['search_kwargs'].get("cache_enabled",True)
            if not cache_enabled:
                return None
            cache_threshold: float = self.model_config["search"]['search_kwargs'].get("cache_threshold",0.75) or 0.75
            if not self.query_embedding:
                self.query_embedding,use_cache = self.get_query_embedding(self.query,self.embeddings)
            cache_embedding_rows: Iterator[SearchContentDocument] = self.cache_collection.search_embedding_cache_by_score_threshold(expert_id=self.expert_id,query_embedding=self.query_embedding,score_threshold=cache_threshold,k=1000)
            origin_chunk_ids: list[str] = [doc.id for doc in original_chunks]
            result_candidates: list[CachedKnowledge_Schema] = []
            self.load_expert_model_config()
            llm_model_name = self.model_config["search"]["model"]
            model_params=self.model_config["search"]["params"]
            model_prompt=self.get_system_prompt()
            model_prompt = model_prompt[model_prompt.find("now_time_prompt_end\n")+len("now_time_prompt_end"):].strip()
            link_level = int(self.expert_config.get("link_chunk_level",0))
            # TODO: use_embedding_cache 爛作法，目前先這樣之後再改
            for cache_embedding_row in cache_embedding_rows:
                _row: CachedKnowledge_Schema | None = select_cached_knowledge_from_id_and_model_and_params_and_level(model_name=llm_model_name,model_params=model_params,model_prompt=model_prompt,cache_id=cache_embedding_row.metadata["cache_knowledge_id"],link_level=link_level,session=session)
                if _row is not None:
                    touch_cache_update_time(cache_row_id=_row.id,session=session)
                    result_candidates.append(_row)
            if len(result_candidates) == 0:
                return None

            row_setting: Settings_Schema | None = select_settings_from_key(key ="precise_cache_mode",session=session)
            precise_cache_mode: bool = row_setting is None or str(row_setting.value) == "1"
            if precise_cache_mode:
                matching_records: list[CachedKnowledge_Schema] = [
                    record for record in result_candidates if record.related_chunk_ids == origin_chunk_ids
                ]
            else:
                matching_records = [
                    record for record in result_candidates if set(record.related_chunk_ids) == set(origin_chunk_ids)
                ]
            if not matching_records:
                return None
            result_row: CachedKnowledge_Schema = secrets.choice(matching_records)
            threading.Thread(target=self.insert_message_chunk_mapping_for_cache,args=([ int(chunk_id) for chunk_id in result_row.related_chunk_ids],)).start()
            return result_row.question,result_row.answer,result_row.id,result_row.no_answer
    
    def get_extra_cache_result(self,query:str)-> list[SearchContentDocument] | None:
        with session_scope(self.session_maker) as session:
            min_threshold: float = self.model_config["search"]['search_kwargs'].get("min_extra_chunk_cache_threshold",0.3) or 0.3
            max_threshold: float = self.model_config["search"]['search_kwargs'].get("max_extra_chunk_cache_threshold",0.5) or 0.5
            if not self.query_embedding:
                self.query_embedding,use_cache = self.get_query_embedding(self.query,self.embeddings)
            extra_cache_embedding_rows: Iterator[SearchContentDocument] = self.cache_collection.search_embedding_cache_by_score_threshold(expert_id=self.expert_id,query_embedding=self.query_embedding,score_threshold=min_threshold,k=50)
            satisfied_cache_embedding_rows: list[SearchContentDocument] = []
            for cache_row in extra_cache_embedding_rows:
                if cache_row.score <= max_threshold :
                    if not cache_row.metadata.get("no_answer",False):
                        satisfied_cache_embedding_rows.append(cache_row)
            cache_knowledge_ids: list[str] = [doc.metadata["cache_knowledge_id"] for doc in satisfied_cache_embedding_rows]
            filter_by_model: Sequence[CachedKnowledge_Schema] = select_cache_knowledge_by_ids_and_model(cache_ids=cache_knowledge_ids,model_name=self.model_config["search"]["model"],session=session)
            final_result: list[SearchContentDocument] = [doc for doc in satisfied_cache_embedding_rows if doc.metadata["cache_knowledge_id"] in [row.id for row in filter_by_model]]
            len_of_cache_rows = len(final_result)
            if len_of_cache_rows == 0:
                return None
            sample_count : int = 5
            if len_of_cache_rows < sample_count:
                return list(final_result)
            else:
                return list(secrets.SystemRandom().sample(final_result, sample_count))
    
    def insert_cache(self,no_answer:bool,answer:str,history_message_id:str,model_name:str,model_params:dict[str,Any],model_prompt:str)-> None:
        with session_scope(self.session_maker) as session:
            enable_context_history: Settings_Schema | None = select_settings_from_key(key="enable_context_history",session=session)
            if enable_context_history:
                if str(enable_context_history.value) == "1":
                    # If context history is enabled, return early since the completion will depend on previous context
                    # and cannot be reused from cache.
                    return
            self.load_expert_model_config()
            cache_enabled: bool = self.model_config["search"]['search_kwargs'].get("cache_enabled",True)
            if not cache_enabled:
                return
            uuid = str(uuid4())
            try:
                model_prompt = model_prompt[model_prompt.find("now_time_prompt_end\n")+len("now_time_prompt_end"):].strip()
                insert_cached_knowledge(id=uuid,question=self.query,answer=answer,model_name=model_name,expert_id=self.expert_id,model_params = model_params , model_prompt=model_prompt,related_chunk_ids=[doc.id for doc in self.result_chunk],link_level=int(self.expert_config.get("link_chunk_level",0)),session=session,no_answer=no_answer)
            except Exception as e:
                logger.error(f"insert_cache to rdb error: {e}")
            else:
                try:
                    query_embedding,use_cache = self.get_query_embedding(self.query,self.embeddings)
                    if not use_cache:
                        entry = ExpertEmbeddingTokenLogEntry(
                                    model=self.embeddings,
                                    model_id=85,
                                    expert_id=self.expert_id,
                                )
                        LoggerUtils.token_from_expert_embedding(self.query, entry,session)
                    self.cache_collection.insert_embedding_cache_data(data=InsertEmbeddingDocument(id=str(uuid4()),metadata={"cache_knowledge_id":uuid,"no_answer":no_answer},content=self.query,embedding=query_embedding))
                except Exception as e:
                    logger.error(f"insert_cache to vector db error: {e}")
                else:
                    logger.debug(f"insert_cache success with query: {self.query}, answer: {answer}, chunk_ids: {[doc.id for doc in self.result_chunk]}")
            try:
                if no_answer:
                    max_retries = 20
                    for _ in range(max_retries):
                        row_history_message = select_history_message_by_id(history_message_id=int(history_message_id),session=session)
                        if row_history_message is not None:
                            update_history_message_answer_status(history_message_id=int(history_message_id),no_answer=no_answer,session=session)
                            break
                        else:
                            logger.debug(f"insert_cache sleep 3 seconds")
                            sleep(3)
                    logger.error(f"insert_cache max_retries {max_retries} failed")
            except Exception as e:
                logger.error(f"insert_cache to rdb error: {e}")
    def get_chunks_with_levels(self, node_id, direction, levels,session):
        chunks = []
        current_level = 0
        while node_id and current_level < levels:
            # 查詢當前 node 的父節點或子節點
            _node: ParentChunks_Schema = select_parent_chunk_from_id(node_id=node_id,session=session)
            
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
    def rewrite_query(self,user:User,model_list_id:int,chat_uuid:str,last_completion_history:Sequence[UserCompletionHistory_Schema])->str:
        history_block = "\n".join([f"Q: {r.user_input}\nA: {r.expert_output}" for r in last_completion_history[-5:][::-1]])
        rewrite_query_prompt_prompt = f"""
            你是一位語意理解專家，負責將使用者的連續對話整合為一個清楚、單句的新問題，用於向知識檢索系統發出查詢。
            你的目標是最大限度保留使用者原始語意，並確保合併後的句子忠實反映使用者的資訊需求，避免產生語意偏差或虛構內容。
            請依以下規則操作：
                輸入包含：
                    最多 5 輪歷史對話（依時間排序）
                    使用者目前的新提問（current_question）
                判斷語意關聯：
                    檢查 current_question 是否明確接續或深化某一段歷史對話的主題
                    若 有明確語意連結，請將該段歷史內容與 current_question 融合為一個完整、清楚的新問題句子，並確保語意與原意一致、不擴寫或誤解原意
                    若 無明確語意關聯，請保持 current_question 原樣輸出，不做任何修改
                重寫要求：
                    僅輸出一個句子作為最終結果
                    避免引入任何新資訊、推測意圖或過度總結
                    不需標示歷史段落來源，不輸出任何說明或額外內容
            請嚴格遵守上述規則，維持高度語意精準與一致性。
            [history]
            {history_block}
        """.strip()
        
        gpt = GPTHandler(api_key=env_utils.get_openai_key())
        with session_scope(self.session_maker) as session:
            default_rewrite_query_prompt: Settings_Schema | None = select_settings_from_key(key="rewrite_query_prompt",session=session)
            if default_rewrite_query_prompt is not None and default_rewrite_query_prompt.value is not None and default_rewrite_query_prompt.value.strip() != "":
                rewrite_query_prompt_prompt = default_rewrite_query_prompt.value.strip()
            messages = [
                {"role":"system","content":rewrite_query_prompt_prompt},
                {"role":"user","content":self.query}
            ]
            try:
                llm_response = gpt.run_gptModel(session=session,
                                                user=user,
                                                messages=messages,
                                                user_input=self.query,
                                        expert_data={"expert_id":self.expert_id,"expert_model":"gpt-4o-mini","expert_model_type":self.get_expert_model_type()},
                                        chat_uuid=chat_uuid,
                                        model_list_id=model_list_id,
                                        model="gpt-4o-mini",
                                        params={
                                            "max_tokens": 200,
                                            "temperature": 0,
                                            "frequency_penalty": 0,
                                            "top_p": 1.0,
                                        }
                                        )
                return llm_response #type: ignore
            except Exception as e:
                logger.error(f"rewrite_query error: {e}")
                return self.query
    def assess_target_and_sensitive(self,distinct_dataset_names_list:list[str],user:User,model_list_id:int,chat_uuid:str)->tuple[list[str],bool]:
        default_include_dataset_names_list = [
            "政務基本知識",
            "線上即時服務系統-知識庫",
            "便民一路通-知識庫",
            "數位市民網-知識庫",
            "大林蒲遷村計畫-知識庫",
            "高雄市全球資訊網-知識庫",
            "1999聯服中心-知識庫",
        ]
        system_prompt = f"""
            你是一個專業的問題分類與個資偵測員，責任根據使用者問題執行下列兩個任務：
            ===
            【任務一：局處分類】
            請將使用者的問題分清，對應到適當的高雄市局處或承辦窗口，並根據問題內容與性質，推理出所有與問題相關的局處或知識來源，依相關程度由高至低排序。

            分類時請遵守以下規則：
            1. 【擴展縮寫】：若問題中包含局處縮寫，請將其擴展為全名進行判斷。
            2. 【多層次關聯】：考慮直接與間接關聯。例如：
            - 「出生登記」直接聯想到民政局。
            - 「新生兒福利」間接聯想到社會局。
            3. 【泛化判斷】：確保邏輯能適用於類似場景。例如：
            - 「老人補助」聯想到社會局。
            - 「流感疫苗接種」聯想到衛生局。
            4. 【源資料清單】：僅能從下列清單中選擇局處或知識來源：{[name for name in distinct_dataset_names_list if name not in default_include_dataset_names_list]}
            5. 【無關聯時】：若問題無明確對應局處，請回傳空陣列。
            ===
            【任務二：故意個資偵測】
            請判斷使用者問題中是否有**主動或無意揭露具體的個人資料內容**，只有出現具體內容才視為包含個資。

            ### 判斷為 true（包含個資）的條件如下：

            1. 明確出現電話號碼，例如：0912345678、(02)12345678
            2. 明確出現完整中文姓名（如「王小明」、「林大文」）
            3. 明確出現詳細地址（包含街道、門牌、樓層等），如「中山路100號5樓」
            4. 明確出現身分證字號或其他身份號碼（如「A123456789」）

            ### 以下情況一律判斷為 false（不構成個資揭露）：

            - **僅提及個資類型名稱**，例如：「身分證號碼被盜用」、「手機被偷」、「地址洩漏」、「補發身分證」
            - **敘述證件遺失、外洩、影本被偷等情境**，但未提供具體資料內容
            - **片段或模糊資訊**（如「我電話開頭是0912」、「身分證影本被偷走」）
            - **宣稱提供假資料或不確定性資訊**（如「這是假的」、「大概是 A12 開頭」）
            - **提及行政區或地區名稱**，但未提供街道或門牌號碼

            請**嚴格區分「提及資料類型」與「揭露資料內容」**。只有在問題中提供了完整、具體的個資內容，才視為 `sensitive_info_detected: true`。
            ===
            【輸出格式】
            請將兩個任務結果結合，以一個 JSON 物件格式返回，格式如下：
            ```json
            {{
            "departments": ["局處1", "局處2", "局處3"],
            "sensitive_info_detected": true 或 false
            }}
        """
        user_prompt = f"""
            使用者問題 : {self.query}
        """
        messages = [
            {"role":"system","content":system_prompt},
            {"role":"user","content":user_prompt}
        ]
        try:
            gpt = GPTHandler(api_key=env_utils.get_openai_key())
            with session_scope(self.session_maker) as session:
                try:
                    llm_response = gpt.run_gptModel(session=session,
                                        user=user,
                                        messages=messages,
                                        user_input=self.query,
                                        expert_data={"expert_id":self.expert_id,"expert_model":"gpt-4o-mini","expert_model_type":self.get_expert_model_type()},
                                        chat_uuid=chat_uuid,
                                        model_list_id=model_list_id,
                                        model="gpt-4o-mini",
                                        params={
                                            "max_tokens": 150,
                                            "temperature": 0,
                                            "frequency_penalty": 0,
                                            "top_p": 1.0,
                                        }
                                    )
                    llm_response = llm_response.replace("```json","").replace("```","").replace("'","\"") #type: ignore
                    json_response = json_loads(llm_response) #type: ignore
                    departments = json_response.get("departments",[])
                    sensitive_info_detected = json_response.get("sensitive_info_detected",False)
                    if not isinstance(departments, list):
                        raise ValueError("回傳結果不是陣列")
                    logger.debug(f"assess_target_dataset json_response: {departments}",extra={"history_message_id":self.history_message_id,"query":self.query})
                    if not departments:
                        return [],sensitive_info_detected
                    return [self.revert_dataset_mapping[name] for name in default_include_dataset_names_list + departments],sensitive_info_detected
                except KeyError as e:
                    logger.error(f"assess_target_dataset error: 知識庫名稱已改動，{e}。")
                    return [],False
                except ValueError as e:
                    logger.error(f"assess_target_dataset error: 解析失敗，{e},llm_response: {llm_response}")
                    return [],False
                except Exception as e:
                    logger.error(f"assess_target_dataset error: {e}, llm_response: {llm_response}")
                    return [],False
        except Exception as e:
            logger.error(f"assess_target_dataset error: {e}")
            return [],False
    def insert_message_chunk_mapping(self) -> None:
        if not self.history_message_id:
            return
        if getattr(self,"link_source_chunks",None):
            chunks: dict[str,dict[str,Any]] = {}
            with session_scope(self.session_maker) as session:
                for chunk in self.link_source_chunks:
                    for prev_chunk in chunk["prev"]:
                        chunks[prev_chunk["id"]] = prev_chunk
                    for next_chunk in chunk["next"]:
                        chunks[next_chunk["id"]] = next_chunk
                    chunks[chunk["target"]["id"]] = chunk["target"]
                for chunk_id,chunk in chunks.items():
                    insert_message_chunk_mapping(row=MessageChunkMapping_Schema(message_id=self.history_message_id,chunk_id=chunk_id,dataset_id=chunk["metadata"]["datasets_id"]),session=session)
    def insert_message_chunk_mapping_for_cache(self,chunk_ids:list[int]) -> None:
        if not self.history_message_id:
            return
        with session_scope(self.session_maker) as session:
            chunks: Sequence[ParentChunks_Schema] = select_parent_chunks_from_ids(node_ids=chunk_ids,session=session)
            for chunk in chunks:
                insert_message_chunk_mapping(row=MessageChunkMapping_Schema(message_id=self.history_message_id,chunk_id=chunk.id,dataset_id=chunk.meta_data["datasets_id"]),session=session)
    def stream_after(self,no_answer:bool, context: str, history_message_id: str,model_name: str,model_params:dict[str,Any],model_prompt:str) -> None:
        context = context[:context.find("＄＠！")]
        if self.current_user:
            self.insert_user_completion_history(user_id=self.current_user.uid,expert_id=self.expert_id,user_input=self.query,expert_output=context)
        threading.Thread(target=self.insert_cache,args=(no_answer,context,history_message_id,model_name,model_params,model_prompt)).start()
        threading.Thread(target=self.insert_message_chunk_mapping).start()
    
    def insert_user_completion_history(self,user_id:str,expert_id:str,user_input:str,expert_output:str) -> None:
        with session_scope(self.session_maker) as session:
            insert_user_completion_history(row=UserCompletionHistory_Schema(id=uuid4().hex,user_id=user_id,expert_id=expert_id,user_input=user_input,expert_output=expert_output),session=session)
    def get_query_embedding(self,query:str,embedding_model:str) -> tuple[list[float],bool]:
        cache_key: str = f"{query}_{embedding_model}"
        cache_embedding: list[
            float] | None = self.cache_client.get_embedding_cache(cache_key)
        if not cache_embedding:
            get_embedding: Iterator = get_openai_embeddings(
                [self.query], self.embeddings)
            query_embedding: list[float] = next(get_embedding)
            self.cache_client.set_embedding_cache(cache_key, query_embedding)
            return query_embedding,False
        return cache_embedding,True
    def handle(self, history_message_id,chat_uuid, expert_id, user: User, query,
               chat_context: list,scope_datasets:list[str]|None,vect_session:scoped_session):
        self.current_user = user
        self.query = query
        self.related_image_uuids = []
        self.related_image_urls = []        
        logger.debug("KnowledgeHandler Step 1 : before handle",extra={"history_message_id":history_message_id,"expert_id":expert_id,"query":query})
        self.history_message_id = history_message_id
        with session_scope(self.session_maker) as session:
            try:
                enable_context_history = self.expert_config.get("enable_context_history",False)
                if enable_context_history:
                    last_completion_history = select_user_completion_history(user_id=user.uid,expert_id=expert_id,limit=1,session=session)
                    if last_completion_history:
                        #TODO: 先寫死用 gpt-4o-mini 模型，之後要改掉
                        gpt_4o_mini_model_list_id = 57
                        self.query = self.rewrite_query(user=user,model_list_id=gpt_4o_mini_model_list_id,chat_uuid=chat_uuid,last_completion_history=last_completion_history)
            except Exception as e:
                logger.error(f"Failed to select user completion history: {e}")
            try:
                self.query= DateReplacer.replace_dates(self.query)
            except Exception as e:
                logger.error(f"DateReplacer error: {e}")
            logger.debug("KnowledgeHandler Step 2 : after DateReplacer",extra={"original_query":query,"replaced_query":self.query,"history_message_id":history_message_id})
            self.query_embedding:list[float] = []
            self.ner_result:str = ""
            logger.debug(
                f"self.dataset.search_kwargs {self.dataset.search_kwargs}")
            logger.debug(f"KnowledgeHandler query:{self.query}")
            logger.info(f"dataset.search_kwargs {self.dataset.search_kwargs}")
            logger.info(f"loading dataset {self.dataset.folder_name} finished.")
            self.load_expert_model_config(expert_id)
            logger.debug("KnowledgeHandler Step 3 : after load_expert_model_config",extra={"expert_model_config":self.model_config,"history_message_id":history_message_id})
            k = int(self.model_config["search"]['search_kwargs'].get("k",5)) or 5
            expert_score_threshold = self.model_config["search"]['search_kwargs'].get("score_threshold",0.4) or 0.4
            if scope_datasets is not None and len(scope_datasets) > 0:
                scope_collections: list[VectorDatabase] = [collection for collection in self.collections if getattr(collection,"folder_name") in scope_datasets]
            else:
                scope_collections = self.collections
            collection_dataset_map = {collection: dataset for dataset, collection in zip(self.datasets, self.collections) if collection in scope_collections}
            logger.debug("KnowledgeHandler Step 4 : after load collection_dataset_map",extra={"history_message_id":history_message_id})
            logger.debug("KnowledgeHandler Step 5 : before get_query_embedding",extra={"history_message_id":history_message_id})
            self.query_embedding,use_cache = self.get_query_embedding(self.query,self.embeddings)
            if not use_cache:
                with session_scope(self.session_maker) as session:
                    entry = ExpertEmbeddingTokenLogEntry(
                        model=self.embeddings,
                        model_id=85,
                        expert_id=expert_id,
                    )
                    LoggerUtils.token_from_expert_embedding(self.query, entry,session)
            logger.debug("KnowledgeHandler Step 6 : after get_query_embedding",extra={"history_message_id":history_message_id})
            priority_setting:list[float] | None = self.expert_config.get("dataset_priority_setting")
            collections_limits:list[CollectionLimit] =[CollectionLimit(collection_name=dataset.folder_name,limit=min(dataset.config_jsonb['search_kwargs'].get("k", k)*3, 30),score_threshold=max(dataset.config_jsonb['search_kwargs'].get("score_threshold", 0.3) or 0.3,expert_score_threshold),priority=dataset.config_jsonb.get('sort_priority',5)) for dataset in collection_dataset_map.values()]
            logger.debug("KnowledgeHandler Step 7 : before search embedding",extra={"history_message_id":history_message_id})
            try:
                # 添加帶有時間戳的詳細日誌
                search_start = datetime.now()
                logger.debug("開始併發向量搜索和全文搜索", extra={"history_message_id": history_message_id, "query": self.query})
                
                # 定義向量搜索函數
                def vector_search(history_message_id):
                    try:
                        logger.debug("向量搜索處理中", extra={"history_message_id": history_message_id})
                        # 優化1: 限制初始檢索數量，避免過多結果
                        child_nodes_iter: Iterator[SearchContentDocument] = self.collections[0].search_embedding_by_score_threshold(
                                collections_limits=collections_limits,
                                query_embedding=self.query_embedding
                            )
                        
                        # 優化2: 避免無限制收集結果
                        max_child_nodes = 200  # 設置合理的上限
                        result_nodes = []
                        for i, child_node in enumerate(child_nodes_iter):
                            if i >= max_child_nodes:
                                break
                            result_nodes.append(child_node)
                        
                        vector_end = datetime.now()
                        logger.debug("向量搜索完成", extra={
                            "history_message_id": history_message_id,
                            "耗時(秒)": (vector_end - search_start).total_seconds(),
                            "結果數量": len(result_nodes)
                        })
                        return result_nodes
                    except Exception as e:
                        logger.error(f"向量搜索執行出錯: {e}")
                        return []
                
                # 定義全文搜索函數
                def fulltext_search(history_message_id):
                    try:
                        logger.debug("全文搜索處理中", extra={"history_message_id": history_message_id})
                        processed_query = self.build_tsquery(self.query)
                        
                        if not processed_query["zh_tsquery"] and not processed_query["en_tsquery"]:
                            logger.debug("跳過全文搜索 - 無有效關鍵詞", 
                                        extra={"history_message_id": history_message_id})
                            return []
                        result_nodes = []
                        collection_names = [collection.collection_name for collection in self.collections]
                        batch_size = 15
                        for i in range(0, len(collection_names), batch_size):
                            batch_collections = collection_names[i:i+batch_size]
                            
                            # 使用 IN 子句合併查詢多個 collection
                            fulltext_query = f"""
                                SELECT 
                                    id,
                                    content,
                                    meta_data,
                                    collection_name,
                                    ts_rank_cd(text_search_zh, to_tsquery('jiebacfg', '{processed_query["zh_tsquery"]}')) + 
                                    ts_rank_cd(text_search_en, to_tsquery('english', '{processed_query["en_tsquery"]}')) as rank_score
                                FROM public.chunk_openai_3072_vectors
                                WHERE collection_name IN ({', '.join([f"'{name}'" for name in batch_collections])})
                                    AND (
                                        {" OR ".join([
                                            f"text_search_zh @@ to_tsquery('jiebacfg', '{processed_query['zh_tsquery']}')" if processed_query['zh_tsquery'] else "false",
                                            f"text_search_en @@ to_tsquery('english', '{processed_query['en_tsquery']}')" if processed_query['en_tsquery'] else "false"
                                        ])}
                                    )
                                ORDER BY rank_score DESC
                                LIMIT 80;
                            """
                            
                            try:
                                result_rows = vect_session.execute(text(fulltext_query)).fetchall()
                                
                                for _row in result_rows:
                                    result_nodes.append(
                                        SearchContentDocument(
                                            id=_row[0],
                                            score=_row[4],
                                            content=_row[1],
                                            metadata=_row[2]
                                        )
                                    )
                            except Exception as e:
                                logger.error(f"執行全文檢索 SQL 時出錯: {e}")
                        result_nodes.sort(key=lambda x: x.score, reverse=True)
                        fulltext_end = datetime.now()
                        logger.debug("全文搜索完成", extra={
                            "history_message_id": history_message_id,
                            "耗時(秒)": (fulltext_end - search_start).total_seconds(),
                            "結果數量": len(result_nodes)
                        })
                        return result_nodes[:150]
                    except Exception as e:
                        logger.error(f"全文搜索執行出錯: {e}")
                        return []
                
                embedding_child_nodes = []
                fulltext_nodes = []
                enable_fulltext_search = False
                with ThreadPoolExecutor(max_workers=2) as executor:
                    # 提交兩個任務並獲取 future 對象
                    vector_future = executor.submit(vector_search, history_message_id)
                    settings = select_settings_from_key(key="enable_fulltext_search",session=session)
                    if settings:
                        enable_fulltext_search = str(settings.value) == '1'
                    if enable_fulltext_search:
                        fulltext_future = executor.submit(fulltext_search, history_message_id)
                    
                    # 獲取結果 (會自動等待任務完成)
                    embedding_child_nodes = vector_future.result()
                    if enable_fulltext_search:
                        fulltext_nodes = fulltext_future.result()
                
                search_end = datetime.now()
                logger.debug("向量搜索和全文搜索均已完成", extra={
                    "history_message_id": history_message_id,
                    "總耗時(秒)": (search_end - search_start).total_seconds(),
                    "向量結果數量": len(embedding_child_nodes),
                    "全文結果數量": len(fulltext_nodes)
                })
                
                # 如果向量搜索沒有結果且需要結果，則拋出異常
                if len(embedding_child_nodes) == 0 and len(fulltext_nodes) == 0:
                    logger.debug("KnowledgeHandler Step 10 : end with no child_nodes",extra={"history_message_id":history_message_id})
                    no_data_found = self.expert_config.get(
                            "no_data_found",
                            "不好意思，查無相關資料，你可以嘗試換個方式詢問"
                        )
                    raise AssertionError(
                        no_data_found or "不好意思，查無相關資料，你可以嘗試換個方式詢問"
                    )
                
            except AssertionError:
                raise
            except Exception as e:
                logger.error(f"併發搜索失敗: {e}")
                raise
            logger.debug("KnowledgeHandler Step 8 : before rrf_sort",extra={"history_message_id":history_message_id})
            start_time = datetime.now()

            rrf_k = 60  # RRF 参数
            if len(fulltext_nodes) > 0 and len(embedding_child_nodes) > 0:
                # 優化：限制參與排序的文檔數量
                max_ranking_docs = 200  # 設定上限
                
                # 如果文檔太多，優先保留分數較高的文檔
                if len(embedding_child_nodes) > max_ranking_docs:
                    embedding_child_nodes = sorted(embedding_child_nodes, key=lambda x: x.score, reverse=True)[:max_ranking_docs]
                
                if len(fulltext_nodes) > max_ranking_docs:
                    fulltext_nodes = sorted(fulltext_nodes, key=lambda x: x.score, reverse=True)[:max_ranking_docs]
                
                all_doc_ids = set(node.id for node in embedding_child_nodes).union(set(node.id for node in fulltext_nodes))
                
                # 優化：預先建立映射以避免重複搜索
                embedding_child_nodes_map = {node.id: (i, node) for i, node in enumerate(embedding_child_nodes)}
                fulltext_nodes_map = {node.id: (i, node) for i, node in enumerate(fulltext_nodes)}
                
                doc_ranks = {}
                for doc_id in all_doc_ids:
                    embedding_child_info = embedding_child_nodes_map.get(doc_id, (float('inf'), None))
                    fulltext_info = fulltext_nodes_map.get(doc_id, (float('inf'), None))
                    
                    doc_ranks[doc_id] = {
                        'vector_rank': embedding_child_info[0] + 1 if embedding_child_info[0] != float('inf') else float('inf'),
                        'fulltext_rank': fulltext_info[0] + 1 if fulltext_info[0] != float('inf') else float('inf'),
                        'node': embedding_child_info[1] or fulltext_info[1]
                    }
                
                for doc_id, ranks in doc_ranks.items():
                    vector_score = 1.0 / (ranks['vector_rank'] + rrf_k) if ranks['vector_rank'] != float('inf') else 0
                    fulltext_score = 1.0 / (ranks['fulltext_rank'] + rrf_k) if ranks['fulltext_rank'] != float('inf') else 0
                    ranks['rrf_score'] = vector_score + fulltext_score
                
                # 按 RRF 得分排序
                sorted_doc_ids = sorted(doc_ranks.keys(), key=lambda x: doc_ranks[x]['rrf_score'], reverse=True)
                merged_nodes = [doc_ranks[doc_id]['node'] for doc_id in sorted_doc_ids if doc_ranks[doc_id]['node'] is not None]
                logger.debug("KnowledgeHandler Step 9 : after rrf_sort",extra={"history_message_id":history_message_id})
            else:
                logger.debug("KnowledgeHandler Step 9 : after rrf_sort",extra={"history_message_id":history_message_id})
                if len(embedding_child_nodes) > 0:
                    merged_nodes = embedding_child_nodes
                else:
                    logger.debug("KnowledgeHandler Step 10 : end with no child_nodes",extra={"history_message_id":history_message_id})
                    no_data_found = self.expert_config.get(
                            "no_data_found",
                            "不好意思，查無相關資料，你可以嘗試換個方式詢問"
                        )
                    raise AssertionError(
                        no_data_found or "不好意思，查無相關資料，你可以嘗試換個方式詢問"
                    )
            end_time = datetime.now()
            logger.debug("RRF排序完成", extra={"history_message_id": history_message_id, 
                                            "耗時": (end_time - start_time).total_seconds(),
                                            "合併後結果數量": len(merged_nodes)})
            parent_id_to_max_score = {}
            for child_node in merged_nodes:
                    parent_id = int(child_node.metadata["parent_node"])
                    current_max_score = parent_id_to_max_score.get(parent_id, 0.0)
                    parent_id_to_max_score[parent_id] = max(current_max_score, child_node.score)
            # 使用 list comprehension 獲取所有 parent IDs
            all_parent_ids = {int(node.metadata["parent_node"]) for node in merged_nodes}
            
            # 一次性查詢所有 parent chunks 並建立映射
            with self.session_maker() as db_session:
                # 優化：避免重複計算 hash 以及大量字符串操作
                precomputed_hashes = {}
                
                # 批次查詢所有 parent chunks
                parent_chunks: Sequence[ParentChunks_Schema] = select_parent_chunks_from_ids(list(all_parent_ids), db_session)
                parent_chunks_map = {chunk.id: chunk for chunk in parent_chunks}
                
                # 使用 set 去重並追蹤已處理的內容
                content_hash_set = set()
                parent_node_docs: list[SearchContentDocument] = []
                
                # 根據分數排序處理 parent chunks，並設定提前退出條件
                doc_limit = min(k * 5 if priority_setting is not None else k, 50)  # 增加上限限制
                sorted_parent_ids = sorted(all_parent_ids, key=lambda x: parent_id_to_max_score.get(x, 0.0), reverse=True)
                
                for parent_id in sorted_parent_ids:
                    if parent_id not in parent_chunks_map:
                        continue
                        
                    parent = parent_chunks_map[parent_id]
                    
                    # 懶加載計算 hash，避免無謂計算
                    if parent_id not in precomputed_hashes:
                        precomputed_hashes[parent_id] = hashlib.md5(parent.page_content.encode()).hexdigest()
                    content_hash = precomputed_hashes[parent_id]
                    
                    if content_hash not in content_hash_set:
                        content_hash_set.add(content_hash)
                        parent_node_docs.append(
                            SearchContentDocument(
                                metadata=parent.meta_data,
                                content=parent.page_content,
                                id=str(parent.id),
                                score=parent_id_to_max_score[parent.id]
                            )
                        )
                        
                        if len(parent_node_docs) >= doc_limit:
                            break
            parent_node_docs.sort(key=lambda x: x.score, reverse=True)
            logger.debug("KnowledgeHandler Step 10 : after processing all nodes", 
                        extra={
                            "history_message_id": history_message_id,
                            "total_child_nodes": len(merged_nodes),
                            "unique_parent_nodes": len(parent_node_docs)
                        })
            logger.debug("KnowledgeHandler Step 11 : before use_enhanced_department_rank",extra={"history_message_id":history_message_id})
            if self.expert_config.get("use_enhanced_department_rank",False):
                distinct_dataset_names_list = list(set([doc.metadata.get("datasets_id","") for doc in parent_node_docs]))
                #TODO: 先寫死用 gpt-4o-mini 模型，之後要改掉
                gpt_4o_mini_model_list_id = 57
                target_dataset_names_list,sensitive_info_detected = self.assess_target_and_sensitive(distinct_dataset_names_list,user,gpt_4o_mini_model_list_id,chat_uuid)
                if sensitive_info_detected:
                    sensitive_detected_msg = self.expert_config.get(
                        "sensitive_detected_msg",
                        "⚠️ 偵測到輸入中包含個人敏感資訊，請勿提供電話、身分證、詳細地址等個資，並重新提問。"
                    )
                    raise AssertionError(sensitive_detected_msg or "⚠️ 偵測到輸入中包含個人敏感資訊，請勿提供電話、身分證、詳細地址等個資，並重新提問。")
                if target_dataset_names_list:
                    embedding_child_nodes = [doc for doc in embedding_child_nodes if doc.metadata.get("datasets_id") in target_dataset_names_list]
            logger.debug("KnowledgeHandler Step 12 : after use_enhanced_department_rank",extra={"history_message_id":history_message_id})
            logger.debug("KnowledgeHandler Step 13 : before dataset_rank_docs",extra={"history_message_id":history_message_id})
            if priority_setting  is not None:
                dataset_rank_docs: list[SearchContentDocument] = []
                datasets_level_map = {}
                
                # 創建資料集優先級對應表
                for dataset in self.datasets:
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
                logger.debug("KnowledgeHandler Step 14 : after dataset_rank_docs",extra={"history_message_id":history_message_id,"len(result_docs)":len(result_docs)})
            else:
                result_docs: list[SearchContentDocument] = parent_node_docs[:k]
                logger.debug("KnowledgeHandler Step 14 : after parent_node_docs[:k]",extra={"history_message_id":history_message_id,"len(result_docs)":len(result_docs)})

            self.result_chunk = result_docs
            link_chunk_level = int(self.expert_config.get("link_chunk_level",0))
            source_chunks: list[dict[str, Any]] = []
            logger.debug("KnowledgeHandler Step 15 : before get_chunks_with_levels",extra={"history_message_id":history_message_id})
            backend_host: str | None = getenv("IMAGE_DOWNLOAD_DOMAIN")
            assert backend_host, "AVA_BACKEND_URL is not set"
            if backend_host and not backend_host.endswith('/'):
                backend_host += '/'
            for doc in result_docs:
                for image_uuid in doc.metadata.get("related_image_uuids", []):
                    if image_uuid in self.related_image_uuids:
                        continue
                    self.related_image_uuids.append(image_uuid)
                    self.related_image_urls.append(f"[{image_uuid}.jpeg]({urljoin(backend_host,f"download/{image_uuid}")})")  # 這裡的 file extension 應該要拿真正的，而不是寫死為 jpeg
            for doc in result_docs:
                obj: dict[str, Any] = {"target": doc.model_dump()}
                
                prev_chunks = self.get_chunks_with_levels(doc.metadata.get("prev_node"), "prev_node", link_chunk_level,session)
                next_chunks = self.get_chunks_with_levels(doc.metadata.get("next_node"), "next_node", link_chunk_level,session)

                obj["prev"] = prev_chunks
                obj["next"] = next_chunks

                source_chunks.append(obj)
            self.link_source_chunks = source_chunks
            logger.debug("KnowledgeHandler Step 16 : after get_chunks_with_levels",extra={"history_message_id":history_message_id,"len(source_chunks)":len(source_chunks)})
            logger.debug("KnowledgeHandler Step 17 : before get_extra_cache_result",extra={"history_message_id":history_message_id})
            if( extra_cache_chunk := self.get_extra_cache_result(query=self.query)) is not None:
                self.extra_chunk = [{"type":"extra_chunk"},[doc.content for doc in extra_cache_chunk]]
            logger.debug("KnowledgeHandler Step 18 : after get_extra_cache_result",extra={"history_message_id":history_message_id})
            logger.debug("KnowledgeHandler Step 19 : before form_binding_ids",extra={"history_message_id":history_message_id})
            form_binding_ids =list({binding_form for doc in result_docs for binding_form in json_loads(doc.metadata.get("binding_form","[]"))})
            if form_binding_ids:
                with self.session_maker() as db_session:
                    form_binding_rows: Sequence[FormConfiguration_Schema] = select_form_config_from_ids(form_ids=form_binding_ids, session=db_session)
                    self.form_binding =[{
                                    "type": "html_json"
                                }, [
                            {
                                "tag":"button",
                                "text":f"填寫 {form.form_name}",
                                "action":"tunnelStart",
                                "args":[form.form_name]
                            } for form in form_binding_rows
                        ]]
            logger.debug("KnowledgeHandler Step 20: after form_binding_ids",extra={"history_message_id":history_message_id})
            logger.debug("KnowledgeHandler Step 21 : before contact_and_remove_duplicates",extra={"history_message_id":history_message_id})
            chunk_context_map, chunk_map,origin_chunk_map = self.contact_and_remove_duplicates(source_chunks)
            logger.debug("KnowledgeHandler Step 22 : after contact_and_remove_duplicates",extra={"history_message_id":history_message_id})
            logger.debug("KnowledgeHandler Step 23 : before build_chunk_graph",extra={"history_message_id":history_message_id})
            graph = self.build_chunk_graph(chunk_map)
            logger.debug("KnowledgeHandler Step 24 : after build_chunk_graph",extra={"history_message_id":history_message_id})
            logger.debug("KnowledgeHandler Step 25 : before find_connected_components",extra={"history_message_id":history_message_id})
            connected_components = self.find_connected_components(graph,chunk_map,link_chunk_level)
            logger.debug("KnowledgeHandler Step 26 : after find_connected_components",extra={"history_message_id":history_message_id})
            logger.debug("KnowledgeHandler Step 27 : before prepare _file_connected_components",extra={"history_message_id":history_message_id})
            _file_connected_components = defaultdict(list)
            with self.session_maker() as db_session:
                distinct_dataset_ids = {chunk.metadata['datasets_id'] for chunk in result_docs}
                row_dataset_dict = {dataset_id : select_datasets_from_id(datasets_id=dataset_id, session=db_session) for dataset_id in distinct_dataset_ids}
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
            logger.debug("KnowledgeHandler Step 28 : after prepare _file_connected_components",extra={"history_message_id":history_message_id})
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
            logger.debug("KnowledgeHandler Step 29 : before sort _source_chunks",extra={"history_message_id":history_message_id})
            for _chunks in _source_chunks:
                _chunks.sort(key=lambda c : int(c[0]["id"]))
            _source_chunks.sort(key=get_update_time, reverse=True)
            logger.debug("KnowledgeHandler Step 30 : after sort _source_chunks",extra={"history_message_id":history_message_id})
            self.source_chunk = [{"type": "source_chunk"},_source_chunks ]
            logger.debug("KnowledgeHandler Step 31 : before get_knowledge_cache_result",extra={"history_message_id":history_message_id})
            if (cache_answer:=self.get_knowledge_cache_result(self.query,original_chunks=result_docs,skip_cache=self.skip_cache)) is not None:
                question,answer,cache_id,no_answer = cache_answer
                logger.info(f"Cache hit from query: {self.query}, question: {question}, expert_id: {expert_id}, original_chunks: {[doc.id for doc in result_docs]}")
                self.has_cache = True
                logger.debug("KnowledgeHandler Step 32 : end with cache result",extra={"history_message_id":history_message_id,"cache_id":cache_id})
                return [answer,cache_id]
            logger.debug("KnowledgeHandler Step 32 : after get_knowledge_cache_result",extra={"history_message_id":history_message_id})
            logger.debug("KnowledgeHandler Step 33 : before enumerate _source_chunks",extra={"history_message_id":history_message_id})
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
                        _row_crawler: Crawler_Schema | None = select_crawler_by_id(crawler_id=_crawler_id,session=session)
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
                                extra_chunk = select_crawler_documents_extra_from_id(crawler_documents_extra_id=extra_id,session=session)
                                assert extra_chunk, f"extra_chunk not found, extra_id: {extra_id}"
                                file_level_contnets.append(extra_chunk.extra_text)
                                file_level_contnets.append("\n")
                        file_level_contnets.append(chunk_context_map[chunk["id"]])
                        file_level_contnets.append("...\n")
                block_tag_description = f'\n<block id={index} {final_apply_datasource_url} update_time="{_update_time}">\n{concat_datasource_str}\n{"\n".join(file_level_contnets)}\n</block>\n'
                context.append(block_tag_description)
            logger.debug("KnowledgeHandler Step 34 : after enumerate _source_chunks",extra={"history_message_id":history_message_id})
            context.append("</context>\n")
            if self.ner_result is not None and self.ner_result.strip() != "":
                query_with_context = f"Q: {self.query}\nNER: {self.ner_result}\n"
            else :
                query_with_context = f"Q: {self.query}\n"
            doc_logger.info(
                f"U:{user.userNo} Q:{self.query} ================ \n {
                    query_with_context} \n"
            )
            logger.debug("KnowledgeHandler Step 35 : end with normal result",extra={"history_message_id":history_message_id})
            if len(self.related_image_uuids) > 0:

                related_image_prompt = """
                    提供的圖片連結依序如下:
                """
                for image_url in self.related_image_urls:
                    related_image_prompt += f"{image_url}\n"
                query_with_context += related_image_prompt
                return ["".join(context), query_with_context, self.related_image_uuids]
            else:
                return ["".join(context), query_with_context]
    
    def build_tsquery(self,query: str) -> dict:
        try:
            # 添加計時
            start_time = datetime.now()
            
            if not query or len(query) < 2:
                return {"zh_tsquery": "", "en_tsquery": ""}
            
            # 使用編譯好的正則提高效率
            zh_re = re.compile(r'[\u4e00-\u9fff]+')
            en_re = re.compile(r'[a-zA-Z]+')

            max_query_len = 100
            if len(query) > max_query_len:
                query = query[:max_query_len]
            
            # 中文分詞
            zh_tokens = jieba.cut(query, cut_all=False)
            zh_clean = [t for t in zh_tokens if zh_re.fullmatch(t) and t not in CHINESE_STOPWORDS and len(t) > 1]
            
            # 英文分詞
            en_tokens = en_re.findall(query)
            en_clean = [t.lower() for t in en_tokens if t.lower() not in ENGLISH_STOPWORDS and len(t) > 1]
            
            max_terms = 10
            if len(zh_clean) > max_terms:
                zh_clean = zh_clean[:max_terms]
            if len(en_clean) > max_terms:
                en_clean = en_clean[:max_terms]
            
            zh_clean = [re.sub(r'[\\\'"%&|:!<>(){}[\]^~*?]', '', term) for term in zh_clean]
            en_clean = [re.sub(r'[\\\'"%&|:!<>(){}[\]^~*?]', '', term) for term in en_clean]
            
            # 刪除空元素
            zh_clean = [t for t in zh_clean if t]
            en_clean = [t for t in en_clean if t]
            
            end_time = datetime.now()
            logger.debug(f"build_tsquery 耗時: {(end_time-start_time).total_seconds()}秒",
                       extra={"zh_terms": len(zh_clean), "en_terms": len(en_clean)})
            
            return {
                "zh_tsquery": " | ".join(zh_clean) if zh_clean else "",
                "en_tsquery": " | ".join(en_clean) if en_clean else ""
            }
        except Exception as e:
            logger.error(f"build_tsquery error: {e}")
            # 返回安全的空查詢
            return {"zh_tsquery": "", "en_tsquery": ""}
    
    def contact_and_remove_duplicates(self, source_chunks: list[dict[str, Any]]) -> tuple[dict[Any, Any], dict[Any, Any],dict[str,Any]]:
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
    
    def build_chunk_graph(self, chunk_map: dict[str, Any]) -> dict[str, Any]:
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



    def find_connected_components(self, graph: dict[str, Any],chunk_map:dict[str,Any],chunk_level:int):
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
    def load_expert_model_config(self,expert_id=None):
        with self.session_maker() as session:
            if not expert_id:
                expert_id = self.expert_id
            row_expert = select_expert_from_id(expert_id=expert_id,session=session)
            assert row_expert
            if isinstance(row_expert.config_jsonb,dict):
                expert_config_json:dict = row_expert.config_jsonb
            elif isinstance(row_expert.config_jsonb,str):
                expert_config_json:dict = json_loads(row_expert.config_jsonb)
            self.expert_config = expert_config_json
            self.model_config = get_model_and_params(expert_config_json=self.expert_config,session=session)
    def get_job_title(self, num):
        job_titles = {
            "01": "董事長",
            "02": "總經理",
            "40": "護士",
            "04": "副總經理",
            "05": "助理副總經理",
            "06": "顧問",
            "11": "協理",
            "12": "高級工程師",
            "13": "主任稽核",
            "21": "經理",
            "22": "專業工程師",
            "30": "專案經理",
            "30A": "資深工程師",
            "30B": "資深管理師",
            "31": "工程師",
            "32": "管理師",
            "33": "助理工程師",
            "34": "助理管理師",
            "3A": "資深工程師",
            "3B": "資深管理師",
            "41": "技術員",
            "42": "管理員",
        }
        return job_titles.get(num, "無此職稱")

    def get_intention(self):
        return "Answer user questions through RAG technology"

    def get_dataset_folder_name(self):
        return self.dataset.folder_name

    def get_examples(self) -> list:
        return self.dataset.examples

    def get_system_prompt(self):
        self.load_expert_model_config()
        basic_prompt = """
        僅使用提供的文本回答問題，若答案沒有在參考來源中:
        1. 直接回答"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。"
        2. 不要提供任何其他解釋或猜測。
        3. 結束回答。
        如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答 "不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。"。
        """
        # 取得 system_prompt，若找不到則使用空字串
        system_prompt = self.model_config["search"]["params"].get("system_prompt", "") or basic_prompt
        
        # no_answer
        no_answer_detection_prompt = """
        Always include a ＄＠！<no_answer> section with new line at the end of the response. If the question has an answer, output ＄＠！<no_answer>false</no_answer>. Otherwise, output ＄＠！<no_answer>true</no_answer>.
        """

        #  加入現在時間供 llm 參考，提供西元年及民國年
        now_time: datetime = datetime.now()
        now_time_prompt = f"""
            現在時間: {now_time.strftime("%Y-%m-%d %H:%M:%S")}
            民國年: {now_time.year - 1911}年
            西元年: {now_time.year}年
            月份: {now_time.month}月
            日期: {now_time.day}日
        now_time_prompt_end
        """

        # 取得 default_system_prompt 的 ID，若 ID 為 0 或找不到，則使用空字串
        default_prompt = ""
        prompt_id = self.model_config["search"]["params"].get("default_system_prompt")
        with self.session_maker() as session:
            if prompt_id and prompt_id != 0:
                row_prompt: DefaultPrompt_Schema | None = select_default_prompt_by_id(prompt_id=prompt_id,session=session)
                if row_prompt:
                    default_prompt = row_prompt.content or ""

            default_no_answer_detection_prompt = select_settings_from_key(key="no_answer_detection_prompt",session=session)
            if default_no_answer_detection_prompt is not None and default_no_answer_detection_prompt.value is not None and default_no_answer_detection_prompt.value.strip() != "":
                no_answer_detection_prompt = default_no_answer_detection_prompt.value.strip()

        # 將 system_prompt 和 default_prompt 合併並返回
        return f"{now_time_prompt}\n{default_prompt}\n{system_prompt}\n{no_answer_detection_prompt}"
        
        """
            留存參考來源prompt
            If you have the answer to a question, please include a reference source at the end of your answer, but do not repeat any existing reference sources.
            如果您有問題的答案，請在答案的最後加上參考來源，但請不要重複任何現有的參考來源。
            使用markdown語法進行超連結，格式為`[]()`。在`[]`中插入`originalname`的值，表示文件名，不要更改它。
            在`()`中插入{env_utils.get_ava_backend_url()}/download/ + Metadata的`filename`的值。
            如果有多個來源，請繼續按照示例顯示。
            來源: [xxxxxx]({env_utils.get_ava_backend_url()}/download/5a18d1c0-6284-41d9-92ce-694c131de770.pdf)、
            [xxxx維修紀錄2]({env_utils.get_ava_backend_url()}/download/5a18d1c0-6284-41d9-92ce-0b766b519a71.pdf)
        """

    def is_streaming(self):
        return True

    def set_llm_config(self):
        return True

    def get_intention_type(self):
        return "Q"

    def get_expert_model_type(self):
        return "1"

    def get_llm_model(self):
        self.load_expert_model_config()
        return self.model_config["search"]["model"]
    
    def get_llm_model_list_id(self):
        self.load_expert_model_config()
        return self.model_config["search"]["model_list_id"]
    
    def return_directly(self):
        return self.has_cache

    def get_llm_model_params(self):
        self.load_expert_model_config()
        return self.model_config["search"]["params"]
    def get_llm_model_vendor(self):
        self.load_expert_model_config()
        return self.model_config["search"]["vendor"]
    def append_form_binding(self):
        if not self.form_binding:
            return ""
        logger.debug(f"append_form_binding {self.form_binding}")
        return self.form_binding
    def get_source_chunk(self):
        if not self.source_chunk:
            return ""
        return self.source_chunk
    def get_extra_chunk(self):
        if not self.extra_chunk:
            return ""
        return self.extra_chunk