from ava.utils.utils import LoggerUtils
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from typing import Optional, TypeVar, Generic
from abc import ABC, abstractmethod

T = TypeVar('T')
# ======================= Entry interface =======================
class TokenLogEntryBuilder(ABC, Generic[T]):
    @property
    @abstractmethod
    def required_fields(self) -> list[str]:
        """
        回傳此 Builder 所需要的必要欄位清單。
        """
        pass

    def validate(self, context: dict):
        """
        驗證 context 是否包含必要欄位，缺少則丟錯。
        """
        missing = [field for field in self.required_fields if field not in context or context[field] is None]
        if missing:
            raise ValueError(f"缺少必要欄位: {', '.join(missing)}")

    @abstractmethod
    def build(self, context: dict) -> T:
        """
        根據 context 建立對應的 Entry 物件。
        """
        pass


# 實作：建立 ModelTokenLogEntry 的 Builder
class ModelTokenLogEntryBuilder(TokenLogEntryBuilder[ModelTokenLogEntry]):
    @property
    def required_fields(self) -> list[str]:
        return ["model",
                "model_list_id",
                "user_input",
                "classify",
                "prompt_token",
                "completion_token",
                "expert_model_type",
                "chat_uuid",
                ]

    def build(self, entry_dict: dict) -> ModelTokenLogEntry:
        expert_data = entry_dict.get("expert_data", {})
        entry_dict.setdefault("expert_id", expert_data.get("expert_id"))
        entry_dict.setdefault("expert_model", expert_data.get("expert_model"))
        entry_dict.setdefault("expert_model_type", expert_data.get("expert_model_type"))        
        self.validate(entry_dict)

        return ModelTokenLogEntry(
            users_id=entry_dict["user"].uid,
            model=entry_dict["model"],
            model_list_id=entry_dict["model_list_id"],
            classify=entry_dict.get("classify"),
            prompt_token=entry_dict.get("prompt_token"),
            completion_token=entry_dict.get("completion_token"),
            user_input=entry_dict["user_input"],
            expert_id=entry_dict.get("expert_id") or entry_dict.get("expert_data", {}).get("expert_id"),
            expert_model=entry_dict.get("expert_model") or entry_dict.get("expert_data", {}).get("expert_model"),
            expert_model_type=entry_dict.get("expert_model_type") or entry_dict.get("expert_data", {}).get("expert_model_type"),
            chat_uuid=entry_dict.get("chat_uuid"),
            history_message_id=entry_dict.get("history_message_id")
        )

# ↓↓↓ 今後有需要實作其他 Entry 方式，可以繼承 TokenLogEntryBuilder 並實作 build 方法 ↓↓↓


# ======================= Log interface =======================
class TokenLogStrategy(ABC):
    @abstractmethod
    def log(self, system_prompt: str, user_input: str, full_body: list[str], entry: object, session):
        pass


# 實作： LoggerUtils.log_token_info
class TokenInfoLogger(TokenLogStrategy):
    def log(self, system_prompt: str, user_input: str, full_body: list[str], entry: ModelTokenLogEntry, session):
        LoggerUtils.log_token_info(entry, session)

# 實作： LoggerUtils.token_from_text
class TokenFromTextLogger(TokenLogStrategy):
    def log(self, system_prompt: str, user_input: str, full_body: list[str], entry: ModelTokenLogEntry, session):
        prompt_text = system_prompt + user_input
        response_text = "".join(full_body)        
        LoggerUtils.token_from_text(prompt_text, response_text, entry, session)

# ↓↓↓ 今後有需要實作其他 log 方式，可以繼承 TokenLogStrategy 並實作 log 方法 ↓↓↓


# ======================= 組合兩者 ==========================
class TokenLogger:
    def __init__(self,
                 entry_builder: TokenLogEntryBuilder,
                 logger: Optional[TokenLogStrategy] = None,
                 session = None,
                 entry_dict: Optional[dict] = None):
        self.entry_builder = entry_builder
        self.logger = logger or TokenInfoLogger()
        self.session = session
        self.entry_dict = entry_dict or {}

    def log_tokens(self, system_prompt: str, user_input: str, full_body: list[str]):
        entry = self.entry_builder.build(self.entry_dict)
        self.logger.log(system_prompt, user_input, full_body, entry, self.session)
        return entry
