const { DataTypes, Model, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class ModelList extends Model {}
ModelList.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
            comment: "自增id",
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "模型顯示名稱",
        },
        vendor: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "模型供應商",
        },
        model_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "模型的value 例如(gpt-4o)",
        },
        config: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: "預設模型的config (選了以後會把config讀出來放到專家的config_jsonb)",
        },
        is_enable: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: "開啟或關閉此模型顯示",
        },
        prompt_rate: {
            type: DataTypes.FLOAT,
            allowNull: true,
            defaultValue: 0.0,
            comment: "統計花費token時用於 prompt 的單價",
        },
        completion_rate: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0,
            comment: "統計花費token時用於 output 的單價",
        },
        model_type: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: 0,
            comment: "模型要在哪裡顯示的type (ex: search_model、embedding、kor、intention)",
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
        modelName: "ModelList",
        tableName: "model_list",
        createdAt: "create_time",
        updatedAt: "update_time",
        comment: "模型表",
        underscored: true,
    }
);

module.exports = ModelList;
