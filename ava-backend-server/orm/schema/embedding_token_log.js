const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Datasets = require("../schema/datasets");
class EmbeddingTokenLog extends Model {}

EmbeddingTokenLog.init(
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
        datasets_id: {
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
        modelName: "EmbeddingTokenLog",
        tableName: "embedding_token_log",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
EmbeddingTokenLog.belongsTo(Datasets, { foreignKey: "datasets_id" });
module.exports = EmbeddingTokenLog;
