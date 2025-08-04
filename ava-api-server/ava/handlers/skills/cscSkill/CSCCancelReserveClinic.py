import json
import logging
from os import getenv
from typing import Any

import requests
from ava.model.dscom import User
from ava.utils.return_message_style import error_msg, info_msg
from pydantic import BaseModel

logger = logging.getLogger("ava_app")


class CSCCancelReserveClinic:

    def __init__(self, reservation_id):
        self.reservation_id = reservation_id

    def handle(self, user: User):
        csc_host: str | None = getenv("CSC_API_HOST")
        assert csc_host
        path = "/PH/PHAVA/setCancel"

        gcid = user.login_info["csc_sso"]["gcid"]
        guid = user.login_info["csc_sso"]["guid"]
        user_id = gcid + guid
        # user_id = "0000122028"

        post_data = {
            "doCompUser": user_id,
            "reservation_id": self.reservation_id
        }
        headers = {}
        headers["X-EZOAG-TOKEN"] = getenv("X-EZOAG-TOKEN")
        headers["X-EZOAG-JWT"] = getenv("X-EZOAG-JWT")
        logger.info(f"CSCCancelReserveClinic post_data {post_data}")
        response: requests.Response = requests.post(f"{csc_host}{path}",
                                                    json=post_data,
                                                    headers=headers)
        logger.info(
            f"CSCCancelReserveClinic response.json() {response.json()}")
        if response.status_code == 200:
            res_json = response.json()
            msg_wrap_func = info_msg if res_json["success"] else error_msg
            return [{
                "type": "html_json"
            },
                    [{
                        "tag": "html",
                        "text":
                        msg_wrap_func(res_json["return_message"]["text"]),
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
