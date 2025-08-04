const { Sequelize, Model, DataTypes } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("../schema/users");
const Expert = require("../schema/expert");
class RecommendHistory extends Model {}

RecommendHistory.init(
    {
        users_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            onDelete: "CASCADE",
            comment: "使用者id",
        },
        text: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "提示詞",
        },
        time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            comment: "歷史訊息時間",
        },
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
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
        modelName: "RecommendHistory",
        tableName: "recommend_history",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "歷史提示詞",
    }
);
RecommendHistory.belongsTo(Users, { foreignKey: "users_id" });
RecommendHistory.belongsTo(Expert, { foreignKey: "expert_id" });
module.exports = RecommendHistory;
