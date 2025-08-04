require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
const axios = require("axios");
const moment = require("moment");
const sql = require("../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const { validateApiKey } = require("../utils/apiKey");

const BACK_KCG_SSO_BASE_URL = process.env.BACK_KCG_SSO_BASE_URL || "https://accounts-api.kcg.gov.tw";

// 儲存應用程式的 token
let appTokens = {
    PUBLIC_APP_SSO_TOKEN: null,
    PRIVILEGED_APP_SSO_TOKEN: null,
    PRIVATE_APP_SSO_TOKEN: null,
    expiry: null,
};

async function kcgSSOMiddleware(req, res, next) {
    try {
        // 1. 檢查資料庫連線
        try {
            const rs = await sql.checkDBConnection();
            if (rs) {
                if (rs.code === 0) {
                    console.error("DB checking error result: ", rs);
                    return res.status(503).json(rs);
                }
            } else {
                console.error("DB checking no response");
                return res.status(503).json(rs);
            }
        } catch (error) {
            console.error("checkDBConnection go wrong: ", error);
            return res.status(503).json({ error: "Internal Server Error(503)" });
        }

        // 跳過middleware的API & apikey檢查
        const isOpenApi = req.path.match(
            /\/expert\/(overview|getMostFrequentQuestion|getAllTokenUsageOverview|getAllActiveUserOverview|getAllMostFrequentQuestion)|\/datasets\/getDatasetUsageData/
        );
        if (isOpenApi) {
            return next();
        }

        const apiKey = req.headers["api-key"];
        if (apiKey && (await validateApiKey(apiKey))) {
            return next();
        }

        if (
            req.url.startsWith("/backend/system/db") ||
            req.url.startsWith("/backend/system/sss") ||
            req.url.startsWith("/backend/system/getSettings")
        ) {
            return next();
        }

        if (req.session.isAdmin) {
            return next();
        }

        // 下載檔案有帶token 這個是給 line 用的
        if (req.url.includes("/download") && req.query.token) {
            try {
                // 驗證 token 是否有效
                const fileJwtKey = process.env.FILE_EXPIRE_JWT_SECRET_KEY || "d436fce7-efa4-412b-af9b-151dc4298403";
                const decoded = jwt.verify(req.query.token, fileJwtKey);
                return next();
            } catch (err) {
                if (err.name === "TokenExpiredError") {
                    return res.status(401).json({ message: "Token 已過期" });
                } else {
                    console.error("Invalid or expired token:", err.message);
                    return res.status(401).json({ message: "無效的 token" });
                }
            }
        }

        // 高雄市市民版 現在會因為沒有 sso token 所以打到下載 API 的時候會被重定向到登入頁面 先繞過去
        if (req.url.includes("/download")) {
            return next();
        }

        // 2. 檢查用戶 Token
        const userToken = req?.cookies?.PUBLIC_APP_USER_SSO_TOKEN || req?.headers["x-kcg-sso-token"];
        if (!userToken) {
            // 如果沒有 Token，清除 session 並重定向到登入頁面
            if (req.session.userInfo) {
                req.session.destroy();
            }

            // 直接重導向到登入頁面
            return res.status(401).json({
                error: "No SSO token",
                Location: process.env.BACK_KCG_SSO_LOGIN_URL + "?app_id=" + process.env.BACK_KCG_APP_ID,
                SSO_TYPE: process.env.SSO_TYPE,
            });
        }

        // 3. 確保應用程式有有效的 Token
        await ensureValidAppTokens();

        // 4. 驗證用戶 Token
        try {
            const validateResponse = await axios.post(`${BACK_KCG_SSO_BASE_URL}/app_user/validate_sso_token/`, {
                PRIVILEGED_APP_SSO_TOKEN: appTokens.PRIVILEGED_APP_SSO_TOKEN,
                PUBLIC_APP_USER_SSO_TOKEN_TO_VALIDATE: userToken,
            });

            if (validateResponse.data.ERROR_CODE !== "0") {
                // 如果 Token 無效，清除 session 並重定向
                if (req.session.userInfo) {
                    req.session.destroy();
                }

                return res.status(401).json({
                    error: "Invalid SSO token",
                    Location: process.env.BACK_KCG_SSO_LOGIN_URL + "?app_id=" + process.env.BACK_KCG_APP_ID,
                    SSO_TYPE: process.env.SSO_TYPE,
                });
            }

            // 5. 如果當前userType不是 member 且有 userToken，則取得用戶資訊並更新或創建用戶資料
            if (req?.session?.userType !== "member" && userToken) {
                // 6. 取得用戶資訊
                const userInfo = await getUserInfo(userToken);
                // 7. 更新或創建用戶資料
                const userData = await createOrUpdateUser(userInfo);

                // 8. 設置 session
                req.session.userType = "member";
                req.session.userInfo = userData;
                // req.session.userInfoExpiry = moment().add(12, "hour"); // 設定 12 小時後過期

                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            next();
        } catch (error) {
            console.error("SSO validation error:", error);
            return res.status(401).json({
                error: "SSO validation failed",
                Location: process.env.BACK_KCG_SSO_LOGIN_URL + "?app_id=" + process.env.BACK_KCG_APP_ID,
                SSO_TYPE: process.env.SSO_TYPE,
            });
        }
    } catch (error) {
        console.error("KCG SSO Middleware error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// 確保應用程式有有效的 Token
async function ensureValidAppTokens() {
    if (!appTokens.PRIVILEGED_APP_SSO_TOKEN || moment().isAfter(appTokens.expiry)) {
        const response = await axios.post(`${BACK_KCG_SSO_BASE_URL}/app/request_basic_authentication/`, {
            APP_PRIVATE_ID: process.env.BACK_KCG_APP_PRIVATE_ID,
            APP_PRIVATE_PASSWD: process.env.BACK_KCG_APP_PRIVATE_PASSWD,
        });

        if (response.data.ERROR_CODE === "0") {
            appTokens = {
                PUBLIC_APP_SSO_TOKEN: response.data.PUBLIC_APP_SSO_TOKEN,
                PRIVILEGED_APP_SSO_TOKEN: response.data.PRIVILEGED_APP_SSO_TOKEN,
                PRIVATE_APP_SSO_TOKEN: response.data.PRIVATE_APP_SSO_TOKEN,
                expiry: moment(response.data.PRIVILEGED_APP_SSO_TOKEN_EXPIRY_DATE, "YYYYMMDDHHmmssZ"),
            };
        } else {
            throw new Error("Failed to get application tokens");
        }
    }
}

// 取得用戶資訊
async function getUserInfo(userToken) {
    const authResponse = await axios.post(`${BACK_KCG_SSO_BASE_URL}/app_user/get_auth_info/`, {
        PRIVILEGED_APP_SSO_TOKEN: appTokens.PRIVILEGED_APP_SSO_TOKEN,
        PUBLIC_APP_USER_SSO_TOKEN_TO_QUERY: userToken,
    });

    if (authResponse.data.ERROR_CODE !== "0") {
        throw new Error("Failed to get user auth info");
    }

    const nodeResponse = await axios.post(`${BACK_KCG_SSO_BASE_URL}/app_user/get_node_uuid/`, {
        PRIVILEGED_APP_SSO_TOKEN: appTokens.PRIVILEGED_APP_SSO_TOKEN,
        PUBLIC_APP_USER_SSO_TOKEN_TO_QUERY: userToken,
    });

    if (nodeResponse.data.ERROR_CODE !== "0") {
        throw new Error("Failed to get user node info");
    }

    const detailResponse = await axios.post(`${BACK_KCG_SSO_BASE_URL}/org_tree/get_user_node/`, {
        PRIVILEGED_APP_SSO_TOKEN: appTokens.PRIVILEGED_APP_SSO_TOKEN,
        APP_COMPANY_UUID: nodeResponse.data.APP_COMPANY_UUID,
        APP_USER_NODE_UUID: nodeResponse.data.APP_USER_NODE_UUID,
        APP_USER_BASIC_PROFILE: {
            APP_USER_LOGIN_ID: "",
            APP_USER_CHT_NAME: "",
            APP_USER_OFFICE_PHONE_NO: "",
            APP_USER_EMAIL: "",
            APP_DEPT_NODE_UUID: "",
            APP_USER_STATUS: "",
        },
        APP_USER_HR_PROFILE: {
            APP_USER_TW_SSN: "",
        },
    });

    return {
        ...authResponse.data,
        ...nodeResponse.data,
        ...detailResponse.data,
    };
}

// 創建或更新用戶資料
async function createOrUpdateUser(userInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            const user_type = "member";
            const login_type = "kcg_sso";
            let rs;

            // 取得用戶類型 ID
            rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;

            // 取得登入類型 ID
            rs = await sql.query("select id from login_type where type_value = $1", [login_type]);
            const login_type_id = rs.rows[0]?.id;

            // 檢查用戶是否存在
            rs = await sql.query(
                "select a.user_id, b.is_enable from user_login_type a left join users b on a.user_id = b.id where login_type_id = $1 and auth_id = $2",
                [login_type_id, userInfo.APP_USER_LOGIN_ID]
            );

            let user_id = rs.rows[0]?.user_id;
            const is_enable = rs.rows[0]?.is_enable + "";

            const kcgUserInfo = {
                login_id: userInfo.APP_USER_LOGIN_ID,
                name: userInfo.APP_USER_BASIC_PROFILE.APP_USER_CHT_NAME,
                email: userInfo.APP_USER_BASIC_PROFILE.APP_USER_EMAIL,
                dept_uuid: userInfo.APP_USER_BASIC_PROFILE.APP_DEPT_NODE_UUID,
                node_uuid: userInfo.APP_USER_NODE_UUID,
            };

            if (rs.rows.length === 0) {
                // 創建新用戶
                user_id = uuidv4();
                await sql.query(
                    "insert into users(id,user_type_id,name) values($1,$2,$3)" + "ON CONFLICT (id) DO NOTHING",
                    [user_id, user_type_id, kcgUserInfo.name]
                );

                await sql.query(
                    "insert into user_login_type(login_type_id,user_id,auth_id,user_info_json) values($1,$2,$3,$4)" +
                        "ON CONFLICT (login_type_id, auth_id) DO NOTHING",
                    [login_type_id, user_id, kcgUserInfo.login_id, kcgUserInfo]
                );
            } else {
                // 更新現有用戶資料
                rs = await sql.query("select user_id from user_login_type where login_type_id = $1 and auth_id = $2", [
                    login_type_id,
                    userInfo.APP_USER_LOGIN_ID,
                ]);
                // console.log("rsss", rs.rows[0]?.user_id);
                user_id = rs.rows[0]?.user_id;
            }

            resolve({
                id: user_id,
                name: kcgUserInfo.name,
                avatar: null,
                sex: "",
                user_type: user_type,
                login_type: login_type,
                is_enable: is_enable,
                login_info: {
                    [login_type]: kcgUserInfo,
                },
                auth_id: {
                    [login_type]: kcgUserInfo.login_id,
                },
                uid: user_id,
                nickname: kcgUserInfo.name,
                user_no: kcgUserInfo.login_id,
            });
        } catch (error) {
            await sql.query("ROLLBACK");
            reject(error);
        }
    });
}

module.exports = kcgSSOMiddleware;
