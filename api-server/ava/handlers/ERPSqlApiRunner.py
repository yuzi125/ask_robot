import json

import requests
from ava.exceptions.AvaError import MyException
from ava.handlers.ICSCWebAPI import ICSCWebAPI
from ava.handlers.skills.CommonActions import Action, run_actions
from ava.handlers.skills.SkillConfigLoader import load_skill_config_from_db
from ava.handlers.skills.SqlAPIConfig import SqlAPIConfig
from ava.model.dscom import User
from ava.session.ICSCSession import ICSCSession
from ava.utils import env_utils
from ava.utils.data_utils import convert_csv_to_arrays
from ava.utils.GPTHandler import GPTHandler
from ava.utils.TimeSemanticExpressor import *
from ava.utils.web_utils import *
from langchain_openai import ChatOpenAI

logger = logging.getLogger("ava_app")

gpt_params = {
    "temperature": 0,
    "max_tokens": 1200,
    "frequency_penalty": 0,
    "top_p": 1.0,
    "stop": ["#", ";"]
}


def generate_sql_action():
    json_string = {
        "url": "{_host}/erp/ds/jsp/dsjjsql.jsp",
        "post_data": {
            "Type": "1",
            "RowSize": "0",
            "SqlStr": "{_sql}"
        },
        "saved_data": ["result=textarea#csvData"],
        "message": "span#msg"
    }
    return Action.from_json_string(json_string)


def to_sql_template(config_system_prompt):
    return f"""

{config_system_prompt}

# no explanation, output pure sql comm,
# fetch no more than 20 records,
# don't show any column which isn't mentioned in table schema given to you
# please output in markdown format and no explanation.
"""


query_db_template = """

    User Query: {query}

    Query result: {result}
  
"""


def to_tabular_data(user, query, expert_data, chat_uuid):
    messages = [{
        "role":
        "system",
        "content":
        "you are a  data analyst and good at output data in tabular format"
    }, {
        "role":
        "user",
        "content":
        "Output the tabular data in Traditional Chinese in markdown format with semantic heading "
        "understood from user query. No explanation. number of columns of heading should be equal to the number of data columns.\n\n "
        "Query Result:\n\n" + query
    }]
    gpt_handler = GPTHandler(api_key=env_utils.get_openai_key(),
                             params=gpt_params)
    # model="gpt-4o"
    content = gpt_handler.run_gptModel(user, messages, query, expert_data,
                                       chat_uuid)
    content = re.sub(r"```markdown", "", content)
    return re.sub(r"`*$", "", content)


def convert_csv_to_echart_options(query, output_data):
    data_arrays = convert_csv_to_arrays(output_data)
    label = [item[0] for item in data_arrays]
    values = [item[1] for item in data_arrays]

    logger.debug(f"data arrays from csv : {data_arrays}")
    title = re.sub(r"^(顯示|列出|統計|給我|展示)", "", query)
    options = {
        "title": {
            "text": None,
            "left": 'center',
            "padding": [0, 0, 0, 0]
        },
        "tooltip": {
            "trigger": "axis",
            "axisPointer": {
                "type": "shadow"
            }
        },
        "grid": {
            "top": "0%",
            "left": "3%",
            "right": "4%",
            "bottom": "3%",
            "containLabel": True
        },
        "xAxis": {
            "type": "value",
            "boundaryGap": [0, 0.01]
        },
        "yAxis": {
            "type": "category",
            "data": label,
            "axisLabel": {
                "margin": 0
            }
        },
        "series": [{
            "type": "bar",
            "data": values
        }]
    }
    return {
        "type": "charts",
        "data": {
            "title": title,
            "option": options
        },
    }


def to_chart_options(user, query, expert_data, chat_uuid):
    messages = [{
        "role":
        "system",
        "content":
        "you are a chinese echart experts and good at output echarts options by input data"
    }, {
        "role":
        "user",
        "content":
        "Output the echart options using the Query Result. Just output json in string format, no explanation. \n "
        "Query Result:\n\n" + query
    }]
    logger.info(f"to chart option: {query}")
    gpt_handler = GPTHandler(api_key=env_utils.get_openai_key(),
                             params=gpt_params)
    # model="gpt-4o"
    content = gpt_handler.run_gptModel(user,
                                       messages,
                                       query,
                                       expert_data,
                                       chat_uuid,
                                       model="gpt-4o")
    content = re.sub(r"```json", "", content)
    content = re.sub(r"`*$", "", content)
    logger.info(f"echart.options: {content}")
    # content = {
    #     "title": {
    #         "text": "S2 各單位人數"
    #     },
    #     "tooltip": {
    #         "trigger": "axis",
    #         "axisPointer": {
    #             "type": "shadow"
    #         }
    #     },
    #     "grid": {
    #         "left": "3%",
    #         "right": "4%",
    #         "bottom": "3%",
    #         "containLabel": True
    #     },
    #     "xAxis": {
    #         "type": "value",
    #         "boundaryGap": [0, 0.01]
    #     },
    #     "yAxis": {
    #         "type": "category",
    #         "data": ["S20", "S21", "S22", "S23", "S24", "S25"]
    #     },
    #     "series": [
    #         {
    #             "type": "bar",
    #             "data": [3, 20, 23, 7, 1, 5]
    #         }
    #     ]
    # }

    return {
        "type": "charts",
        "data": {
            "title": "統計圖",
            "option": json.loads(content),
        },
    }


class ERPSqlApiRunner(ICSCWebAPI):

    def __init__(self, llm: ChatOpenAI, skill_id: str, skill_name: str):
        super().__init__(llm, skill_id, skill_name)
        self.skill_id = skill_id
        self.skill_name = skill_name
        self.config: SqlAPIConfig = None

    def load_skill(self):
        if env_utils.get_key("SQL_API_LOAD_FILE"):
            self.load_skill_from_json()
        else:
            self.load_skill_from_db()

    def load_skill_from_json(self):
        with open(f"./skills/{self.skill_name}.json", 'r',
                  encoding="UTF8") as file:
            json_string = json.load(file)
            config = SqlAPIConfig.from_json_string(json_string)
            self.config = config

    #
    def load_skill_from_db(self):
        assert self.session_maker, "session_maker is not set"
        with self.session_maker() as _session:
            config_json = load_skill_config_from_db("ERPSqlApiRunner",
                                                    self.skill_id, _session)
            config = SqlAPIConfig.from_json_string(config_json)
            self.config = config

    def get_intention(self):
        return self.config.intention

    def get_system_prompt(self):
        prompt = "\n# output result in markdown format always."
        return "\n".join(self.config.system_prompts) + prompt

    def get_examples(self) -> list:
        return self.config.examples

    def get_data_schema(self, query):
        return None

    def post(self, chat_uuid, expert_data, user: User, schema_input_data,
             query):
        self.load_skill()
        config = self.config
        if not config.actions:
            config.actions = [generate_sql_action()]

        # Many=False
        input_data: dict = {}
        expected_sql = self.to_sql(chat_uuid, expert_data, user, query,
                                   input_data)
        if "select " in expected_sql.lower():
            input_data["_sql"] = expected_sql
        else:
            raise MyException(expected_sql)

        icsc_session = ICSCSession(user, requests.Session())
        input_data["_user"] = user
        input_data["_host"] = self.get_host_url()
        last_action = run_actions(icsc_session, input_data, config.actions)
        result = input_data["result"]
        output_data = query_db_template.format(query=query,
                                               result=result.replace(
                                                   "\n",
                                                   "<br>").replace("\r", ""))
        logger.debug("query result:" + output_data)
        if "圖" in query:
            return convert_csv_to_echart_options(query, result)
            # return to_chart_options(user, output_data, expert_data, chat_uuid)
        else:
            return to_tabular_data(user, output_data, expert_data, chat_uuid)

    def to_sql(self, chat_uuid, expert_data, user: User, query, input_data):
        prompts = [
            table.to_prompt(query) for table in self.config.table_schema.tables
        ]
        semantic_dates = ["今日", "今天"]
        variables: dict = {}
        for expr in semantic_dates:
            variables[expr] = text_to_date(expr, expr)
        content = "\n".join(prompts).format(**variables)

        sys_prompt = to_sql_template("\n".join(self.config.system_prompts))

        messages = [{
            "role": "system",
            "content": sys_prompt
        }, {
            "role": "user",
            "content": content
        }]
        logger.debug("sys_prompt:" + content)
        gpt_handler = GPTHandler(api_key=env_utils.get_openai_key(),
                                 params=gpt_params)
        # model="gpt-4o"
        content = gpt_handler.run_gptModel(user,
                                           messages,
                                           query,
                                           expert_data,
                                           chat_uuid,
                                           model="gpt-4o")
        if re.search(
                r"(update|delete|insert|drop|alter|truncate|create|rename|add|modify)\s+",
                content, re.IGNORECASE) or not re.search(
                    r"(select)\s+", content, re.IGNORECASE):
            raise MyException("不好意思，僅提供查詢服務")

        sql = re.sub(r"^['`]*\w+\sSELECT ", "SELECT ", content)
        # remove the column alias
        sql = re.sub(r'AS\s+\'[\w\s]+\'', '', sql)
        sql = re.sub(r"`*$", '', sql)

        for key, value in self.config.table_schema.sql_replacer.items():
            sql = sql.replace(key, value)
        logger.info(query + " ===> ")
        logger.info(f"sql:{sql}")
        return sql

    def is_streaming(self):
        return False

    def return_directly(self):
        return True
