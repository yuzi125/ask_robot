const { DataTypes, Model, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Expert = require("../schema/expert");
const Skill = require("../schema/skill");

class ExpertSkillMapping extends Model {}
ExpertSkillMapping.init(
    {
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            onDelete: "CASCADE",
        },
        skill_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            onDelete: "CASCADE",
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
    },
    {
        sequelize,
        modelName: "ExpertSkillMapping",
        tableName: "expert_skill_mapping",
        createdAt: "create_time",
        updatedAt: false,
        underscored: true,
    }
);

Skill.belongsToMany(Expert, {
    through: ExpertSkillMapping,
    foreignKey: "skill_id", // 明確指定 Skill 的外鍵
    otherKey: "expert_id", // 指定對方鍵，即 Expert 的外鍵
});

Expert.belongsToMany(Skill, {
    through: ExpertSkillMapping,
    foreignKey: "expert_id", // 明確指定 Expert 的外鍵
    otherKey: "skill_id", // 指定對方鍵，即 Skill 的外鍵
});

module.exports = ExpertSkillMapping;
