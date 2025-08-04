const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const ChatGroup = require("../schema/chat_group");
const Users = require("../schema/users");
class ChatGroupUser extends Model {}

ChatGroupUser.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        group_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        user_id: {
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
        modelName: "ChatGroupUser",
        tableName: "chat_group_user",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
ChatGroupUser.belongsTo(ChatGroup, { foreignKey: "group_id" });
ChatGroupUser.belongsTo(Users, { foreignKey: "user_id" });
module.exports = ChatGroupUser;
