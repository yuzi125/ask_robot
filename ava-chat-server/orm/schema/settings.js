const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class Settings extends Model {}

Settings.init(
    {
        key: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        value: {
            type: DataTypes.TEXT,
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
        remark: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "Settings",
        tableName: "settings",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "各種系統設定",
    }
);

module.exports = Settings;
