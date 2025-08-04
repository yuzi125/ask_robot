const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class UserType extends Model {}

UserType.init(
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
        type_value:{
            type: DataTypes.STRING(50),
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
    },
    {
        sequelize,
        modelName: "UserType",
        tableName: "user_type",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "使用者類別",
    }
);


module.exports = UserType;
