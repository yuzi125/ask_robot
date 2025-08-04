import json
import logging
import time
from typing import Any, Generator

import openai
import tiktoken
from ava.clients.sql.crud import select_settings_from_key
from ava.clients.sql.schema import Settings_Schema
from ava.model.dscom import User
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from ava.utils.BaseDocumentsAgent import BaseDocumentsAgent
from ava.utils.return_message_style import error_msg
from ava.utils.utils import LoggerUtils
from kor.extraction import create_extraction_chain
from langchain_community.callbacks import get_openai_callback
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam
from retrying import retry

logger = logging.getLogger("ava_app")
token_logger = logging.getLogger("token_counter")


# GPT 相關任務
class GPTHandler(BaseDocumentsAgent):

    def __init__(self, api_key, base_url: str | None = None, params=None):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.params = params if params is not None else {}

    # params可以參考 Create chat completion: https://platform.openai.com/docs/api-reference/chat/create?lang=python
    def run_gptModel(
        self,
        session,
        user: User,
        messages,
        user_input,
        expert_data,
        chat_uuid,
        model_list_id: int,
        classify="non-streaming",
        model="gpt-4o",
        params=None,
    ):
        if params is None:
            params = self.params
        try:
            params["stream"] = False
            response = self.client.chat.completions.create(model=model,
                                                           messages=messages,
                                                           timeout=50,
                                                           **params)
            content = response.choices[0].message.content
            logger.debug(f"response.choices[0] {response.choices[0]}")

            # 建立 ModelTokenLogEntry 實例
            entry = ModelTokenLogEntry(
                model_list_id=model_list_id,
                users_id=user.uid,
                model=model,
                classify=classify,
                prompt_token=response.usage.prompt_tokens,
                completion_token=response.usage.completion_tokens,
                user_input=user_input,
                expert_id=expert_data["expert_id"],
                expert_model=expert_data["expert_model"],
                expert_model_type=expert_data["expert_model_type"],
                chat_uuid=chat_uuid,
            )
            LoggerUtils.log_token_info(entry, session)
            # LoggerUtils.log_token_info(
            #     user,
            #     model,
            #     response.usage.prompt_tokens,
            #     response.usage.completion_tokens,
            #     "-1",
            #     "intent",
            # )
            return content
        except Exception as e:
            logger.error(f"Error in GPTHandler get_gptModel: {e}")
            logger.debug(f"user {user}")
            logger.debug(f"model {model}")
            logger.debug(f"messages {messages}")
            logger.debug(f"params {params}")
            logger.debug(f"user_input {user_input}")
            logger.debug(f"expert_data {expert_data}")
            logger.debug(f"chat_uuid {chat_uuid}")
            return None

    def run_gptModel_stream(
        self,
        session,
        chat_uuid,
        user: User,
        messages,
        user_input,
        expert_data,
        model_list_id: int,
        classify="streaming",
        model="gpt-4o",
        params=None,
        history_message_id=None,
    ):
        if params is None:
            params = self.params
        try:
            params["stream"] = True
            logger.debug(f"送出的 prompt : {messages}")
            t0 = time.time()
            response_stream = self.client.chat.completions.create(
                model=model,
                messages=messages,
                stream_options={"include_usage": True},
                timeout=50,
                **params)
            t1 = time.time()
            logger.info(
                f"📡 OpenAI chat completion stream created: {t1 - t0:.2f}s")
            # full_response = []
            for i, chunk in enumerate(response_stream):
                if i == 0:
                    first_token_time = time.time()
                    logger.info(
                        f"⏱️ OpenAI first token received: {first_token_time - t1:.2f}s after iteration start"
                    )
                if hasattr(chunk,
                           'choices') and len(chunk.choices) > 0 and hasattr(
                               chunk.choices[0], 'finish_reason'):
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
                            # full_response.append(content)
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
                history_message_id=history_message_id,
            )
            LoggerUtils.log_token_info(entry, session)
            # full_body = "".join(full_response)
            # prompt_text = (" ".join(
            #     json.dumps(msg) if isinstance(msg, dict) else msg
            #     for msg in messages)
            #                if isinstance(messages, list) else messages)
            # entry = ModelTokenLogEntry(
            #     model_list_id=model_list_id,
            #     users_id=user.uid,
            #     model=model,
            #     user_input=user_input,
            #     classify=classify,
            #     expert_id=expert_data["expert_id"],
            #     expert_model=expert_data["expert_model"],
            #     expert_model_type=expert_data["expert_model_type"],
            #     chat_uuid=chat_uuid,
            # )
            # LoggerUtils.token_from_text(prompt_text, full_body, entry, session)
        except openai.APIConnectionError as e:
            # Handle connection error here
            logger.error(f"Failed to connect to OpenAI API: {e}")
            yield error_msg("出現錯誤了，連線openAI失敗，請稍後再試")
        except openai.BadRequestError as e:
            # Handle API error here, e.g. retry or log
            logger.error(f"OpenAI API BadRequestError an API Error: {e}")
            yield error_msg("出現錯誤了，可能是超出token長度，請試著縮小問題的範圍或改變問答方式")

        except openai.APIError as e:
            # Handle API error here, e.g. retry or log
            logger.error(f"OpenAI API returned an API Error: {e}")
            yield error_msg("錯誤代碼:506 openAI出現錯誤了，請聯絡管理員")
        except Exception as e:
            logger.error(f"Error in GPTHandler run_gptModel_stream: {e}")
            yield error_msg("意外錯誤，請聯絡管理員")

    @staticmethod
    def run_gptModel_langChain(session, chat_uuid, user, llm, expert_data,
                               schema, query, model_list_id):
        with get_openai_callback() as cb:
            chain = create_extraction_chain(llm, schema)

            data = chain.run(query)["data"]
            entry = ModelTokenLogEntry(
                model_list_id=model_list_id,
                users_id=user.uid,
                model=llm.model_name,
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

    def run_gptModel_for_voice(
        self,
        user: User,
        transcribed_text,
        model="gpt-4o",
        params=None,
    ):
        if params is None:
            params = self.params
        try:
            # 將語音轉換的文本作為輸入
            response = self.client.chat.completions.create(model=model,
                                                           messages=[{
                                                               "role":
                                                               "system",
                                                               "content":
                                                               transcribed_text
                                                           }],
                                                           **params)
            content = response.choices[0].message.content
            logger.debug(f"GPT Response: {content}")
            return content
        except Exception as e:
            logger.error(f"Error in run_gptModel_for_voice: {e}")
            return None

    def generate_model_response(
            self, *, session, chat_uuid: str, user: User, user_input: str,
            expert_data: dict[str, Any], model_list_id: int, model_name: str,
            history_message_id: str, file_names: list[str],
            ori_file_names: list[str], system_prompt: str,
            model_params: dict[str, Any]) -> Generator[str, None, None]:
        try:
            contents = []
            contents.append({"type": "text", "text": f"以下是使用者問題：{user_input}"})
            contents.append({
                "type":
                "text",
                "text":
                "請你僅根據下方圖片內容回答，不要引入預設知識或推論。無特別說明請用「繁體中文」回答。"
            })

            for i, file_name in enumerate(file_names):
                contents.append({
                    "type":
                    "text",
                    "text":
                    f"若圖片中文字不清晰請明說「無法辨識」。以下圖片是{ori_file_names[i]}的檔案內容"
                })
                image_data_urls = self.pdf_to_image_base64_data_urls(file_name)
                for url in image_data_urls:
                    contents.append({
                        "type": "image_url",
                        "image_url": {
                            "url": url
                        }
                    })

            messages = [{
                "role": "system",
                "content": system_prompt
            }, {
                "role": "user",
                "content": contents
            }]

            yield from self.run_gptModel_stream(
                session=session,
                chat_uuid=chat_uuid,
                user=user,
                messages=messages,
                user_input=user_input,
                expert_data=expert_data,
                model_list_id=model_list_id,
                model=model_name,
                history_message_id=history_message_id,
                params=model_params)
        except Exception as e:
            logger.error(f"Error in GPTHandler generate_model_response: {e}")
            yield error_msg('發生錯誤，若有問題請聯繫管理員。')

    def intention_analysis(self, *, user_input: str, model_list_id: int,
                           session) -> str:
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
            logger.error(f"GPTHandler intention_analysis error, ex: {e}")
        meta_intention_prompt: str = f"""
            你是一個意圖辨識助手，負責根據使用者的問題與提供的文件，判斷使用者的操作目的是什麼。請從以下選項中選出最合適的一個意圖：
            {intention_map}
            請僅回傳一個 intent key，例如： compare_differences 或 other。
        """
        try:
            messages: list[ChatCompletionMessageParam] = [{
                "role":
                "system",
                "content":
                meta_intention_prompt
            }, {
                "role": "user",
                "content": user_input
            }]
            response = self.client.chat.completions.create(model="gpt-4o-mini",
                                                           messages=messages,
                                                           max_tokens=8000,
                                                           temperature=1)
            content = response.choices[0].message.content
            if not content:
                return "other"
            return content
        except Exception as e:
            logger.error(f"GPTHandler intention_analysis error, ex: {e}")
            return "other"
