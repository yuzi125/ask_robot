const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("./users");

class TwoFactorAuthentication extends Model {}

TwoFactorAuthentication.init(
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
        secret_key: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: "google authentication 密鑰",
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: "是否啟用google authentication",
        },
        last_device: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        ip: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        last_auth_time: {
            type: DataTypes.DATE,
            allowNull: true,
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
        modelName: "TwoFactorAuthentication",
        tableName: "two_factor_authentication",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "二次驗證表",
    }
);

TwoFactorAuthentication.belongsTo(Users, { foreignKey: "user_id" });

module.exports = TwoFactorAuthentication;
