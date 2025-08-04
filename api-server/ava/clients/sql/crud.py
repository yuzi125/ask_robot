from datetime import datetime, timedelta, timezone
from enum import Enum
from logging import Logger, getLogger
from typing import Any, Iterator, Optional, Sequence, Tuple

from ava.clients.sql.database import *
from ava.clients.sql.schema import *
from sqlalchemy import (BinaryExpression, CursorResult, Delete, Exists, Select,
                        Subquery, Update, exists, func, or_)
from sqlalchemy.engine.result import Result
from sqlalchemy.engine.row import Row
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.orm.query import RowReturningQuery
from sqlalchemy.schema import Sequence as SqlSequence

logger: Logger = getLogger("db_connector")


def select_history_message_by_id(
        *, history_message_id: int,
        session: Session) -> HistoryMessages_Schema | None:
    stmt: Select = Select(HistoryMessages_Schema).where(
        HistoryMessages_Schema.id == history_message_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def update_history_message_answer_status(*, history_message_id: int,
                                         no_answer: bool,
                                         session: Session) -> None:
    try:
        stmt: Update = Update(HistoryMessages_Schema).where(
            HistoryMessages_Schema.id == history_message_id).values(
                no_answer=no_answer)
        session.execute(stmt)
    except Exception as ex:
        logger.exception("update history message answer error...", exc_info=ex)
        raise


def insert_cache_history(*, cache_id: str, history_id: int,
                         session: Session) -> None:
    try:
        row: HistoryCacheMapping = HistoryCacheMapping(cache_id=cache_id,
                                                       history_id=history_id)
        session.add(row)
    except Exception as ex:
        logger.exception("insert cache history error...", exc_info=ex)
        raise


def select_default_prompt_by_id(
        *, prompt_id: int, session: Session) -> DefaultPrompt_Schema | None:
    stmt: Select = Select(DefaultPrompt_Schema).where(
        DefaultPrompt_Schema.id == prompt_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def touch_cache_update_time(*, cache_row_id: str, session: Session) -> None:
    try:
        # 假更新，只為了觸發 onupdate 更新快取的 update_time，延長 TTL
        stmt: Update = Update(CachedKnowledge_Schema).where(
            CachedKnowledge_Schema.id == cache_row_id).values({})
        session.execute(stmt)
    except Exception as ex:
        logger.exception("touch cache update time error...", exc_info=ex)
        raise


def delete_by_related_chunks(*, chunk_ids_to_delete: list[str],
                             session: Session) -> Sequence[str]:
    try:
        subquery: Subquery = Select(
            func.jsonb_array_elements_text(
                CachedKnowledge_Schema.related_chunk_ids).label(
                    'chunks')).subquery()
        condition: BinaryExpression[bool] = subquery.c.chunks.in_(
            chunk_ids_to_delete)
        exists_condition: Exists = Select(1).where(condition).exists()
        select_stmt: Select = Select(
            CachedKnowledge_Schema.id).where(exists_condition)
        select_result: Result = session.execute(select_stmt)
        cache_ids: Sequence[str] = select_result.scalars().all()

        if cache_ids:
            stmt: Delete = Delete(CachedKnowledge_Schema).where(
                CachedKnowledge_Schema.id.in_(cache_ids))
            result: CursorResult[Any] = session.execute(stmt)
            logger.debug(
                f"delete cache by related chunks affected {result.rowcount}")
        else:
            logger.debug("No cache entries found to delete.")
        return cache_ids
    except Exception as ex:
        logger.exception("delete cache by related chunks error...",
                         exc_info=ex)
        raise


def insert_cached_knowledge(*, id: str, related_chunk_ids: list[str],
                            model_name: str, question: str, answer: str,
                            expert_id: str, model_params: dict[str, Any],
                            model_prompt: str, link_level: int,
                            no_answer: bool, session: Session) -> None:
    try:
        row: CachedKnowledge_Schema = CachedKnowledge_Schema(
            id=id,
            related_chunk_ids=related_chunk_ids,
            model_name=model_name,
            model_params=model_params,
            model_prompt=model_prompt,
            question=question,
            expert_id=expert_id,
            answer=answer,
            link_level=link_level,
            no_answer=no_answer)
        session.add(row)
    except Exception as ex:
        logger.exception("insert cached knowledge error...", exc_info=ex)
        raise


def select_cached_knowledge_from_ids_and_chunk_ids(
        *, cache_ids: list[str], chunk_ids: list[str],
        session: Session) -> Sequence[CachedKnowledge_Schema]:
    stmt: Select = Select(CachedKnowledge_Schema).where(
        CachedKnowledge_Schema.id.in_(cache_ids)).where(
            CachedKnowledge_Schema.related_chunk_ids == chunk_ids)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_cached_knowledge_from_id_and_model_and_params_and_level(
        *, cache_id: str, model_name: str, model_params: dict,
        model_prompt: str, link_level: int,
        session: Session) -> CachedKnowledge_Schema | None:
    stmt: Select = Select(CachedKnowledge_Schema).where(
        CachedKnowledge_Schema.id == cache_id).where(
            CachedKnowledge_Schema.link_level == link_level).where(
                CachedKnowledge_Schema.model_params == model_params).where(
                    CachedKnowledge_Schema.model_prompt == model_prompt).where(
                        CachedKnowledge_Schema.model_name == model_name)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_cached_knowledge_from_ids(
        *, cache_ids: list[str],
        session: Session) -> Sequence[CachedKnowledge_Schema]:
    stmt: Select = Select(CachedKnowledge_Schema).where(
        CachedKnowledge_Schema.id.in_(cache_ids))
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_model_token_rate_from_id(
        *, model_id: int, session: Session) -> ModelList_Schema | None:
    stmt: Select = Select(ModelList_Schema).where(
        ModelList_Schema.id == model_id).limit(1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_model_list_from_id(*, model_list_id: int,
                              session: Session) -> ModelList_Schema | None:
    stmt: Select = Select(ModelList_Schema).where(
        ModelList_Schema.id == model_list_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_form_binding_from_doc_id(
        *, doc_id: str,
        session: Session) -> FormBindingAssociation_Schema | None:
    stmt: Select = Select(FormBindingAssociation_Schema).where(
        FormBindingAssociation_Schema.document_id == doc_id).limit(1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_all_form_config(
        *, session: Session) -> Sequence[FormConfiguration_Schema]:
    stmt: Select = Select(FormConfiguration_Schema)\
                    .where(FormConfiguration_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_expert_dataset_mapping(
        *, expert_id: str,
        session: Session) -> Sequence[ExpertDatasetMapping_Schema]:
    stmt = Select(Dataset_Schema).join(
        ExpertDatasetMapping_Schema,
        Dataset_Schema.id == ExpertDatasetMapping_Schema.datasets_id).where(
            ExpertDatasetMapping_Schema.expert_id == expert_id,
            Dataset_Schema.is_enable == 1, Dataset_Schema.state == 0)
    result = session.execute(stmt).scalars().all()
    return result


def select_form_config_from_id(
        *, form_id: str,
        session: Session) -> Optional[FormConfiguration_Schema]:
    stmt: Select = Select(FormConfiguration_Schema).where(
        FormConfiguration_Schema.id == form_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def append_bot_message_chat(*, user_id: str, group_id: str,
                            chat: dict[str, Any], session: Session) -> None:
    """Append a new chat message to the bot message history.

    This function atomically appends a new chat message to the existing chat history
    for a specific user and group combination. It uses row-level locking to prevent
    concurrent modifications.

    Args:
        user_id: The ID of the user.
        group_id: The ID of the group.
        chat: The chat message to append.
        session: The database session.

    Raises:
        SQLAlchemyError: If there is any database related error.
    """
    try:
        with session.begin():
            # Lock the row for update to prevent concurrent modifications
            stmt: Select = Select(BotMessage_Schema).where(
                BotMessage_Schema.group_id == group_id,
                BotMessage_Schema.users_id == user_id).with_for_update()

            bot_message: BotMessage_Schema | None = session.execute(
                stmt).scalars().one_or_none()

            if bot_message:
                # Append new chat message to existing chat history
                new_chat: list = bot_message.chat + [chat]
                update_stmt: Update = Update(BotMessage_Schema).where(
                    BotMessage_Schema.group_id == group_id,
                    BotMessage_Schema.users_id == user_id).values(
                        chat=new_chat)
                session.execute(update_stmt)

    except SQLAlchemyError as ex:
        logger.exception("Failed to append bot message chat: %s", str(ex))
        raise


def select_bot_message_by_group_id_and_user_id(
        *, group_id: str, user_id: str,
        session: Session) -> BotMessage_Schema | None:

    try:
        stmt: Select = Select(BotMessage_Schema).where(
            BotMessage_Schema.group_id == group_id).where(
                BotMessage_Schema.users_id == user_id)
        result: Result = session.execute(stmt)
        return result.scalars().one_or_none()
    except Exception as ex:
        logger.exception("select bot message by group id and user id error...",
                         exc_info=ex)
        raise


def select_cache_knowledge_by_ids_and_model(
        *, cache_ids: list[str], model_name: str,
        session: Session) -> Sequence[CachedKnowledge_Schema]:
    stmt: Select = Select(CachedKnowledge_Schema).where(
        CachedKnowledge_Schema.id.in_(cache_ids)).where(
            CachedKnowledge_Schema.model_name == model_name)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_binding_dataset_by_expert(
        *, expert_id: str, session: Session) -> list[Row[tuple[str, dict]]]:
    query = session.query(
        DataSource_Schema.type, Dataset_Schema.config_jsonb).join(
            ExpertDatasetMapping_Schema,
            Dataset_Schema.id == ExpertDatasetMapping_Schema.datasets_id).join(
                DataSource_Schema,
                Dataset_Schema.id == DataSource_Schema.datasets_id).filter(
                    ExpertDatasetMapping_Schema.expert_id == expert_id).filter(
                        Dataset_Schema.is_enable == 1)
    results: list[Row[tuple[str, dict]]] = query.all()
    return results


def select_form_config_from_ids(
        *, form_ids: list[str],
        session: Session) -> Sequence[FormConfiguration_Schema]:
    stmt: Select = Select(FormConfiguration_Schema).where(
        FormConfiguration_Schema.id.in_(form_ids))
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_form_config_from_name(
        *, form_name: str,
        session: Session) -> FormConfiguration_Schema | None:
    stmt: Select = Select(FormConfiguration_Schema).where(
        FormConfiguration_Schema.form_name == form_name).where(
            FormConfiguration_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_expert_from_id(*, expert_id: str,
                          session: Session) -> Expert_Schema | None:
    stmt: Select = Select(Expert_Schema).where(Expert_Schema.id == expert_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def selet_all_enable_experts(*, session: Session) -> Sequence[Expert_Schema]:
    stmt: Select = Select(Expert_Schema).where(Expert_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_settings_from_key(*, key: str,
                             session: Session) -> Settings_Schema | None:
    stmt: Select = Select(Settings_Schema).where(Settings_Schema.key == key)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


class insert_history_message_type(Enum):
    ERROR = 0
    OK = 1
    SKILL = 2
    FORM = 3
    CACHE = 4
    NOANSWER = 9


def insert_history_message(
        *,
        history_message_id: int | None,
        input_message: str,
        output_message: str,
        users_id: str,
        expert_id: str,
        model_name: str,
        type: insert_history_message_type = insert_history_message_type.OK,
        link_level: int,
        model_params: dict[str, Any] = {},
        device: str | None = None,
        no_answer: bool = False,
        session: Session) -> int:

    try:
        row: HistoryMessages_Schema = HistoryMessages_Schema(
            id=history_message_id,
            input=input_message,
            output=output_message,
            users_id=users_id,
            expert_id=expert_id,
            type=type.value,
            no_answer=no_answer,
            model_name=model_name,
            link_level=link_level,
            model_params=model_params,
            device=device)
        session.add(row)
        session.flush()
        history_id: int = row.id
        return history_id
    except Exception as ex:
        logger.exception("insert history message error...", exc_info=ex)
        raise


def update_parent_chunks_metadata(*, node_id: int, metadata: dict,
                                  session: Session) -> None:
    try:
        stmt: Update = Update(ParentChunks_Schema).where(
            ParentChunks_Schema.id == node_id).values(meta_data=metadata)
        session.execute(stmt)
    except Exception as ex:
        logger.exception("update chromadb parent node error...", exc_info=ex)
        raise


def insert_parent_chunk(*, node_id: int, page_content: str, metadata: dict,
                        session: Session) -> None:
    try:
        row: ParentChunks_Schema = ParentChunks_Schema(
            id=node_id, page_content=page_content, meta_data=metadata)
        session.add(row)
    except Exception as ex:
        logger.exception("insert chromadb parent node error...", exc_info=ex)
        raise


def get_history_message_nextval(*, session: Session) -> int:
    stmt = func.next_value(SqlSequence('history_messages_id_seq'))
    result: Result = session.execute(stmt)
    return result.scalars().one()


def get_parent_chunks_nextval(*, session: Session) -> int:
    stmt = func.next_value(SqlSequence('parent_chunks_id_seq'))
    result: Result = session.execute(stmt)
    return result.scalars().one()


def update_chrmoa_parent_node(*, node_id: str, page_content: str,
                              metadata: dict, session: Session) -> None:
    stmt: Update = Update(ParentChunks_Schema)\
                    .where(ParentChunks_Schema.id == node_id) \
                    .values(page_content = page_content,metadata=metadata)
    session.execute(stmt)


def select_crawler_documents_extra_from_id(
        *, crawler_documents_extra_id: str,
        session: Session) -> CrawlerDocumentsExtra_Schema | None:
    stmt: Select = Select(CrawlerDocumentsExtra_Schema).where(
        CrawlerDocumentsExtra_Schema.id == crawler_documents_extra_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_crawler_documents_extra_from_crawler_document_id(
        *, crawler_document_id: str,
        session: Session) -> Sequence[CrawlerDocumentsExtra_Schema]:
    stmt: Select = Select(CrawlerDocumentsExtra_Schema).where(
        CrawlerDocumentsExtra_Schema.crawler_documents_id ==
        crawler_document_id)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_crawler_documents_extra_from_ids(
        *, crawler_documents_extra_ids: list[str],
        session: Session) -> Sequence[CrawlerDocumentsExtra_Schema]:
    stmt: Select = Select(CrawlerDocumentsExtra_Schema).where(
        CrawlerDocumentsExtra_Schema.id.in_(crawler_documents_extra_ids))
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_parent_chunk_from_id(*, node_id: int,
                                session: Session) -> ParentChunks_Schema:
    stmt: Select = Select(ParentChunks_Schema).where(
        ParentChunks_Schema.id == node_id)
    result: Result = session.execute(stmt)
    return result.scalars().one()


def select_parent_chunks_from_ids(
        node_ids: list[int],
        session: Session) -> Sequence[ParentChunks_Schema]:
    stmt = Select(ParentChunks_Schema).where(
        ParentChunks_Schema.id.in_(node_ids))
    result = session.execute(stmt)
    return result.scalars().all()


def update_parent_chunk_metadata(*, node_id: int, metadata: dict,
                                 session: Session) -> None:
    stmt: Update = Update(ParentChunks_Schema).where(
        ParentChunks_Schema.id == node_id).values(meta_data=metadata)
    session.execute(stmt)


def delete_parent_chunk(*, node_id: str, session: Session) -> None:
    stmt: Delete =Delete(ParentChunks_Schema)\
            .where(CrawlerDocumentsQAExtra_Schema.id == node_id)
    session.execute(stmt)


def insert_model_token_log(*, row: ModelTokenLog_Schema,
                           session: Session) -> None:
    try:
        session.add(row)
    except Exception as ex:
        logger.exception("insert model_token_log error...", exc_info=ex)
        raise


def insert_embedding_token_log(*, row: EmbeddingTokenLog_Schema,
                               session: Session) -> None:
    try:
        session.add(row)
    except Exception as ex:
        logger.exception("insert embedding token log error...", exc_info=ex)
        raise


def insert_message_chunk_mapping(*, row: MessageChunkMapping_Schema,
                                 session: Session) -> None:
    try:
        session.add(row)
    except Exception as ex:
        logger.exception("insert message chunk mapping error...", exc_info=ex)
        raise


def insert_expert_embedding_token_log(*, row: ExpertEmbeddingTokenLog_Schema,
                                      session: Session) -> None:
    try:
        session.add(row)
    except Exception as ex:
        logger.exception("insert expert embedding token log error...",
                         exc_info=ex)
        raise


def delete_extra_qa(*, extra_qa_id: str, session: Session) -> None:
    stmt: Delete =Delete(CrawlerDocumentsQAExtra_Schema)\
            .where(CrawlerDocumentsQAExtra_Schema.id == extra_qa_id)
    session.execute(stmt)


def update_extra_qa(*, extra_qa_id: str, new_qa_data: str,
                    session: Session) -> None:
    stmt: Update = Update(CrawlerDocumentsQAExtra_Schema)\
                    .where(CrawlerDocumentsQAExtra_Schema.id == extra_qa_id) \
                    .values(qa_data =new_qa_data)
    session.execute(stmt)


def select_all_expert_id(*, session: Session) -> Sequence[str]:
    stmt: Select = Select(Expert_Schema.id)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_crawler_document_content_by_id(
        *, crawler_document_id: str,
        session: Session) -> CrawlerDocumentsContent_Schema | None:
    stmt: Select = Select(CrawlerDocumentsContent_Schema)\
        .where(CrawlerDocumentsContent_Schema.id == crawler_document_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_crawler_contents_by_doc_id(
        *, crawler_document_id: str,
        session: Session) -> Iterator[CrawlerDocumentsContent_Schema]:
    offset = 0
    limit = 100

    while True:
        stmt = (Select(CrawlerDocumentsContent_Schema).where(
            CrawlerDocumentsContent_Schema.crawler_documents_id ==
            crawler_document_id).order_by(
                CrawlerDocumentsContent_Schema.id).offset(offset).limit(limit))

        result = session.execute(stmt)

        rows = result.scalars().all()
        if not rows:
            break

        for row in rows:
            yield row

        offset += limit


def select_crawler_by_id(*, crawler_id: str,
                         session: Session) -> Crawler_Schema | None:
    stmt: Select = Select(Crawler_Schema).where(
        Crawler_Schema.id == crawler_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_crawler_attachment_by_sync_id(
        *, crawler_attachment_synchronize_id: int,
        session: Session) -> Iterator[CrawlerAttachment_Schema]:
    offset = 0
    limit = 100

    while True:
        stmt = (Select(CrawlerAttachment_Schema).where(
            CrawlerAttachment_Schema.crawler_synchronize_id ==
            crawler_attachment_synchronize_id).order_by(
                CrawlerAttachment_Schema.id).offset(offset).limit(limit))
        result = session.execute(stmt)
        rows = result.scalars().all()
        if not rows:
            break

        for row in rows:
            yield row
        offset += limit


def select_crawler_documents_by_sync_id(
        *, crawler_synchronize_id: int,
        session: Session) -> Iterator[CrawlerDocuments_Schema]:
    offset = 0
    limit = 100

    while True:
        stmt = (Select(CrawlerDocuments_Schema).join(
            CrawlerSynchronize_Schema,
            CrawlerDocuments_Schema.crawler_synchronize_id ==
            CrawlerSynchronize_Schema.id).where(
                CrawlerSynchronize_Schema.id ==
                crawler_synchronize_id).order_by(
                    CrawlerDocuments_Schema.id).offset(offset).limit(limit))

        result = session.execute(stmt)

        rows = result.scalars().all()
        if not rows:
            break

        for row in rows:
            yield row
        offset += limit


def select_dataset_from_sync_id(*, crawler_synchronize_id: int,
                                session: Session) -> Dataset_Schema | None:
    stmt: Select = Select(Dataset_Schema)\
        .join(DataSource_Schema, Dataset_Schema.id == DataSource_Schema.datasets_id)\
        .join(CrawlerSynchronize_Schema, DataSource_Schema.id == CrawlerSynchronize_Schema.datasource_id)\
        .where(CrawlerSynchronize_Schema.id == crawler_synchronize_id)\
        .where(Dataset_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def update_crawler_synchronize_state(*, crawler_synchronize_id: int,
                                     state: int, session: Session) -> None:
    stmt: Update = Update(CrawlerSynchronize_Schema)\
                    .where(CrawlerSynchronize_Schema.id == crawler_synchronize_id) \
                    .values(training_state = state)
    session.execute(stmt)


def select_dataset_from_attachment_sync_id(
        *, crawler_attachment_synchronize_id: int,
        session: Session) -> Dataset_Schema | None:
    stmt: Select = Select(Dataset_Schema)\
        .join(DataSource_Schema, Dataset_Schema.id == DataSource_Schema.datasets_id)\
        .join(CrawlerAttachmentSynchronize_Schema, DataSource_Schema.id == CrawlerAttachmentSynchronize_Schema.datasource_id)\
        .where(CrawlerAttachmentSynchronize_Schema.id == crawler_attachment_synchronize_id)\
        .where(Dataset_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_not_finished_crawler_attachment_sync_tasks(
        *, session: Session) -> Sequence[int]:
    time_threshold = datetime.now(timezone.utc) - timedelta(seconds=70)

    subquery = (Select(1).where(CrawlerAttachment_Schema.crawler_synchronize_id
                                == CrawlerAttachmentSynchronize_Schema.id).
                correlate(CrawlerAttachmentSynchronize_Schema))

    stmt = (Select(CrawlerAttachmentSynchronize_Schema.id).where(
        (CrawlerAttachmentSynchronize_Schema.training_state == 2)
        & exists(subquery)
        & (CrawlerAttachmentSynchronize_Schema.update_time < time_threshold)))

    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_not_finished_crawler_sync_tasks(*,
                                           session: Session) -> Sequence[int]:
    time_threshold = datetime.now(timezone.utc) - timedelta(seconds=70)

    subquery = (Select(1).where(
        CrawlerDocuments_Schema.crawler_synchronize_id ==
        CrawlerSynchronize_Schema.id).correlate(CrawlerSynchronize_Schema))

    stmt = (Select(CrawlerSynchronize_Schema.id).where(
        (CrawlerSynchronize_Schema.training_state == 2)
        & exists(subquery)
        & (CrawlerSynchronize_Schema.update_time < time_threshold)))

    result: Result = session.execute(stmt)
    return result.scalars().all()


def find_stale_crawler_attachment_task(
        *, session: Session) -> Sequence[CrawlerAttachment_Schema]:
    cutoff_time: datetime = datetime.now(timezone.utc) - timedelta(minutes=15)
    stmt = Select(CrawlerAttachment_Schema).where(
        CrawlerAttachment_Schema.training_state == 7,
        CrawlerAttachment_Schema.update_time < cutoff_time)

    result = session.execute(stmt).scalars().all()
    return result


def find_stale_crawler_content_task(
        *, session: Session) -> Sequence[CrawlerDocumentsContent_Schema]:
    cutoff_time: datetime = datetime.now(timezone.utc) - timedelta(minutes=15)
    stmt = Select(CrawlerDocumentsContent_Schema).where(
        CrawlerDocumentsContent_Schema.training_state == 7,
        CrawlerDocumentsContent_Schema.update_time < cutoff_time)

    result = session.execute(stmt).scalars().all()
    return result


def find_stale_knowledge_task(
        *, session: Session) -> Sequence[UploadDocuments_Schema]:
    cutoff_time: datetime = datetime.now(timezone.utc) - timedelta(minutes=15)
    stmt = Select(UploadDocuments_Schema).where(
        UploadDocuments_Schema.training_state == 7,
        UploadDocuments_Schema.update_time < cutoff_time)

    result = session.execute(stmt).scalars().all()
    return result


def check_and_update_crawler_attachment_status(
        *, crawler_attachment_synchronize_id: int, session: Session) -> None:
    crawler_attachment_sync_exists = session.execute(
        Select(CrawlerAttachmentSynchronize_Schema.id).where(
            CrawlerAttachmentSynchronize_Schema.id ==
            crawler_attachment_synchronize_id)).scalar_one_or_none()

    if not crawler_attachment_sync_exists:
        logger.error(
            f"The synchronize id:{crawler_attachment_synchronize_id} does not exist."
        )
        return

    crawler_attachment_sync: CrawlerAttachmentSynchronize_Schema | None = session.execute(
        Select(CrawlerAttachmentSynchronize_Schema).where(
            CrawlerAttachmentSynchronize_Schema.id ==
            crawler_attachment_synchronize_id).with_for_update(
                skip_locked=True)).scalar_one_or_none()

    if not crawler_attachment_sync:
        return

    batch_size = 1000
    offset = 0
    has_doc_with_status_99 = False
    all_docs_completed = True

    while True:
        stmt_docs = Select(CrawlerAttachment_Schema).where(
            CrawlerAttachment_Schema.crawler_synchronize_id ==
            crawler_attachment_synchronize_id).order_by(
                CrawlerAttachment_Schema.id).offset(offset).limit(batch_size)

        docs: Sequence[CrawlerAttachment_Schema] = session.execute(
            stmt_docs).scalars().all()

        if not docs:
            break

        doc_id_to_doc_map: dict[str, CrawlerAttachment_Schema] = {}

        for doc in docs:
            doc_id_to_doc_map[doc.id] = doc
            if doc.training_state in [97, 98, 99]:
                has_doc_with_status_99 = True
                all_docs_completed = False
                break
            elif doc.training_state != 3 and doc.training_state not in [
                    4, 5, 6
            ]:
                all_docs_completed = False

        if has_doc_with_status_99:
            if crawler_attachment_sync.training_state != 99:
                crawler_attachment_sync.training_state = 99
                session.add(crawler_attachment_sync)
            break

        offset += batch_size

    if all_docs_completed:
        if crawler_attachment_sync.training_state != 3:
            crawler_attachment_sync.training_state = 3
            session.add(crawler_attachment_sync)


def check_and_update_crawler_status(*, crawler_synchronize_id: int,
                                    session: Session) -> None:
    crawler_sync_exists = session.execute(
        Select(CrawlerSynchronize_Schema.id).where(
            CrawlerSynchronize_Schema.id ==
            crawler_synchronize_id)).scalar_one_or_none()

    if not crawler_sync_exists:
        logger.error(
            f"The synchronize id:{crawler_synchronize_id} does not exist.")
        return

    crawler_sync: CrawlerSynchronize_Schema | None = session.execute(
        Select(CrawlerSynchronize_Schema).where(
            CrawlerSynchronize_Schema.id == crawler_synchronize_id).
        with_for_update(skip_locked=True)).scalar_one_or_none()

    if not crawler_sync:
        return

    batch_size = 1000
    offset = 0
    has_doc_with_status_99 = False
    all_docs_completed = True

    while True:
        stmt_docs = Select(CrawlerDocuments_Schema).where(
            CrawlerDocuments_Schema.crawler_synchronize_id ==
            crawler_synchronize_id).order_by(
                CrawlerDocuments_Schema.id).offset(offset).limit(batch_size)

        docs: Sequence[CrawlerDocuments_Schema] = session.execute(
            stmt_docs).scalars().all()

        if not docs:
            break

        doc_ids_to_check = []
        doc_id_to_doc_map: dict[str, CrawlerDocuments_Schema] = {}

        for doc in docs:
            doc_id_to_doc_map[doc.id] = doc
            if doc.training_state in [97, 98, 99]:
                has_doc_with_status_99 = True
                all_docs_completed = False
                break
            elif doc.training_state != 3 and doc.training_state not in [
                    4, 5, 6
            ]:
                all_docs_completed = False
                doc_ids_to_check.append(doc.id)

        if has_doc_with_status_99:
            if crawler_sync.training_state != 99:
                crawler_sync.training_state = 99
                session.add(crawler_sync)
            break

        if doc_ids_to_check:
            stmt_incomplete_contents = Select(
                CrawlerDocumentsContent_Schema.crawler_documents_id).where(
                    CrawlerDocumentsContent_Schema.crawler_documents_id.in_(
                        doc_ids_to_check),
                    CrawlerDocumentsContent_Schema.training_state
                    != 3).group_by(
                        CrawlerDocumentsContent_Schema.crawler_documents_id)
            incomplete_doc_ids = set(
                session.execute(stmt_incomplete_contents).scalars().all())

            for doc_id in doc_ids_to_check:
                if doc_id not in incomplete_doc_ids:
                    doc = doc_id_to_doc_map[doc_id]
                    doc.training_state = 3
                    session.add(doc)

        offset += batch_size

    if not has_doc_with_status_99 and all_docs_completed:
        if crawler_sync.training_state != 3:
            crawler_sync.training_state = 3
            session.add(crawler_sync)


def select_and_lock_crawler_attachment_tasks(
        *, crawler_attachment_sync_id: int, limit: int,
        session: Session) -> Sequence[tuple[CrawlerAttachment_Schema]]:
    subquery = (Select(CrawlerAttachment_Schema.id).join(
        CrawlerAttachmentSynchronize_Schema,
        CrawlerAttachment_Schema.crawler_synchronize_id ==
        CrawlerAttachmentSynchronize_Schema.id).where(
            CrawlerAttachmentSynchronize_Schema.id ==
            crawler_attachment_sync_id).where(
                CrawlerAttachment_Schema.training_state == 2).where(
                    CrawlerAttachment_Schema.is_enable == 1).where(
                        CrawlerAttachment_Schema.file_extension ==
                        "pdf").limit(limit).with_for_update(skip_locked=True))
    stmt = (Update(CrawlerAttachment_Schema).where(
        CrawlerAttachment_Schema.id.in_(subquery)).values(
            training_state=7).returning(CrawlerAttachment_Schema))

    result = session.execute(stmt).fetchall()
    return result  # type: ignore


def select_and_lock_crawler_content_tasks(
        *, crawler_sync_id: int, limit: int,
        session: Session) -> Sequence[tuple[CrawlerDocumentsContent_Schema]]:
    subquery = (Select(CrawlerDocumentsContent_Schema.id).join(
        CrawlerSynchronize_Schema,
        CrawlerDocumentsContent_Schema.crawler_synchronize_id ==
        CrawlerSynchronize_Schema.id).where(
            CrawlerSynchronize_Schema.id == crawler_sync_id).where(
                CrawlerDocumentsContent_Schema.training_state == 2).where(
                    CrawlerDocumentsContent_Schema.is_enable == 1).limit(
                        limit).with_for_update(skip_locked=True))

    stmt = (Update(CrawlerDocumentsContent_Schema).where(
        CrawlerDocumentsContent_Schema.id.in_(subquery)).values(
            training_state=7).returning(CrawlerDocumentsContent_Schema))

    result = session.execute(stmt).fetchall()
    return result  #type: ignore


def select_and_lock_knowledge_tasks(
        *, limit: int,
        session: Session) -> Sequence[tuple[UploadDocuments_Schema]]:
    five_seconds_ago = func.now() - timedelta(seconds=5)

    subquery = (Select(UploadDocuments_Schema.id).join(
        Dataset_Schema,
        UploadDocuments_Schema.datasets_id == Dataset_Schema.id).where(
            Dataset_Schema.is_enable == 1).where(
                UploadDocuments_Schema.is_enable == 1).where(
                    UploadDocuments_Schema.training_state == 2).where(
                        UploadDocuments_Schema.create_time <= five_seconds_ago
                    ).limit(limit).with_for_update(skip_locked=True))

    stmt = (Update(UploadDocuments_Schema).where(
        UploadDocuments_Schema.id.in_(subquery)).values(
            training_state=7).returning(UploadDocuments_Schema))

    result = session.execute(stmt).fetchall()
    return result  # type: ignore


def select_not_finished_knowledge_indexing_tasks(
        *, session: Session) -> Sequence[UploadDocuments_Schema]:
    stmt: Select = Select(UploadDocuments_Schema).where(
        UploadDocuments_Schema.training_state == 2)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_crawler_attachment_by_id(
        *, crawler_attachment_id: str,
        session: Session) -> CrawlerAttachment_Schema | None:
    try:
        stmt: Select = Select(CrawlerAttachment_Schema).where(
            CrawlerAttachment_Schema.id == crawler_attachment_id)
        result: Result = session.execute(stmt)
        return result.scalars().one_or_none()
    except Exception as ex:
        logger.error(f"Error on select_crawler_attachment_content_by_id: {ex}")
        raise


def update_crawler_attachment_synchronize_state_by_id(
        *, crawler_attachment_synchronize_id: int, state: int,
        session: Session) -> None:
    stmt: Update = Update(CrawlerAttachmentSynchronize_Schema)\
                    .where(CrawlerAttachmentSynchronize_Schema.id == crawler_attachment_synchronize_id) \
                    .values(training_state = state)
    session.execute(stmt)


def select_crawler_attachment_synchronize_by_id(
        *, crawler_attachment_synchronize_id: int,
        session: Session) -> CrawlerAttachmentSynchronize_Schema | None:
    try:
        stmt: Select = Select(CrawlerAttachmentSynchronize_Schema).where(
            CrawlerAttachmentSynchronize_Schema.id ==
            crawler_attachment_synchronize_id)
        result: Result = session.execute(stmt)
        return result.scalars().one_or_none()
    except Exception as ex:
        logger.error(
            f"Error on select_crawler_attachment_synchronize_by_id: {ex}")
        raise


def update_crawler_attachment_state_by_id(*, crawler_attachment_id: str,
                                          state: int,
                                          session: Session) -> None:
    stmt: Update = Update(CrawlerAttachment_Schema)\
                    .where(CrawlerAttachment_Schema.id == crawler_attachment_id) \
                    .values(training_state = state)
    session.execute(stmt)


def update_crawler_content_state_by_id(*, crawler_content_id: str, state: int,
                                       session: Session) -> None:
    stmt: Update = Update(CrawlerDocumentsContent_Schema)\
                    .where(CrawlerDocumentsContent_Schema.id == crawler_content_id) \
                    .values(training_state = state)
    session.execute(stmt)


def update_crawler_content_state_by_doc_id(*, crawler_documents_id: str,
                                           state: int,
                                           session: Session) -> None:
    stmt: Update = Update(CrawlerDocumentsContent_Schema)\
                    .where(CrawlerDocumentsContent_Schema.crawler_documents_id == crawler_documents_id) \
                    .values(training_state = state)
    session.execute(stmt)


def update_crawler_document_state(*, crawler_document_id: str, state: int,
                                  session: Session) -> None:
    stmt: Update = Update(CrawlerDocuments_Schema)\
                    .where(CrawlerDocuments_Schema.id == crawler_document_id) \
                    .values(training_state = state)
    session.execute(stmt)


def update_upload_document_status(*, upload_documents_id: str, status: int,
                                  session: Session) -> None:
    stmt: Update = Update(UploadDocuments_Schema)\
                    .where(UploadDocuments_Schema.id == upload_documents_id) \
                    .values(training_state = status)
    session.execute(stmt)


def update_upload_document_is_enable(*, upload_documents_id: str,
                                     is_enable: int, session: Session) -> None:
    stmt: Update = Update(UploadDocuments_Schema)\
                    .where(UploadDocuments_Schema.id == upload_documents_id) \
                    .values(is_enable = is_enable)
    session.execute(stmt)


def insert_extra_qa(*, row: CrawlerDocumentsQAExtra_Schema,
                    session: Session) -> None:
    try:
        session.add(row)
    except Exception as ex:
        logger.exception("insert crawler_documents_qa_extra error...",
                         exc_info=ex)
        raise


def select_extra_qa(
        *, extra_qa_id: str,
        session: Session) -> Optional[CrawlerDocumentsQAExtra_Schema]:
    stmt:Select = Select(CrawlerDocumentsQAExtra_Schema) \
                .where(CrawlerDocumentsQAExtra_Schema.id == extra_qa_id)\
                .limit(1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_extra_qa_from_ori_qa_id(
        *, ori_qa_id: str,
        session: Session) -> Optional[CrawlerDocumentsQAExtra_Schema]:
    stmt:Select = Select(CrawlerDocumentsQAExtra_Schema) \
                .where(CrawlerDocumentsQAExtra_Schema.crawler_documents_qa_id == ori_qa_id)\
                .limit(1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_expert_skills_class(*, expert_id: str,
                               session: Session) -> Sequence[Skill_Schema]:
    stmt:Select = Select(Skill_Schema) \
                .join(ExpertSkillMapping_Schema,Skill_Schema.id == ExpertSkillMapping_Schema.skill_id)\
                .where(ExpertSkillMapping_Schema.expert_id == expert_id)\
                .where(Skill_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_experts_ids(*, session: Session) -> Sequence[str]:
    stmt: Select = Select(Expert_Schema.id).where(Expert_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_cdqa_from_id(
        *, cdqa_id: str,
        session: Session) -> Optional[CrawlerDocumentsQA_Schema]:
    stmt: Select = Select(CrawlerDocumentsQA_Schema)\
        .where(CrawlerDocumentsQA_Schema.is_enable == 1)\
        .where(CrawlerDocumentsQA_Schema.id == cdqa_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_skill_from_id(*, skill_id: str,
                         session: Session) -> Skill_Schema | None:
    stmt: Select = Select(Skill_Schema).where(
        Skill_Schema.id == skill_id).where(Skill_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_login_type_from_id(*, login_type_id: int,
                              session: Session) -> LoginType_Schema | None:
    stmt: Select = Select(LoginType_Schema).where(
        LoginType_Schema.id == login_type_id).where(
            LoginType_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_login_type_from_ids(*, login_type_ids: list[int],
                               session: Session) -> Sequence[LoginType_Schema]:
    stmt: Select = Select(LoginType_Schema).where(
        LoginType_Schema.id.in_(login_type_ids)).where(
            LoginType_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_extra_qa_from_cdqa_id(
        *, cdqa_id: str,
        session: Session) -> Optional[CrawlerDocumentsQAExtra_Schema]:
    stmt: Select = Select(CrawlerDocumentsQAExtra_Schema)\
        .where(CrawlerDocumentsQAExtra_Schema.crawler_documents_qa_id == cdqa_id)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_datasets_from_folder_name(
        *, folder_name: str, session: Session) -> Dataset_Schema | None:
    stmt: Select = Select(Dataset_Schema)\
        .where(Dataset_Schema.folder_name == folder_name)\
        .where(Dataset_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_dataset_from_expert_id(
        *, expert_id: str, session: Session) -> Sequence[Dataset_Schema]:
    stmt: Select = Select(Dataset_Schema)\
        .join(ExpertDatasetMapping_Schema, Dataset_Schema.id == ExpertDatasetMapping_Schema.datasets_id)\
        .where(ExpertDatasetMapping_Schema.expert_id == expert_id)\
        .where(Dataset_Schema.is_enable == 1)\
        .where(Dataset_Schema.state == 0)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def delete_form_binding_by_id(*, form_binding_id: str,
                              session: Session) -> None:
    stmt: Delete = Delete(FormBindingAssociation_Schema)\
        .where(FormBindingAssociation_Schema.id == form_binding_id)
    session.execute(stmt)


def delete_form_binding_by_doc_form_id(*, form_id: str, document_id: str,
                                       session: Session) -> None:
    stmt: Delete = Delete(FormBindingAssociation_Schema)\
        .where(FormBindingAssociation_Schema.form_id == form_id)\
        .where(FormBindingAssociation_Schema.document_id == document_id)
    session.execute(stmt)


def select_form_dataset_binding_docs(
        *, form_id: str,
        session: Session) -> Sequence[FormBindingAssociation_Schema]:
    stmt: Select = Select(FormBindingAssociation_Schema)\
        .where(FormBindingAssociation_Schema.form_id == form_id)\
        .where(FormBindingAssociation_Schema.binding_type == 1)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_datasets_from_id(*, datasets_id: str,
                            session: Session) -> Optional[Dataset_Schema]:
    stmt: Select = Select(Dataset_Schema)\
        .where(Dataset_Schema.id == datasets_id)\
        .where(Dataset_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def edit_form_configuration_enabled(*, form_id: str, is_enable: int,
                                    session: Session) -> None:
    stmt: Update = Update(FormConfiguration_Schema).where(
        FormConfiguration_Schema.id == form_id).values(is_enable=is_enable)
    session.execute(stmt)


def insert_form_binding(*, id: str, form_id: str, dataset_id: str,
                        document_id: str, binding_type: int,
                        session: Session) -> None:
    try:
        row: FormBindingAssociation_Schema = FormBindingAssociation_Schema(
            id=id,
            form_id=form_id,
            document_id=document_id,
            dataset_id=dataset_id,
            binding_type=binding_type)
        session.add(row)
    except Exception as ex:
        logger.exception("insert form binding error...", exc_info=ex)
        raise


def select_form_binding_from_id(
        *, form_id: str,
        session: Session) -> Sequence[FormBindingAssociation_Schema]:
    stmt: Select = Select(FormBindingAssociation_Schema).where(
        FormBindingAssociation_Schema.form_id == form_id)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_folder_name_from_crawler_sync_id(
        *, crawler_synchronize_id: int,
        session: Session) -> Dataset_Schema | None:
    stmt: Select = Select(Dataset_Schema).outerjoin(
        DataSource_Schema,
        Dataset_Schema.id == DataSource_Schema.datasets_id).outerjoin(
            CrawlerSynchronize_Schema, DataSource_Schema.id ==
            CrawlerSynchronize_Schema.datasource_id).where(
                CrawlerSynchronize_Schema.id == crawler_synchronize_id,
                Dataset_Schema.is_enable == 1)
    result: Result[Dataset_Schema] | None = session.execute(
        stmt).scalars().one_or_none()
    return result


def select_datasets_folder_from_id(*, datasets_id: str,
                                   session: Session) -> Optional[str]:
    stmt: Select = Select(Dataset_Schema.folder_name)\
        .where(Dataset_Schema.id == datasets_id) \
        .where(Dataset_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_dataset_folder_from_crawler_sync_id(
        *, crawler_synchronize_id: int, session: Session) -> Optional[str]:
    stmt: Select = Select(Dataset_Schema.folder_name)\
        .join(DataSource_Schema, Dataset_Schema.id == DataSource_Schema.datasets_id,isouter=True)\
        .join(CrawlerSynchronize_Schema , DataSource_Schema.id == CrawlerSynchronize_Schema.datasource_id,isouter=True)\
        .where(CrawlerSynchronize_Schema.id == crawler_synchronize_id)\
        .where(Dataset_Schema.is_enable == 1)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_qa_from_crawler_sync_id(
        *, crawler_synchronize_id: int,
        session: Session) -> Sequence[CrawlerSynchronize_Schema]:
    stmt: Select = Select(CrawlerSynchronize_Schema)\
        .join(CrawlerDocuments_Schema , CrawlerSynchronize_Schema.id == CrawlerDocuments_Schema.crawler_synchronize_id)\
        .join(CrawlerDocumentsQA_Schema, CrawlerDocuments_Schema.id == CrawlerDocumentsQA_Schema.crawler_documents_id)\
        .where(CrawlerDocuments_Schema.is_enable == 1)\
        .where(CrawlerDocumentsQA_Schema.is_enable == 1)\
        .where(CrawlerSynchronize_Schema.id == crawler_synchronize_id)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def select_dataset_from_folder_name(
        *, folder_name: str, session: Session) -> Optional[Dataset_Schema]:
    stmt: Select = Select(Dataset_Schema)\
        .where(Dataset_Schema.is_enable == 1)\
        .where(Dataset_Schema.folder_name == folder_name)
    result: Result = session.execute(stmt)
    return result.scalars().one_or_none()


def select_datasource_from_expert_id(
        *, expert_id: str, session: Session) -> Sequence[DataSource_Schema]:
    stmt: Select = Select(DataSource_Schema)\
        .join(Dataset_Schema, DataSource_Schema.datasets_id  == Dataset_Schema.id)\
        .join(ExpertDatasetMapping_Schema , DataSource_Schema.id == ExpertDatasetMapping_Schema.datasets_id)\
        .where(Dataset_Schema.is_enable == 1)\
        .where(ExpertDatasetMapping_Schema.expert_id == expert_id)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def is_not_finished_crawler_sync_task(*, sync_id: int,
                                      session: Session) -> bool:
    stmt = Select(exists().where(
        CrawlerDocuments_Schema.training_state == 2,
        CrawlerDocuments_Schema.crawler_synchronize_id == sync_id))
    result = session.execute(stmt)
    return bool(result.scalar())


def select_documents_from_crawler_synchronize_id(
        *, cs_id: int, session: Session) -> Iterator[Any]:
    offset = 0
    limit = 100
    while True:
        query: RowReturningQuery[Tuple[CrawlerDocumentsContent_Schema, str, int, str, str]] = session.query(
            CrawlerDocumentsContent_Schema,
            CrawlerDocuments_Schema.filename,
            CrawlerSynchronize_Schema.id.label('crawler_synchronize_id'),
            CrawlerDocuments_Schema.id.label('crawler_documents_id'),
            CrawlerSynchronize_Schema.crawler_id
        )\
            .join(CrawlerDocuments_Schema, CrawlerDocuments_Schema.crawler_synchronize_id == CrawlerSynchronize_Schema.id)\
            .join(CrawlerDocumentsContent_Schema, CrawlerDocuments_Schema.id == CrawlerDocumentsContent_Schema.crawler_documents_id)\
            .filter(CrawlerDocumentsContent_Schema.crawler_synchronize_id == cs_id)\
            .filter(CrawlerDocuments_Schema.is_enable == 1)\
            .filter(CrawlerDocumentsContent_Schema.is_enable == 1)\
            .filter(
                or_(
                    CrawlerDocuments_Schema.training_state == 2,
                    CrawlerDocuments_Schema.training_state == 3
                )
            )\
            .filter(CrawlerSynchronize_Schema.id == cs_id)\
            .order_by(CrawlerDocumentsContent_Schema.id)\
            .offset(offset)\
            .limit(limit)

        results = query.all()
        if not results:
            break

        for row in results:
            yield row

        offset += limit


def update_cdqa_adorn(*, cdqa_id: str, new_adorn: list,
                      session: Session) -> None:
    stmt: Select = Select(CrawlerDocumentsQA_Schema)\
                    .where(CrawlerDocumentsQA_Schema.id == cdqa_id)
    select_result: Result = session.execute(stmt)
    qa_or_none: Optional[
        CrawlerDocumentsQA_Schema] = select_result.scalar_one_or_none()
    assert qa_or_none
    if not qa_or_none:
        raise RuntimeError(
            f"attemped to update non-exist cdqa by id:{cdqa_id}")
    else:
        qa_or_none.adorn = new_adorn


def select_images_from_upload_document_id(
        *, upload_document_id: str,
        session: Session) -> Sequence[DocumentImageStore_Schema]:

    try:
        stmt: Select = Select(DocumentImageStore_Schema).where(
            DocumentImageStore_Schema.upload_document_id == upload_document_id)
        result: Result = session.execute(stmt)
        return result.scalars().all()
    except Exception as ex:
        logger.exception("select images from upload document id error...",
                         exc_info=ex)
        raise


def select_image_from_uuid(
        *, image_uuid: str,
        session: Session) -> DocumentImageStore_Schema | None:
    try:
        stmt: Select = Select(DocumentImageStore_Schema).where(
            DocumentImageStore_Schema.image_uuid == image_uuid)
        result: Result = session.execute(stmt)
        return result.scalars().one_or_none()
    except Exception as ex:
        logger.exception("select image from uuid error...", exc_info=ex)
        raise


def insert_document_image(*, row: DocumentImageStore_Schema,
                          session: Session) -> None:
    try:
        session.add(row)
    except Exception as ex:
        logger.exception("insert image error...", exc_info=ex)
        raise


def select_user_completion_history(*,
                                   user_id: str,
                                   expert_id: str,
                                   limit: int = 5,
                                   session: Session
                                   ) -> Sequence[UserCompletionHistory_Schema]:
    stmt: Select = Select(UserCompletionHistory_Schema).where(
        UserCompletionHistory_Schema.user_id == user_id).where(
            UserCompletionHistory_Schema.expert_id == expert_id).order_by(
                UserCompletionHistory_Schema.create_time.desc()).limit(limit)
    result: Result = session.execute(stmt)
    return result.scalars().all()


def insert_user_completion_history(*, row: UserCompletionHistory_Schema,
                                   session: Session) -> None:
    try:
        session.add(row)
    except Exception as ex:
        logger.exception("insert ocr documents token log error...", exc_info=ex)
        raise


def insert_translation_task(*, task_id: str, user_id: str, room_id: str,
                            result_files: list[dict], message: str,
                            history_message_id: int, session: Session) -> None:
    try:
        row: TranslationTasks_Schema = TranslationTasks_Schema(
            id=task_id,
            user_id=user_id,
            room_id=room_id,
            result_files=result_files,
            message=message,
            history_message_id=history_message_id)
        session.add(row)
    except Exception as ex:
        logger.exception("insert translation task error...", exc_info=ex)
        raise


def update_translation_task_status(*,
                                   task_id: str,
                                   status: str,
                                   message: str | None = None,
                                   result_files: list[dict] | None = None,
                                   session: Session) -> None:
    """Update the status and message of a translation task.

    Args:
        task_id: The ID of the translation task (UUID4 string)
        status: The new status value
        message: Optional status message
        result_files: Optional list of result files
        session: The database session
    """
    try:
        values = {"status": status, "update_time": func.now()}
        if message is not None:
            values["message"] = message
        if result_files is not None:
            values["result_files"] = result_files

        stmt: Update = Update(TranslationTasks_Schema).where(
            TranslationTasks_Schema.id == task_id).values(**values)
        session.execute(stmt)
    except Exception as ex:
        logger.exception("update translation task status error...",
                         exc_info=ex)
        raise


def get_translation_task(*, task_id: str,
                         session: Session) -> TranslationTasks_Schema | None:
    """Get a translation task by its ID.

    Args:
        task_id: The ID of the translation task (UUID4 string)
        session: The database session

    Returns:
        The translation task if found, None otherwise
    """
    try:
        stmt: Select = Select(TranslationTasks_Schema).where(
            TranslationTasks_Schema.id == task_id)
        result: Result = session.execute(stmt)
        return result.scalars().one_or_none()
    except Exception as ex:
        logger.exception("get translation task error...", exc_info=ex)
        raise


def get_user_translation_tasks(
        *, user_id: str,
        session: Session) -> Sequence[TranslationTasks_Schema]:
    """Get all translation tasks for a user.

    Args:
        user_id: The ID of the user
        session: The database session

    Returns:
        A sequence of translation tasks ordered by creation time descending
    """
    try:
        stmt: Select = Select(TranslationTasks_Schema).where(
            TranslationTasks_Schema.user_id == user_id).order_by(
                TranslationTasks_Schema.create_time.desc())
        result: Result = session.execute(stmt)
        return result.scalars().all()
    except Exception as ex:
        logger.exception("get user translation tasks error...", exc_info=ex)
        raise


def insert_ocr_documents_token_log(*, row: OcrDocumentsTokenLog_Schema,
                               session: Session) -> None:
    try:
        session.add(row)
    except Exception as ex:
        logger.exception("insert ocr documents token log error...", exc_info=ex)
        raise

