import json
from typing import Any

import requests
from ava.handlers.CSCWebAPI import CSCWebAPI
from ava.handlers.skills.CommonActions import run_actions
from ava.handlers.skills.SkillConfigLoader import load_skill_config_from_db
from ava.handlers.skills.WebAPIConfig import WebAPIConfig
from ava.model.dscom import User
from ava.session.CSCsession import CSCSession
from ava.utils import env_utils
from ava.utils.Common import convert_data_with_format, safe_eval
from ava.utils.return_message_style import info_msg, error_msg
from ava.utils.TimeSemanticExpressor import *
from ava.utils.web_utils import *
from langchain_openai import ChatOpenAI
from .skills.CommonConfig import Parameter

logger = logging.getLogger("ava_app")



class CSCERPWebApiRunner(CSCWebAPI):

    def __init__(self, llm: ChatOpenAI | None, skill_id: str, skill_name: str):
        super().__init__(llm, skill_id, skill_name)
        self.skill_id = skill_id
        self.skill_name = skill_name
        self.config: WebAPIConfig | None = None

    def load_skill(self):
        web_api_load_file = env_utils.get_key("WEB_API_LOAD_FILE")
        if web_api_load_file and web_api_load_file.lower() == "true":
            logger.info(f"Loading skill from file: {self.skill_id}")
            self.load_skill_from_json()
        else:
            logger.info(f"Loading skill from db: {self.skill_id}")
            self.load_skill_from_db()

    def load_skill_from_json(self):
        with open(f"./skills/{self.skill_name}.json", 'r',
                  encoding="UTF8") as file:
            json_string = json.load(file)
            config = WebAPIConfig.from_json_string(json_string)
            self.config = config

    def load_skill_from_db(self):
        assert self.session_maker, "session_maker is not set"
        with self.session_maker() as _session:
            logger.info(f"load_skill_from_db from skill_id: {self.skill_id}")
            config_json = load_skill_config_from_db("CSCERPWebApiRunner",
                                                    self.skill_id, _session)
        logger.info(f"load_skill_from_db from config_json: {config_json}")
        config = WebAPIConfig.from_json_string(config_json)
        logger.info(f"load_skill_from_db from config: {config}")
        self.config = config

    def get_intention(self):
        assert self.config, "config is None"
        return self.config.intention

    def get_system_prompt(self):
        assert self.config, "config is None"
        return self.config.system_prompt

    def get_examples(self) -> list:
        assert self.config, "config is None"
        return self.config.get_examples()

    def get_data_schema(self, query):
        self.load_skill()
        assert self.config, "config is None"
        if self.config.schema:
            return self.config.schema.get_kor_definition()
        else:
            return None

    def post(self, chat_uuid, expert_data, user: User, schema_input_data,
             query,cookies=None):
        assert self.config, "config is None"
        if self.config.schema:
            assert len(schema_input_data) > 0, self.config.description + " 缺乏足夠的資訊"
            parameters_dict = {
                obj.id: obj
                for obj in self.config.schema.parameters
            }
            tunnel_skill_schema_list: list [dict[str, Any]] = []
            key_status_list: dict[str,dict[str,bool]] = {}
            not_satisfied = False

            for scheam_input in schema_input_data:
                tunnel_skill_schema: dict[str, Any] = {}
                for k, v in scheam_input.items():
                    param: Parameter | None = parameters_dict.get(k)
                    if param:
                        label: str = f"{param.label} ({param.tip})" if param.tip else param.label
                        tunnel_skill_schema[k] = {
                            "value": v,
                            "required": param.required,
                            "label": label,
                            "sync_fields": param.sync_fields,
                            "button_tip": param.button_tip,
                            "button_tip_key": param.button_tip_key,
                            "button_tip_evaluation": param.button_tip_evaluation,
                            "not_satisfied":False,
                            "regex": param.regex,
                            "regex_matched": True if (param.regex and re.match(param.regex, v)) or not param.regex else False
                        }
                        if v == "" and param.required:
                            tunnel_skill_schema[k]["not_satisfied"] = True
                            not_satisfied = True
                        key_status_list[k] = {
                            "not_satisfied": tunnel_skill_schema[k]["not_satisfied"],
                            "regex_matched": tunnel_skill_schema[k]["regex_matched"]
                        }
                tunnel_skill_schema_list.append(tunnel_skill_schema)
            if not_satisfied:
                result:list = [{
                    "type": "tunnel"
                }]
                len_of_tunnel_skill_schema_list = len(tunnel_skill_schema_list)
                if len_of_tunnel_skill_schema_list > 1:
                    raise RuntimeError("目前不支援多筆技能之隧道模式")
                    # missing_skill_fields:list[list[dict[str,Any]]] = []
                    # for item in tunnel_skill_schema_list:
                    #     not_satisfied_fields = []
                    #     for key, value in item.items():
                    #         if value['not_satisfied']:
                    #             not_satisfied_fields.append({key: value})
                    #     if not_satisfied_fields:
                    #         missing_skill_fields.append(not_satisfied_fields)
                    #     else:
                    #         missing_skill_fields.append([])
                    # skill_index = 1
                    # for missing_field in missing_skill_fields:
                    #     if missing_field:
                    #         missing_info = missing_field[0]  # [0] 是因為固定取缺少資訊的技能的第一個欄位
                    #     skill_index +=1
                    # return_message = f"執行{len_of_tunnel_skill_schema_list}筆連續{info_msg(self.config.name, False)}時的第{skill_index}筆缺少必要資訊，請提供以下資訊: {info_msg(missing_info["label"])}"
                else:
                    for k,v in key_status_list.items():
                        if v["not_satisfied"]:
                            missing_info = tunnel_skill_schema_list[0][k]
                            return_message = f"執行{info_msg(self.config.name, False)}時缺少必要資訊，請提供以下資訊: {info_msg(missing_info["label"])}"    
                            break
                        elif not v["regex_matched"]:
                            missing_info = tunnel_skill_schema_list[0][k]
                            return_message = f"執行{info_msg(self.config.name, False)}時欄位{info_msg(missing_info['label'])}格式不符合{info_msg(missing_info['regex'])}，請重新提供"
                            break
                    
                result.append(
                    {
                        "state": "start",
                        "skill_id": self.skill_id,
                        "skill_name": self.skill_name,
                        "skill_show_name": self.config.name,
                        "_class": f"{self.__module__}.{self.__class__.__name__}",
                        "post_params": {
                            "chat_uuid": chat_uuid,
                            "expert_data": expert_data,
                            "schema_input_data": tunnel_skill_schema_list,
                            "query": query
                        },
                        "tunnel_type": "skill",
                        "return_message": return_message
                        # "missing_skill_fields":missing_skill_fields,
                    }
                )
                result.append(return_message)
                if missing_info["button_tip"]:
                    result.append({
                        "type": "html_json"
                    })
                    result.append([
                        {
                            "tag": "button_no_confirm",
                            "text": value,
                            "action": "pushData",
                            "args": [value]
                        } 
                        for value in missing_info["button_tip"]
                    ])
                elif missing_info["button_tip_key"]:
                    if missing_info["button_tip_key"] in self.config.schema.button_tip_mapping:
                        result.append({
                            "type": "html_json"
                        })
                        result.append([
                            {
                                "tag": "button_no_confirm",
                                "text": value,
                                "action": "pushData",
                                "args": [value]
                            } 
                            for value in self.config.schema.button_tip_mapping[missing_info["button_tip_key"]]
                        ])
                    else:
                        raise RuntimeError(f"button_tip_key:{missing_info['button_tip_key']} not exists")   
                elif missing_info["button_tip_evaluation"]:
                    button_tip_evaluation = missing_info["button_tip_evaluation"]
                    button_tip_evaluation = button_tip_evaluation.replace("$SELF","schema_input_data")
                    if (evaluation:=safe_eval(button_tip_evaluation,{"schema_input_data":tunnel_skill_schema_list[0]})) and evaluation in self.config.schema.button_tip_mapping:
                        result.append({
                            "type": "html_json"
                        })
                        result.append([
                            {
                                "tag": "button_no_confirm",
                                "text": value,
                                "action": "pushData",
                                "args": [value]
                            } 
                            for value in self.config.schema.button_tip_mapping[evaluation]
                        ])
                    else:
                        raise RuntimeError(f"button_tip_evaluation:{evaluation} exec error")
                return result
            else:
                result = []
                for schema_input_data in schema_input_data:
                    result.extend(self.run_actions(user, schema_input_data, cookies))
                return result
        else:
            return self.run_actions(user, schema_input_data, cookies)

    def run_actions(self,user:User,schema_input: dict[str,Any] | list[dict[str,Any]], cookies=None)-> list[Any]:
        assert self.config, "config is None"
        input_data: dict[str,Any]
        if isinstance(schema_input,list):
            if len(schema_input)==0:
                input_data = {}
            else:
                input_data = schema_input[0]
        elif isinstance(schema_input,dict):
            input_data = schema_input

        input_data["_user"] = user
        input_data["_client_ip"] = user.client_ip
        input_data["_host"] = self.get_host_url()
        input_data["_csc_api_host"] = self.get_csc_host_url()
        input_data["_csc_host"] = self.get_host_url()
        csc_session: CSCSession = CSCSession(user, requests.Session(), cookies)
        if self.config.schema:
            convert_data_with_format(input_data, self.config.schema)
        actions_responses = run_actions(csc_session, input_data, self.config)
        resp_text = []

        for action_response in actions_responses:
            if action_response["type"] == "message":
                resp_text.append({"type": "data"})
                resp_text.append(action_response["content"])
            elif action_response["type"] == "card":
                # Assuming card is converted to JSON string
                resp_text.append({"type": "card"})
            elif action_response["type"] == "api_response":
                resp_text.append(action_response["content"])
                # Handle the API response if needed
                pass
            elif action_response["type"] == "html_json":
                resp_text.append({"type": "html_json"})
                resp_text.append(action_response["content"])
            elif action_response["type"] == "error":
                resp_text.append({"type": "data"})
                resp_text.append(error_msg(action_response["content"]))
        return resp_text