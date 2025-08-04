import importlib
import json
import logging
import re
import copy
from typing import Any, Optional

from ava.handlers.skills.CommonConfig import Action
from ava.handlers.skills.dataprocess.AvaDataFilter import AvaDataFilter
from ava.handlers.skills.WebAPIConfig import WebAPIConfig
from ava.utils.Common import safe_eval
from ava.utils.web_utils import (get_message, parse_saved_data,
                                 process_md_form_output,
                                 process_md_table_output, process_output)
from bs4 import BeautifulSoup
from requests import Response

logger = logging.getLogger("ava_app")


def load_data_processor(pg_id):
    handler_modules = importlib.import_module(
        'ava.handlers.skills.dataprocess.' + pg_id)
    class_name = re.sub(r'^\w+\.', '', pg_id)
    class_ = getattr(handler_modules, class_name)
    handler_object = class_()
    logger.info(f"data_processor_object initialized: {class_name}!")
    return handler_object


def recursive_format(value, data):
    if isinstance(value, dict):
        return {k: recursive_format(v, data) for k, v in value.items()}
    elif isinstance(value, list):
        return [recursive_format(v, data) for v in value]
    elif isinstance(value, str):
        try:
            # 檢查是否有 json.dumps，並進行特殊處理
            if "json.dumps(" in value:
                # 只處理 json.dumps 內部的部分
                start_idx = value.index("json.dumps(") + len("json.dumps(")
                end_idx = value.rindex(")")
                json_content = value[start_idx:end_idx]

                # 格式化 json.dumps 內的內容
                evaluated_json_content = eval(json_content, {}, data)

                # 評估並返回最終結果
                return json.dumps(evaluated_json_content)
            else:
                # 普通的格式化
                formatted_value = value.format(**data)
                return safe_eval(formatted_value, data)
        except KeyError as e:
            logger.error(f"KeyError in formatting value: {e}")
            raise e
        except SyntaxError:
            return formatted_value
    else:
        return value

def _get_result_content(action, data) -> list:
    result_content = []
    response_output_format_type = action.response_output_format.get("type")
    if not response_output_format_type == "json":
        return result_content
    
    response_success = action.response_output_format.get("response_success")
    if not response_success:
        result_content.append(action.response_output_format.get("response_extract_nomatch"))
        return result_content
    
    if not eval(response_success, None, {"root": data}):
        return result_content
    
    response_extract_pattern_success = action.response_output_format.get("response_extract_pattern_success", [])
    response_limit = action.response_output_format.get("response_limit", None)
    count = 0
    for item in response_extract_pattern_success:
        if response_limit is not None and count >= response_limit:
            break  # 如果達到限制，則跳出迴圈
        count += 1  # 增加計數器
        response_data_path = item.get("response_data_path")
        return_body = item.get("return_body")  # 要回傳的

        if response_data_path and return_body:
            # 這邊會拿到API回傳的東西 我們用root接起來以後 預期變成一個list
            api_response_data = eval(response_data_path, {"root": data})
            for response_item in api_response_data:
                for body in return_body:
                    process_data = body.get("data")
                    _temp = {
                        "tag": process_data.get("tag"),
                        "text": safe_eval(process_data["text"],{"data":response_item}),
                        "after_new_line": process_data.get("after_new_line",False)
                    }

                    if process_data.get("action",None) is not None:
                        _temp["action"] = process_data.get("action")
                    if process_data.get("args",None) is not None:
                        _temp["args"] = recursive_format(process_data.get("args"),{"data":response_item})
                    if process_data.get("url",None) is not None:
                        _temp["url"] = safe_eval(process_data.get("url",None),{"data":response_item})
                    result_content.append(_temp)
    else:
        response_extract_pattern_fail = action.response_output_format.get(
            "response_extract_pattern_fail")
        if response_extract_pattern_fail:
            pass

    return result_content

def _get_response(session, input_data, config: WebAPIConfig, 
                  dp:Optional[AvaDataFilter], action:Action) -> Optional[Response]:

    method = input_data.get("method", "post").lower()
    has_req_func = hasattr(session, method) and callable(getattr(session, method))
    if not has_req_func:
        return None

    if method == "get":
        headers = { "X-Forwarded-For":input_data.get("_client_ip")}
    else:
        headers = {'Content-Type': action.content_type, "X-Forwarded-For":input_data.get("_client_ip")}

    req_func = getattr(session, method)
    if not (dp is not None and config.schema):
        resp: Response = req_func(action.url, data=action.post_data_record, headers=headers)
        return resp

    req_parameters = copy.deepcopy(input_data)
    req_parameters.pop("_client_ip", None)
    req_parameters.pop("_host", None)
    req_parameters.pop("_user", None)
    req_parameters.pop("ava_token", None)
    
    getattr(dp, f"before_{method}")(req_parameters, config.schema)
    resp: Response = req_func(action.url, data=action.post_data_record, headers=headers)
    getattr(dp, f"after_{method}")(req_parameters, config.schema, resp)
    return resp

def run_actions(session, input_data, config: WebAPIConfig):
    prev_action: Optional[Action] = None
    actions: list[Action] = config.actions
    responses = []

    # 額外的資料處理邏輯
    dp: Optional[AvaDataFilter] = None
    if config.schema:
        if config.schema.data_process is not None:
            dp = load_data_processor(config.schema.data_process)

    for action in actions:
        if prev_action:
            action.merge_action(prev_action)
        action.format_url(input_data)
        action.merge_post_data(prev_action, input_data)
        logger.debug(f"{action.url} -> {action.post_data_record}")

        if action.type == "message":
            message: str = action.content.format(**input_data)
            logger.info(f"Message: {message}")
            responses.append({"type": "message", "content": message})
        elif action.type == "card":
            logger.info(f"Card: {action.content}")
            responses.append({"type": "card", "content": action.content})
        elif action.type == "html_json":
            responses.append({
                "type": "html_json",
                "content": safe_eval(action.content, input_data)
            })
        elif action.type == "api_call":
            resp: Optional[Response] = _get_response(session, input_data, config, dp, action)
            if resp is None:
                responses.append({
                    "type": "error",
                    "content": f"No request function from {action.url}"
                })
                continue
            response_data = resp.json()
            logger.debug(f"response_data: {response_data}")
            if not safe_eval("bool(root)", {"root": response_data}):
                logger.warning(f"No data returned from {action.url}")
                responses.append({
                    "type": "error",
                    "content": f"No data returned from {action.url}"
                })
                continue  

            # 解析 response_output_format
            response_output_format = action.response_output_format
            if response_output_format:
                response_success = safe_eval(response_output_format.get("response_success", "False"), {"root": response_data})
                if not response_success:
                    # 處理失敗的模式
                    for fail_pattern in response_output_format.get("response_extract_pattern_fail", []):
                        condition = fail_pattern.get("condition")
                        message_expr = fail_pattern.get("message")
                        if safe_eval(condition, {"root": response_data}):
                            message = safe_eval(f"f'{message_expr}'", {"root": response_data}) or ""
                            logger.warning(message)
                            responses.append({
                                "type": "error",
                                "content": message
                            })
                            break
                    continue

            # 將 success_status_codes 和 error_responses 轉為字串型別的字典
            success_status_codes = [
                str(code)
                for code in getattr(action, "success_status_codes", [200])
            ]
            error_responses = {
                str(k): v
                for k, v in getattr(action, "error_responses", {}).items()
            }

            if str(resp.status_code) not in success_status_codes:
                error_message = error_responses.get(
                    str(resp.status_code), f"Error in query {action.url}")
                logger.error(error_message)
                logger.error(f" --> {resp.text}")
                raise ValueError(f"{error_message}")

            # 把下一個要執行的技能放進去
            resp_data = resp.json()
            if len(action.response_next_skill) > 0:
                for skill_item in action.response_next_skill:
                    for j, data in enumerate(resp_data.get("data", [])):
                        if data[skill_item["type"]]:
                            data[skill_item["type"]]["next_skill"] = skill_item["next_skill"]
            if config.format == "html":
                soup = BeautifulSoup(resp.text, 'html.parser')
                saved_data = parse_saved_data(soup, action.saved_data)
                for key, value in saved_data.items():
                    input_data[key] = value
                action.message_record = get_message(soup, action.message)
                logger.debug(f"message -> {action.message_record}")
                if action.output:
                    action.output_report = process_output(soup, action.output)
            elif config.format == "json":
                data = resp_data
                if isinstance(data, list):
                    action.output_report = process_md_table_output(
                        action.output, data)
                elif isinstance(data, dict):
                    if action.output:
                        action.output_report = process_md_form_output(action.output, data)
                else:
                    logger.error(f"Unexpected data type: {type(data)}")
                    raise ValueError(f"Unexpected data type: {type(data)}")
            
                if action.response_output_format:
                    result_content = _get_result_content(action, data)
                    responses.append({
                        "type": "html_json",
                        "content": result_content
                    })
                else:
                    responses.append({"type": "api_response", "content": data})
            elif config.format == "model":
                pass
        prev_action = action

    return responses
