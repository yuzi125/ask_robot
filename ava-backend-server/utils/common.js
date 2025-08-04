const nodejieba = require("nodejieba");
const path = require("path");
const Settings = require("../orm/schema/settings");
const sql = require("../db/pgsql");
const { v4: uuidv4 } = require("uuid");

nodejieba.load({ dict: path.resolve(__dirname, "dict.txt") });

async function verifyUserNo(req) {
    try {
        const setting = await Settings.findOne({
            where: { key: "users_permission" },
            attributes: ["value"],
        });

        if (!setting) {
            console.error("Setting not found");
            return false;
        }

        const userId = req.session.userInfo.user_no;
        const userPermission = JSON.parse(setting.value?.trim() || "[]");

        return userPermission.includes(userId);
    } catch (error) {
        console.error("Error in verifyUserNo:", error);
        return false;
    }
}

function segmentContent(content) {
    return nodejieba.cut(content).join(" "); // 分詞並用空格連接詞語
}

function segmentContentForTsquery(content) {
    return nodejieba.cut(content).join(" & "); // 分詞並用空格連接詞語
}

function calculateTotalSpend(data) {
    const totalSpend = data.reduce((acc, item) => {
        const spendObj = item["花費金額"];
        Object.keys(spendObj).forEach((currency) => {
            acc[currency] = (acc[currency] || 0) + Number(spendObj[currency]);
        });
        return acc;
    }, {});

    return { totalSpend };
}

function decodeUnicode(str) {
    return str
        .replace(/\\u[\dA-F]{4}/gi, function (match) {
            return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16));
        })
        .replace(/\\n/g, "\n");
}

function transformResults(results) {
    const transformed = {};
    results.forEach((row) => {
        const userId = row.id;
        const expertId = row.expert_id;
        if (!transformed[userId]) {
            transformed[userId] = {
                id: userId,
                user_type_id: row.user_type_id,
                is_enable: row.is_enable,
                name: row.name,
                auth_id: row.auth_id,
                create_time: row.create_time,
                update_time: row.update_time,
                experts: {},
            };
        }

        if (!transformed[userId].experts[expertId]) {
            transformed[userId].experts[expertId] = {
                expert_id: expertId,
                expert_name: row.expert_name,
                expert_avatar: row.expert_avatar,
                expert_is_enable: row.expert_is_enable,
                chat_history: [],
            };
        }

        transformed[userId].experts[expertId].chat_history.push({
            input: row.input,
            output: decodeUnicode(row.output),
            message_create_time: row.message_create_time,
            history_message_id: row.history_message_id,
        });
    });

    // Convert the nested objects to arrays
    Object.values(transformed).forEach((user) => {
        user.experts = Object.values(user.experts);
        user.experts.forEach((expert) => {
            expert.chat_history.sort((a, b) => new Date(a.message_create_time) - new Date(b.message_create_time));
        });
    });

    return Object.values(transformed);
}

function transformResultsByExpertIdVersion(results) {
    const transformed = {};

    results.forEach((row) => {
        const userId = row.id;
        const expertId = row.expert_id;

        if (!transformed[userId]) {
            transformed[userId] = {
                id: userId,
                user_type_id: row.user_type_id,
                user_type_name: row.type_name,
                is_enable: row.is_enable,
                name: row.name,
                auth_id: row.auth_id,
                create_time: row.create_time,
                update_time: row.update_time,

                experts: {},
            };
        }

        if (!transformed[userId].experts[expertId]) {
            transformed[userId].experts[expertId] = {
                expert_id: expertId,
                expert_name: row.expert_name,
                expert_avatar: row.expert_avatar,
                expert_is_enable: row.expert_is_enable,
                chat_history: [],
            };
        }

        transformed[userId].experts[expertId].chat_history.push({
            input: row.input,
            output: decodeUnicode(row.output),
            message_create_time: row.message_create_time,
            type: row.type,
        });
    });

    // Convert the nested objects to arrays
    Object.values(transformed).forEach((user) => {
        user.experts = Object.values(user.experts);
        user.experts.forEach((expert) => {
            expert.chat_history.sort((a, b) => new Date(a.message_create_time) - new Date(b.message_create_time));
        });
    });

    return Object.values(transformed);
}

const processMetaData = (metaData) => {
    try {
        const parsed = typeof metaData === "object" ? metaData : JSON.parse(metaData);
        return {
            source: parsed.source || "",
            filename: parsed.filename || "",
            originalname: decodeUnicode(parsed.originalname || ""),
            datasource_url: parsed.datasource_url || "",
            datasource_name: parsed.datasource_name || "",
            upload_documents_id: parsed.upload_documents_id || "",
            upload_folder_id: parsed.upload_folder_id || "",
            datasets_id: parsed.datasets_id || "",
            chunk_type: parsed.chunk_type || "",
            node_type: parsed.node_type || "",
            node_id: parseInt(parsed.node_id) || null,
        };
    } catch (error) {
        console.error("Error parsing meta_data:", error);
        return {};
    }
};

const convertStringsToNumbers = (obj) => {
    // 遍歷物件的所有 key
    for (let key in obj) {
        // 如果該值是物件，則遞歸處理
        if (typeof obj[key] === "object" && obj[key] !== null) {
            convertStringsToNumbers(obj[key]);
        } else if (!isNaN(obj[key]) && typeof obj[key] === "string") {
            // 如果該值是字串且可轉換為數字，則轉換為數字
            obj[key] = Number(obj[key]);
        }
    }
};

async function createSuperAdmin(superAdminInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            const user_type = "member";
            const login_type = "system";
            let rs;
            rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;
            rs = await sql.query("select id from login_type where type_value = $1", [login_type]);
            const login_type_id = rs.rows[0]?.id;

            let { name, uid } = superAdminInfo;
            await sql.query("BEGIN");

            //用指定登入模式為sso與他的辨識id 搜索user_id

            // uid 是 auth_id ex:IT0218
            rs = await sql.query(
                "select a.user_id,b.is_enable from user_login_type a left join users b on a.user_id = b.id where login_type_id = $1 and auth_id = $2",
                [login_type_id, uid]
            );
            const is_enable = rs.rows[0]?.is_enable + "";

            // user_id 是 uuid 產出來的
            let user_id = rs.rows[0]?.user_id;
            const adminJson = {
                name,
                uid,
            };
            // 沒有 user_id 就新增使用者
            if (!user_id) {
                user_id = uuidv4();

                // console.info("無使用者，建立 users 與 user_login_type");
                rs = await sql.query("insert into users(id,user_type_id,name) values($1,$2,$3)", [
                    user_id,
                    user_type_id,
                    name,
                ]);
                await sql.query(
                    "insert into user_login_type(login_type_id,user_id,auth_id,user_info_json) values($1,$2,$3,$4)",
                    [login_type_id, user_id, uid, adminJson]
                );
            } else {
                // 有 user_id 將 user_id 取出送至 session
                // console.info("有使用者，轉至新的 sso user 並創 user_login_type");
                rs = await sql.query("select user_id from user_login_type where login_type_id = $1 and auth_id = $2", [
                    login_type_id,
                    uid,
                ]);
                // console.log("rsss", rs.rows[0]?.user_id);
                user_id = rs.rows[0]?.user_id;
            }
            await sql.query("COMMIT");

            rs = await sql.query("select type_value from login_type where id = $1", [login_type_id]);
            const login_type_value = rs.rows[0]?.type_value;

            resolve({
                id: user_id,
                name: name,
                avatar: null,
                sex: "",
                user_type: user_type,
                login_type: login_type,
                is_enable: is_enable,
                login_info: {
                    [login_type_value]: adminJson,
                },
                auth_id: {
                    [login_type_value]: uid,
                },
                uid: user_id,
                nickname: name,
                user_no: uid,
            });
        } catch (error) {
            await sql.query("ROLLBACK");
            reject(error);
        }
    });
}

module.exports = {
    calculateTotalSpend,
    transformResults,
    transformResultsByExpertIdVersion,
    processMetaData,
    convertStringsToNumbers,
    segmentContent,
    segmentContentForTsquery,
    verifyUserNo,
    createSuperAdmin,
    decodeUnicode,
};
