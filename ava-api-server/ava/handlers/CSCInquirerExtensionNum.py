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
schema_id = "find_user_by_extno"


class CSCInquirerExtensionNum(CSCInquirer):


    def get_intention(self):
        intention = "Find user by Extension number (extension number is pure numbers, no English letters)"
        return intention

    def get_data_schema(self, query: str) -> Object:
        return Object(
            id="extension_number_querier",
            description="find user by extension number",
            examples=[
                (
                    "35617", [{
                        "extno": "35617"
                    }]
                ),
                (
                    "5250", [{
                        "extno": "5250"
                    }]
                ),
                (
                    "3360", [{
                        "extno": "3360"
                    }]
                )
            ],
            attributes=[
                Text(
                    id="extno",
                    description="The extension number",
                )
            ],
            many=False,
        )

    def validate_input(self, input_data):
        assert len(input_data) == 1, "無法分析欲查詢之分機號碼"
        extno = input_data[0]['extno']
        assert len(extno) > 0, "parsing extno error"
        pass

    def get_web_api(self, user: User,query, input_data) -> Dict:
        extno = input_data[0]["extno"]
        host = self.get_host()
        assert host is not None, "Host of CSC is None."
        return {
            "url": f"{host}/ka/func/kaf1?_format=json",
            "form_data": {
                "_action": "query",
                "inqPamJson": f'{{"doCompQ":"0002","doUserQ":"{user.userNo}","extNoQ":"{extno}"}}',
            }
        }

    def handle_response(self, user: User, resp: Response, web_api: Dict) -> str:
        logger.debug("after receiving response.")
        if resp.status_code == 200:
            logger.debug("resp.text: %s", resp.text)
            result = resp.json()
            if result["severity"] == "Success":
                ans = []
                for owner in result["dataList"]:
                    ans.append(f'- {owner["compDesc"]} {owner["dept"]} {owner["name"]}')
                if len(ans) == 0:
                    return "查無資料"
                return "\n".join(ans)
            else:
                logger.warning(f'posting warning...{result["alerts"][0]["message"]}')
                return result["alerts"][0]["message"]
        else:
            msg = "exception on executing query extension number"
            logger.error(msg)
            logger.exception(msg)
            raise ValueError(msg)
        pass

    def get_system_prompt(self):
        return """ 
Your task is to help user to find the owner of the extension number.
"""

    def get_examples(self) -> list:
        return [
            "35617",
            "5250是誰的電話"
        ]

    def get_intention_type(self):
        return "Q,E"
