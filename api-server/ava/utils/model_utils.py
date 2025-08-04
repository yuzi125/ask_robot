from json import loads as json_loads
from typing import Any

from ava.clients.sql.crud import select_model_list_from_id
from ava.clients.sql.schema import ModelList_Schema


def get_model_and_params(*, expert_config_json: dict[str, Any],
                         session) -> dict[str, Any]:
    result = {}
    model_types: list[str] = ["search", "kor", "intention", "voice"]
    for model_type in model_types:
        if "current_config" not in expert_config_json.get(model_type, {}):
            raise RuntimeError("模型未設定完成，請聯絡管理員")
        current_config_name: str = expert_config_json.get(
            model_type, {}).get("current_config")
        assert current_config_name, "模型未設定完成，請聯絡管理員"

        current_config: dict = expert_config_json.get(model_type, {}).get(
            current_config_name, {})
        model_list_id: int | None = current_config.get("model_list_id")
        assert model_list_id
        row_model: ModelList_Schema | None = select_model_list_from_id(
            model_list_id=model_list_id, session=session)
        assert row_model
        result[model_type] = {
            "model": row_model.model_name,
            "vendor": row_model.vendor,
            "name": row_model.name,
            "model_list_id": model_list_id
        }
        row_model.config.update(current_config.get("model_params", {}))
        result[model_type]["params"] = row_model.config
        result[model_type]["search_kwargs"] = current_config.get(
            "search_kwargs", {})
    return result
