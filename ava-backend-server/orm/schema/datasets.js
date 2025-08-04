const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class Datasets extends Model {}

Datasets.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
            comment: "數據集id",
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "數據集名稱",
        },
        describe: {
            type: DataTypes.STRING(1000),
            comment: "描述",
        },
        config_jsonb: {
            type: DataTypes.JSONB,
            comment: "prompt設定",
        },
        folder_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            comment: "不可改資料夾名稱",
        },
        is_enable: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: "0:禁用1:啟用",
        },
        state: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        icon: {
            type: DataTypes.STRING(1000),
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
        created_by: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "創建者",
        },
        updated_by: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "更新者",
        },
    },
    {
        sequelize,
        modelName: "Datasets",
        tableName: "datasets",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "資料集",
    }
);

module.exports = Datasets;
