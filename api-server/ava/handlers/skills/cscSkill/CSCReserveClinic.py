import json
import logging
from os import getenv
from typing import Any

import requests
from ava.model.dscom import User
from ava.utils.return_message_style import error_msg, info_msg
from pydantic import BaseModel

logger = logging.getLogger("ava_app")


class CSCReserveClinic:

    @staticmethod
    def handle(reserve_data, user: User):
        csc_host: str | None = getenv("CSC_API_HOST")
        assert csc_host
        path = "/PH/PHAVA/setReservation"

        gcid: str = user.login_info["csc_sso"]["gcid"]
        guid: str = user.login_info["csc_sso"]["guid"]
        user_id: str = gcid + guid
        # user_id = "0000122028"
        post_data = {
            "doCompUser": user_id,
            "reservInputId": reserve_data["fields"]["id"],
            "reservTime": reserve_data["fields"]["singleSelect"],
            "option": {
                "relation": reserve_data["form"]["relation"]
            }
        }
        headers = {}
        headers["X-EZOAG-TOKEN"] = getenv("X-EZOAG-TOKEN")
        headers["X-EZOAG-JWT"] = getenv("X-EZOAG-JWT")

        # if "subject" in post_data["option"]:
        #     post_data["option"]["topic"] = post_data["option"]["subject"]
        logger.info(f"CSC SetClinicReservation post_data {post_data}")
        response: requests.Response = requests.post(f"{csc_host}{path}",
                                                    json=post_data,headers=headers)
        if response.status_code == 200:
            res_json = response.json()
            # 時間、地點、會議室、會議主題
            if res_json["success"] is True or res_json["success"] == 'true':
                logger.info(f"Reserve success: {res_json}")
                reservation_id = res_json["data"]["reservation_id"]
                drname = res_json["data"]["option"]["drname"]
                resvdate = res_json["data"]["option"]["resvdate"]
                resvtime = res_json["data"]["option"]["resvtime"]
                resverno = res_json["data"]["option"]["resverno"]
                empno = res_json["data"]["option"]["empno"]
                kinship = res_json["data"]["option"]["kinship"]
                patname = res_json["data"]["option"]["patname"]
                hospName = res_json["data"]["option"]["hospName"]
                return [{
                            "type": "html_json"
                        }, [
                    {
                        "tag":"p",
                        "text":"預約成功"
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'科別: {hospName}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'醫生姓名: {drname}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'預約日期: {resvdate}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'預約時段: {resvtime}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'時段順位: {resverno}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'姓名: {patname}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'預約職編: {empno}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'關係: {kinship}')}",
                        "after_new_line":True
                    },{
                        "tag": "button",
                        "text": "取消預約",
                        "after_new_line": True,
                        "action": "apiPost",
                        "args": {
                            "url": "/bot/avaApiSkillPost",
                            "actionMessage": "請幫我取消預約…",
                            "post_data": {
                                "next_skill": "CSCCancelReserveClinic",
                                "data": {
                                    "reservation_id": reservation_id
                                }
                            },
                            "header": {}
                        }
                    }
                ]]
            else:
                # TODO: 這邊要看金凱什麼時候改完才換下面的版本
                # return f"預約失敗\n\n{error_msg(res_json['return_message']['text'])}"
                return [{
                            "type": "html_json"
                        },[
                    {
                        "tag":"p",
                        "text":f"{res_json["return_message"]["text"]}"
                    }]]
        else:
            raise ValueError(f"Reserve failed: {response.text}")
