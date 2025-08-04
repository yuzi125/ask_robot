import copy
import json
import logging
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from ava.utils.Common import safe_eval
from ava.utils.config_utils import set_value_if_not_empty
from ava.utils.web_utils import *
from kor import Object, Text

logger = logging.getLogger("ava_app")


class MappingNotFoundException(Exception):

    def __init__(self, message, text: str):
        self.message = message
        self.text = text
        super().__init__(self.message)


class CodeMapping:

    def __init__(self, code_dict):
        self.code_dict = {} if code_dict is None else code_dict

    def to_code(self, code_id, text):
        mapping = self.code_dict.get(code_id)
        assert mapping, f"{code_id} 未找到對應的轉換資料"
        found = next((code for code in mapping if text in code), None)
        if found:
            return re.sub(r"\s+.+$", "", found)
        return None

    def get_code_options(self, parameter_id):
        return self.code_dict.get(parameter_id)

    def get_code_mapping(self, parameter_id, text):
        param_data = self.code_dict.get(parameter_id)
        if not param_data:
            return text

        mapping_dict = param_data.get("data", {})
        mapping = mapping_dict.get(text)
        if not mapping:
            upper_case_key = {k.upper(): k for k in mapping_dict.keys()}
            if text.upper() in upper_case_key:
                mapping = mapping_dict[upper_case_key[text.upper()]]
                if not mapping:
                    return text
            else:
                return text

        if param_data.get("dataType") == "object":
            try:
                mapping = json.loads(mapping.replace("'", "\""))
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding JSON: {e}")
                raise ValueError(
                    f"Error decoding JSON for parameter {parameter_id} with text {text}"
                )

        return mapping


class Action:

    def __init__(self):
        self.method = "post"
        self.type = None
        self.url = None
        self.message = None
        self.post_data: dict | None = None
        self.saved_data: list = []
        self.output = None
        self.post_data_record = None
        self.message_record: str = ""
        self.output_report: str = ""
        self.content_type = "application/x-www-form-urlencoded"
        self.content: str = ""
        self.response_next_skill = []
        self.response_output_format = {}
        self.success_status_codes = [
            200, 201, 202, 203, 204, 205, 206, 207, 208, 226
        ]
        self.error_responses = {}

    def merge_action(self, prev_action):
        if not prev_action:
            return
        fields = ["url", "message"]
        for field in fields:
            if not getattr(self, field):
                setattr(self, field, getattr(prev_action, field))

    def format_url(self, input_data):
        if self.url:
            self.url = self.url.format(**input_data)

    def merge_post_data(self, prev_action, input_data):
        post_data = self.clone_post_data_template()
        if post_data:
            for key, value in post_data.items():
                if isinstance(value, str):
                    if value.startswith("{{") and value.endswith("}}"):
                        while "{{" in value and "}}" in value:
                            start_index = value.index("{{")
                            end_index = value.index("}}") + 2
                            expression = value[start_index + 2:end_index - 2]
                            _split_exp = expression.split(".")
                            temp_obj = input_data.get(_split_exp[0])
                            for _exp in _split_exp[1:]:
                                if hasattr(temp_obj, _exp):
                                    temp_obj = getattr(temp_obj, _exp)
                                else:
                                    temp_obj = temp_obj.get(_exp)
                            value = value[:start_index] + str(
                                temp_obj) + value[end_index:]
                        post_data[key] = value
                    elif value.startswith("{") and value.endswith("}"):
                        post_data[key] = input_data.get(value[1:-1], value)
                    elif value.startswith("`") and value.endswith("`"):
                        result = safe_eval(value[1:-1],
                                           {key: input_data.get(key)})
                        post_data[key] = result
                    else:
                        post_data[key] = value
                else:
                    post_data[key] = value
        else:
            post_data = {}

        logger.debug(f"Pre-merge post_data_record: {self.post_data_record}")
        if prev_action and prev_action.post_data_record:
            logger.debug(
                f"Pre-merge prev_action.post_data_record: {prev_action.post_data_record}"
            )
            self.post_data_record = prev_action.post_data_record
            for key, value in post_data.items():
                if key in self.post_data_record and isinstance(
                        self.post_data_record[key], list) and isinstance(
                            value, list):
                    self.post_data_record[
                        key] = self.post_data_record[key] + value
                elif key in self.post_data_record and isinstance(
                        self.post_data_record[key], list):
                    if isinstance(value, list):
                        self.post_data_record[key].extend(value)
                    else:
                        self.post_data_record[key].append(value)
                else:
                    self.post_data_record[key] = value
        else:
            self.post_data_record = post_data

        logger.debug(f"Post-merge post_data_record: {self.post_data_record}")

    def parse_saved_data(self, html):
        return parse_saved_data(html, self.saved_data)

    def clone_post_data_template(self):
        return copy.deepcopy(self.post_data)

    @classmethod
    def from_json_string(cls, json_data):
        obj = cls()
        fields = [
            "method", "type", "url", "message", "post_data", "saved_data", "output",
            "content_type", "content", "response_next_skill",
            "response_output_format", "success_status_codes", "error_responses"
        ]
        for field in fields:
            if json_data.get(field):
                setattr(obj, field, json_data.get(field))
        return obj


class Example:

    def __init__(self, input, fields: dict):
        self.input = input
        self.fields = fields

    def get_kor(self):
        return (
            self.input,
            [self.fields],
        )


class Parameter:

    def __init__(self,
                 id,
                 label,
                 description,
                 examples=None,
                 tip="",
                 button_tip=[],
                 sync_fields=[],
                 button_tip_key: str | None = None,
                 button_tip_evaluation: str | None = None,
                 regex: str | None = None):
        self.id = id
        self.label = label
        self.description: str = description
        self.default_value = None
        self.required = False
        self.format: str | None = None
        self.examples = examples if examples is not None else []
        self.tip: str = tip
        self.button_tip = button_tip
        self.button_tip_key: str | None = button_tip_key
        self.button_tip_evaluation: str | None = button_tip_evaluation
        self.sync_fields = sync_fields
        self.regex: str | None = regex

    def get_kor(self):
        dt = datetime.now(ZoneInfo(os.environ.get("TZ", "Asia/Taipei")))
        return Text(
            id=self.id,
            description=self.description.format(now=str(dt)),
            examples=self.examples,
        )

    def is_time(self):
        if self.format:
            return self.format == 'time'
        return False

    def is_date(self):
        if self.format:
            return 'date' in self.format
        return False

    def is_code(self):
        if self.format:
            return 'code' in self.format
        return False

    def get_date_fmt(self):
        if not self.is_date():
            raise ValueError(f"{self.id} is not in time format")
        if isinstance(self.format, str) and ".c" in self.format:
            return "c"
        return "w"

    @classmethod
    def from_json_string(cls, param_data):
        param = cls(param_data["id"],
                    param_data["label"], param_data["description"],
                    param_data.get("examples", []), param_data.get("tip", ""),
                    param_data.get("button_tip", ""),
                    param_data.get("sync_fields", []),
                    param_data.get("button_tip_key", None),
                    param_data.get("button_tip_evaluation", None),
                    param_data.get("regex", None))
        fields = ["required", "default_value", "format", "many"]
        return set_value_if_not_empty(param, fields, param_data)


class Schema:

    def __init__(self, id, description, parameters: list[Parameter], examples,
                 code_mapping, button_tip_mapping: dict[str, list]):
        self.id = id
        self.description = description
        self.parameters = parameters
        self.examples = examples
        self.code_mapping: CodeMapping = code_mapping
        self.data_process = None
        self.button_tip_mapping: dict[str, list] = button_tip_mapping

    def get_kor_definition(self):
        dt = datetime.now(ZoneInfo(os.environ.get("TZ", "Asia/Taipei")))
        _parameters = [{
            "id": param.id,
            "description": param.description.format(now=str(dt))
        } for param in self.parameters]
        _examples = [{
            "input": example.input,
            "fields": example.fields
        } for example in self.examples]
        return {
            "id": self.id,
            "description": self.description.format(now=str(dt)),
            "parameters": _parameters,
            "examples": _examples,
        }
        # dt = datetime.now(ZoneInfo(os.environ.get("TZ", "Asia/Taipei")))
        # return Text(
        #     id=self.id,
        #     description=self.description.format(now=str(dt)),
        #     examples=self.examples,
        # )
        # return Object(
        #     id=self.id,
        #     description=self.description,
        #     examples=[example.get_kor() for example in self.examples],
        #     attributes=[attribute.get_kor() for attribute in self.parameters])

    def get_date_time_code_format_fields(self):
        return [
            param for param in self.parameters
            if param.is_date() or param.is_time() or param.is_code()
        ]

    def get_params(self):
        return self.parameters
        

    def get_post_report(self, input_data):
        reports = []
        for key, value in input_data.items():
            parameter = self.find_parameter_with_id(key)
            if parameter and value:
                if parameter.is_code():
                    text = self.find_parameter_code_option(parameter.id, value)
                    if text is None:
                        text = value
                    reports.append(f" - {parameter.label}: {text}")
                else:
                    reports.append(f" - {parameter.label}: {value}")
        return reports

    def find_parameter_with_id(self, parameter_id):
        for param in self.parameters:
            if param.id == parameter_id:
                return param
        return None

    def find_parameter_code_option(self, parameter_id, code):
        mapping = self.code_mapping.get_code_options(parameter_id)
        assert mapping, f"parameter:{parameter_id} not exists"
        for option in mapping:
            if option.startswith(f"{code} "):
                return option
        return None

    @classmethod
    def from_json_string(cls, json_data_obj):
        if not json_data_obj:
            return None
        param = cls(json_data_obj["id"], json_data_obj["description"], [
            Parameter.from_json_string(param_json)
            for param_json in json_data_obj["parameters"]
        ], [
            Example(**example_data)
            for example_data in json_data_obj["examples"]
        ], CodeMapping(json_data_obj.get("code_mapping")),
                    json_data_obj.get("button_tip_mapping", {}))
        fields = ["data_process"]
        return set_value_if_not_empty(param, fields, json_data_obj)
