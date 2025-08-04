from .base import BaseLLMService


class AnthropicLLMService(BaseLLMService):

    def generate(self, **kwargs) -> str:
        ...
