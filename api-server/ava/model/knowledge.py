import json
import logging

logger = logging.getLogger(__name__)
from ava.clients.sql.crud import select_expert_dataset_mapping


class DataSet:

    def __init__(
        self,
        datasets_id,
        name,
        state,
        folder_name,
        config_jsonb,
        system_prompt,
        examples: list[str],
        intention,
        search_kwargs,
    ):
        self.datasets_id = datasets_id
        self.name = name
        self.state = state
        self.folder_name = folder_name
        self.config_jsonb = config_jsonb
        self.system_prompt = system_prompt
        self.examples = examples
        self.intention = intention
        self.search_kwargs = search_kwargs  # {"k": 3}

    @staticmethod
    def create_from_json(json_data):
        return DataSet(**json_data)


# TODO 這邊的datasets 應該是有問題的 沒有去辨認Type
def get_datasets(expert_id, session):
    return [
        DataSet.create_from_json(format_dataset_row(row.__dict__))
        for row in select_expert_dataset_mapping(expert_id=expert_id,
                                                 session=session)
    ]


def format_dataset_row(row):
    formatted_row = {
        "datasets_id": row["id"],
        "name": row["name"],
        "state": row["state"],
        "folder_name": row["folder_name"],
        "config_jsonb": row["config_jsonb"],
        "system_prompt": row["config_jsonb"]["system_prompt"],
        "intention": row["config_jsonb"]["intention"],
        "examples": row["config_jsonb"]["examples"],
        "search_kwargs": row["config_jsonb"]["search_kwargs"],
    }
    return formatted_row
