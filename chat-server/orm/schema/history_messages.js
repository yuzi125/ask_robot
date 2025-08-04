const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class HistoryMessages extends Model {}

HistoryMessages.init(
    {
        input: {
            type: DataTypes.TEXT,
            comment: "剛輸入時",
        },
        output: {
            type: DataTypes.JSONB,
            comment: "返回給使用者時",
        },
        users_id: {
            type: DataTypes.STRING(50),
            comment: "使用者id",
        },
        expert_id: {
            type: DataTypes.STRING(50),
            comment: "專家id",
        },
        type: {
            type: DataTypes.SMALLINT,
            comment: "類型 0:error 1:llm_model 2:skill 3:form 4:cache 9:NOANSWER",
        },
        model_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "gpt-3.5-turbo",
        },
        feedback_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "評論的 id 有值的話代表這筆對話被評論過",
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
        model_params: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
            comment: "model 使用的 params",
        },
        device: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,
            comment: "設備資訊(browser, line)",
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
        modelName: "HistoryMessages",
        tableName: "history_messages",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "單純記錄初始輸入與回傳輸出方便統計",
    }
);

module.exports = HistoryMessages;
