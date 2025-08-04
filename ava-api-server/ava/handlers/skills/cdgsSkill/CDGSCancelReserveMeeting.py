import json
import logging
from os import getenv
from typing import Any

import requests
from ava.model.dscom import User
from ava.utils.return_message_style import error_msg, info_msg
from pydantic import BaseModel
from ava.session.DragonSession import DragonERPSession

logger = logging.getLogger("ava_app")

class CDGSCancelReserveMeeting:

    def __init__(self, reservation_id):
        self.reservation_id = reservation_id

    def handle(self, user: User):
        csc_host: str | None = getenv("CSC_API_HOST")
        assert csc_host
        path = "/erp/avaSK"
        # user_id = user.login_info["csc_sso"]["uid"]
        # 中鋼需求說要帶gcid + guid
        logger.info(f"CDGSCancelReserveMeeting cancel_data {self.reservation_id}")

        reserve_id_parts = self.reservation_id.split(";")
        reserveDate, typeId, groupId, itemId, reserveFrom = reserve_id_parts

        post_data = {
            "infoId": "UEJJCHART",
            "action": "",
            "skillId": "UEBOOK_CANCEL",
            "reserveDate": reserveDate,
            "typeId": typeId,
            "groupId": groupId,
            "itemId": itemId,
            "reserveFrom": reserveFrom
        }

        headers = {'Content-Type': 'application/json'}
        cookies = None
        logger.info(f"CDGSCancelReserveMeeting post_data {post_data}")
        dragon_session: DragonERPSession = DragonERPSession(user, requests.Session(), cookies)
        response: requests.Response = dragon_session.post(f"{csc_host}{path}",
                                                  data=post_data,
                                                  headers=headers)
        # response: requests.Response = requests.post(f"{csc_host}{path}",
        #                                             json=post_data,
        #                                             headers=headers)
        logger.info(
            f"CDGSCancelReserveMeeting response.json() {response.json()}")
        if response.status_code == 200:
            res_json = response.json()
            msg_wrap_func = info_msg if res_json["success"] else error_msg
            return [{
                "type": "html_json"
            },
                    [{
                        "tag": "html",
                        "text": msg_wrap_func(res_json["return_message"]["text"]),
                        "after_new_line": True
                    }]]
        else:
            return [{
                "type": "html_json"
            },
                    [{
                        "tag": "html",
                        "text": error_msg("操作失敗，請稍後再試，或聯絡系統管理員"),
                        "after_new_line": True
                    }]]
