import logging
from datetime import datetime
from json import dumps as json_dumps
from json import loads as json_loads
from typing import Any
from ava.utils.TimeSemanticExpressor import *

from ava.utils.return_message_style import (error_msg, info_msg, success_msg,
                                            warn_msg)

logger = logging.getLogger("ava_app")


def safe_eval(expression, local_vars: dict = {}) -> Any | None:
    safe_builtins = {
        'abs': abs,
        'bool': bool,
        'complex': complex,
        'divmod': divmod,
        'float': float,
        'int': int,
        'max': max,
        'min': min,
        'pow': pow,
        'print': print,
        'round': round,
        'str': str,
        'sum': sum,
        "len": len,
        "datetime": datetime,
        "info_msg": info_msg,
        "error_msg": error_msg,
        "warn_msg": warn_msg,
        "success_msg": success_msg,
        "json_dumps": json_dumps,
        "json_loads": json_loads,
    }
    local_vars.update(safe_builtins)
    try:
        return eval(expression, {"__builtins__": None}, local_vars)
    except NameError as ex:
        logger.error(f"safe_eval NameError: {ex}")
        raise ex
    except Exception as ex:
        logger.debug(f"safe_eval error: {ex}, try again with extra quotes")
        try:
            return eval(f'"{expression}"', {"__builtins__": None}, local_vars)
        except Exception as ex:
            logger.error(f"safe_eval try again still error: {ex}")
            return None

def convert_data_with_format(input_data, schema):
    date_time_fields = schema.get_params()
    for field in date_time_fields:
        if field.is_time():
            input_data[field.id] = text_to_time(input_data[field.id], field.default_value)
        elif field.is_date():
            fmt = field.get_date_fmt()
            input_data[field.id] = text_to_date(input_data[field.id], field.default_value, fmt)
        elif field.is_code():
            # 如果輸入值為空且有預設值，使用預設值
            value_to_convert = input_data[field.id] if input_data[field.id] else field.default_value
            if value_to_convert:
                try:
                    code_text = schema.code_mapping.get_code_mapping(field.id, input_data[field.id])
                    # 如果轉換失敗，保留原始值
                    input_data[field.id] = code_text if code_text else value_to_convert
                except AssertionError as e:
                    logger.warning(f"代碼轉換失敗: {str(e)}")
                    input_data[field.id] = value_to_convert
        else:
            if input_data[field.id] is None or input_data[field.id].strip() == "":
                input_data[field.id] = field.default_value

