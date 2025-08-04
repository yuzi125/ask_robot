const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const ApiKeys = require("./api_keys");

class ApiKeyScopes extends Model {}

ApiKeyScopes.init(
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
        path: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "API 路徑",
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
        modelName: "ApiKeyScopes",
        tableName: "api_key_scopes",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "API Key 路徑白名單",
    }
);

ApiKeyScopes.belongsTo(ApiKeys, { foreignKey: "api_key_id" });
ApiKeys.hasMany(ApiKeyScopes, { foreignKey: "api_key_id" });

module.exports = ApiKeyScopes;
