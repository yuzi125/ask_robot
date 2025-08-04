from typing import Protocol

from pydantic import BaseModel

from .anthropic import AnthropicLLMService
from .azure_openai import AzureOpenAILLMService
from .openai import OpenAILLMService


class LLMCallingConfig(BaseModel):
    pass


class LLMService(Protocol):

    def __init__(self, model: str) -> None:
        super().__init__()

    def generate(self, **kwargs) -> str:
        ...


class BaseLLMService(LLMService):

    def __init__(self, model: str) -> None:
        self.model: str = model


class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            instance = super().__call__(*args, **kwargs)
            cls._instances[cls] = instance
        return cls._instances[cls]


class LLMFactory:
    _instances: dict[str, LLMService] = {}

    @staticmethod
    def get_llm_service(vendor: str, model: str) -> LLMService:
        key: str = f"{vendor}-{model}"
        if key not in LLMFactory._instances:
            if vendor == "openai":
                service = OpenAILLMService(model)
            elif vendor == "azure_openai":
                service = AzureOpenAILLMService(model)
            elif vendor == "anthropic":
                service = AnthropicLLMService(model)
            else:
                raise ValueError(f"Unknown vendor: {vendor}")

            LLMFactory._instances[key] = service

        return LLMFactory._instances[key]


class LLMServiceManager(metaclass=SingletonMeta):

    def __init__(self):
        self.factory = LLMFactory()

    def get_service(self, vendor: str, model: str) -> LLMService:
        return self.factory.get_llm_service(vendor, model)
