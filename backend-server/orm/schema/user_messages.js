const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize"); // Adjust this import according to your actual database file location
const UserRooms = require("../schema/user_rooms");

class UserMessages extends Model {}

UserMessages.init(
    {
        room_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true, // Assuming room_id to be unique for simplicity; adjust as per your schema requirements
            comment: "房號",
        },
        from_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "發送人",
        },
        to_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "接收人",
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "訊息",
        },
        message_type: {
            type: DataTypes.TEXT,
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
        modelName: "UserMessages",
        tableName: "user_messages",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "使用者聊天",
        indexes: [{ name: "messages_room_id_idx", fields: ["room_id"] }],
    }
);
UserMessages.belongsTo(UserRooms, { foreignKey: "room_id" });

module.exports = UserMessages;
