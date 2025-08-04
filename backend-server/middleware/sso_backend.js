const axios = require("axios");
const FormData = require("form-data");
const jwt = require("jsonwebtoken");
const casUrl = process.env.CAS_URL;
const serviceUrl = encodeURIComponent(process.env.BACKEND_SERVER_SSO);
const clientUrl = process.env.BACK_CLIENT_SSO_REDIRECT || "";
const { validateApiKey } = require("../utils/apiKey");
const ci = "erp";
const pired = 86400;
const sql = require("../db/pgsql");
const { v4: uuidv4 } = require("uuid");
// const pired = 10;

function isExpired(userInfo) {
    let iat = userInfo.iat;
    let now = Math.floor(new Date().getTime() / 1000);
    let boo = now - iat > pired;
    return boo;
}

async function createSSO(userInfo, lastUserInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            const user_type = "member";
            const login_type = "icsc_sso";
            let rs;
            rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;
            rs = await sql.query("select id from login_type where type_value = $1", [login_type]);
            const login_type_id = rs.rows[0]?.id;

            let userData = JSON.parse(userInfo.userData);
            let { cName, userNo, postNo, depNo, idType, compNo, eMail, sex, birthday } = userData;
            await sql.query("BEGIN");

            //用指定登入模式為sso與他的辨識id 搜索user_id
            let uid;
            rs = await sql.query(
                "select a.user_id, a.user_info_json, b.is_enable from user_login_type a left join users b on a.user_id = b.id where login_type_id = $1 and auth_id = $2",
                [login_type_id, userNo]
            );
            const is_enable = rs.rows[0]?.is_enable + "";
            const originalJson = rs.rows[0]?.user_info_json || {};

            uid = rs.rows[0]?.user_id;
            //是否需要清除遊客cookie(只有遊客被替換成使用者時需要清除)
            let clearGuest = false;
            if (!uid) {
                //若無此登入userNo 且 無遊客的紀錄 則創新users與user_login_type ; 若有遊客紀錄 則將遊客user轉成sso user，出去後要清除遊客cookie
                const isGuest = lastUserInfo?.user_type === 1;
                uid = uuidv4();
                if (!isGuest) {
                    console.info("無遊客，建立users 與 user_login_type");
                    rs = await sql.query("insert into users(id,user_type_id,name,sex) values($1,$2,$3,$4)", [
                        uid,
                        user_type_id,
                        cName,
                        sex,
                    ]);
                    await sql.query(
                        "insert into user_login_type(login_type_id,user_id,auth_id,user_info_json) values($1,$2,$3,$4)",
                        [login_type_id, uid, userNo, userInfo.userData]
                    );
                } else {
                    console.info("有遊客紀錄，轉至新的sso user 並創user_login_type");
                    uid = lastUserInfo.uid;
                    await sql.query("update users set user_type_id = $1,name = $2,sex = $3 where id = $4", [
                        user_type_id,
                        cName,
                        sex,
                        uid,
                    ]);
                    await sql.query(
                        "insert into user_login_type(login_type_id,user_id,auth_id,user_info_json) values($1,$2,$3,$4)",
                        [login_type_id, uid, userNo, userInfo.userData]
                    );
                    clearGuest = true;
                }
            } else {
                //若有user_id 不管有無遊客，都直接轉成登入的狀態紀錄，即不做處理
                let parsedOriginal = {};

                try {
                    parsedOriginal = typeof originalJson === 'string' ? JSON.parse(originalJson) : originalJson || {};
                } catch (e) {
                    console.error("createSSO JSON parse error", e);
                    parsedOriginal = {};
                }
                const updatedJson = {
                    ...parsedOriginal,
                    ...userData,
                };
                await sql.query(
                    "update user_login_type set user_info_json = $1 where login_type_id = $2 and auth_id = $3",
                    [JSON.stringify(updatedJson), login_type_id, userNo]
                );
            }
            await sql.query("COMMIT");

            rs = await sql.query("select type_value from login_type where id = $1", [login_type_id]);
            const login_type_value = rs.rows[0]?.type_value;
            resolve({
                clearGuest: clearGuest,
                data: {
                    id: uid,
                    name: cName,
                    avatar: null,
                    sex: sex,
                    user_type: user_type,
                    login_type: login_type,
                    is_enable: is_enable,
                    login_info: {
                        [login_type_value]: userInfo.userData,
                    },
                    auth_id: {
                        [login_type_value]: userNo,
                    },
                    uid: uid,
                    nickname: cName,
                    user_no: userNo,
                },
            });
        } catch (error) {
            await sql.query("ROLLBACK");
            reject(error);
        }
    });
}

async function getGuestEnable() {
    try {
        let rs = await sql.query("select value from settings where key = 'guest_enable'");
        let guest_enable = rs.rows[0].value;
        if (guest_enable === "0") {
            return false;
        } else if (guest_enable === "1") {
            return true;
        }
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function ssoMiddleware(req, res, next) {
    //     if(!req.session.userInfo){
    //         req.session.userInfo = {
    //             companyId: "icsc",
    //             userId: "admin",
    //             chineseName: "測試用帳號",
    //             englishName: "",
    //             authorityGroup: null,
    //             userData:
    //                 '{"idType":"E","birthday":"19970101","sex":"1","compNo":"icsc","userNo":"admin","postNo":"","eMail":"","cName":"測試用帳號","depNo":"S22","subCompNo":"","city":"","eName":""}',
    //             sub: "admin",
    //             iat: 1910146276,
    //         };

    //     }
    //     next();
    // }
    // function ssoMiddleware1(req, res, next) {
    try {
        let relogin_url = `${casUrl}/web/login?service=${serviceUrl}&ci=${ci}`;
        // if (req.headers.host.includes("localhost:8081")) {
        //     return next();
        // }
        //之後拿掉這if 為了可以重構資料庫

        if (
            req.url.startsWith("/backend/system/db") ||
            req.url.startsWith("/backend/system/sss") ||
            req.url.startsWith("/backend/system/getSettings") ||
            req.url.startsWith("/backend/system/getUserPermission")
        ) {
            return next();
        }
        if (
            req.url.startsWith("/backend/datasets/updateFileState") ||
            req.url.startsWith("/backend/crawler/updateFileState") ||
            req.url.startsWith("/backend/datasets/uploadText") ||
            (req.url.startsWith("/backend/system/version") && req.method === "GET")
        ) {
            return next();
        }

        if (req.url.startsWith("/backend/clientsets/bulletin") || req.url.startsWith("/backend/system/version")) {
            return next();
        }

        // 下載檔案有帶token
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

        if (req.url.includes("/download")) {
            return next();
        }

        const apiKey = req.headers["api-key"];
        if (apiKey && (await validateApiKey(apiKey))) {
            return next();
        }

        // 這次有ticket代表是cas跳轉回來;
        // 這次有ticket代表是cas跳轉回來;
        if (req.query.ticket) {
            const params = new FormData();
            params.append("ticket", req.query.ticket);
            params.append("service", serviceUrl);
            params.append("ci", ci);
            params.append("sessionId", req.sessionID);

            axios.post(`${casUrl}/rest/validate`, params).then(async (response) => {
                try {
                    if (response.status === 200 && response.data.status === "success") {
                        let token = response.data.t;
                        let userInfo = jwt.decode(token);
                        req.session.userType = "member";
                        // req.session.userInfo = userInfo;
                        const lastUserInfo = req.session.userInfo;
                        createSSO(userInfo, lastUserInfo)
                            .then((rs) => {
                                req.session.userInfo = rs.data;
                                //若clearGuest為true，則代表要清除遊客session
                                if (rs.clearGuest) {
                                    res.clearCookie("ava-guest");
                                }
                                res.redirect(clientUrl);
                            })
                            .catch((err) => {
                                console.error(err.message);
                            });
                    } else {
                        res.status(401).json({ Location: relogin_url });
                    }
                } catch (error) {
                    console.error(error);
                }
            });
        } else if (!req.session.userInfo) {
            res.status(401).json({ Location: relogin_url });
        } else if (isExpired(req.session.userInfo)) {
            res.status(401).json({ Location: relogin_url });
        } else {
            //根據資料庫是否禁止遊客，如果禁止，遊客session進來要剔除
            getGuestEnable().then((guest_enable) => {
                if (!guest_enable && req.session.userType === "guest") {
                    res.clearCookie("ava-guest");
                    res.clearCookie("s_id");
                    return res.status(401).json({ Location: relogin_url });
                } else {
                    return next();
                }
            });
        }
    } catch (error) {
        console.error(error);
    }
}

module.exports = ssoMiddleware;
