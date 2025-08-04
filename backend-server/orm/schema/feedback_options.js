const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class FeedbackOptions extends Model {}

FeedbackOptions.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "選項名稱",
        },
        status: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "選項狀態，user 開頭的只有前台使用者看的到，admin 是後台管理者看的到，feedback_tags是此評論的分類",
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
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
        modelName: "FeedbackOptions",
        tableName: "feedback_options",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "回饋的選項 有正面或負面狀態",
    }
);

module.exports = FeedbackOptions;
