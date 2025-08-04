"use strict";
const express = require("express");
const router = express.Router();
const axios = require("axios"); // 用於發送 HTTP 請求
const sql = require("../db/pgsql"); // 確保正確引入 sql 模塊
const passport = require("passport");
const OAuth2Strategy = require("passport-oauth2").Strategy;
const { v4: uuidv4 } = require("uuid");

const clientUrl = process.env.CHAT_CLIENT_SSO_REDIRECT || "";
const authorizationURL = process.env.OAUTH2_AUTHORIZATION_URL || "";
const tokenURL = process.env.OAUTH2_TOKEN_URL || "";
const clientID = process.env.OAUTH2_CLIENT_ID || "";
const clientSecret = process.env.OAUTH2_CLIENT_SECRET || "";
const callbackURL = process.env.OAUTH2_CALLBACK_URL || "";
const userInfoURL = process.env.OAUTH2_USER_INFO_URL || "";
const logoutURL = process.env.OAUTH2_LOGOUT_URL || "";

router.use(passport.initialize());
router.use(passport.session());
// 配置 Passport 序列化和反序列化用戶
passport.serializeUser(function (user, done) {
    console.log("serializeUser: ", user.id);
    done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
    try {
        console.log("deserializeUser: ", id);
        let rs = await sql.query("SELECT * FROM users WHERE id = $1", [id]);
        if (rs.rows.length > 0) {
            done(null, rs.rows[0]);
        } else {
            done(new Error("User not found"));
        }
    } catch (err) {
        done(err);
    }
});

// 配置 Passport OAuth2Strategy
passport.use(
    new OAuth2Strategy(
        {
            authorizationURL: authorizationURL,
            tokenURL: tokenURL,
            clientID: clientID,
            clientSecret: clientSecret,
            callbackURL: callbackURL,
            passReqToCallback: true, // 允許傳遞 req 對象到回調函數中
        },
        async function (req, accessToken, refreshToken, params, profile, cb) {
            try {
                // console.log('req: ',req);
                // console.log('accessToken: ',accessToken);
                // console.log('refreshToken: ',refreshToken);
                // console.log('params: ',params);
                // console.log('profile: ',profile);
                // 使用 accessToken 獲取用戶信息
                const userInfoResponse = await axios.get(userInfoURL, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
                const userInfo = userInfoResponse.data;
                console.log("userInfo: ", userInfo);
                // 新增accessToken 到 userInfo
                userInfo.accessToken = accessToken;
                console.log("userInfo accessToken: ", userInfo);
                // 建立用戶
                createCSC(userInfo)
                    .then((rs) => {
                        return cb(null, rs.data);
                    })
                    .catch((err) => {
                        console.error(err.message);
                        return cb(err.message);
                    });
            } catch (err) {
                return cb(err);
            }
        }
    )
);

// 配置 OAuth 路由
router.get("/", passport.authenticate("oauth2"));
router.get("/callback", (req, res, next) => {
    passport.authenticate("oauth2", (err, user, info) => {
        // console.log("user: ", user);
        // console.log("info: ", info);
        if (err) {
            return next(err);
        }
        // if (!user) {
        //     // return res.redirect("http://localhost:5000/ava/avaClient/");
        //     return res.redirect(clientUrl);
        // }
        const userInfo = { ...user, iat: new Date().getTime() };
        req.session.userType = "member";
        req.session.userInfo = userInfo;
        req.session.save();
        return res.redirect(clientUrl);

        // req.logIn(user, (err) => {
        //     if (err) {
        //         return next(err);
        //     }
        //     // 認證成功，重定向到首頁或其他頁面

        //     // res.redirect("http://localhost:5000/ava/avaClient/");
        //     return res.redirect(clientUrl);
        // });
    })(req, res, next);
});

async function createCSC(userInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            const user_type = "member";
            const login_type = "csc_sso";
            let rs;
            rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;
            rs = await sql.query("select id from login_type where type_value = $1", [login_type]);
            const login_type_id = rs.rows[0]?.id;
            let { uid, chineseName, warning, title, deptNo, telNo, email, cid } = userInfo;
            await sql.query("BEGIN");

            //用指定登入模式為sso與他的辨識id 搜索user_id
            // let uid;
            rs = await sql.query(
                "select a.user_id,b.is_enable from user_login_type a left join users b on a.user_id = b.id where login_type_id = $1 and auth_id = $2",
                [login_type_id, uid]
            );
            const is_enable = rs.rows[0]?.is_enable + "";
            let user_id = rs.rows[0]?.user_id;

            if (!user_id) {
                user_id = uuidv4();
                console.info("無遊客，建立users 與 user_login_type");
                rs = await sql.query("insert into users(id,user_type_id,name) values($1,$2,$3)", [
                    user_id,
                    user_type_id,
                    chineseName,
                ]);
                await sql.query(
                    "insert into user_login_type(login_type_id,user_id,auth_id,user_info_json) values($1,$2,$3,$4)",
                    [login_type_id, user_id, uid, JSON.stringify(userInfo)]
                );
            }
            await sql.query("COMMIT");

            rs = await sql.query("select type_value from login_type where id = $1", [login_type_id]);
            const login_type_value = rs.rows[0]?.type_value;
            console.log("createCSC userInfo: ", userInfo);
            resolve({
                data: {
                    id: user_id,
                    name: chineseName,
                    avatar: null,
                    sex: "",
                    user_type: user_type,
                    login_type: login_type,
                    is_enable: is_enable,
                    login_info: {
                        [login_type_value]: userInfo,
                    },
                    auth_id: {
                        [login_type_value]: uid,
                    },
                    uid: user_id,
                    nickname: chineseName,
                    user_no: uid,
                },
            });
        } catch (error) {
            await sql.query("ROLLBACK");
            reject(error);
        }
    });
}

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

module.exports = router;
