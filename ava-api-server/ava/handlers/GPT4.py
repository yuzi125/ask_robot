import logging
import re
from datetime import datetime
from json import loads as json_loads
import pytz

from ava.clients.sql.crud import select_expert_from_id
from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.utils.model_utils import get_model_and_params
from langchain_openai import ChatOpenAI

doc_logger = logging.getLogger("doc")
logger = logging.getLogger("ava_app")

TAIWAN_TZ = pytz.timezone('Asia/Taipei')


def append_user_message(messages, msg):
    messages.append({"role": "user", "content": msg})
    return messages


def get_roc_date(dt: datetime) -> str:
    year = dt.year - 1911
    return f'民國{year}年{dt.month}月{dt.day}日'


def get_roc_datetime(dt: datetime) -> str:
    return f'{get_roc_date(dt)} {dt.strftime("%H:%M:%S")}'


def replace_datetime_placeholders(text: str) -> str:
    now = datetime.now(TAIWAN_TZ)

    replacements = {
        '{{current_date}}': now.strftime('%Y-%m-%d'),
        '{{current_time}}': now.strftime('%H:%M:%S'),
        '{{current_datetime}}': now.strftime('%Y-%m-%d %H:%M:%S'),
        '{{current_date_roc}}': get_roc_date(now),
        '{{current_datetime_roc}}': get_roc_datetime(now),
    }

    pattern = re.compile(
        r'{{(current_date|current_time|current_datetime|current_date_roc|current_datetime_roc)}}'
    )
    return pattern.sub(lambda m: replacements.get(m.group(0), m.group(0)),
                       text)


class GPT4(AvaHandler):

    def get_intention(self):
        intention = "The interaction with GPT-4 through this platform is akin to conversing with an intelligent chatbot."
        return intention

    def handle(self, chat_uuid, expert_id, user: User, incoming_msg,
               chat_context: list):
        self.auth_user_login_type(user)
        self.load_expert_model_config(expert_id=expert_id)
        system_prompt = self.model_config["search"]["params"].get(
            "system_prompt") or ""
        system_prompt = replace_datetime_placeholders(system_prompt)

        incoming_msg = [system_prompt, incoming_msg]
        # messages = [
        #     {
        #         "role": "system",
        #         "content": "please always answer in Traditional Chinese, no matter what language does the user input.",
        #     }
        # ]

        # messages = append_user_message(messages, incoming_msg)

        return incoming_msg

    def keep_context(self):
        # 暫時先不用上下文 1.5版以後更新
        return False

    def return_directly(self):
        return False

    def set_llm_config(self):
        return True

    def is_streaming(self):
        return True

    def get_examples(self) -> list:
        return [
            "幫我修正",
            "幫我",
        ]

    def get_llm_model_params(self):
        try:
            if (hasattr(self, "model_config")):
                model_params = self.model_config.get("search", {}).get("params") or {}
            else:
                model_params = {}
            return {
                "max_tokens": model_params.get("max_tokens", 3000),
                "temperature": model_params.get("temperature", 1),
                "frequency_penalty": model_params.get("frequency_penalty", 0),
                "top_p": model_params.get("top_p", 1.0),
            }
        except Exception as ex:
            logger.error(f"get_llm_model_params error, err: {ex}")
            return {
                "max_tokens": 3000,
                "temperature": 1,
                "frequency_penalty": 0,
                "top_p": 1.0,
            }

    def construct_instructions(self, messages: list):
        messages.clear()

        system_message = self.get_system_prompt()
        content = system_message.format()

        messages.append({"role": "system", "content": content})

    def get_system_prompt(self):
        return " "

    def load_expert_model_config(self, expert_id=None):
        if not expert_id:
            assert expert_id, "expert_id是空的"
        if not self.session_maker:
            raise ValueError("session_maker is not set")
        with self.session_maker() as session:
            row_expert = select_expert_from_id(expert_id=expert_id,
                                               session=session)
            assert row_expert
            if isinstance(row_expert.config_jsonb, dict):
                expert_config_json: dict = row_expert.config_jsonb
            elif isinstance(row_expert.config_jsonb, str):
                expert_config_json: dict = json_loads(row_expert.config_jsonb)
            self.expert_config = expert_config_json
            self.model_config = get_model_and_params(
                expert_config_json=self.expert_config, session=session)
