const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class GroupPermission extends Model {}

GroupPermission.init(
    {
        groupId: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        groupName: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        groupMember: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
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
        remark: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "GroupPermission",
        tableName: "group_permissions",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "群組授權資料",
    }
);

module.exports = GroupPermission;
