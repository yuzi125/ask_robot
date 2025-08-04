const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class CrawlerSyncSchedule extends Model {}

CrawlerSyncSchedule.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            comment: "自增id",
        },
        dataset_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "知識庫 id ",
        },
        datasource_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "數據源 id",
        },
        crawler_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "爬蟲 id",
        },
        sync_days: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "同步週期（天數）",
        },
        sync_time: {
            type: DataTypes.TIME,
            allowNull: true,
            comment: "同步時間",
        },
        next_sync_date: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "下次同步日期時間",
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
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
        modelName: "CrawlerSyncSchedule",
        tableName: "crawler_sync_schedule",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "爬蟲同步排程表",
    }
);

module.exports = CrawlerSyncSchedule;
