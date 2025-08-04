const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class AuditLogEntityType extends Model {}

AuditLogEntityType.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            comment: "實體類型代碼，例如：FILE, KNOWLEDGE_BASE",
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "實體類型中文名稱，例如：檔案, 知識庫",
        },
        table_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "對應的資料表名稱，可用於跨表查詢",
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: "是否啟用",
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        update_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        remark: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: "備註說明",
        },
    },
    {
        sequelize,
        modelName: "AuditLogEntityType",
        tableName: "audit_log_entity_types",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "審計日誌實體類型定義",
    }
);

module.exports = AuditLogEntityType;
