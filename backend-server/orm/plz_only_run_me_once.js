const LoginType = require("./schema/login_type");
const UserType = require("./schema/user_type");
const Users = require("./schema/users");
const UserLoginType = require("./schema/user_login_type");
const UserRooms = require("./schema/user_rooms");
const UserMessages = require("./schema/user_messages");
const UserLoginRecord = require("./schema/user_login_record");
// const UserInfoType = require("./schema/user_info_type");
// const UserInfo = require("./schema/user_info");
const Settings = require("./schema/settings");
const HistoryMessages = require("./schema/history_messages");
const Datasets = require("./schema/datasets");
const DatasourceType = require("./schema/datasource_type");
const Datasource = require("./schema/datasource");
const UploadFolder = require("./schema/upload_folder");
const UploadDocuments = require("./schema/upload_documents");
const Expert = require("./schema/expert");
const BotMessages = require("./schema/bot_messages");
const RecommendPreset = require("./schema/recommend_preset");
const RecommendHistory = require("./schema/recommend_history");
const RecommendCustom = require("./schema/recommend_custom");
const ModelTokenLog = require("./schema/model_token_log");
const ExpertUsersMapping = require("./schema/expert_users_mapping");
const Skill = require("./schema/skill");
const ExpertSkillMapping = require("./schema/expert_skill_mapping");
const ExpertDatasetsMapping = require("./schema/expert_datasets_mapping");
const EmbeddingTokenLog = require("./schema/embedding_token_log");
const QAInfoType = require("./schema/qa_info_type");
const QAInfo = require("./schema/qa_info");
const ChatMessageType = require("./schema/chat_message_type");
const ChatGroupType = require("./schema/chat_group_type");
const ChatGroup = require("./schema/chat_group");
const GroupHistory = require("./schema/group_history");
const ChatMessage = require("./schema/chat_message");
const ChatGroupUser = require("./schema/chat_group_user");
const CrawlerType = require("./schema/crawler_type");
const Crawler = require("./schema/crawler");
const CrawlerSynchronize = require("./schema/crawler_synchronize");
const CrawlerDocuments = require("./schema/crawler_documents");
const CrawlerExecuteRecord = require("./schema/crawler_execute_record");
const CrawlerDocumentsQa = require("./schema/crawler_documents_qa");
const CrawlerDocumentsQaExtra = require("./schema/crawler_documents_qa_extra");
const CrawlerQaInfoType = require("./schema/crawler_qa_info_type");
const CrawlerQAInfo = require("./schema/crawler_qa_info");
const ParentChunks = require("./schema/parent_chunks");
const CachedKnowledge = require("./schema/cached_knowledge");
const FormConfiguration = require("./schema/form_configuration");
const FormBindingAssociation = require("./schema/form_binding_association");
const ModelList = require("./schema/model_list");
const HistoryCacheMapping = require("./schema/history_cache_mapping");
const Feedback = require("./schema/feedback");
const FeedbackProcess = require("./schema/feedback_process");
const FeedbackOptions = require("./schema/feedback_options");
const DeploymentRecord = require("./schema/deployment_record");
const CrawlerDocumentsContent = require("./schema/crawler_documents_content");
const DefaultPrompt = require("./schema/default_prompt");
const ExpertEmbeddingTokenLog = require("./schema/expert_embedding_token_log");
const CronTask = require("./schema/cron_tasks");
const CrawlerSyncSchedule = require("./schema/crawler_sync_schedule");
const TwoFactorAuthentication = require("./schema/two_factor_authentication");
const TwoFactorAuthHistory = require("./schema/two_factor_auth_history");
const ChatTheme = require("./schema/chat_theme");
const CrawlerTask = require("./schema/crawler_task");
const BanIp = require("./schema/ban_ip");
const BanIpHistory = require("./schema/ban_ip_history");
const Announcement = require("./schema/announcement");
const UserAcknowledgment = require("./schema/user_acknowledgement");
const MessageChunkMapping = require("./schema/message_chunk_mapping");
const ApiKeys = require("./schema/api_keys");
const ApiKeyMapping = require("./schema/api_key_mapping");
const ApiKeyDomains = require("./schema/api_key_domains");
const ApiKeyUsageLogs = require("./schema/api_key_usage_logs");
const AuditLog = require("./schema/audit_log");
const AuditLogActionType = require("./schema/audit_log_action_type");
const AuditLogEntityType = require("./schema/audit_log_entity_type");
const CrawlerAttachment = require("./schema/crawler_attachment");
const CrawlerAttachmentHash = require("./schema/crawler_attachment_hash");
const DocumentImageStore = require("./schema/document_image_store");
const UserCompletionHistory = require("./schema/user_completion_history");
const TranslationTasks = require("./schema/translation_tasks");
const GroupPermission = require("./schema/group_permission");
const TaskOperations = require("./schema/task_operations");
const OcrDocumentsTokenLog = require("./schema/ocr_documents_token_log");
/* const models = {
    BotMessage: BotMessage,
    ChatGroup: ChatGroup,
    ChatGroupType: ChatGroupType,
    ChatGroupUser: ChatGroupUser,
    ChatMessage: ChatMessage,
    ChatMessageType: ChatMessageType,
    Crawler: Crawler,
    CrawlerDocuments: CrawlerDocuments,
    CrawlerDocumentsQA: CrawlerDocumentsQA,
    CrawlerExecuteRecord: CrawlerExecuteRecord,
    CrawlerSynchronize: CrawlerSynchronize,
    CrawlerType: CrawlerType,
    Datasets: Datasets,
    Datasource: Datasource,
    DatasourceType: DatasourceType,
    EmbeddingTokenLog: EmbeddingTokenLog,
    Expert: Expert,
    ExpertDatasetsMapping: ExpertDatasetsMapping,
    ExpertSkillMapping: ExpertSkillMapping,
    ExpertUsersMapping: ExpertUsersMapping,
    GroupHistory: GroupHistory,
    HistoryMessage: HistoryMessage,
    ModelTokenLog: ModelTokenLog,
    QAInfo: QAInfo,
    QAInfoType: QAInfoType,
    RecommendCustom: RecommendCustom,
    RecommendHistory: RecommendHistory,
    RecommendPreset: RecommendPreset,
    Settings: Settings,
    Skill: Skill,
    UploadDocuments: UploadDocuments,
    UploadFolder: UploadFolder,
    UserInfo: UserInfo,
    UserInfoType: UserInfoType,
    UserLoginRecord: UserLoginRecord,
    UserLoginType: UserLoginType,
    UserMessages: UserMessages,
    UserRooms: UserRooms,
    Users: Users,
}; */
// exports.models = Object.keys(models);
const sequelize = require("./sequelize");

const modelMap = new Map();
modelMap.set("LoginType", LoginType);
modelMap.set("UserType", UserType);
modelMap.set("Users", Users);
modelMap.set("UserLoginType", UserLoginType);
modelMap.set("UserRooms", UserRooms);
modelMap.set("UserMessages", UserMessages);
modelMap.set("UserLoginRecord", UserLoginRecord);
// modelMap.set("UserInfoType", UserInfoType);
// modelMap.set("UserInfo", UserInfo);
modelMap.set("Settings", Settings);
modelMap.set("HistoryMessages", HistoryMessages);
modelMap.set("Datasets", Datasets);
modelMap.set("DatasourceType", DatasourceType);
modelMap.set("Datasource", Datasource);
modelMap.set("UploadFolder", UploadFolder);
modelMap.set("UploadDocuments", UploadDocuments);
modelMap.set("Expert", Expert);
modelMap.set("BotMessages", BotMessages);
modelMap.set("RecommendPreset", RecommendPreset);
modelMap.set("RecommendHistory", RecommendHistory);
modelMap.set("RecommendCustom", RecommendCustom);
modelMap.set("ModelTokenLog", ModelTokenLog);
modelMap.set("ExpertUsersMapping", ExpertUsersMapping);
modelMap.set("Skill", Skill);
modelMap.set("ExpertSkillMapping", ExpertSkillMapping);
modelMap.set("ExpertDatasetsMapping", ExpertDatasetsMapping);
modelMap.set("EmbeddingTokenLog", EmbeddingTokenLog);
modelMap.set("QAInfoType", QAInfoType);
modelMap.set("QAInfo", QAInfo);
modelMap.set("ChatMessageType", ChatMessageType);
modelMap.set("ChatGroupType", ChatGroupType);
modelMap.set("ChatGroup", ChatGroup);
modelMap.set("GroupHistory", GroupHistory);
modelMap.set("ChatMessage", ChatMessage);
modelMap.set("ChatGroupUser", ChatGroupUser);
modelMap.set("CrawlerType", CrawlerType);
modelMap.set("Crawler", Crawler);
modelMap.set("CrawlerSynchronize", CrawlerSynchronize);
modelMap.set("CrawlerDocuments", CrawlerDocuments);
modelMap.set("CrawlerExecuteRecord", CrawlerExecuteRecord);
modelMap.set("CrawlerDocumentsQa", CrawlerDocumentsQa);
modelMap.set("CrawlerDocumentsQaExtra", CrawlerDocumentsQaExtra);
modelMap.set("CrawlerQaInfoType", CrawlerQaInfoType);
modelMap.set("CrawlerQAInfo", CrawlerQAInfo);
modelMap.set("ParentChunks", ParentChunks);
modelMap.set("CachedKnowledge", CachedKnowledge);
modelMap.set("FormConfiguration", FormConfiguration);
modelMap.set("FormBindingAssociation", FormBindingAssociation);
modelMap.set("ModelList", ModelList);
modelMap.set("HistoryCacheMapping", HistoryCacheMapping);
modelMap.set("Feedback", Feedback);
modelMap.set("FeedbackOptions", FeedbackOptions);
modelMap.set("FeedbackProcess", FeedbackProcess);
modelMap.set("DeploymentRecord", DeploymentRecord);
modelMap.set("CrawlerDocumentsContent", CrawlerDocumentsContent);
modelMap.set("DefaultPrompt", DefaultPrompt);
modelMap.set("ExpertEmbeddingTokenLog", ExpertEmbeddingTokenLog);
modelMap.set("CronTask", CronTask);
modelMap.set("CrawlerSyncSchedule", CrawlerSyncSchedule);
modelMap.set("TwoFactorAuthentication", TwoFactorAuthentication);
modelMap.set("TwoFactorAuthHistory", TwoFactorAuthHistory);
modelMap.set("ChatTheme", ChatTheme);
modelMap.set("CrawlerTask", CrawlerTask);
modelMap.set("BanIp", BanIp);
modelMap.set("BanIpHistory", BanIpHistory);
modelMap.set("Announcement", Announcement);
modelMap.set("UserAcknowledgment", UserAcknowledgment);
modelMap.set("MessageChunkMapping", MessageChunkMapping);
modelMap.set("ApiKeys", ApiKeys);
modelMap.set("ApiKeyDomains", ApiKeyDomains);
modelMap.set("ApiKeyMapping", ApiKeyMapping);
modelMap.set("ApiKeyUsageLogs", ApiKeyUsageLogs);
modelMap.set("AuditLog", AuditLog);
modelMap.set("AuditLogActionType", AuditLogActionType);
modelMap.set("AuditLogEntityType", AuditLogEntityType);
modelMap.set("CrawlerAttachment", CrawlerAttachment);
modelMap.set("CrawlerAttachmentHash", CrawlerAttachmentHash);
modelMap.set("DocumentImageStore", DocumentImageStore);
modelMap.set("UserCompletionHistory", UserCompletionHistory);
modelMap.set("TranslationTasks", TranslationTasks);
modelMap.set("GroupPermission", GroupPermission);
modelMap.set("TaskOperations", TaskOperations);
modelMap.set("OcrDocumentsTokenLog", OcrDocumentsTokenLog);
exports.modelMap = modelMap;

const models = Array.from(modelMap.keys());
exports.models = models;
exports.syncForce = async function (modelName) {
    if (modelName) {
        // await models[modelName].sync({ force: true });
        await modelMap.get(modelName).sync({ force: true });
    } else {
        await sequelize.sync({ force: true });
        // for (let item of models) {
        //     await modelMap.get(item).sync({ force: true });
        // }
    }
};
exports.syncAlter = async function (modelName) {};
