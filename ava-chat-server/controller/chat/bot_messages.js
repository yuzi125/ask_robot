const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Expert = require("./expert");
const Users = require("./users");
class BotMessages extends Model {}

BotMessages.init(
    {
        group_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
            comment: "房間id",
        },
        users_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: "bot_messages_un",
            comment: "使用者id",
        },
        subject: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "主題",
        },
        chat: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: "聊天內容",
        },
        context: {
            type: DataTypes.JSONB,
            comment: "上下文",
        },
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: "bot_messages_un",
            comment: "專家id",
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
        modelName: "BotsMessages",
        tableName: "bot_messages",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "機器人聊天室",
    }
);
BotMessages.belongsTo(Expert, { foreignKey: "expert_id" });
BotMessages.belongsTo(Users, { foreignKey: "users_id" });
module.exports = BotMessages;
