const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const otplib = require("otplib");
const platform = require("platform");
const crypto = require("crypto");

const TwoFactorAuthentication = require("../../orm/schema/two_factor_authentication");
const LoginType = require("../../orm/schema/login_type.js");
const TwoFactorAuthHistory = require("../../orm/schema/two_factor_auth_history");
const BanIp = require("../../orm/schema/ban_ip");
const BanIpHistory = require("../../orm/schema/ban_ip_history");
let { redisClient } = require("../../global/redisStore.js");

const { comparePWD, encryption } = require("../../utils/encryption.js");
const { loginRecord, getLoginTypeID } = require("../../utils/common.js");

const TWO_FACTOR_AUTHENTICATION_KEY = process.env.TWO_FACTOR_AUTHENTICATION_KEY;

otplib.authenticator.options = {
    step: 30, // OTP 有效 30 秒
    window: 2, // 容錯範圍為前後 1 個時間片
};

function decryptTwoFactorSecret(encryptedText, key) {
    const decipher = crypto.createDecipheriv("aes-256-ecb", Buffer.from(key, "hex"), null);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

exports.getInfo = async function (req, res) {
    let rsmodel = new responseModel();
    // console.log("getInfo " + req.sessionID);
    try {
        const userInfo = req.session.userInfo;
        console.log("userInfo", userInfo);
        let rs = await sql.query("select name from users where id = $1", [userInfo.uid]);
        if (!rs.rows[0]) {
            req.session.destroy((err) => {
                if (err) {
                    console.error("清除session時發生錯誤:", err);
                }
            });
            return res.clearCookie("ava-guest").clearCookie("s_id").send("Session cleared successfully!");
        } else {
            userInfo.user_type = req.session.userType;
            if (rs.rows[0].name) {
                userInfo.name = rs.rows[0].name;
                userInfo.nickname = rs.rows[0].name;
            }
            rsmodel.code = 0;
            rsmodel.data = userInfo;
            return res.json(rsmodel);
        }

        // let rs = await sql.query("select id uid,nickname,avatar,sex,user_no from users where user_no=$1", [userNo]);
        // if (!rs) {
        //     try {

        //         let userData = JSON.parse(req.session.userInfo.userData);
        //         let uuid = uuidv4();
        //         let { cName, userNo, postNo, depNo, idType, compNo, eMail, sex, birthday } = userData;
        //         let sqlStr = "insert into users(id,user_type_id) values($1,$2)";
        //         let sqlParam = [uuid, 1];
        //         let chk = await sql.query(sqlStr, sqlParam);
        //         if (chk.rowCount == 1) {
        //             console.log(`工號 ${userNo} 第一次加入資料庫`);
        //             rs = { uid: uuid, nickname: cName, avatar: null };
        //         }
        //         if (chk.rowCount === 1) {
        //             console.log("新遊客加入");
        //             rs = { uid: userInfo.userId, nickname: "遊客2222", avatar: null };
        //         }
        //     } catch (e) {
        //         console.log(e.detail);
        //     }
        // }
        // req.session.userInfo = userInfo;
        // req.session.userInfo.uid = rs.uid;
        // req.session.userInfo.nickname = rs.nickname;
        // req.session.userInfo.avatar = rs.avatar;
        // req.session.userInfo.sex = rs.sex;
        // req.session.userInfo.user_no = rs.user_no;
    } catch (e) {
        console.error(e.message);
        rsmodel.message = e.message;
        return res.json(rsmodel);
    }
};
exports.login = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { login_type } = JSON.parse(req.body);
        let relogin_url;
        //如果是遊客才能登入
        if (req.session.userType === "guest") {
            switch (login_type) {
                // 1 => sso
                case "icsc_sso":
                    const casUrl = process.env.CAS_URL;
                    const serviceUrl = encodeURIComponent(process.env.CHAT_SERVER_SSO);
                    const ci = "erp";
                    relogin_url = `${casUrl}/web/login?service=${serviceUrl}&ci=${ci}`;
                    return res.status(401).json({ Location: relogin_url });
                case "csc_sso":
                    relogin_url = `${process.env.CSC_SSO_URL}`;
                    return res.status(401).json({ Location: relogin_url });
            }
        } else {
            rsmodel.code = 0;
            rsmodel.message = "已登入";
        }
    } catch (error) {
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.logout = async function (req, res) {
    req.session.save(() => {
        req.session.destroy(async (err) => {
            if (err) {
                console.error("Error destroying session:", err);
                return res.status(500).send("登出失敗");
            } else {
                try {
                    res.clearCookie("s_id");
                    res.clearCookie("PUBLIC_APP_USER_SSO_TOKEN");

                    const SSO_TYPE = process.env.SSO_TYPE;

                    if (SSO_TYPE.toLowerCase() === "kcg") {
                        return res.send({
                            SSO_TYPE: SSO_TYPE,
                            Location: process.env.KCG_SSO_LOGOUT_URL,
                        });
                        // const kcgSSOLogoutURL = process.env.BACK_KCG_SSO_LOGOUT_URL;
                        // return res.redirect(302, kcgSSOLogoutURL);
                    } else {
                        return res.send("登出成功");
                    }
                } catch (error) {
                    console.error("登出時發生錯誤", error);
                }
            }
        });
    });
};

exports.KSGLogin = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const data = JSON.parse(Buffer.from(req.body, "base64").toString("utf-8"));
        console.log("驗證KSG資訊", data);

        // 取得使用者 IP 地址，處理多個 IP 的情況
        const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress)
            .split(",")[0]
            .replace(/^::ffff:/, "")
            .replace(/^::1$/, "127.0.0.1");

        // 檢查 Redis 是否已達到錯誤次數上限
        const redisKey = `login_attempts:${ip}`;
        const attempts = await redisClient.get(redisKey);
        if (attempts === null) {
            await redisClient.set(redisKey, "1");
            await redisClient.expire(redisKey, 1800); // 30分鐘 = 1800秒
        }
        console.log("attempts: ", attempts);
        console.log("redisKey: ", redisKey);

        if (attempts && attempts >= 5) {
            const redisTriggerKey = `login_attempts:triggered:${ip}`;
            const hasTriggered = await redisClient.get(redisTriggerKey);
            if (!hasTriggered) {
                const userAgent = req.headers["user-agent"];
                const deviceInfo = platform.parse(userAgent);
                const nowDevice = `OS: ${deviceInfo.os.family}, Browser: ${deviceInfo.name}`;
                const expiredTime = new Date(Date.now() + 30 * 60 * 1000); // 現在時間加上30分鐘
                try {
                    // 先查詢 BanIp 是否存在
                    const existingBanIp = await BanIp.findOne({
                        where: { ip: ip },
                    });

                    const banIpData = {
                        ip: ip,
                        device: nowDevice,
                        status: "temporary",
                        type: "system_login_attempts",
                        expired_time: expiredTime,
                        operator: "system",
                    };

                    if (existingBanIp) {
                        // 如果存在就更新
                        await existingBanIp.update(banIpData);
                    } else {
                        // 不存在就新增
                        await BanIp.create(banIpData);
                    }

                    // 新增 BanIpHistory 記錄
                    await BanIpHistory.create({
                        ip: ip,
                        device: nowDevice,
                        status: "temporary",
                        type: "system_login_attempts",
                        expired_time: expiredTime,
                        operator: "system",
                        action: "create",
                    });

                    const redisAccessIpKey = `access_control:ip:${ip}`;
                    await redisClient.set(redisAccessIpKey, "100000000000000");
                    await redisClient.expire(redisAccessIpKey, 1800);

                    await redisClient.set(redisTriggerKey, "1");
                    await redisClient.expire(redisTriggerKey, 1800); // 30分鐘 = 1800秒
                } catch (e) {
                    console.error("登入嘗試過多，封鎖IP時發生錯誤", e);
                }
            }
            rsmodel.code = 403;
            rsmodel.message = "登入嘗試次數過多，請稍後再試。";
            return res.json(rsmodel);
        }

        let rs = await sql.query("select * from users where account = $1", [data.account]);

        if (rs.rows[0]) {
            const isSamePWD = await comparePWD(data.password, rs.rows[0].password);

            if (isSamePWD) {
                console.log("KSG登入驗證成功 !");

                // 檢查是否是第一次登入
                const checkFirstLogin = await sql.query(
                    "select is_login_before,update_time from user_password_history where user_id = $1",
                    [rs.rows[0].id]
                );

                if (checkFirstLogin.rows.length === 0) {
                    rsmodel.code = 403;
                    rsmodel.message = "使用者登入資料異常。";
                    console.error("Can't find user data in user_password_history.");
                    return res.json(rsmodel);
                }
                if (checkFirstLogin.rows[0].is_login_before === 0) {
                    rsmodel.code = 403;
                    rsmodel.message = "It is your first to here, please change your password first.";
                    rsmodel.data = { isLoginBefore: checkFirstLogin.rows[0].is_login_before };
                    return res.json(rsmodel);
                }

                // 重置 Redis 中該 IP 的登入錯誤次數
                await redisClient.del(redisKey);

                // 登入成功處置
                let userInfo = {};
                userInfo.uid = rs.rows[0].id;
                userInfo.nickname = rs.rows[0].name;
                userInfo.avatar = rs.rows[0].avatar;
                userInfo.sex = null;

                // 取得登入方式ID並儲存
                const loginTypeID = await getLoginTypeID("system");

                req.session.userType = "member";
                req.session.userInfo = userInfo;
                req.session.justLogin = true;
                req.session.loginType = loginTypeID;
                req.session.isKSGLogin = true; // 臨時通關用的標記

                // 將登入紀錄到表中
                loginRecord(rs.rows[0].id, loginTypeID, rs.rows[0].name);

                // 查詢 auth_id 和 type_name
                const typeData = await sql.query(
                    `SELECT 
                        (SELECT type_name FROM user_type WHERE id = $1) AS type_name,
                        (SELECT auth_id FROM user_login_type WHERE user_id = $2) AS auth_id
                     `,
                    [rs.rows[0].user_type_id, rs.rows[0].id]
                );

                if (typeData.rows[0]) {
                    userInfo.user_no = typeData.rows[0].auth_id;
                    userInfo.user_type = typeData.rows[0].type_name;
                } else {
                    throw new Error("找不到 auth_id 和 type_name。");
                }

                const lastChangeTime = new Date(checkFirstLogin.rows[0].update_time);
                const now = new Date();
                const timeDifference = now - lastChangeTime;
                const daysDifference = timeDifference / (1000 * 60 * 60 * 24);
                if (daysDifference >= 90) {
                    rsmodel.code = 403;
                    rsmodel.message = "已超過90天未變更密碼。";
                    rsmodel.data = { passwordExpired: true };
                    return res.json(rsmodel);
                }

                rsmodel.data = { userInfo };
                rsmodel.code = 0;
                rsmodel.message = "登入成功";
                return res.json(rsmodel);
            } else {
                // 密碼錯誤，增加 Redis 錯誤次數
                try {
                    await redisClient.set(redisKey, attempts ? parseInt(attempts) + 1 : 1, { EX: 1800 }); // 將過期時間設為 1800 秒（30分鐘）
                } catch (err) {
                    console.error("Failed to set redis key:", err.message);
                }

                rsmodel.code = 401;
                rsmodel.message = "帳號不存在或密碼錯誤";
                return res.json(rsmodel);
            }
        } else {
            // 帳號不存在處置
            console.log("KSGLogin 帳號不存在處置");
            try {
                await redisClient.set(redisKey, attempts ? parseInt(attempts) + 1 : 1, { EX: 1800 }); // 設置 30 分鐘的過期時間
            } catch (err) {
                console.error("Failed to set redis key:", err.message);
            }

            rsmodel.code = 401;
            rsmodel.message = "帳號不存在或密碼錯誤";
            return res.json(rsmodel);
        }
    } catch (e) {
        console.error("高市府登入驗證過程有問題", e.message);
        rsmodel.code = 403;
        rsmodel.message = "高市府登入驗證過程有問題";
        return res.json(rsmodel);
    }
};

exports.KSGChangePassword = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const data = JSON.parse(Buffer.from(req.body, "base64").toString("utf-8"));

        // 檢查密碼格式
        const isValidLength = data.password.length >= 8;
        const hasUpperCase = /[A-Z]/.test(data.password);
        const hasLowerCase = /[a-z]/.test(data.password);
        const hasNumber = /\d/.test(data.password);
        const hasSpecialChar = /[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(data.password);
        const isAllowedWords = /^[A-Za-z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*$/.test(data.password);

        if (!isValidLength || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar || !isAllowedWords) {
            rsmodel.code = 403;
            rsmodel.message = "密碼格式錯誤。";
            return res.json(rsmodel);
        }

        // 比對是否和前3次的密碼重複
        let sqlText = "";
        let sqlValue = [];
        if (data.account) {
            sqlText =
                "SELECT uph.* FROM user_password_history uph JOIN users u ON uph.user_id = u.id WHERE u.account = $1";
            sqlValue.push(data.account);
        } else {
            sqlText = "SELECT uph.* FROM user_password_history uph JOIN users u ON uph.user_id = u.id WHERE u.id = $1";
            sqlValue.push(data.uid);
        }
        const rs = await sql.query(sqlText, sqlValue);

        if (rs.rows.length === 0) {
            rsmodel.code = 401;
            rsmodel.message = "使用者帳號資訊異常。";
            console.error("Can't find user data in user_password_history.");
            return res.json(rsmodel);
        }

        const {
            user_id: userID,
            old_password_1: oldPWD1,
            old_password_2: oldPWD2,
            old_password_3: oldPWD3,
        } = rs.rows[0];

        // 比對密碼和前3次是否重複
        const [isSamePWD1, isSamePWD2, isSamePWD3] = await Promise.all([
            comparePWD(data.password, oldPWD1),
            oldPWD2 ? comparePWD(data.password, oldPWD2) : false,
            oldPWD3 ? comparePWD(data.password, oldPWD3) : false,
        ]);

        if (isSamePWD1 || isSamePWD2 || isSamePWD3) {
            rsmodel.code = 403;
            rsmodel.message = "密碼不可與前3次設定相同。";
            return res.json(rsmodel);
        }

        // 如果密碼沒重複，進行密碼更新
        const hashPWD = await encryption(data.password);
        await sql.query(
            "UPDATE user_password_history SET old_password_1 = $1, old_password_2 = $2, old_password_3 = $3, is_login_before = 1, update_time = NOW() WHERE user_id = $4;",
            [hashPWD, oldPWD1, oldPWD2, userID]
        );

        await sql.query("UPDATE users SET password = $1 WHERE id = $2;", [hashPWD, userID]);

        rsmodel.code = 0;
        rsmodel.message = "修改密碼成功。";
        return res.json(rsmodel);
    } catch (e) {
        console.error("高市府第一次登入修改密碼過程中發生錯誤。", e.message);
        rsmodel.code = 403;
        rsmodel.message = "修改密碼過程中出現錯誤。";
        return res.json(rsmodel);
    }
};

exports.authentication = async function (req, res) {
    let rsmodel = new responseModel();
    console.log("authentication");

    try {
        const userInfo = req.session.userInfo;
        const uid = userInfo.uid;
        const totp = JSON.parse(req.body).code;
        const record = await TwoFactorAuthentication.findOne({
            where: { user_id: uid },
        });
        const secret = record.dataValues.secret_key;
        const decryptedText = decryptTwoFactorSecret(secret, TWO_FACTOR_AUTHENTICATION_KEY);
        otplib.authenticator.options = {
            step: 30, // OTP 有效 30 秒
            window: 2, // 容錯範圍為前後 1 個時間片
        };
        const isValid = otplib.authenticator.check(totp, decryptedText);
        //更新用資料
        const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress).split(",")[0];
        const userAgent = req.headers["user-agent"];
        const deviceInfo = platform.parse(userAgent);
        const nowDevice = `OS: ${deviceInfo.os.family}, Browser: ${deviceInfo.name}`;
        const now = new Date();

        if (isValid) {
            //驗證成功後，更新last_device、ip、last_auth_time
            await record.update(
                {
                    last_device: nowDevice,
                    ip: ip,
                    last_auth_time: now,
                },
                {
                    fields: ["last_device", "ip", "last_auth_time"],
                }
            );

            //驗證成功後，新增二次驗證成功紀錄進資料庫
            await TwoFactorAuthHistory.create({
                user_id: uid,
                device: nowDevice,
                ip: ip,
                auth_time: now,
            });

            //登入成功後，刪除justLogin session
            try {
                delete req.session.justLogin;
                console.log("justLogin session刪除成功");
            } catch (err) {
                console.log("justLogin session刪除失敗");
            }

            rsmodel.data = { userInfo };
            rsmodel.code = 0;
            rsmodel.message = "TOTP驗證成功，成功登入";
        } else {
            const redisKeyIp = ip.replace(/^::ffff:/, "");
            const redisKey = `two_factor_attempts:${redisKeyIp}`;

            let attempts = await redisClient.get(redisKey);
            attempts = parseInt(attempts) || 0; // 確保 `attempts` 為整數，若為 null 則設為 0

            if (attempts >= 5) {
                rsmodel.code = 403;
                rsmodel.message = "TOTP驗證嘗試次數過多，請稍後再試。";
                return res.json(rsmodel);
            }

            // 更新 Redis 鍵的值並設置過期時間（15 分鐘）
            await redisClient.set(redisKey, attempts + 1, { EX: 15 * 60 });

            console.error("驗證失敗了");
            rsmodel.code = 1;
            rsmodel.message = "TOTP驗證失敗";
            return res.json(rsmodel);
        }
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "二次驗證過程發生錯誤";
    }

    res.json(rsmodel);
};

exports.checkLockButton = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress)
            .split(",")[0]
            .replace(/^::ffff:/, "");
        const redisKey = `two_factor_attempts:${ip}`;

        let attempts = await redisClient.get(redisKey);
        attempts = parseInt(attempts) || 0; // 確保 `attempts` 為整數，若為 null 則設為 0

        if (attempts >= 5) {
            rsmodel.code = 403;
            rsmodel.message = "鎖定二次驗證按鈕";
            return res.json(rsmodel);
        }

        rsmodel.code = 0;
        rsmodel.message = "開啟二次驗證按鈕";
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "判斷是否解鎖二次驗證按鈕時發生錯誤";
    }

    res.json(rsmodel);
};

exports.checkJustTwoFactorAuth = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        if (req.session.justTwoFactorAuth) {
            rsmodel.data = { authorized: true };
            rsmodel.code = 0;
            rsmodel.message = "session中存在justTwoFactorAuth";
        } else {
            rsmodel.data = { authorized: false };
            rsmodel.code = 0;
            rsmodel.message = "session中不存在justTwoFactorAuth";
        }
    } catch (e) {
        console.error("判斷是否有justTwoFactorAuth時出錯", e);
        rsmodel.code = 1;
        rsmodel.message = "判斷是否有justTwoFactorAuth時出錯";
    }

    res.json(rsmodel);
};
