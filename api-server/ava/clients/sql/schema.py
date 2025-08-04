from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (FLOAT, JSON, TIMESTAMP, BigInteger, Boolean, Date,
                        ForeignKey, Integer, LargeBinary, PrimaryKeyConstraint,
                        SmallInteger, String, UniqueConstraint)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (Mapped, declarative_base, mapped_column,
                            relationship)
from sqlalchemy.orm.decl_api import DeclarativeMeta
from sqlalchemy.sql import func

__all__: list[str] = [
    "Base", "Skill_Schema", "Dataset_Schema", "Crawler_Schema",
    "Expert_Schema", "ExpertDatasetMapping_Schema",
    "ExpertSkillMapping_Schema", "CrawlerDocumentsQA_Schema",
    "CrawlerDocuments_Schema", "CrawlerSynchronize_Schema",
    "BotMessage_Schema", "User_Schema", "UserRoom_Schema",
    "UserMessage_Schema", "RecommendCustom_Schema", "RecommendPreset_Schema",
    "Settings_Schema", "RecommendHistory_Schema", "ModelTokenLog_Schema",
    "ExpertUsersMapping_Schema", "DataSourceType_Schema", "DataSource_Schema",
    "EmbeddingTokenLog_Schema", "UploadDocuments_Schema",
    "UploadFolder_Schema", "CrawlerDocumentsQAExtra_Schema",
    "ParentChunks_Schema", "HistoryMessages_Schema",
    "FormConfiguration_Schema", "FormBindingAssociation_Schema",
    "LoginType_Schema", "ModelList_Schema", "CachedKnowledge_Schema",
    "HistoryCacheMapping", "CrawlerDocumentsContent_Schema",
    "DefaultPrompt_Schema", "ExpertEmbeddingTokenLog_Schema",
    "CrawlerDocumentsExtra_Schema", "MessageChunkMapping_Schema",
    "CrawlerAttachment_Schema", "CrawlerAttachmentSynchronize_Schema",
    "DocumentImageStore_Schema", "UserCompletionHistory_Schema",
    "TranslationTasks_Schema", "OcrDocumentsTokenLog_Schema"
]

Base: DeclarativeMeta = declarative_base()


class ParentChunks_Schema(Base):
    __tablename__ = 'parent_chunks'
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    page_content: Mapped[str] = mapped_column(String, nullable=True)
    meta_data: Mapped[dict] = mapped_column(JSONB, nullable=True)


class EmbeddingTokenLog_Schema(Base):
    __tablename__ = 'embedding_token_log'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_token: Mapped[int] = mapped_column(Integer, nullable=False)
    datasets_id: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_rate: Mapped[float] = mapped_column(FLOAT, nullable=False)
    price: Mapped[float] = mapped_column(FLOAT, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(50), nullable=False)


class UploadDocuments_Schema(Base):
    __tablename__ = 'upload_documents'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    originalname: Mapped[str] = mapped_column(String(255), nullable=False)
    separator: Mapped[str | None] = mapped_column(String(50), nullable=True)
    datasource_name: Mapped[str | None] = mapped_column(String(50),
                                                        nullable=True)
    datasource_url: Mapped[str | None] = mapped_column(String(255),
                                                       nullable=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    is_enable: Mapped[int] = mapped_column(Integer,
                                           nullable=False,
                                           server_default="1")
    training_state: Mapped[int] = mapped_column(Integer,
                                                nullable=False,
                                                server_default="0")
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    upload_folder_id: Mapped[str] = mapped_column(String(50), nullable=False)
    datasets_id: Mapped[str] = mapped_column(String(50), nullable=False)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)


class UploadFolder_Schema(Base):
    __tablename__ = 'upload_folder'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    datasource_id: Mapped[str] = mapped_column(String(50), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    name: Mapped[str] = mapped_column(String(255), nullable=True)


class DataSource_Schema(Base):
    __tablename__ = 'datasource'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    datasets_id: Mapped[str] = mapped_column(String(50), nullable=False)
    config_jsonb: Mapped[dict] = mapped_column(JSON)
    type: Mapped[str] = mapped_column(String(2), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    pass


class DataSourceType_Schema(Base):
    __tablename__ = 'datasource_type'

    id: Mapped[str] = mapped_column(String(2), primary_key=True)
    mark: Mapped[str] = mapped_column(String(50), nullable=True)
    name: Mapped[str] = mapped_column(String(50), nullable=True)


class ExpertUsersMapping_Schema(Base):
    __tablename__ = 'expert_users_mapping'

    expert_id: Mapped[str] = mapped_column(String(50),
                                           nullable=False,
                                           primary_key=True)
    users_id: Mapped[str] = mapped_column(String(50),
                                          nullable=False,
                                          primary_key=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())


class ModelTokenLog_Schema(Base):
    __tablename__ = 'model_token_log'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    users_id: Mapped[str] = mapped_column(String(50), nullable=True)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    classify: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_token: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_token: Mapped[int] = mapped_column(Integer, nullable=False)
    user_input: Mapped[str] = mapped_column(String, nullable=False)
    expert_id: Mapped[str] = mapped_column(String(50), nullable=True)
    expert_model: Mapped[str] = mapped_column(String(50), nullable=True)
    expert_model_type: Mapped[int] = mapped_column(SmallInteger,
                                                   nullable=False)
    prompt_rate: Mapped[float] = mapped_column(FLOAT, nullable=False)
    completion_rate: Mapped[float] = mapped_column(FLOAT, nullable=False)
    price: Mapped[float] = mapped_column(FLOAT, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(50), nullable=False)
    chat_uuid: Mapped[str] = mapped_column(String(50), nullable=False)
    history_message_id: Mapped[int] = mapped_column(Integer, nullable=True)


class RecommendHistory_Schema(Base):
    __tablename__ = 'recommend_history'

    users_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    text: Mapped[str] = mapped_column(String, nullable=False)
    time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                           nullable=False,
                                           server_default=func.now())
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    expert_id: Mapped[str] = mapped_column(String(50), nullable=False)


class Settings_Schema(Base):
    __tablename__ = 'settings'

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=True)


class RecommendPreset_Schema(Base):
    __tablename__ = 'recommend_preset'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    text: Mapped[str] = mapped_column(String(255), nullable=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    expert_id: Mapped[str] = mapped_column(String(50), nullable=False)


class RecommendCustom_Schema(Base):
    __tablename__ = 'recommend_custom'

    users_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    text: Mapped[str] = mapped_column(String, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    sort: Mapped[int] = mapped_column(Integer, nullable=False)
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class UserMessage_Schema(Base):
    __tablename__ = 'user_messages'

    room_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    from_uid: Mapped[str] = mapped_column(String(50), nullable=False)
    to_uid: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    message_type: Mapped[str] = mapped_column(String, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class UserRoom_Schema(Base):
    __tablename__ = 'user_rooms'

    room_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user1_uid: Mapped[str] = mapped_column(String(50), nullable=False)
    user2_uid: Mapped[str] = mapped_column(String(50), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())


class BotMessage_Schema(Base):
    __tablename__ = 'bot_messages'

    group_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    users_id: Mapped[str] = mapped_column(String(50), nullable=False)
    subject: Mapped[str] = mapped_column(String(50), nullable=False)
    chat: Mapped[list[dict]] = mapped_column(JSONB, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    context: Mapped[dict] = mapped_column(JSONB, nullable=True)
    expert_id: Mapped[str] = mapped_column(String(50), nullable=False)
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False)


class User_Schema(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar: Mapped[str] = mapped_column(String(1000), nullable=True)
    user_no: Mapped[str] = mapped_column(String(50), nullable=True)
    post_no: Mapped[str] = mapped_column(String(50), nullable=True)
    dep_no: Mapped[str] = mapped_column(String(50), nullable=True)
    id_type: Mapped[str] = mapped_column(String(50), nullable=True)
    comp_no: Mapped[str] = mapped_column(String(50), nullable=True)
    e_mail: Mapped[str] = mapped_column(String(100), nullable=True)
    sex: Mapped[str] = mapped_column(String(50), nullable=True)
    birthday: Mapped[str] = mapped_column(String(50), nullable=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    user_info: Mapped[dict] = mapped_column(JSON, nullable=True)


class Skill_Schema(Base):
    __tablename__ = 'skill'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    describe: Mapped[str] = mapped_column(String(1000), nullable=True)
    config_jsonb: Mapped[dict] = mapped_column(JSON, nullable=True)
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    class_: Mapped[str] = mapped_column(
        "class", String(255), nullable=False)  # Avoiding keyword conflict
    required_login_type: Mapped[list[int]] = mapped_column(JSON, nullable=True)
    is_enable: Mapped[int] = mapped_column(Integer,
                                           nullable=False,
                                           server_default="1")
    state: Mapped[int] = mapped_column(Integer,
                                       nullable=False,
                                       server_default="0")
    icon: Mapped[str] = mapped_column(String(1000), nullable=True)


class Dataset_Schema(Base):
    __tablename__ = 'datasets'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    describe: Mapped[str] = mapped_column(String(1000), nullable=True)
    config_jsonb: Mapped[dict] = mapped_column(JSON, nullable=True)
    folder_name: Mapped[str] = mapped_column(String(50),
                                             nullable=False,
                                             unique=True)
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    is_enable: Mapped[int] = mapped_column(Integer,
                                           nullable=False,
                                           server_default="1")
    state: Mapped[int] = mapped_column(Integer,
                                       nullable=False,
                                       server_default="0")
    icon: Mapped[str] = mapped_column(String(1000), nullable=True)


class Crawler_Schema(Base):
    __tablename__ = 'crawler'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    config_jsonb: Mapped[dict] = mapped_column(JSON, nullable=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    is_show: Mapped[int] = mapped_column(SmallInteger,
                                         nullable=False,
                                         server_default="1")
    domain: Mapped[str] = mapped_column(String(1000), nullable=True)
    title: Mapped[str] = mapped_column(String(255),
                                       nullable=False,
                                       server_default="1")


class Expert_Schema(Base):
    __tablename__ = 'expert'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    welcome: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar: Mapped[str] = mapped_column(String(1000), nullable=True)
    url: Mapped[str] = mapped_column(String(50), nullable=True)
    prompt: Mapped[str] = mapped_column(String(5000), nullable=True)
    config_jsonb: Mapped[dict] = mapped_column(JSON, nullable=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    is_enable: Mapped[int] = mapped_column(Integer,
                                           nullable=False,
                                           server_default="1")
    state: Mapped[int] = mapped_column(Integer,
                                       nullable=False,
                                       server_default="0")
    permission: Mapped[int] = mapped_column(SmallInteger,
                                            nullable=False,
                                            server_default="0")


class ExpertSkillMapping_Schema(Base):
    __tablename__ = 'expert_skill_mapping'

    expert_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    skill_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())


class ExpertDatasetMapping_Schema(Base):
    __tablename__ = 'expert_datasets_mapping'

    expert_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    datasets_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())


class CrawlerDocumentsQA_Schema(Base):
    __tablename__ = 'crawler_documents_qa'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    question_original: Mapped[str] = mapped_column(String, nullable=True)
    answer_original: Mapped[str] = mapped_column(String, nullable=True)
    question: Mapped[str] = mapped_column(String, nullable=True)
    answer: Mapped[str] = mapped_column(String, nullable=True)
    adorn: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    crawler_documents_id: Mapped[str] = mapped_column(
        String(50), ForeignKey('crawler_documents.id'), nullable=True)
    info: Mapped[dict] = mapped_column(JSON, nullable=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    is_enable: Mapped[int] = mapped_column(SmallInteger,
                                           nullable=False,
                                           server_default="1")
    crawler_id: Mapped[str] = mapped_column(String(50),
                                            ForeignKey('crawler.id'),
                                            nullable=True)
    hash: Mapped[str] = mapped_column(String(50), nullable=False)


class CrawlerDocuments_Schema(Base):
    __tablename__ = 'crawler_documents'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[datetime] = mapped_column(Date,
                                           nullable=False,
                                           server_default=func.current_date())
    is_enable: Mapped[int] = mapped_column(SmallInteger,
                                           nullable=False,
                                           server_default="1")
    training_state: Mapped[int] = mapped_column(Integer,
                                                nullable=False,
                                                server_default="0")
    crawler_synchronize_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('crawler_synchronize.id'), nullable=False)
    pass


class CrawlerSynchronize_Schema(Base):
    __tablename__ = 'crawler_synchronize'

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True
    )  # bigserial is represented by BigInteger, auto-increment is implied
    datasource_id: Mapped[str] = mapped_column(String(50), nullable=False)
    crawler_id: Mapped[str] = mapped_column(String(50), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    config_jsonb: Mapped[dict] = mapped_column(JSON)
    training_state: Mapped[int] = mapped_column(SmallInteger,
                                                nullable=False,
                                                server_default="0")
    pass


class CrawlerDocumentsQAExtra_Schema(Base):
    __tablename__ = "crawler_documents_qa_extra"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    datasets_id: Mapped[str] = mapped_column(String(50))
    crawler_documents_qa_id: Mapped[str] = mapped_column(String(50),
                                                         nullable=True)
    qa_data: Mapped[str] = mapped_column(String, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    crawler_id: Mapped[str] = mapped_column(String(50), nullable=False)


class HistoryMessages_Schema(Base):
    __tablename__ = 'history_messages'
    id: Mapped[int] = mapped_column(Integer,
                                    primary_key=True,
                                    autoincrement=True)
    input: Mapped[str] = mapped_column(String, comment="剛輸入時")
    output: Mapped[dict] = mapped_column(JSON, comment="返回給使用者時")
    users_id: Mapped[str] = mapped_column(String(50), comment="使用者id")
    no_answer: Mapped[bool] = mapped_column(Boolean,
                                            comment="是否沒答案",
                                            default=False)
    expert_id: Mapped[str] = mapped_column(String(50), comment="專家id")
    type: Mapped[int] = mapped_column(SmallInteger, comment="類型")
    link_level: Mapped[int] = mapped_column(Integer, nullable=False)
    model_params: Mapped[dict] = mapped_column(JSONB,
                                               nullable=False,
                                               default={},
                                               comment="模型使用的參數")
    model_name: Mapped[str] = mapped_column(String(50),
                                            nullable=False,
                                            comment="gpt-3.5-turbo")
    device: Mapped[str] = mapped_column(String(255),
                                        default=None,
                                        comment="設備資訊(browser, line)")
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  comment="建立時間")
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now(),
                                                  comment="更新時間")


class FormConfiguration_Schema(Base):
    __tablename__ = "form_configuration"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    form_name: Mapped[str] = mapped_column(String(255))
    form_description: Mapped[str] = mapped_column(String, nullable=True)
    is_enable: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    form_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class FormBindingAssociation_Schema(Base):
    __tablename__ = "form_binding_association"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    form_id: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_id: Mapped[str] = mapped_column(String(50), nullable=False)
    document_id: Mapped[str] = mapped_column(String(50), nullable=False)
    binding_type: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class LoginType_Schema(Base):
    __tablename__ = "login_type"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    type_name: Mapped[str] = mapped_column(String(50), nullable=False)
    type_value: Mapped[str] = mapped_column(String(50), nullable=True)
    is_enable: Mapped[int] = mapped_column(SmallInteger,
                                           nullable=False,
                                           server_default="1")
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP,
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class ModelList_Schema(Base):
    __tablename__ = 'model_list'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    vendor: Mapped[str] = mapped_column(String(255), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_rate: Mapped[float] = mapped_column(FLOAT, nullable=False)
    completion_rate: Mapped[float] = mapped_column(FLOAT, nullable=False)
    config: Mapped[dict] = mapped_column(JSON, nullable=True)
    is_enable: Mapped[int] = mapped_column(Integer, nullable=False)
    model_type: Mapped[str] = mapped_column(String(100), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    pass


class CachedKnowledge_Schema(Base):
    __tablename__: str = 'cached_knowledge'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    question: Mapped[str] = mapped_column(String, nullable=False)
    answer: Mapped[str] = mapped_column(String, nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_params: Mapped[dict] = mapped_column(JSONB, nullable=True)
    model_prompt: Mapped[str] = mapped_column(String, nullable=True)
    no_answer: Mapped[bool] = mapped_column(Boolean,
                                            comment="是否沒答案",
                                            default=False)
    expert_id: Mapped[str] = mapped_column(String(50), nullable=False)
    link_level: Mapped[int] = mapped_column(Integer, nullable=False)
    related_chunk_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    pass


class HistoryCacheMapping(Base):
    __tablename__: str = 'history_cache_mapping'
    __table_args__: tuple[PrimaryKeyConstraint] = (PrimaryKeyConstraint(
        'history_id', 'cache_id'), )

    history_id: Mapped[int] = mapped_column(Integer, nullable=False)
    cache_id: Mapped[str] = mapped_column(String(50), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    pass


class CrawlerDocumentsContent_Schema(Base):
    __tablename__: str = 'crawler_documents_content'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    text: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    html: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    crawler_documents_id: Mapped[str] = mapped_column(String(50),
                                                      nullable=False)
    crawler_synchronize_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('crawler_synchronize.id'), nullable=False)
    is_enable: Mapped[int] = mapped_column(SmallInteger,
                                           nullable=False,
                                           server_default="1")
    training_state: Mapped[int] = mapped_column(Integer,
                                                nullable=False,
                                                server_default="0")
    crawler_id: Mapped[str] = mapped_column(String(50), nullable=False)
    meta_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    hash: Mapped[str] = mapped_column(String(50), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    pass


class DefaultPrompt_Schema(Base):
    __tablename__ = 'default_prompt'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    describe: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    is_enable: Mapped[int] = mapped_column(Integer,
                                           nullable=False,
                                           server_default="1")
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
    pass


class ExpertEmbeddingTokenLog_Schema(Base):
    __tablename__ = 'expert_embedding_token_log'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_token: Mapped[int] = mapped_column(Integer, nullable=False)
    expert_id: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_rate: Mapped[float] = mapped_column(FLOAT, nullable=False)
    price: Mapped[float] = mapped_column(FLOAT, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(50),
                                                nullable=False,
                                                server_default="USD")
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    pass


class CrawlerDocumentsExtra_Schema(Base):
    __tablename__ = "crawler_documents_extra"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    crawler_documents_id: Mapped[str] = mapped_column(String(50),
                                                      nullable=False)
    extra_text: Mapped[str] = mapped_column(String, nullable=False)
    is_enable: Mapped[int] = mapped_column(SmallInteger,
                                           nullable=False,
                                           server_default="1")
    is_included_in_large_chunk: Mapped[int] = mapped_column(SmallInteger,
                                                            nullable=False,
                                                            server_default="0")
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class MessageChunkMapping_Schema(Base):
    __tablename__ = 'message_chunk_mapping'
    id: Mapped[int] = mapped_column(Integer,
                                    primary_key=True,
                                    autoincrement=True)
    dataset_id: Mapped[str] = mapped_column(String(50), nullable=False)
    message_id: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_id: Mapped[int] = mapped_column(Integer, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class CrawlerAttachment_Schema(Base):
    __tablename__ = 'crawler_attachment'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    crawler_synchronize_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('crawler_synchronize.id'), nullable=False)
    upload_folder_id: Mapped[str] = mapped_column(String(50), nullable=True)
    page_title: Mapped[str] = mapped_column(String, nullable=True)
    page_url: Mapped[str] = mapped_column(String, nullable=True)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    attachment_link_title: Mapped[str] = mapped_column(String, nullable=False)
    attachment_link_text: Mapped[str] = mapped_column(String, nullable=False)
    attachment_href: Mapped[str] = mapped_column(String, nullable=False)
    file_extension: Mapped[str] = mapped_column(String, nullable=False)
    file_mime_type: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=True)
    hash: Mapped[str] = mapped_column(String(50), nullable=False)
    is_enable: Mapped[int] = mapped_column(SmallInteger,
                                           nullable=False,
                                           server_default="1")
    training_state: Mapped[int] = mapped_column(SmallInteger,
                                                nullable=False,
                                                server_default="0")
    meta_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    parent_id: Mapped[str] = mapped_column(String(50), nullable=True)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class CrawlerAttachmentSynchronize_Schema(Base):
    __tablename__ = 'crawler_attachment_synchronize'

    id: Mapped[int] = mapped_column(BigInteger,
                                    primary_key=True,
                                    autoincrement=True)
    datasource_id: Mapped[str] = mapped_column(String(50), nullable=False)
    crawler_id: Mapped[str] = mapped_column(String(50), nullable=False)
    config_jsonb: Mapped[dict] = mapped_column(JSONB, nullable=True)
    training_state: Mapped[int] = mapped_column(SmallInteger,
                                                nullable=False,
                                                server_default="0")
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class DocumentImageStore_Schema(Base):
    __tablename__ = 'document_image_store'

    upload_document_id: Mapped[str] = mapped_column(String(50),
                                                    primary_key=True)
    image_uuid: Mapped[str] = mapped_column(String(50), primary_key=True)
    image_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    download_path: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class UserCompletionHistory_Schema(Base):
    __tablename__ = 'user_completion_history'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False)
    expert_id: Mapped[str] = mapped_column(String(50), nullable=False)
    user_input: Mapped[str] = mapped_column(String, nullable=False)
    expert_output: Mapped[str] = mapped_column(String, nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class OcrDocumentsTokenLog_Schema(Base):
    __tablename__ = 'ocr_documents_token_log'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    datasets_id: Mapped[str] = mapped_column(String(50), nullable=False)
    upload_document_id: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_token: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_token: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_rate: Mapped[float] = mapped_column(FLOAT, nullable=False)
    completion_rate: Mapped[float] = mapped_column(FLOAT, nullable=False)
    price: Mapped[float] = mapped_column(FLOAT, nullable=False) 
    price_currency: Mapped[str] = mapped_column(String(50), nullable=False)
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())


class TranslationTasks_Schema(Base):
    __tablename__ = 'translation_tasks'

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False)
    room_id: Mapped[str] = mapped_column(String(50), nullable=False)
    result_files: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_notified: Mapped[bool] = mapped_column(Boolean,
                                              nullable=False,
                                              server_default="false")
    history_message_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="pending",
        comment="任務狀態: pending, processing, completed, failed, error")
    message: Mapped[str] = mapped_column(String,
                                         nullable=True,
                                         comment="狀態相關訊息，如處理進度、完成資訊、錯誤原因等")
    create_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now())
    update_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True),
                                                  nullable=False,
                                                  server_default=func.now(),
                                                  onupdate=func.now())
