import logging

from langchain_openai import ChatOpenAI

from ava.handlers.AvaHandler import AvaHandler
from ..model.dscom import User

logger = logging.getLogger("wish")


class WishMaker(AvaHandler):
    intention = "Ask for new function or service that you can provide"

    def handle(self, user: User, query, chat_context: list):
        self.auth_user_login_type(user)
        if "許願" not in query:
            raise NotImplementedError()

        logger.info(f"{user.userNo}: {query}")
        return "收到您的意見了，謝謝~"

    def return_directly(self):
        return True
