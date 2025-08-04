const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class AuditLogActionType extends Model {}

AuditLogActionType.init(
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
            comment: "操作類型代碼，例如：CREATE, UPDATE, DELETE",
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "操作類型中文名稱，例如：新增, 修改, 刪除",
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
        modelName: "AuditLogActionType",
        tableName: "audit_log_action_types",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "審計日誌操作類型定義",
    }
);

module.exports = AuditLogActionType;
