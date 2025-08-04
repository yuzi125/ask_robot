// services/auditLogService.js

const AuditLog = require("../orm/schema/audit_log");
const AuditLogActionType = require("../orm/schema/audit_log_action_type");
const AuditLogEntityType = require("../orm/schema/audit_log_entity_type");
const { Op } = require("sequelize");

/**
 * 記錄審計日誌
 * @param {Object} options 日誌選項
 * @param {Number} options.userId 操作者ID
 * @param {String} options.username 操作者名稱
 * @param {String} options.actionType 操作類型代碼，例如：CREATE, UPDATE, DELETE
 * @param {String} options.entityType 實體類型代碼，例如：CREATE_EXPERT, CREATE_DATASET
 * @param {String} options.targetId 操作目標的ID (專家/知識庫/技能/表單的ID)
 * @param {String} options.targetCategory 操作目標的主要類別 (expert, dataset, skill, form 等)
 * @param {Object} [options.parameters] 操作參數
 * @param {String} [options.ipAddress] IP地址
 * @param {String} [options.userAgent] 使用者代理
 * @returns {Promise<Object>} 已創建的日誌
 */
const logActivity = async (options) => {
    try {
        // 驗證必填欄位
        const requiredFields = ["userId", "username", "actionType", "entityType"];
        for (const field of requiredFields) {
            if (!options[field]) {
                console.error(`Missing required field for audit log: ${field}`);
                return null;
            }
        }

        // 查詢操作類型ID
        const actionType = await AuditLogActionType.findOne({
            where: {
                code: options.actionType,
                is_active: true,
            },
            attributes: ["id", "code"],
        });

        if (!actionType) {
            console.error(`Invalid action type: ${options.actionType}`);
            return null;
        }

        // 查詢實體類型ID
        const entityType = await AuditLogEntityType.findOne({
            where: {
                code: options.entityType,
                is_active: true,
            },
            attributes: ["id", "code"],
        });

        if (!entityType) {
            console.error(`Invalid entity type: ${options.entityType}`);
            return null;
        }

        // 創建審計日誌
        const auditLog = await AuditLog.create({
            user_id: options.userId,
            username: options.username,
            action_type_id: actionType.id,
            action_type: actionType.code,
            entity_type_id: entityType.id,
            entity_type: entityType.code,
            target_id: options.targetId || null,
            target_category: options.targetCategory || null,
            parameters: options.parameters || {},
            ip_address: options.ipAddress || null,
            user_agent: options.userAgent || null,
        });

        console.log(`Audit log created with ID: ${auditLog.id}`);
        return auditLog;
    } catch (error) {
        console.error("Error creating audit log:", error);
        return null;
    }
};

/**
 * 查詢審計日誌
 * @param {Object} filters 過濾條件
 * @param {Number} [page=1] 頁碼
 * @param {Number} [limit=20] 每頁筆數
 * @returns {Promise<Object>} 查詢結果
 */
const queryLogs = async (filters = {}, page = 1, limit = 20) => {
    try {
        const offset = (page - 1) * limit;

        // 建立查詢條件
        const whereClause = {};

        if (filters.userId) {
            whereClause.user_id = filters.userId;
        }

        if (filters.username) {
            whereClause.username = { [Op.iLike]: `%${filters.username}%` };
        }

        if (filters.actionType) {
            whereClause.action_type = filters.actionType;
        }

        if (filters.entityType) {
            whereClause.entity_type = filters.entityType;
        }

        if (filters.entityId) {
            whereClause.entity_id = filters.entityId;
        }

        if (filters.startDate && filters.endDate) {
            whereClause.create_time = { [Op.between]: [filters.startDate, filters.endDate] };
        } else if (filters.startDate) {
            whereClause.create_time = { [Op.gte]: filters.startDate };
        } else if (filters.endDate) {
            whereClause.create_time = { [Op.lte]: filters.endDate };
        }

        // 執行查詢並計算總數
        const { count, rows } = await AuditLog.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: ActionType,
                    as: "actionTypeInfo",
                    attributes: ["name"],
                },
                {
                    model: EntityType,
                    as: "entityTypeInfo",
                    attributes: ["name"],
                },
            ],
            order: [["create_time", "DESC"]],
            limit,
            offset,
        });

        // 格式化結果
        const formattedLogs = rows.map((log) => {
            const plainLog = log.get({ plain: true });
            return {
                ...plainLog,
                actionTypeName: plainLog.actionTypeInfo ? plainLog.actionTypeInfo.name : null,
                entityTypeName: plainLog.entityTypeInfo ? plainLog.entityTypeInfo.name : null,
            };
        });

        return {
            logs: formattedLogs,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
        };
    } catch (error) {
        console.error("Error querying audit logs:", error);
        throw error;
    }
};

const AUDIT_LOG_ACTION_TYPE = {
    CREATE: "CREATE",
    UPDATE: "UPDATE",
    DELETE: "DELETE",
    READ: "READ",
    UPLOAD: "UPLOAD",
    DOWNLOAD: "DOWNLOAD",
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
    ENABLE: "ENABLE",
    DISABLE: "DISABLE",
};

const AUDIT_LOG_ENTITY_TYPE = {
    // CREATE 類型
    CREATE_EXPERT: "CREATE_EXPERT",
    CREATE_DATASET: "CREATE_DATASET",
    CREATE_SKILL: "CREATE_SKILL",
    CREATE_FORM: "CREATE_FORM",
    CREATE_CRAWLER: "CREATE_CRAWLER",
    CREATE_SEARCH_MODEL: "CREATE_SEARCH_MODEL",
    CREATE_INTENTION_MODEL: "CREATE_INTENTION_MODEL",
    CREATE_KOR_MODEL: "CREATE_KOR_MODEL",
    CREATE_VOICE_MODEL: "CREATE_VOICE_MODEL",

    // UPDATE 類型
    UPDATE_EXPERT_CONFIG: "UPDATE_EXPERT_CONFIG",
    UPDATE_CRAWLER: "UPDATE_CRAWLER",
    UPDATE_DATASET_CONFIG: "UPDATE_DATASET_CONFIG",
    UPDATE_SEARCH_MODEL: "UPDATE_SEARCH_MODEL",
    UPDATE_INTENTION_MODEL: "UPDATE_INTENTION_MODEL",
    UPDATE_KOR_MODEL: "UPDATE_KOR_MODEL",
    UPDATE_VOICE_MODEL: "UPDATE_VOICE_MODEL",
    UPDATE_FORM: "UPDATE_FORM",
    UPDATE_SKILL: "UPDATE_SKILL",

    // UPLOAD / ENABLE / DISABLE 類型
    UPLOAD_DOCUMENT: "UPLOAD_DOCUMENT",
    ENABLE_DOCUMENT: "ENABLE_DOCUMENT",
    ENABLE_CRAWLER: "ENABLE_CRAWLER",
    ENABLE_CRAWLER_CONTENT: "ENABLE_CRAWLER_CONTENT",
    DISABLE_DOCUMENT: "DISABLE_DOCUMENT",
    DISABLE_CRAWLER: "DISABLE_CRAWLER",
    DISABLE_CRAWLER_CONTENT: "DISABLE_CRAWLER_CONTENT",

    // DELETE 類型
    DELETE_EXPERT: "DELETE_EXPERT",
    DELETE_DATASET: "DELETE_DATASET",
    DELETE_DOCUMENT: "DELETE_DOCUMENT",
    DELETE_SKILL: "DELETE_SKILL",
    DELETE_FORM: "DELETE_FORM",
    DELETE_CRAWLER: "DELETE_CRAWLER",
    DELETE_SEARCH_MODEL: "DELETE_SEARCH_MODEL",
    DELETE_INTENTION_MODEL: "DELETE_INTENTION_MODEL",
    DELETE_KOR_MODEL: "DELETE_KOR_MODEL",
    DELETE_VOICE_MODEL: "DELETE_VOICE_MODEL",
};

module.exports = {
    logActivity,
    queryLogs,
    AUDIT_LOG_ACTION_TYPE,
    AUDIT_LOG_ENTITY_TYPE,
};
