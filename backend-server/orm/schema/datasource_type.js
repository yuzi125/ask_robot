const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class DataSourceType extends Model {}

DataSourceType.init(
    {
        id: {
            type: DataTypes.STRING(2),
            allowNull: false,
            primaryKey: true,
            comment: "來源id",
        },
        mark: {
            type: DataTypes.STRING(50),
            comment: "來源名稱",
        },
        name: {
            type: DataTypes.STRING(50),
            comment: "主表名",
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
        modelName: "DataSourceType",
        tableName: "datasource_type",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);

module.exports = DataSourceType;
