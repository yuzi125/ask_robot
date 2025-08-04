require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
const axios = require("axios");
const xml2js = require("xml2js");
const { v4: uuidv4 } = require("uuid");
const sql = require("../db/pgsql");
// const casUrl = "https://sso.icsc.com.tw/sso";
const requestIp = require("request-ip");

const { getLoginTypeID, loginRecord } = require("../utils/common");
const { validateApiKey } = require("../utils/apiKeyUtils");
const CSC_SSO_URL = process.env.CSC_SSO_URL;
const CSC_LOGIN_STATUS_CHECK_URL = process.env.CSC_LOGIN_STATUS_CHECK_URL;

// url 參數給空白就好
// const CSC_LOGIN_STATUS_PARAMS_URL = "";
const CSC_LOGIN_STATUS_CODE = "OnlyForF3Website";
const X_EZOAG_TOKEN = process.env.X_EZOAG_TOKEN;
const X_EZOAG_JWT = process.env.X_EZOAG_JWT;
// 判斷如果是在 iframe 裡面的話，就要call外部function
// 怎麼樣知道被嵌入 被嵌入要是 session 過期就要重新導向到登入頁面 要呼叫 message function
async function ssoMiddleware(req, res, next) {
    // 如果來源 URL 包含 /logout，直接 next() 登出不檢查 session
    if (req.originalUrl.includes("/logout")) {
        return next();
    }

    // 檢查來源是否為 line
    if (req.headers.source && req.headers.source === "line") {
        return next();
    }

    // 在執行請求前都要先check一次資料庫連線狀態，如果連線失敗就直接回503。
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

    // apiKey 檢查
    const apiKey = req.headers["api-key"];
    if (apiKey && (await validateApiKey(apiKey))) {
        return next();
    }

    // if (req.headers["api-key"] && req.headers["api-key"] === "e9e46c13-3365-457a-bc18-3032c30ad94e") {
    //     try {
    //         const userInfo = await createWebApiKey("e9e46c13-3365-457a-bc18-3032c30ad94e");
    //         req.session.userType = "webapi";
    //         req.session.userInfo = userInfo;
    //         req.session.save();
    //         return next();
    //     } catch (error) {
    //         console.error(error.message);
    //     }
    // }

    try {
        //   url=eip2t.csc.com.tw&code=OnlyForF3Website&stype=1&sid=h5suzz452ham0db4yq2cfu45&gcid=0002&guid=I30420&cip=10.0.118.82
        /**
         * 檢查有沒有 session 的 function 需要以下參數
         * url, code, stype, sid, gcid, guid, cip
         * url：使用單位之站台網址 空白即可
         * code：呼叫登入服務之授權碼
         * stype：登入狀態版本 (固定為 1)
         * sid：session id
         * gcid：group company id (0002 是中鋼)
         * guid：group user id (Ixxxxx)
         * cip：登入者的 ip
         */

        let { sid, gcid, guid, name, uid, dept } = req.cookies;

        // 判斷是不是被嵌入的 如果是 true 代表是被嵌入的
        const isIframe = req.headers["isiframe"];

        const cip = requestIp.getClientIp(req);
        // const cip = "10.201.18.30";
        const stype = 1;
        //------------------- 測試用 -------------------
        // const cip = "10.0.118.82";
        // // const cip = "10.201.85.63"; // home wifi

        // name 是 unicode 編碼的字串

        let cname = JSON.parse(`"${name?.replace(/%u/g, "\\u")}"`);

        let loginStatusUrl = `${CSC_LOGIN_STATUS_CHECK_URL}?url='https://testeip.csc.com.tw'&code=${CSC_LOGIN_STATUS_CODE}&stype=${stype}&sid=${sid}&gcid=${gcid}&guid=${guid}&cip=${cip}`;

        const response = await axios.get(loginStatusUrl, {
            headers: {
                "X-EZOAG-TOKEN": X_EZOAG_TOKEN,
                "X-EZOAG-JWT": X_EZOAG_JWT,
            },
        });
        const data = await response.data;
        // console.log(sid, gcid, guid, cname, uid);
        // 解析 XML，如果 ERR_MSG_DSS6 有包含 * 代表登入失敗
        try {
            xml2js.parseString(data, { explicitArray: false }, async (err, result) => {
                try {
                    if (err) {
                        console.error("解析 XML 時發生錯誤:", err);
                        return;
                    }

                    const errTag = result?.DSS6.ERR_TAG_DSS6;

                    if (errTag.includes("*")) {
                        req.session.userType = "guest";
                        // 如果是 iframe 裡面的話，就要 call 外部 function
                        if (isIframe === "true") {
                            return res.status(401).json({ isIframe: true, result });
                        }
                        return res.status(401).json({ Location: CSC_SSO_URL });
                    } else {
                        try {
                            if (req.session.userInfo) {
                                return next();
                            }
                            const rs = await createSSO({ gcid, guid, stype, cname, uid, dept });
                            // console.log("res", rs.data);
                            req.session.userType = "member";
                            req.session.userInfo = rs.data;

                            const loginTypeID = await getLoginTypeID("csc_sso");
                            loginRecord(rs.data.id, loginTypeID, rs.data.name);
                            req.session.loginType = loginTypeID;
                            // 使用 await 確保 session 保存完成
                            await new Promise((resolve, reject) => {
                                req.session.save((err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            });

                            next();
                        } catch (error) {
                            console.error("createSSO 發生錯誤:", error);
                            res.status(500).send("Server Error");
                        }
                    }
                } catch (error) {
                    console.error("解析 XML 時發生錯誤:", error);
                }
            });
        } catch (error) {
            console.log("驗證 API 錯誤", error);
        }
    } catch (error) {
        console.error("發送請求時發生錯誤:", error);
        res.status(500).send("Server Error");
    }
}

async function createSSO(cookies) {
    return new Promise(async (resolve, reject) => {
        try {
            const user_type = "member";
            const login_type = "csc_sso";
            let rs;
            rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;
            rs = await sql.query("select id from login_type where type_value = $1", [login_type]);
            const login_type_id = rs.rows[0]?.id;

            let { gcid, guid, stype, cname, uid, dept } = cookies;
            await sql.query("BEGIN");

            //用指定登入模式為sso與他的辨識id 搜索user_id

            // uid 是 auth_id ex:IT0218
            rs = await sql.query(
                "select a.user_id, a.user_info_json, b.is_enable from user_login_type a left join users b on a.user_id = b.id where login_type_id = $1 and auth_id = $2",
                [login_type_id, uid]
            );
            const is_enable = rs.rows[0]?.is_enable + "";
            const originalJson = rs.rows[0]?.user_info_json || {};

            // user_id 是 uuid 產出來的
            let user_id = rs.rows[0]?.user_id;
            const cscSSOJson = {
                gcid,
                guid,
                stype,
                cname,
                uid,
                depNo: dept,
            };
            // 沒有 user_id 就新增使用者
            if (!user_id) {
                user_id = uuidv4();

                // console.info("無使用者，建立 users 與 user_login_type");
                rs = await sql.query("insert into users(id,user_type_id,name) values($1,$2,$3)", [
                    user_id,
                    user_type_id,
                    cname,
                ]);
                await sql.query(
                    "insert into user_login_type(login_type_id,user_id,auth_id,user_info_json) values($1,$2,$3,$4)",
                    [login_type_id, user_id, uid, cscSSOJson]
                );
            } else {
                // 有 user_id 將 user_id 取出送至 session
                // console.info("有使用者，轉至新的 sso user 並創 user_login_type");
                let parsedOriginal = {};

                try {
                    parsedOriginal = typeof originalJson === 'string' ? JSON.parse(originalJson) : originalJson || {};
                } catch (e) {
                    parsedOriginal = {};
                }
                const updatedJson = {
                    ...parsedOriginal,
                    ...cscSSOJson,
                };
                await sql.query(
                    "update user_login_type set user_info_json = $1 where login_type_id = $2 and auth_id = $3",
                    [JSON.stringify(updatedJson), login_type_id, uid]
                );                
            }
            await sql.query("COMMIT");

            rs = await sql.query("select type_value from login_type where id = $1", [login_type_id]);
            const login_type_value = rs.rows[0]?.type_value;

            resolve({
                data: {
                    id: user_id,
                    name: cname,
                    avatar: null,
                    sex: "",
                    user_type: user_type,
                    login_type: login_type,
                    is_enable: is_enable,
                    login_info: {
                        [login_type_value]: cscSSOJson,
                    },
                    auth_id: {
                        [login_type_value]: uid,
                    },
                    uid: user_id,
                    nickname: cname,
                    user_no: uid,
                    comp_no: gcid,
                },
            });
        } catch (error) {
            await sql.query("ROLLBACK");
            reject(error);
        }
    });
}

async function createWebApiKey(uuid) {
    return new Promise(async (resolve, reject) => {
        try {
            const user_type = "webapi";
            let rs;
            rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;

            const userInfo = {
                uid: uuid,
                nickname: "webapi",
                user_no: "webapi",
                sex: "",
                avatar: "",
                user_type: user_type,
            };
            sql.query(
                "INSERT INTO users (id, user_type_id) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET user_type_id = $2",
                [uuid, user_type_id]
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

module.exports = ssoMiddleware;
