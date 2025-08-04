"use strict";
const express = require("express");
const axios = require("axios");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const sql = require("../db/pgsql");
const CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL = process.env.CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL;
const CUSTOM_AUTH_VALIDATE_URL = process.env.CUSTOM_AUTH_VALIDATE_URL;
const CHAT_CLIENT_SSO_REDIRECT = process.env.CHAT_CLIENT_SSO_REDIRECT;

router.get("/login", async (req, res) => {
    try {
        // 重新生成session
        req.session.regenerate((err) => {
            if (err) {
                console.error("Error regenerating session:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            // 繼續執行登入邏輯
            handleLogin(req, res);
        });
    } catch (error) {
        console.error("Error in login route:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
async function handleLogin(req, res) {
    try {
        // 把 req.query 裡的參數取出來
        const params = req.query;

        // 取出 auth_id 不需要放入 auth_meta
        const { auth_id, ...remainingParams } = params;

        // 拿出 auth_meta 並轉成物件
        let auth_meta = params.auth_meta ? JSON.parse(params.auth_meta) : {};

        // 將剩下的參數放入 auth_meta
        auth_meta = { ...auth_meta, ...remainingParams };

        const data = {
            auth_id,
            auth_meta,
        };

        const response = await axios.post(`${CUSTOM_AUTH_VALIDATE_URL}`, data);

        console.log("customAuth.js response", response.data);
        // 如果回應的狀態碼不是 200，就回傳 401 給前端，重新導向。
        if (response.status !== 200 || response.data.result !== true) {
            console.log("customAuth.js response", response.data);
            return res.redirect(CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL);
        }

        try {
            // 從 response 裡取出需要的資料
            const { auth_meta, auth_id, name, department_id } = response.data.data;

            // 回傳資料給前端
            const rs = await createSSO({ auth_meta, auth_id, name, department_id });

            req.session.userType = "member";
            req.session.userInfo = rs.data;

            // 使用 await 確保 session 保存完成
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 檢查網址有沒有帶 redirect_url
            const redirectUrl = req.query.redirect_url || CHAT_CLIENT_SSO_REDIRECT;
            if (req.query.redirect_url) {
                res.redirect(redirectUrl);
            } else {
                res.status(200).json({ status: true, message: "ok" });
            }
        } catch (error) {
            console.error("createSSO 發生錯誤:", error);
            res.status(500).send("Server Error");
        }
    } catch (error) {
        console.error("Error validating user:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function createSSO(cookies) {
    return new Promise(async (resolve, reject) => {
        try {
            const user_type = "member";
            const login_type = "dragon_steel_sso";
            let rs;
            rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;
            rs = await sql.query("select id from login_type where type_value = $1", [login_type]);
            const login_type_id = rs.rows[0]?.id;

            let { auth_meta, auth_id, name, department_id } = cookies;
            console.log("cookies", cookies);
            await sql.query("BEGIN");

            // 傳進來的變數範例
            // response.data.data : {
            //     auth_id: 'AVATEST',
            //     auth_meta: {
            //         redirect_url: 'http://avat.cdgs.com.tw/ava/back',
            //         guid: 'AVATEST',
            //         sid: 'DAlYcgDRk1n9NSHZXxxxxxx',
            //         auth_meta: '{"guid":"AVATEST","sid":"DAlYcgDRk1n9NSHZXxxxxxx","toService":"avaBack","gcid":"0016","cip":"10.0.118.182"}',
            //         postNo: '34',
            //         toService: 'avaBack',
            //         empNo: 'AVATEST',
            //         cName: 'AVA測試帳號',
            //         access_key: 'DAlYcgDRk1n9NSHZXxxxxxx',
            //         depNo: '',
            //         gcid: '0016',
            //         cip: '10.0.118.182'
            //     },
            //     department_id: '',
            //     name: 'AVA測試帳號'
            // }

            //用指定登入模式為sso與他的辨識id 搜索user_id

            rs = await sql.query(
                "select a.user_id, a.user_info_json, b.is_enable from user_login_type a left join users b on a.user_id = b.id where login_type_id = $1 and auth_id = $2",
                [login_type_id, auth_id]
            );
            const is_enable = rs.rows[0]?.is_enable + "";
            const originalJson = rs.rows[0]?.user_info_json || {};

            // user_id 是 uuid 產出來的
            let user_id = rs.rows[0]?.user_id;

            // 沒有 user_id 就新增使用者
            if (!user_id) {
                user_id = uuidv4();

                console.info("無使用者，建立 users 與 user_login_type");
                rs = await sql.query("insert into users(id,user_type_id,name,department_id) values($1,$2,$3,$4)", [
                    user_id,
                    user_type_id,
                    name,
                    department_id,
                ]);
                await sql.query(
                    "insert into user_login_type(login_type_id,user_id,auth_id,user_info_json) values($1,$2,$3,$4)",
                    [login_type_id, user_id, auth_id, auth_meta]
                );
            } else {
                // 有 user_id 將 user_id 取出送至 session
                console.info("有使用者，轉至新的 sso user 並創 user_login_type");
                let parsedOriginal = {};
                let safeAuthMeta = {};

                try {
                    parsedOriginal = typeof originalJson === 'string' ? JSON.parse(originalJson) : originalJson || {};
                    safeAuthMeta = typeof auth_meta === 'string' ? JSON.parse(auth_meta) : auth_meta || {};
                } catch (e) {
                    console.error("createSSO JSON parse error", e);
                    parsedOriginal = {};
                    safeAuthMeta = {};
                }
                const updatedJson = {
                    ...parsedOriginal,
                    ...safeAuthMeta,
                };
                await sql.query(
                    "update user_login_type set user_info_json = $1 where login_type_id = $2 and auth_id = $3",
                    [JSON.stringify(updatedJson), login_type_id, auth_id]
                );
            }
            await sql.query("COMMIT");

            rs = await sql.query("select type_value from login_type where id = $1", [login_type_id]);
            const login_type_value = rs.rows[0]?.type_value;

            resolve({
                data: {
                    id: user_id,
                    name: name,
                    avatar: null,
                    sex: "",
                    user_type: user_type,
                    login_type: login_type,
                    is_enable: is_enable,
                    login_info: {
                        [login_type_value]: auth_meta,
                    },
                    auth_id: {
                        [login_type_value]: auth_id,
                    },
                    uid: user_id,
                    nickname: name,
                    user_no: auth_id,
                },
            });
        } catch (error) {
            await sql.query("ROLLBACK");
            reject(error);
        }
    });
}

// router.get("/auth", async (req, res) => {
//     try {
//         // 把 req.query 裡的參數取出來
//         const params = req.query;

//         console.log("params", params);

//         // 用 axios 發送 POST 請求到驗證的網址
//         const response = await axios.post(CUSTOM_AUTH_VALIDATE_URL, params);

//         // 如果回應的狀態碼不是 200，就回傳 401 給前端，重新導向。
//         if (response.status !== 200) {
//             return res.status(401).json({ Location: CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL });
//         }

//         // 從 response 裡取出需要的資料
//         const { user_info_json, auth_id, name, dep_id } = response.data;

//         // Return the data to the frontend
//         res.json({
//             user_info_json,
//             auth_id,
//             name,
//             dep_id,
//         });
//     } catch (error) {
//         console.error("Error validating user:", error.message);
//         res.status(500).json({ error: "Internal Server Error" });
//     }
// });

module.exports = router;
