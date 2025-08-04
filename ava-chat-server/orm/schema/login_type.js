const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class LoginType extends Model {}

LoginType.init(
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
        type_value: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
        },
        use_two_factor_authentication: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
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
        modelName: "LoginType",
        tableName: "login_type",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);

module.exports = LoginType;
