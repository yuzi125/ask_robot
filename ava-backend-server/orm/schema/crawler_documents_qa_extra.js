const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Datasets = require("../schema/datasets");
const CrawlerDocumentsQa = require("../schema/crawler_documents_qa");
class CrawlerDocumentsQaExtra extends Model {}

CrawlerDocumentsQaExtra.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        crawler_documents_qa_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
            unique: true,
            comment: "null則是新創",
        },
        datasets_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        qa_data: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "格式:{question:'''',answer:'''',show_status:1}show_status:使用者是否看的到",
        },
        crawler_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
            comment: "是否啟用",
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
        modelName: "CrawlerDocumentsQaExtra",
        tableName: "crawler_documents_qa_extra",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "自定義QA",
    }
);

CrawlerDocumentsQaExtra.belongsTo(Datasets, { foreignKey: "datasets_id" });
CrawlerDocumentsQaExtra.belongsTo(CrawlerDocumentsQa, { foreignKey: "crawler_documents_qa_id" });
module.exports = CrawlerDocumentsQaExtra;
