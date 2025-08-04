import importlib
import re
from typing import Sequence

from ava.clients.sql.crud import (select_binding_dataset_by_expert,
                                  select_expert_skills_class,
                                  select_experts_ids)
from ava.clients.sql.database import scoped_session
from ava.clients.sql.schema import Skill_Schema
from ava.handlers.Knowledge import *
from langchain_openai import ChatOpenAI

logger = logging.getLogger("ava_app")


class HandlerProcessor:

    def __init__(self,session_maker:scoped_session):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,
            max_tokens=1000
        )
        # self.embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        self.session_maker = session_maker
        self.handler_db = self.init_handlers()
    def get_experts_skills(self, expert_id):
        expert_classes = []

        try:
            with self.session_maker() as session:
                results: Sequence[Skill_Schema] = select_expert_skills_class(
                    expert_id=expert_id,session=session)
            logger.debug(f"get_experts_skills results: {results}")
            return results
        except Exception as error:
            logger.exception(error)
            logger.error(f"An error occurred: {error}")
        logger.debug(f"get_experts_skills expert_classes {expert_classes}")
        # return expert_classes

    def load_webapi_handlers(self, expert_id):
        webapi_handlers = []
        skill_handlers: Sequence[Skill_Schema] | None = self.get_experts_skills(expert_id)
        try:
            if skill_handlers is not None:
                for skill_class in skill_handlers:
                    if skill_class.class_.startswith("_"):
                        ptn = r"_([A-Za-z]+)_([A-Za-z0-9]+)"
                        match = re.search(ptn, skill_class.class_)
                        assert match, f"{skill_class.class_} in illegal format"
                        runner = match.group(1)
                        skill_name = match.group(2)
                        logger.info(
                            f"Runner [{runner}] with skill [{skill_name}] loading...")
                        handler_modules = importlib.import_module("ava.handlers." +
                                                                runner)
                        class_ = getattr(handler_modules, runner)
                        handler_object = class_(self.llm,skill_class.id,skill_name)
                        if getattr(handler_object,"set_session_maker",None):
                            handler_object.set_session_maker(self.session_maker)
                        handler_object.load_skill()
                        logger.info(f"finished !")
                    else:
                        logger.info(f"skill class name:{skill_class.class_} loading ...")
                        handler_modules = importlib.import_module("ava.handlers." +
                                                                skill_class.class_)
                        class_ = getattr(handler_modules, skill_class.class_)
                        handler_object = class_(self.llm,skill_class.id,skill_class.class_)
                        if getattr(handler_object,"set_session_maker",None):
                            handler_object.set_session_maker(self.session_maker)
                        logger.info(f"handler_object initialized:{skill_class.class_}!")
                    webapi_handlers.append(handler_object)
            return webapi_handlers
        except Exception as error:
            logger.error(f"load_webapi_handlers error : {error}")
            return []
    def load_experts(self):
        try:
            with self.session_maker() as session:
                experts = select_experts_ids(session=session)
                return experts  # 返回包含所有專家ID的experts列表。
        except Exception as error:
            logger.error(f"An error occurred: {error}")
            return []

    def load_expert_handlers(self, expert_id):
        expert_handlers = []
        with self.session_maker() as session:
            results = select_binding_dataset_by_expert(expert_id=expert_id,session=session)
            # 根據datasource的type來加載不同的handlers
            # TODO 資料集多來源會出現問題 其實這邊就是去撈全部的資料集 根本不管A跟B A跟B是流程

        knowledge_handlers_loaded = False
        for result in results:
            dtype = result[0]
            config_jsonb = result[1]
            # 這邊是因為如果沒有值 那就是舊的 text-embedding-ada-002 模型 新的都會有值
            logger.debug(f"expert_id: {expert_id} config_jsonb: {
                         config_jsonb}")
            embedding_model = config_jsonb.get(
                'embedding_model') or "text-embedding-3-large"
            logger.debug(f"expert_id: {expert_id} embedding_model: {
                         embedding_model}")

            # 更新 self.embeddings 為當前 datasource 的 embedding_model
            if embedding_model:
                embeddings = embedding_model

            if (dtype == "A"  or dtype== "B") and knowledge_handlers_loaded is False:  # 只加載 knowledge_handler 一次
                logger.debug("load knowledge handlers")
                knowledge_handlers = load_knowledge_handlers(
                    expert_id, embeddings,self.session_maker)  # 使用當前datasource的embedding_model
                logger.debug(f"knowledge_handlers:{knowledge_handlers}")
                expert_handlers.extend(knowledge_handlers)
                logger.debug(f"expert_handlers:{expert_handlers}")
                knowledge_handlers_loaded = True

        # 從 self.load_webapi_handlers 獲取處理器列表並將其元素加入到 expert_handlers
        logger.debug("load webapi handlers")
        webapi_handlers = self.load_webapi_handlers(expert_id)
        expert_handlers.extend(webapi_handlers)

        return expert_handlers

    def init_handlers(self):
        all_experts = self.load_experts()
        logger.debug(f"all_experts:{all_experts}")
        return {
            expert_id: self.load_expert_handlers(expert_id)
            for expert_id in all_experts
        }

    def refresh_handlers(self):
        self.handler_db = self.init_handlers()

    def get_handlers(self, ava_name):
        handlers = self.handler_db.get(ava_name)
        assert handlers is not None, f"ava:{ava_name} 尚未設定此專家技能與知識庫，請聯絡管理員。"
        return handlers
