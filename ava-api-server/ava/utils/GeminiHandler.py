import logging
import urllib.request
import os
import json
import mimetypes
from typing import Any
from werkzeug.datastructures import FileStorage
from google import genai
from google.genai import types
from google.genai.errors import ServerError
from ava.model.dscom import User
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from ava.utils.utils import LoggerUtils
from ava.utils import env_utils
from ava.utils.return_message_style import error_msg

logger = logging.getLogger("ava_app")
mimetypes.add_type('image/webp', '.webp')

class GeminiHandler:
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
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    def run_gemini_model_not_stream(self,
                             *,
                             session,
                             chat_uuid: str,
                             user: User,
                             user_input: str,
                             expert_data: dict[str, Any],
                             system_prompt: str,
                             message_content: str,
                             model_params: dict[str, Any],
                             model_list_id: int,
                             model: str = "gemini-2.0-flash-lite"):
        max_token: int = model_params.get("max_tokens", 1500)
        temperature: float = model_params.get("temperature", 0.5)
        frequency_penalty: float = model_params.get("frequency_penalty", 0)
        top_p: float = model_params.get("top_p", 0.3)
        try:
            response = self.client.models.generate_content(
                model=model,
                contents=message_content,
                config=types.GenerateContentConfig(
                    candidate_count=1, # 回傳幾個候選答案
                    max_output_tokens=max_token,
                    temperature=temperature,
                    frequency_penalty=frequency_penalty,
                    top_p=top_p,
                    system_instruction=system_prompt
                )
            )

            missing_attributes, candidate_obj, usage_metadata = self.check_response_attributes(response)
            if not missing_attributes and usage_metadata is not None and candidate_obj is not None:
                entry = ModelTokenLogEntry(
                    model_list_id=model_list_id,
                    users_id=user.uid,
                    model=model,
                    user_input=user_input,
                    classify="non-streaming",
                    expert_id=expert_data["expert_id"],
                    expert_model=expert_data["expert_model"],
                    expert_model_type=expert_data["expert_model_type"],
                    chat_uuid=chat_uuid,
                    prompt_token=usage_metadata.prompt_token_count,
                    completion_token=usage_metadata.candidates_token_count)
                LoggerUtils.log_token_info(entry, session)
                return candidate_obj.content.parts[0].text
            elif missing_attributes and missing_attributes == ["finish_reason"] and candidate_obj is not None:
                finish_reason = candidate_obj.finish_reason
                error_text = self.get_error_message(finish_reason)
                error_message = f"{error_msg(error_text)}"
                logger.error(f"Finish reason: {finish_reason} - {error_text}")
                return error_message
            else:
                error_message = f"{error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')}"
                return error_message          
        except (ServerError) as ex:
            logger.error(f"gemini run_gemini_model_not_stream server error, ex: {ex}")
            return "2001 語言模型伺服器錯誤"
        except Exception as ex:
            logger.error(f"gemini run_gemini_model_not_stream unexcepted error, ex: {ex}")
            return "4001 無效的 API 請求"

    def run_gemini_model_stream(self,
                         *,
                         session,
                         chat_uuid: str,
                         user: User,
                         user_input: str,
                         expert_data: dict[str, Any],
                         system_prompt: str,
                         message_content,
                         model_params: dict[str, Any],
                         model_list_id: int,
                         model: str = "gemini-2.0-flash-lite",
                         history_message_id: str | None = None):
        max_token: int = model_params.get("max_tokens", 1500)
        temperature: float = model_params.get("temperature", 0.5)
        frequency_penalty: float = model_params.get("frequency_penalty", 0)
        top_p: float = model_params.get("top_p", 0.3)
        try:
            response = self.client.models.generate_content_stream(
                model=model,
                contents=message_content,
                config=types.GenerateContentConfig(
                    candidate_count=1, # 回傳幾個候選答案
                    max_output_tokens=max_token,
                    temperature=temperature,
                    frequency_penalty=frequency_penalty,
                    top_p=top_p,
                    system_instruction=system_prompt
                )
            )
            last_usage_metadata = None
            full_response = []
            for chunk in response:
                missing_attributes, candidate_obj, usage_metadata = self.check_response_attributes(chunk)
                if not missing_attributes and candidate_obj is not None:
                    last_usage_metadata = usage_metadata
                    content = candidate_obj.content.parts[0].text
                    if isinstance(content, str):
                        # full_response.append(content)
                        # print(f"gemini content: {content}")
                        yield content
                    else:
                        logger.error(f"Content is not a string: {content}")
                        error_message = f" \r\n\n {error_msg('回應內容資料型態錯誤，請稍後再試或聯繫系統相關人員。')}"
                        yield error_message
                        return                    
                elif missing_attributes and missing_attributes == ["finish_reason"] and candidate_obj is not None:
                    finish_reason = candidate_obj.finish_reason
                    error_text = self.get_error_message(finish_reason)
                    error_message = f" \r\n\n {error_msg(error_text)}"
                    logger.error(f"Finish reason: {finish_reason} - {error_text}")
                    yield error_message
                    return
                else:
                    error_message = f" \r\n\n {error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')}"
                    yield error_message
                    return

                last_usage_metadata = getattr(chunk, 'usage_metadata', None)
                if last_usage_metadata is None:
                    logger.error("Missing attribute: chunk.usage_metadata")
                    error_message = f" \r\n\n {error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')}"
                    yield error_message
                    return
                if not all(hasattr(last_usage_metadata, attr) for attr in ('prompt_token_count', 'candidates_token_count')):
                    logger.error("Missing attributes: usage_metadata.prompt_token_count or usage_metadata.candidates_token_count")
                    error_message = f" \r\n\n {error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')}"
                    yield error_message
                    return
            if last_usage_metadata is not None:
                entry = ModelTokenLogEntry(
                    model_list_id=model_list_id,
                    users_id=user.uid,
                    model=model,
                    classify="streaming",
                    user_input=user_input,
                    expert_id=expert_data["expert_id"],
                    expert_model=expert_data["expert_model"],
                    expert_model_type=expert_data["expert_model_type"],
                    chat_uuid=chat_uuid,
                    prompt_token=last_usage_metadata.prompt_token_count,
                    completion_token=last_usage_metadata.candidates_token_count,
                    history_message_id=history_message_id
                )
                LoggerUtils.log_token_info(entry, session)
            else:
                logger.error("Missing attributes: usage_metadata.prompt_token_count or usage_metadata.candidates_token_count is None")
                raise Exception('回應內容中有資料缺失，請聯繫系統相關人員。')
        except (ServerError) as ex:
            logger.error(f"gemini run_gemini_model_stream server error, ex: {ex}")
            raise Exception('2001 語言模型伺服器錯誤')
        except Exception as ex:
            logger.error(f"gemini run_gemini_model_stream unexcepted error, ex: {ex}")
            raise Exception('4001 無效的 API 請求')

    def handle(self,
               *,
               model_list_id: int,
               user: User,
               model: str = "gemini-2.0-flash-lite",
               user_input: str,
               expert_id: str,
               chat_uuid: str,
               session,
               history_message_id: str,
               message_data: list[dict[str, Any]]):
        try:
            file_names = []
            return_path = []
            for uploaded_files_url in message_data:
                return_path.append({"path": uploaded_files_url["path"]})
                ava_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                full_path = os.path.join(ava_dir, "uploads", uploaded_files_url["path"])
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                file_service_url = env_utils.get_key("AVA_FILE_SERVICE_URL")
                file_name = urllib.request.urlretrieve(f"{file_service_url}/{uploaded_files_url['path']}", full_path)
                file_names.append(file_name[0])
            
            files = []
            for file_name in file_names:
                files.append(self.client.files.upload(file=file_name))
            
            result = {
                "state": "QA",
                "data": return_path
            }

            # 處理完觸發隧道模式必要訊息後，先回傳訊息給前端
            yield json.dumps({"state": "QA"})
            yield "</end>"
            yield json.dumps({"type": "tunnel"})
            yield "</end>"
            yield json.dumps(result, ensure_ascii=False)
            yield "</end>"
            yield json.dumps({"type":"hmi"})
            yield "</end>"
            yield history_message_id
            yield "</end>"            
            yield json.dumps({"type": "data"})
            yield "</end>"            

            system_prompt = "你是一個專業的文件分析師，請分析以下文件，並回答使用者提出的問題。"
            response = self.client.models.generate_content_stream(
                model=model,
                contents=[files, user_input],
                config=types.GenerateContentConfig(
                    candidate_count=1,
                    max_output_tokens=8000,
                    temperature=0,
                    frequency_penalty=0,
                    top_p=1,
                    system_instruction=system_prompt
                )
            )
            last_usage_metadata = None
            full_response = []
            for chunk in response:
                missing_attributes, candidate_obj, usage_metadata = self.check_response_attributes(chunk)
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
                    logger.error(f"Finish reason: {finish_reason} - {error_text}")
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
                if not all(hasattr(last_usage_metadata, attr) for attr in ('prompt_token_count', 'candidates_token_count')):
                    logger.error("Missing attributes: usage_metadata.prompt_token_count or usage_metadata.candidates_token_count")
                    error_message = f" \r\n\n {error_msg('回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。')}"
                    yield error_message
                    yield "</end>"
                    return
            yield "</end>"
            yield json.dumps({"type": "llm_qa_response"})
            yield "</end>"
            yield json.dumps({"llm_qa_response": "".join(full_response)}, ensure_ascii=False)
            yield "</end>"
            if last_usage_metadata is not None:
                entry = ModelTokenLogEntry(
                    model_list_id=model_list_id,
                    users_id=user.uid,
                    model=model,
                    classify="streaming",
                    user_input=user_input,
                    expert_id=expert_id,
                    expert_model_type=3,
                    chat_uuid=chat_uuid,
                    prompt_token=last_usage_metadata.prompt_token_count,
                    completion_token=last_usage_metadata.candidates_token_count                
                )
                LoggerUtils.log_token_info(entry, session)
            else:
                logger.error("Missing attributes: usage_metadata.prompt_token_count or usage_metadata.candidates_token_count is None")
                raise Exception('回應內容中有資料缺失，請聯繫系統相關人員。')
        except Exception as e:
            logger.error(f"GeminiDocumentsAgent unexcepted error, ex: {e}")
            # raise Exception('4001 無效的 API 請求')
            yield error_msg('發生錯誤，若有問題請聯繫管理員。')

    def upload_files_not_stream(self,
                *,
                model_list_id: int,
                model: str = "gemini-2.0-flash-lite",
                user: User,
                user_input: str,
                message_data,
                chat_uuid: str,
                session):
        try:
            files = []
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
                    files.append(self.client.files.upload(file=temp_path))
                    # 清理臨時文件
                    os.remove(temp_path)
                else:
                    logger.error(f"Invalid file object: {file_storage}")
                    raise ValueError("無效的文件對象")

            system_prompt = "沒特別說明的話，請用繁體中文回答"
            response = self.client.models.generate_content(
                model=model,
                contents=[files, user_input],
                config=types.GenerateContentConfig(
                    candidate_count=1,
                    max_output_tokens=8192,
                    temperature=0,
                    frequency_penalty=0,
                    top_p=1,
                    system_instruction=system_prompt
                )
            )
            missing_attributes, candidate_obj, usage_metadata = self.check_response_attributes(response)
            if not missing_attributes and usage_metadata is not None and candidate_obj is not None:
                entry = ModelTokenLogEntry(
                    model_list_id=model_list_id,
                    model=model,
                    users_id=user.uid,
                    classify="non-streaming",
                    user_input=user_input,
                    expert_model_type=3,
                    chat_uuid=chat_uuid,
                    prompt_token=usage_metadata.prompt_token_count,
                    completion_token=usage_metadata.candidates_token_count)
                LoggerUtils.log_token_info(entry, session)
                res_dict = {
                    "response": candidate_obj.content.parts[0].text,
                    "prompt_token": usage_metadata.prompt_token_count,
                    "completion_token": usage_metadata.candidates_token_count,
                    "total_token": usage_metadata.total_token_count
                }
                return {"code": 200, "response": res_dict}
            elif missing_attributes and missing_attributes == ["finish_reason"] and candidate_obj is not None:
                finish_reason = candidate_obj.finish_reason
                error_text = self.get_error_message(finish_reason)
                logger.error(f"Finish reason: {finish_reason} - {error_text}")
                return {"code": 400, "error": error_text}
            else:
                error_message = f"回應內容中有資料缺失，請稍後再試或聯繫系統相關人員。"
                return {"code": 400, "error": error_message}          
        except (ServerError) as ex:
            logger.error(f"GeminiDocumentsAgent server error, ex: {ex}")
            return {"code": 500, "error": "2001 語言模型伺服器錯誤"}
        except Exception as ex:
            logger.error(f"GeminiDocumentsAgent unexcepted error, ex: {ex}")
            return {"code": 500, "error": "4001 無效的 API 請求"}

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
            return GeminiHandler.log_and_return("response.candidates"), None, None

        # response.candidates[0].content.parts[0].text
        candidate_0 = candidates[0]
        content = getattr(candidate_0, "content", None)
        if not content:
            return GeminiHandler.log_and_return("response.candidates[0].content"), None, None
        parts = getattr(content, "parts", None)
        if not isinstance(parts, list) or not parts:
            return GeminiHandler.log_and_return("response.candidates[0].content.parts"), None, None
        text = getattr(parts[0], "text", None)
        if text is None:
            return GeminiHandler.log_and_return("response.candidates[0].content.parts[0].text"), None, None

        # response.candidates[0].finish_reason
        finish_reason = getattr(candidate_0, "finish_reason", None)
        if finish_reason not in [None, types.FinishReason.STOP]:
            return ["finish_reason"], candidate_0, None

        # response.usage_metadata
        usage_metadata = getattr(response, "usage_metadata", None)
        if usage_metadata is None:
            return GeminiHandler.log_and_return("response.usage_metadata"), candidate_0, None
        if not all(hasattr(usage_metadata, attr) for attr in ('prompt_token_count', 'candidates_token_count')):
            return GeminiHandler.log_and_return("response.usage_metadata.prompt_token_count or response.usage_metadata.candidates_token_count"), candidate_0, None

        return [], candidate_0, usage_metadata

    @staticmethod
    def convert_message_to_gemini_format(message):
        if isinstance(message["content"], str):
            return [{"role": message["role"], "parts": [{"text": message["content"]}]}]
        parts = []
        for item in message["content"]:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append({"text": item["text"]})
                elif item.get("type") == "image_url":
                    url = item["image_url"]["url"]
                    if url.startswith("data:image/"):
                        mime_type = url.split(";")[0].split(":")[1]
                        base64_data = url.split(",")[1]
                        parts.append({
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64_data
                            }
                        })
                    else:
                        raise ValueError("不支援非 base64 的 image_url，請使用 data:image/... 格式")
                else:
                    raise ValueError(f"未知的 type: {item.get('type')}")
            else:
                raise ValueError(f"無法解析的內容型別: {type(item)}, 值: {item}")

        return [{"role": message["role"], "parts": parts}]
