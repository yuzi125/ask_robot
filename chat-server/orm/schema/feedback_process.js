const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class FeedbackProcess extends Model {}

FeedbackProcess.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        feedback_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        feedback_options_ids: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: "回饋選項的 id 陣列",
        },
        tags_id: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: "管理者給這則評論的標籤",
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "回饋的評論",
        },
        user_type: {
            type: DataTypes.ENUM("user", "admin"),
            allowNull: false,
            comment: "使用者的類型",
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "使用者的 id",
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
        modelName: "FeedbackProcess",
        tableName: "feedback_process",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "記錄回饋流程",
    }
);

module.exports = FeedbackProcess;
