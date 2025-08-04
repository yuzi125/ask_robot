const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class CrawlerQAInfoType extends Model {}

CrawlerQAInfoType.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        type_name: {
            type: DataTypes.STRING(50),
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
        modelName: "CrawlerQAInfoType",
        tableName: "crawler_qa_info_type",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);

module.exports = CrawlerQAInfoType;
