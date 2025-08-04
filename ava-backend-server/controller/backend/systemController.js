const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const ChatTheme = require("../../orm/schema/chat_theme");
const Users = require("../../orm/schema/users");
const UserLoginType = require("../../orm/schema/user_login_type");
const Settings = require("../../orm/schema/settings");
const Expert = require("../../orm/schema/expert");
const Datasets = require("../../orm/schema/datasets");
const BanIp = require("../../orm/schema/ban_ip");
const BanIpHistory = require("../../orm/schema/ban_ip_history");
const Announcement = require("../../orm/schema/announcement");
const UserAcknowledgement = require("../../orm/schema/user_acknowledgement");
const ApiKeys = require("../../orm/schema/api_keys");
const ApiKeyDomains = require("../../orm/schema/api_key_domains");
const ApiKeyMapping = require("../../orm/schema/api_key_mapping");
const ApiKeyScopes = require("../../orm/schema/api_key_scopes");
const ApiKeyUsage = require("../../orm/schema/api_key_usage_logs");
const ModelTokenLog = require("../../orm/schema/model_token_log");
const AuditLog = require("../../orm/schema/audit_log");
const AuditLogActionType = require("../../orm/schema/audit_log_action_type");
const AuditLogEntityType = require("../../orm/schema/audit_log_entity_type");
const Skill = require("../../orm/schema/skill");
const FormConfiguration = require("../../orm/schema/form_configuration");
const sequelize = require("../../orm/sequelize");
const { Op } = require("sequelize");
const { getSystemStatus, getExpertsStatus } = require("../../utils/redisHelper");
const { generateApiKey } = require("../../utils/apiKey");
const { generateTheme, stressTest, vectorQuery, vectorSearch, word2vector } = require("../../utils/pythonAPI");
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;
const { convertStringsToNumbers } = require("../../utils/common");
const moment = require("moment-timezone");
const { redisClient } = require("../../global/redisStore.js");
const logRouteDetails = require("../routeNameLog");
const fs = require("fs/promises");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const axios = require("axios");
const ExcelJS = require("exceljs");
const GroupPermission = require("../../orm/schema/group_permission");

const { validatePermission } = require("../../utils/csc-permissionFilter");

const SSO_TYPE = process.env.SSO_TYPE;

exports.getUserPermissions = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const userNo = req?.session?.userInfo?.user_no;
        const compNo = req?.session?.userInfo?.comp_no;
        console.log("(getUserPermissions)userNo", userNo);

        try {
            // 獲取權限設置
            const { rows } = await sql.query(`
                SELECT key, value 
                FROM settings 
                WHERE key IN ('users_permission','knowledge_permission')
            `);

            // 從 ORM 中獲取群組權限數據
            const groupPermissions = await GroupPermission.findAll();

            // 解析權限資料
            let userPermission = null;
            let knowledgePermission = null;

            rows.forEach((row) => {
                if (row.key === "users_permission") {
                    userPermission = JSON.parse(row.value?.trim());
                } else if (row.key === "knowledge_permission") {
                    knowledgePermission = JSON.parse(row.value?.trim());
                }
            });

            // 建立使用者所屬群組的映射表 - 預處理階段
            const userGroups = new Set();

            // 遍歷所有群組，找出使用者所屬的群組
            if (groupPermissions && groupPermissions.length > 0) {
                groupPermissions.forEach((group) => {
                    // 使用 ORM 模型的 groupMember 屬性，已經是陣列格式
                    const members = group.groupMember || [];

                    // 如果使用者在此群組中，將群組ID加入使用者的群組集合
                    if (Array.isArray(members) && members.includes(userNo)) {
                        userGroups.add(`#${group.groupId}`);
                    }
                });
            }

            // 處理頁面權限
            const userPagePermissions = {};
            if (SSO_TYPE === "csc") {
                for (const [page, permissions] of Object.entries(knowledgePermission.pagePermissions || {})) {
                    userPagePermissions[page] = await validatePermission(permissions, compNo, userNo);
                }
            } else {
                Object.entries(knowledgePermission.pagePermissions || {}).forEach(([page, permissions]) => {
                    // 檢查直接使用者權限
                    let hasPermission = Array.isArray(permissions) && permissions.includes(userNo);

                    // 如果沒有直接權限，檢查群組權限
                    if (!hasPermission && Array.isArray(permissions)) {
                        // 檢查使用者所屬的任何群組是否有權限
                        hasPermission = permissions.some((permission) => {
                            // 如果權限以 # 開頭表示是群組權限
                            return permission.startsWith("#") && userGroups.has(permission);
                        });
                    }

                    userPagePermissions[page] = hasPermission;
                });
            }

            // 處理專家權限
            const userExpertPermissions = {};
            if (SSO_TYPE === "csc") {
                for (const [expertId, permissions] of Object.entries(knowledgePermission.experts || {})) {
                    userExpertPermissions[expertId] = await validatePermission(permissions, compNo, userNo);
                }
            } else {
                Object.entries(knowledgePermission.experts || {}).forEach(([expertId, permissions]) => {
                    let hasPermission = Array.isArray(permissions) && permissions.includes(userNo);

                    if (!hasPermission && Array.isArray(permissions)) {
                        hasPermission = permissions.some(
                            (permission) => permission.startsWith("#") && userGroups.has(permission)
                        );
                    }

                    userExpertPermissions[expertId] = hasPermission;
                });
            }

            // 處理數據集權限
            const userDatasetPermissions = {};
            if (SSO_TYPE === "csc") {
                for (const [datasetId, permissions] of Object.entries(knowledgePermission.datasets || {})) {
                    userDatasetPermissions[datasetId] = await validatePermission(permissions, compNo, userNo);
                }
            } else {
                Object.entries(knowledgePermission.datasets || {}).forEach(([datasetId, permissions]) => {
                    let hasPermission = Array.isArray(permissions) && permissions.includes(userNo);

                    if (!hasPermission && Array.isArray(permissions)) {
                        hasPermission = permissions.some(
                            (permission) => permission.startsWith("#") && userGroups.has(permission)
                        );
                    }

                    userDatasetPermissions[datasetId] = hasPermission;
                });
            }

            // 處理動作權限
            const userActionPermissions = {};
            if (SSO_TYPE === "csc") {
                for (const [action, permissions] of Object.entries(knowledgePermission.actionPermissions || {})) {
                    userActionPermissions[action] = await validatePermission(permissions, compNo, userNo);
                }
            } else {
                Object.entries(knowledgePermission.actionPermissions || {}).forEach(([action, permissions]) => {
                    let hasPermission = Array.isArray(permissions) && permissions.includes(userNo);

                    if (!hasPermission && Array.isArray(permissions)) {
                        hasPermission = permissions.some(
                            (permission) => permission.startsWith("#") && userGroups.has(permission)
                        );
                    }

                    userActionPermissions[action] = hasPermission;
                });
            }

            // super admin
            const superAdmin = req?.session?.isSuperAdmin;
            const user_no = req?.session?.userInfo?.user_no;
            const nickname = req?.session?.userInfo?.nickname;
            if (superAdmin && user_no === "super-admin" && nickname === "超級管理員專用帳號") {
                userActionPermissions["allowedToViewSuperAdmin"] = true;
            }

            // 處理技能權限
            const userSkillPermissions = {};
            if (SSO_TYPE === "csc") {
                for (const [skillId, permissions] of Object.entries(knowledgePermission.skills || {})) {
                    userSkillPermissions[skillId] = await validatePermission(permissions, compNo, userNo);
                }
            } else {
                Object.entries(knowledgePermission.skills || {}).forEach(([skillId, permissions]) => {
                    let hasPermission = Array.isArray(permissions) && permissions.includes(userNo);

                    if (!hasPermission && Array.isArray(permissions)) {
                        hasPermission = permissions.some(
                            (permission) => permission.startsWith("#") && userGroups.has(permission)
                        );
                    }

                    userSkillPermissions[skillId] = hasPermission;
                });
            }

            // 處理聊天專家權限
            const userChatExpertPermissions = {};
            if (SSO_TYPE === "csc") {
                for (const [expertId, permissions] of Object.entries(knowledgePermission.chatExperts || {})) {
                    userChatExpertPermissions[expertId] = await validatePermission(permissions, compNo, userNo);
                }
            } else {
                Object.entries(knowledgePermission.chatExperts || {}).forEach(([expertId, permissions]) => {
                    let hasPermission = Array.isArray(permissions) && permissions.includes(userNo);

                    if (!hasPermission && Array.isArray(permissions)) {
                        hasPermission = permissions.some(
                            (permission) => permission.startsWith("#") && userGroups.has(permission)
                        );
                    }

                    userChatExpertPermissions[expertId] = hasPermission;
                });
            }

            // 檢查主權限
            const mainPermissions = userPermission.some((permission) => permission.includes(userNo));

            rsmodel.code = 0;
            rsmodel.data = {
                userPermission: mainPermissions,
                pagePermissions: userPagePermissions,
                expertPermissions: userExpertPermissions,
                datasetPermissions: userDatasetPermissions,
                skillPermissions: userSkillPermissions,
                chatExpertPermissions: userChatExpertPermissions,
                actionPermissions: userActionPermissions,
                enableCrawler: process.env.ENABLE_CRAWLER === "1",
                userGroups: Array.from(userGroups), // 返回使用者所屬的群組，如果需要的話
            };
        } catch (e) {
            console.error("(getUserPermissions)Error fetching permissions", e);
            rsmodel.code = 1;
            rsmodel.message = "Error fetching permissions";
        }
    } catch (error) {
        console.error("(getUserPermissions)Error fetching permissions", error);
        rsmodel.code = 1;
        rsmodel.message = "Error fetching permissions";
    }

    res.json(rsmodel);
};

exports.getSettings = async function (req, res) {
    logRouteDetails("systemController.getSettings", req);

    let rsmodel = new responseModel();
    try {
        const sqlStr = `
            SELECT key, value 
            FROM settings 
            WHERE key IN ( 'max_file_size', 'max_image_size', 'create_session_limit','ban_ip_expire_date')
            `;
        const { rows } = await sql.query(sqlStr);

        // 初始化空的變數來存儲查詢結果
        let maxFileSize = null;
        let maxImageSize = null;
        let sessionLimit = null;
        let banIpExpireDate = null;
        // 迴圈處理每一個 row，並依據 key 將值解析到對應的變數
        rows.forEach((row) => {
            switch (row.key) {
                case "max_file_size":
                    maxFileSize = parseInt(row.value?.trim(), 10);
                    break;
                case "max_image_size":
                    maxImageSize = parseInt(row.value?.trim(), 10);
                    break;
                case "create_session_limit":
                    sessionLimit = parseInt(row.value?.trim(), 10);
                    break;
                case "ban_ip_expire_date":
                    banIpExpireDate = row.value;
                    break;
            }
        });

        // 構造返回的 rsmodel
        rsmodel.code = 0;
        rsmodel.data = {
            maxFileSize,
            maxImageSize,
            sessionLimit,
            banIpExpireDate,
        };
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getDashboardData = async function (req, res) {
    logRouteDetails("systemController.getDashboardData", req);
    let rsmodel = new responseModel();
    try {
        // 取得各表的資料筆數
        const countsSql = `
            SELECT 
                (SELECT COUNT(*) FROM users WHERE is_enable = 1) AS users,
                (SELECT COUNT(*) FROM expert WHERE is_enable = 1) AS experts,
                (SELECT COUNT(*) FROM datasets WHERE is_enable = 1) AS datasets,
                (SELECT COUNT(*) FROM skill WHERE is_enable = 1) AS skills,
                (SELECT COUNT(*) FROM form_configuration WHERE is_enable = 1) AS forms
        `;
        const rs = await sql.query(countsSql);

        // 如果查詢結果為空，將筆數預設為0
        const counts = rs.rows[0] || {
            users: 0,
            experts: 0,
            datasets: 0,
            skills: 0,
            forms: 0,
        };

        // 構造返回的 rsmodel
        rsmodel.code = 0;
        rsmodel.data = counts;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "Server error";
    }
    res.json(rsmodel);
};

exports.getKnowledgePermission = async function (req, res) {
    logRouteDetails("systemController.getKnowledgePermission", req);
    let rsmodel = new responseModel();
    try {
        const sqlStr = `SELECT value FROM settings WHERE key='knowledge_permission'`;
        const { rows } = await sql.query(sqlStr);
        const knowledgePermission = JSON.parse(rows[0].value);
        rsmodel.code = 0;
        rsmodel.data = knowledgePermission;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
/* 取得版本號設定 */
exports.getSystemVersion = async function (req, res) {
    logRouteDetails("systemController.getSystemVersion", req);
    let rsmodel = new responseModel();
    try {
        const sqlStr = `SELECT value FROM settings WHERE key='system_version'`;
        const { rows } = await sql.query(sqlStr);
        rsmodel.code = 0;
        rsmodel.data = rows[0].value;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
/* 更新版本號 */
exports.updateSystemVersion = async function (req, res) {
    logRouteDetails("systemController.updateSystemVersion", req);
    let rsmodel = new responseModel();
    try {
        const { text } = JSON.parse(req.body);
        console.info("systemController.updateSystemVersion:", JSON.parse(req.body));
        console.log(text, req.body);
        const sqlStr = `UPDATE settings SET value='${text}' WHERE key='system_version'`;
        await sql.query(sqlStr);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/* 取得聊天室設定 */
exports.getChatSettings = async function (req, res) {
    logRouteDetails("systemController.getChatSettings", req);
    let rsmodel = new responseModel();
    try {
        const keys = [
            "conversation_direction",
            "system_client_theme_default",
            "welcome_word_update_frequency",
            "show_extra_chunk",
            "show_source_chunk",
            "text_prison_words",
            "enable_rtc_recording",
            "rate_limit_rules",
            "popular_tags",
            "min_message_length",
            "max_message_length",
            "chat_input_placeholder",
            "chat_input_height",
            "chat_file_upload_enable",
            "chat_file_translate_enable",
        ];

        const settings = await Settings.findAll({
            where: {
                key: keys,
            },
            attributes: ["key", "value"],
        });

        const dataObj = {};

        // 將設定檔資料轉換成物件
        settings.forEach((row) => {
            if (row.key === "conversation_direction") {
                dataObj.conversation_direction = row.value;
            } else if (row.key === "system_client_theme_default") {
                dataObj.system_client_theme_default = row.value;
            } else if (row.key === "welcome_word_update_frequency") {
                dataObj.welcome_word_update_frequency = row.value;
            } else if (row.key === "show_extra_chunk") {
                dataObj.show_extra_chunk = row.value;
            } else if (row.key === "show_source_chunk") {
                dataObj.show_source_chunk = row.value;
            } else if (row.key === "text_prison_words") {
                dataObj.text_prison_words = JSON.parse(row.value);
            } else if (row.key === "enable_rtc_recording") {
                dataObj.enable_rtc_recording = row.value;
            } else if (row.key === "rate_limit_rules") {
                dataObj.rateLimitRules = JSON.parse(row.value);
            } else if (row.key === "popular_tags") {
                dataObj.popular_tags = JSON.parse(row.value);
            } else if (row.key === "min_message_length") {
                dataObj.min_message_length = parseInt(row.value, 10);
            } else if (row.key === "max_message_length") {
                dataObj.max_message_length = parseInt(row.value, 10);
            } else if (row.key === "chat_input_placeholder") {
                dataObj.chat_input_placeholder = row.value;
            } else if (row.key === "chat_input_height") {
                dataObj.chat_input_height = parseInt(row.value, 10);
            } else if (row.key === "chat_file_upload_enable") {
                dataObj.chat_file_upload_enable = parseInt(row.value, 10);
            } else if (row.key === "chat_file_translate_enable") {
                dataObj.chat_file_translate_enable = parseInt(row.value, 10);
            }
        });
        rsmodel.code = 0;
        rsmodel.data = dataObj;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.updateSettings = async (req, res) => {
    let rsmodel = { code: -1 };
    try {
        const updates = JSON.parse(req.body);

        // 批量更新所有變更的設定
        for (const [key, value] of Object.entries(updates)) {
            await Settings.update({ value: value.toString() }, { where: { key: key } });
        }

        rsmodel.code = 0;
    } catch (error) {
        console.error("updateSettings error:", error);
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

/* 更新聊天室使用者對話位置 */
exports.updateUserDialogConversationDirection = async function (req, res) {
    logRouteDetails("systemController.updateUserDialogConversationDirection", req);
    let rsmodel = new responseModel();
    try {
        const { conversation_direction } = JSON.parse(req.body);
        console.info("systemController.updateUserDialogConversationDirection:", JSON.parse(req.body));
        const sqlStr = `UPDATE settings SET value='${conversation_direction}' WHERE key='conversation_direction'`;
        await sql.query(sqlStr);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/* 更新聊天室預設主題 */
exports.updateSystemClientThemeDefault = async function (req, res) {
    logRouteDetails("systemController.updateSystemClientThemeDefault", req);
    let rsmodel = new responseModel();
    try {
        const { system_client_theme_default } = JSON.parse(req.body);
        console.info("systemController.updateSystemClientThemeDefault:", JSON.parse(req.body));
        const sqlStr = `UPDATE settings SET value='${system_client_theme_default}' WHERE key='system_client_theme_default'`;
        await sql.query(sqlStr);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/* 更新聊天室歡迎詞頻率 */
exports.updateWelcomeWordUpdateFrequency = async function (req, res) {
    logRouteDetails("systemController.updateWelcomeWordUpdateFrequency", req);
    let rsmodel = new responseModel();
    try {
        const { welcome_word_update_frequency } = JSON.parse(req.body);
        console.info("systemController.updateWelcomeWordUpdateFrequency:", JSON.parse(req.body));
        const sqlStr = `UPDATE settings SET value='${welcome_word_update_frequency}' WHERE key='welcome_word_update_frequency'`;
        await sql.query(sqlStr);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/* 更新是否顯示資料來源 */
exports.updateShowSourceChunk = async function (req, res) {
    logRouteDetails("systemController.updateShowSourceChunk", req);
    let rsmodel = new responseModel();
    try {
        const { showSourceChunk } = JSON.parse(req.body);
        console.info("systemController.updateShowSourceChunk:", JSON.parse(req.body));
        const sqlStr = `UPDATE settings SET value='${showSourceChunk}' WHERE key='show_source_chunk'`;
        await sql.query(sqlStr);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/* 更新是否顯示資料相關 */
exports.updateShowExtraChunk = async function (req, res) {
    logRouteDetails("systemController.updateShowExtraChunk", req);
    let rsmodel = new responseModel();
    try {
        const { showExtraChunk } = JSON.parse(req.body);
        console.info("systemController.updateShowExtraChunk:", JSON.parse(req.body));
        const sqlStr = `UPDATE settings SET value='${showExtraChunk}' WHERE key='show_extra_chunk'`;
        await sql.query(sqlStr);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/* 更新禁用詞 */
exports.updateTextPrison = async function (req, res) {
    logRouteDetails("systemController.updateTextPrison", req);
    let rsmodel = new responseModel();
    try {
        const { text_prison_words } = JSON.parse(req.body);
        console.info("systemController.updateTextPrison:", JSON.parse(req.body));
        // 將陣列轉換為 JSON 字符串
        const jsonString = JSON.stringify(text_prison_words);

        const sqlStr = `UPDATE settings SET value='${jsonString}' WHERE key='text_prison_words'`;
        await sql.query(sqlStr);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/* 更新聊天室熱門標籤 */
exports.updatePopularTags = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("systemController.updatePopularTags", req);
    let rsmodel = new responseModel();
    try {
        const { popular_tags } = JSON.parse(req.body);
        console.info("systemController.updatePopularTags:", popular_tags);

        // 從資料庫獲取現有的 popular_tags
        const existingSettings = await Settings.findOne({
            where: { key: "popular_tags" },
        });

        let currentData = {};
        if (existingSettings && existingSettings.value) {
            currentData = JSON.parse(existingSettings.value);
        }

        // 更新 currentIcons，保持 iconList 不變
        const updatedData = {
            iconList: currentData.iconList || [],
            currentIcons: popular_tags,
        };

        const jsonString = JSON.stringify(updatedData);

        await Settings.update(
            { value: jsonString },
            {
                where: { key: "popular_tags" },
                fields: ["value"],
            }
        );

        rsmodel.code = 0;
        rsmodel.message = "更新熱門標籤成功";
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "更新熱門標籤失敗";
    }
    res.json(rsmodel);
};

/* 取得icon列表 */
exports.getIconList = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("systemController.getIconList", req);
    let rsmodel = new responseModel();
    try {
        const setting = await Settings.findOne({
            where: { key: "popular_tags" },
            attributes: ["value"],
        });

        if (setting && setting.value) {
            const popularTags = JSON.parse(setting.value?.trim());
            rsmodel.code = 0;
            rsmodel.message = "取得icon列表成功";
            rsmodel.data = popularTags.iconList;
        } else {
            rsmodel.code = 1;
            rsmodel.message = "資料庫讀取icon列表錯誤";
        }
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "取得icon列表失敗";
    }
    res.json(rsmodel);
};

/* 新增icon */
exports.addIcon = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("systemController.addIcon", req);
    let rsmodel = new responseModel();
    try {
        const { icon, name } = JSON.parse(req.body);
        console.info("systemController.addIcon:", JSON.parse(req.body));

        const setting = await Settings.findOne({
            where: { key: "popular_tags" },
            attributes: ["value"],
        });

        if (setting && setting.value) {
            const popularTags = JSON.parse(setting.value?.trim());
            popularTags.iconList.push({ icon, name });

            await Settings.update({ value: JSON.stringify(popularTags) }, { where: { key: "popular_tags" } });

            rsmodel.code = 0;
            rsmodel.message = "新增熱門標籤成功";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "新增熱門標籤錯誤";
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/* 刪除icon */
exports.deleteIcon = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("systemController.deleteIcon", req);
    let rsmodel = new responseModel();
    try {
        const { names } = JSON.parse(req.body);
        console.info("systemController.deleteIcon:", JSON.parse(req.body));

        // 從資料庫獲取現有的 popular_tags
        const setting = await Settings.findOne({
            where: { key: "popular_tags" },
            attributes: ["value"],
        });

        if (setting && setting.value) {
            const popularTags = JSON.parse(setting.value?.trim());

            // 過濾掉 iconList 中與 names 相同的 icon
            popularTags.iconList = popularTags.iconList.filter((item) => {
                return !Object.values(names).includes(item.icon);
            });

            await Settings.update({ value: JSON.stringify(popularTags) }, { where: { key: "popular_tags" } });

            rsmodel.code = 0;
            rsmodel.message = "刪除熱門標籤成功";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "資料庫讀取熱門標籤錯誤";
        }
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "刪除熱門標籤失敗";
    }
    res.json(rsmodel);
};

/* 更新語音輸入功能狀態 */
exports.updateRecordRTC = async function (req, res) {
    logRouteDetails("systemController.updateRecordRTC", req);
    let rsmodel = new responseModel();
    try {
        const { enableRecordRTC } = JSON.parse(req.body);
        console.info("systemController.updateRecordRTC:", JSON.parse(req.body));
        const jsonString = JSON.stringify(enableRecordRTC);

        const sqlStr = `UPDATE settings SET value='${jsonString}' WHERE key='enable_rtc_recording'`;
        await sql.query(sqlStr);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

const { updateRulesFromDatabase } = require("../../global/redisStore");

exports.updateRateLimit = async function (req, res) {
    logRouteDetails("systemController.updateRateLimit", req);
    let rsmodel = new responseModel();
    try {
        // 從 req.body 解析 rateLimitRules
        const { rateLimitRules } = JSON.parse(req.body);
        console.info("systemController.updateRateLimit:", JSON.parse(req.body));

        convertStringsToNumbers(rateLimitRules);

        // 將 rateLimitRules 轉換為 JSON 字串
        const jsonString = JSON.stringify(rateLimitRules);

        // 先檢查 settings 表中是否存在 key 為 'rate_limit_rules'
        const checkSqlStr = `SELECT COUNT(*) FROM settings WHERE key = 'rate_limit_rules'`;
        const result = await sql.query(checkSqlStr);

        let querySuccess = false;
        if (result.rows[0].count > 0) {
            // 如果存在，則更新 value
            const updateSqlStr = `UPDATE settings SET value = $1 WHERE key = 'rate_limit_rules'`;
            const updateResult = await sql.query(updateSqlStr, [jsonString]);
            querySuccess = updateResult.rowCount > 0; // 確認更新是否成功
        } else {
            // 如果不存在，則插入新記錄
            const insertSqlStr = `INSERT INTO settings (key, value) VALUES ('rate_limit_rules', $1)`;
            const insertResult = await sql.query(insertSqlStr, [jsonString]);
            querySuccess = insertResult.rowCount > 0; // 確認插入是否成功
        }

        if (querySuccess) {
            // 確認更新或插入成功後，執行 updateRulesFromDatabase
            await updateRulesFromDatabase();

            // 設置成功回應
            rsmodel.code = 0;
            rsmodel.success = true;
            rsmodel.message = "更新成功";
        } else {
            // 如果更新或插入不成功，回應錯誤
            throw new Error("更新或插入失敗");
        }
    } catch (error) {
        console.error("更新失敗:", error);
        rsmodel.success = false;
        rsmodel.message = "更新失敗";
    }

    // 回應前端
    res.json(rsmodel);
};

exports.systemSyncCrawlerSchedule = async function (req, res) {
    logRouteDetails("systemController.systemSyncCrawlerSchedule", req);
    let rsmodel = new responseModel();
    try {
        const datasource_type = "B";
        const { syncItems, syncDays, syncTime, type } = JSON.parse(req.body);
        const syncScheduleTableName =
            type === "attachment" ? "crawler_attachment_sync_schedule" : "crawler_sync_schedule";
        console.info("systemController.systemSyncCrawlerSchedule:", JSON.parse(req.body));
        let datasource_id = "";

        // 1. 檢查 datasource 資料表
        for (let syncItem of syncItems) {
            const { datasetId, crawlerId } = syncItem;

            let rs = await sql.query(
                "SELECT a.id datasource_id, b.id upload_folder_id FROM datasource a LEFT JOIN upload_folder b ON a.id = b.datasource_id WHERE a.datasets_id = $1 AND a.type = 'B'",
                [datasetId]
            );
            rs = rs.rows[0];

            // 1.1 如果沒有資料，新增一筆
            if (!rs || !rs.datasource_id) {
                datasource_id = uuidv4();
                await sql.query("INSERT INTO datasource(id, datasets_id, type, is_enable) VALUES($1, $2, $3, $4)", [
                    datasource_id,
                    datasetId,
                    datasource_type,
                    1,
                ]);
            } else {
                datasource_id = rs.datasource_id;
            }

            // 計算 next_sync_date
            const calculateNextSyncDate = () => {
                if (!syncDays || !syncTime) return null;

                const now = moment.tz("Asia/Taipei");
                const nextSyncDate = now.add(syncDays, "days");
                const [hours, minutes] = syncTime.split(":");
                nextSyncDate.set({ hour: parseInt(hours, 10), minute: parseInt(minutes, 10), second: 0 });
                return nextSyncDate.format("YYYY-MM-DD HH:mm:ss");
            };

            const next_sync_date = calculateNextSyncDate();

            // 為每個 crawlerId 和 datasetId 插入或更新排程記錄
            const existingSchedule = await sql.query(
                `SELECT id FROM ${syncScheduleTableName} WHERE dataset_id = $1 AND crawler_id = $2`,
                [datasetId, crawlerId]
            );

            if (existingSchedule.rows.length > 0) {
                // 如果已經存在，則進行更新
                await sql.query(
                    `UPDATE ${syncScheduleTableName} SET sync_days = $1, sync_time = $2, next_sync_date = $3 WHERE dataset_id = $4 AND crawler_id = $5`,
                    [syncDays || null, syncTime || null, next_sync_date, datasetId, crawlerId]
                );
            } else {
                // 如果不存在，則插入新的記錄
                await sql.query(
                    `INSERT INTO ${syncScheduleTableName} (dataset_id, datasource_id, crawler_id, sync_days, sync_time, next_sync_date) VALUES($1, $2, $3, $4, $5, $6)`,
                    [datasetId, datasource_id, crawlerId, syncDays || null, syncTime || null, next_sync_date]
                );
            }
        }

        rsmodel.code = 0;
        rsmodel.message = "爬蟲排程設定成功";
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};

exports.delayCrawlerSchedule = async function (req, res) {
    logRouteDetails("systemController.delayCrawlerSchedule", req);
    let rsmodel = new responseModel();
    try {
        const { syncItems, delayHours, delayMinutes, isDelay, type } = JSON.parse(req.body);
        const syncScheduleTableName =
            type === "attachment" ? "crawler_attachment_sync_schedule" : "crawler_sync_schedule";
        console.info("systemController.delayCrawlerSchedule:", JSON.parse(req.body));

        if (delayHours < 0 || delayMinutes < 0) {
            rsmodel.code = 1;
            rsmodel.message = "設定時間不能為負數";
            return res.json(rsmodel);
        }

        for (let syncItem of syncItems) {
            const { datasetId, crawlerId } = syncItem;

            // 取得當前的排程資訊
            const currentSchedule = await sql.query(
                `SELECT next_sync_date FROM ${syncScheduleTableName} WHERE dataset_id = $1 AND crawler_id = $2`,
                [datasetId, crawlerId]
            );

            if (currentSchedule.rows.length > 0) {
                const { next_sync_date } = currentSchedule.rows[0];

                if (!next_sync_date) continue;

                // 計算新的 next_sync_date
                const nextSyncMoment = moment(next_sync_date).tz("Asia/Taipei");

                // 根據 isDelay 決定是要加還是減
                if (isDelay) {
                    nextSyncMoment.add(delayHours, "hours").add(delayMinutes, "minutes");
                } else {
                    nextSyncMoment.subtract(delayHours, "hours").subtract(delayMinutes, "minutes");
                }

                const newNextSyncDate = nextSyncMoment.format("YYYY-MM-DD HH:mm:ss");

                // 更新 next_sync_date
                await sql.query(
                    `UPDATE ${syncScheduleTableName} SET next_sync_date = $1 WHERE dataset_id = $2 AND crawler_id = $3`,
                    [newNextSyncDate, datasetId, crawlerId]
                );
            }
        }

        rsmodel.code = 0;
        rsmodel.message = `成功${isDelay ? "延遲" : "提前"}爬蟲排程`;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};

exports.deleteCrawlerSchedule = async function (req, res) {
    logRouteDetails("systemController.deleteCrawlerSchedule", req);
    let rsmodel = new responseModel();
    try {
        const { syncItems, type } = JSON.parse(req.body);
        console.info("systemController.deleteCrawlerSchedule:", JSON.parse(req.body));
        const syncScheduleTableName =
            type === "attachment" ? "crawler_attachment_sync_schedule" : "crawler_sync_schedule";
        for (let syncItem of syncItems) {
            const { datasetId, crawlerId } = syncItem;
            // 更新 sync_days, sync_time 和 next_sync_date 為 NULL
            await sql.query(
                `UPDATE ${syncScheduleTableName} SET sync_days = NULL, sync_time = NULL, next_sync_date = NULL WHERE dataset_id = $1 AND crawler_id = $2`,
                [datasetId, crawlerId]
            );
        }

        rsmodel.code = 0;
        rsmodel.message = "更新爬蟲排程成功";
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error);
    }

    res.json(rsmodel);
};

/* 使用者權限設置 - 取得使用者清單 */
exports.getUsers = async function (req, res) {
    logRouteDetails("systemController.getUsers", req);
    let rsmodel = new responseModel();
    try {
        const result = await sql.query(
            "SELECT u.name, u.id, ult.auth_id AS user_no FROM users u JOIN user_login_type ult ON u.id = ult.user_id WHERE u.user_type_id = 2 AND u.is_enable = 1 AND u.name IS NOT NULL AND u.name != '';"
        );

        let userList = [];
        if (result && result.rows) {
            userList = result.rows;
        }
        rsmodel.code = 0;
        rsmodel.data = userList;
    } catch (error) {
        console.error("Getting users data go wrong.", error);
        rsmodel.code = 1;
        rsmodel.message = "取得使用者清單時發生問題。";
    }
    res.json(rsmodel);
};

/* 使用者權限設置 - 取得專家、知識庫清單 */
exports.getExpertsAndDatasets = async function (req, res) {
    logRouteDetails("systemController.getExpertsAndDatasets", req);
    let rsmodel = new responseModel();
    try {
        const experts = await Expert.findAll({
            attributes: ["id", "name"],
            where: {
                is_enable: 1,
            },
        });

        const datasets = await Datasets.findAll({
            attributes: ["id", "name"],
            where: {
                is_enable: 1,
            },
        });
        const responseData = {
            experts: experts || [],
            datasets: datasets || [],
        };

        rsmodel.code = 0;
        rsmodel.data = responseData;
    } catch (error) {
        console.error("Getting experts and datasets data go wrong.", error);
        rsmodel.code = 1;
        rsmodel.message = "取得專家與知識庫清單時發生錯誤。";
    }
    res.json(rsmodel);
};

/* 使用者權限設置 - 取得權限設置表 */
exports.getPermissionSetting = async function (req, res) {
    logRouteDetails("systemController.getPermissionSetting", req);
    let rsmodel = new responseModel();
    try {
        const result = await sql.query("SELECT value FROM settings WHERE key='knowledge_permission';");
        let permissionSetting = {};
        if (result && result.rows && result.rows[0]) {
            permissionSetting = result.rows[0].value;
        }
        rsmodel.code = 0;
        rsmodel.data = permissionSetting;
    } catch (error) {
        console.error("Getting permission-setting go wrong.", error);
        rsmodel.code = 1;
        rsmodel.message = "取得權限設置表時發生問題。";
    }
    res.json(rsmodel);
};

exports.getChatTheme = async function (req, res) {
    logRouteDetails("systemController.getChatTheme", req);
    let rsmodel = new responseModel();
    try {
        // 使用 Settings ORM 來查詢預設主題
        const defaultThemeSetting = await Settings.findOne({
            where: { key: "system_client_theme_default" },
        });

        const defaultTheme = defaultThemeSetting?.value || "dark";

        // 獲取所有主題
        const themes = await ChatTheme.findAll({
            order: [
                ["is_system", "DESC"],
                ["create_time", "ASC"],
            ],
        });

        // 將主題數據轉換為前端需要的格式
        const themeData = {};

        // 如果預設主題存在於主題列表中，先添加預設主題
        const defaultThemeData = themes.find((theme) => theme.name === defaultTheme);
        if (defaultThemeData) {
            themeData[defaultTheme] = defaultThemeData.colors;
            themeData[defaultTheme].remark = defaultThemeData.remark;
            themeData[defaultTheme].is_system = defaultThemeData.is_system;
        }

        // 添加其他主題
        themes.forEach((theme) => {
            if (theme.name !== defaultTheme) {
                themeData[theme.name] = theme.colors;
                themeData[theme.name].remark = theme.remark;
                themeData[theme.name].is_system = theme.is_system;
            }
        });

        rsmodel.code = 0;
        rsmodel.data = themeData;
    } catch (error) {
        console.error("Error getting chat themes:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getLockTheme = async function (req, res) {
    logRouteDetails("systemController.getLockTheme", req);
    let rsmodel = new responseModel();
    try {
        const lockThemeSetting = await Settings.findOne({
            where: { key: "lock_chat_theme" },
        });
        // 將 "1" 轉為 true，其他值("0" 或 null)轉為 false
        const lockTheme = lockThemeSetting?.value === "1";
        rsmodel.code = 0;
        rsmodel.data = lockTheme;
    } catch (error) {
        console.error("Error getting lock theme:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

/** 新增主題色配置 */
exports.createChatTheme = async function (req, res) {
    logRouteDetails("systemController.createChatTheme", req);
    let rsmodel = new responseModel();
    try {
        const { name, remark, colors } = JSON.parse(req.body);
        console.info("systemController.createChatTheme:", JSON.parse(req.body));
        // 驗證主題名稱
        if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
            throw new Error("主題名稱必須是英文字母、數字、- 或 _ 符號");
        }

        // 檢查主題名稱是否已存在
        const existingTheme = await ChatTheme.findOne({ where: { name } });
        if (existingTheme) {
            throw new Error("主題色系名稱已存在");
        }

        // 驗證顏色配置
        // const requiredSections = ["navigation", "topBar", "chatArea", "inputArea"];
        // const requiredColors = ["bg", "text"];

        // requiredSections.forEach((section) => {
        //     if (!colors[section]) {
        //         throw new Error(`缺少 ${section} 區域的配置`);
        //     }
        //     requiredColors.forEach((colorType) => {
        //         if (!colors[section][colorType]) {
        //             throw new Error(`缺少 ${section} 區域的 ${colorType} 顏色配置`);
        //         }
        //     });
        // });

        // 創建新主題
        const newTheme = await ChatTheme.create({
            name,
            remark,
            colors,
            is_system: false,
        });

        rsmodel.code = 0;
        rsmodel.data = newTheme;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.updateCurrentChatTheme = async function (req, res) {
    logRouteDetails("systemController.updateCurrentChatTheme", req);
    let rsmodel = new responseModel();
    try {
        const { name } = JSON.parse(req.body);
        console.info("systemController.updateCurrentChatTheme:", JSON.parse(req.body));

        if (!name) {
            rsmodel.code = 1;
            rsmodel.message = "Theme name is required";
            return res.json(rsmodel);
        }

        // 使用 Sequelize 更新 settings 表
        const [updatedCount] = await Settings.update(
            { value: name },
            {
                where: {
                    key: "system_client_theme_default",
                },
            }
        );

        if (updatedCount > 0) {
            rsmodel.code = 0;
            rsmodel.message = "Theme updated successfully";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Theme setting not found";
        }
    } catch (error) {
        console.error("Error updating current theme:", error);
        rsmodel.code = 1;
        rsmodel.message = "Failed to update theme";
    }

    res.json(rsmodel);
};

exports.updateChatThemeColors = async function (req, res) {
    logRouteDetails("systemController.updateChatThemeColors", req);
    let rsmodel = new responseModel();
    try {
        const { name, colors } = JSON.parse(req.body);
        console.info("systemController.updateChatThemeColors:", JSON.parse(req.body));
        // 參數驗證
        if (!name || !colors) {
            rsmodel.code = 1;
            rsmodel.message = "缺少必要參數";
            return res.json(rsmodel);
        }
        // 驗證主題名稱
        if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
            rsmodel.code = 1;
            rsmodel.message = "主題名稱必須是英文字母、數字、- 或 _ 符號";
            return res.json(rsmodel);
        }

        // 驗證顏色配置
        const requiredSections = ["topBar", "chatArea", "inputArea", "navigation", "base"];
        const requiredColors = {
            base: ["primary", "secondary", "tertiary"],
            topBar: ["bg", "text"],
            chatArea: ["bg", "text"],
            inputArea: ["bg", "text"],
            navigation: ["bg", "text"],
        };

        // 檢查必要的顏色配置
        // for (const section of requiredSections) {
        //     if (!colors[section]) {
        //         rsmodel.code = 1;
        //         rsmodel.message = `缺少 ${section} 區域的配置`;
        //         return res.json(rsmodel);
        //     }

        //     const required = requiredColors[section];
        //     for (const colorType of required) {
        //         if (!colors[section][colorType]) {
        //             rsmodel.code = 1;
        //             rsmodel.message = `缺少 ${section} 區域的 ${colorType} 顏色配置`;
        //             return res.json(rsmodel);
        //         }
        //     }
        // }

        // 檢查主題是否存在
        const existingTheme = await ChatTheme.findOne({
            where: { name },
        });

        if (!existingTheme) {
            rsmodel.code = 1;
            rsmodel.message = "主題不存在";
            return res.json(rsmodel);
        }

        // 更新主題
        await ChatTheme.update(
            {
                colors: colors,
                update_time: new Date(),
            },
            {
                where: { name },
            }
        );

        rsmodel.code = 0;
        rsmodel.data = {
            name,
            colors,
        };
    } catch (error) {
        console.error("更新主題失敗:", error);
        rsmodel.code = 500;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};

exports.toggleLockTheme = async function (req, res) {
    logRouteDetails("systemController.toggleLockTheme", req);
    let rsmodel = new responseModel();
    try {
        const { toggleStatus } = JSON.parse(req.body);
        console.info("systemController.toggleLockTheme:", JSON.parse(req.body));

        // 查找是否存在 lock_chat_theme 設定
        const lockThemeSetting = await Settings.findOne({
            where: { key: "lock_chat_theme" },
        });

        if (lockThemeSetting) {
            // 如果設定存在，則切換狀態
            const currentStatus = lockThemeSetting.value === "1";
            const newStatus = !currentStatus;

            await lockThemeSetting.update({
                value: newStatus ? "1" : "0",
            });
        } else {
            // 如果設定不存在，則創建新設定
            await Settings.create({
                key: "lock_chat_theme",
                value: toggleStatus ? "1" : "0",
            });
        }

        rsmodel.code = 0;
        rsmodel.message = "主題鎖定狀態更新成功";
    } catch (error) {
        console.error("更新主題鎖定狀態失敗:", error);
        rsmodel.code = 1;
        rsmodel.message = "更新主題鎖定狀態失敗";
    }
    res.json(rsmodel);
};

// 刪除主題
exports.deleteTheme = async function (req, res) {
    logRouteDetails("systemController.deleteTheme", req);
    let rsmodel = new responseModel();
    try {
        const themeName = req.params.name;
        console.info("systemController.deleteTheme:", req.params);
        // 檢查主題是否存在
        const theme = await ChatTheme.findOne({
            where: { name: themeName },
        });

        if (!theme) {
            throw new Error("主題不存在");
        }

        if (theme.is_system) {
            throw new Error("系統主題無法刪除");
        }

        // 檢查是否為當前使用的主題
        const currentThemeSetting = await Settings.findOne({
            where: { key: "system_client_theme_default" },
        });

        // 使用 Sequelize 的交易確保操作的原子性
        await ChatTheme.sequelize.transaction(async (t) => {
            // 刪除主題
            await theme.destroy({ transaction: t });

            // 如果刪除的是當前使用的主題，切換到 dark 主題
            if (currentThemeSetting?.value === themeName) {
                await Settings.update(
                    { value: "dark" },
                    {
                        where: { key: "system_client_theme_default" },
                        transaction: t,
                    }
                );
            }
        });

        rsmodel.code = 0;
        rsmodel.message = currentThemeSetting?.value === themeName ? "主題刪除成功，已切換至預設主題" : "主題刪除成功";

        // 如果是當前主題，在回應中加入標記
        if (currentThemeSetting?.value === themeName) {
            rsmodel.data = {
                themeChanged: true,
                newTheme: "dark",
            };
        }
    } catch (error) {
        console.error("刪除主題失敗:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 批量更新主題
exports.updateThemes = async function (req, res) {
    logRouteDetails("systemController.updateThemes", req);
    let rsmodel = new responseModel();
    try {
        const updates = JSON.parse(req.body);
        console.info("systemController.updateThemes:", JSON.parse(req.body));

        await ChatTheme.sequelize.transaction(async (t) => {
            for (const update of updates) {
                const { originalName, newName, remark } = update;

                // 檢查主題是否存在
                const theme = await ChatTheme.findOne({
                    where: { name: originalName },
                    transaction: t,
                });

                if (!theme) {
                    throw new Error(`主題 ${originalName} 不存在`);
                }

                if (theme.is_system) {
                    continue; // 跳過系統主題的更新
                }

                // 如果要更改名稱，檢查新名稱是否已存在
                if (originalName !== newName) {
                    const existingTheme = await ChatTheme.findOne({
                        where: { name: newName },
                        transaction: t,
                    });

                    if (existingTheme) {
                        throw new Error(`主題名稱 ${newName} 已存在`);
                    }
                }

                // 使用 ORM 的 update 方法更新主題
                await theme.update(
                    {
                        name: newName,
                        remark: remark,
                        update_time: new Date(),
                    },
                    {
                        transaction: t,
                    }
                );
            }
        });

        rsmodel.code = 0;
        rsmodel.message = "主題更新成功";
    } catch (error) {
        console.error("更新主題失敗:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

/* 使用者權限設置 - 更新權限設置表 */
exports.updatePermissionSetting = async function (req, res) {
    logRouteDetails("systemController.updatePermissionSetting", req);
    let rsmodel = new responseModel();
    try {
        const data = JSON.parse(atob(JSON.parse(req.body)));
        console.info("systemController.updatePermissionSetting:", data);
        if (!data.type || !data.newValue) {
            throw new Error(`Can't accept empty data : type = ${data.type}; newValue = ${data.newValue}`);
        }

        const setting = await Settings.findOne({
            where: { key: "knowledge_permission" },
            attributes: ["key", "value"],
        });
        if (!setting || !setting.value) {
            throw new Error("Can't find key = knowledge_permission in settings.");
        }

        const knowledgePermission = JSON.parse(setting.value);

        if (knowledgePermission[data.type]) {
            knowledgePermission[data.type] = data.newValue;
            setting.value = JSON.stringify(knowledgePermission);
        } else {
            throw new Error(`It can't set type which is not exist in current setting data. type = ${data.type}.`);
        }

        await setting.save({ fields: ["value"] });
        rsmodel.code = 0;
        rsmodel.message = "權限更新成功";
    } catch (error) {
        console.error("Update permission-setting go wrong.", error);
        rsmodel.code = 1;
        rsmodel.message = "權限更新時發生問題。";
    }
    res.json(rsmodel);
};

// 模擬 AI 生成主題
exports.generateTheme = async function (req, res) {
    logRouteDetails("systemController.generateTheme", req);
    let rsmodel = new responseModel();
    try {
        const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;
        const { prompt } = JSON.parse(req.body);
        console.info("systemController.generateTheme:", JSON.parse(req.body));

        const response = await generateTheme(prompt, pythonAPIHost, ava_token);
        if (response.data.code === 200) {
            const aiGenTheme = JSON.parse(response.data.data);

            console.log(aiGenTheme);
            rsmodel.code = 0;
            rsmodel.data = aiGenTheme;
            rsmodel.message = "主題生成成功";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "主題生成失敗";
        }
    } catch (error) {
        console.error("生成主題失敗:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

/* 使用者權限設置頁面 - 批量設定使用者權限*/
exports.setMultiUsersPermission = async function (req, res) {
    logRouteDetails("systemController.setMultiUsersPermission", req);
    let rsmodel = new responseModel();
    try {
        // 檢查request資料
        const data = JSON.parse(atob(JSON.parse(req.body)));
        console.info("systemController.setMultiUsersPermission:", data);

        if (!data.users || !data.settingTargets) {
            throw new Error(`Can't accept empty data where users = ${data.users}, settings = ${data.settingTargets}`);
        }

        // 取出權限設定
        const setting = await Settings.findOne({
            where: { key: "knowledge_permission" },
            attributes: ["key", "value"],
        });
        if (!setting) {
            throw new Error("Can't find key = knowledge_permission in settings.");
        }
        const knowledgePermission = JSON.parse(setting.value);

        // 遍歷現有的 permission 設定內容，進行比對與設定。
        Object.entries(knowledgePermission).forEach(([mainName, targets]) => {
            // 說明 : targets 為大項內的次項設定，是物件。例如:pagePermissions 的值。

            // 先將原有的次項跟新設定的次項合併在一起，再針對每一個次項進行檢查。
            const targetKeys = Object.keys(targets);
            const setTargetKeys = data.settingTargets[mainName];
            const combinedTargetKeys = [...new Set([...targetKeys, ...setTargetKeys])];

            combinedTargetKeys.forEach((targetName) => {
                // 檢查【現有】設定中，是否有此target
                const hasTarget = targetKeys.includes(targetName);
                if (!hasTarget) {
                    // 如果現有設定中，沒有此target，那就要新增此target(例如新增一個專家/知識庫/技能的權限設定)。
                    knowledgePermission[mainName][targetName] = [];
                }

                // 檢查【新】設定中是否有設定此target
                const hasSetting = data.settingTargets[mainName].includes(targetName);
                if (hasSetting) {
                    // 如果有設定值，那就要將users添加進這個target中。
                    const mergeArr = [...new Set([...knowledgePermission[mainName][targetName], ...data.users])];
                    knowledgePermission[mainName][targetName] = mergeArr;
                } else {
                    // 如果沒有設定，那就要將這些users從此target中移除。
                    const filteredArr = knowledgePermission[mainName][targetName].filter(
                        (authID) => !data.users.includes(authID)
                    );
                    knowledgePermission[mainName][targetName] = filteredArr;
                }
            });
        });

        // 最後將新設定好的permission轉成字串格式並儲存
        setting.value = JSON.stringify(knowledgePermission);
        await setting.save({ fields: ["value"] });

        rsmodel.code = 0;
        rsmodel.message = "批量修改成功";
    } catch (error) {
        console.error("Multi update permission-setting go wrong.", error);
        rsmodel.code = 1;
        rsmodel.message = "批量修改時發生問題。";
    }
    res.json(rsmodel);
};

/* LINE BOT 設置 - 取得專家清單以及設定值 */
exports.getExpertsAndSetting = async function (req, res) {
    logRouteDetails("systemController.getExpertsAndSetting", req);
    let rsmodel = new responseModel();
    try {
        const experts = await Expert.findAll({
            attributes: ["id", "name", "avatar"],
            where: {
                is_enable: 1,
            },
        });

        const selectedExpert = await Settings.findOne({
            attributes: ["value"],
            where: {
                key: "line_select_expert",
            },
        });

        const lineSettings = await Settings.findOne({
            attributes: ["value"],
            where: {
                key: "line_settings",
            },
        });

        const responseData = {
            experts: experts,
            selectedExpert: selectedExpert.value,
            lineSettings: lineSettings.value,
        };
        rsmodel.code = 0;
        rsmodel.data = responseData;
    } catch (error) {
        console.error("Getting line-expert-setting go wrong.", error);
        rsmodel.code = 1;
        rsmodel.message = "取得LINE專家資料時發生問題。";
    }
    res.json(rsmodel);
};

/* LINE BOT 設置 - 變更綁定專家 */
exports.setLineExpert = async function (req, res) {
    logRouteDetails("systemController.setLineExpert", req);
    let rsmodel = new responseModel();
    try {
        const expertID = JSON.parse(req.body).expertID;
        console.info("systemController.setLineExpert:", JSON.parse(req.body));

        await Settings.update({ value: expertID }, { where: { key: "line_select_expert" } });
        rsmodel.code = 0;
        rsmodel.message = "變更成功。";
    } catch (error) {
        console.error("Changing LINE expert go wrong.", error);
        rsmodel.code = 1;
        rsmodel.message = "變更失敗。";
    }
    res.json(rsmodel);
};
/* LINE BOT 設置 - 更新設定 */
exports.updateLineSetting = async function (req, res) {
    logRouteDetails("systemController.updateLineSetting", req);
    let rsmodel = new responseModel();
    try {
        // 檢查request資料
        const checkedData = JSON.parse(req.body);
        for (const key in checkedData) {
            if (checkedData[key] === "" || checkedData[key] === null || checkedData[key] === undefined) {
                throw new Error(`Can't accept empty data for key: ${key}`);
            }
        }
        // 取值並更新
        const lineSettings = await Settings.findOne({ where: { key: "line_settings" } });
        if (!lineSettings) {
            throw new Error("找不到line_settings的設定值");
        }
        const currentSettings = JSON.parse(lineSettings.value);
        for (const key in checkedData) {
            currentSettings[key] = checkedData[key];
        }
        lineSettings.value = JSON.stringify(currentSettings);
        await lineSettings.save();

        rsmodel.code = 0;
        rsmodel.message = "更新成功。";
        console.info("systemController.updateLineSetting:", checkedData);
    } catch (error) {
        console.error("Updating line-setting go wrong.", error);
        rsmodel.code = 1;
        rsmodel.message = `更新失敗：${error.message}`;
    }
    res.json(rsmodel);
};

exports.getBanIpList = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        // 使用 ORM 語法從 ban_ip 表中提取所有封鎖的 IP 資料
        let banIpList = await BanIp.findAll({
            order: [["expired_time", "ASC"]],
        });

        const now = new Date();

        // 過濾出已過期的記錄
        const expiredRecords = banIpList.filter((record) => record.expired_time && record.expired_time <= now);

        // 刪除已過期的記錄
        for (const record of expiredRecords) {
            await BanIp.destroy({ where: { id: record.id } });
        }

        // 更新 banIpList，排除已過期的記錄
        banIpList = banIpList.filter((record) => !record.expired_time || record.expired_time > now);

        rsmodel.code = 0;
        rsmodel.data = banIpList;
        rsmodel.message = "Successfully returned ban list";
    } catch (error) {
        console.error("Error fetching banned IP list:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.deleteBanIpListItem = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { ip, device, status, type, expired_time, operator } = JSON.parse(req.body);

        // 新增變數來處理 type 包含 login_attempts 的情況
        const actionType = type.includes("login_attempts") ? "artificial_login_attempts" : "artificial";

        // 刪除 ban_ip 表中的 IP 記錄
        const result = await BanIp.destroy({ where: { ip } });

        if (result > 0) {
            // 在 ban_ip_history 表中新增記錄
            await BanIpHistory.create({
                ip,
                device,
                status,
                type: actionType,
                expired_time,
                operator,
                action: "delete", // 記錄操作類型
            });

            // const ipKey = type.includes("login_attempts") ? `login_attempts:${ip}` : `access_control:ip:${ip}`;
            // const triggeredKey = type.includes("login_attempts") ? `login_attempts:triggered:${ip}` : `access_control:triggered:${ip}`;
            // redisClient.del(ipKey);
            // redisClient.del(triggeredKey);

            const ipKey = `access_control:ip:${ip}`;
            const triggeredKey = `access_control:triggered:${ip}`;

            if (type.includes("login_attempts")) {
                const loginAttemptsKey = `login_attempts:${ip}`;
                const loginAttemptsTriggeredKey = `login_attempts:triggered:${ip}`;
                redisClient.del(loginAttemptsKey);
                redisClient.del(loginAttemptsTriggeredKey);
            }

            redisClient.del(ipKey);
            redisClient.del(triggeredKey);

            rsmodel.code = 0;
            rsmodel.message = "Successfully deleted ban list item";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "IP not found in ban list";
        }
    } catch (error) {
        console.error("Error deleting ban list item:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.createBanIpListItem = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { ip, expired_time, operator } = JSON.parse(req.body);

        const isValidDate = expired_time && !isNaN(Date.parse(expired_time));
        const finalStatus = isValidDate ? "temporary" : "forever";
        const formattedExpiredTime = isValidDate ? new Date(expired_time).toISOString() : null;

        // 檢查是否已存在該 IP
        const existingIp = await BanIp.findOne({ where: { ip } });
        if (existingIp) {
            const isDuplicate = true;
            rsmodel.code = 1;
            rsmodel.message = "重複IP錯誤：該IP已存在於封鎖列表中。";
            rsmodel.data = { isDuplicate };
            return res.json(rsmodel);
        }

        // 新增 ban_ip 表中的 IP 記錄
        const newBanIp = await BanIp.create({
            ip,
            status: finalStatus,
            type: "artificial",
            expired_time: formattedExpiredTime,
            operator,
        });

        // 在 ban_ip_history 表中新增記錄
        await BanIpHistory.create({
            ip,
            status: finalStatus,
            type: "artificial",
            expired_time: formattedExpiredTime,
            operator,
            action: "create", // 記錄操作類型
        });

        if (newBanIp) {
            const ipKey = `access_control:ip:${ip}`;
            const triggeredKey = `access_control:triggered:${ip}`;

            // 新增 Redis 中的相關鍵值
            await redisClient.set(ipKey, "100000000000000");
            await redisClient.set(triggeredKey, "triggered");
            if (isValidDate) {
                const expireSeconds = Math.floor((new Date(expired_time).getTime() - new Date().getTime()) / 1000);
                redisClient.expire(ipKey, expireSeconds);
                redisClient.expire(triggeredKey, expireSeconds);
            }

            rsmodel.code = 0;
            rsmodel.message = "Successfully added ban list item";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Failed to add IP to ban list";
        }
    } catch (error) {
        console.error("Error adding ban list item:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.updateBanIpListItem = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { id, ip, device, type, expired_time, operator } = JSON.parse(req.body);
        const actionType = type.includes("login_attempts") ? "artificial_login_attempts" : "artificial";

        // 先用 id 找出對應的 IP
        const existingRecord = await BanIp.findOne({ where: { id } });
        if (!existingRecord) {
            rsmodel.code = 1;
            rsmodel.message = "IP not found in ban list";
            return res.json(rsmodel);
        }

        // 確認資料庫中的 IP 和傳入的 IP 是否相同
        if (existingRecord.ip !== ip) {
            // 如果不同，檢查傳入的 IP 是否已存在於資料庫中
            const duplicateIp = await BanIp.findOne({ where: { ip } });
            const isDuplicate = true;
            if (duplicateIp) {
                rsmodel.code = 1;
                rsmodel.message = "IP already exists in ban list";
                rsmodel.data = { isDuplicate };
                return res.json(rsmodel);
            }
        }

        // 刪除 Redis 中的相關鍵值
        const oldIp = existingRecord.ip;
        const oldIpKey = `access_control:ip:${oldIp}`;
        const oldTriggeredKey = `access_control:triggered:${oldIp}`;
        const oldLoginAttemptsKey = `login_attempts:${oldIp}`;
        const oldLoginAttemptsTriggeredKey = `login_attempts:triggered:${oldIp}`;

        if (type.includes("login_attempts")) {
            redisClient.del(oldLoginAttemptsKey);
            redisClient.del(oldLoginAttemptsTriggeredKey);
        }

        redisClient.del(oldIpKey);
        redisClient.del(oldTriggeredKey);

        const isValidDate = expired_time && !isNaN(Date.parse(expired_time));
        const finalStatus = isValidDate ? "temporary" : "forever";
        const formattedExpiredTime = isValidDate ? new Date(expired_time).toISOString() : null;

        // 使用特定欄位進行更新
        const result = await BanIp.update(
            {
                ip,
                status: finalStatus,
                type: actionType,
                expired_time: formattedExpiredTime,
                operator,
            },
            {
                where: { id },
                fields: ["ip", "status", "type", "expired_time", "operator"], // 指定要更新的欄位
            }
        );

        if (result[0] > 0) {
            // 在 ban_ip_history 表中新增記錄
            await BanIpHistory.create({
                ip,
                device,
                status: finalStatus,
                type: actionType,
                expired_time: formattedExpiredTime,
                operator,
                action: "update", // 記錄操作類型
            });

            const newIpKey = `access_control:ip:${ip}`;
            const newTriggeredKey = `access_control:triggered:${ip}`;
            const newLoginAttemptsKey = `login_attempts:${ip}`;
            const newLoginAttemptsTriggeredKey = `login_attempts:triggered:${ip}`;

            if (type.includes("login_attempts")) {
                redisClient.set(newLoginAttemptsKey, "100000000000000");
                redisClient.set(newLoginAttemptsTriggeredKey, "triggered");
            }
            // 更新 Redis 中的相關鍵值
            await redisClient.set(newIpKey, "100000000000000");
            await redisClient.set(newTriggeredKey, "triggered");
            if (isValidDate) {
                const expireSeconds = Math.floor((new Date(expired_time).getTime() - new Date().getTime()) / 1000);
                redisClient.expire(newIpKey, expireSeconds);
                redisClient.expire(newTriggeredKey, expireSeconds);
                redisClient.expire(newLoginAttemptsKey, expireSeconds);
                redisClient.expire(newLoginAttemptsTriggeredKey, expireSeconds);
            }

            rsmodel.code = 0;
            rsmodel.message = "Successfully updated ban list item";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "IP not found in ban list";
        }
    } catch (error) {
        console.error("Error updating ban list item:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.updateBanRuleSettings = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { session_limit, ban_ip_expire_date } = JSON.parse(req.body);
        session_limit = Number(session_limit);
        await sequelize.transaction(async (transaction) => {
            await Settings.update(
                { value: session_limit },
                { where: { key: "create_session_limit" }, fields: ["value"], transaction }
            );

            await Settings.update(
                { value: ban_ip_expire_date },
                { where: { key: "ban_ip_expire_date" }, fields: ["value"], transaction }
            );
        });
        await redisClient.set("access_control:max_access_count", session_limit);
        await redisClient.set("access_control:ban_ip_expire_date", ban_ip_expire_date);
        rsmodel.code = 0;
        rsmodel.message = "Successfully updated session limit";
    } catch (error) {
        console.error("Error updating session limit:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 獲取公告列表
exports.getAnnouncements = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const announcements = await Announcement.findAll({
            order: [["create_time", "DESC"]],
        });

        rsmodel.code = 0;
        rsmodel.data = announcements;
        rsmodel.message = "Successfully fetched announcements";
    } catch (error) {
        console.error("Error fetching announcements:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 創建新公告
exports.createAnnouncement = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        const announcementData = {
            ...JSON.parse(req.body),
            created_by: req.session.userInfo.user_no,
            updated_by: req.session.userInfo.user_no,
        };

        const announcement = await Announcement.create(announcementData);

        rsmodel.code = 0;
        rsmodel.data = announcement;
        rsmodel.message = "Successfully created announcement";
    } catch (error) {
        console.error("Error creating announcement:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 更新公告
exports.updateAnnouncement = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { id } = req.params;
        const updateData = {
            ...JSON.parse(req.body),
            updated_by: req.session.userInfo.uid,
            update_time: new Date(),
        };

        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            throw new Error("Announcement not found");
        }

        await announcement.update(updateData);

        rsmodel.code = 0;
        rsmodel.data = announcement;
        rsmodel.message = "Successfully updated announcement";
    } catch (error) {
        console.error("Error updating announcement:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 刪除公告
exports.deleteAnnouncement = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { id } = req.params;

        await UserAcknowledgement.destroy({ where: { announcement_id: id } });

        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            throw new Error("Announcement not found");
        }

        await announcement.destroy();

        rsmodel.code = 0;
        rsmodel.message = "Successfully deleted announcement";
    } catch (error) {
        console.error("Error deleting announcement:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 獲取單個公告詳情
exports.getAnnouncementById = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { id } = req.params;

        const announcement = await Announcement.findByPk(id);
        if (!announcement) {
            throw new Error("Announcement not found");
        }

        rsmodel.code = 0;
        rsmodel.data = announcement;
        rsmodel.message = "Successfully fetched announcement";
    } catch (error) {
        console.error("Error fetching announcement:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 取得使用說明確認紀錄
exports.getAnnouncementCheckRecord = async function (req, res) {
    logRouteDetails("systemController.getAnnouncementCheckRecord", req);
    let rsmodel = new responseModel();
    try {
        let { page, itemsPerPage, searchQuery, announcementType } = req.query;
        if (!announcementType) {
            announcementType = [];
        }
        const params = [page, itemsPerPage, searchQuery, announcementType];
        const { rows } = await sql.query(
            `
            WITH filtered AS (
            SELECT 
                ua.announcement_id AS "announcementId", 
                ua.uid AS "userId",
                ua.action,
                ua.ip_address AS "ipAddress",
                ua.user_agent AS "userAgent",
                ua.create_time AS "createTime",
                a.title AS "announcementTitle",
                a.content AS "announcementContent",
                a.require_agreement AS "requireAgreement",
                a.status AS "announcementStatus",
                a.use_markdown AS "useMarkdown",
                a.type AS "announcementType",
                u.name AS "userName",
                u.user_type_id AS "userTypeId"
            FROM 
                user_acknowledgments ua 
            LEFT JOIN 
                announcements a ON ua.announcement_id = a.id 
            LEFT JOIN 
                users u ON ua.uid = u.id
            WHERE 
                u.user_type_id = 2
                AND a.type = ANY($4)
                AND (LOWER(u.name) LIKE LOWER('%' || $3 || '%') 
                OR LOWER(a.title) LIKE LOWER('%' || $3 || '%'))
            )
            SELECT json_build_object(
                'dataList', (
                    SELECT json_agg(row)
                    FROM (
                        SELECT *
                        FROM filtered
                        ORDER BY "createTime" DESC
                        LIMIT $2 OFFSET (($1 - 1) * $2)
                    ) row
                ),
                'totalRecord', (SELECT count(*) FROM filtered)
            ) AS result;
            `,
            params
        );

        let responseData = {
            dataList: [],
            totalRecord: 0,
        };
        if (rows && rows[0] && rows[0].result) {
            responseData.dataList = rows[0].result.dataList || [];
            responseData.totalRecord = rows[0].result.totalRecord || 0;
        }

        rsmodel.code = 0;
        rsmodel.data = responseData;
        rsmodel.message = "Successfully fetched announcement_check_record";
    } catch (error) {
        console.error("Error fetching announcement_check_record:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getRateLimitStatus = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        // 從 Redis 獲取當前的限流規則
        const rulesString = await redisClient.get("rateLimitRules");
        if (!rulesString) {
            rsmodel.code = 404;
            rsmodel.message = "未找到限流規則";
            return res.status(404).json(rsmodel);
        }

        const rules = JSON.parse(rulesString);

        // 準備狀態對象
        const status = {
            systemWide: {},
            users: {},
            allExperts: {},
            expertSpecific: {},
        };

        // 獲取系統範圍限制狀態
        status.systemWide = await getSystemStatus(rules.systemWide);
        status.allExperts = await getExpertsStatus(rules.allExperts);

        // 獲取所有限流相關的鍵
        const keys = await redisClient.keys("rateLimit:*");

        // 收集所有使用者 ID
        const userIds = keys.filter((key) => key.startsWith("rateLimit:user:")).map((key) => key.split(":")[2]);

        // 收集所有專家 ID
        const expertIds = keys.filter((key) => key.startsWith("rateLimit:expert:")).map((key) => key.split(":")[2]);

        // 分別查詢使用者訊息和登入類型
        const users = await Users.findAll({
            where: {
                id: userIds,
            },
            attributes: ["id", "name"],
        });

        const experts = await Expert.findAll({
            where: {
                id: expertIds,
            },
            attributes: ["id", "name"],
        });

        const userLoginTypes = await UserLoginType.findAll({
            where: {
                user_id: userIds,
            },
            attributes: ["user_id", "auth_id"],
        });

        // 建立使用者登入類型 mapping
        const authIdMap = new Map(userLoginTypes.map((login) => [login.user_id.toString(), login.auth_id]));

        // 建立使用者訊息 mapping
        const userMap = new Map(
            users.map((user) => [
                user.id.toString(),
                {
                    name: user.name,
                    authId: authIdMap.get(user.id.toString()),
                },
            ])
        );

        const expertMap = new Map(
            experts.map((expert) => [
                expert.id.toString(),
                {
                    name: expert.name,
                },
            ])
        );

        // 處理使用者限流數據
        for (const key of keys) {
            const count = await redisClient.get(key);
            const ttl = await redisClient.pTTL(key);

            if (key.startsWith("rateLimit:user:")) {
                const userId = key.split(":")[2];
                const userInfo = userMap.get(userId);
                if (userInfo) {
                    status.users[userId] = {
                        id: userId,
                        name: userInfo.name,
                        authId: userInfo.authId,
                        currentCount: parseInt(count),
                        remainingTime: ttl,
                        limit: rules.users.maxRequests,
                        windowMs: rules.users.windowMs,
                        isLimited: parseInt(count) >= rules.users.maxRequests,
                        remainingRequests: Math.max(0, rules.users.maxRequests - parseInt(count)),
                    };
                }
            }
            // 處理專家限制
            else if (key.startsWith("rateLimit:expert:")) {
                const expertId = key.split(":")[2];
                const expertRule = rules.expertSpecific[expertId];
                if (expertRule) {
                    status.expertSpecific[expertId] = {
                        id: expertId,
                        name: expertMap.get(expertId).name,
                        currentCount: parseInt(count),
                        remainingTime: ttl,
                        limit: expertRule.maxRequests,
                        windowMs: expertRule.windowMs,
                        isLimited: parseInt(count) >= expertRule.maxRequests,
                        remainingRequests: Math.max(0, expertRule.maxRequests - parseInt(count)),
                    };
                }
            }
        }

        rsmodel.code = 0;
        rsmodel.data = status;
        rsmodel.message = "Successfully fetched rate limit status";
    } catch (error) {
        console.error("獲取限流狀態時出錯:", error);
        rsmodel.code = 500;
        rsmodel.message = "Error fetching rate limit status";
        rsmodel.error = error.message;
        return res.status(500).json(rsmodel);
    }

    res.json(rsmodel);
};

// 獲取 API Keys 列表
exports.getAPIKeys = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        // 檢查是否有特定的 MODE 參數
        const simpleMode = req.query.MODE === "simple" || req.body.MODE === "simple";

        // 根據 MODE 參數決定需要哪些屬性
        const attributes = simpleMode
            ? [
                  ["key", "id"],
                  ["key", "name"],
              ]
            : [
                  ["id", "api_key_id"],
                  "user_id",
                  "key",
                  "description",
                  "status",
                  "create_time",
                  [
                      sequelize.literal(`(
                        SELECT COUNT(*)
                        FROM api_key_usage
                        WHERE api_key_usage.api_key_id = "ApiKeys".id
                    )`),
                      "usage_count",
                  ],
                  [
                      sequelize.literal(`(
                        SELECT COALESCE(SUM(price), 0)
                        FROM model_token_log
                        WHERE model_token_log.users_id = "ApiKeys".key
                    )`),
                      "total_price",
                  ],
              ];

        // 根據 MODE 參數決定是否需要關聯表
        const includeOptions = simpleMode
            ? []
            : [
                  {
                      model: Users,
                      attributes: [["id", "user_id"], "name"],
                      where: {
                          user_type_id: 3,
                      },
                  },
                  {
                      model: ApiKeyDomains,
                      attributes: [["id", "domain_id"], "domain", "status", "create_time"],
                  },
                  {
                      model: ApiKeyScopes,
                      attributes: [["id", "scope_id"], "path", "status", "create_time"],
                  },
              ];

        const apiKeys = await ApiKeys.findAll({
            include: includeOptions,
            attributes: attributes,
        });

        rsmodel.code = 0;
        rsmodel.data = apiKeys;
    } catch (error) {
        console.error("Error fetching API keys:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 創建 API Key
exports.createAPIKey = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { userId, domains = [], paths = [], description } = JSON.parse(req.body);
        // 確認使用者存在
        const user = await Users.findByPk(userId);
        if (!user) {
            throw new Error("User not found");
        }

        const webAPIUserId = uuidv4();

        // 在 users 表 建立一個 user_type_id 3 的資料 表示是 API Key 使用者
        await Users.create({
            id: webAPIUserId,
            user_type_id: 3,
            name: user.name,
        });

        const apiKey = await sequelize.transaction(async (t) => {
            // 創建 API Key
            const key = await ApiKeys.create(
                {
                    user_id: webAPIUserId,
                    key: generateApiKey(),
                    status: 1,
                    description,
                },
                { transaction: t }
            );

            // 創建網域記錄
            if (domains.length > 0) {
                await ApiKeyDomains.bulkCreate(
                    domains.map((domain) => ({
                        api_key_id: key.id,
                        domain,
                        status: 1,
                    })),
                    { transaction: t }
                );
            } else {
                await ApiKeyDomains.create(
                    {
                        api_key_id: key.id,
                        domain: "*",
                        status: 1,
                    },
                    { transaction: t }
                );
            }

            if (paths.length > 0) {
                await ApiKeyScopes.bulkCreate(
                    paths.map((path) => ({
                        api_key_id: key.id,
                        path,
                        status: 1,
                    })),
                    { transaction: t }
                );
            } else {
                await ApiKeyScopes.create(
                    {
                        api_key_id: key.id,
                        path: "*",
                        status: 1,
                    },
                    { transaction: t }
                );
            }

            return key;
        });

        rsmodel.code = 0;
        rsmodel.data = apiKey;
    } catch (error) {
        console.error("Error creating API key:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 更新域名
exports.updateDomains = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { keyId, domain } = JSON.parse(req.body);

        const apiKey = await ApiKeys.findByPk(keyId);
        if (!apiKey) {
            throw new Error("API Key not found");
        }

        // 檢查 domain 是否已經存在
        const existingDomain = await ApiKeyDomains.findOne({
            where: { api_key_id: keyId, domain },
        });

        if (existingDomain) {
            throw new Error("Domain already exists");
        }

        await ApiKeyDomains.create({
            api_key_id: keyId,
            domain,
            status: 1,
        });

        rsmodel.code = 0;
        rsmodel.message = "Domains updated successfully";
    } catch (error) {
        console.error("Error updating domains:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 更新路徑
exports.updatePaths = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { keyId, path } = JSON.parse(req.body);

        const apiKey = await ApiKeys.findByPk(keyId);
        if (!apiKey) {
            throw new Error("API Key not found");
        }

        // 檢查 domain 是否已經存在
        const existingPath = await ApiKeyScopes.findOne({
            where: { api_key_id: keyId, path },
        });

        if (existingPath) {
            throw new Error("Path already exists");
        }

        await ApiKeyScopes.create({
            api_key_id: keyId,
            path,
            status: 1,
        });

        rsmodel.code = 0;
        rsmodel.message = "Paths updated successfully";
    } catch (error) {
        console.error("Error updating paths:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 更新一般設定
exports.updateCommonSettings = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { keyId, description } = JSON.parse(req.body);
        const apiKey = await ApiKeys.findByPk(keyId);
        if (!apiKey) {
            throw new Error("API Key not found");
        }
        await apiKey.update({ description });
        rsmodel.code = 0;
        rsmodel.message = "Common settings updated successfully";
    } catch (error) {
        console.error("Error updating common settings:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 切換 domain 狀態
exports.toggleDomainStatus = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { domainId, status } = JSON.parse(req.body);

        const domain = await ApiKeyDomains.findByPk(domainId);
        if (!domain) {
            throw new Error("Domain not found");
        }

        await domain.update({
            status: status === 0 ? 1 : 0,
        });

        rsmodel.code = 0;
        rsmodel.message = "Domain status updated successfully";
    } catch (error) {
        console.error("Error toggling domain status:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 切換 path 狀態
exports.togglePathStatus = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { pathId, status } = JSON.parse(req.body);

        const path = await ApiKeyScopes.findByPk(pathId);
        if (!path) {
            throw new Error("Path not found");
        }

        await path.update({
            status: status === 0 ? 1 : 0,
        });

        rsmodel.code = 0;
        rsmodel.message = "Path status updated successfully";
    } catch (error) {
        console.error("Error toggling path status:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 切換 API Key 狀態
exports.toggleAPIKeyStatus = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { apiKeyId, status } = JSON.parse(req.body);

        const apiKey = await ApiKeys.findByPk(apiKeyId);
        if (!apiKey) {
            throw new Error("API Key not found");
        }

        await apiKey.update({
            status: status === 0 ? 1 : 0,
        });

        rsmodel.code = 0;
        rsmodel.data = apiKey;
    } catch (error) {
        console.error("Error toggling API key status:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 刪除 API Key
exports.deleteAPIKey = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { apiKeyId } = JSON.parse(req.body);

        const result = await sequelize.transaction(async (t) => {
            // 先刪除相關的域名
            await ApiKeyDomains.destroy({
                where: { api_key_id: apiKeyId },
                transaction: t,
            });

            // 先刪除相關的 API Key Scopes
            await ApiKeyScopes.destroy({
                where: { api_key_id: apiKeyId },
                transaction: t,
            });

            // 再刪除 API Key Mapping
            await ApiKeyMapping.destroy({
                where: { api_key_id: apiKeyId },
                transaction: t,
            });

            // 再刪除 API Key
            const deleted = await ApiKeys.destroy({
                where: { id: apiKeyId },
                transaction: t,
            });

            return deleted;
        });

        if (!result) {
            throw new Error("API Key not found");
        }

        rsmodel.code = 0;
        rsmodel.message = "API Key deleted successfully";
    } catch (error) {
        console.error("Error deleting API key:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 刪除 domain
exports.deleteDomain = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { domainId } = JSON.parse(req.body);
        await ApiKeyDomains.destroy({ where: { id: domainId } });
        rsmodel.code = 0;
        rsmodel.message = "Domain deleted successfully";
    } catch (error) {
        console.error("Error deleting domain:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 刪除 path
exports.deletePath = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { pathId } = JSON.parse(req.body);
        await ApiKeyScopes.destroy({ where: { id: pathId } });
        rsmodel.code = 0;
        rsmodel.message = "Path deleted successfully";
    } catch (error) {
        console.error("Error deleting path:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getChangelog = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const changelogPath = path.join(__dirname, "../../changelog.md");
        const content = await fs.readFile(changelogPath, "utf-8");
        rsmodel.code = 0;
        rsmodel.data = content;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = "Error reading changelog";
    }
    res.json(rsmodel);
};

// 上傳版本更新記錄
exports.uploadChangelog = async function (req, res) {
    let rsmodel = new responseModel();
    res.json(rsmodel);
};

exports.downloadChangelog = async function (req, res) {
    try {
        const changelogPath = path.join(__dirname, "../../changelog.md");
        const file = await fs.readFile(changelogPath);

        // 設定回應標頭
        res.setHeader("Content-Type", "text/markdown");
        res.setHeader("Content-Disposition", "attachment; filename=changelog.md");

        // 發送檔案
        res.send(file);
    } catch (error) {
        res.status(500).json({ error: "Error downloading changelog" });
    }
};

exports.getKHUsers = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        // 查詢 user_login_type，找出 user_info_json 內部有 dept_uuid 的資料
        const users = await UserLoginType.findAll({
            attributes: ["auth_id", "user_info_json"],
            where: {
                user_info_json: {
                    [Op.and]: [
                        { dept_uuid: { [Op.ne]: null } }, // 確保 dept_uuid 存在
                        { dept_uuid: { [Op.not]: "" } }, // 避免空值
                    ],
                },
            },
        });

        // 格式化回傳資料
        rsmodel.data = users.map((user) => ({
            auth_id: user.auth_id,
            name: user.user_info_json.name || "未知姓名",
            dept_uuid: user.user_info_json.dept_uuid,
        }));

        res.json(rsmodel);
    } catch (error) {
        console.error("Error fetching KH Users:", error);
        rsmodel.success = false;
        rsmodel.message = "查詢失敗";
        res.status(500).json(rsmodel);
    }
};

exports.exportDepartmentUsers = async function (req, res) {
    const { selectedUsers } = JSON.parse(req.body);
    let PRIVILEGED_APP_SSO_TOKEN = "";

    const KCG_SSO_BASE_URL = process.env.BACK_KCG_SSO_BASE_URL || "https://accounts-api.kcg.gov.tw";
    const APP_PRIVATE_ID = process.env.BACK_KCG_APP_PRIVATE_ID;
    const APP_PRIVATE_PASSWD = process.env.BACK_KCG_APP_PRIVATE_PASSWD;

    try {
        // 1️. 取得 SSO 授權 Token
        const response = await axios.post(`${KCG_SSO_BASE_URL}/app/request_basic_authentication/`, {
            APP_PRIVATE_ID,
            APP_PRIVATE_PASSWD,
        });

        if (response.data.ERROR_CODE === "0") {
            PRIVILEGED_APP_SSO_TOKEN = response.data.PRIVILEGED_APP_SSO_TOKEN;
        } else {
            throw new Error("Failed to get application tokens");
        }

        // 2️. 去重複 `dept_uuid`
        const uniqueDeptUuids = [...new Set(selectedUsers.map((user) => user.dept_uuid))];

        // 3️. 取得部門資訊
        const deptNodeResponse = await axios.post(`${KCG_SSO_BASE_URL}/org_tree/get_dept_nodes/`, {
            PRIVILEGED_APP_SSO_TOKEN,
            APP_COMPANY_UUID: "c27a729e-925b-485c-a3de-8cee50ceea5b",
            APP_DEPT_NODE_UUID_LIST: uniqueDeptUuids,
            APP_DEPT_BASIC_PROFILE: {
                APP_DEPT_NODE_UUID: "",
                APP_DEPT_PNODE_UUID: "",
                APP_DEPT_LEVEL_NO: "",
                APP_DEPT_FULL_PATH: "",
                APP_DEPT_NAME: "",
                APP_DEPT_DESC: "",
                APP_DEPT_CODE_NO: "",
                APP_DEPT_STATUS: "",
                APP_DEPT_NODE_TYPE: "",
            },
        });

        if (deptNodeResponse.data.ERROR_CODE !== 0) {
            throw new Error(`Failed to fetch department nodes ${deptNodeResponse.data.ERROR_MESSAGE}`);
        }

        // 4️. 建立部門資訊對照表
        const deptMap = {};
        deptNodeResponse.data.APP_DEPT_BASIC_PROFILE_LIST.forEach((dept) => {
            deptMap[dept.APP_DEPT_NODE_UUID] = {
                name: dept.APP_DEPT_NAME,
                desc: dept.APP_DEPT_DESC,
                code_no: dept.APP_DEPT_CODE_NO,
                status: dept.APP_DEPT_STATUS,
                level: dept.APP_DEPT_LEVEL_NO,
                full_path: dept.APP_DEPT_FULL_PATH,
                parent_uuid: dept.APP_DEPT_PNODE_UUID,
            };
        });

        // 5️. 為每個 `selectedUser` 追加對應的部門資訊
        const processedUsers = selectedUsers.map((user) => ({
            ...user,
            department: deptMap[user.dept_uuid] || null,
        }));

        // 6️. 產生 Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("使用者列表");

        worksheet.columns = [
            { header: "姓名", key: "name", width: 20 },
            { header: "帳號 ID", key: "auth_id", width: 30 },
            { header: "部門名稱", key: "dept_name", width: 30 },
            { header: "部門代碼", key: "dept_code", width: 15 },
            { header: "部門描述", key: "dept_desc", width: 30 },
            { header: "部門層級", key: "dept_level", width: 10 },
            { header: "部門完整路徑", key: "dept_full_path", width: 40 },
        ];

        // 填充資料
        processedUsers.forEach((user) => {
            worksheet.addRow({
                name: user.name,
                auth_id: user.auth_id,
                dept_name: user.department ? user.department.name : "未知部門",
                dept_code: user.department ? user.department.code_no : "",
                dept_desc: user.department ? user.department.desc : "",
                dept_level: user.department ? user.department.level : "",
                dept_full_path: user.department ? user.department.full_path : "",
            });
        });

        // 7️. 將 Excel 檔案寫入 Buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // 8️. 設定回應標頭，讓前端可以下載 Excel
        const fileName = `department_users_${Date.now()}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

        // 9️. 直接傳輸 Buffer 讓前端下載
        res.send(buffer);
    } catch (error) {
        console.error("Error exporting department users:", error);
        res.status(500).json({ success: false, message: "匯出部門使用者失敗" });
    }
};

exports.queryVectorDB = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { user_no, user_type, login_type } = req.session.userInfo;
        if (user_no === "icsc-admin" && user_type === "member" && login_type === "system") {
            const { vector_input } = JSON.parse(req.body);
            const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
            const pythonAPIHost = process.env.PYTHON_API_HOST;
            const result = await vectorQuery(vector_input, pythonAPIHost, ava_token);

            rsmodel.code = 0;
            rsmodel.data = result.data;
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.stressTest = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { expert, concurrent, duration } = JSON.parse(req.body);
        const { user_no, user_type, login_type } = req.session.userInfo;

        if (user_no === "icsc-admin" && user_type === "member" && login_type === "system") {
            const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
            const pythonAPIHost = process.env.PYTHON_API_HOST;
            const expert_id = expert.id;

            const result = await stressTest(expert_id, concurrent, duration, pythonAPIHost, ava_token);
            rsmodel.code = 0;
            rsmodel.data = result.data;
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.vectorSearch = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { expert_id, query } = JSON.parse(req.body);
        const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;
        const result = await vectorSearch(query, expert_id, pythonAPIHost, ava_token);
        rsmodel.code = 0;
        rsmodel.data = result.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.word2vector = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { word, embedding_model } = JSON.parse(req.body);
        const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;
        const result = await word2vector(word, embedding_model, pythonAPIHost, ava_token);
        rsmodel.code = 0;
        rsmodel.data = result.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getAuditLog = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        // 獲取查詢參數
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 10;
        const searchQuery = req.query.search || "";
        const userId = req.query.userId || "";
        const actionTypeIds = req.query.actionTypeIds
            ? req.query.actionTypeIds.split(",").map((id) => parseInt(id))
            : [];
        const entityTypeIds = req.query.entityTypeIds
            ? req.query.entityTypeIds.split(",").map((id) => parseInt(id))
            : [];
        const startDate = req.query.startDate || null;
        const endDate = req.query.endDate || null;
        const sortBy = req.query.sortBy || "create_time";
        const sortDesc = req.query.sortDesc === "true";
        const targetCategory = req.query.targetCategory || "";
        const targetId = req.query.targetId || "";

        // 構建查詢條件
        const whereClause = {};

        // 搜尋使用者名稱或目標名稱
        if (searchQuery) {
            // 首先獲取匹配的目標ID
            let targetIds = [];

            // 如果有搜索關鍵字，先搜索各個表中的名稱
            if (searchQuery.trim() !== "") {
                // 搜索專家名稱
                const experts = await Expert.findAll({
                    where: {
                        name: { [Op.iLike]: `%${searchQuery}%` },
                    },
                    attributes: ["id"],
                });

                // 搜索數據集名稱
                const datasets = await Datasets.findAll({
                    where: {
                        name: { [Op.iLike]: `%${searchQuery}%` },
                    },
                    attributes: ["id"],
                });

                // 搜索技能名稱
                const skills = await Skill.findAll({
                    where: {
                        name: { [Op.iLike]: `%${searchQuery}%` },
                    },
                    attributes: ["id"],
                });

                // 搜索表單名稱
                const forms = await FormConfiguration.findAll({
                    where: {
                        form_name: { [Op.iLike]: `%${searchQuery}%` },
                    },
                    attributes: ["id"],
                });

                // 收集所有匹配的ID
                targetIds = [
                    ...experts.map((e) => e.id),
                    ...datasets.map((d) => d.id),
                    ...skills.map((s) => s.id),
                    ...forms.map((f) => f.id),
                ];
            }

            // 構建複合OR條件
            whereClause[Op.or] = [
                { username: { [Op.iLike]: `%${searchQuery}%` } },
                { target_id: targetIds.length > 0 ? { [Op.in]: targetIds } : null },
            ];

            // 如果沒有找到匹配的目標ID，則刪除null條件
            if (targetIds.length === 0) {
                whereClause[Op.or] = whereClause[Op.or].filter((condition) => !Object.values(condition).includes(null));
            }
        }

        // 操作類型過濾
        if (actionTypeIds && actionTypeIds.length > 0) {
            whereClause.action_type_id = { [Op.in]: actionTypeIds };
        }

        // 實體類型過濾
        if (entityTypeIds && entityTypeIds.length > 0) {
            whereClause.entity_type_id = { [Op.in]: entityTypeIds };
        }

        // 目標類別和ID過濾
        if (targetCategory) {
            whereClause.target_category = targetCategory;
        }

        if (targetId) {
            whereClause.target_id = targetId;
        }

        // 日期範圍過濾
        if (startDate && endDate) {
            whereClause.create_time = {
                [Op.between]: [new Date(startDate), new Date(endDate)],
            };
        } else if (startDate) {
            whereClause.create_time = { [Op.gte]: new Date(startDate) };
        } else if (endDate) {
            whereClause.create_time = { [Op.lte]: new Date(endDate) };
        }

        // 計算分頁偏移
        const offset = (page - 1) * perPage;

        // 構建排序條件
        const orderClause = [[sortBy, !sortDesc ? "DESC" : "ASC"]];

        // 查詢數據
        const { count, rows } = await AuditLog.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: AuditLogActionType,
                    as: "actionTypeInfo",
                    attributes: ["name"],
                },
                {
                    model: AuditLogEntityType,
                    as: "entityTypeInfo",
                    attributes: ["name"],
                },
            ],
            order: orderClause,
            limit: perPage,
            offset: offset,
        });

        // 收集所有目標ID和分類，用於批次查詢名稱
        const targetDetails = new Map();
        rows.forEach((log) => {
            const plainLog = log.get({ plain: true });
            if (plainLog.target_id && plainLog.target_category) {
                if (!targetDetails.has(plainLog.target_category)) {
                    targetDetails.set(plainLog.target_category, new Set());
                }
                targetDetails.get(plainLog.target_category).add(plainLog.target_id);
            }
        });

        // 使用批次查詢獲取各類目標的名稱
        const targetNames = {};

        // 處理專家名稱查詢
        if (targetDetails.has("expert") && targetDetails.get("expert").size > 0) {
            const expertIds = Array.from(targetDetails.get("expert"));
            const experts = await Expert.findAll({
                where: { id: { [Op.in]: expertIds } },
                attributes: ["id", "name"],
            });
            experts.forEach((expert) => {
                targetNames[`expert_${expert.id}`] = expert.name;
            });
        }

        // 處理數據集名稱查詢
        if (targetDetails.has("dataset") && targetDetails.get("dataset").size > 0) {
            const datasetIds = Array.from(targetDetails.get("dataset"));
            const datasets = await Datasets.findAll({
                where: { id: { [Op.in]: datasetIds } },
                attributes: ["id", "name"],
            });
            datasets.forEach((dataset) => {
                targetNames[`dataset_${dataset.id}`] = dataset.name;
            });
        }

        // 處理技能名稱查詢
        if (targetDetails.has("skill") && targetDetails.get("skill").size > 0) {
            const skillIds = Array.from(targetDetails.get("skill"));
            const skills = await Skill.findAll({
                where: { id: { [Op.in]: skillIds } },
                attributes: ["id", "name"],
            });
            skills.forEach((skill) => {
                targetNames[`skill_${skill.id}`] = skill.name;
            });
        }

        // 處理表單名稱查詢
        if (targetDetails.has("form") && targetDetails.get("form").size > 0) {
            const formIds = Array.from(targetDetails.get("form"));
            const forms = await FormConfiguration.findAll({
                where: { id: { [Op.in]: formIds } },
                attributes: ["id", "form_name"],
            });
            forms.forEach((form) => {
                targetNames[`form_${form.id}`] = form.form_name;
            });
        }

        // 格式化結果，讓前端顯示更友好
        const formattedLogs = rows.map((log) => {
            const plainLog = log.get({ plain: true });

            // 獲取目標名稱
            let targetName = null;
            if (plainLog.target_id && plainLog.target_category) {
                const key = `${plainLog.target_category}_${plainLog.target_id}`;
                targetName = targetNames[key] || null;
            }

            return {
                id: plainLog.id,
                username: plainLog.username,
                action_type: plainLog.action_type,
                action_type_name: plainLog.actionTypeInfo ? plainLog.actionTypeInfo.name : plainLog.action_type,
                entity_type: plainLog.entity_type,
                entity_type_name: plainLog.entityTypeInfo ? plainLog.entityTypeInfo.name : plainLog.entity_type,
                target_id: plainLog.target_id,
                target_category: plainLog.target_category,
                target_name: targetName,
                ip_address: plainLog.ip_address,
                user_agent: plainLog.user_agent,
                parameters: plainLog.parameters,
                create_time: plainLog.create_time,
            };
        });

        // 查詢所有操作類型和實體類型，用於下拉選單
        const actionTypes = await AuditLogActionType.findAll({
            where: { is_active: true },
            attributes: ["id", "code", "name"],
            order: [["id", "ASC"]],
        });

        const entityTypes = await AuditLogEntityType.findAll({
            where: { is_active: true },
            attributes: ["id", "code", "name"],
            order: [["id", "ASC"]],
        });

        // 返回結果
        rsmodel.code = 0;
        rsmodel.data = {
            logs: formattedLogs,
            totalCount: count,
            totalPages: Math.ceil(count / perPage),
            currentPage: page,
            actionTypes: actionTypes,
            entityTypes: entityTypes,
        };
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getAuditLogFilterOptions = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        // 獲取選擇的操作類型和實體類型 IDs
        const actionTypeIds = req.query.actionTypeIds
            ? req.query.actionTypeIds.split(",").map((id) => parseInt(id))
            : [];
        const entityTypeIds = req.query.entityTypeIds
            ? req.query.entityTypeIds.split(",").map((id) => parseInt(id))
            : [];

        // 1. 查詢所有操作類型
        const actionTypes = await AuditLogActionType.findAll({
            where: { is_active: true },
            attributes: ["id", "code", "name"],
            order: [["id", "ASC"]],
        });

        // 2. 根據選擇的操作類型過濾實體類型
        let entityTypeWhere = { is_active: true };

        // 如果有選擇操作類型，查詢與這些操作類型相關的實體類型
        if (actionTypeIds.length > 0) {
            // 需要查詢審計日誌表，找出與選擇的操作類型相關的實體類型
            const relatedEntityTypes = await AuditLog.findAll({
                attributes: ["entity_type_id"],
                where: {
                    action_type_id: { [Op.in]: actionTypeIds },
                },
                group: ["entity_type_id"],
            });

            const relatedEntityTypeIds = relatedEntityTypes.map((et) => et.entity_type_id);

            if (relatedEntityTypeIds.length > 0) {
                entityTypeWhere.id = { [Op.in]: relatedEntityTypeIds };
            }
        }

        // 如果之前的過濾條件已指定了實體類型，則進一步限定
        if (entityTypeIds.length > 0) {
            entityTypeWhere.id = entityTypeWhere.id
                ? { [Op.and]: [entityTypeWhere.id, { [Op.in]: entityTypeIds }] }
                : { [Op.in]: entityTypeIds };
        }

        const entityTypes = await AuditLogEntityType.findAll({
            where: entityTypeWhere,
            attributes: ["id", "code", "name"],
            order: [["id", "ASC"]],
        });

        // 3. 獲取目標類別和可用目標
        const targetCategoryWhere = {};

        // 根據選擇的操作和實體類型過濾目標類別
        if (actionTypeIds.length > 0 || entityTypeIds.length > 0) {
            const whereClause = {};

            if (actionTypeIds.length > 0) {
                whereClause.action_type_id = { [Op.in]: actionTypeIds };
            }

            if (entityTypeIds.length > 0) {
                whereClause.entity_type_id = { [Op.in]: entityTypeIds };
            }

            const relevantLogs = await AuditLog.findAll({
                attributes: ["target_category", "target_id"],
                where: whereClause,
                group: ["target_category", "target_id"],
            });

            // 組織目標類別和ID
            const targetCategories = {
                expert: { label: "專家", items: [] },
                dataset: { label: "知識庫", items: [] },
                skill: { label: "技能", items: [] },
                form: { label: "表單", items: [] },
            };

            for (const log of relevantLogs) {
                if (log.target_category && log.target_id && targetCategories[log.target_category]) {
                    if (!targetCategories[log.target_category].items.includes(log.target_id)) {
                        targetCategories[log.target_category].items.push(log.target_id);
                    }
                }
            }

            // 可選：獲取目標名稱 (例如專家名稱)
            await Promise.all(
                Object.keys(targetCategories).map(async (category) => {
                    const items = targetCategories[category].items;
                    if (items.length > 0) {
                        try {
                            let itemDetails = [];

                            switch (category) {
                                case "expert":
                                    // 查詢專家名稱
                                    const experts = await sequelize.query(
                                        `SELECT id, name FROM expert WHERE id IN (:ids)`,
                                        {
                                            replacements: { ids: items },
                                            type: sequelize.QueryTypes.SELECT,
                                        }
                                    );
                                    itemDetails = experts.map((e) => ({ id: e.id, name: e.name }));
                                    break;

                                case "dataset":
                                    // 查詢知識庫名稱
                                    const datasets = await sequelize.query(
                                        `SELECT id, name FROM datasets WHERE id IN (:ids)`,
                                        {
                                            replacements: { ids: items },
                                            type: sequelize.QueryTypes.SELECT,
                                        }
                                    );
                                    itemDetails = datasets.map((d) => ({ id: d.id, name: d.name }));
                                    break;

                                case "skill":
                                    // 查詢技能名稱
                                    const skills = await sequelize.query(
                                        `SELECT id, name FROM skill WHERE id IN (:ids)`,
                                        {
                                            replacements: { ids: items },
                                            type: sequelize.QueryTypes.SELECT,
                                        }
                                    );
                                    itemDetails = skills.map((s) => ({ id: s.id, name: s.name }));
                                    break;

                                case "form":
                                    // 查詢表單名稱
                                    const forms = await sequelize.query(
                                        `SELECT id, form_name as name FROM form_configuration WHERE id IN (:ids)`,
                                        {
                                            replacements: { ids: items },
                                            type: sequelize.QueryTypes.SELECT,
                                        }
                                    );
                                    itemDetails = forms.map((f) => ({ id: f.id, name: f.name }));
                                    break;

                                // 其他類別類似處理...
                            }

                            targetCategories[category].itemDetails = itemDetails;
                        } catch (err) {
                            console.warn(`Failed to fetch ${category} names:`, err);
                            // 如果查詢失敗，提供默認名稱
                            targetCategories[category].itemDetails = items.map((id) => ({
                                id,
                                name: `${targetCategories[category].label}(${id})`,
                            }));
                        }
                    }
                })
            );

            rsmodel.data = {
                actionTypes: actionTypes,
                entityTypes: entityTypes,
                targetCategories: Object.keys(targetCategories)
                    .filter((key) => targetCategories[key].items.length > 0)
                    .map((key) => ({
                        value: key,
                        label: targetCategories[key].label,
                        items:
                            targetCategories[key].itemDetails ||
                            targetCategories[key].items.map((id) => ({ id, name: id })),
                    })),
            };
        } else {
            // 如果沒有選擇操作和實體類型，返回所有可用的目標類別
            const distinctCategories = await AuditLog.findAll({
                attributes: [[sequelize.fn("DISTINCT", sequelize.col("target_category")), "category"]],
                where: {
                    target_category: { [Op.ne]: null },
                },
            });

            rsmodel.data = {
                actionTypes: actionTypes,
                entityTypes: entityTypes,
                targetCategories: distinctCategories
                    .map((c) => c.category)
                    .filter(Boolean)
                    .map((category) => {
                        const label =
                            {
                                expert: "專家",
                                dataset: "知識庫",
                                skill: "技能",
                                form: "表單",
                            }[category] || category;

                        return {
                            value: category,
                            label: label,
                            items: [], // 沒有選擇操作和實體類型時，先不加載具體項目
                        };
                    }),
            };
        }

        rsmodel.code = 0;
    } catch (error) {
        console.error("Error fetching audit log filter options:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getAlertText = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        logRouteDetails("systemController.getAlertText", req);
        const alertText = await Settings.findOne({ where: { key: "agreement_alert" } });
        rsmodel.code = 0;
        rsmodel.data = alertText.value;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.updateAlertText = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        logRouteDetails("systemController.updateAlertText", req);
        const { alert_text } = JSON.parse(req.body);
        const [affectedCount] = await Settings.update({ value: alert_text }, { where: { key: "agreement_alert" } });

        // 若沒資料被更新，回傳錯誤
        if (affectedCount === 0) {
            rsmodel.code = 1;
            rsmodel.message = "agreement_alert is not exist.";
        } else {
            rsmodel.code = 0;
            rsmodel.message = "Successfully updated alert text.";
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};
