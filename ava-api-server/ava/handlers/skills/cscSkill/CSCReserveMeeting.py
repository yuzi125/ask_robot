import json
import logging
from os import getenv
from typing import Any

import requests
from ava.model.dscom import User
from ava.utils.return_message_style import error_msg, info_msg
from pydantic import BaseModel

logger = logging.getLogger("ava_app")
class CSCReserveMeeting:

    @staticmethod
    def handle(reserve_data,user:User):
        csc_host: str | None = getenv("CSC_API_HOST")
        assert csc_host
        path = "/UA/UAAVA/reserve"

        # user_id = user.login_info["csc_sso"]["uid"]
        gcid: str = user.login_info["csc_sso"]["gcid"]
        guid: str = user.login_info["csc_sso"]["guid"]
        user_id: str = gcid + guid
        post_data = {
            "userId": user_id,
            "start_time": reserve_data["fields"]["startSelect"],
            "end_time": reserve_data["fields"]["endSelect"],
            "resource_id": reserve_data["fields"]["id"],
            "option": reserve_data["form"]
        }
        headers = {}
        headers["X-EZOAG-TOKEN"] = getenv("X-EZOAG-TOKEN")
        headers["X-EZOAG-JWT"] = getenv("X-EZOAG-JWT")
        if "subject" in post_data["option"]:
            post_data["option"]["topic"] = post_data["option"]["subject"]
        logger.info(f"CSCReserveMeeting post_data {post_data}")
        response: requests.Response = requests.post(f"{csc_host}{path}",
                                                    json=post_data,headers=headers)
        if response.status_code == 200:
            res_json = response.json()
            # 時間、地點、會議室、會議主題
            if res_json["success"] is True or res_json["success"] == 'true':
                logger.info(f"Reserve success: {res_json}")
                date = res_json["data"]["option"]["date"]
                start_time = res_json["data"]["start_time"]
                end_time = res_json["data"]["end_time"]
                topic = res_json["data"]["option"]["topic"]
                title = res_json["data"]["title"]
                reservation_id = res_json["data"]["reservation_id"]
                return [{
                            "type": "html_json"
                        }, [
                    {
                        "tag":"p",
                        "text":"預約成功"
                    },
                    
                    {
                        "tag":"html",
                        "text":f"{info_msg(f'日期: {date}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'時間: {start_time} ~ {end_time}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'會議室: {title}')}",
                        "after_new_line":True
                    },{
                        "tag":"html",
                        "text":f"{info_msg(f'會議主題: {topic}')}",
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
                                "next_skill": "CSCCancelReserveMeeting",
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
