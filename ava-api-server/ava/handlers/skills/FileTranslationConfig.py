from pydantic import BaseModel


class FileTranslationConfig(BaseModel):
    description: str
    examples: list[str]
    intention: str
