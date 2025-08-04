const { DataTypes, Model, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class DefaultPrompt extends Model {}
DefaultPrompt.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "Prompt名稱",
        },
        describe: {
            type: DataTypes.STRING(200),
            allowNull: false,
            defaultValue: "",
            comment: "Prompt簡易說明",
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "",
            comment: "Prompt實際內容",
        },
        is_enable: {
            type: DataTypes.INTEGER,
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
        modelName: "DefaultPrompt",
        tableName: "default_prompt",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
module.exports = DefaultPrompt;
