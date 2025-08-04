const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const ApiKeys = require("./api_keys");

class ApiKeyUsage extends Model {}

ApiKeyUsage.init(
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
        endpoint: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "API 路徑",
        },
        method: {
            type: DataTypes.STRING(10),
            allowNull: false,
            comment: "HTTP 方法",
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
    },
    {
        sequelize,
        modelName: "ApiKeyUsage",
        tableName: "api_key_usage",
        timestamps: false,
        comment: "API Key 使用記錄",
        hooks: {
            afterSync: async () => {
                await sequelize.query(`
                  CREATE INDEX IF NOT EXISTS idx_api_key_id ON api_key_usage(api_key_id);
                `);
            },
        },
    }
);

ApiKeyUsage.belongsTo(ApiKeys, { foreignKey: "api_key_id" });
ApiKeys.hasMany(ApiKeyUsage, { foreignKey: "api_key_id" });

module.exports = ApiKeyUsage;
