const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const ApiKeys = require("./api_keys");
const ApiKeyUsage = require("./api_key_usage_logs");
class ApiKeyMapping extends Model {}

ApiKeyMapping.init(
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
        usage_id: {
            type: DataTypes.BIGINT,
            allowNull: true,
            comment: "使用記錄 ID",
        },
        mapping_type: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            comment: "對應類型 (1:專家, 2:知識庫)",
        },
        mapping_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "對應的 ID (expert_id 或 dataset_id)",
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
        modelName: "ApiKeyMapping",
        tableName: "api_key_mapping",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "API Key 使用記錄",
    }
);

ApiKeyMapping.belongsTo(ApiKeys, { foreignKey: "api_key_id" });
ApiKeyMapping.belongsTo(ApiKeyUsage, { foreignKey: "usage_id" });

module.exports = ApiKeyMapping;
