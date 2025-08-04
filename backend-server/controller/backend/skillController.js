const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const Skill = require("../../orm/crud/skill");
const ExpertSkillMapping = require("../../orm/crud/expert_skill_mapping");
const pythonAPI = require("../../utils/pythonAPI");
const axios = require("axios");
const { filterSkillsByPermission } = require("../../utils/permissionFilter");
const { logActivity, AUDIT_LOG_ACTION_TYPE, AUDIT_LOG_ENTITY_TYPE } = require("../../utils/auditLog");
const logRouteDetails = require("../routeNameLog");
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;
const AUDIT_LOG_TARGET_CATEGORY = "skill";

exports.getPresetSkillConfig = async function (req, res) {
    logRouteDetails("skillController.getPresetSkillConfig", req);
    let rsmodel = new responseModel();
    try {
        // let rs = await sql.query("select value from settings where key = 'default_expert_model_config'");
        // const skill_config = rs.rows[0].value;
        let rs = await sql.query("select value from settings where key = 'default_skill_model_config'");
        let skill_config_str = rs.rows[0].value;

        // 將字串解析為 JSON 對象
        let skill_config = JSON.parse(skill_config_str);

        // rsmodel.data = skill_config;
        rsmodel.data = skill_config;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
exports.create = async function (req, res) {
    logRouteDetails("skillController.create", req);
    let rsmodel = new responseModel();
    try {
        let { icon, name, class_name, config_jsonb, describe } = JSON.parse(req.body);
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        console.info("skillController.create:", JSON.parse(req.body));
        if (!name.trim() || !class_name.trim() || !config_jsonb.trim()) {
            rsmodel.message = "參數不完整或格式錯誤";
            res.json(rsmodel);
            return;
        }
        config_jsonb = JSON.parse(config_jsonb);
        // let chk = await sql.query("select count(*) c from skill where class = $1", [class_name]);
        // if (chk.rows[0].c > 0) {
        //     rsmodel.message = "class名稱重複";
        //     res.json(rsmodel);
        //     return;
        // }

        const uuid = uuidv4();
        // const describe = `start using your api ${name}`;
        await Skill.createSkill(uuid, name, describe, config_jsonb, class_name, icon, uid);

        rsmodel.data = uuid;
        rsmodel.code = 0;

        await logActivity({
            userId: uid,
            username: username || uid,
            targetId: uuid,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            actionType: AUDIT_LOG_ACTION_TYPE.CREATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.CREATE_SKILL,
            parameters: {
                skill_id: uuid,
                name,
                class_name,
                config_jsonb,
                describe,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e);
        rsmodel.message = e.message;
        rsmodel.code = 1;
    }
    res.json(rsmodel);
};

exports.getSkill = async function (req, res) {
    logRouteDetails("skillController.getSkill", req);
    let rsmodel = new responseModel();
    try {
        let { skill_id } = req.query;
        console.info("skillController.getSkill:", req.query);
        let userNo = req.session.userInfo.user_no;
        let rs = await Skill.getSkillJoinExpert(skill_id);
        // 取得 knowledgePermission 設定
        const sqlStr = `SELECT value FROM settings WHERE key='knowledge_permission'`;
        const { rows } = await sql.query(sqlStr);
        const knowledgePermission = JSON.parse(rows[0].value);
        if (knowledgePermission) {
            rs = filterSkillsByPermission(rs, userNo, knowledgePermission);
        }
        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.upadteSkill = async function (req, res) {
    logRouteDetails("skillController.upadteSkill", req);
    let rsmodel = new responseModel();
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let { skill_id, icon, name, class_name, config_jsonb, describe } = JSON.parse(req.body);
        console.info("skillController.upadteSkill:", JSON.parse(req.body));
        if (!skill_id.trim() || !name.trim() || !class_name.trim() || !config_jsonb.trim()) {
            rsmodel.message = "參數不完整或格式錯誤";
            res.json(rsmodel);
            return;
        }
        config_jsonb = JSON.parse(config_jsonb);
        await Skill.setSkillById(skill_id, name, config_jsonb, class_name, icon, describe, uid);
        // let rs1 = await axios.post(`${process.env.PYTHON_API_HOST}/reloadDatasets`, {});
        await pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST, { ava_token: `ava:${req.sessionID}` });
        rsmodel.code = 0;

        await logActivity({
            userId: uid,
            username: username || uid,
            targetId: skill_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_SKILL,
            parameters: {
                skill_id,
                name,
                class_name,
                config_jsonb,
                describe,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e.message);
    }
    res.json(rsmodel);
};

exports.deleteSkill = async function (req, res) {
    logRouteDetails("skillController.deleteSkill", req);
    let rsmodel = new responseModel();
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        console.info("skillController.deleteSkill:", JSON.parse(req.body));
        let { skill_id } = JSON.parse(req.body);
        if (!skill_id.trim()) {
            rsmodel.message = "缺少skill_id";
            res.json(rsmodel);
            return;
        }
        // 變更技能狀態為不可用。
        await Skill.softDeleteSkillById(skill_id, 0);
        // 刪除mapping表中與該技能有關的資料。
        await ExpertSkillMapping.deleteExpertSkillMappingBySkillId(skill_id);

        // let rs = await sql.query('update skill set "is_enable" = 0 where id = $1', [skill_id]);
        // if (rs.rowCount === 0) return;
        // let rs1 = await axios.post(`${process.env.PYTHON_API_HOST}/reloadDatasets`, {});
        await pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST, {
            ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
        });
        rsmodel.code = 0;

        await logActivity({
            userId: uid,
            username: username || uid,
            targetId: skill_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            actionType: AUDIT_LOG_ACTION_TYPE.DELETE,
            entityType: AUDIT_LOG_ENTITY_TYPE.DELETE_SKILL,
            parameters: {
                skill_id,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e.message);
    }
    res.json(rsmodel);
};
