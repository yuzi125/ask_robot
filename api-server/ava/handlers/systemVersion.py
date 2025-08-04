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
logger = logging.getLogger(__name__)


def handle_message(incoming_msg):
    if incoming_msg.startswith("版本:"):
        incoming_msg = incoming_msg.replace("版本:", "", 1)
        pass
    else:
        incoming_msg = "版本更新中"
        pass
    return incoming_msg


class systemVersion(AvaHandler):

    def get_intention(self):
        intention = "When the text begins with '版本:', it signifies that this is an version intent."
        return intention

    def handle(self, chat_uuid, expert_id, user: User, incoming_msg,
               chat_context: list):
        self.auth_user_login_type(user)
        url = os.getenv(
            "AVA_BACKEND_URL",
            "http://localhost:8082") + "/system/version"  # 替換成你的 API 端點
        headers = {"Content-Type": "application/json"}  # 新增所需的標頭（如果有的話）
        context = handle_message(incoming_msg)
        data = {"text": context}
        response = requests.put(url, data=json.dumps(data), headers=headers)
        print(url)
        result = ""
        if response.status_code == 200:
            rs_data = response.json()
            if rs_data.get("code") == 0:
                result = "版本修改成功"
            else:
                result = "版本修改失敗"
        else:
            print(response)
            result = "HTTP 請求失敗"
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
            "版本:",
        ]

    def get_llm_model(self):
        return "gpt-4o"
