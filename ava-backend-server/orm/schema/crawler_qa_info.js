const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize"); // Adjust this import according to your actual database file location
const CrawlerQaInfoType = require("../schema/crawler_qa_info_type");
const CrawlerDocumentsQa = require("../schema/crawler_documents_qa");
class CrawlerQAInfo extends Model {}

CrawlerQAInfo.init(
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },
        qa_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        value: {
            type: DataTypes.STRING(500),
            allowNull: false,
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
        modelName: "CrawlerQAInfo",
        tableName: "crawler_qa_info",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
CrawlerQAInfo.belongsTo(CrawlerQaInfoType, { foreignKey: "type_id" });
CrawlerQAInfo.belongsTo(CrawlerDocumentsQa, { foreignKey: "qa_id" });
module.exports = CrawlerQAInfo;
