const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

// const Expert = require("./expert");
// const HistoryMessage = require("./history_messages");
const FeedbackProcess = require("./feedback_process");

class Feedback extends Model {}

Feedback.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        question: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        answer: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "回饋的狀態 0:使用者回饋(管理者尚未處理) 1:管理員已處理 2:管理員待處理 3:管理員略過處理",
        },
        feedback_type: {
            type: DataTypes.ENUM("user_positive", "user_negative"),
            allowNull: false,
            comment: "回饋的 type，user_positive 代表正面評價，user_negative代表負面評價。",
        },
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "專家的 id",
        },
        datasource_info: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "儲存知識庫是用什麼方式上傳的 A:手動上傳 B:爬蟲",
        },
        datasets_ids: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "資料集的 id 是一個陣列",
        },
        source_chunk_ids: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "source chunk 的 id 是一個陣列",
        },
        documents_ids: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "document id 是一個陣列",
        },
        history_messages_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        ip: {
            type: DataTypes.STRING(50),
            allowNull: false,
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
        modelName: "Feedback",
        tableName: "feedback",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "記錄回饋",
    }
);

module.exports = Feedback;
