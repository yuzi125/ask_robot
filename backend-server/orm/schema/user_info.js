const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("../schema/users");
const UserInfoType = require("../schema/user_info_type");
class UserInfo extends Model {}

UserInfo.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        info_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        value: {
            type: DataTypes.STRING(1000),
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
        modelName: "UserInfo",
        tableName: "user_info",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
UserInfo.belongsTo(Users, { foreignKey: "user_id" });
UserInfo.belongsTo(UserInfoType, { foreignKey: "info_type_id" });
module.exports = UserInfo;
