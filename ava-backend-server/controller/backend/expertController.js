const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const { Op, Sequelize } = require("sequelize");
const pythonAPI = require("../../utils/pythonAPI");
const { calculateTotalSpend } = require("../../utils/common");
const logRouteDetails = require("../routeNameLog");
const sequelize = require("../../orm/sequelize");
const CachedKnowledge = require("../../orm/schema/cached_knowledge");
const Expert = require("../../orm/schema/expert");
const HistoryMessages = require("../../orm/schema/history_messages");
const ParentChunks = require("../../orm/schema/parent_chunks");
const ModelTokenLog = require("../../orm/schema/model_token_log");

const dayjs = require("dayjs");
const crypto = require("crypto");
const {
    filterDatasetsByPermission,
    filterExpertsByPermission,
    filterBindsByPermission,
    filterSkillsByPermission,
} = require("../../utils/permissionFilter");

const { logActivity, AUDIT_LOG_ACTION_TYPE, AUDIT_LOG_ENTITY_TYPE } = require("../../utils/auditLog");

const { filterExpertsByCSCPermission } = require("../../utils/csc-permissionFilter");

const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

const SSO_TYPE = process.env.SSO_TYPE;

const AUDIT_LOG_TARGET_CATEGORY = "expert";

exports.create = async function (req, res) {
    logRouteDetails("expertController.create", req);
    let rsmodel = new responseModel();
    let rs;
    try {
        const { name, expertId } = JSON.parse(req.body);
        console.info("expertController.create:", JSON.parse(req.body));
        const { uid = "", name: username = "" } = req.session.userInfo || {};

        // 如果有提供 expertId，先檢查是否已存在
        if (expertId) {
            const checkExist = await sql.query("SELECT id FROM expert WHERE id = $1", [expertId]);
            if (checkExist.rowCount > 0) {
                rsmodel.code = 1;
                rsmodel.message = "專家 ID 已存在";
                rsmodel.data = { isDuplicated: true };
                return res.json(rsmodel);
            }
        }

        function generateRandomString(length) {
            const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let randomString = "";
            for (let i = 0; i < length; i++) {
                const randomIndex = crypto.randomInt(0, characters.length);
                randomString += characters[randomIndex];
            }
            return randomString;
        }
        const randomString = generateRandomString(16);

        // 使用 expertId 或生成新的 uuid
        const id = expertId || uuidv4();
        const welcome = "歡迎使用";
        const avatar = "./robot.png";

        // 從 settings 表取得 default_export_model_config
        rs = await sql.query("select value from settings where key = 'default_expert_model_config'");

        const expert_config = rs.rows[0].value;
        rs = await sql.query(
            'insert into expert(id,"name",welcome,avatar,url,config_jsonb,created_by) values($1,$2,$3,$4,$5,$6,$7)',
            [id, name, welcome, avatar, randomString, expert_config, uid]
        );
        if (rs.rowCount === 0) return;
        rsmodel.data = id;
        rsmodel.code = 0;

        // 記錄審計日誌
        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.CREATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.CREATE_EXPERT,
            targetId: id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                expert_id: id,
                name: name,
                welcome: welcome,
                url: randomString,
                created_by: uid,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error("error in creating expert:", e);
        rsmodel.code = 1;
        rsmodel.message = "建立專家失敗";
    }
    res.json(rsmodel);
};

function findTotalDays(period) {
    let days = 0;
    let mons = 0;
    if (period.match("days")) {
        days = parseInt(period.replace(" days", ""));
    } else {
        mons = parseInt(period.replace(" mons", ""));
        const today = dayjs();
        const threeMonthsAgo = today.subtract(mons, "month");
        days = today.diff(threeMonthsAgo, "day");
    }
    return days || 0;
}

exports.getExpert = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("expertController.getExpert", req);
    let rsmodel = new responseModel();
    try {
        const { expert_id } = req.query;

        const userNo = req.session.userInfo.user_no;
        const compNo = req.session.userInfo.comp_no;

        const rs = await sql.query(
            `
            SELECT 
                expert.*,
                COALESCE(datasets_count.datasets_count, 0) AS datasets_count,
                COALESCE(skill_count.skill_count, 0) AS skill_count,
                created_user.name AS created_by_name,
                updated_user.name AS updated_by_name
            FROM 
                expert
            LEFT JOIN (
                SELECT 
                    COUNT(expert_id) AS datasets_count, expert_id
                FROM 
                    expert_datasets_mapping
                GROUP BY 
                    expert_id
            ) AS datasets_count ON expert.id = datasets_count.expert_id
            LEFT JOIN (
                SELECT 
                    COUNT(expert_id) AS skill_count, expert_id
                FROM 
                    expert_skill_mapping
                GROUP BY 
                    expert_id
            ) AS skill_count ON expert.id = skill_count.expert_id
            LEFT JOIN users AS created_user 
                ON expert.created_by = created_user.id
            LEFT JOIN users AS updated_user 
                ON expert.updated_by = updated_user.id
            WHERE 
                expert.is_enable = 1
                AND (COALESCE($1, '') = '' OR expert.id = ANY($1::text[]))
            ORDER BY 
                expert.create_time DESC
            `,
            [expert_id ? [expert_id] : null]
        );

        // 取得權限設置
        const { rows } = await sql.query(
            `SELECT value FROM settings WHERE key = 'knowledge_permission' and value is not null`
        );
        const knowledgePermission = JSON.parse(rows[0].value);

        // 過濾結果根據權限設置
        if (knowledgePermission) {
            if (SSO_TYPE === "csc") {
                rs.rows = await filterExpertsByCSCPermission(rs.rows, compNo, userNo, knowledgePermission);
            } else {
                rs.rows = filterExpertsByPermission(rs.rows, userNo, knowledgePermission);
            }
        }

        // 等待 filterExpertsByCSCPermission 回傳後再執行
        rsmodel.data = rs.rows;
        rsmodel.code = 0;
    } catch (e) {
        console.error("Error in getExpert:", e);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while fetching expert data.";
    }
    res.json(rsmodel);
};

exports.getExpertIdAndNameWithoutSelf = async function (req, res) {
    logRouteDetails("expertController.getExpertIdAndNameWithoutSelf", req);
    let rsmodel = new responseModel();
    try {
        let { expertId } = req.query;
        console.info("expertController.getExpertIdAndNameWithoutSelf:", req.query);

        let sqlstr = `select id,name from expert where is_enable = 1 and id != $1`;
        let sqlParams = [expertId];
        let rs = await sql.query(sqlstr, sqlParams);

        rsmodel.data = rs.rows;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.upadteExpert = async function (req, res) {
    logRouteDetails("expertController.upadteExpert", req);
    let rsmodel = new responseModel();
    try {
        const { id } = JSON.parse(req.body);
        if (!id) return;
        console.info("expertController.upadteExpert:", JSON.parse(req.body));
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        const processParams = JSON.parse(req.body);
        delete processParams.id;
        console.log("這裡");
        const keys = Object.keys(processParams);
        const values = Object.values(processParams);
        let sqlstr = "update expert set ";
        let i = 0;
        for (let key of keys) {
            if (i !== 0) sqlstr += ",";
            i++;
            sqlstr += `${key} = $${i}`;
        }
        // 增加 updated_by 欄位
        i++;
        sqlstr += `, updated_by = $${i}`;

        // 加入 where 條件
        i++;
        sqlstr += ` where id = $${i}`;

        let chk = await sql.query(sqlstr, [...values, uid, id]);
        if (chk.rowCount > 0) {
            rsmodel.code = 0;
        }

        // 記錄審計日誌
        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_EXPERT_CONFIG,
            targetId: id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                expert_id: id,
                processParams,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.updateExpertRecommendation = async function (req, res) {
    logRouteDetails("expertController.updateExpertRecommendation", req);
    let rsmodel = new responseModel();

    const { expertId, recommendationExpertsId } = JSON.parse(req.body);
    console.info("expertController.updateExpertRecommendation:", JSON.parse(req.body));
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;
            config["recommendation_experts"] = recommendationExpertsId;

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expertId]);

            rsmodel.code = 0;
            rsmodel.message = `Successfully updated recommendationExperts`;

            // 記錄審計日誌
            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
                entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_EXPERT_CONFIG,
                targetId: expertId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    expert_id: expertId,
                    recommendation_experts: recommendationExpertsId,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateExpertRecommendation:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

// todo: 到時候把這些整合在一起 不要 DRY
exports.updateShowExpertRecommendation = async function (req, res) {
    logRouteDetails("expertController.updateShowExpertRecommendation", req);
    let rsmodel = new responseModel();

    const { expertId, showExpertRecommendation } = JSON.parse(req.body);
    console.info("expertController.updateShowExpertRecommendation:", JSON.parse(req.body));
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;
            config["show_recommended_experts"] = showExpertRecommendation;

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expertId]);

            rsmodel.code = 0;
            rsmodel.message = `Successfully updated showExpertRecommendation`;

            // 記錄審計日誌
            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
                entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_EXPERT_CONFIG,
                targetId: expertId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    expert_id: expertId,
                    show_recommended_experts: showExpertRecommendation,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateShowExpertRecommendation:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

exports.updateLinkChunkLevel = async function (req, res) {
    logRouteDetails("expertController.updateLinkChunkLevel", req);
    let rsmodel = new responseModel();

    const { expertId, linkChunkLevel } = JSON.parse(req.body);
    console.info("expertController.updateLinkChunkLevel:", JSON.parse(req.body));
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;
            config["link_chunk_level"] = linkChunkLevel;

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expertId]);

            rsmodel.code = 0;
            rsmodel.message = `Successfully updated linkChunkLevel`;

            // 記錄審計日誌
            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
                entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_EXPERT_CONFIG,
                targetId: expertId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    expert_id: expertId,
                    link_chunk_level: linkChunkLevel,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateExpertRecommendation:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

exports.updateShowDatasetName = async function (req, res) {
    logRouteDetails("expertController.updateShowDatasetName", req);
    let rsmodel = new responseModel();

    const { expertId, showDatasetName } = JSON.parse(req.body);
    console.info("expertController.updateShowDatasetName:", JSON.parse(req.body));
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;
            config["show_dataset_name"] = showDatasetName;

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expertId]);

            rsmodel.code = 0;
            rsmodel.message = `Successfully updated showDatasetName`;

            // 記錄審計日誌
            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
                entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_EXPERT_CONFIG,
                targetId: expertId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    expert_id: expertId,
                    show_dataset_name: showDatasetName,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateShowDatasetName:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

exports.delExpert = async function (req, res) {
    logRouteDetails("expertController.delExpert", req);
    let rsmodel = new responseModel();

    try {
        const { expert_id } = req.params;
        console.info("expertController.delExpert:", req.params);
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        // 變更專家狀態為 0
        let rs = await sql.query("update expert set is_enable = 0,updated_by = $1 where id = $2", [uid, expert_id]);
        if (rs.rowCount > 0) {
            rsmodel.code = 0;
        }
        // 刪除 expert_skill_mapping 表中的資料
        rs = await sql.query("DELETE FROM expert_skill_mapping WHERE expert_id = $1", [expert_id]);
        if (rs.rowCount > 0) {
            rsmodel.code = 0;
        }
        // 刪除 expert_datasets_mapping 表中的資料
        rs = await sql.query("DELETE FROM expert_datasets_mapping WHERE expert_id = $1", [expert_id]);
        if (rs.rowCount > 0) {
            rsmodel.code = 0;
        }

        // 記錄審計日誌
        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.DELETE,
            entityType: AUDIT_LOG_ENTITY_TYPE.DELETE_EXPERT,
            targetId: expert_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                expert_id: expert_id,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.updatePrompt = async function (req, res) {
    logRouteDetails("expertController.updatePrompt", req);
    let rsmodel = new responseModel();
    try {
        const { expert_id } = JSON.parse(req.body);
        if (!expert_id) return;
        console.info("expertController.updatePrompt:", JSON.parse(req.body));
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        const processParams = JSON.parse(req.body);
        delete processParams.expert_id;

        const keys = Object.keys(processParams);
        const values = Object.values(processParams);

        let sqlstr = "update expert set ";
        let i = 0;
        for (let key of keys) {
            if (i !== 0) sqlstr += ",";
            i++;
            sqlstr += `${key} = $${i}`;
        }
        // 增加 updated_by 欄位
        i++;
        sqlstr += `, updated_by = $${i}`;

        // 加入 where 條件
        i++;
        sqlstr += ` where id = $${i}`;
        let chk = await sql.query(sqlstr, [...values, uid, expert_id]);
        if (chk.rowCount > 0) {
            rsmodel.code = 0;
        }

        // 記錄審計日誌
        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_EXPERT_CONFIG,
            targetId: expert_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                expert_id,
                processParams,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
exports.bindList = async function (req, res) {
    logRouteDetails("expertController.bindList", req);
    let rsmodel = new responseModel();
    try {
        let { expert_id } = req.params;
        console.info("expertController.bindList:", req.params);
        let userNo = req.session.userInfo.user_no;
        let rs = {};

        // 取得專家已綁定的資料集
        let binds_datasets = (
            await sql.query(
                "select a.datasets_id, b.name, b.folder_name, b.icon, COALESCE(b.config_jsonb->>'sort_priority', '0')::int AS sort_priority from expert_datasets_mapping a left join datasets b on a.datasets_id = b.id where a.expert_id = $1 AND b.is_enable = 1",
                [expert_id]
            )
        ).rows;

        // 取得專家已綁定的技能
        let binds_skill = (
            await sql.query(
                "select a.skill_id, b.name, b.class, b.icon from expert_skill_mapping a left join skill b on a.skill_id = b.id where a.expert_id = $1 AND b.is_enable = 1",
                [expert_id]
            )
        ).rows;

        // 取得未綁定的資料集
        let binded_datasets = binds_datasets.map((m) => m.datasets_id);
        let placeholders = "";
        let query = "";
        if (binded_datasets.length > 0) {
            placeholders = binded_datasets.map((_, i) => `$${i + 1}`).join(", ");
            query = {
                text: `select id datasets_id, "name", folder_name, icon, COALESCE(config_jsonb->>'sort_priority', '0')::int AS sort_priority from datasets where id not in (${placeholders}) AND is_enable = 1 ORDER BY sort_priority DESC, create_time DESC`,
                values: binded_datasets,
            };
        } else {
            query = {
                text: `select id datasets_id, "name", folder_name, icon, COALESCE(config_jsonb->>'sort_priority', '0')::int AS sort_priority from datasets WHERE is_enable = 1 ORDER BY sort_priority DESC, create_time DESC`,
            };
        }
        let datasets = (await sql.query(query)).rows;

        // 取得未綁定的技能
        let binded_skill = binds_skill.map((m) => m.skill_id);
        if (binded_skill.length > 0) {
            placeholders = binded_skill.map((_, i) => `$${i + 1}`).join(", ");
            query = {
                text: `select id skill_id, "name", class, icon from skill where id not in (${placeholders}) AND is_enable = 1`,
                values: binded_skill,
            };
        } else {
            query = {
                text: 'select id skill_id, "name", class, icon from skill WHERE is_enable = 1',
            };
        }

        let skill = (await sql.query(query)).rows;

        // 將已綁定的資料集和技能合併
        rs.binds = binds_datasets.concat(...binds_skill);

        // 檢查權限並過濾
        const sqlStr = `SELECT value FROM settings WHERE key='knowledge_permission'`;
        const { rows } = await sql.query(sqlStr);
        const knowledgePermission = JSON.parse(rows[0].value);
        if (knowledgePermission) {
            datasets = filterDatasetsByPermission(datasets, userNo, knowledgePermission);
            skill = filterSkillsByPermission(skill, userNo, knowledgePermission);
            rs.binds = filterBindsByPermission(rs.binds, userNo, knowledgePermission);
        }

        rs.datasets = datasets;
        rs.skill = skill;

        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.bind = async function (req, res) {
    logRouteDetails("expertController.bind", req);
    let rsmodel = new responseModel();
    try {
        let { expert_id, addDatasetsList, addSkillList, delDatasetsList, delSkillList } = JSON.parse(req.body);
        console.info("expertController.bind:", JSON.parse(req.body));
        if (delDatasetsList && delDatasetsList.length) {
            const values = delDatasetsList.map((_, i) => `$${i + 2}`).join(", ");
            const query = {
                text: `delete from expert_datasets_mapping where expert_id = $1 and datasets_id in (${values})`,
                values: [expert_id, ...delDatasetsList],
            };
            await sql.query(query);
        }
        if (delSkillList && delSkillList.length) {
            const values = delSkillList.map((_, i) => `$${i + 2}`).join(", ");
            const query = {
                text: `delete from expert_skill_mapping where expert_id = $1 and skill_id in (${values})`,
                values: [expert_id, ...delSkillList],
            };
            await sql.query(query);
        }

        if (addDatasetsList && addDatasetsList.length) {
            const values = addDatasetsList.map((m, i) => `($${i * 2 + 1},$${i * 2 + 2})`);
            const query = {
                text: `insert into expert_datasets_mapping (expert_id,datasets_id) values ${values}`,
                values: addDatasetsList.flatMap((fm) => [expert_id, fm]),
            };
            await sql.query(query);
        }
        if (addSkillList && addSkillList.length) {
            const values = addSkillList.map((m, i) => `($${i * 2 + 1},$${i * 2 + 2})`);
            const query = {
                text: `insert into expert_skill_mapping (expert_id,skill_id) values ${values}`,
                values: addSkillList.flatMap((fm) => [expert_id, fm]),
            };
            await sql.query(query);
        }
        console.log("reload datasets: " + process.env.PYTHON_API_HOST);
        await pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST, {
            ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
        });

        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.chartsSubject = async function (req, res) {
    logRouteDetails("expertController.chartsSubject", req);
    let rsmodel = new responseModel();
    try {
        const chartsSubject = [
            {
                title: "token統計",
                tooltip: "時間內token數與總花費",
                subject: "token_price",
            },
            {
                title: "全部訊息數",
                tooltip: "AVA每天的互動總次數(每天共幾筆訊息)",
                subject: "total_message",
            },
            {
                title: "活躍用戶數",
                tooltip: "AVA每天有效互動的用戶數(每天多少人使用過)",
                subject: "active_user",
            },
            {
                title: "問不到問題的數量",
                tooltip: "時間內問不到問題的數量",
                subject: "no_answer",
            },
            {
                title: "模組使用狀況",
                tooltip: "模組使用狀況",
                subject: "model_status",
            },
            {
                title: "訊息平均數量",
                tooltip: "平均訊息數量",
                subject: "average_message",
            },
            // {
            //     title: "模組活躍度",
            //     tooltip: "時間內知識庫與技能的使用數",
            //     subject: "model_use",
            // },
        ];
        rsmodel.code = 0;
        rsmodel.data = chartsSubject;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
exports.overview = async function (req, res) {
    /**
     * token_price  時間內token數與總花費
     * total_message  AVA每天的互動總次數
     * active_user  AVA每天有效互動的用戶數
     * model_use  時間內知識庫與技能的使用數
     */
    logRouteDetails("expertController.overview", req);
    let rsmodel = new responseModel();
    try {
        let { expert_id, period, subject } = req.query;
        console.info("expertController.overview:", req.query);
        let query, rs, totalSpend;
        let days = 0;
        switch (subject) {
            case "token_price":
                query = {
                    text: `
                            --CTE : 每一天每一種貨幣的total_price、total_prompt_token與total_completion_token統計。
                            WITH daily_totals AS (
                                SELECT
                                    to_char(create_time, 'YYYY-MM-DD') AS date,
                                    price_currency,
                                    SUM(price::numeric) AS total_price,
                                    SUM(prompt_token) AS total_prompt_token,
                                    SUM(completion_token) AS total_completion_token
                                FROM
                                    model_token_log
                                WHERE
                                    expert_id = $1
                                    AND create_time >= current_date - cast($2 AS interval)
                                    AND create_time < current_date + interval '1 day'
                                GROUP BY
                                    date, price_currency
                            )
                            SELECT
                                date,
                                jsonb_object_agg(
                                    price_currency,
                                    total_price::text
                                ) AS 花費金額,
                                SUM(total_prompt_token)::integer AS 輸入token數,
                                SUM(total_completion_token)::integer AS 輸出token數
                            FROM
                                daily_totals
                            GROUP BY
                                date
                            ORDER BY
                                date;
                    `,
                    values: [expert_id, period],
                };
                if (expert_id === "all") {
                    query = {
                        text: `
                                --CTE : 每一天每一種貨幣的total_price、total_prompt_token與total_completion_token統計。
                                WITH daily_totals AS (
                                    SELECT
                                        to_char(create_time, 'YYYY-MM-DD') AS date,
                                        price_currency,
                                        SUM(price::numeric) AS total_price,
                                        SUM(prompt_token) AS total_prompt_token,
                                        SUM(completion_token) AS total_completion_token
                                    FROM
                                        model_token_log
                                    WHERE
                                        create_time >= current_date - cast($1 AS interval)
                                        AND create_time < current_date + interval '1 day'
                                    GROUP BY
                                        date, price_currency
                                )
                                SELECT
                                    date,
                                    jsonb_object_agg(
                                        price_currency,
                                        total_price::text
                                    ) AS 花費金額,
                                    SUM(total_prompt_token)::integer AS 輸入token數,
                                    SUM(total_completion_token)::integer AS 輸出token數
                                FROM
                                    daily_totals
                                GROUP BY
                                    date
                                ORDER BY
                                    date;
                        `,
                        values: [period],
                    };
                }
                rs = await sql.query(query);

                // 如果不是每一天都有資料，補上空缺的日期資料。
                days = findTotalDays(period); // 取得搜尋期間的總天數
                if (rs.rows.length !== days) {
                    // 目前有的天數
                    const existDateList = rs.rows.map((e) => e.date);
                    // 檢查並補齊
                    for (let i = 0; i < days; i++) {
                        const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
                        if (!existDateList.includes(date)) {
                            rs.rows.push({
                                date: date,
                                花費金額: {},
                                輸入token數: 0,
                                輸出token數: 0,
                            });
                        }
                    }
                    // 最後再對日期排序一次
                    rs.rows.sort((a, b) => (dayjs(a.date).isAfter(dayjs(b.date)) ? 1 : -1));
                }

                totalSpend = calculateTotalSpend(rs.rows);
                rsmodel.totalSpend = totalSpend;
                break;
            case "model_status":
                query = {
                    text: `WITH daily_totals AS (
                                SELECT 
                                    to_char(create_time, 'YYYY-MM-DD') AS date,
                                    price_currency,
                                    model,
                                    SUM(price::numeric) AS total_price,
                                    SUM(prompt_token) AS total_prompt_token,
                                    SUM(completion_token) AS total_completion_token
                                FROM 
                                    model_token_log 
                                WHERE 
                                    expert_id = $1 
                                    AND create_time >= current_date - cast($2 AS interval) 
                                    AND create_time < current_date + interval '1 day'
                                GROUP BY 
                                    date, price_currency,model
                            )
                            SELECT 
                                date,
                                jsonb_object_agg(
                                    price_currency,
                                    total_price::text
                                ) AS 花費金額,
                                model AS 模組名稱,
                                SUM(total_prompt_token)::integer AS 輸入token數,
                                SUM(total_completion_token)::integer AS 輸出token數
                            FROM 
                                daily_totals
                            GROUP BY 
                                date,model
                            ORDER BY 
                                date;
                    `,
                    values: [expert_id, period],
                };
                rs = await sql.query(query);

                if (rs && rs.rows && rs.rows.length > 0) {
                    rs.rows = rs.rows.filter((e) => e["模組名稱"] !== "no_model");
                }

                // 如果不是每一天都有資料，補上空缺的日期資料。
                days = findTotalDays(period); // 取得搜尋期間的總天數
                if (rs.rows.length !== days) {
                    // 目前有的天數
                    const existDateList = rs.rows.map((e) => e.date);
                    // 檢查並補齊
                    for (let i = 0; i < days; i++) {
                        const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
                        if (!existDateList.includes(date)) {
                            rs.rows.push({
                                date: date,
                                花費金額: {},
                                模組名稱: null,
                                輸入token數: 0,
                                輸出token數: 0,
                            });
                        }
                    }
                    // 最後再對日期排序一次
                    rs.rows.sort((a, b) => (dayjs(a.date).isAfter(dayjs(b.date)) ? 1 : -1));
                }

                totalSpend = calculateTotalSpend(rs.rows);
                rsmodel.totalSpend = totalSpend;
                break;
            case "total_message":
                query = {
                    text: "select to_char(create_time,'YYYY-MM-DD') date, count(distinct chat_uuid) 訊息數 \
                                from model_token_log where expert_id = $1 and create_time >= current_date - cast($2 as interval) and create_time < current_date + interval '1 day' \
                                group by date order by date",
                    values: [expert_id, period],
                };
                if (expert_id === "all") {
                    query = {
                        text: "select to_char(create_time,'YYYY-MM-DD') date, count(distinct chat_uuid) 訊息數 \
                                    from model_token_log where create_time >= current_date - cast($1 as interval) and create_time < current_date + interval '1 day' \
                                    group by date order by date",
                        values: [period],
                    };
                }
                rs = await sql.query(query);

                // 如果不是每一天都有資料，補上空缺的日期資料。
                days = findTotalDays(period); // 取得搜尋期間的總天數
                if (rs.rows.length !== days) {
                    // 目前有的天數
                    const existDateList = rs.rows.map((e) => e.date);
                    // 檢查並補齊
                    for (let i = 0; i < days; i++) {
                        const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
                        if (!existDateList.includes(date)) {
                            rs.rows.push({
                                date: date,
                                訊息數: "0",
                            });
                        }
                    }
                    // 最後再對日期排序一次
                    rs.rows.sort((a, b) => (dayjs(a.date).isAfter(dayjs(b.date)) ? 1 : -1));
                }

                break;
            case "average_message":
                query = {
                    text: `with user_message_counts as (
                        select mt.users_id, 
                            u.name, 
                            count(distinct mt.chat_uuid) as user_message_count
                        from model_token_log mt
                        join users u on mt.users_id = u.id
                        where mt.expert_id = $1 
                        and mt.create_time >= current_date - cast($2 as interval) 
                        and mt.create_time < current_date + interval '1 day'
                        group by mt.users_id, u.name
                    )
                    select umc.name, 
                        umc.user_message_count as 訊息數
                    from user_message_counts umc
                    order by umc.name;`,
                    values: [expert_id, period],
                };
                rs = await sql.query(query);

                if (rs && rs.rows && rs.rows.length > 0) {
                    // 合併name = null的資料，當作遊客的資料。
                    const modifyData = [];
                    const tempObject = {
                        name: null,
                        訊息數: 0,
                    };
                    rs.rows.forEach((e) => {
                        if (e.name === null) {
                            tempObject["訊息數"] += parseInt(e["訊息數"]);
                        } else {
                            modifyData.push(e);
                        }
                    });
                    modifyData.push(tempObject);

                    // 計算平均值
                    days = findTotalDays(period);
                    modifyData.forEach((e) => (e["平均訊息數量"] = (parseInt(e["訊息數"]) / days).toFixed(2) || "0"));

                    rs.rows = modifyData;
                }
                break;
            case "active_user":
                query = {
                    text: "select to_char(create_time,'YYYY-MM-DD') date, count(distinct users_id) 用戶數 \
                                from model_token_log where expert_id = $1 and create_time >= current_date - cast($2 as interval) and create_time < current_date + interval '1 day' \
                                group by date order by date",
                    values: [expert_id, period],
                };
                rs = await sql.query(query);

                // 如果不是每一天都有資料，補上空缺的日期資料。
                days = findTotalDays(period); // 取得搜尋期間的總天數
                if (rs.rows.length !== days) {
                    // 目前有的天數
                    const existDateList = rs.rows.map((e) => e.date);
                    // 檢查並補齊
                    for (let i = 0; i < days; i++) {
                        const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
                        if (!existDateList.includes(date)) {
                            rs.rows.push({
                                date: date,
                                用戶數: "0",
                            });
                        }
                    }
                    // 最後再對日期排序一次
                    rs.rows.sort((a, b) => (dayjs(a.date).isAfter(dayjs(b.date)) ? 1 : -1));
                }

                break;
            // case "model_use":
            //     query = {
            //         text: "select to_char(create_time,'YYYY-MM-DD') date, count(case when expert_model_type = 1 then 1 end) 知識庫, \
            //                     count(case when expert_model_type = 2 then 1 end) 技能 \
            //                     from model_token_log where expert_id = $1 and create_time >= current_date - cast($2 as interval) and create_time < current_date + interval '1 day' \
            //                     group by date order by date",
            //         values: [expert_id, period],
            //     };
            //     rs = await sql.query(query);
            //     break;
            case "no_answer":
                query = {
                    text: `select to_char(create_time,'YYYY-MM-DD') date, 
                                      count(case when type = 0 then 1 end) 錯誤, 
                                      count(case when type = 9 then 1 end) 無答案 
                                 from history_messages 
                                 where expert_id = $1 
                                   and create_time >= current_date - cast($2 as interval) 
                                   and create_time < current_date + interval '1 day' 
                                 group by date 
                                 order by date`,
                    values: [expert_id, period],
                };
                rs = await sql.query(query);

                // 如果不是每一天都有資料，補上空缺的日期資料。
                days = findTotalDays(period); // 取得搜尋期間的總天數
                if (rs.rows.length !== days) {
                    // 目前有的天數
                    const existDateList = rs.rows.map((e) => e.date);
                    // 檢查並補齊
                    for (let i = 0; i < days; i++) {
                        const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
                        if (!existDateList.includes(date)) {
                            rs.rows.push({
                                date: date,
                                錯誤: "0",
                                無答案: "0",
                            });
                        }
                    }
                    // 最後再對日期排序一次
                    rs.rows.sort((a, b) => (dayjs(a.date).isAfter(dayjs(b.date)) ? 1 : -1));
                }

                break;
        }

        rsmodel.code = 0;
        rsmodel.data = rs.rows;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getCachedKnowledgeWithRelatedContent = async function (req, res) {
    logRouteDetails("expertController.getCachedKnowledgeWithRelatedContent", req);
    let rsmodel = new responseModel();
    try {
        const page = req.query.page || {};
        // 處理多選模型陣列
        let selectedModels;
        if (page.selectedModel) {
            // 如果是陣列格式的參數
            selectedModels = Array.isArray(page.selectedModel) ? page.selectedModel : Object.values(page.selectedModel); // 處理 express 解析的物件格式
        }

        const isAllModels = !selectedModels || selectedModels.includes("All");

        const expertId = req.query.expertId;
        const searchTerm = page.searchQuery || req.query.searchTerm || "";
        const currentPage = Math.max(1, parseInt(page.page) || 1);
        const itemsPerPage = Math.max(1, parseInt(page.itemsPerPage) || parseInt(req.query.itemsPerPage) || 15);

        const sortField = page.sortField || "update_time";
        const sortOrder = (page.sortOrder || "desc").toLowerCase();
        const offset = (currentPage - 1) * itemsPerPage;

        const whereClause = {
            expert_id: expertId,
            ...(searchTerm && {
                [Op.or]: [
                    { question: { [Op.iLike]: `%${searchTerm}%` } },
                    { answer: { [Op.iLike]: `%${searchTerm}%` } },
                ],
            }),
            ...(isAllModels ? {} : { model_name: { [Op.in]: selectedModels } }),
        };

        const order = [
            [
                sortField === "usage_count"
                    ? Sequelize.literal("usage_count")
                    : sortField === "related_chunk_ids"
                    ? Sequelize.fn("JSONB_ARRAY_LENGTH", Sequelize.col("related_chunk_ids"))
                    : sortField,
                sortOrder === "asc" ? "ASC" : "DESC",
            ],
        ];

        // 使用子查詢來計算每個 cache_id 的 usage_count
        const usageCountsSubquery = Sequelize.literal(`(
            SELECT COUNT(*)
            FROM history_cache_mapping
            WHERE history_cache_mapping.cache_id = "CachedKnowledge".id
        )`);

        const paginatedKnowledge = await CachedKnowledge.findAndCountAll({
            where: whereClause,
            attributes: [
                "id",
                "related_chunk_ids",
                "model_name",
                "model_params",
                "expert_id",
                "question",
                "answer",
                "create_time",
                "update_time",
                "link_level",
                [usageCountsSubquery, "usage_count"],
            ],
            order: [order],
            limit: itemsPerPage,
            offset,
            raw: true,
        });

        const totalItems = paginatedKnowledge.count;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        rsmodel.data = {
            items: paginatedKnowledge.rows.map((row) => ({
                ...row,
            })),
            total_items: totalItems,
            current_page: currentPage,
            items_per_page: itemsPerPage,
            total_pages: totalPages,
        };
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "在獲取資料時發生錯誤";
    }
    res.json(rsmodel);
};

exports.getMostFrequentQuestion = async function (req, res) {
    logRouteDetails("expertController.getMostFrequentQuestion", req);
    let rsmodel = new responseModel();
    try {
        const page = req.query.page || {};
        let selectedModels;
        if (page.selectedModel) {
            selectedModels = Array.isArray(page.selectedModel) ? page.selectedModel : Object.values(page.selectedModel);
        }

        const isAllModels = !selectedModels || selectedModels.includes("All");
        const expertId = req.query.expertId;
        const searchTerm = page.searchQuery || req.query.searchTerm || "";

        // 查詢邏輯：對 question 重複的，只選 usage_count 最大的
        const mostFrequentQuestions = await CachedKnowledge.sequelize.query(
            `
            WITH ranked_questions AS (
                SELECT
                    "CachedKnowledge".question AS question,
                    COUNT(history_cache_mapping.cache_id) AS usage_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY "CachedKnowledge".question
                        ORDER BY COUNT(history_cache_mapping.cache_id) DESC
                    ) AS rank
                FROM "cached_knowledge" AS "CachedKnowledge"
                LEFT JOIN history_cache_mapping
                ON history_cache_mapping.cache_id = "CachedKnowledge".id
                WHERE "CachedKnowledge".expert_id = :expertId
                ${
                    searchTerm
                        ? `AND ("CachedKnowledge".question ILIKE :searchTerm OR "CachedKnowledge".answer ILIKE :searchTerm)`
                        : ""
                }
                ${!isAllModels ? `AND "CachedKnowledge".model_name IN (:selectedModels)` : ""}
                GROUP BY "CachedKnowledge".question
            )
            SELECT question, usage_count
            FROM ranked_questions
            WHERE rank = 1
            ORDER BY usage_count DESC, question ASC
            LIMIT 10
            `,
            {
                replacements: {
                    expertId,
                    searchTerm: `%${searchTerm}%`,
                    selectedModels,
                },
                type: CachedKnowledge.sequelize.QueryTypes.SELECT,
            }
        );

        rsmodel.data = mostFrequentQuestions; // 返回問題和使用次數
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "在獲取資料時發生錯誤";
    }
    res.json(rsmodel);
};

exports.getCacheChartData = async function (req, res) {
    logRouteDetails("expertController.getCacheChartData", req);
    const response = new responseModel();

    try {
        const { expertId, startTime, endTime } = JSON.parse(req.body);

        // 資料驗證
        if (!expertId || !startTime || !endTime) {
            return res.status(400).json({
                code: 1,
                message: "缺少必要參數",
            });
        }
        console.info("expertController.getCacheChartData:", JSON.parse(req.body));

        // 查詢歷史訊息表
        const data = await HistoryMessages.findAll({
            attributes: ["id", "input", "type", "create_time"],
            where: {
                expert_id: expertId,
                create_time: {
                    [Op.between]: [startTime, endTime],
                },
                type: {
                    [Op.or]: [1, 4],
                },
            },
        });

        // 製作以日期分類的map
        const dateMap = new Map();
        const startDate = dayjs(startTime);
        const endDate = dayjs(endTime);
        for (let date = startDate; date.isBefore(endDate, "day"); date = date.add(1, "day")) {
            dateMap.set(date.format("YYYY-MM-DD"), { date: date.format("YYYY-MM-DD"), msgNumber: 0, cacheNumber: 0 });
        }

        // 將資料依據日期分類
        const totalMsgNumber = data.length;
        let totalCacheNumber = 0;
        if (data && data.length > 0) {
            data.forEach((e) => {
                // 將資料放入相對應的日期內
                const date = dayjs(e.create_time).format("YYYY-MM-DD");
                if (dateMap.has(date)) {
                    dateMap.get(date).msgNumber += 1;
                    if (e.type === 4) {
                        totalCacheNumber += 1;
                        dateMap.get(date).cacheNumber += 1;
                    }
                }
            });
        }

        // 整理回傳資料
        let responseData = {
            dataByDate: Object.values(Object.fromEntries(dateMap)),
            totalMsgNumber,
            totalCacheNumber,
        };

        response.code = 0;
        response.message = "查詢成功";
        response.data = responseData;
    } catch (error) {
        console.error("查詢資料庫錯誤:", error); // 記錄錯誤到 log 檔或發送通知
        response.code = 1;
        response.message = "伺服器內部錯誤";
    }

    res.json(response);
};

exports.updateExpertConfigJsonCache = async function (req, res) {
    logRouteDetails("expertController.updateExpertConfigJsonCache", req);
    let rsmodel = new responseModel();
    try {
        const { expertId, configJsonCache } = JSON.parse(req.body);
        console.info("expertController.updateExpertConfigJsonCache:", JSON.parse(req.body));

        // 找到對應的 expert
        const expert = await Expert.findOne({
            where: { id: expertId },
        });

        if (expert) {
            // 更新 config_jsonb 欄位
            expert.config_jsonb = {
                ...expert.config_jsonb,
                ...configJsonCache,
            };

            await expert.save();

            rsmodel.code = 0;
            rsmodel.message = "Config updated successfully";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating config";
    }
    res.json(rsmodel);
};

exports.deleteCachedKnowledge = async function (req, res) {
    logRouteDetails("expertController.deleteCachedKnowledge", req);
    let rsmodel = new responseModel();
    try {
        let { expertId, knowledgeId } = JSON.parse(req.body);
        console.info("expertController.deleteCachedKnowledge:", JSON.parse(req.body));
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;

        // 判斷是否有提供 knowledgeId
        let condition = { expert_id: expertId };
        let deleteCachedKnowledgeIds = knowledgeId;

        if (!knowledgeId || knowledgeId.length === 0) {
            // 如果沒有提供 knowledgeId，就查詢該專家的所有 cache id
            const allCachedKnowledge = await CachedKnowledge.findAll({
                where: { expert_id: expertId },
                attributes: ["id"],
            });
            deleteCachedKnowledgeIds = allCachedKnowledge.map((cached) => cached.id);
            condition.id = { [Op.in]: deleteCachedKnowledgeIds };
        } else {
            condition.id = { [Op.in]: deleteCachedKnowledgeIds };
        }

        // 使用 Sequelize 的 destroy 方法來刪除資料
        await CachedKnowledge.destroy({
            where: condition,
        });

        // 後台畫面要是全部刪除的話，只會用 expertId 去 cache 表刪除該專家所有的 cache
        // 但 python 那邊需要知道要刪除哪幾個 cache id，所以如果是全部刪除的話，要在拿專家 id 去 cache 表查詢該專家所有的 cache id
        await pythonAPI.deleteCachedKnowledge(
            expertId,
            deleteCachedKnowledgeIds,
            process.env.PYTHON_API_HOST,
            ava_token
        );

        rsmodel.code = 0;
        rsmodel.message = "Cached knowledge deleted successfully";
    } catch (e) {
        console.log("error", e);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while deleting data";
    }
    res.json(rsmodel);
};
exports.getDefaultPrompt = async function (req, res) {
    logRouteDetails("expertController.getDefaultPrompt", req);
    let rsmodel = new responseModel();
    try {
        let sqlstr = "select id,name,describe from default_prompt dp where is_enable = 1";
        let rs = await sql.query(sqlstr);

        if (rs && rs.rows) {
            rsmodel.data = rs.rows;
        } else {
            rsmodel.data = [];
        }

        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while fetching default_prompt.";
    }
    res.json(rsmodel);
};
exports.setDatasetsPriority = async function (req, res) {
    logRouteDetails("expertController.setDatasetsPriority", req);
    let rsmodel = new responseModel();

    try {
        const { dataset_priority_setting, expert_id } = JSON.parse(req.body);
        console.info("expertController.setDatasetsPriority:", JSON.parse(req.body));
        const { uid = "" } = req.session.userInfo || {};
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expert_id]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;
            config["dataset_priority_setting"] = dataset_priority_setting;

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expert_id]);

            rsmodel.code = 0;
            rsmodel.message = `Successfully updated dataset_priority`;
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in setDatasetsPriority:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating setDatasetsPriority";
    }
    res.json(rsmodel);
};

exports.toggleDatasetsPriority = async function (req, res) {
    logRouteDetails("expertController.toggleDatasetsPriority", req);
    let rsmodel = new responseModel();

    try {
        const { isEnable, expert_id } = JSON.parse(req.body);
        console.info("expertController.toggleDatasetsPriority:", JSON.parse(req.body));
        const { uid = "" } = req.session.userInfo || {};
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expert_id]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;
            if (isEnable) {
                config["dataset_priority_setting"] = [0, 0, 0, 0, 0];
            } else {
                delete config["dataset_priority_setting"];
            }

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expert_id]);

            rsmodel.code = 0;
            rsmodel.message = isEnable ? "成功啟用" : "成功停用";
        } else {
            rsmodel.code = 1;
            rsmodel.message = isEnable ? "啟用失敗" : "停用失敗";
            console.log("查無專家資訊。");
        }
    } catch (error) {
        console.error("Error in toggleDatasetsPriority:", error);
        rsmodel.code = 1;
        rsmodel.message = "變更狀態失敗。";
    }
    res.json(rsmodel);
};

exports.getPrioritySetting = async function (req, res) {
    logRouteDetails("expertController.getPrioritySetting", req);
    let rsmodel = new responseModel();
    try {
        let { expert_id } = req.params;
        console.info("expertController.getPrioritySetting:", req.params);
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expert_id]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;
            rsmodel.code = 0;
            rsmodel.data = config["dataset_priority_setting"] ? config["dataset_priority_setting"] : null;
        } else {
            rsmodel.code = 1;
            rsmodel.message = "查無專家資訊";
            console.log("查無專家資訊。");
        }
    } catch (error) {
        console.error("Error in getPrioritySetting:", error);
        rsmodel.code = 1;
        rsmodel.message = "查詢專家資訊失敗。";
    }
    res.json(rsmodel);
};

// 取得chunks資料，並根據linkLevel擴展資料
exports.getChunksDataByLinkLevel = async function (req, res) {
    logRouteDetails("expertController.getChunksDataByLinkLevel", req);
    let rsmodel = new responseModel();
    try {
        const { chunkIds, linkLevel } = JSON.parse(req.body);
        console.info("expertController.getChunksDataByLinkLevel:", JSON.parse(req.body));
        // 取得主chunks資料
        const targetChunks = await ParentChunks.findAll({
            where: { id: { [Op.in]: chunkIds } },
        });

        // 建立分類容器
        let fileChunks = new Map();
        targetChunks.forEach((chunk) => {
            if (!fileChunks.has(chunk.meta_data.filename)) {
                fileChunks.set(chunk.meta_data.filename, []);
            }
            fileChunks.get(chunk.meta_data.filename).push({ ...chunk.dataValues, is_target: true });
        });

        // 根據linkLevel擴展資料
        if (linkLevel > 0) {
            let lastChunksList = [];
            for (let i = 0; i < linkLevel; i++) {
                // 如果 i = 0，代表要擴展第1層的chunks，所以前手資料取自 targetChunks
                if (i === 0) {
                    targetChunks.forEach((chunk) => {
                        lastChunksList.push(chunk.meta_data.prev_node);
                        lastChunksList.push(chunk.meta_data.next_node);
                    });
                }

                const currentChunks = await ParentChunks.findAll({ where: { id: { [Op.in]: lastChunksList } } });

                lastChunksList = [];
                currentChunks.forEach((chunk) => {
                    lastChunksList.push(chunk.meta_data.prev_node);
                    lastChunksList.push(chunk.meta_data.next_node);

                    if (!fileChunks.get(chunk.meta_data.filename).some((c) => c.id === chunk.id)) {
                        fileChunks.get(chunk.meta_data.filename).push({ ...chunk.dataValues, is_target: false });
                    }
                });
            }
        }

        // 將每個檔案的chunks排序
        for (const [filename, chunks] of fileChunks) {
            chunks.sort((a, b) => a.id - b.id);
        }

        // 將連續的chunks分組
        for (const [filename, chunks] of fileChunks) {
            const newFileChunks = [];
            let currentGroupIndex = 0;
            for (const chunk of chunks) {
                // 小組第一個chunk
                if (!newFileChunks[currentGroupIndex]) {
                    newFileChunks[currentGroupIndex] = [];
                    newFileChunks[currentGroupIndex].push(chunk);
                }
                // 檢查小組中是否有自己的上一個chunk，有的話就加入小組
                const hasPrev = newFileChunks[currentGroupIndex].find((c) => c.id == chunk.meta_data.prev_node);
                if (hasPrev) {
                    newFileChunks[currentGroupIndex].push(chunk);
                    continue;
                }

                // 檢查小組中是否有自己的下一個chunk，如果沒有，自己就是結尾
                const hasNext = chunks.find((c) => c.id == chunk.meta_data.next_node);
                if (!hasNext) {
                    currentGroupIndex++;
                }
            }
            fileChunks.set(filename, newFileChunks);
        }
        rsmodel.code = 0;
        rsmodel.data = Array.from(fileChunks.values());
    } catch (e) {
        console.error("error in getting chunks data by link_level", e);
        rsmodel.code = 1;
        rsmodel.message = "Getting chunks by link_level fail.";
    }
    res.json(rsmodel);
};

exports.updatePopularTags = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("expertController.updatePopularTags", req);
    let rsmodel = new responseModel();
    try {
        const { popular_tags, expert_id } = JSON.parse(req.body);
        const { uid = "", name: username = "" } = req.session.userInfo || {};

        console.info("expertController.updatePopularTags:", JSON.parse(req.body));

        await Expert.update(
            { popular_tags: JSON.stringify(popular_tags) },
            { where: { id: expert_id }, fields: ["popular_tags"] }
        );
        rsmodel.code = 0;
        rsmodel.message = "更新熱門標籤成功";

        // 記錄審計日誌
        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_EXPERT_CONFIG,
            targetId: expert_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                expert_id: expert_id,
                popular_tags: popular_tags,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error("error in updatePopularTags", e);
        rsmodel.code = 1;
        rsmodel.message = "更新熱門標籤失敗";
    }
    res.json(rsmodel);
};

exports.getPopularTagsIconList = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("expertController.getPopularTagsIconList", req);
    let rsmodel = new responseModel();
    try {
        const { expert_id } = req.query;
        console.info("expertController.getPopularTagsIconList:", expert_id);

        const expert = await Expert.findOne({
            where: { id: expert_id },
            attributes: ["popular_tags"],
        });

        let iconList = [];
        if (expert && expert.popular_tags) {
            const popularTags = JSON.parse(expert.popular_tags);
            iconList = popularTags || [];
        }

        rsmodel.code = 0;
        rsmodel.message = "取得熱門標籤icon列表成功";
        rsmodel.data = iconList;
    } catch (e) {
        console.error("error in getPopularTagsIconList", e);
        rsmodel.code = 1;
        rsmodel.message = "取得熱門標籤icon列表失敗";
    }
    res.json(rsmodel);
};

exports.updateExpertSort = async function (req, res) {
    logRouteDetails("expertController.updateExpertSort", req);
    let rsmodel = new responseModel();

    try {
        const { experts } = JSON.parse(req.body);

        // 使用單一個交易來處理所有更新
        await sequelize.transaction(async (t) => {
            // 先將所有專家的 order 設為 null
            await Expert.update(
                { sort_order: null },
                {
                    where: {}, // 更新所有記錄
                    transaction: t,
                }
            );

            // 批量更新指定的排序
            await Promise.all(
                experts.map(({ expert_id, sort_order }) =>
                    Expert.update(
                        { sort_order },
                        {
                            where: { id: expert_id },
                            transaction: t,
                        }
                    )
                )
            );
        });

        rsmodel.code = 0;
        rsmodel.message = "更新專家排序成功";
    } catch (e) {
        console.error("error in updateExpertSort", e);
        rsmodel.code = 1;
        rsmodel.message = "更新專家排序失敗";
    }

    res.json(rsmodel);
};

exports.getAllTokenUsageOverview = async function (req, res) {
    // 專家 token使用量 token上限花費(token_budget) startDate endDate
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("expertController.getAllTokenUsageOverview", req);
    let rsmodel = new responseModel();
    try {
        let { startDate, endDate } = req.query;

        // 創建 sliceMinutes 變數，假設為 1 分鐘
        const sliceMinutes = 1;

        // 檢查是否只有 endDate 而沒有 startDate
        if (endDate && !startDate) {
            throw new Error("Only endDate provided without startDate");
        }

        // 如果 startDate 和 endDate 都沒給，則不設時間範圍
        const hasStartDate = !!startDate;
        const hasEndDate = !!endDate;

        if (hasStartDate) {
            startDate = dayjs(startDate, ["YYYY-MM-DD HH:mm:ss", "YYYYMMDD HH:mm:ss", "YYYYMMDD"]).format(
                "YYYY-MM-DD HH:mm:ss"
            );
        }

        if (hasEndDate) {
            if (!endDate.includes(" ")) {
                endDate += " 23:59:59";
            }
            endDate = dayjs(endDate, ["YYYY-MM-DD HH:mm:ss", "YYYYMMDD HH:mm:ss", "YYYYMMDD"]).format(
                "YYYY-MM-DD HH:mm:ss"
            );
        } else if (hasStartDate) {
            // 如果有 startDate 但沒有 endDate，則將 endDate 設為今天的 23:59:59
            endDate = dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss");
        }

        const experts = await Expert.findAll({
            where: {
                is_enable: 1,
            },
            attributes: ["id", "name", "config_jsonb"],
            raw: true,
        });

        const expertIds = experts.map((expert) => expert.id);

        // 調整 startDate 和 endDate 以每 sliceMinutes 分鐘為區間
        const intervals = [];
        if (hasStartDate && hasEndDate) {
            const start = dayjs(startDate);
            const end = dayjs(endDate);

            for (let current = start; current.isBefore(end); current = current.add(sliceMinutes, "minute")) {
                intervals.push({
                    start: current.format("YYYY-MM-DD HH:mm:ss"),
                    end: current.add(sliceMinutes, "minute").format("YYYY-MM-DD HH:mm:ss"),
                });
            }
        }

        // 初始化結果
        const result = [];

        // 遍歷每個時間區間進行查詢
        for (const interval of intervals) {
            const whereClause = {
                expert_id: {
                    [Op.in]: expertIds,
                },
                create_time: {
                    [Op.gte]: interval.start,
                    [Op.lte]: interval.end,
                },
            };

            const tokenUsage = await ModelTokenLog.findAll({
                where: whereClause,
                attributes: [
                    "expert_id",
                    [Sequelize.fn("SUM", Sequelize.col("prompt_token")), "total_prompt_token"],
                    [Sequelize.fn("SUM", Sequelize.col("completion_token")), "total_completion_token"],
                ],
                group: ["expert_id"],
                having: {
                    [Op.or]: [
                        Sequelize.where(Sequelize.fn("SUM", Sequelize.col("prompt_token")), ">", 0),
                        Sequelize.where(Sequelize.fn("SUM", Sequelize.col("completion_token")), ">", 0),
                    ],
                },
                raw: true,
            });

            // 將 tokenUsage 轉換為以 expert_id 為鍵的對象
            const tokenUsageMap = tokenUsage.reduce((acc, usage) => {
                acc[usage.expert_id] = usage;
                return acc;
            }, {});

            // 為每個專家生成該時間區間的結果
            experts.forEach((expert) => {
                const usage = tokenUsageMap[expert.id] || { total_prompt_token: 0, total_completion_token: 0 };
                const token_budget = expert.config_jsonb.token_budget || 0;

                // 只傳送 token_spent_in 和 token_spent_out 不為 0 的專家
                if (parseInt(usage.total_prompt_token, 10) > 0 || parseInt(usage.total_completion_token, 10) > 0) {
                    result.push({
                        id: uuidv4(),
                        expert_id: expert.id,
                        expert_name: expert.name,
                        token_spent_in: parseInt(usage.total_prompt_token, 10) || 0,
                        token_spent_out: parseInt(usage.total_completion_token, 10) || 0,
                        token_limit: token_budget,
                        start_date: interval.start,
                        end_date: interval.end,
                    });
                }
            });
        }

        // 按 expert_id 和 start_date 排序
        result.sort((a, b) => {
            if (a.expert_id === b.expert_id) {
                return new Date(a.start_date) - new Date(b.start_date);
            }
            return a.expert_id.localeCompare(b.expert_id);
        });

        rsmodel.code = 0;
        rsmodel.data = result;
        rsmodel.message = "成功取得專家 token 使用量總覽";
    } catch (e) {
        console.error("error in getAllTokenUsageOverview", e);
        rsmodel.code = 1;
        rsmodel.message = e.message || "Failed to retrieve the total expert token usage.";
    }
    res.json(rsmodel);
};

exports.getAllActiveUserOverview = async function (req, res) {
    // 專家 人數 不重複人數 startDate endDate
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("expertController.getAllActiveUserOverview", req);
    let rsmodel = new responseModel();
    try {
        let { startDate, endDate } = req.query;

        // 檢查是否只有 endDate 而沒有 startDate
        if (endDate && !startDate) {
            throw new Error("Only endDate provided without startDate");
        }

        // 如果 startDate 和 endDate 都沒給，則不設時間範圍
        const hasStartDate = !!startDate;
        const hasEndDate = !!endDate;

        if (hasStartDate) {
            startDate = dayjs(startDate, ["YYYY-MM-DD HH:mm:ss", "YYYYMMDD HH:mm:ss", "YYYYMMDD"]).format(
                "YYYY-MM-DD HH:mm:ss"
            );
        }

        if (hasEndDate) {
            if (!endDate.includes(" ")) {
                endDate += " 23:59:59";
            }
            endDate = dayjs(endDate, ["YYYY-MM-DD HH:mm:ss", "YYYYMMDD HH:mm:ss", "YYYYMMDD"]).format(
                "YYYY-MM-DD HH:mm:ss"
            );
        } else if (hasStartDate) {
            // 如果有 startDate 但沒有 endDate，則將 endDate 設為今天的 23:59:59
            endDate = dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss");
        }

        // 獲取所有專家
        const experts = await Expert.findAll({
            where: {
                is_enable: 1,
            },
            attributes: ["id", "name"],
            raw: true,
        });

        const expertIds = experts.map((expert) => expert.id);

        // 使用 Sequelize 查詢
        const result = await ModelTokenLog.findAll({
            attributes: [
                "expert_id",
                [Sequelize.fn("COUNT", Sequelize.col("classify")), "total_usage"],
                [Sequelize.fn("COUNT", Sequelize.fn("DISTINCT", Sequelize.col("users_id"))), "total_people"],
            ],
            where: {
                expert_id: {
                    [Op.in]: expertIds,
                },
                ...((hasStartDate || hasEndDate) && {
                    create_time: {
                        ...(hasStartDate && { [Op.gte]: startDate }),
                        ...(hasEndDate && { [Op.lte]: endDate }),
                    },
                }),
            },
            group: ["expert_id"],
            raw: true,
        });

        // 將查詢結果轉換為以 expert_id 為鍵的對象
        const resultMap = result.reduce((acc, usage) => {
            acc[usage.expert_id] = usage;
            return acc;
        }, {});

        // 合併所有專家，沒有數據的專家顯示為 0
        const completeResult = experts.map((expert) => {
            const usage = resultMap[expert.id] || { total_usage: 0, total_people: 0 };
            return {
                id: null,
                expert_id: expert.id,
                expert_name: expert.name,
                user_count: parseInt(usage.total_usage, 10) || 0,
                unique_user_count: parseInt(usage.total_people, 10) || 0,
                start_date: startDate || "",
                end_date: endDate || "",
            };
        });

        // 依 user_count 排序，大到小
        completeResult.sort((a, b) => b.user_count - a.user_count);

        // 為每個條目添加 id
        completeResult.forEach((entry, index) => {
            entry.id = index + 1;
        });

        rsmodel.code = 0;
        rsmodel.data = completeResult;
        rsmodel.message = "成功取得專家使用人次總覽";
    } catch (e) {
        console.error("error in getAllActiveUserOverview", e);
        rsmodel.code = 1;
        rsmodel.message = "Failed to retrieve the total expert active user.";
    }
    res.json(rsmodel);
};

exports.getAllMostFrequentQuestion = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("expertController.getAllMostFrequentQuestion", req);
    let rsmodel = new responseModel();
    try {
        let { startDate, endDate, limit } = req.query;

        // 檢查是否只有 endDate 而沒有 startDate
        if (endDate && !startDate) {
            throw new Error("Only endDate provided without startDate");
        }

        // 如果 startDate 和 endDate 都沒給，則不設時間範圍
        const hasStartDate = !!startDate;
        const hasEndDate = !!endDate;

        if (hasStartDate) {
            startDate = dayjs(startDate, ["YYYY-MM-DD HH:mm:ss", "YYYYMMDD HH:mm:ss", "YYYYMMDD"]).format(
                "YYYY-MM-DD HH:mm:ss"
            );
        }

        if (hasEndDate) {
            if (!endDate.includes(" ")) {
                endDate += " 23:59:59";
            }
            endDate = dayjs(endDate, ["YYYY-MM-DD HH:mm:ss", "YYYYMMDD HH:mm:ss", "YYYYMMDD"]).format(
                "YYYY-MM-DD HH:mm:ss"
            );
        } else if (hasStartDate) {
            // 如果有 startDate 但沒有 endDate，則將 endDate 設為今天的 23:59:59
            endDate = dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss");
        }

        limit = limit || 10;

        // 使用 SQL 查詢
        const query = `
            WITH question_usage AS (
                SELECT
                    ck.expert_id,
                    ck.question,
                    COUNT(hcm.cache_id) AS usage_count
                FROM
                    cached_knowledge ck
                LEFT JOIN
                    history_cache_mapping hcm ON hcm.cache_id = ck.id
                JOIN
                    expert e ON ck.expert_id = e.id
                WHERE
                    e.is_enable = 1
                    AND hcm.create_time BETWEEN :startDate AND :endDate
                GROUP BY
                    ck.expert_id, ck.question
            )
            SELECT
                expert_id,
                question,
                SUM(usage_count) AS usage_count
            FROM
                question_usage
            GROUP BY
                expert_id, question
            ORDER BY
                usage_count DESC, question ASC
            LIMIT :limit
        `;

        const replacements = {
            startDate: startDate || "1970-01-01 00:00:00",
            endDate: endDate || dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss"),
            limit: parseInt(limit, 10),
        };

        const result = await sequelize.query(query, {
            replacements,
            type: Sequelize.QueryTypes.SELECT,
        });

        // 取得所有專家的名稱
        const experts = await Expert.findAll({
            attributes: ["id", "name"],
            raw: true,
        });

        const expertMap = experts.reduce((map, expert) => {
            map[expert.id] = expert.name;
            return map;
        }, {});

        // 扁平化輸出
        rsmodel.data = result.map((q, index) => ({
            id: index + 1,
            expert_id: q.expert_id,
            expert_name: expertMap[q.expert_id] || "Unknown",
            question: q.question,
            count: q.usage_count,
            start_date: startDate || "",
            end_date: endDate || "",
        }));

        rsmodel.code = 0;
        rsmodel.message = "Successfully retrieved expert's trending questions.";
    } catch (e) {
        console.error("error in getAllMostFrequentQuestion", e);
        rsmodel.code = 1;
        rsmodel.message = "Failed to retrieve the total expert most frequent question.";
    }
    res.json(rsmodel);
};

exports.updateExpertSharedConfig = async function (req, res) {
    logRouteDetails("expertController.updateExpertSharedConfig", req);
    let rsmodel = new responseModel();

    try {
        const parsedBody = JSON.parse(req.body);
        const { expertId } = parsedBody;
        console.info("expertController.updateExpertSharedConfig:", parsedBody);

        const { uid = "" } = req.session.userInfo || {};
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;

            // 只更新請求中存在的屬性
            const configUpdates = {};
            if (parsedBody.showExpertRecommendation !== undefined) {
                configUpdates.show_recommended_experts = parsedBody.showExpertRecommendation;
            }
            if (parsedBody.showDatasetName !== undefined) {
                configUpdates.show_dataset_name = parsedBody.showDatasetName;
            }
            if (parsedBody.recommendationExpertsId !== undefined) {
                configUpdates.recommendation_experts = parsedBody.recommendationExpertsId;
            }
            if (parsedBody.linkChunkLevel !== undefined) {
                configUpdates.link_chunk_level = parsedBody.linkChunkLevel;
            }
            if (parsedBody.enableContextHistory !== undefined) {
                configUpdates.enable_context_history = parsedBody.enableContextHistory;
            }
            if (parsedBody.translationExpert !== undefined) {
                configUpdates.translation_expert = parsedBody.translationExpert;
            }

            config = { ...config, ...configUpdates };

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expertId]);

            rsmodel.code = 0;
            rsmodel.message = "Successfully updated expert config";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateExpertSharedConfig:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the expert shared config";
    }

    res.json(rsmodel);
};
