const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("../schema/users");
const Expert = require("../schema/expert");
class ModelTokenLog extends Model {}

ModelTokenLog.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            comment: "自增id",
        },
        users_id: {
            type: DataTypes.STRING(50),
        },
        model: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "gpt-3.5-turbo",
        },
        classify: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "intent/streaming",
        },
        prompt_token: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "輸入token數",
        },
        completion_token: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "輸出token數",
        },
        user_input: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "使用者輸入",
        },
        expert_id: {
            type: DataTypes.STRING(50),
            comment: "專家id",
        },
        expert_model: {
            type: DataTypes.STRING(50),
            comment: "知識庫folder_name或技能class",
        },
        expert_model_type: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            comment: `0:意圖
        1:知識庫
        2:技能
        3:方法`,
        },
        prompt_rate: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            comment: "輸入token比率",
        },
        completion_rate: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            comment: "輸出token比率",
        },
        price: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            comment: "比率換算後金額",
        },
        price_currency: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "USD",
            comment: "幣別",
        },
        chat_uuid: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "判斷同筆聊天用",
        },
        history_message_id: {
            type: DataTypes.INTEGER,
            comment: "history_messages表的d",
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
        modelName: "ModelTokenLog",
        tableName: "model_token_log",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
ModelTokenLog.belongsTo(Users, { foreignKey: "users_id" });
ModelTokenLog.belongsTo(Expert, { foreignKey: "expert_id" });
module.exports = ModelTokenLog;
