import logging
import re
from abc import abstractmethod
from typing import Dict

import requests
from ava.clients.sql.crud import select_expert_from_id
from ava.clients.sql.schema import Expert_Schema
from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.session.CSCsession import CSCSession
from ava.utils import env_utils
from ava.utils.AzureOpenAIHandler import run_azure_gpt_langChain
from ava.utils.GPTHandler import GPTHandler
from ava.utils.TwccFFmHandler import run_ffm_langchain
from kor.nodes import Object
from langchain_openai import ChatOpenAI

inquiry_template = """
    User Query: {query}

    Relevant Context: {result}
"""

logger = logging.getLogger("ava_app")
schema_id = "find_user_by_extno"


class CSCInquirer(AvaHandler):

    def get_host(self):
        return env_utils.get_key("CSC_HOST")

    @abstractmethod
    def validate_input(self, input_data):
        pass

    @abstractmethod
    def get_web_api(self, user: User, query, input_data) -> Dict:
        pass

    @abstractmethod
    def handle_response(self, user: User, response, web_api: Dict) -> str:
        pass

    @abstractmethod
    def get_data_schema(self, query: str) -> Object:
        pass

    def post(self, user: User, query, input_data):
        # assert len(input_data) == 1, "error in extracting extension number"
        logger.debug(f"CSC input_data {input_data}")

        self.validate_input(input_data)
        web_api = self.get_web_api(user, query, input_data)

        csc_session = CSCSession(user, requests.Session())
        # csc_session.get_httpclient()
        form_data = web_api["form_data"]
        logger.info(f"form_data:{form_data}")
        resp = csc_session.post(web_api["url"], form_data)
        return self.handle_response(user, resp, web_api)

    def remove_phone_info(self, input_data):
        # 使用正則表達式移除包含“電話”或“分機”的部分
        input_data = re.sub(r'電話', '', input_data)
        input_data = re.sub(r'分機', '', input_data)
        return input_data

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        query = self.remove_phone_info(query)
        schema = self.get_data_schema(query)
        logger.debug(f"CSCInquirer schema {schema}")
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        row_expert: Expert_Schema | None = select_expert_from_id(
            expert_id=expert_id)
        assert row_expert
        model: str = row_expert.config_jsonb.get("kor", "gpt-4o")
        if model.startswith("azure") or model.startswith("caf"):
            data = run_azure_gpt_langChain(chat_uuid=chat_uuid,
                                           user=user,
                                           expert_data=expert_data,
                                           model_key=model,
                                           schema=schema,
                                           query=query)
        elif model.startswith("twcc"):
            data = run_ffm_langchain(chat_uuid=chat_uuid,
                                     user=user,
                                     expert_data=expert_data,
                                     model_key=model,
                                     schema=schema,
                                     query=query)
        else:
            self.llm = ChatOpenAI(model=model, temperature=0, max_tokens=2000)
            data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                     expert_data, schema,
                                                     query)
        logger.debug(f"kor schema data: {data}")

        return self.post(user, query, data[schema.id])

    def is_streaming(self):
        return False

    def return_directly(self):
        return True
