const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("../schema/users");
const ChatGroup = require("../schema/chat_group");
class GroupHistory extends Model {}

GroupHistory.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        group_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        from_id: {
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
        modelName: "GroupHistory",
        tableName: "group_history",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
GroupHistory.belongsTo(Users, { foreignKey: "group_id" });
GroupHistory.belongsTo(ChatGroup, { foreignKey: "from_id" });
module.exports = GroupHistory;
