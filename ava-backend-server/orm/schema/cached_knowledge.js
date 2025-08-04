const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Expert = require("./expert");

class CachedKnowledge extends Model {}

CachedKnowledge.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
            comment: "uuid",
        },
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "專家id",
        },
        model_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "模型名稱",
        },
        model_params: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
            comment: "model 使用的 params",
        },
        model_prompt: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "model 使用的 prompt",
        },
        question: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        answer: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        related_chunk_ids: {
            type: DataTypes.JSONB,
            allowNull: false,
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
        link_level: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: "鏈接級別，預設值為 0",
        },
        no_answer: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
            comment: "是否沒答案 (true: 沒答案, false: 有答案)",
        },
    },
    {
        sequelize,
        modelName: "CachedKnowledge",
        tableName: "cached_knowledge",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "快取知識庫",
    }
);

CachedKnowledge.belongsTo(Expert, { foreignKey: "expert_id" });

module.exports = CachedKnowledge;
