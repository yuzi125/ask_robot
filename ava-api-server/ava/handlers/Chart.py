import logging

from langchain_openai import ChatOpenAI

from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User

doc_logger = logging.getLogger("doc")
logger = logging.getLogger("ava_app")


def append_user_message(messages, msg):
    messages.append({"role": "user", "content": msg})
    return messages


def get_option():
    return {
        "title": {
            "text": "S4 各單位人數"
        },
        "tooltip": {},
        "legend": {
            "data": ["人數"]
        },
        "xAxis": {
            "type": "category",
            "data": ["S40", "S41", "S42"]
        },
        "yAxis": {
            "type": "value"
        },
        "series": [{
            "name": "人數",
            "type": "bar",
            "data": [1, 13, 16]
        }]
    }


def get_options():
    return {
        # "title": {"text": "Stacked Line"},
        # 設定提示框的觸發方式為軸觸發
        "tooltip": {
            "trigger": "axis"
        },
        # 定義圖表線條，代表不同的數據類型
        "legend": {
            "data":
            ["Email", "Union Ads", "Video Ads", "Direct", "Search Engine"]
        },
        # 設定圖表的格線位置
        "grid": {
            "left": "3%",
            "right": "4%",
            "bottom": "3%",
            "containLabel": True
        },
        # "toolbox": {"feature": {"saveAsImage": {}}},

        # 分別設定 X 軸和 Y 軸的類型和數據
        "xAxis": {
            "type": "category",
            "boundaryGap": False,
            "data": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        },
        "yAxis": {
            "type": "value"
        },
        # 這是圖表的主要部分，定義了多條數據線及其對應的數據
        "series": [
            {
                "name": "Email",
                "type": "line",
                "data": [120, 132, 101, 134, 90, 230, 210],
            },
            {
                "name": "Union Ads",
                "type": "line",
                "data": [220, 182, 191, 234, 290, 330, 310],
            },
            {
                "name": "Video Ads",
                "type": "line",
                "data": [150, 232, 201, 154, 190, 330, 410],
            },
            {
                "name": "Direct",
                "type": "line",
                "data": [320, 332, 301, 334, 390, 330, 320],
            },
            {
                "name": "Search Engine",
                "type": "line",
                "data": [820, 932, 901, 934, 1290, 1330, 1320],
            },
        ],
    }


class Chart(AvaHandler):

    def get_intention(self):
        intention = "Used for generating statistical charts."
        return intention

    def handle(self, chat_uuid, expert_id, user: User, incoming_msg,
               chat_context: list):
        self.auth_user_login_type(user)
        return {
            "type": "charts",
            "data": {
                "title": "營收趨勢圖",
                "option": get_option(),
            },
        }

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
            "給我分析統計圖",
            "統計圖",
            "男女統計圖",
        ]
