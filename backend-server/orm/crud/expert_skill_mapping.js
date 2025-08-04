const ExpertSkillMapping = require("../schema/expert_skill_mapping");

exports.deleteExpertSkillMappingBySkillId = async function (skill_id) {
    let rs = null;
    try {
        rs = await ExpertSkillMapping.destroy({ where: { skill_id } });
    } catch (e) {
        console.error(e.message);
    }
    return rs;
};
