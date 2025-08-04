import logging
from os import getenv
from typing import Any, Iterator

from ava.model.dscom import User
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from ava.utils.return_message_style import error_msg
from ava.utils.utils import LoggerUtils
# from ffm.langchain.callbacks import get_ffm_callback
# from ffm.langchain.language_models.ffm import FfmChatOpenAI
from kor.extraction import create_extraction_chain
from kor.nodes import Object as KorSchema
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.messages.base import BaseMessage, BaseMessageChunk

FFM_LLAMA3_70B_CHAT_API_URL = getenv("FFM_LLAMA3_70B_CHAT_API_URL")
FFM_LLAMA3_70B_CHAT_API_KEY = getenv("FFM_LLAMA3_70B_CHAT_API_KEY")
FFM_LLAMA3_70B_CHAT_MODEL = getenv("FFM_LLAMA3_70B_CHAT_MODEL")
assert FFM_LLAMA3_70B_CHAT_API_URL
assert FFM_LLAMA3_70B_CHAT_API_KEY
assert FFM_LLAMA3_70B_CHAT_MODEL

logger: logging.Logger = logging.getLogger("ava_app")


def run_ffm_model_stream(*,
                         session,
                         chat_uuid: str,
                         user: User,
                         user_input: str,
                         expert_data: dict[str, Any],
                         model_key: str,
                         system_prompt: str = "",
                         model_list_id: int,
                         user_prompts: list[str],
                         model_params: dict,
                         history_message_id: str | None = None):
    raise NotImplementedError("FFM model is not implemented")
    try:
        model: FfmChatOpenAI = FfmChatOpenAI(
            ffm_endpoint=FFM_LLAMA3_70B_CHAT_API_URL,
            ffm_api_key=FFM_LLAMA3_70B_CHAT_API_KEY,  #type: ignore
            ffm_deployment=FFM_LLAMA3_70B_CHAT_MODEL,  # or other model name
            streaming=True)
        user_messages: list[BaseMessage] = [
            HumanMessage(content=prompt) for prompt in user_prompts
        ]
        input_messages: list[BaseMessage] = user_messages
        if system_prompt:
            system_message = SystemMessage(content=system_prompt)
            input_messages.insert(0, system_message)
        response: Iterator[BaseMessageChunk] = model.stream(
            input_messages, **model_params)

        full_body: list = []
        for m in response:
            if "finish_reason" in m.response_metadata:
                if m.response_metadata["finish_reason"] == "length":
                    raise Exception(
                        error_msg("回應長度超過長度限制，無法繼續，請具體描述您的問題，讓ava更好的為您服務。"))
            if m.content:
                full_body.append(m.content)
                yield m.content
        entry = ModelTokenLogEntry(
            model_list_id=model_list_id,
            users_id=user.uid,
            model=model_key,
            user_input=user_input,
            classify="streaming",
            expert_id=expert_data["expert_id"],
            expert_model=expert_data["expert_model"],
            expert_model_type=expert_data["expert_model_type"],
            chat_uuid=chat_uuid,
            price_currency="TWD",
            history_message_id=history_message_id)
        prompt_text: str = system_prompt + " ".join(user_prompts)
        LoggerUtils.token_from_text(prompt_text, "".join(full_body), entry,
                                    session)
    except Exception as e:
        logger.error(f"Azure OpenAI Stream Error: {e}")
        yield error_msg("意外錯誤，請稍後再試，若問題持續請聯繫管理員。")


def run_ffm_model(*,
                  session,
                  chat_uuid: str,
                  user: User,
                  user_input: str,
                  expert_data: dict[str, Any],
                  model_key: str,
                  system_prompt: str = "",
                  model_list_id: int,
                  user_prompts: list[str],
                  model_params: dict):
    raise NotImplementedError("FFM model is not implemented")
    try:
        need_fix_params = ["top_p", "temperature", "frequency_penalty"]
        for param in need_fix_params:
            if param in model_params:
                if model_params[param] <= 0.0:
                    model_params[param] = 0.1
        model: FfmChatOpenAI = FfmChatOpenAI(
            ffm_endpoint=FFM_LLAMA3_70B_CHAT_API_URL,
            ffm_api_key=FFM_LLAMA3_70B_CHAT_API_KEY,  #type: ignore
            ffm_deployment=FFM_LLAMA3_70B_CHAT_MODEL,  # or other model name 
            streaming=False)
        user_messages: list[BaseMessage] = [
            HumanMessage(content=prompt) for prompt in user_prompts
        ]
        input_messages: list[BaseMessage] = user_messages
        if system_prompt:
            system_message = SystemMessage(content=system_prompt)
            input_messages.insert(0, system_message)
        response: BaseMessage = model.invoke(input_messages, **model_params)
        entry = ModelTokenLogEntry(
            model_list_id=model_list_id,
            users_id=user.uid,
            model=model_key,
            classify="non-streaming",
            prompt_token=response.response_metadata["token_usage"],
            completion_token=0,
            user_input=user_input,
            expert_id=expert_data["expert_id"],
            expert_model=expert_data["expert_model"],
            expert_model_type=expert_data["expert_model_type"],
            chat_uuid=chat_uuid,
            price_currency="TWD")
        LoggerUtils.log_token_info(entry, session)
        finish_reason: str = response.response_metadata["finish_reason"]
        if finish_reason == "length":
            raise Exception(error_msg("回應長度超過長度限制，請具體描述您的問題，讓ava更好的為您服務。"))
        elif finish_reason == "stop_sequence":
            return response.content
    except Exception as e:
        raise e


def run_ffm_langchain(*, session, chat_uuid: str, user: User, model_key: str,
                      model_list_id: int, expert_data: dict[str, Any],
                      schema: KorSchema, query: str):
    raise NotImplementedError("FFM model is not implemented")
    with get_ffm_callback() as cb:
        model: FfmChatOpenAI = FfmChatOpenAI(
            ffm_endpoint=FFM_LLAMA3_70B_CHAT_API_URL,
            ffm_api_key=FFM_LLAMA3_70B_CHAT_API_KEY,  #type: ignore
            ffm_deployment=FFM_LLAMA3_70B_CHAT_MODEL,  # or other model name
            streaming=False)
        chain = create_extraction_chain(model, schema)

        data = chain.run(query)["data"]
        entry = ModelTokenLogEntry(
            model_list_id=model_list_id,
            users_id=user.uid,
            model=model_key,
            prompt_token=cb.prompt_tokens,
            completion_token=cb.completion_tokens,
            user_input=query,
            expert_id=expert_data["expert_id"],
            expert_model=expert_data["expert_model"],
            expert_model_type=expert_data["expert_model_type"],
            chat_uuid=chat_uuid,
            price_currency="TWD")

        LoggerUtils.token_langchain(entry, session)
    return data
