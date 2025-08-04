import json
import logging

import requests
from kor.nodes import Object, Text
from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.session.CSCsession import CSCSession
from ava.utils import utils

from ava.utils.GPTHandler import GPTHandler

inquiry_template = """
    User Query: {query}

    Relevant Context: {result}
"""

logger = logging.getLogger(__name__)
schema_id = "find_user_by_extno"


class ExtensionNumInquirer(AvaHandler):

    def relogin(self, user: User, session):
        dsaord_url = 'http://prod.icsc.com.tw/erp/ds/jsp/dsjjAORD_SSO.jsp?infoCid=CSC&infoId=KAF1&infoType=N'
        session.get(dsaord_url, headers=utils.decorate_header(user, {}))

    def get_intention(self):
        intention = "Find user by Extension number"
        return intention

    def find_user_by_extno(self, user: User, input_data):
        assert len(input_data) == 1, "error in extracting extension number"
        extno = input_data[0]['extno']
        assert len(extno) > 0, "parsing extno error"
        csc_session = CSCSession(user, requests.Session())
        csc_session.get_httpclient()
        query_url = "http://eas.csc.com.tw/ka/func/kaf1?_format=json"
        form_data = {
            "_action":
            "query",
            "inqPamJson":
            '{"doCompQ":"0002","doUserQ":"' + user.userNo + '","extNoQ":"' +
            extno + '"}',
        }
        resp = csc_session.post(query_url, form_data)

        if resp.status_code == 200:
            logger.debug("resp.text: %s", resp.text)
            result = resp.json()
            if result["severity"] == "Success":
                ans = []
                for owner in result["dataList"]:
                    ans.append(
                        f'- {owner["compDesc"]} {owner["dept"]} {owner["name"]}'
                    )
                if len(ans) == 0:
                    return "查無資料"
                return "\n".join(ans)
            else:
                logger.warning(
                    f'posting {query_url} warning...{result["alerts"][0]["message"]}'
                )
                return result["alerts"][0]["message"]
        else:
            msg = "exception on executing query extension number"
            logger.exception(msg)
            raise ValueError(msg)

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        logger.info("Using find user by extension number handler ...")
        schema = Object(
            id=schema_id,
            description="find user by extension number",
            examples=[("35617", [{
                "extno": "35617"
            }]), ("5250", [{
                "extno": "5250"
            }]), ("3360", [{
                "extno": "3360"
            }])],
            attributes=[
                Text(
                    id="extno",
                    description="The extension number",
                )
            ],
            many=False,
        )
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                 expert_data, schema, query)
        ans = self.find_user_by_extno(user, data[schema_id])
        # print(f"data parsed: {data}")
        # query_with_context = inquiry_template.format(query=query, result=ans)
        return ans

    def get_system_prompt(self):
        return """ 
Your task is to help user to find the owner of the extension number.
"""

    def is_streaming(self):
        return False

    def return_directly(self):
        return True

    def get_intention_type(self):
        return "Q"
