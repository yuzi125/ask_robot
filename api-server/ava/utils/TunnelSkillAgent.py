import importlib
import json
import os
import re
from datetime import datetime
from logging import Logger, getLogger
from typing import Any, Sequence
from zoneinfo import ZoneInfo

import requests
from ava.clients.sql.crud import (select_all_form_config,
                                  select_form_config_from_id,
                                  select_form_config_from_name,
                                  select_settings_from_key)
from ava.clients.sql.schema import FormConfiguration_Schema, Settings_Schema
from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.utils.ClaudeHandler import ClaudeHandler
from ava.utils.Common import safe_eval
from ava.utils.return_message_style import error_msg, info_msg, success_msg
from sqlalchemy.orm import scoped_session


class TunnelSkillAgent:

    def __init__(self, message: dict[str, Any], user: User,cookies: dict[str, Any] | None = None,session_maker: scoped_session | None =None) -> None:
        self.logger: Logger = getLogger("ava_app")

        # 原始的整包 message
        self.message: dict[str, Any] = message

        # 使用者輸入的訊息
        self.user_input: str = message["input_message"]
        self.user: User = user
        self.cookies: dict[str, Any] | None = cookies
        
        # 當前表單的狀態
        self.state: str = message["state"]

        self.skill_id: str = message["skill_id"]
        self.skill_name: str = message["skill_name"]
        self._class: str = message["_class"]
        self.skill_show_name = message["skill_show_name"]
        """
            最後要丟進去 skill post 的資料, 範本如下:
                "post_params": {
                    "chat_uuid": "4fb52e07-f3c4-404b-bd89-8c1d8658a852",
                    "expert_data": {
                        "expert_id": "ba42f70b-2d49-4eb4-ab71-985d0d58cb34",
                        "expert_model": "CSCERPWebApiRunner",
                        "expert_model_type": "2"
                    },
                    "schema_input_data": [{
                        "booking_time": {
                            "value": "今天",
                            "required": true,
                            "label": "日期",
                            "sync_fields": []
                        },
                        "floor_id": {
                            "value": "",
                            "required": true,
                            "label": "樓層 (要預約的會議室樓層，目前提供 7 or 16樓)",
                            "sync_fields": []
                        },
                        "resource_id": {
                            "value": "",
                            "required": false,
                            "label": "會議室號碼",
                            "sync_fields": []
                        },
                        "resource_type": {
                            "value": "",
                            "required": false,
                            "label": "會議室類型 (會議室類型或樓層號碼 ex:webex, 7, 16)",
                            "sync_fields": []
                        }
                    }],
                    "query": "預約會議室"
                }
        """
        self.post_params: dict[str, Any] = message["post_params"]
        # self.missing_skill_fields : list[list[dict[str,Any]]] = message["missing_skill_fields"]

        self.session_maker: scoped_session | None = session_maker
        assert self.session_maker is not None, "session_maker is None"
    def handle_tunnel(self) -> dict[str, Any]:
        missing_field: str | None = self.get_missing_field()
        # TODO: 目前只支援一筆，所以先拿 [0] 直接來用
        labels = {k:v["label"] for k,v in self.post_params["schema_input_data"][0].items()}
        module_path, class_name = self._class.rsplit('.', 1)
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)
        handler: AvaHandler = cls(None, self.skill_id, self.skill_name)
        if getattr(handler,"set_session_maker",None):
            assert self.session_maker is not None, "session_maker is None"
            handler.set_session_maker(self.session_maker)
        if hasattr(handler, 'load_skill'):
            load_skill_method = getattr(handler, 'load_skill')
            load_skill_method()            
        if missing_field:
            self.post_params["schema_input_data"][0][
                missing_field]["value"] = self.user_input
            if self.post_params["schema_input_data"][0][missing_field][
                    "sync_fields"]:
                for sync_field in self.post_params["schema_input_data"][0][
                        missing_field]["sync_fields"]:
                    self.post_params["schema_input_data"][0][
                        sync_field]["value"] = self.user_input
        if (next_missing_field := self.get_missing_field()) is not None:
            tunnel_skill_result = {
                "tunnel_type":"skill",
                "state":
                "filling",
                "skill_id":
                self.skill_id,
                "skill_name":
                self.skill_name,
                "skill_show_name":
                self.skill_show_name,
                "_class":
                self._class,
                "post_params":
                self.post_params,
                "return_message":
                f"執行{info_msg(self.skill_show_name, False)}技能時缺少必要資訊，請提供以下資訊: {info_msg(self.post_params["schema_input_data"][0][
                next_missing_field]["label"])}",
            }
            if button_tip := self.post_params["schema_input_data"][0][next_missing_field]["button_tip"]:
                tunnel_skill_result["button_tip"] = [
                    {
                        "tag": "button_no_confirm",
                        "text": value,
                        "action": "pushData",
                        "args": [value]
                    } 
                    for value in button_tip
                ] 
            elif button_tip_key := self.post_params["schema_input_data"][0][next_missing_field]["button_tip_key"]:
                if button_tip_key in getattr(handler,"config").schema.button_tip_mapping:
                    tunnel_skill_result["button_tip"] = [
                    {
                        "tag": "button_no_confirm",
                        "text": value,
                        "action": "pushData",
                        "args": [value]
                    } 
                    for value in getattr(handler,"config").schema.button_tip_mapping[button_tip_key]
                ] 
                else:
                    raise RuntimeError(f"button_tip_key:{button_tip_key} not exists")   
            elif button_tip_evaluation := self.post_params["schema_input_data"][0][next_missing_field]["button_tip_evaluation"]:
                button_tip_evaluation = button_tip_evaluation.replace("$SELF","schema_input_data")
                if (evaluation:=safe_eval(button_tip_evaluation,{"schema_input_data":self.post_params["schema_input_data"][0]})) and evaluation in getattr(handler,"config").schema.button_tip_mapping:
                    tunnel_skill_result["button_tip"] = [
                    {
                        "tag": "button_no_confirm",
                        "text": value,
                        "action": "pushData",
                        "args": [value]
                    } 
                    for value in getattr(handler,"config").schema.button_tip_mapping[evaluation]
                ] 
                else:
                    raise RuntimeError(f"button_tip_evaluation:{evaluation} exec error")
            return tunnel_skill_result
        else:
            if (regex_error_field := self.get_regex_error_field()) is not None:
                tunnel_skill_result = {
                "tunnel_type":"skill",
                "state":
                "filling",
                "skill_id":
                self.skill_id,
                "skill_name":
                self.skill_name,
                "skill_show_name":
                self.skill_show_name,
                "_class":
                self._class,
                "post_params":
                self.post_params,
                "return_message":
                f"執行{info_msg(self.skill_show_name, False)}技能時欄位{info_msg(regex_error_field)}格式不符合{info_msg(self.post_params["schema_input_data"][0][regex_error_field]["regex"])}，請重新提供"
                }
                self.post_params["schema_input_data"][0][
                regex_error_field]["value"] = ""
                return tunnel_skill_result  
            fill_records = {}
            if hasattr(handler, "config"):
                need_show_records = getattr(handler,"config").show_fill_record
                if need_show_records:
                    fill_records = {labels[k]:v["value"] for k,v in self.post_params["schema_input_data"][0].items() if k in labels and v["value"]}
            self.post_params["schema_input_data"] =[{
                k: v["value"]
                for k, v in self.post_params["schema_input_data"][0].items()
            }]
            result = handler.direct_handle_with_data(self.user,
                                                     self.post_params,self.cookies)
            return {
                "tunnel_type":"skill",
                "state": "aborted",
                "skill_id": self.skill_id,
                "skill_name": self.skill_name,
                "skill_show_name": self.skill_show_name,
                "_class": self._class,
                "post_params": self.post_params,
                "fill_records": fill_records,
                "skill_result": result
            }

    def get_missing_field(self) -> str | None:
        missing_field = next(
            (k
             for k,v in self.post_params["schema_input_data"][0].items()
             if v["required"] and v["value"] == ""), None)
        return missing_field
    
    def get_regex_error_field(self) -> str | None:
        regex_error_field = next(
            (k
             for k,v in self.post_params["schema_input_data"][0].items()
             if (v["regex"] and not re.match(v["regex"], v["value"]))), None)
        return regex_error_field    