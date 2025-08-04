const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Crawler = require("../schema/crawler");
class CrawlerExecuteRecord extends Model {}

CrawlerExecuteRecord.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        crawler_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            onDelete: "CASCADE",
        },
        finish_time: {
            type: DataTypes.DATE,
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
        modelName: "CrawlerExecuteRecord",
        tableName: "crawler_execute_record",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
CrawlerExecuteRecord.belongsTo(Crawler, { foreignKey: "crawler_id" });
module.exports = CrawlerExecuteRecord;
