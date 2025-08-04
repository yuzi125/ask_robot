from ava.handlers.skills.CommonConfig import (Action, CodeMapping, Example,
                                              Parameter, Schema)
from ava.utils.config_utils import set_value_if_not_empty


class WebAPIConfig:

    def __init__(self, id, name, description, intention, system_prompt, host,
                 format, schema: Schema | None, actions: list[Action],
                 show_fill_record: bool):
        self.id = id
        self.name = name
        self.description = description
        self.intention = intention
        self.system_prompt = system_prompt
        self.host = host
        self.format = format
        self.schema = schema
        self.show_post = True
        self.show_msg = True
        self.actions = actions
        self.output = []
        self.show_fill_record: bool = show_fill_record

    def get_examples(self):
        return [example.input
                for example in self.schema.examples] if self.schema else []

    @classmethod
    def from_json_string(cls, json_data_obj):
        config = cls(
            json_data_obj["id"], json_data_obj.get("name", ""),
            json_data_obj["description"], json_data_obj["intention"],
            json_data_obj["system_prompt"], json_data_obj["host"],
            json_data_obj["format"],
            Schema.from_json_string(json_data_obj.get("schema", None)), [
                Action.from_json_string(json_data)
                for json_data in json_data_obj["actions"]
            ], json_data_obj.get("show_fill_record", False))
        return set_value_if_not_empty(config, ["show_post", "show_msg"],
                                      json_data_obj)
