from json import dumps as json_dumps
from json import loads as json_loads
from logging import Logger, getLogger
from os import getenv
from typing import Sequence

from ava.clients.sql.crud import (select_all_form_config,
                                  select_form_config_from_name,
                                  select_skill_from_id)
from ava.clients.sql.database import scoped_session
from ava.clients.sql.schema import Skill_Schema
from ava.handlers.AvaHandler import AvaHandler
from ava.handlers.skills.FormSkillConfig import FormSkillConfig
from ava.model.dscom import User
from ava.utils.TunnelFormAgent import TunnelFormAgent
from langchain_openai import ChatOpenAI

from ..clients.sql.schema import FormConfiguration_Schema

logger: Logger = getLogger("ava_app")


class FormRunner(AvaHandler):

    def __init__(self, llm: ChatOpenAI, skill_id: str, skill_name: str,
                 session_maker: scoped_session | None = None):
        super().__init__(llm, skill_id, skill_name, session_maker)
        self.config: FormSkillConfig

    def handle(self, chat_uuid, expert_id, user: User, incoming_msg,
               chat_context: list):
        self.auth_user_login_type(user)
        self.load_config()
        assert self.session_maker, "session_maker is not set"
        agent = TunnelFormAgent(incoming_msg, user, expert_id, chat_uuid,
                                self.session_maker)
        agent.get_form_info()
        judge_form_name: str = agent.target_config["name"]
        result: list = [{"type": "html_json"}]
        html_json: list[dict] = []
        if judge_form_name:
            html_json.append({
                "tag": "html",
                "text": f"根據您的訊息，為您推薦填寫 {judge_form_name}",
                "after_new_line": True
            })
            html_json.append({
                "tag": "button",
                "text": f"填寫 {judge_form_name}",
                "action": "tunnelStart",
                "args": [judge_form_name]
            })
            html_json.append({
                "tag": "html",
                "text": "或者您可以由下列表單中選擇合適的表單填寫 :",
                "after_new_line": True
            })
            self.config.association_forms.remove(judge_form_name)
        else:
            html_json.append({
                "tag": "html",
                "text": "根據您的訊息，我為您找尋到下列相關表單 :",
                "after_new_line": True
            })
        assert self.session_maker, "session_maker is not set"
        for form_name in self.config.association_forms:
            with self.session_maker() as session:
                form_config: FormConfiguration_Schema | None = select_form_config_from_name(
                    form_name=form_name, session=session)
            assert form_config, f"Form: '{form_name}' not registered."
            html_json.append({
                "tag": "button",
                "text": f"填寫 {form_config.form_name}",
                "action": "tunnelStart",
                "args": [form_config.form_name]
            })
        result.append(html_json)
        return result

    def get_examples(self):
        return self.config.examples or super().get_examples()

    def get_intention(self):
        return self.config.intention or "Provide users with the ability to call up a request form when needed."

    def load_skill(self):
        self.load_config()

    def return_directly(self):
        return True

    def load_config(self) -> None:
        web_api_load_file: str | None = getenv("WEB_API_LOAD_FILE")
        if web_api_load_file and web_api_load_file.lower() == "true":
            logger.info(f"Loading skill from file: {self.skill_id}")
            self.config = self.load_skill_from_json()
        else:
            logger.info(f"Loading skill from db: {self.skill_id}")
            self.config = self.load_skill_from_db()

    def load_skill_from_json(self) -> FormSkillConfig:
        with open(f"./skills/{self.skill_name}.json", 'r',
                  encoding="UTF8") as file:
            json_string = json_loads(file.read())
            config: FormSkillConfig = FormSkillConfig.model_validate_json(
                json_string)
            return config

    def load_skill_from_db(self) -> FormSkillConfig:
        assert self.session_maker, "session_maker is not set"
        with self.session_maker() as session:
            skill_row: Skill_Schema | None = select_skill_from_id(
                skill_id=self.skill_id, session=session)
        assert skill_row, f"Skill: '{self.skill_id}' not registered."
        config_json = skill_row.config_jsonb
        config: FormSkillConfig = FormSkillConfig.model_validate(config_json)
        return config
