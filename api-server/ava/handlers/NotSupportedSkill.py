import logging

from langchain_openai import ChatOpenAI

from ava.handlers.AvaHandler import AvaHandler
from ..model.dscom import User

logger = logging.getLogger("wish")


class NotSupportedHandler(AvaHandler):

    def handle(self, user: User, query, chat_context: list):
        raise NotImplementedError()

    def return_directly(self):
        return True

    def get_intention(self):
        intention = '''
        Ask about any management Knowledge regarding overtime work.
        Apply overtime work from 8 a.m. to 5 p.m. on October 22nd.
        '''
        return intention


