// models/api_key_domains.js
const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const ApiKeys = require("./api_keys");

class ApiKeyDomains extends Model {}

ApiKeyDomains.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        api_key_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            comment: "API Key ID",
        },
        domain: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "網域名稱",
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
        modelName: "ApiKeyDomains",
        tableName: "api_key_domains",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "API Key 網域白名單",
    }
);

ApiKeyDomains.belongsTo(ApiKeys, { foreignKey: "api_key_id" });
ApiKeys.hasMany(ApiKeyDomains, { foreignKey: "api_key_id" });

module.exports = ApiKeyDomains;
