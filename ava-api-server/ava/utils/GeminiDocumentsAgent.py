import json
import logging
from typing import Any, Generator

from ava.clients.sql.crud import select_settings_from_key
from ava.clients.sql.schema import Settings_Schema
from ava.utils.return_message_style import error_msg
from ava.utils.BaseDocumentsAgent import BaseDocumentsAgent
from ava.utils.TokenLogger import TokenLogger, ModelTokenLogEntryBuilder, TokenInfoLogger
from google import genai
from google.genai import types
from ava.model.dscom import User

logger = logging.getLogger("ava_app")


class GeminiDocumentsAgent(BaseDocumentsAgent):
    error_messages = {
        types.FinishReason.MAX_TOKENS: "回應長度超過長度限制，無法繼續，請調整輸入後再試一次或聯繫系統相關人員。",
        types.FinishReason.SAFETY: "回應包含不適當的內容，請調整輸入後再試一次或聯繫系統相關人員。",
        types.FinishReason.RECITATION: "回應因背誦內容而遭標記，請調整輸入後再試一次或聯繫系統相關人員。",
        types.FinishReason.OTHER: "未知原因導致回應無法生成，請稍後再試或聯繫系統相關人員。",
        types.FinishReason.BLOCKLIST: "回應包含禁止使用的字詞，因此無法產生內容，請調整輸入後再試一次。",
        types.FinishReason.PROHIBITED_CONTENT: "代碼產生作業已停止，因為代碼可能含有禁止內容，請檢查輸入內容。",
        types.FinishReason.SPII: "回應可能含有敏感性的個人識別資訊 (SPII)，因此無法繼續。請移除相關資訊後重試。",
        types.FinishReason.MALFORMED_FUNCTION_CALL: "模型產生的函式呼叫無效，請確認函式名稱與參數是否正確。"
    }
    def __init__(self,
                 api_key: str = "AIzaSyCfNsztL1zSd369mhA-HMVnQ7X9lf3B0CI"):
        self.client = genai.Client()

    def generate_model_response(self, *, session, chat_uuid: str, user: User, user_input: str, expert_data: dict[str, Any],
                                model_list_id: int, model_name: str, history_message_id: str, file_names: list[str],
                                ori_file_names: list[str], system_prompt: str, model_params: dict[str, Any]) -> Generator[str, None, None]:
        try:
            files = []
            for file_name in file_names:
                files.append(self.client.files.upload(file=file_name))

            max_output_tokens = model_params.get("max_tokens", 16000)
            temperature = model_params.get("temperature", 1)
            top_p = model_params.get("top_p", 1)
            frequency_penalty = model_params.get("frequency_penalty", 0)
            response = self.client.models.generate_content_stream(
                model=model_name,
                contents=[files, user_input],
                config=types.GenerateContentConfig(
                    candidate_count=1,
                    max_output_tokens=max_output_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    frequency_penalty=frequency_penalty,
                    system_instruction=system_prompt))
            last_usage_metadata = None
            full_response = []
            for chunk in response:
                missing_attributes, candidate_obj, usage_metadata = self.check_response_attributes(
                    chunk)
                if not missing_attributes and candidate_obj is not None:
                    last_usage_metadata = usage_metadata
                    content = candidate_obj.content.parts[0].text
                    if isinstance(content, str):
                        full_response.append(content)
                        # print(f"gemini content: {content}")
                        yield content
                    else:
                        logger.error(f"Content is not a string: {content}")
                        error_message = f" \r\n\n {error_msg('回應內容資料型態錯誤，請稍後再試或聯繫系統相關人員。')}"
                        yield error_message
                        yield "</end>"
                        return
                elif missing_attributes and missing_attributes == ["finish_reason"] and candidate_obj is not None:
                    finish_reason = candidate_obj.finish_reason
                    error_text = self.get_error_message(finish_reason)
                    error_message = f" \r\n\n {error_msg(error_text)}"
                    logger.error(
                        f"Finish reason: {finish_reason} - {error_text}")
                    yield error_message
                    yield "</end>"
                    return
                else:
                    error_message = f" \r\n\n {error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')}"
                    yield error_message
                    yield "</end>"
                    return

                last_usage_metadata = getattr(chunk, 'usage_metadata', None)
                if last_usage_metadata is None:
                    logger.error("Missing attribute: chunk.usage_metadata")
                    error_message = f" \r\n\n {error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')}"
                    yield error_message
                    yield "</end>"
                    return
                if not all(
                        hasattr(last_usage_metadata, attr)
                        for attr in ('prompt_token_count',
                                     'candidates_token_count')):
                    logger.error(
                        "Missing attributes: usage_metadata.prompt_token_count or usage_metadata.candidates_token_count"
                    )
                    error_message = f" \r\n\n {error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')}"
                    yield error_message
                    yield "</end>"
                    return
            yield "</end>"
            yield json.dumps({"type": "llm_qa_response"})
            yield "</end>"
            yield json.dumps({"llm_qa_response": "".join(full_response)},
                             ensure_ascii=False)
            yield "</end>"

            if last_usage_metadata is not None:
                entry_dict = {
                    "user": user,
                    "model": model_name,
                    "model_list_id": model_list_id,
                    "classify": "streaming",
                    "prompt_token": last_usage_metadata.prompt_token_count,
                    "completion_token": last_usage_metadata.candidates_token_count,
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
            else:
                logger.error("Missing attributes: usage_metadata.prompt_token_count or usage_metadata.candidates_token_count is None")
                yield error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')
        except Exception as e:
            logger.error(f"GeminiDocumentsAgent unexcepted error, ex: {e}")
            # raise Exception('4001 無效的 API 請求')
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
                f"GeminiDocumentsAgent intention_analysis error, ex: {e}")
        meta_intention_prompt: str = f"""
            你是一個意圖辨識助手，負責根據使用者的問題與提供的文件，判斷使用者的操作目的是什麼。請從以下選項中選出最合適的一個意圖：
            {intention_map}
            請僅回傳一個 intent key，例如： compare_differences 或 other。
        """
        try:
            response = self.client.models.generate_content(
                model="models/gemini-2.0-flash",
                contents=[user_input, meta_intention_prompt],
                config=types.GenerateContentConfig(
                    candidate_count=1,
                    max_output_tokens=8000,
                    temperature=1,
                    system_instruction=meta_intention_prompt))
            if not response.candidates:
                return "other"
            return response.candidates[0].content.parts[0].text  # type: ignore
        except Exception as e:
            logger.error(
                f"GeminiDocumentsAgent intention_analysis error, ex: {e}")
            return "other"

    @classmethod
    def get_error_message(cls, finish_reason):    
        message = cls.error_messages.get(finish_reason, "未知的結束錯誤，請聯繫系統相關人員支援。")
        return message

    @staticmethod
    def log_and_return(attribute):
        logger.error(f"Missing attributes: {attribute}")
        return [attribute]

    @staticmethod
    def check_response_attributes(response):
        # response.candidates
        candidates = getattr(response, "candidates", None)
        if not isinstance(candidates, list) or not candidates:
            return GeminiDocumentsAgent.log_and_return(
                "response.candidates"), None, None

        # response.candidates[0].content.parts[0].text
        candidate_0 = candidates[0]
        content = getattr(candidate_0, "content", None)
        if not content:
            return GeminiDocumentsAgent.log_and_return(
                "response.candidates[0].content"), None, None
        parts = getattr(content, "parts", None)
        if not isinstance(parts, list) or not parts:
            return GeminiDocumentsAgent.log_and_return(
                "response.candidates[0].content.parts"), None, None
        text = getattr(parts[0], "text", None)
        if text is None:
            return GeminiDocumentsAgent.log_and_return(
                "response.candidates[0].content.parts[0].text"), None, None

        # response.candidates[0].finish_reason
        finish_reason = getattr(candidate_0, "finish_reason", None)
        if finish_reason not in [None, types.FinishReason.STOP]:
            return ["finish_reason"], candidate_0, None

        # response.usage_metadata
        usage_metadata = getattr(response, "usage_metadata", None)
        if usage_metadata is None:
            return GeminiDocumentsAgent.log_and_return(
                "response.usage_metadata"), candidate_0, None
        if not all(
                hasattr(usage_metadata, attr)
                for attr in ('prompt_token_count', 'candidates_token_count')):
            return GeminiDocumentsAgent.log_and_return(
                "response.usage_metadata.prompt_token_count or response.usage_metadata.candidates_token_count"
            ), candidate_0, None

        return [], candidate_0, usage_metadata
