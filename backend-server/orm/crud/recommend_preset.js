const RecommendPreset = require("../schema/recommend_preset");
const { Sequelize } = require("sequelize");

exports.getRecommendPreset = async function () {
    let rs = null;
    try {
        rs = await RecommendPreset.findAll({attributes:['id','text','expert_id']});
    } catch (e) {
        console.error(e.message);
    }
    return rs;
};
// exports.setRecommendPreset = async function (id, name, config_jsonb, class_name, icon) {
//     let rs = null;
//     try {
//         rs = await Skill.update({ name, config_jsonb, class: class_name, icon }, { where: { id } });
//     } catch (e) {
//         console.error(e.message);
//     }
//     return rs;
// };
// exports.createSkill = async function (id, name, describe, config_jsonb, class_name, icon) {
//     let rs = null;
//     try {
//         rs = await Skill.create({ id, name, describe, config_jsonb, class: class_name, icon });
//     } catch (e) {
//         console.error(e.message);
//     }
//     return rs;
// };
