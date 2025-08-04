import json
import logging
from typing import List

import openai
from ava.model.dscom import User
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from ava.utils.env_utils import get_openrouter_api_key
from ava.utils.return_message_style import error_msg
from ava.utils.utils import LoggerUtils
from openai import OpenAI

logger = logging.getLogger("ava_app")
token_logger = logging.getLogger("token_counter")


# OpenRouter 相關任務
class OpenRouterHandler:
    """
    OpenRouter 處理器類。
    
    OpenRouter 是一個 API 代理，允許使用多種不同的 LLM 模型，包括 OpenAI、Anthropic、
    Mistral、Claude 等。它使用與 OpenAI API 相容的接口，因此可以使用 OpenAI 的 
    Python SDK 進行調用，只需更改 base_url 和 API 密鑰。
    
    使用方法：
    1. 在環境變量中設置 OPENROUTER_API_KEY
    2. 在模型參數中指定 llm_model_vendor="openrouter"
    3. 在模型參數中指定您想使用的特定模型名稱，例如 "anthropic/claude-3-opus"
    
    更多資訊請參考：https://openrouter.ai/docs
    """

    def __init__(self, api_key=None, base_url=None, params=None):
        # OpenRouter 使用的基礎 URL
        self.base_url = base_url or "https://openrouter.ai/api/v1"
        # 使用提供的 API 密鑰或從環境變量獲取
        self.api_key = api_key or get_openrouter_api_key()
        if self.api_key is None:
            raise ValueError("OpenRouter API key is required but not provided")
        # 創建 OpenAI 客戶端實例並指定 base_url
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.params = params if params is not None else {}

    def run_openrouter_model_stream(
            self,
            session,
            chat_uuid,
            user: User,
            messages,
            user_input,
            expert_data,
            model_list_id: int,
            classify="streaming",
            model="gpt-4o",  # 預設模型，可以被覆蓋
            params=None,
            history_message_id: str | None = None):
        """
        使用 OpenRouter API 進行流式生成回應。
        
        OpenRouter 支持多種模型，例如：
        - "openai/gpt-4-turbo"
        - "anthropic/claude-3-opus"
        - "anthropic/claude-3-sonnet"
        - "anthropic/claude-3-haiku"
        - "google/gemini-pro"
        - "meta-llama/llama-3-70b-instruct"
        
        完整的模型列表可在 https://openrouter.ai/docs 查看
        """
        if params is None:
            params = self.params
        try:
            params["stream"] = True
            logger.debug(f"送出的 prompt : {messages}")
            response_stream = self.client.chat.completions.create(
                model=model,
                messages=messages,
                stream_options={"include_usage": True},
                **params)

            prompt_tokens = 0
            completion_tokens = 0

            for chunk in response_stream:
                if hasattr(chunk,
                           'choices') and len(chunk.choices) > 0 and hasattr(
                               chunk.choices[0], 'finish_reason') and hasattr(
                                   chunk, 'usage') and chunk.usage is None:
                    if chunk.choices[0].finish_reason == "length":
                        error_message = (
                            " \r\n\n " +
                            error_msg("回應長度超過長度限制，無法繼續，請具體描述您的問題，讓ava更好的為您服務。")
                        )
                        logger.info(f"Length limit reached: {error_message}")
                        yield error_message
                    elif hasattr(chunk.choices[0], "delta") and hasattr(
                            chunk.choices[0].delta, "content"):
                        content = chunk.choices[0].delta.content
                        if isinstance(content, str):
                            yield content
                        else:
                            logger.error(f"Content is not a string: {content}")
                elif hasattr(chunk, 'usage'):
                    if hasattr(chunk.usage, 'completion_tokens') and hasattr(
                            chunk.usage, 'prompt_tokens'):
                        completion_tokens = chunk.usage.completion_tokens
                        prompt_tokens = chunk.usage.prompt_tokens
                        logger.debug(
                            f"Completion Tokens: {completion_tokens}, Prompt Tokens: {prompt_tokens}"
                        )
                    else:
                        logger.error(
                            "Chunk usage does not have completion_tokens or prompt_tokens"
                        )
                        raise Exception("出現錯誤了，回應內容中有資料缺失，請聯絡管理員")
                else:
                    logger.error("Chunk does not have valid choices or usage")
                    raise Exception("出現錯誤了，回應內容中有資料缺失，請聯絡管理員")

            entry = ModelTokenLogEntry(
                model_list_id=model_list_id,
                users_id=user.uid,
                model=model,
                user_input=user_input,
                classify=classify,
                expert_id=expert_data["expert_id"],
                expert_model=expert_data["expert_model"],
                expert_model_type=expert_data["expert_model_type"],
                chat_uuid=chat_uuid,
                prompt_token=prompt_tokens,
                completion_token=completion_tokens,
                history_message_id=history_message_id)
            LoggerUtils.log_token_info(entry, session)

        except openai.APIConnectionError as e:
            # 處理連接錯誤
            logger.error(f"Failed to connect to OpenRouter API: {e}")
            yield error_msg("出現錯誤了，連線 OpenRouter 失敗，請稍後再試")
        except openai.BadRequestError as e:
            # 處理 API 錯誤
            logger.error(f"OpenRouter API BadRequestError: {e}")
            yield error_msg("出現錯誤了，可能是超出token長度，請試著縮小問題的範圍或改變問答方式")
        except openai.APIError as e:
            # 處理 API 錯誤
            logger.error(f"OpenRouter API returned an API Error: {e}")
            yield error_msg("錯誤代碼:506 OpenRouter 出現錯誤了，請聯絡管理員")
        except Exception as e:
            logger.error(
                f"Error in OpenRouterHandler run_openrouter_model_stream: {e}")
            yield error_msg("意外錯誤，請聯絡管理員")
