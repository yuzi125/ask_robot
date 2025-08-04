const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const GroupHistory = require("../schema/group_history");
const ChatMessageType = require("../schema/chat_message_type");
class ChatMessage extends Model {}

ChatMessage.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        group_history_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        message_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        content: {
            type: DataTypes.STRING(500),
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
        modelName: "ChatMessage",
        tableName: "chat_message",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
ChatMessage.belongsTo(GroupHistory, { foreignKey: "group_history_id" });
ChatMessage.belongsTo(ChatMessageType, { foreignKey: "message_type_id" });
module.exports = ChatMessage;
