require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
const axios = require("axios");
const FormData = require("form-data");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const sql = require("../db/pgsql");


const clientUrl = process.env.CHAT_CLIENT_SSO_REDIRECT || "";

async function createGuest() {
    return new Promise(async (resolve, reject) => {
        try {
            // 嘗試查詢 users 表來檢查是否存在
            try {
                const uuid = uuidv4();
                const user_type = "guest";
                let rs;
                rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
                const user_type_id = rs.rows[0]?.id;

                await sql.query("SELECT 1 FROM users LIMIT 1");
                // 如果查詢成功，則嘗試插入遊客資料
                rs = await sql.query("SELECT id FROM users WHERE id = $1", [uuid]);
                if (rs.rows.length === 0) {
                    await sql.query("INSERT INTO users(id, user_type_id) VALUES($1, $2)", [uuid, user_type_id]);
                }
                resolve({
                    uid: uuid,
                    nickname: "遊客",
                    user_no: "guest",
                    sex: "1",
                    avatar: null,
                    user_type: user_type,
                });
            } catch (error) {
                // 如果查詢失敗，可能是因為表不存在，這裡捕捉錯誤但不進行操作
                console.log("Table 'users' may not exist or database not ready. Skipping insert.");
            }
        } catch (error) {
            reject(error.message);
        }
    });
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
    let rs = await sql.query("select value from settings where key = 'guest_enable'");
    let guest_enable = rs.rows[0].value;
    if (guest_enable === "0") {
        return false;
    } else if (guest_enable === "1") {
        return true;
    }
}
async function authMiddleware(req, res, next) {
  
    if (req.headers["api-key"] && req.headers["api-key"] === "e9e46c13-3365-457a-bc18-3032c30ad94e") {
        try {
            const userInfo = await createWebApiKey("e9e46c13-3365-457a-bc18-3032c30ad94e");
            req.session.userType = "webapi";
            req.session.userInfo = userInfo;
            req.session.save();
            return next();
        } catch (error) {
            console.error(error.message);
        }
    }
    if (req.url.startsWith("/decode")) {
        next();
        return;
    }
    // if (req.url.startsWith("/chat/log/filenames") || req.url.startsWith("/chat/log/file")) {
    //     return next();
    // }
    // console.error("middle");
    try {
        if (!req.session.userType) {
            console.log("req.session.userType: ", req.session.userType);
            // cas.bounce(req, res);
            // let redirectUrl = `${casUrl}/web/login?service=${serviceUrl}&ci=${ci}`;
            // res.json({ redirectUrl: redirectUrl });
            // res.redirect(`${casUrl}/web/login?service=${serviceUrl}&ci=${ci}`); //axios無法取得302前端不會自己轉
            // res.header("Location", `${casUrl}/web/login?service=${serviceUrl}&ci=${ci}`);
            if (req.url.endsWith("/s")) {
                // home
                return next();
            } else {
                //根據資料庫設定決定是否 無session時先預設遊客身分
                const guest_enable = await getGuestEnable();
                if (!guest_enable) return res.status(401).json({ Location: relogin_url });

                req.session.userType = "guest";
                if (req.cookies["ava-guest"]) {
                    req.session.userInfo = JSON.parse(req.cookies["ava-guest"]);
                    return next();
                } else {
                    createGuest()
                        .then(async (rs) => {
                            req.session.userInfo = rs;
                            res.cookie("ava-guest", JSON.stringify(rs));
                            req.cookies["ava-guest"] = JSON.stringify(rs);
                            return next();
                        })
                        .catch((err) => {
                            console.error(err.message);
                        });
                }
            }
        } else {
            
            return next();
        }
    } catch (error) {
        console.error(error);
    }
}

module.exports = authMiddleware;
