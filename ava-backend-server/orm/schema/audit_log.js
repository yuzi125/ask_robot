const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const AuditLogActionType = require("./audit_log_action_type");
const AuditLogEntityType = require("./audit_log_entity_type");
// const User = require("./User");

class AuditLog extends Model {}

AuditLog.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "操作者ID",
        },
        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "操作者名稱",
        },
        action_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "操作類型ID，關聯到action_types表",
            references: {
                model: "audit_log_action_types",
                key: "id",
            },
        },
        action_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "操作類型代碼，冗餘儲存提高查詢效率",
        },
        entity_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "實體類型ID，關聯到entity_types表",
            references: {
                model: "audit_log_entity_types",
                key: "id",
            },
        },
        entity_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "實體類型代碼，冗餘儲存提高查詢效率",
        },
        target_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "操作目標的ID (專家/知識庫/技能/表單的ID)",
        },
        target_category: {
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: "操作目標的主要類別 (expert, dataset, skill, form 等)",
        },
        parameters: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "操作參數，包含詳細資訊",
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true,
            comment: "操作者IP地址",
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "操作者瀏覽器資訊",
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
    },
    {
        sequelize,
        modelName: "AuditLog",
        tableName: "audit_logs",
        createdAt: "create_time",
        updatedAt: false, // 審計日誌不需要更新時間
        underscored: true,
        comment: "系統操作審計日誌",
        indexes: [
            {
                name: "idx_audit_logs_user_id",
                fields: ["user_id"],
            },
            {
                name: "idx_audit_logs_action_type",
                fields: ["action_type"],
            },
            {
                name: "idx_audit_logs_action_type_id",
                fields: ["action_type_id"],
            },
            {
                name: "idx_audit_logs_entity_type",
                fields: ["entity_type"],
            },
            {
                name: "idx_audit_logs_entity_type_id",
                fields: ["entity_type_id"],
            },
            {
                name: "idx_audit_logs_entity_type_target_id",
                fields: ["entity_type", "target_id"],
            },
            {
                name: "idx_audit_logs_create_time",
                fields: ["create_time"],
            },
            {
                name: "idx_audit_logs_target_category",
                fields: ["target_category"],
            },
            {
                name: "idx_audit_logs_target_category_target_id",
                fields: ["target_category", "target_id"],
            },
        ],
    }
);

// 設定與 ActionType 的關聯
AuditLog.belongsTo(AuditLogActionType, { foreignKey: "action_type_id", as: "actionTypeInfo" });

// 設定與 EntityType 的關聯
AuditLog.belongsTo(AuditLogEntityType, { foreignKey: "entity_type_id", as: "entityTypeInfo" });

// 設定與 User 的關聯
// AuditLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = AuditLog;
