import json
import logging
import os

import requests
from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.utils import env_utils, utils
from ava.utils.GPTHandler import GPTHandler
from langchain_openai import ChatOpenAI

doc_logger = logging.getLogger("doc")
logger = logging.getLogger("ava_app")


def handle_message(incoming_msg):
    if incoming_msg.startswith("清除公告"):
        incoming_msg = ""
    elif incoming_msg.startswith("清公告"):
        incoming_msg = ""
    elif incoming_msg.startswith("公告:"):
        incoming_msg = incoming_msg.replace("公告:", "", 1)  # 只替換第一次出現的 "公告:"
        pass
    else:
        incoming_msg = ""
        pass
    return incoming_msg  # 或者根據需要返回其他內容


class systemBulletin(AvaHandler):

    def get_intention(self):
        intention = "When the text begins with '公告', it signifies that this is an announcement intent."
        return intention

    def handle(self, chat_uuid, expert_id, user: User, incoming_msg,
               chat_context: list):
        self.auth_user_login_type(user)
        url = os.getenv(
            "AVA_BACKEND_URL",
            "http://localhost:8082") + "/clientsets/bulletin"  # 替換成你的 API 端點
        headers = {"Content-Type": "application/json"}  # 新增所需的標頭（如果有的話）
        context = handle_message(incoming_msg)
        data = {"text": context, "id": "system_bulletin"}
        response = requests.put(url, data=json.dumps(data), headers=headers)
        result = ""
        if response.status_code == 200:
            rs_data = response.json()
            if rs_data.get("code") == 0:
                result = "公告修改成功"
            else:
                result = "公告修改失敗"
        else:
            result = "HTTP 請求失敗"
            print("HTTP 請求失敗")
        return result

    def keep_context(self):
        return False

    def return_directly(self):
        return True

    def set_llm_config(self):
        return False

    def is_streaming(self):
        return False

    def get_examples(self) -> list:
        return [
            "公告:",
            "清除公告:",
        ]

    def get_llm_model(self):
        return "gpt-4o"
