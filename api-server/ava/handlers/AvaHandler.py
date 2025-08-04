from abc import ABC, abstractmethod
from typing import Any, Sequence

from ava.clients.sql.crud import (select_login_type_from_ids,
                                  select_skill_from_id)
from ava.clients.sql.database import scoped_session
from ava.clients.sql.schema import LoginType_Schema, Skill_Schema
from ava.handlers.skills.WebAPIConfig import WebAPIConfig
from ava.model.dscom import User
from ava.utils import env_utils
from langchain_openai import ChatOpenAI


class LoginTypeNotSatisfiedException(Exception):

    def __init__(self,
                 missing_types: list[str],
                 message="Login type not satisfied"):
        self.missing_types: list[str] = missing_types
        self.message: str = f"{message}: Missing types {missing_types}"
        super().__init__(self.message)


class AvaHandler(ABC):

    def __str__(self):
        return self.__class__.__name__

    def __init__(self,
                 llm: ChatOpenAI | None,
                 skill_id: str,
                 skill_name: str,
                 session_maker: scoped_session | None = None):
        self.llm: ChatOpenAI | None = llm
        self.skill_id: str = skill_id
        self.skill_name: str = skill_name
        self.session_maker = session_maker

    def set_session_maker(self, session_maker: scoped_session):
        self.session_maker = session_maker

    @abstractmethod
    def handle(self, chat_uuid, expert_id, user: User, incoming_msg,
               chat_context: list):
        pass

    def direct_handle_with_data(self,
                                user: User,
                                post_params: dict[str, Any],
                                cookies: dict[str, Any] | None = None) -> Any:
        pass

    def auth_user_login_type(self, user_info: User) -> None:
        assert self.session_maker, "session_maker is not set"
        with self.session_maker() as session:
            skill: Skill_Schema | None = select_skill_from_id(
                skill_id=self.skill_id, session=session)
            assert skill
            required_login_type: list[int] = skill.required_login_type
            if required_login_type:
                login_type_rows: Sequence[
                    LoginType_Schema] = select_login_type_from_ids(
                        login_type_ids=required_login_type, session=session)
                not_satisfied_types: list[str] = [
                    login_type.type_name for login_type in login_type_rows
                ]
                if not hasattr(user_info, "login_info"):
                    # 遊客一律走這
                    raise LoginTypeNotSatisfiedException(not_satisfied_types)
                else:
                    for login_type in login_type_rows:
                        if login_type.type_value in user_info.login_info:
                            not_satisfied_types.remove(login_type.type_name)
                    if not_satisfied_types:
                        raise LoginTypeNotSatisfiedException(
                            not_satisfied_types)

    def keep_context(self):
        return False

    def return_directly(self):
        return False

    def set_llm_config(self):
        return False

    def get_system_prompt(self):
        return " "

    def is_streaming(self):
        return False

    @abstractmethod
    def get_intention(self):
        pass

    def get_examples(self) -> list:
        return []

    def get_expert_model_type(self) -> str:
        return "2"

    def construct_instructions(self, messages: list):
        messages.clear()
        system_message = (self.get_system_prompt() + """
        please always answer in Traditional Chinese, no matter what language does the user input.
        """)
        content = system_message.format()

        messages.append({"role": "system", "content": content})

    def get_intention_type(self):
        return "E"  # web api

    def set_config(self, config: WebAPIConfig):
        pass

    def get_llm_model(self):
        return "gpt-4o"

    def get_llm_model_list_id(self) -> int:
        return -1

    def get_llm_model_vendor(self):
        return "unknown"

    def get_dataset_folder_name(self):
        pass

    def get_llm_model_params(self):
        return {
            "max_tokens": 1200,
            "temperature": 1,
            "frequency_penalty": 0,
            "top_p": 1.0,
        }

    def stream_after(self, no_answer, context, history_message_id, llm_model,
                     model_params, model_prompt):
        pass

    def data_source(self):
        return ""

    def extra_append_after_answer(self):
        return ""

    def extra_append_component_after_all(self):
        return ""

    def append_form_binding(self):
        return ""

    def get_source_chunk(self):
        return ""

    def get_extra_chunk(self):
        return ""
