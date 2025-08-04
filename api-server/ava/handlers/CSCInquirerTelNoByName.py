import logging
from typing import Dict

from flask import Response
from kor import Object, Text
from langchain_openai import ChatOpenAI

from ava.handlers.CSCInquirer import CSCInquirer
from ava.model.dscom import User

inquiry_template = """
    User Query: {query}

    Relevant Context: {result}
"""

logger = logging.getLogger(__name__)
schema_id = "find_extno_by_name"


class CSCInquirerTelNoByName(CSCInquirer):

    def get_intention(self):
        intention = "Find Extension number by company name and user name"
        return intention

    def get_data_schema(self, query: str) -> Object:
        return Object(
            id=schema_id,
            description="Contacts information",
            examples=[
                (
                    "潔鋒", [{
                        "contact_name": "潔鋒"
                    }]
                ),
                (
                    "信昌", [{
                        "contact_name": "信昌"
                    }]
                ),
                (
                    "陳潔鋒電話", [{
                        "contact_name": "陳潔鋒"
                    }]
                ),
                (
                    "中鴻陳潔鋒的電話幾號?", [{
                        "contact_name": "陳潔鋒"
                    }]
                ),
                (
                    "中宇莊雅閔的電話幾號", [{
                        "contact_name": "莊雅閔"
                    }]
                )
            ],
            attributes=[
                Text(
                    id="contact_name",
                    description="Extract names from text examples, each containing phrases with people's names. Focus solely on identifying the names, ignoring other details.",
                )
            ],
            many=False,
        )

    def validate_input(self, input_data):
        assert len(input_data) == 1, '在輸入中未找到聯絡人名稱，請重新確認輸入是否正確'
        data = input_data[0]['contact_name']
        assert len(data) > 0, '使用者名稱錯誤，請重新確認輸入是否正確'

    def get_web_api(self, user: User, query, input_data) -> Dict:
        contact_name = input_data[0]['contact_name']
        host = self.get_host()
        return {
            "url": f"{host}/ka/func/kaf2?_format=json",
            "form_data": {
                "_action": "query",
                "inqPamJson": f'{{"bussinessAdmin":false,"doCompQ":"0002","doUserQ":"{user.userNo}","condQ":"name","nameQ":"{contact_name}","userIdQ":""}}',
                "subCompIdListJson": """["0001", "0002", "0003", "0005", "0006", "0007", "0008", "0009", "0010", "0011",
                                      "0012", "0015", "0016", "0018", "0019", "0020", "0022", "0023", "0024", "0025",
                                      "0026", "0028", "0030", "0037", "0038", "0039", "0040", "0703", "0705", "0706",
                                      "0707", "0709", "0718"]"""
            }
        }

    def handle_response(self, user: User, resp: Response, web_api: Dict) -> str:
        if resp.status_code == 200:
            logger.debug("resp.text: %s", resp.text)
            result = resp.json()
            if result["severity"] == "Success":
                if result["alerts"][0]["type"] == "danger":
                    return result["alerts"][0]["message"]
                ans = []
                for user_info in result["dataList"]:
                    ans.append(
                        f'- 姓名: {user_info["name"]} \n - 公司: {user_info["compName"]} \n - 單位: {user_info["dept"]} \n  - 電話: {user_info["extNo"]} \n ')
                if len(ans) == 0:
                    return "查無資料"
                return " ------- \n".join(ans)
            else:
                logger.warning(f'posting warning...{result["alerts"][0]["message"]}')
                return result["alerts"][0]["message"]
        else:
            msg = "exception on executing query extension number"
            logger.exception(msg)
            raise ValueError(msg)
        pass

    def get_system_prompt(self):
        return "Your task is to find the extension number of the user in a specified company."

    def get_examples(self) -> list:
        return [
            "中宇莊雅閔",
            "中鴻陳潔鋒",
            "陳潔鋒電話",
            "陳潔鋒分機",
            "潔鋒電話",
        ]

    def get_intention_type(self):
        return "Q,E"
