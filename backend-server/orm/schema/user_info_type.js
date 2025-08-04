const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class UserInfoType extends Model {}

UserInfoType.init(
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
        modelName: "UserInfoType",
        tableName: "user_info_type",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);

module.exports = UserInfoType;