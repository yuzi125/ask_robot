const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Datasets = require("./datasets");
class OcrDocumentsTokenLog extends Model {}

OcrDocumentsTokenLog.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        datasets_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "datasets的id",
        },
        upload_document_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "document_image_store的upload_document_id",
        },
        model: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        document_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        prompt_token: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        completion_token: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        prompt_rate: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            comment: "input 比率",
        },
        completion_rate: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            comment: "output 比率",
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
        modelName: "OcrDocumentsTokenLog",
        tableName: "ocr_documents_token_log",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
OcrDocumentsTokenLog.belongsTo(Datasets, { foreignKey: "datasets_id" });
module.exports = OcrDocumentsTokenLog;
