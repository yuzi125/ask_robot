from __future__ import annotations

import logging
import threading
import os
import base64
import json
import re
from io import BytesIO
from PIL import Image
from os import getenv
from typing import Any, Iterator, Union, Generator

from ava.model.dscom import User
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from ava.clients.sql.crud import select_settings_from_key, select_model_list_from_id
from ava.clients.sql.schema import Settings_Schema, ModelList_Schema
from ava.utils.return_message_style import error_msg
from ava.utils.utils import LoggerUtils
from ava.utils.TokenLogger import TokenLogger, ModelTokenLogEntryBuilder
from ava.utils.BaseDocumentsAgent import BaseDocumentsAgent
from kor.extraction import create_extraction_chain
from kor.nodes import Object as KorSchema
from langchain_community.callbacks import get_openai_callback
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.messages.base import BaseMessage, BaseMessageChunk
from langchain_openai import AzureChatOpenAI
from openai import AzureOpenAI
from openai.types.chat.chat_completion_system_message_param import ChatCompletionSystemMessageParam
from openai.types.chat.chat_completion_user_message_param import ChatCompletionUserMessageParam
from openai.types.chat.chat_completion_content_part_text_param import ChatCompletionContentPartTextParam
from openai.types.chat.chat_completion_content_part_image_param import ChatCompletionContentPartImageParam, ImageURL
import fitz


class AzureGptModelStore:
    _instance: AzureGptModelStore | None = None
    models: dict[str, AzureChatOpenAI] | None = None
    _lock = threading.Lock()

    def __new__(cls) -> AzureGptModelStore:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(AzureGptModelStore, cls).__new__(cls)
                    try:
                        cls.models = {
                            "azure-gpt-4o":
                            AzureChatOpenAI(azure_deployment="gpt-4o",
                                            model="gpt-4o"),
                            "azure-gpt-4o-mini":
                            AzureChatOpenAI(azure_deployment="gpt-4o-mini",
                                            model="gpt-4o-mini"),
                            "azure-gpt-4-turbo":
                            AzureChatOpenAI(azure_deployment="gpt-4-turbo",
                                            model="gpt-4"),
                            "azure-gpt-4-32k":
                            AzureChatOpenAI(azure_deployment="gpt-4-32k",
                                            model="gpt-4-32k"),
                            "azure-gpt-35-turbo-16k":
                            AzureChatOpenAI(
                                azure_deployment="gpt-35-turbo-16k",
                                model="gpt-35-turbo-16k"),
                            "azure-gpt-35-turbo":
                            AzureChatOpenAI(azure_deployment="gpt-35-turbo",
                                            model="gpt-35-turbo"),
                           "azure-gpt-4.1":
                            AzureChatOpenAI(azure_deployment="gpt-4.1",
                                            model="gpt-4.1"),
                            "azure-gpt-4.1-mini":
                            AzureChatOpenAI(azure_deployment="gpt-4.1-mini",
                                            model="gpt-4.1-mini"),
                            "azure-gpt-4.1-nano":
                            AzureChatOpenAI(azure_deployment="gpt-4.1-nano",
                                            model="gpt-4.1-nano"),
                            "caf-azure-gpt-4o":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),
                                openai_api_key=getenv(  # type: ignore
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-4o-1120",
                                model="gpt-4o"),
                            "caf-azure-gpt-4-turbo":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),
                                openai_api_key=getenv(  # type: ignore
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-4-turbo",
                                model="gpt-4"),
                            "caf-azure-gpt-4-32k":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),
                                openai_api_key=getenv(  # type: ignore
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-4-32k",
                                model="gpt-4-32k"),
                            "caf-azure-gpt-35-turbo-16k":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),
                                openai_api_key=getenv(  # type: ignore
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-35-turbo-16k",
                                model="gpt-35-turbo-16k"),
                            "caf-azure-gpt-35-turbo":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),
                                openai_api_key=getenv(  # type: ignore
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-35-turbo",
                                model="gpt-35-turbo"),
                            "caf-azure-gpt-4o-mini":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),
                                openai_api_key=getenv(  # type: ignore
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-4o-mini",
                                model="gpt-4o-mini"),
                            "caf-azure-gpt-4.1":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),
                                openai_api_key=getenv(  # type: ignore
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-4.1",
                                model="gpt-4.1"),
                            "caf-azure-gpt-4.1-mini":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),   
                                openai_api_key=getenv(  # type: ignore      
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-4.1-mini",
                                model="gpt-4.1-mini"),
                            "caf-azure-gpt-4.1-nano":
                            AzureChatOpenAI(
                                azure_endpoint=getenv(
                                    "CAF_AZURE_OPENAI_ENDPOINT"),
                                openai_api_key=getenv(  # type: ignore
                                    "CAF_AZURE_OPENAI_API_KEY"),
                                azure_deployment="gpt-4.1-nano",
                                model="gpt-4.1-nano"),

                        }
                    except Exception as e:
                        logging.error(f"AzureChatOpenAI 初始化失敗: {e}")
                        cls.models = None
        return cls._instance


logger: logging.Logger = logging.getLogger("ava_app")


def run_azure_openai_model_stream(*,
                                  session,
                                  chat_uuid: str,
                                  user: User,
                                  user_input: str,
                                  expert_data: dict[str, Any],
                                  model_key: str,
                                  system_prompt: str = "",
                                  user_prompts: list[str],
                                  model_list_id: int,
                                  model_params: dict,
                                  history_message_id: str | None = None) -> Any:
    try:
        model_dict: dict[str,
                         AzureChatOpenAI] | None = AzureGptModelStore().models
        if not model_dict:
            raise Exception(error_msg("無法獲取 llm 模型"))
        if model_key not in model_dict:
            raise Exception(error_msg("嘗試使用不存在的模型"))
        model: AzureChatOpenAI = model_dict[model_key]
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
            history_message_id=history_message_id
        )
        prompt_text: str = system_prompt + " ".join(user_prompts)
        LoggerUtils.token_from_text(prompt_text, "".join(full_body), entry,
                                    session)
    except Exception as e:
        logger.error(f"Azure OpenAI Stream Error: {e}")
        yield error_msg("意外錯誤，請稍後再試，若問題持續請聯繫管理員。")


def run_azure_openai_model(*,
                           session,
                           chat_uuid: str,
                           user: User,
                           user_input: str,
                           expert_data: dict[str, Any],
                           model_key: str,
                           system_prompt: str = "",
                           user_prompts: list[str],
                           model_list_id: int,
                           model_params: dict) -> Any:
    try:
        model_dict: dict[str,
                         AzureChatOpenAI] | None = AzureGptModelStore().models
        if not model_dict:
            raise Exception(error_msg("無法獲取 llm 模型"))
        if model_key not in model_dict:
            raise Exception(error_msg("嘗試使用不存在的模型"))
        model: AzureChatOpenAI = model_dict[model_key]
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
            prompt_token=response.response_metadata["token_usage"]
            ["prompt_tokens"],
            completion_token=response.response_metadata["token_usage"]
            ["completion_tokens"],
            user_input=user_input,
            expert_id=expert_data["expert_id"],
            expert_model=expert_data["expert_model"],
            expert_model_type=expert_data["expert_model_type"],
            chat_uuid=chat_uuid,
        )
        LoggerUtils.log_token_info(entry, session)
        finish_reason: str = response.response_metadata["finish_reason"]
        if finish_reason == "length":
            raise Exception(error_msg("回應長度超過長度限制，請具體描述您的問題，讓ava更好的為您服務。"))
        elif finish_reason == "stop":
            return response.content
    except Exception as e:
        raise e


def run_azure_gpt_langChain(*, session, chat_uuid: str, user: User,
                            model_key: str, expert_data: dict[str, Any],
                            schema: KorSchema, query: str, model_list_id: int):
    with get_openai_callback() as cb:
        model_dict: dict[str,
                         AzureChatOpenAI] | None = AzureGptModelStore().models
        if not model_dict:
            raise Exception(error_msg("無法獲取 llm 模型"))
        if model_key not in model_dict:
            raise Exception(error_msg("嘗試使用不存在的模型"))
        model: AzureChatOpenAI = model_dict[model_key]
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
        )

        LoggerUtils.token_langchain(entry, session)
    return data

def run_azure_upload_files_not_stream(*,
                           model_list_id: int,
                           model_name: str,
                           user: User,
                           user_input: str,
                           message_data,
                           chat_uuid: str,
                           session,
                           system_prompt: str = "沒特別說明的話，請用繁體中文回答",  
                           model_params: dict) -> Any:
    try:
        # model = get_azure_openai_instance(model_list_id)
        model = get_azure_openai_instance_optimization(model_list_id, session)

        user_prompts: list[Union[ChatCompletionContentPartTextParam, ChatCompletionContentPartImageParam]] = [
            ChatCompletionContentPartTextParam(text=user_input, type="text")
        ]
        for file_storage in message_data:
            # 從 FileStorage 對象獲取文件內容
            if hasattr(file_storage, 'read'):
                file_content = file_storage.read()
                # 創建臨時文件
                ava_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                temp_path = os.path.join(ava_dir, "uploads", file_storage.filename)
                os.makedirs(os.path.dirname(temp_path), exist_ok=True)
                with open(temp_path, 'wb') as f:
                    f.write(file_content)
                
                # 檢查文件類型，如果是 PDF，則使用 PyMuPDF 轉換為圖片
                if file_storage.filename.lower().endswith('.pdf'):
                    with fitz.open(temp_path) as doc:
                        for i in range(len(doc)):
                            page = doc.load_page(i)
                            pix = page.get_pixmap() # type: ignore
                            image_base64 = base64.b64encode(pix.tobytes()).decode("utf-8")                           
                            user_prompts.append(
                                ChatCompletionContentPartImageParam(
                                    image_url=ImageURL(url=f"data:image/jpeg;base64,{image_base64}", detail="auto"),
                                    type="image_url"
                                )
                            )
                else:
                    # 如果不是 PDF，假設是圖片，直接進行 base64 編碼
                    image_base64 = base64.b64encode(file_content).decode("utf-8")
                    user_prompts.append(
                        ChatCompletionContentPartImageParam(
                            image_url=ImageURL(url=f"data:image/jpeg;base64,{image_base64}", detail="auto"),
                            type="image_url"
                        )
                    )

                # 清理臨時文件
                os.remove(temp_path)
            else:
                logger.error(f"Invalid file object: {file_storage}")
        user_messages = [ChatCompletionUserMessageParam(role="user", content=user_prompts)]
        input_messages = user_messages
        if system_prompt:
            system_message = ChatCompletionSystemMessageParam(role="system", content=system_prompt)
            input_messages = [system_message] + user_messages

        response = model.chat.completions.create(
            model=model_name,
            messages=input_messages,
            **model_params
        )
        entry = ModelTokenLogEntry(
            model_list_id=model_list_id,
            model=model_name,
            users_id=user.uid,
            classify="non-streaming",
            user_input=user_input,
            expert_model_type=3,
            chat_uuid=chat_uuid,
            prompt_token=response.usage.prompt_tokens,
            completion_token=response.usage.completion_tokens,
        )
        LoggerUtils.log_token_info(entry, session)
        finish_reason: str = response.choices[0].finish_reason
        if finish_reason == "length":
            return {"code": 400, "error": "回應長度超過長度限制，無法繼續，請調整輸入後再試一次或聯繫系統相關人員。"}
        elif finish_reason == "stop":
            res_dict = {
                "response": response.choices[0].message.content,
                "prompt_token": response.usage.prompt_tokens,
                "completion_token": response.usage.completion_tokens,
                "total_token": response.usage.total_tokens
            }
            return {"code": 200, "response": res_dict}
    except Exception as err:
        return {
            "code": 500,
            "error": getattr(err, "message", None) or (err.args[0] if err.args else str(err))
        }

def run_azure_upload_files_stream(*,
                                  session,
                                  chat_uuid: str,
                                  user: User,
                                  user_input: str,
                                  expert_data: dict[str, Any],
                                  system_prompt: str = "",
                                  user_prompts: list[Union[ChatCompletionContentPartTextParam, ChatCompletionContentPartImageParam]],
                                  model: AzureOpenAI,
                                  model_list_id: int,
                                  model_name: str,
                                  model_params: dict,
                                  history_message_id: str | None = None) -> Any:
    try:
        user_messages = [ChatCompletionUserMessageParam(role="user", content=user_prompts)]
        input_messages = user_messages
        if system_prompt:
            system_message = ChatCompletionSystemMessageParam(role="system", content=system_prompt)
            input_messages = [system_message] + user_messages

        response_steam = model.chat.completions.create(
            model=model_name,
            messages=input_messages,
            stream=True,
            **model_params
        )

        completion_token = None
        prompt_token = None
        full_response = []
        for chunk in response_steam:
            if check_response_attributes(chunk):
                if chunk.choices[0].finish_reason == "length":
                    yield error_msg("回應長度超過長度限制，無法繼續，請調整輸入後再試一次或聯繫系統相關人員。")
                content = chunk.choices[0].delta.content
                if isinstance(content, str):
                    full_response.append(content)
                    yield content
            elif hasattr(chunk, "usage") and chunk.usage is not None:
                if hasattr(chunk.usage, "prompt_tokens") and hasattr(chunk.usage, "completion_tokens") and hasattr(chunk.usage, "total_tokens"):
                    completion_token = chunk.usage.completion_tokens
                    prompt_token = chunk.usage.prompt_tokens
                    logger.debug(f"prompt_token: {prompt_token}, completion_token: {completion_token}")
                else:
                    logger.error(f"Invalid usage object: {chunk.usage}")
                    yield error_msg("回應內容中有資料缺失，請聯絡管理員。")
            else:
                logger.error(f"Invalid chunk object: {chunk}")
                yield error_msg("出現錯誤了，回應內容中有資料缺失，請聯絡管理員")
        
        if completion_token and prompt_token:
            entry_dict = {
                "user": user,
                "model": model_name,
                "model_list_id": model_list_id,
                "classify": "streaming",
                "prompt_token": prompt_token,
                "completion_token": completion_token,
                "user_input": user_input,
                "expert_data": expert_data,
                "chat_uuid": chat_uuid,
                "history_message_id": history_message_id
            }
            token_logger = TokenLogger(
                entry_builder=ModelTokenLogEntryBuilder(),
                session=session,
                entry_dict=entry_dict
            )
            token_logger.log_tokens(system_prompt, user_input, full_response)            
    except Exception as e:
        logger.error(f"Error in AzureOpenAIHandler run_azure_upload_files_stream: {e}")
        yield error_msg("意外錯誤，請聯絡管理員")

@staticmethod
def check_response_attributes(chunk) -> bool:
    if not hasattr(chunk, "choices") or not chunk.choices:
        return False
    if not hasattr(chunk.choices[0], "finish_reason"):
        return False
    if not hasattr(chunk.choices[0], "delta") or chunk.choices[0].delta is None:
        return False
    if not hasattr(chunk.choices[0].delta, "content"):
        return False
    if not hasattr(chunk, "usage") or chunk.usage is not None:
        return False
    return True

def get_azure_openai_instance(model_list_id: int):
    model_mapping = {
        5: "azure-img-gpt-4o",
        12: "caf-azure-img-gpt-4o",
        67: "caf-azure-img-gpt-4o-mini",
        70: "azure-img-gpt-4o-mini",
        77: "azure-img-gpt-4.1",
        78: "azure-img-gpt-4.1-mini",
        79: "azure-img-gpt-4.1-nano",
        80: "caf-azure-img-gpt-4.1",
        81: "caf-azure-img-gpt-4.1-mini",
        82: "caf-azure-img-gpt-4.1-nano"
    }
    
    model_name = model_mapping.get(model_list_id)
    
    if model_name is None:
        raise ValueError(f"Invalid model_list_id: {model_list_id}")
    
    azure_openai_instances = {
        "azure-img-gpt-4o": AzureOpenAI(
            azure_endpoint=getenv("AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4o'
        ),
        "azure-img-gpt-4o-mini": AzureOpenAI(
            azure_endpoint=getenv("AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4o-mini'
        ),
        "azure-img-gpt-4.1": AzureOpenAI(
            azure_endpoint=getenv("AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4.1'
        ),
        "azure-img-gpt-4.1-mini": AzureOpenAI(
            azure_endpoint=getenv("AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4.1-mini'
        ),
        "azure-img-gpt-4.1-nano": AzureOpenAI(
            azure_endpoint=getenv("AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4.1-nano'
        ),
        "caf-azure-img-gpt-4o": AzureOpenAI(
            azure_endpoint=getenv("CAF_AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("CAF_AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4o-1120'
        ),
        "caf-azure-img-gpt-4o-mini": AzureOpenAI(
            azure_endpoint=getenv("CAF_AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("CAF_AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4o-mini'
        ),
        "caf-azure-img-gpt-4.1": AzureOpenAI(
            azure_endpoint=getenv("CAF_AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("CAF_AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4.1'
        ),
        "caf-azure-img-gpt-4.1-mini": AzureOpenAI(
            azure_endpoint=getenv("CAF_AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("CAF_AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4.1-mini'
        ),
        "caf-azure-img-gpt-4.1-nano": AzureOpenAI(
            azure_endpoint=getenv("CAF_AZURE_OPENAI_ENDPOINT", ""),
            api_key=getenv("CAF_AZURE_OPENAI_API_KEY", ""),
            azure_deployment='gpt-4.1-nano'
        )
    }
    
    return azure_openai_instances[model_name]

def get_azure_openai_instance_optimization(model_list_id: int, session):
    model_name = ""
    model_deployment = ""
    row_model_list: ModelList_Schema | None = select_model_list_from_id(model_list_id=model_list_id, session=session)
    if row_model_list is not None:
        model_name = getattr(row_model_list, 'model_name', '').strip()
    else:
        raise ValueError(f"get_azure_openai_instance_optimization Invalid model_list_id: {model_list_id}")

    # azure_deployment 有需要被替代的話
    model_name_overrides = {
        'caf-azure-gpt-4o': 'gpt-4o-1120',
        # 可繼續加入其他對應關係
    }

    if model_name in model_name_overrides:
        model_deployment = model_name_overrides[model_name]
    else:
        match = re.search(r'gpt.*', model_name)
        if match:
            model_deployment = match.group(0)
        else:
            raise ValueError(f"get_azure_openai_instance_optimization Invalid model_deployment: {model_name}")

    if "caf" in model_name.lower():
        azure_endpoint = getenv("CAF_AZURE_OPENAI_ENDPOINT", "")
        api_key = getenv("CAF_AZURE_OPENAI_API_KEY", "")
    else:
        azure_endpoint = getenv("AZURE_OPENAI_ENDPOINT", "")
        api_key = getenv("AZURE_OPENAI_API_KEY", "")

    model = AzureOpenAI(
        azure_endpoint=azure_endpoint,
        api_key=api_key,
        azure_deployment=model_deployment
    )
    return model

class AzureDocumentsAgent(BaseDocumentsAgent):
    def __init__(self,):
        self.client = ''

    def generate_model_response(self, *, session, chat_uuid: str, user: User, user_input: str, expert_data: dict[str, Any],
                                model_list_id: int, model_name: str,history_message_id: str, file_names: list[str],
                                ori_file_names: list[str], system_prompt: str, model_params: dict[str, Any]) -> Generator[str, None, None]:
        try:
            initial_user_prompts = f"以下是使用者問題：{user_input}請你僅根據下方圖片內容回答，不要引入預設知識或推論。無特別說明請用「繁體中文」回答。"
            user_prompts: list[Union[ChatCompletionContentPartTextParam, ChatCompletionContentPartImageParam]] = [
                ChatCompletionContentPartTextParam(text=initial_user_prompts, type="text")
            ]

            for i, file_name in enumerate(file_names):
                user_prompts.append(
                    ChatCompletionContentPartTextParam(text=f"若圖片中文字不清晰請明說「無法辨識」。以下圖片是{ori_file_names[i]}的檔案內容", type="text")
                )
                image_data_urls = self.pdf_to_image_base64_data_urls(file_name)
                for url in image_data_urls:
                    user_prompts.append(
                        ChatCompletionContentPartImageParam(
                            image_url=ImageURL(url=url, detail="auto"),
                            type="image_url"
                        )
                    )

            match = re.search(r'gpt.*', model_name)
            if match:
                model_deployment = match.group(0)
            else:
                raise ValueError(f"AzureDocumentsAgent Invalid model_deployment: {model_name}")

            if "caf" in model_name.lower():
                azure_endpoint = getenv("CAF_AZURE_OPENAI_ENDPOINT", "")
                api_key = getenv("CAF_AZURE_OPENAI_API_KEY", "")
            else:
                azure_endpoint = getenv("AZURE_OPENAI_ENDPOINT", "")
                api_key = getenv("AZURE_OPENAI_API_KEY", "")

            model = AzureOpenAI(
                azure_endpoint=azure_endpoint,
                api_key=api_key,
                azure_deployment=model_deployment
            )

            yield from run_azure_upload_files_stream(session=session,
                                                        chat_uuid=chat_uuid,
                                                        user=user,
                                                        user_input=user_input,
                                                        expert_data=expert_data,
                                                        system_prompt=system_prompt,
                                                        user_prompts=user_prompts,
                                                        model=model,
                                                        model_list_id=model_list_id,
                                                        model_name=model_name,
                                                        model_params=model_params,
                                                        history_message_id=history_message_id)
        except Exception as e:
            logger.error(f"AzureOpenAIHandler generate_model_response error, ex: {e}")
            yield error_msg('發生錯誤，若有問題請聯繫管理員。')


    def intention_analysis(self, *, user_input: str, model_list_id: int, session) -> str:
        settings_row: Settings_Schema | None = select_settings_from_key(
            key="document_agent_intention_prompt", session=session)
        try:
            if not settings_row:
                intention_map: dict[str, str] = {
                    "compare_differences": "使用者希望比較兩份文件的差異（例如：增刪修改了哪些條文）。",
                    "find_similarities": "使用者希望找出兩份文件中內容相似或相同的部分。",
                    "merge_summarize": "使用者希望將兩份文件整合並進行摘要。",
                    "qa_with_context": "使用者針對文件提出問題，需要根據文件內容回答。",
                    "validate_consistency": "使用者希望確認兩份文件在邏輯或條文上是否一致。",
                    "other": "無法明確歸類為以上類別的任務時選擇此項。"
                }
            else:
                intention_map: dict[str, str] = json.loads(
                    settings_row.value.strip())
        except Exception as e:
            intention_map: dict[str, str] = {
                "compare_differences": "使用者希望比較兩份文件的差異（例如：增刪修改了哪些條文）。",
                "find_similarities": "使用者希望找出兩份文件中內容相似或相同的部分。",
                "merge_summarize": "使用者希望將兩份文件整合並進行摘要。",
                "qa_with_context": "使用者針對文件提出問題，需要根據文件內容回答。",
                "validate_consistency": "使用者希望確認兩份文件在邏輯或條文上是否一致。",
                "other": "無法明確歸類為以上類別的任務時選擇此項。"
            }
            logger.error(
                f"AzureOpenAIHandler intention_analysis error, ex: {e}")
        meta_intention_prompt: str = f"""
            你是一個意圖辨識助手，負責根據使用者的問題與提供的文件，判斷使用者的操作目的是什麼。請從以下選項中選出最合適的一個意圖：
            {intention_map}
            請僅回傳一個 intent key，例如： compare_differences 或 other。
        """
        try:
            model = get_azure_openai_instance(model_list_id)
            row_model_list: ModelList_Schema | None = select_model_list_from_id(model_list_id=model_list_id, session=session)
            if row_model_list:
                model_name = row_model_list.model_name if row_model_list.model_name else "azure-gpt-4o-mini"

            user_prompts: list[Union[ChatCompletionContentPartTextParam, ChatCompletionContentPartImageParam]] = [
                ChatCompletionContentPartTextParam(text=user_input, type="text")
            ]
            user_messages = [ChatCompletionUserMessageParam(role="user", content=user_prompts)]
            input_messages = user_messages 
            if meta_intention_prompt:
                system_message = ChatCompletionSystemMessageParam(role="system", content=meta_intention_prompt)
                input_messages = [system_message] + user_messages               

            response = model.chat.completions.create(
                model=model_name,
                messages=input_messages,
                max_tokens=8000,
                temperature=1)
            content = response.choices[0].message.content
            if not content:
                return "other"
            return content
        except Exception as e:
            logger.error(
                f"AzureOpenAIHandler intention_analysis error, ex: {e}")
            return "other"