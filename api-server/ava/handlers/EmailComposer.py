from langchain_openai import ChatOpenAI

from ava.model.dscom import User
from ava.tools import EmailSender as em
from ava.handlers.AvaHandler import AvaHandler


class EmailComposer(AvaHandler):

    def handle(self, user: User, query, chat_context: list):
        self.auth_user_login_type(user)
        raise NotImplementedError("Not supported.")

        print("Using Email handler...")
        content = em.compose_and_send_mail(query)
        return "郵件已幫你改寫並且寄出，請確認。"

    def return_directly(self):
        return True

    def get_system_prompt(self):
        return """
You are a polite and gentle customer service representative, with the mission goal of achieving high customer satisfaction."""

    def get_intention(self):
        return "Write an email."
