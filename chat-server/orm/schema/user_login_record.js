const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("../schema/users");
class UserLoginRecord extends Model {}

UserLoginRecord.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        login_type_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(255),
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
        modelName: "UserLoginRecord",
        tableName: "user_login_record",
        createdAt: "create_time",
        updatedAt: false,
        underscored: true,
    }
);
UserLoginRecord.belongsTo(Users, { foreignKey: "user_id" });

module.exports = UserLoginRecord;
