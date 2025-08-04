from json import dumps as json_dumps
from json import loads as json_loads
from logging import Logger, getLogger
from os import getenv

from ava.clients.sql.crud import select_skill_from_id
from ava.clients.sql.database import scoped_session
from ava.clients.sql.schema import Skill_Schema
from ava.handlers.AvaHandler import AvaHandler
from ava.handlers.skills.FileTranslationConfig import FileTranslationConfig
from ava.model.dscom import User
from langchain_openai import ChatOpenAI

logger: Logger = getLogger("ava_app")


class FileTranslationRunner(AvaHandler):

    def __init__(self,
                 llm: ChatOpenAI,
                 skill_id: str,
                 skill_name: str,
                 session_maker: scoped_session | None = None):
        super().__init__(llm, skill_id, skill_name, session_maker)
        self.config: FileTranslationConfig

    def handle(self, history_message_id, chat_uuid, expert_id, user: User,
               query, chat_context: list):
        result = []
        result.append({"type": "html_json"})
        result.append([{
            "tag": "file_translation_upload",
            "history_message_id": history_message_id
        }])
        return result

    def get_examples(self):
        return self.config.examples or super().get_examples()

    def get_intention(self):
        return self.config.intention or "Provide users with the ability to translate file."

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

    def load_skill_from_json(self) -> FileTranslationConfig:
        with open(f"./skills/{self.skill_name}.json", 'r',
                  encoding="UTF8") as file:
            json_string = json_loads(file.read())
            config: FileTranslationConfig = FileTranslationConfig.model_validate_json(
                json_string)
            return config

    def load_skill_from_db(self) -> FileTranslationConfig:
        assert self.session_maker, "session_maker is not set"
        with self.session_maker() as session:
            skill_row: Skill_Schema | None = select_skill_from_id(
                skill_id=self.skill_id, session=session)
        assert skill_row, f"Skill: '{self.skill_id}' not registered."
        config_json = skill_row.config_jsonb
        config: FileTranslationConfig = FileTranslationConfig.model_validate(
            config_json)
        return config
