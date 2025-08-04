const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Expert = require("../schema/expert");
class RecommendPreset extends Model {}

RecommendPreset.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        text: {
            type: DataTypes.STRING(255),
            comment: "提示詞",
        },
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
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
        modelName: "RecommendPreset",
        tableName: "recommend_preset",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "預設提示詞",
    }
);
RecommendPreset.belongsTo(Expert, { foreignKey: "expert_id" });
module.exports = RecommendPreset;
