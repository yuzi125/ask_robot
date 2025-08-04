from .base import BaseLLMService


class AzureOpenAILLMService(BaseLLMService):

    def generate(self, **kwargs) -> str:
        ...
