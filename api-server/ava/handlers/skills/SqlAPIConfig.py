from ava.handlers.skills.CommonConfig import CodeMapping, Action, Parameter, Schema, Example


class Table:
    def __init__(self, header, table_name, columns: list[str], attentions):
        self.header = header
        self.table_name = table_name
        self.columns = columns
        self.attentions = attentions

    def to_prompt(self, query):
        meta = [self.header, self.table_name, "----", "\n".join(self.columns), "\n### ".join(self.attentions),
                "### " + query]
        return "\n ".join(meta)

    @classmethod
    def from_json_string(cls, json_data_obj):
        return cls(json_data_obj['header'], json_data_obj['table_name'], json_data_obj['columns'],
                   json_data_obj['attentions'])


class TableSchema:
    def __init__(self, tables: list[Table], table_relations: list, sql_replacer):
        self.id = id
        self.tables = tables
        self.table_relations = table_relations
        self.sql_replacer = sql_replacer

    @classmethod
    def from_json_string(cls, json_data_obj):
        tables = [Table.from_json_string(json_data_table) for json_data_table in json_data_obj['tables']]
        return cls(tables, json_data_obj["table_relations"], json_data_obj["sql_replacer"])


class SqlAPIConfig:
    def __init__(self, id, description, intention, system_prompts, host, table_schema: TableSchema, examples):
        self.id = id
        self.description = description
        self.intention = intention
        self.system_prompts = system_prompts
        self.host = host
        self.fmt = "html"
        self.table_schema = table_schema
        self.actions = []
        self.examples = examples

    @classmethod
    def from_json_string(cls, json_data_obj):
        config = cls(
            json_data_obj["id"],
            json_data_obj["description"],
            json_data_obj["intention"],
            json_data_obj["system_prompts"],
            json_data_obj["host"],
            TableSchema.from_json_string(json_data_obj["table_schema"]),
            json_data_obj["examples"]
        )

        return config
