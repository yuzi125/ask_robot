const { Sequelize, Model, DataTypes } = require("sequelize");
const sequelize = require("../sequelize");
const CrawlerDocuments = require("./crawler_documents");

class CrawlerDocumentsExtra extends Model {}

CrawlerDocumentsExtra.init(
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        crawler_documents_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            references: {
                model: CrawlerDocuments,
                key: "id",
            },
            comment: "關聯爬蟲文件表",
        },
        extra_text: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "補全的文本",
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
            comment: "默認啟用",
        },
        is_included_in_large_chunk: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: "是否加入在大 chunk 中",
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
        modelName: "CrawlerDocumentsExtra",
        tableName: "crawler_documents_extra",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "爬蟲文件補全表",
    }
);

// 建立關聯
CrawlerDocumentsExtra.belongsTo(CrawlerDocuments, {
    foreignKey: "crawler_documents_id",
    targetKey: "id",
});
CrawlerDocuments.hasOne(CrawlerDocumentsExtra, {
    foreignKey: "crawler_documents_id",
    sourceKey: "id",
});

module.exports = CrawlerDocumentsExtra;
