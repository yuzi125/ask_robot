const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("./users");
const LoginType = require("./login_type");

class UserLoginType extends Model {}

UserLoginType.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
        },
        login_type_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        auth_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
            primaryKey: true,
        },
        user_info_json: {
            type: DataTypes.JSON,
            allowNull: true,
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
        modelName: "UserLoginType",
        tableName: "user_login_type",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
Users.belongsToMany(LoginType, {
    through: UserLoginType,
    foreignKey: "user_id", // 明確指定外鍵
    otherKey: "login_type_id",
});
LoginType.belongsToMany(Users, {
    through: UserLoginType,
    foreignKey: "login_type_id", // 明確指定外鍵
    otherKey: "user_id",
});

module.exports = UserLoginType;
