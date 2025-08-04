const { DataTypes, Model, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class Skill extends Model {}
Skill.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        describe: {
            type: DataTypes.STRING(1000),
            allowNull: true,
        },
        config_jsonb: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        class: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        is_enable: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        state: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        icon: {
            type: DataTypes.STRING(1000),
            allowNull: true,
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
        required_login_type: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
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
        modelName: "Skill",
        tableName: "skill",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);
module.exports = Skill;
