import logging
import requests

from abc import abstractmethod
from typing import Dict
from kor.nodes import Object
from ava.handlers.AvaHandler import AvaHandler
from ava.session.ICSCSession import ICSCSession
from ava.model.dscom import User

from ava.utils.GPTHandler import GPTHandler


inquiry_template = """
    User Query: {query}

    Relevant Context: {result}
"""

logger = logging.getLogger(__name__)


class ICSCInquirer(AvaHandler):

    @abstractmethod
    def validate_input(self, input_data):
        pass

    @abstractmethod
    def get_web_api(self, user: User, input_data) -> Dict:
        pass

    @abstractmethod
    def handle_response(self, user: User, response, web_api: Dict) -> str:
        pass

    @abstractmethod
    def get_data_schema(self, query: str) -> Object:
        pass

    def post(self, user: User, input_data):
        # assert len(input_data) == 1, "error in extracting extension number"
        logger.debug(f"ICSC input_data {input_data}")
        self.validate_input(input_data)
        web_api = self.get_web_api(user, input_data)

        icsc_session = ICSCSession(user, requests.Session())
        # csc_session.get_httpclient()
        resp = icsc_session.post(web_api["url"], web_api["form_data"])
        return self.handle_response(user, resp, web_api)

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        schema = self.get_data_schema(query)
        logger.debug(f"ICSCInquirer schema {schema}")
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                 expert_data, schema, query)
        return self.post(user, data[schema.id])

    def is_streaming(self):
        return False

    def return_directly(self):
        return True
