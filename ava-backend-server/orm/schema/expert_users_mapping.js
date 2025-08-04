const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Users = require("../schema/users");
const Expert = require("../schema/expert");
class ExpertUsersMapping extends Model {}

ExpertUsersMapping.init(
    {
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "專家id",
        },
        users_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "使用者id",
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
    },
    {
        sequelize,
        modelName: "ExpertUsersMapping",
        tableName: "expert_users_mapping",
        createdAt: "create_time",
        updatedAt: false,
        underscored: true,
    }
);
Users.belongsToMany(Expert, { 
    through: ExpertUsersMapping,
    foreignKey: 'users_id', // 明確指定 Users 的外鍵
    otherKey: 'expert_id' // 指定對方鍵，即 Expert 的外鍵
});
Expert.belongsToMany(Users, { 
    through: ExpertUsersMapping,
    foreignKey: 'expert_id', // 明確指定 Expert 的外鍵
    otherKey: 'users_id' // 指定對方鍵，即 Users 的外鍵
});

module.exports = ExpertUsersMapping;
