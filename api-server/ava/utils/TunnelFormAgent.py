import json
import os
import re
from datetime import datetime
from logging import Logger, getLogger
from typing import Any, Sequence
from zoneinfo import ZoneInfo

import requests
from ava.clients.sql.crud import (select_all_form_config,
                                  select_expert_from_id,
                                  select_form_config_from_id,
                                  select_form_config_from_name,
                                  select_settings_from_key)
from ava.clients.sql.database import scoped_session
from ava.clients.sql.schema import (Expert_Schema, FormConfiguration_Schema,
                                    Settings_Schema)
from ava.model.dscom import User
from ava.utils import env_utils
from ava.utils.AzureOpenAIHandler import run_azure_openai_model
from ava.utils.ClaudeHandler import ClaudeHandler
from ava.utils.Common import safe_eval
from ava.utils.CustomKor import generate_prompt, process_result
from ava.utils.GPTHandler import GPTHandler
from ava.utils.model_utils import get_model_and_params
from ava.utils.return_message_style import error_msg, info_msg
from ava.utils.TwccFFmHandler import run_ffm_langchain, run_ffm_model
from langchain_openai import ChatOpenAI


class TunnelFormAgent:

    def __init__(self, message: dict[str, Any], user: User,expert_id :str,chat_uuid:str,session_maker:scoped_session) -> None:
        self.prompt = """
        Your are a help desk to receive device or network fault from user input and you will tell me the fault type. The options are:

        {options}

        Finally, you will output the code for the guessed fault type in the following format:

        Type: {{number}}

        User Input: {user_input}
        """

        self.universal_classifier_prompt = """
        Your are a help desk to receive questions from users. You will tell me the classifier code from user input. The options are:

        {options}

        Finally, output the code for your guessed classifer code in the following format:

        Type: {{code}}

        User Input: {user_input}
        """

        self.logger: Logger = getLogger("ava_app")

        # 原始的整包 message
        self.message: dict[str, Any] = message

        # 使用者輸入的訊息
        # 會用這樣的寫法是因為報修技能也要串進來使用 真的太難搞在一起 暫時先這樣
        self.user_input: str = message["input_message"] if isinstance(message,dict) else message

        # 表單狀態
        # 會用這樣的寫法是因為報修技能也要串進來使用 真的太難搞在一起 暫時先這樣
        self.form_state: str | None = message.get("state") if isinstance(message,dict) else None

        # 當前表單內容
        self.current_form: dict[str, Any] = {}

        # 表單的 index
        self.form_id: str = "UNDEFINED"

        # 使用的表單的設定
        self.target_config: dict[str, Any] = {}

        # 要送出表單的 post data
        self.post_form_data : dict[str,Any] = {}

        # 使用者
        self.user: User = user

        # 需要在結束前填入當前表單的欄位，以滿足表單的完整性
        self.need_fill_to_current : list[dict[str,Any]] = []

        # 需要額外剔除的 field
        self.delete_key_set : set[str] = set()

        # 專家 id
        self.expert_id: str = expert_id

        # 聊天 uuid
        self.chat_uuid: str= chat_uuid

        # db session_maker
        self.session_maker = session_maker
    def handle_tunnel(self) -> dict[str, Any]:
        if self.form_state is not None:
            self.current_form = json.loads(self.message["current_form"])
            self.form_id = self.message["form_id"]
            with self.session_maker() as session:
                form_configuration = select_form_config_from_id(form_id=self.form_id,session=session)
                assert form_configuration
            _target_config = form_configuration.form_config

            # 這是為了讓全部的表單都能夠使用相同的格式，才故意多套一層 config
            self.target_config = {"config":_target_config,"name":form_configuration.form_name,"description":form_configuration.form_description,"id":form_configuration.id}
            for value in self.current_form.values():
                field = self.find_field_with_label_recursive(
                    self.target_config["config"]["fields"], value["label"])
                assert field
                if "children" in field:
                    for c in field["children"]:
                        if c["field_label"] not in self.current_form:
                            self.need_fill_to_current.append(c)
                        if c not in self.target_config["config"]["fields"]:
                            self.target_config["config"]["fields"].append(c)
            if self.form_state == "filling":
                return  self.handle_filling_state()
            elif self.form_state == "recheck":
                return self.handle_recheck_state()
            else:
                raise Exception("表單狀態錯誤，有問題請聯絡管理員")
        else:
            return self.handle_initial_tunnel()

    def find_field_with_label(self, config_data, field_label):
        fields = config_data.get("fields")
        for field in fields:
            if field.get("field_label") == field_label:
                return field
        return None

    def find_field_with_label_recursive(self, fields, field_label)->dict[str,Any] | None:
        for field in fields:
            if field.get("field_label") == field_label:
                return field
            else:
                if "children" in field:
                    childrens = field["children"]
                    if (res := self.find_field_with_label_recursive(
                            childrens, field_label)) is not None:
                        return res
        return None

    def get_first_blank_field(self) -> str | None:
        fillter_array = [
            key for key, value in self.current_form.items()
            if value.get("value") == ""
        ]
        if fillter_array:
            return fillter_array[0]
        else:
            return None

    def get_inference_config(self, inference: dict)-> tuple[str, str, str]:
        for property in ["input", "hint", "output"]:
            assert inference.get(
                property), f"{property} must be provided in inference"
        return inference["input"], inference["hint"], inference["output"]

    def judge_classifier_code(self, user_input: str,
                              classifier_codes: list[str]):
        options = []
        # loop item in classifier_codes, replace the ':' with '\t' in each item and return the final list
        for item in classifier_codes:
            options.append(item.replace(":", "\t"))

        options_str = "\n".join(options)
        return self.process_classifier(options_str, user_input)

    def infer_form_data(self):
        field_inference: list = self.target_config["config"].get("field_inference")
        if not field_inference:
            return

        hints = self.target_config["config"].get("hints")
        assert hints, "hints must be provided in config"

        for inference in field_inference:
            input_field, hint, output = self.get_inference_config(inference)

            options = hints.get(hint)
            assert options, f"options must be provided in {hint}"
            try:
                infer_value = self.judge_classifier_code(
                    self.post_form_data.get(input_field), options)  #type: ignore
            except Exception as e:
                self.logger.error(e)
                continue
            self.post_form_data[output] = infer_value

    def process_classifier(self, options_str, user_input):
        user_prompt = self.universal_classifier_prompt.format(
            user_input=user_input, options=options_str)
        with self.session_maker() as session:
            row_expert: Expert_Schema | None = select_expert_from_id(
            expert_id=self.expert_id,session=session)
            assert row_expert
            model_params = {
                    "top_p": 0,
                    "max_tokens": 1000,
                    "temperature": 0,
                    "frequency_penalty": 0
                }
            model_dict: dict[str, Any] = get_model_and_params(
            expert_config_json=row_expert.config_jsonb,session=session)
            model:str = model_dict["intention"]["model"]
            model_params.update(model_dict["intention"]["params"])
        
            expert_data ={
                "expert_id":self.expert_id,
                "expert_model":self.__class__.__name__,
                "expert_model_type":3
            }
            try:
                if model.startswith("azure") or model.startswith("caf"):
                    llm_response = run_azure_openai_model(
                        session=session,
                        model_list_id=model_dict["intention"]["model_list_id"],
                        chat_uuid=self.chat_uuid,
                        user=self.user,
                        expert_data=expert_data,
                        model_key=model,
                        user_input=self.user_input,
                        model_params=model_params,
                        user_prompts=[user_prompt])
                elif model.startswith("twcc"):
                    llm_response = run_ffm_model(
                        session=session,
                        model_list_id=model_dict["intention"]["model_list_id"],
                        chat_uuid=self.chat_uuid,
                        user=self.user,
                        expert_data=expert_data,
                        model_key=model,
                        user_input=self.user_input,
                        model_params=model_params,
                        user_prompts=[user_prompt])
                elif model.startswith("gpt"):
                    self.llm = ChatOpenAI(model=model,
                        temperature=0,
                        max_tokens=2000)
                    gpt = GPTHandler(api_key=env_utils.get_openai_key())
                    llm_response = gpt.run_gptModel(
                        session=session,
                        model_list_id=model_dict["intention"]["model_list_id"],
                        user=self.user,
                        messages=[{
                            "role": "user",
                            "content": user_prompt
                        }],
                        user_input=self.user_input,
                        expert_data=expert_data,
                        chat_uuid=self.chat_uuid,
                        model=model,
                        params=model_params)
                elif model.startswith("claude"):
                    claude = ClaudeHandler()
                    llm_response = claude.run_model_not_stream(
                        session=session,
                        user=self.user,
                        user_input=self.user_input,
                        expert_data=expert_data,
                        chat_uuid=self.chat_uuid,
                        model_list_id=model_dict["intention"]["model_list_id"],
                        system_prompt="",
                        message_content=user_prompt,
                        model_params=model_params,
                        model=model)
                else:
                    raise RuntimeError(f"未支援的模型 {model}")
                # result = claude.run_model_not_stream(
                #     system_prompt="No any explanation, just output the Type Code",
                #     message_content=json.dumps([{
                #         "type": "text",
                #         "text": user_prompt
                #     }]),
                #     model_params={
                #         "max_tokens": 1000,
                #         "temperature": 0
                #     },
                #     model="claude-3-sonnet-20240229")
                # assert result
                self.logger.info(f"TunnelFormAgent process_classifier llm_response: {llm_response}")
            except Exception as e:
                raise e
            else:
                # find index of "Type: " in the message content
                keyword = "Type: "
                type_index = llm_response.find(keyword) + len(keyword) #type: ignore
                # trim the message content from the index to the end

                return llm_response[type_index:].strip().split("\n")[0].split(' ')[0] #type: ignore
    def post_form(self):
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        try:
            resp: requests.Response = requests.post(self.target_config["config"]["form_action"],
                                 data=json.dumps(self.post_form_data),
                                 headers=headers)
            res_json = resp.json()
            self.logger.info(resp.status_code)
            self.logger.info(res_json)
            request_status: bool = resp.status_code >= 200 and resp.status_code < 300
            service_res_status: bool = int(
                res_json["status"]) == 200 and res_json["error"] is None
            self.logger.info(
                f"request_status: {request_status}, service_res_status: {service_res_status}"
            )
            if request_status:
                if service_res_status:
                    return True, res_json
                else:
                    return False, res_json["error"]
            else:
                return False, "response status code is not 2XX"
        except Exception as ex:
            self.logger.error(f"post_form error,  ex: {ex}")
            return False, ex

    def judge_problem_type(self, problem_types: list):
        # loop item in problem_types, add the item.get("type") to a list
        options = [
            f"{i}. {item.get('description')}"
            for i, item in enumerate(problem_types)
        ]
        options_str = "\n".join(options)
        user_prompt = self.prompt.format(user_input=self.user_input,
                                         options=options_str)
        return self.process_classifier(user_prompt, self.user_input)
    
    def get_form_info(self):
        with self.session_maker() as session:
            form_configs: Sequence[
                FormConfiguration_Schema] = select_all_form_config(session=session)
        problem_types = [{
            "id": form_config.id,
            "config": form_config.form_config,
            "name": form_config.form_name,
            "description": form_config.form_description
        } for form_config in form_configs]
        try:
            prob_type = self.judge_problem_type(problem_types)
            target_config = problem_types[int(prob_type)]
            self.target_config = target_config
            self.form_id = target_config["id"]
        except Exception as ex:
            self.logger.error(f"get_form_info error: {ex}")
            raise Exception("未找到符合的表單")
        return target_config

    def handle_initial_tunnel(self) -> dict[str, Any]:
        try:
            with self.session_maker() as session:
                match_form: FormConfiguration_Schema | None = select_form_config_from_name(
                    form_name=self.user_input,session=session)
            if match_form is not None:
                target_config: dict[str, Any] = {
                    "id": match_form.id,
                    "config": match_form.form_config,
                    "name": match_form.form_name,
                    "description": match_form.form_description
                }
                self.form_id =  match_form.id
            else:
                target_config: dict[str, Any] = self.get_form_info()
        except Exception as ex:
            self.logger.error(
                f"handle_initial_input get_form_info error: {ex}")
            raise ex
        else:
            self.target_config = target_config
        config_data: dict[str, Any] | None = target_config.get("config")
        form_id: str | None = target_config.get("id")
        if config_data is None or form_id is None:
            raise Exception("表單設定錯誤，有問題請聯絡管理員")
        _fields: list[dict[str, Any]] | None = config_data.get("fields")
        if _fields is None:
            raise Exception("表單欄位設定錯誤，有問題請聯絡管理員")
        self.form_id = form_id
        form_fields = {
            field["field_name"]: {
                "value":
                "" if not field.get("default")
                or safe_eval(field.get("default"), {"user": self.user}) is None
                else safe_eval(field.get("default"), {"user": self.user}),
                "format":
                field["field_format"],
                "editable":
                field.get("editable", True),
                "label":
                field["field_label"],
                "is_show":
                field["is_show"],
                "validate":field.get("validate"),
                "validate_error_message":field.get("validate_error_message")
            }
            for field in _fields
        }

        if config_data.get("input_field") in form_fields and not match_form:
            form_fields[config_data.get(
                "input_field")]["value"] = self.user_input
        for _field in form_fields.values():
            if (regex:=_field["validate"]) is not None:
                if not re.match(regex, _field["value"]):
                    if _field.get("editable",True):
                        _field["value"] = ""
                    else:
                        message = "輸入不符合格式要求"
                        if (validata_error_message := _field.get("validate_error_message")) is not None:
                            message = validata_error_message
                        return {
                            "form_id":
                            form_id,
                            "state":
                            "abort",
                            "tunnel_type":"form",
                            "current_form":
                            form_fields,
                            "return_message":
                            f"{error_msg(message)}",
                        }
        self.current_form = form_fields
        blank_field_label = None
        field: str | None = self.get_first_blank_field()
        if field:
            blank_field_label = form_fields[field]["label"]
        if blank_field_label:
            return {
                "form_id":
                form_id,
                "state":
                "start",
                "tunnel_type":"form",
                "current_form":
                form_fields,
                "return_message":
                f"根據您的描述，將為您填寫{target_config.get('name', '表單')}，請提供以下資訊: {info_msg(blank_field_label)}",
            }
        else:
            return self.handle_recheck_state()
    def refill_extra_fields(self) -> None:
        for need_field in self.need_fill_to_current:
            if (field:=self.find_field_with_label_recursive(self.target_config["config"]["fields"],self.current_form[need_field["field_parent"]]["label"])) is not None:
                if self.current_form[field["field_name"]]["value"]:
                    try:
                        should_add_child_field = safe_eval(need_field["triggered_by"].format(**{field["field_name"]:self.current_form[field["field_name"]]["value"]}))
                    except NameError:
                        raise Exception(f"config 設定有誤，請聯絡管理員 \n\n {' '.join([f"{info_msg(f"{item["label"]} : {item["value"]}")}" for item in self.current_form.values() if item["value"]])}")
                    if need_field["field_name"] not in self.current_form and should_add_child_field:
                        self.current_form[need_field["field_name"]] = {"value":"","format":need_field["field_format"],"editable":need_field.get("editable",True),"label":need_field.get("field_label","未知")}
    def handle_recheck_state(self) -> dict[str, Any]:
        self.process_delete_key()
        for key in self.current_form.keys():
            field = self.find_field_with_label_recursive(
                self.target_config["config"]["fields"], self.current_form[key]["label"])
            assert field
            process_children_error_message = self.process_exiton_and_regex(field,key)
            if process_children_error_message != "NO_ERROR":
                    return{
                                        "form_id": self.form_id,
                                        "state":"filling",
                                        "current_form":self.current_form,
                                        "tunnel_type":"form",
                                        "return_message": f"{error_msg(process_children_error_message)}\n\n根據您的描述，將為您填寫{self.target_config["name"]}，請提供以下資訊: {info_msg(self.current_form[key]["label"])}",
                                    }
        self.refill_extra_fields()
        if (blank_field :=self.get_first_blank_field()) is not None:
            return {
                "form_id": self.form_id,
                "state": "filling",
                "current_form": self.current_form,
                "tunnel_type":"form",
                "return_message": f"根據您的描述，將為您填寫{self.target_config['name']}，請提供以下資訊: {info_msg(self.current_form[blank_field]["label"])}",
            }
        else:
            if self.delete_key_set:
                return {
                "form_id": self.form_id,
                "state": "recheck",
                "current_form": self.current_form,
                "tunnel_type":"form",
                "return_message": ""
                }
            else:
                if (action_type :=
                        self.target_config["config"]["action_type"]) == "form":
                    return self.handle_form_submission()
                elif action_type == "output":
                    return self.handle_output_action()
                else:
                    raise Exception("表單行為錯誤，未知的 action_type，有問題請聯絡管理員")
    def handle_output_action(self) -> dict[str, Any]:
        try:
            local_vars: dict[str, Any] ={"_user":self.user}
            local_vars.update(os.environ) # type: ignore
            local_vars.update({key:value["value"] for key,value in self.current_form.items()})
            output = safe_eval(self.target_config["config"]["output_action"],local_vars)
            return {
                "form_id": self.form_id,
                "state":"success",
                "current_form":self.current_form,
                "tunnel_type":"form",
                "return_message": f"{output} \n\n{' '.join([f"{info_msg(f"{value["label"]} : {value["value"]}")}" for value in self.current_form.values() if value.get("is_show" ,True)])}"
            }
        except Exception as ex:
            self.logger.error(f"output_action error: {ex}")
            return {
                "form_id": self.form_id,
                "state":"error",
                "current_form":self.current_form,
                "tunnel_type":"form",
                "return_message": f"表單行為錯誤，詳細原因: {ex}，有問題請聯絡管理員"
            }

    def handle_form_submission(self) -> dict[str, Any]:
        self.collect_form_data()
        self.target_config["config"]["form_action"] = self.target_config["config"]["form_action"].format(**os.environ)
        self.infer_form_data()

        if "extra_append_fields" in self.target_config["config"]:
            zone = ZoneInfo("Asia/Taipei")
            now_time = datetime.now(tz=zone)
            year = now_time.year - 1911
            strptime = now_time.strftime("%m%d")
            today_date = f"{year}{strptime}"
            now_hour_min_sec = now_time.strftime("%H%M%S")
            for key, value in self.target_config["config"]["extra_append_fields"].items():
                self.post_form_data[key] = safe_eval(
                    value, {
                        "user": self.user,
                        "today_date": today_date,
                        "now_hour_min_sec": now_hour_min_sec,
                        "form_data": self.post_form_data
                    })

        post_result, resp_msg = self.post_form()
        return self.handle_post_form_result(post_result, resp_msg)
    def collect_form_data(self) -> None:
        fields = self.target_config["config"].get("fields", [])
        form_data: dict[str,Any] = {}

        # 根據 collect_fields 中的 key 從 fields 中找出相應的 field，並將值存入 form_data
        for key, field_data in self.current_form.items():
            field = next((f for f in fields if f.get("field_name") == key), None)
            if field:
                form_data[field["field_name"]] = field_data.get("value")
        self.post_form_data = form_data

    def handle_post_form_result(self,post_result, resp_msg):
        is_record_form = False
        with self.session_maker() as session:
            setting: Settings_Schema | None = select_settings_from_key(key="is_record_tunnel_form",session=session)
        success_message = f"送出成功，已為您填寫報修單"
        fill_info: str =f"\n\n {' '.join([f'{info_msg(f'{value['label']} : {value['value']}')}' for value in self.current_form.values() if value.get('is_show', True)])}"
        if custom_success_message := self.target_config["config"].get("success_message"):
            success_message = custom_success_message["component"]
            success_message.append({"tag":"html","text":fill_info})
        else:
            success_message = f"{success_message}{fill_info}"
        if setting:
            is_record_form = int(setting.value) == 1
        if is_record_form:
            if post_result:
                return {
                    "form_id":
                    self.form_id,
                    "state":
                    "success",
                    "tunnel_type":"form",
                    "current_form":
                    self.current_form,
                    "return_message":
                    success_message
                }
            else:
                return {
                    "tunnel_type":"form",
                    "form_id":
                    self.form_id,
                    "state":
                    "error",
                    "current_form":
                    self.current_form,
                    "return_message":
                    f"表單建立錯誤，詳細原因: {error_msg(f'{resp_msg}，有問題請聯絡管理員')}\n\n {' '.join([f'{info_msg(f'{value['label']} : {value['value']}')}' for value in self.current_form.values() if value.get('is_show', True)])}"
                }
        else:
            return {
                "tunnel_type":"form",
                "form_id": self.form_id,
                "state": "success",
                "current_form": self.current_form,
                "return_message": success_message
            }
    def process_delete_key(self):
        for key in self.current_form:
            _field:dict | None = self.find_field_with_label_recursive(self.target_config["config"]["fields"],self.current_form[key]["label"])
            assert _field
            if "field_parent" in _field:
                if _field["field_parent"] not in self.current_form:
                    self.current_form[key]["value"] = ""
                    self.delete_key_set.add(key)
                else:
                    parent_field = self.find_field_with_label_recursive(self.target_config["config"]["fields"],self.current_form[_field["field_parent"]]["label"])
                    assert parent_field
                    if safe_eval(_field["triggered_by"].format(**{_field["field_parent"]:self.current_form[_field["field_parent"]]["value"]})) is False:
                        self.delete_key_set.add(key)
        for key in self.delete_key_set:
            del self.current_form[key]
    def process_exiton_and_regex(self,field:dict[str,Any],blank_field_name:str)->str:
        if (exit_on :=field.get("exit_on")) is not None:
            condition = exit_on["condition"]
            condition = condition.format(**{field["field_name"]:self.current_form[blank_field_name]["value"]},**os.environ)
            res: requests.Response = requests.get(condition)
            if res.status_code == 200:
                res_json = res.json()
                condition_action = exit_on.get("response_condition_action",[])
                for action in condition_action:
                    try:
                        if (res_eval :=safe_eval(action["condition"],{"root":res_json})) is True:
                            behavior = action["behavior"]
                            if behavior == "output":
                                output = safe_eval(action["output"],{"root":res_json})
                                if output is None:
                                    form_error_msg = exit_on["error_message"]
                                    self.current_form[blank_field_name]["value"] = ""
                                    return form_error_msg
                                else:
                                    form_error_msg = output
                                    self.current_form[blank_field_name]["value"] = ""
                                    return form_error_msg
                        elif res_eval is None:
                            form_error_msg = exit_on["error_message"]
                            self.current_form[blank_field_name]["value"] = ""
                            return form_error_msg
                    except NameError:
                        raise Exception(f"config 設定有誤，請聯絡管理員 \n\n {' '.join([f"{info_msg(f"{item["label"]} : {item["value"]}")}" for item in self.current_form.values() if item["value"]])}")
                for check in exit_on["status_check_list"]:
                    try:
                        if (res_eval :=safe_eval(check["condition"],  
                                {"value": safe_eval(check["path"], {"root": res_json})})) is False:
                            if "false_message" in check:
                                form_error_msg = check["false_message"]
                                self.current_form[blank_field_name]["value"] = ""
                                return form_error_msg
                            else:
                                try:
                                    form_error_msg =safe_eval(exit_on["result_message"], {"root": res_json})
                                    self.current_form[blank_field_name]["value"] = ""
                                    return form_error_msg or "未定義訊息"
                                except NameError as ex:
                                    form_error_msg = exit_on["error_message"]
                                    self.current_form[blank_field_name]["value"] = ""
                                    return form_error_msg
                        elif res_eval is None:
                            form_error_msg = check["false_message"]
                            self.current_form[blank_field_name]["value"] = ""
                            return form_error_msg
                    except NameError:
                        form_error_msg = "config 設定有誤，請聯絡管理員"
                        self.current_form[blank_field_name]["value"] = ""
                        return form_error_msg
            else:
                raise Exception("api request error")
        if regex :=field.get("validate"):
            if not re.match(regex, self.current_form[blank_field_name]["value"]):
                self.current_form[blank_field_name]["value"] = ""
                if (validate_error_message := field.get("validate_error_message")) is not None:
                    return validate_error_message
                return "輸入不符合格式要求"
        return "NO_ERROR"
    def handle_filling_state(self) -> dict[str, Any]:
        first_field: str | None = self.get_first_blank_field()
        process_children_error_message:str = "NO_ERROR"
        if first_field:
            result:dict[str,Any] = {}
            try:
                if (regex:=self.current_form[first_field]["validate"]) is not None:
                    if not re.match(regex, self.user_input):
                        return{
                            "tunnel_type":"form",
                            "form_id": self.form_id,
                            "state":"filling",
                            "current_form":self.current_form,
                            "return_message": f"{error_msg("請輸入符合規範限制的值")}\n\n根據您的描述，將為您填寫{self.target_config["name"]}，請提供以下資訊: {info_msg(self.current_form[first_field]["label"])}",
                        }
                result[first_field] = self.user_input
            except Exception as ex:
                self.logger.error(
                    f"tunnel claude output analyze error: {ex}, output: {result}")

            if first_field in self.current_form:
                field = self.find_field_with_label_recursive(
                    self.target_config["config"]["fields"], self.current_form[first_field]["label"])
                assert field
                self.current_form[first_field]["value"] = self.user_input
                process_children_error_message = self.process_exiton_and_regex(field,first_field)
                if process_children_error_message != "NO_ERROR":
                    return{
                        "tunnel_type":"form",
                                        "form_id": self.form_id,
                                        "state":"filling",
                                        "current_form":self.current_form,
                                        "return_message": f"{error_msg(process_children_error_message)}\n\n根據您的描述，將為您填寫{self.target_config["name"]}，請提供以下資訊: {info_msg(self.current_form[first_field]["label"])}",
                                    }
        self.refill_extra_fields()
        _field: str | None = self.get_first_blank_field()

        if _field:
            return {
                "tunnel_type":"form",
                "form_id":
                self.form_id,
                "state":
                "filling",
                "current_form":
                self.current_form,
                "return_message":
                f"根據您的描述，將為您填寫{self.target_config["name"]}，請提供以下資訊: {info_msg(self.current_form[_field]["label"])}",
            }
        else:
            return {
                "tunnel_type":"form",
                "form_id": self.form_id,
                "state": "recheck",
                "current_form": self.current_form,
                "return_message": ""
            }
