const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("../schema/users");
class UserRooms extends Model {}

UserRooms.init(
    {
        room_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
            comment: "房號",
        },
        user1_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: "user_rooms_un",
            comment: "第一個使用者",
        },
        user2_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: "user_rooms_un",
            comment: "第二個使用者",
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
        modelName: "UserRooms",
        tableName: "user_rooms",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "使用者房間",
    }
);
UserRooms.belongsTo(Users, { foreignKey: "user1_id" });
UserRooms.belongsTo(Users, { foreignKey: "user2_id" });
module.exports = UserRooms;
