// middleware/apiKeyMiddleware.js
const ApiKeys = require("../orm/schema/api_keys");
const ApiKeyDomains = require("../orm/schema/api_key_domains");
const ApiKeyMapping = require("../orm/schema/api_key_mapping");
const ApiKeyUsage = require("../orm/schema/api_key_usage_logs");
const Users = require("../orm/schema/users");
const sql = require("../db/pgsql");
const { checkScope } = require("../utils/apiKey");

const apiKeyMiddleware = async (req, res, next) => {
    // 如果沒有帶 api_key，直接繞過
    const apiKey = req.headers["api-key"] || req.query.api_key || req.body.api_key;
    if (!apiKey) {
        return next();
    }

    try {
        // 檢查 API Key 是否存在且啟用
        const keyData = await ApiKeys.findOne({
            where: {
                key: apiKey,
                status: 1, // 啟用狀態
            },
            include: [
                {
                    model: ApiKeyDomains,
                    attributes: ["domain", "status"],
                },
                {
                    model: Users,
                    attributes: ["name"],
                },
            ],
        });

        if (!keyData) {
            return res.status(401).json({
                code: 1,
                message: "Invalid or disabled API key",
            });
        }

        const username = `${keyData.User.name} - webapi`;

        // 先記錄使用情況
        const usage = await ApiKeyUsage.create({
            api_key_id: keyData.id,
            endpoint: req.path,
            method: req.method,
        });

        // 檢查 scope TODO: 之後統一下面的寫法 我現在想放假
        const hasScope = await checkScope(keyData, req.path);
        if (!hasScope) {
            return res.status(403).json({
                code: 1,
                message: "Path not allowed for this API key",
            });
        }

        // 檢查 domain
        if (keyData.ApiKeyDomains) {
            const requestOrigin = req.get("origin") || req.get("referer");
            if (!requestOrigin) {
                return res.status(401).json({
                    code: 1,
                    message: "Origin not provided",
                });
            }

            const domain = new URL(requestOrigin).hostname;
            const isAllowedDomain = keyData.ApiKeyDomains.some(
                (d) => (d.domain === domain && d.status === 1) || d.domain === "*"
            );

            if (!isAllowedDomain) {
                return res.status(401).json({
                    code: 1,
                    message: "Domain not allowed",
                });
            }
        }

        if (req.body.expert_id || req.body.dataset_id) {
            try {
                // 如果傳入 expert_id，創建一筆對應記錄
                if (req.body.expert_id) {
                    await ApiKeyMapping.create({
                        api_key_id: keyData.id,
                        mapping_type: 1, // 對應 expert
                        mapping_id: req.body.expert_id,
                        usage_id: usage.id,
                    });
                }

                // 如果傳入 dataset_id，創建另一筆對應記錄
                if (req.body.dataset_id) {
                    await ApiKeyMapping.create({
                        api_key_id: keyData.id,
                        mapping_type: 2, // 對應 dataset
                        mapping_id: req.body.dataset_id,
                        usage_id: usage.id,
                    });
                }

            } catch (error) {
                console.error("Error creating API key mapping:", error);
                return res.status(500).json({
                    code: 1,
                    message: "Error recording API usage",
                });
            }
        }

        // 將 API Key 資訊添加到請求中 不知道會不會用到
        req.apiKeyData = keyData;
        req.usage_id = usage.id;

        try {
            const userInfo = await createWebApiKey(apiKey, username);
            req.session.userType = "webapi";
            req.session.userInfo = userInfo;
            req.session.save();
        } catch (error) {
            console.error(error.message);
            return res.status(500).json({
                code: 1,
                message: "Create session error",
            });
        }

        return next();
    } catch (error) {
        console.error("API Key middleware error:", error);
        res.status(500).json({
            code: 1,
            message: "Internal server error",
        });
    }
};

async function createWebApiKey(uuid, username) {
    return new Promise(async (resolve, reject) => {
        try {
            const user_type = "webapi";
            let rs;
            rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;

            const userInfo = {
                uid: uuid,
                nickname: username,
                user_no: "webapi",
                sex: "",
                avatar: "",
                user_type: user_type,
            };

            sql.query(
                "INSERT INTO users (id, user_type_id,name) VALUES ($1, $2,$3) ON CONFLICT (id) DO UPDATE SET user_type_id = $2",
                [uuid, user_type_id, username]
            )
                .then((rs) => {
                    // let redisStore = require("../global/redisStore");
                    // redisStore.set(req.sessionID, { userType: "webapi", userInfo: JSON.stringify(userInfo) }, (err) => {
                    //     if (err) {
                    //         console.error("Error setting session data:", err);
                    //     } else {
                    //         console.log("Session data saved successfully");
                    //     }
                    // });
                })
                .catch((err) => {});
            resolve(userInfo);
        } catch (error) {
            reject(error.message);
        }
    });
}

module.exports = apiKeyMiddleware;
