const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("./users");

class TranslationTasks extends Model {}

TranslationTasks.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "使用者 ID",
        },
        room_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "任務對應的房間 ID",
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "pending",
            comment: "翻譯任務狀態 (pending, processing, completed, failed, error)",
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "任務狀態訊息，可用於顯示進度或錯誤資訊",
        },
        result_files: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: "翻譯完成的檔案清單",
        },
        is_notified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: "是否已經發送過通知",
        },
        history_message_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            comment: "對話 id 用來刪除讀取中的訊息",
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
    },
    {
        sequelize,
        modelName: "TranslationTasks",
        tableName: "translation_tasks",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "翻譯任務完成通知記錄表",
    }
);

TranslationTasks.belongsTo(Users, { foreignKey: "user_id" });

module.exports = TranslationTasks;
