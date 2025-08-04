const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Expert = require("../schema/expert");
class ExpertEmbeddingTokenLog extends Model {}

ExpertEmbeddingTokenLog.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        model: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        prompt_token: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        prompt_rate: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        price: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            comment: "比率換算後金額",
        },
        price_currency: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "USD",
            comment: "幣別",
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
        modelName: "ExpertEmbeddingTokenLog",
        tableName: "expert_embedding_token_log",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
ExpertEmbeddingTokenLog.belongsTo(Expert, { foreignKey: "expert_id" });
module.exports = ExpertEmbeddingTokenLog;
