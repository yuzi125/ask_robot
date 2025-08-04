import base64
import logging
import os
import re
import shutil
import wave
from typing import Any, Generator

import tiktoken
from ava.clients.sql.crud import (insert_embedding_token_log,
                                  insert_expert_embedding_token_log,
                                  insert_model_token_log,
                                  select_model_token_rate_from_id,
                                  insert_ocr_documents_token_log)
from ava.clients.sql.database import Session
from ava.clients.sql.schema import (EmbeddingTokenLog_Schema,
                                    ExpertEmbeddingTokenLog_Schema,
                                    ModelList_Schema, ModelTokenLog_Schema,
                                    OcrDocumentsTokenLog_Schema)
from ava.model.dscom import User
from ava.model.EmbeddingTokenLogEntry import EmbeddingTokenLogEntry
from ava.model.ExpertEmbeddingTokenLogEntry import ExpertEmbeddingTokenLogEntry
from ava.model.ModelTokenLogEntry import ModelTokenLogEntry
from ava.model.OcrDocumentsTokenLogEntry import OcrDocumentsTokenLogEntry
from ava.utils import env_utils
from dotenv import load_dotenv
from openai import OpenAI
from pyDes import ECB, PAD_PKCS5, des
from sqlalchemy import select

load_dotenv(override=False)

client = OpenAI(api_key=env_utils.get_openai_key())

logger = logging.getLogger("ava_app")
token_logger = logging.getLogger("token_counter")

intent_classifier_pattern = re.compile(r"\b(Category: \d)")


def set_key(key, value):
    os.environ[key] = value
    with open(".env.new", "w") as f:
        for k, v in os.environ.items():
            f.write(f"{k}={v}\n")
    shutil.move(".env.new", ".env")


def get_key(key):
    return os.getenv(key)


def get_embeddings_openai(text):
    try:
        response = client.embeddings.create(input=text,
                                            model="text-embedding-3-large")
        response = response["data"]  # type: ignore
        return [x["embedding"] for x in response]
    except Exception as e:
        logger.error(f"Error getting embeddings: {e}")
        return None


def num_tokens_from_messages(messages, model="gpt-3.5-turbo"):
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
    if model == "gpt-3.5-turbo":
        num_tokens = 0
        for message in messages:
            num_tokens += 4  # 每則訊息包含 <im_start>{role/name}\n{content}<im_end>\n
            for key, value in message.items():
                num_tokens += len(encoding.encode(value))
                if key == "name":
                    num_tokens += -1
        num_tokens += 2  # 每個回覆都以 <im_start>assistant 開始
        return num_tokens
    else:
        raise NotImplementedError(
            f"num_tokens_from_messages() 尚未為模型 {model} 實現。請參見 https://github.com/openai/openai-python/blob/main/chatml.md 以了解訊息如何轉換為標記。"
        )


def ensure_fit_tokens(messages):
    total_tokens = num_tokens_from_messages(messages)
    while total_tokens > 2048:
        removed_message = messages.pop(0)
        total_tokens = num_tokens_from_messages(messages)
    return messages


def decorate_header(user: User, headers):
    token = encrypt(user.userNo, env_utils.get_key("MY_SECRET_KEY"))
    headers["x-dscom-userId"] = token
    return headers


def encrypt(data, secret_key):
    assert secret_key is not None, "secret_key 為 None"
    if len(secret_key) > 8:
        secret_key = secret_key[:8]
    k = des(secret_key, ECB, padmode=PAD_PKCS5)
    en = k.encrypt(data, padmode=PAD_PKCS5)
    return base64.b64encode(en).decode()  # type: ignore


def split_chunks(data: list[Any], size: int) -> Generator[list[Any], Any, Any]:
    """簡單把 data 分成每組 size 的小列表"""
    for i in range(0, len(data), size):
        yield data[i:i + size]


def get_sound_duration(file_path):  # 'your_audio.wav'
    try:
        with wave.open(file_path, "rb") as audio_file:
            frame_rate = audio_file.getframerate()
            total_frames = audio_file.getnframes()
            audio_duration = total_frames / frame_rate
            cost = audio_duration / 60 * 0.006  # TODO 0.006 移動到配置檔案
        return f"{audio_duration:.2f} sec - ${cost:.8f}"
    except Exception as e:
        logger.error(f"Error getting sound duration: {e}")
        return None


class LoggerUtils:

    @staticmethod
    def get_rates_by_model(model_id: int, session: Session):
        if model_id == -1:
            return {"prompt_rate": 0, "completion_rate": 0}
        row: ModelList_Schema | None = select_model_token_rate_from_id(
            model_id=model_id, session=session)
        if row is not None:
            return {
                "prompt_rate": row.prompt_rate,
                "completion_rate": row.completion_rate
            }
        else:
            raise ValueError(f"模型版本 id:{model_id} 未支援")

    @staticmethod
    def get_rates_by_embedding_model(embedding_model_id: int, session: Session):
        stmt = select(ModelList_Schema).where(
            ModelList_Schema.id == embedding_model_id,
            ModelList_Schema.model_type == "embedding",
        )
        model = session.execute(stmt).scalars().first()
        
        if not model:
            raise ValueError(f"找不到 embedding 模型配置: {embedding_model_id}")
        
        embedding_model = model.model_name

        rates = {
            embedding_model: {
                "prompt_rate": model.prompt_rate,
                "completion_rate": model.completion_rate,
            }
        }

        if  model.prompt_rate is None or model.completion_rate is None:
            raise ValueError("prompt_rate 或 completion_rate 是空值！")
        
        if embedding_model in rates:
            return rates[embedding_model]
        else:
            raise ValueError(f"Embedding 模型 {embedding_model} 不支援")

    @staticmethod
    def calculate_fee(model_list_id, model, prompt: int, completion: int,
                      session: Session):
        rates = LoggerUtils.get_rates_by_model(model_list_id, session)
        prompt_rate = rates["prompt_rate"]
        completion_rate = rates["completion_rate"]
        return (prompt * prompt_rate + completion * completion_rate) / 1000

    @staticmethod
    def calculate_fee_embedding(model_id, prompt: int, completion: int, session: Session):
        rates = LoggerUtils.get_rates_by_embedding_model(model_id, session)
        prompt_rate = rates["prompt_rate"]
        completion_rate = rates["completion_rate"]
        return (prompt * prompt_rate + completion * completion_rate) / 1000

    @staticmethod
    def count_tokens_from_string(string: str) -> int:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(string))

    @staticmethod
    def token_from_text(prompt, completion, entry: ModelTokenLogEntry,
                        session: Session):
        token_logger.info(
            f"log_token_info prompt length:{len(prompt)} completion:{completion}"
        )
        entry.prompt_token = LoggerUtils.count_tokens_from_string(prompt)
        entry.completion_token = LoggerUtils.count_tokens_from_string(
            completion)
        entry.price = LoggerUtils.calculate_fee(entry.model_list_id,
                                                entry.model,
                                                entry.prompt_token,
                                                entry.completion_token,
                                                session)
        rates = LoggerUtils.get_rates_by_model(entry.model_list_id, session)
        entry.prompt_rate = rates["prompt_rate"]
        entry.completion_rate = rates["completion_rate"]
        token_logger.info(
            f"log_token_info {entry.users_id} - {entry.classify} - {entry.prompt_token} - {entry.completion_token} - ${entry.price:.7f} ${entry.price_currency}"
        )
        LoggerUtils.add_model_token_log(entry, session)

    @staticmethod
    def token_from_embedding(prompt, entry: EmbeddingTokenLogEntry,
                             session: Session):
        
        entry.prompt_token = LoggerUtils.count_tokens_from_string(prompt)
        entry.price = LoggerUtils.calculate_fee_embedding(
            entry.model_id, entry.prompt_token, 0, session)
        
        if entry.model_id is None:
            raise ValueError("embedding_model_id 不能是 None")
        
        rates = LoggerUtils.get_rates_by_embedding_model(entry.model_id, session)
        entry.prompt_rate = rates["prompt_rate"]
        token_logger.info(
            f"token_from_embedding datasets:{entry.datasets_id} - {entry.prompt_token} - ${entry.price:.7f} ${entry.price_currency}"
        )
        LoggerUtils.add_embedding_token_log(entry, session)

    @staticmethod
    def token_from_expert_embedding(prompt,
                                    entry: ExpertEmbeddingTokenLogEntry,
                                    session: Session):
        entry.prompt_token = LoggerUtils.count_tokens_from_string(prompt)
        entry.price = LoggerUtils.calculate_fee_embedding(
            entry.model_id, entry.prompt_token, 0, session)
        
        if entry.model_id is None:
            raise ValueError("有花到錢但是跳掉了 embedding_model_id 不能是 None")
        
        rates = LoggerUtils.get_rates_by_embedding_model(entry.model_id, session)
        entry.prompt_rate = rates["prompt_rate"]
        token_logger.info(
            f"token_from_embedding expert:{entry.expert_id} - {entry.prompt_token} - ${entry.price:.7f} ${entry.price_currency}"
        )
        LoggerUtils.add_expert_embedding_token_log(entry, session)

    @staticmethod
    def log_token_info(entry: ModelTokenLogEntry, session: Session):
        rates = LoggerUtils.get_rates_by_model(entry.model_list_id, session)
        entry.prompt_rate = rates["prompt_rate"]
        entry.completion_rate = rates["completion_rate"]

        if entry.price is None or entry.price == -1:
            entry.price = LoggerUtils.calculate_fee(
                entry.model_list_id,
                entry.model,
                entry.prompt_token,  # type: ignore
                entry.completion_token,  # type: ignore
                session)

        token_logger.info(
            f"log_token_info {entry.prompt_token}, {entry.completion_token}")
        token_logger.info(
            f"log_token_info {entry.users_id} - {entry.classify} - {entry.prompt_token} - {entry.completion_token} - ${entry.price:.7f} ${entry.price_currency}"
        )

        LoggerUtils.add_model_token_log(entry, session)

    @staticmethod
    def token_langchain(entry: ModelTokenLogEntry, session: Session):
        entry.classify = "langchain"
        LoggerUtils.log_token_info(entry, session)

    @staticmethod
    def add_model_token_log(entry: ModelTokenLogEntry, session: Session):

        insert_model_token_log(row=ModelTokenLog_Schema(
            users_id=entry.users_id,
            model=entry.model,
            classify=entry.classify,
            prompt_token=entry.prompt_token,
            completion_token=entry.completion_token,
            user_input=entry.user_input,
            expert_id=entry.expert_id,
            expert_model=entry.expert_model,
            expert_model_type=entry.expert_model_type,
            prompt_rate=entry.prompt_rate,
            completion_rate=entry.completion_rate,
            price=entry.price,
            price_currency=entry.price_currency,
            chat_uuid=entry.chat_uuid,
            history_message_id=entry.history_message_id),
                               session=session)

    @staticmethod
    def add_embedding_token_log(entry: EmbeddingTokenLogEntry,
                                session: Session):
        # #過濾掉新增的model_id 因為原本沒有這一欄
        schema_fields = set(c.name for c in EmbeddingTokenLog_Schema.__table__.columns)
        filtered_data = {k: v for k, v in entry.__dict__.items() if k in schema_fields}

        insert_embedding_token_log(
            row=EmbeddingTokenLog_Schema(**filtered_data), session=session)

    @staticmethod
    def add_expert_embedding_token_log(entry: ExpertEmbeddingTokenLogEntry,
                                       session: Session):
        schema_fields = set(c.name for c in ExpertEmbeddingTokenLog_Schema.__table__.columns)
        filtered_data = {k: v for k, v in entry.__dict__.items() if k in schema_fields}

        insert_expert_embedding_token_log(
            row=ExpertEmbeddingTokenLog_Schema(**filtered_data),
            session=session)

    @staticmethod
    def ocr_documents_log_token_info(entry: OcrDocumentsTokenLogEntry, session: Session):
        rates = LoggerUtils.get_rates_by_model(entry.model_list_id, session)
        entry.prompt_rate = rates["prompt_rate"]
        entry.completion_rate = rates["completion_rate"]

        if entry.price is None or entry.price == -1:
            entry.price = LoggerUtils.calculate_fee(
                entry.model_list_id,
                entry.model,
                entry.prompt_token,  # type: ignore
                entry.completion_token,  # type: ignore
                session)

        token_logger.info(
            f"ocr_documents_log_token_info {entry.prompt_token}, {entry.completion_token}")
        token_logger.info(
            f"ocr_documents_log_token_info {entry.prompt_token} - {entry.completion_token} - ${entry.price:.7f} ${entry.price_currency}"
        )

        LoggerUtils.add_ocr_documents_token_log(entry, session)

    @staticmethod
    def add_ocr_documents_token_log(entry: OcrDocumentsTokenLogEntry,
                                   session: Session):
        filtered_data = {k: v for k, v in entry.__dict__.items() if k != "model_list_id"}
        insert_ocr_documents_token_log(
            row=OcrDocumentsTokenLog_Schema(**filtered_data),
            session=session
        )
