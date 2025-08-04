const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const CrawlerType = require("../schema/crawler_type");
class Crawler extends Model {}

Crawler.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        config_jsonb: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: "設定json",
        },
        crawler_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            onDelete: "CASCADE",
        },
        is_show: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
            comment: "是否顯示在後台",
        },
        domain: {
            type: DataTypes.STRING(1000),
            comment: "域名",
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "1",
            comment: "站名",
        },
        site_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "爬蟲站點id (會先拿這個來當做資料夾名稱)",
        },
        alias: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "爬蟲站點別名",
        },
        use_selenium: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            comment: "是否使用 selenium 0:否 1:是",
        },
        download_attachment: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: "是否開放下載附件 0:否 1:是",
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
        modelName: "Crawler",
        tableName: "crawler",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "爬蟲",
    }
);
Crawler.belongsTo(CrawlerType, { foreignKey: "crawler_type_id" });
module.exports = Crawler;
