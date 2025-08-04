import logging
from typing import Any

import anthropic
from anthropic._exceptions import BadRequestError, RateLimitError
from anthropic.types.content_block_delta_event import ContentBlockDeltaEvent
from anthropic.types.content_block_start_event import ContentBlockStartEvent
from anthropic.types.content_block_stop_event import ContentBlockStopEvent
from anthropic.types.message import Message
from anthropic.types.message_delta_event import MessageDeltaEvent
from anthropic.types.message_start_event import MessageStartEvent
from anthropic.types.message_stop_event import MessageStopEvent
from ava.model.dscom import User
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from ava.utils.return_message_style import error_msg
from ava.utils.utils import LoggerUtils

logger = logging.getLogger("ava_app")


class ClaudeHandler:

    def __init__(self):
        self.client = anthropic.Anthropic(
        )  # default key : os.environ.get("ANTHROPIC_API_KEY")

    def run_model_not_stream(self,
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
                             model: str = "claude-3-haiku-20240307"):
        max_token: int = model_params.get("max_tokens", 1500)
        temperature: float = model_params.get("temperature", 0.5)
        top_p: float = model_params.get("top_p", 0.3)
        try:
            message: Message = self.client.messages.create(
                model=model,
                max_tokens=max_token,
                temperature=temperature,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": message_content
                }],
                top_p=top_p)
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
                prompt_token=message.usage.input_tokens,
                completion_token=message.usage.output_tokens)
            LoggerUtils.log_token_info(entry, session)
            if message.stop_reason == "end_turn":
                return "".join([c.text for c in message.content])
            elif message.stop_reason == "max_tokens":
                raise Exception(
                    error_msg("回應長度超過長度限制，無法繼續，請具體描述您的問題，讓ava更好的為您服務。"))
        except (BadRequestError, RateLimitError) as ex:
            logger.error(
                f"claude run_model ratelimit or badrequest error, ex: {ex}")
            raise ex
        except Exception as ex:
            logger.error(f"claude run_model unexcepted error, ex: {ex}")
            raise ex

    def run_model_stream(self,
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
                         model: str = "claude-3-haiku-20240307",
                         history_message_id: str | None = None):
        max_token: int = model_params.get("max_tokens", 1500)
        temperature: float = model_params.get("temperature", 0.5)
        top_p: float = model_params.get("top_p", 0.3)
        try:
            message: anthropic.Stream[
                MessageStartEvent | MessageDeltaEvent
                | MessageStopEvent | ContentBlockStartEvent
                | ContentBlockDeltaEvent
                | ContentBlockStopEvent] = self.client.messages.create(
                    model=model,
                    max_tokens=max_token,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[{
                        "role": "user",
                        "content": message_content
                    }],
                    top_p=top_p,
                    stream=True)
            context_messages = []
            for m in message:
                if isinstance(m, ContentBlockDeltaEvent):
                    yield m.delta.text
                    context_messages.append(m.delta.text)
            logger.info("".join(context_messages))
            entry = ModelTokenLogEntry(
                model_list_id=model_list_id,
                users_id=user.uid,
                model=model,
                user_input=user_input,
                classify="streaming",
                expert_id=expert_data["expert_id"],
                expert_model=expert_data["expert_model"],
                expert_model_type=expert_data["expert_model_type"],
                chat_uuid=chat_uuid,
                history_message_id=history_message_id
            )
            prompt_text: str = f"{system_prompt} {message_content}"
            LoggerUtils.token_from_text(prompt_text, "".join(context_messages),
                                        entry, session)
        except (BadRequestError, RateLimitError) as ex:
            logger.error(
                f"claude run_model_stream ratelimit or badrequest error, ex: {ex}"
            )
            raise ex
        except Exception as ex:
            logger.error(f"claude run_model_stream unexcepted error, ex: {ex}")
            raise ex
