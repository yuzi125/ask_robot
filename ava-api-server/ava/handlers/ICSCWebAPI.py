import logging
from abc import abstractmethod

from langchain_openai import ChatOpenAI

from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.utils import env_utils

from ava.utils.GPTHandler import GPTHandler

inquiry_template = """
    User Query: {query}

    Relevant Context: {result}
"""

logger = logging.getLogger("ava_app")

icsc_host = env_utils.get_key("ICSC_HOST")


class ICSCWebAPI(AvaHandler):

    def get_host_url(self):
        return "https://" + icsc_host + ".icsc.com.tw"

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        handle_data = {}
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        schema = self.get_data_schema(query)
        if schema:
            data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                     expert_data, schema,
                                                     query)
            handle_data = data[schema.id]
            if len(handle_data) == 0:
                logger.error(
                    f"Input:{query} , schema.id[{schema.id}] has no data with `{schema}`"
                )
        return self.post(chat_uuid, expert_data, user, handle_data, query)

    def is_streaming(self):
        return False

    def return_directly(self):
        return True

    @abstractmethod
    def get_data_schema(self, query):
        pass

    @abstractmethod
    def post(self, chat_uuid, expert_data, user, handle_data, query):
        pass
