const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class TwoFactorAuthHistory extends Model {}

TwoFactorAuthHistory.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "使用者ID",
        },
        device: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ip: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        auth_time: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: "上一次被驗證的時間",
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
        modelName: "TwoFactorAuthHistory",
        tableName: "two_factor_auth_history",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "二次驗證表",
    }
);

module.exports = TwoFactorAuthHistory;
