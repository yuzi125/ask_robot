const responseModel = require("../../model/responseModel");
const GroupPermission = require("../../orm/schema/group_permission");
const sql = require("../../db/pgsql");
const { Op } = require("sequelize");
const sequelize = require("../../orm/sequelize");

/* 獲取所有群組，支持分頁和搜尋 */

exports.getAllGroups = async function (req, res) {

    async function fetchFromDB(mode, groupSearch, page, pageSize) {
        let whereCondition = {};
        if (groupSearch) {
            whereCondition = {
                [Op.or]: [{ groupId: { [Op.iLike]: `%${groupSearch}%` } }, 
                { groupName: { [Op.iLike]: `%${groupSearch}%` } }],
            };
        }

        const attributes = mode === "simple" ? { exclude: ["groupMember"] } : undefined;
        if (mode === "simple") {
            const groups = await GroupPermission.findAll({
                where: whereCondition,
                order: [["update_time", "DESC"]],
                attributes,
            });

            return {
                groups,
            }
        } else {
            page = parseInt(page) > 0 ? parseInt(page) : 1;
            pageSize = parseInt(pageSize) > 0 ? parseInt(pageSize) : 10;
            const offset = (page - 1) * pageSize;
            const limit = pageSize;
  
            const totalCount = await GroupPermission.count({ where: whereCondition });
            const groups = await GroupPermission.findAll({
                where: whereCondition,
                order: [["update_time", "DESC"]],
                attributes,
                limit,
                offset,
            });
            return {
                groups,
                pagination:{
                    total: totalCount,
                    page,
                    pageSize,
                    totalPages: Math.ceil(totalCount / pageSize),
                }
            };
        }
    }

    async function fetchFromAPI(groupSearch, page, pageSize) {
        const baseUrl = process.env.CSC_API_HOST;
        if (!baseUrl) {
            throw new Error("CSC_API_HOST is not set");
        }

        page = parseInt(page) > 0 ? parseInt(page) : 1;
        pageSize = parseInt(pageSize) > 0 ? parseInt(pageSize) : 10;
        const params = {
            groupId: groupSearch,
            page: page,
            size: pageSize,
        };
        const queryString = new URLSearchParams(params).toString();
        const url = `${baseUrl}/ds/auth/allGroups?${queryString}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json; charset=UTF-8',
              'Content-Type': 'application/json'
            }
        })
       
        /*  
            example 
            {
                "data": [
                    {
                        "groupDesc": "Welder",
                        "groupId": "#1"
                    }
                ],
                "totalPages": 1388,
                "totalItems": 13871,
                "size": 10,
                "page": 0
            }
        */
        const resData = await response.json();
        const groups = resData.data.map(group => ({
            groupId: group.groupId,
            groupName: group.groupDesc,
        }));
        return {    
            groups: groups,
            pagination: {
                total: resData.totalItems,
                page: resData.page + 1, // return page is 1-based
                pageSize: resData.size,
                totalPages: resData.totalPages
            }
        }
    }

    let rsmodel = new responseModel();
    try {
        const { mode, page = 1, pageSize = 10, search = "" } = req.query;
        const SSO_TYPE = process.env.SSO_TYPE;
        const isCSC = SSO_TYPE && SSO_TYPE.toLowerCase() === "csc";
        let data = {}

        if (isCSC) {
            data = await fetchFromAPI(search, page, pageSize);
        } else {
            data = await fetchFromDB(mode, search, page, pageSize);     
        }
        rsmodel.code = 0;
        rsmodel.data = data;
    } catch (error) {
        console.error("Getting group data failed.", error);
        rsmodel.code = 1;
        rsmodel.message = "取得群組資料時發生問題。";
    }
    res.json(rsmodel);
};

/* 獲取單一群組 */
exports.getGroupById = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { groupId } = req.params;

        const group = await GroupPermission.findByPk(groupId);

        if (!group) {
            rsmodel.code = 1;
            rsmodel.message = "找不到指定的群組。";
            return res.json(rsmodel);
        }

        rsmodel.code = 0;
        rsmodel.data = group;
    } catch (error) {
        console.error("Getting group detail failed.", error);
        rsmodel.code = 1;
        rsmodel.message = "取得群組詳細資料時發生問題。";
    }
    res.json(rsmodel);
};

/* 新增群組 */
exports.createGroup = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { groupId, groupName, groupMember = [], remark } = JSON.parse(req.body);

        // ID 只允許英文與數字
        if (!/^[A-Za-z0-9]+$/.test(groupId)) {
            rsmodel.code = 1;
            rsmodel.message = "群組 ID 格式錯誤，僅能包含英文與數字。";
            return res.json(rsmodel);
        }

        // 檢查群組 ID 是否已存在
        const existingGroup = await GroupPermission.findByPk(groupId);
        if (existingGroup) {
            rsmodel.code = 1;
            rsmodel.message = "群組 ID 已經存在，請使用其他 ID。";
            return res.json(rsmodel);
        }

        // 新增群組
        const newGroup = await GroupPermission.create({
            groupId,
            groupName,
            groupMember,
            remark,
        });

        rsmodel.code = 0;
        rsmodel.data = newGroup;
        rsmodel.message = "群組新增成功。";
    } catch (error) {
        console.error("Creating group failed.", error);
        rsmodel.code = 1;
        rsmodel.message = "新增群組時發生問題。";
    }
    res.json(rsmodel);
};

/* 更新群組 */
exports.updateGroup = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { groupId } = req.params;
        const { groupName, groupMember, remark } = JSON.parse(req.body);

        const group = await GroupPermission.findByPk(groupId);

        if (!group) {
            rsmodel.code = 1;
            rsmodel.message = "找不到指定的群組。";
            return res.json(rsmodel);
        }

        // 更新群組資料
        await group.update({
            groupName,
            groupMember,
            remark,
        });

        rsmodel.code = 0;
        rsmodel.data = group;
        rsmodel.message = "群組更新成功。";
    } catch (error) {
        console.error("Updating group failed.", error);
        rsmodel.code = 1;
        rsmodel.message = "更新群組時發生問題。";
    }
    res.json(rsmodel);
};

/* 刪除群組 */
exports.deleteGroup = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { groupId } = req.params;

        const group = await GroupPermission.findByPk(groupId);

        if (!group) {
            rsmodel.code = 1;
            rsmodel.message = "找不到指定的群組。";
            return res.json(rsmodel);
        }

        // 開始一個資料庫事務，確保所有操作都成功執行或全部回滾
        await sequelize.transaction(async (t) => {
            // 1. 從 knowledge_permission 中移除群組權限
            const groupIdWithPrefix = `#${groupId}`;

            // 獲取當前的 knowledge_permission
            const settingResult = await sql.query("SELECT value FROM settings WHERE key = 'knowledge_permission'");

            if (settingResult.rows.length > 0) {
                let knowledgePermission = JSON.parse(settingResult.rows[0].value);

                // 從 pagePermissions 中移除
                if (knowledgePermission.pagePermissions) {
                    Object.keys(knowledgePermission.pagePermissions).forEach((page) => {
                        if (Array.isArray(knowledgePermission.pagePermissions[page])) {
                            knowledgePermission.pagePermissions[page] = knowledgePermission.pagePermissions[
                                page
                            ].filter((permission) => permission !== groupIdWithPrefix);
                        }
                    });
                }

                // 從 experts 中移除並清理空陣列
                if (knowledgePermission.experts) {
                    Object.keys(knowledgePermission.experts).forEach((expertId) => {
                        if (Array.isArray(knowledgePermission.experts[expertId])) {
                            knowledgePermission.experts[expertId] = knowledgePermission.experts[expertId].filter(
                                (permission) => permission !== groupIdWithPrefix
                            );

                            // 如果陣列為空，刪除該 key
                            if (knowledgePermission.experts[expertId].length === 0) {
                                delete knowledgePermission.experts[expertId];
                            }
                        }
                    });
                }

                // 從 datasets 中移除並清理空陣列
                if (knowledgePermission.datasets) {
                    Object.keys(knowledgePermission.datasets).forEach((datasetId) => {
                        if (Array.isArray(knowledgePermission.datasets[datasetId])) {
                            knowledgePermission.datasets[datasetId] = knowledgePermission.datasets[datasetId].filter(
                                (permission) => permission !== groupIdWithPrefix
                            );

                            // 如果陣列為空，刪除該 key
                            if (knowledgePermission.datasets[datasetId].length === 0) {
                                delete knowledgePermission.datasets[datasetId];
                            }
                        }
                    });
                }

                // 從 skills 中移除並清理空陣列
                if (knowledgePermission.skills) {
                    Object.keys(knowledgePermission.skills).forEach((skillId) => {
                        if (Array.isArray(knowledgePermission.skills[skillId])) {
                            knowledgePermission.skills[skillId] = knowledgePermission.skills[skillId].filter(
                                (permission) => permission !== groupIdWithPrefix
                            );

                            // 如果陣列為空，刪除該 key
                            if (knowledgePermission.skills[skillId].length === 0) {
                                delete knowledgePermission.skills[skillId];
                            }
                        }
                    });
                }

                // 從 chatExperts 中移除並清理空陣列
                if (knowledgePermission.chatExperts) {
                    Object.keys(knowledgePermission.chatExperts).forEach((expertId) => {
                        if (Array.isArray(knowledgePermission.chatExperts[expertId])) {
                            knowledgePermission.chatExperts[expertId] = knowledgePermission.chatExperts[
                                expertId
                            ].filter((permission) => permission !== groupIdWithPrefix);

                            // 如果陣列為空，刪除該 key
                            if (knowledgePermission.chatExperts[expertId].length === 0) {
                                delete knowledgePermission.chatExperts[expertId];
                            }
                        }
                    });
                }

                // 從 actionPermissions 中移除
                if (knowledgePermission.actionPermissions) {
                    Object.keys(knowledgePermission.actionPermissions).forEach((action) => {
                        if (Array.isArray(knowledgePermission.actionPermissions[action])) {
                            knowledgePermission.actionPermissions[action] = knowledgePermission.actionPermissions[
                                action
                            ].filter((permission) => permission !== groupIdWithPrefix);
                        }
                    });
                }

                // 更新資料庫
                await sql.query("UPDATE settings SET value = $1 WHERE key = 'knowledge_permission'", [
                    JSON.stringify(knowledgePermission),
                ]);
            }

            // 2. 刪除群組本身
            await group.destroy({ transaction: t });
        });

        rsmodel.code = 0;
        rsmodel.message = "群組刪除成功，相關權限設定已移除。";
    } catch (error) {
        console.error("Deleting group failed.", error);
        rsmodel.code = 1;
        rsmodel.message = "刪除群組時發生問題。";
    }
    res.json(rsmodel);
};

/* 使用者清單 - 支援分頁和搜尋 */
exports.getUsers = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { page = 1, pageSize = 10, search = "" } = req.query;
        const offset = (page - 1) * pageSize;

        // 建構搜尋條件
        let searchCondition = "";
        let params = [];

        if (search) {
            searchCondition = "AND (LOWER(u.name) LIKE $1 OR LOWER(ult.auth_id) LIKE $1)";
            params.push(`%${search.toLowerCase()}%`);
        }

        // 取得總數
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users u 
            JOIN user_login_type ult ON u.id = ult.user_id 
            WHERE u.user_type_id = 2 AND u.is_enable = 1 
            AND u.name IS NOT NULL AND u.name != '' ${searchCondition}
        `;

        const countResult = await sql.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // 取得分頁資料
        const dataQuery = `
            SELECT u.name, u.id, ult.auth_id AS user_no 
            FROM users u 
            JOIN user_login_type ult ON u.id = ult.user_id 
            WHERE u.user_type_id = 2 AND u.is_enable = 1 
            AND u.name IS NOT NULL AND u.name != '' ${searchCondition}
            ORDER BY u.name
            LIMIT ${pageSize} OFFSET ${offset}
        `;

        const dataResult = await sql.query(dataQuery, params);

        rsmodel.code = 0;
        rsmodel.data = {
            users: dataResult.rows,
            pagination: {
                total,
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                totalPages: Math.ceil(total / pageSize),
            },
        };
    } catch (error) {
        console.error("Getting users data failed.", error);
        rsmodel.code = 1;
        rsmodel.message = "取得使用者清單時發生問題。";
    }
    res.json(rsmodel);
};

/* 新增使用者到群組 */
exports.addUserToGroup = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { groupId } = req.params;
        const { userNo } = JSON.parse(req.body);

        const group = await GroupPermission.findByPk(groupId);

        if (!group) {
            rsmodel.code = 1;
            rsmodel.message = "找不到指定的群組。";
            return res.json(rsmodel);
        }

        // 檢查使用者是否已在群組中
        if (group.groupMember.includes(userNo)) {
            rsmodel.code = 1;
            rsmodel.message = "使用者已在群組中。";
            return res.json(rsmodel);
        }

        // 新增使用者到群組
        group.groupMember = [...group.groupMember, userNo];
        await group.save();

        rsmodel.code = 0;
        rsmodel.data = group;
        rsmodel.message = "使用者已成功新增至群組。";
    } catch (error) {
        console.error("Adding user to group failed.", error);
        rsmodel.code = 1;
        rsmodel.message = "新增使用者至群組時發生問題。";
    }
    res.json(rsmodel);
};

/* 從群組移除使用者 */
exports.removeUserFromGroup = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { groupId, userNo } = req.params;

        const group = await GroupPermission.findByPk(groupId);

        if (!group) {
            rsmodel.code = 1;
            rsmodel.message = "找不到指定的群組。";
            return res.json(rsmodel);
        }

        // 檢查使用者是否在群組中
        if (!group.groupMember.includes(userNo)) {
            rsmodel.code = 1;
            rsmodel.message = "使用者不在群組中。";
            return res.json(rsmodel);
        }

        // 從群組移除使用者
        group.groupMember = group.groupMember.filter((member) => member !== userNo);
        await group.save();

        rsmodel.code = 0;
        rsmodel.data = group;
        rsmodel.message = "使用者已成功從群組移除。";
    } catch (error) {
        console.error("Removing user from group failed.", error);
        rsmodel.code = 1;
        rsmodel.message = "從群組移除使用者時發生問題。";
    }
    res.json(rsmodel);
};

module.exports = exports;
