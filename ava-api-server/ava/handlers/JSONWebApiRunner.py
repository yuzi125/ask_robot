
import json

import requests
from ava.handlers.ICSCWebAPI import ICSCWebAPI
from ava.handlers.skills.CommonActions import run_actions
from ava.handlers.skills.SkillConfigLoader import load_skill_config_from_db
from ava.handlers.skills.WebAPIConfig import WebAPIConfig
from ava.model.dscom import User
from ava.session.ICSCSession import ICSCSession
from ava.utils import env_utils
from ava.utils.Common import convert_data_with_format
from ava.utils.return_message_style import warn_msg
from ava.utils.TimeSemanticExpressor import *
from ava.utils.web_utils import *
from langchain_openai import ChatOpenAI

logger = logging.getLogger("ava_app")


class JSONWebApiRunner(ICSCWebAPI):

    def __init__(self, llm: ChatOpenAI, skill_id: str, skill_name: str):
        super().__init__(llm, skill_id, skill_name)
        self.skill_id = skill_id
        self.skill_name = skill_name
        self.config: WebAPIConfig = None

    def load_skill(self):
        if env_utils.get_key("WEB_API_LOAD_FILE"):
            self.load_skill_from_json()
        else:
            self.load_skill_from_db()
        # self.load_skill_from_db(skill_id)
        # self.load_skill_from_json(skill_class)

    def load_skill_from_json(self):
        with open(f"./skills/{self.skill_name}.json", 'r',
                  encoding="UTF8") as file:
            json_string = json.load(file)
            config = WebAPIConfig.from_json_string(json_string)
            self.config = config

    def load_skill_from_db(self):
        assert self.session_maker, "session_maker is not set"
        with self.session_maker() as _session:
            config_json = load_skill_config_from_db("JSONWebApiRunner",
                                                    self.skill_id, _session)
            config = WebAPIConfig.from_json_string(config_json)
            self.config = config

    def get_intention(self):
        return self.config.intention

    def get_system_prompt(self):
        return self.config.system_prompt

    def get_examples(self) -> list:
        return self.config.get_examples()

    def get_data_schema(self, query):
        self.load_skill()
        return self.config.schema.get_kor_definition()

    # save message and output for each action to message_record and output_record
    def post(self, chat_uuid, expert_data, user: User, schema_input_data,
             query):
        config = self.config

        assert len(schema_input_data) > 0, config.description + " 缺乏足夠的資訊"

        # Many=False
        input_data = schema_input_data[0]
        icsc_session = ICSCSession(user, requests.Session())
        input_data["_user"] = user
        input_data["_host"] = self.get_host_url()
        convert_data_with_format(input_data, config.schema)

        last_action = run_actions(icsc_session, input_data, config)
        resp_text = []
        if config.show_post:
            resp_text.append("\n".join(
                config.schema.get_post_report(input_data)))
        if last_action.output_report:
            resp_text.append(last_action.output_report)
        if config.show_msg:
            resp_text.append("#### " + warn_msg(last_action.message_record))
        return "\n".join(resp_text)
