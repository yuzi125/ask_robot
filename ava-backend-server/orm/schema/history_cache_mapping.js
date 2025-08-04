const { DataTypes, Model, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const HistoryMessages = require("../schema/history_messages");
const CachedKnowledge = require("../schema/cached_knowledge");

class HistoryCacheMapping extends Model {}

HistoryCacheMapping.init(
    {
        history_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: HistoryMessages,
                key: "id",
            },
            onDelete: "CASCADE",
        },
        cache_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            references: {
                model: CachedKnowledge,
                key: "id",
            },
            onDelete: "CASCADE",
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
        modelName: "HistoryCacheMapping",
        tableName: "history_cache_mapping",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);

HistoryMessages.belongsToMany(CachedKnowledge, {
    through: HistoryCacheMapping,
    foreignKey: "history_id",
    otherKey: "cache_id",
});

CachedKnowledge.belongsToMany(HistoryMessages, {
    through: HistoryCacheMapping,
    foreignKey: "cache_id",
    otherKey: "history_id",
});

module.exports = HistoryCacheMapping;
