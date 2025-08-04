const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Expert = require("../schema/expert");
const ChatGroupType = require("../schema/chat_group_type");
class ChatGroup extends Model {}

ChatGroup.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            // references setting can be added here if associations are to be defined
        },
        group_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            // references setting can be added here if associations are to be defined
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
        modelName: "ChatGroup",
        tableName: "chat_group",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
ChatGroup.belongsTo(Expert, { foreignKey: "expert_id" });
ChatGroup.belongsTo(ChatGroupType, { foreignKey: "group_type_id" });
module.exports = ChatGroup;
