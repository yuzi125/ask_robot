const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("./users");

class ApiKeys extends Model {}

ApiKeys.init(
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
            comment: "使用者 ID",
        },
        key: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            comment: "API Key 值",
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "API Key 用途說明",
        },
        status: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
            comment: "狀態 (1:啟用, 0:停用)",
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
        modelName: "ApiKeys",
        tableName: "api_keys",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "API Keys",
    }
);

ApiKeys.belongsTo(Users, { foreignKey: "user_id" });

module.exports = ApiKeys;
