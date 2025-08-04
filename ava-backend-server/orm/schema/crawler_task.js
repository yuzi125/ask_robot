const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class CrawlerTask extends Model {}

CrawlerTask.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        crawler_synchronize_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: "crawler_synchronize",
                key: "id",
            },
        },
        spider_uuid: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        site_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "pending",
        },
        progress: {
            type: DataTypes.JSONB,
            comment: "爬蟲進度和狀態(某天或許會用到)",
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
        modelName: "CrawlerTask",
        tableName: "crawler_tasks",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "爬蟲任務表",
        indexes: [
            {
                unique: true,
                fields: ["crawler_synchronize_id", "spider_uuid", "site_id"],
                name: "unique_task",
            },
        ],
    }
);

module.exports = CrawlerTask;
