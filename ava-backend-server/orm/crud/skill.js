const Skill = require("../schema/skill");
const Expert = require("../schema/expert");

const ExpertSkillMapping = require("../schema/expert_skill_mapping");
const { Sequelize, Op } = require("sequelize");
const sequelize = require("../../orm/sequelize");

exports.getSkillJoinExpert = async function (skill_id) {
    let rs = null;
    try {
        const is_enable = 1;
        const whereCondition = { is_enable };
        if (skill_id) {
            whereCondition.id = skill_id;
        }

        rs = await Skill.findAll({
            where: whereCondition,
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT name 
                            FROM users 
                            WHERE users.id = "Skill".created_by
                        )`),
                        "created_by_name",
                    ],
                    [
                        sequelize.literal(`(
                            SELECT name 
                            FROM users 
                            WHERE users.id = "Skill".updated_by
                        )`),
                        "updated_by_name",
                    ],
                ],
            },
            include: [
                {
                    model: Expert,
                    required: false,
                    attributes: ["avatar", "name"],
                    through: {
                        attributes: [],
                    },
                },
            ],
            group: ["Skill.id", "Experts.id"],
            order: [["create_time", "DESC"]],
        });
    } catch (e) {
        console.error(e.message);
    }
    return rs;
};
exports.setSkillById = async function (id, name, config_jsonb, class_name, icon, describe, uid) {
    let rs = null;
    try {
        rs = await Skill.update(
            { name, config_jsonb, class: class_name, icon, describe, updated_by: uid },
            { where: { id } }
        );
    } catch (e) {
        console.error(e.message);
    }
    return rs;
};
exports.createSkill = async function (id, name, describe, config_jsonb, class_name, icon, uid) {
    let rs = null;
    try {
        rs = await Skill.create({ id, name, describe, config_jsonb, class: class_name, icon, created_by: uid });
    } catch (e) {
        console.error(e.message);
    }
    return rs;
};
exports.softDeleteSkillById = async function (id, is_enable) {
    let rs = null;
    try {
        rs = await Skill.update({ is_enable }, { where: { id } });
    } catch (e) {
        console.error(e.message);
    }
    return rs;
};
