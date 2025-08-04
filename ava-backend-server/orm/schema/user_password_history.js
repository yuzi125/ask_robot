const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("./users");

class UserPasswordHistory extends Model {}

UserPasswordHistory.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "使用者ID",
        },
        old_password_1: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: "現在的密碼",
        },
        old_password_2: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: "上一次的密碼",
        },
        old_password_3: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: "上上一次的密碼",
        },
        is_login_before: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
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
        modelName: "UserPasswordHistory",
        tableName: "user_password_history",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "使用者舊密碼紀錄",
    }
);

UserPasswordHistory.belongsTo(Users, { foreignKey: "user_id" });

module.exports = UserPasswordHistory;
