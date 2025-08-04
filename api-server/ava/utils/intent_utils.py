import logging
import re
from os import getenv
from typing import Any, List

from ava.clients.sql.crud import select_expert_from_id
from ava.clients.sql.schema import Expert_Schema
from ava.model.dscom import User
from ava.prompts.Ava_prompts import AvaHandler, get_classification_prompts
from ava.utils import env_utils
from ava.utils.AzureOpenAIHandler import run_azure_openai_model
from ava.utils.ClaudeHandler import ClaudeHandler
from ava.utils.GPTHandler import GPTHandler
from ava.utils.model_utils import get_model_and_params
from ava.utils.TwccFFmHandler import run_ffm_model
from ava.utils.utils import LoggerUtils
from openai import OpenAI
from retrying import retry

logger: logging.Logger = logging.getLogger("ava_app")
token_logger: logging.Logger = logging.getLogger("token_counter")
client = OpenAI(
    api_key=env_utils.get_openai_key(
    ),  # this is also the default, it can be omitted
)


@retry(
    stop_max_attempt_number=3,
    wait_exponential_multiplier=1000,
    wait_exponential_max=2000,
)
def intent_classifier(chat_uuid, expert_id, user: User, user_contents,
                      handlers: List[AvaHandler],
                      session):  # -> Any | Literal['99']:
    classification_prompt = get_classification_prompts(handlers)
    prompt = classification_prompt.replace("$PROMPT", user_contents)
    logger.info("-------------\n" + prompt)
    GPT = GPTHandler(api_key=env_utils.get_openai_key())
    gpt_params = {
        "max_tokens": 100,
        "temperature": 0,
        "top_p": 0,
    }
    expert_data = {
        "expert_id": expert_id,
        "expert_model": "",
        "expert_model_type": "0"
    }
    row_expert: Expert_Schema | None = select_expert_from_id(
        expert_id=expert_id, session=session)
    assert row_expert
    model_dict: dict[str, Any] = get_model_and_params(
        expert_config_json=row_expert.config_jsonb, session=session)
    vendor = model_dict["intention"]["vendor"]
    model = model_dict["intention"]["model"]
    gpt_params.update(model_dict["intention"]["params"])
    llm_params_key: list[str] = [
        "max_tokens", "temperature", "frequency_penalty", "top_p"
    ]
    redundent_key: list[str] = []
    for key in gpt_params.keys():
        if key not in llm_params_key:
            redundent_key.append(key)
    for k in redundent_key:
        del gpt_params[k]
    if vendor == "azure" or vendor == "caf-azure":
        context = run_azure_openai_model(
            session=session,
            model_list_id=model_dict["intention"]["model_list_id"],
            chat_uuid=chat_uuid,
            user=user,
            user_input=user_contents,
            expert_data=expert_data,
            model_key=model,
            user_prompts=[prompt],
            model_params=gpt_params)
    elif vendor == "twcc":
        context = run_ffm_model(
            session=session,
            model_list_id=model_dict["intention"]["model_list_id"],
            chat_uuid=chat_uuid,
            user=user,
            user_input=user_contents,
            expert_data=expert_data,
            model_key=model,
            user_prompts=[prompt],
            model_params=gpt_params)
    elif vendor == "openai":
        context = GPT.run_gptModel(
            session,
            user,
            model_list_id=model_dict["intention"]["model_list_id"],
            messages=[{
                "role": "user",
                "content": prompt
            }],
            user_input=user_contents,
            expert_data=expert_data,
            chat_uuid=chat_uuid,
            classify="intent",
            model=model,
            params=gpt_params,
        )
    elif vendor == "anthropic":
        claude = ClaudeHandler()
        context = claude.run_model_not_stream(
            session=session,
            user=user,
            user_input=user_contents,
            expert_data=expert_data,
            chat_uuid=chat_uuid,
            model_list_id=model_dict["intention"]["model_list_id"],
            system_prompt="",
            message_content=prompt,
            model_params=gpt_params,
            model=model)
    elif vendor == "local":
        row_expert: Expert_Schema | None = select_expert_from_id(
            expert_id=expert_data["expert_id"], session=session)
        assert row_expert
        base_url = row_expert.config_jsonb["search"][row_expert.config_jsonb[
            "search"]["current_config"]].get("base_url")
        assert base_url, "local model base_url is not set"
        local_model_handler = GPTHandler(api_key="LOCAL", base_url=base_url)
        context = local_model_handler.run_gptModel(
            session,
            user,
            model_list_id=model_dict["intention"]["model_list_id"],
            messages=[{
                "role": "user",
                "content": prompt
            }],
            user_input=user_contents,
            expert_data=expert_data,
            chat_uuid=chat_uuid,
            classify="intent",
            model=model,
            params=gpt_params,
        )
    else:
        raise RuntimeError(f"未支援的模型 {model}")
    logger.debug(f"intent_classifier context: {context}")
    if "Category: " in context:  # type: ignore
        match = re.search(r'Category:\s(\d+)', context)  # type: ignore
        if match:
            category_value = match.group(1)
            return category_value
        else:
            return "99"
    else:
        return "99"
