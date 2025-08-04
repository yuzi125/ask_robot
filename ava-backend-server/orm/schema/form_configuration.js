const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class FormConfiguration extends Model {}

FormConfiguration.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        form_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        form_description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        form_config: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
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
        modelName: "FormConfiguration",
        tableName: "form_configuration",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "表單紀錄表",
    }
);

module.exports = FormConfiguration;
