import logging
from typing import Dict

from flask import Response
from kor import Object, Text
from langchain_openai import ChatOpenAI

from ava.handlers.CSCInquirer import CSCInquirer
from ava.model.dscom import User

logger = logging.getLogger(__name__)
schema_id = "find_boss_by_department no."


class CSCFindBossInfoByDept(CSCInquirer):

    def get_intention(self):
        intention = "Find boss information by department no."
        return intention

    def get_data_schema(self, query: str) -> Object:
        return Object(
            id=schema_id,
            description="Find boss information by department no.",
            examples=[
                (
                    "Y6處長", [{
                        "deptQ": "Y6",
                    }]
                ),
                (
                    "T28組長", [{
                        "deptQ": "T28",
                    }]
                ),
                (
                    "總部F33", [{
                        "deptQ": "F33",
                    }]
                )
            ],
            attributes=[
                Text(
                    id="deptQ",
                    description="The department number of China steel Corporation.",
                ),

            ],
            many=False,
        )

    def validate_input(self, input_data):
        assert len(input_data) == 1, "無法分析欲查詢之部門號碼"
        extno = input_data[0]['deptQ']
        assert len(extno) > 0, "parsing deptQ error"
        pass

    def get_web_api(self, user: User, query, input_data) -> Dict:
        deptQ = input_data[0]["deptQ"]
        locationQ = ""
        if "總部" in query:
            locationQ = "CSCG"
        host = self.get_host()
        assert host is not None, "Host of CSC is None."
        return {
            "url": f"{host}/ka/func/kaf0?_format=json",
            "form_data": {
                "_action": "query",
                "inqPamJson": f'{{"doCompQ":"0002","doUserQ":"{user.userNo}","locationQ":"{locationQ}","typeQ":"dept","deptQ":"{deptQ}","dept2Q":"","dept3Q":"","dept4Q":"","groupQ":""}}',
            }
        }

    def handle_response(self, user: User, resp: Response, web_api: Dict) -> str:
        if resp.status_code == 200:
            logger.debug(f"/ka/func/kaf0?_format=json =>resp.text: {resp.text}")
            result = resp.json()
            if result["severity"] == "Success":
                ans = []
                for i, owner in enumerate(result["dataList"]):
                    if i >= 5:
                        break
                    if len(owner["userInfoList"]) > 0:
                        user_info = owner["userInfoList"][0]
                        contact_info = f'- {user_info["dept"]} {user_info["userInfoStr"]} {owner["extNo"]}'
                        ans.append(contact_info)
                if len(ans) == 0:
                    return "查無資料"
                return "\n".join(ans)
            else:
                logger.warning(f'posting warning...{result["alerts"][0]["message"]}')
                return result["alerts"][0]["message"]
        else:
            msg = "exception on executing query contact information"
            logger.error(msg)
            logger.exception(msg)
            raise ValueError(msg)
        pass

    def get_system_prompt(self):
        return """ 
Your mission is to help user to find the contact information of the Senior Executive.
"""

    def get_examples(self) -> list:
        return [
            "Y6處長",
            "A1主管",
            "F32組長",
            "總部F33",
        ]

    def get_intention_type(self):
        return "Q,E"
