import logging
import re

import requests.cookies
from ava.handlers.AvaHandler import AvaHandler
from ava.handlers.ResourceInquirer import ResourceInquirer
from ava.model.dscom import User
from ava.utils import env_utils, utils
from ava.utils.GPTHandler import GPTHandler
from ava.utils.return_message_style import error_msg, warn_msg
from ava.utils.TimeSemanticExpressor import convert_date_time
from bs4 import BeautifulSoup
from kor.nodes import Object, Text
from langchain_openai import ChatOpenAI

logger = logging.getLogger("ava_app")


schema = Object(
    id="booking_record",
    description="Resource booking information",
    examples=[
        (
            "中鋼 F3",
            [{
                "_action": "queryCSCdata",
                "keyword": "F3",
            }],
        ),
        (
            "中冠 陳品郎",
            [{
                "_action": "queryGRPdata",
                "keyword": "陳品郎",
            }],
        ),
    ],
    attributes=[
        Text(
            id="_action",
            description="要查詢的公司別 沒有給公司別的話 預設用 queryCSCdata 有給的話 除了中鋼都是 queryGRPdata",
        ),
        Text(
            id="keyword",
            description="查詢條件 姓名或分機或職工編號或組別",
        ),
    ],
)


class CSCQuickSearchPerson(AvaHandler):

    def __init__(self, llm: ChatOpenAI, skill_id: str, skill_name: str):
        super().__init__(llm, skill_id, skill_name)
        self.skill_id = skill_id
        self.skill_name = skill_name
        self.resource_inquirer = ResourceInquirer(llm, skill_id, skill_name)

    def get_intention(self):
        intention = (
            "可以查詢分機、名字、email、職工編號、公司別...等資訊"
        )
        return intention

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        cookies = getattr(user, "cookies", {})
        logger.info("Using CSCQuickSearchPerson handler...")
        logger.info(f"query: {query}")
 
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                 expert_data, schema, query)
        logger.info(f"data parsed: {data}")
        msg = []
        
        session = requests.Session()
        jar = requests.cookies.RequestsCookieJar()
        for key, value in cookies.items():
            jar.set(key, value)
        session.cookies = jar
        cookies: dict[str, str] = session.cookies.get_dict()
        form_url = "https://eip2t.csc.com.tw/dk/portal/dkpp?_format=json"
        for d in data[schema.id]:
            form_data = d
            response = session.post(form_url, data=form_data)
            print(response)
        return msg


    def get_examples(self) -> list:
        return [
            "陳品郎",
            "I30412",
            "35048",
        ]

    def return_directly(self):
        return True
