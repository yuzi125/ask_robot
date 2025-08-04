from .base import BaseLLMService


class OpenAILLMService(BaseLLMService):

    def generate(self, **kwargs) -> str:
        ...
