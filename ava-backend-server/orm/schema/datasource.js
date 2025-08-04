const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const DatasourceType = require("../schema/datasource_type");
const Datasets = require("../schema/datasets");
class Datasource extends Model {}

Datasource.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        datasets_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: "datasource_un",
            onDelete: "CASCADE",
        },
        config_jsonb: {
            type: DataTypes.JSONB,
        },
        type: {
            type: DataTypes.STRING(2),
            allowNull: false,
            unique: "datasource_un",
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: "0:禁用 1:啟用",
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
        modelName: "Datasource",
        tableName: "datasource",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "數據源",
    }
);
Datasource.belongsTo(Datasets, { foreignKey: "datasets_id" });
Datasource.belongsTo(DatasourceType, { foreignKey: "type" });
module.exports = Datasource;
