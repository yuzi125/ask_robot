const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class CrawlerAttachmentHash extends Model {}

CrawlerAttachmentHash.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
            comment: "自增主鍵",
        },
        url: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "下載的URL",
        },
        hash: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "檔案的MD5雜湊值",
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
        modelName: "CrawlerAttachmentHash",
        tableName: "crawler_attachment_hash",
        createdAt: "create_time",
        updatedAt: "update_time",
        comment: "爬蟲附件雜湊表",
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ["hash"],
                name: "crawler_attachment_hash_unique",
            },
        ],
    }
);

module.exports = CrawlerAttachmentHash;
