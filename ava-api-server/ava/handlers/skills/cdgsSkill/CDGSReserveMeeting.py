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
class CDGSReserveMeeting:

    @staticmethod
    def handle(reserve_data,user:User):
        csc_host: str | None = getenv("CSC_API_HOST")
        assert csc_host
        path = "/erp/avaSK"

        # user_id = user.login_info["csc_sso"]["uid"]
        # gcid: str = user.login_info["csc_sso"]["gcid"]
        # guid: str = user.login_info["csc_sso"]["guid"]
        # user_id: str = gcid + guid
        room_id_parts = reserve_data["fields"]["id"].split(";")
        typeId, groupId, itemId, reserveDate = room_id_parts
        post_data = {
            "infoId": "UEJJCHART",
            "action": "",
            "skillId": "UEBOOK_RESERVE",
            "typeId": typeId,
            "groupId": groupId,
            "itemId": itemId,
            "reserveDate": reserveDate,
            "startTime": reserve_data["fields"]["startSelect"],
            "endTime": reserve_data["fields"]["endSelect"],
            "option": {
                "descColumn1": reserve_data["form"].get("descColumn1"),
                "descColumn2": reserve_data["form"].get("descColumn2", ""),
                "descColumn3": reserve_data["form"].get("descColumn3", "")
            }
        }
        headers = {'Content-Type': 'application/json'}
        logger.info(f"CDGSReserveMeeting post_data {post_data}")
        reserveFrom = f"{reserveDate}{reserve_data['fields']['startSelect'].replace(':', '')}"
        reservation_id = f"{reserveDate};{typeId};{groupId};{itemId};{reserveFrom}"
        cookies = None
        dragon_session: DragonERPSession = DragonERPSession(user, requests.Session(), cookies)
        response: requests.Response = dragon_session.post(f"{csc_host}{path}",
                                                  data=post_data,
                                                  headers=headers)
        # response: requests.Response = requests.post(f"{csc_host}{path}",
        #                                             json=post_data,headers=headers)
        if response.status_code == 200:
            res_json = response.json()
            # 時間、地點、會議室、會議主題
            if res_json["state"] == 200:
                logger.info(f"Reserve success: {res_json}")
                msg = res_json["return_message"]["text"]
                return [{
                            "type": "html_json"
                        }, [
                    {
                        "tag":"html",
                        "text":f"{info_msg(msg)}"
                    },
                    
                    {
                        "tag": "button",
                        "text": "取消預約",
                        "after_new_line": True,
                        "action": "apiPost",
                        "args": {
                            "url": "/bot/avaApiSkillPost",
                            "actionMessage": "請幫我取消預約…",
                            "post_data": {
                                "next_skill": "CDGSCancelReserveMeeting",
                                "data": {
                                    'reservation_id': reservation_id
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

class ReserveData(BaseModel):
    """
        {
        "userId":"0002I23854",
        "start_time":"11:00",
        "end_time":"12:00",
        "resource_id":"CB1601",
        "option":{
                "date":"2024/05/23",
                "topic":"1601測試會議001",
            "orderTel":"23213",
            "orderPhone":"23214",
            "water":0,
            "meetCapacity":18
        }
        }
    """
    userId: str
    start_time: str
    end_time: str
    resource_id: str
    option: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump()

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReserveData":
        return cls(**data)

    @classmethod
    def from_json(cls, json_str: str) -> "ReserveData":
        return cls.model_validate_json(json_str)

    def to_json(self) -> str:
        return self.model_dump_json()
