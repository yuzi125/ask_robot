const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const CrawlerDocuments = require("../schema/crawler_documents");
class CrawlerDocumentsQa extends Model {}

CrawlerDocumentsQa.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        question_original: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "原本的問題",
        },
        answer_original: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "原本的答案",
        },
        question: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "問題",
        },
        answer: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "答案",
        },
        adorn: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "修飾過的答案",
        },
        crawler_documents_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "關聯爬蟲文件",
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
            comment: "是否啟用",
        },
        crawler_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "還未關聯爬蟲id",
        },
        info: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "網站本身如果有qa的id",
        },
        hash: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "qa的md5值",
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
        modelName: "CrawlerDocumentsQA",
        tableName: "crawler_documents_qa",
        createdAt: "create_time",
        updatedAt: "update_time",
        comment: "爬到的文件QA",
        underscored: true,
    }
);

CrawlerDocumentsQa.belongsTo(CrawlerDocuments, { foreignKey: "crawler_documents_id" });
module.exports = CrawlerDocumentsQa;
