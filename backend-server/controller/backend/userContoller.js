const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const bcrypt = require("bcrypt"); // 假設您已經安裝 bcrypt 套件
const { v4: uuidv4 } = require("uuid");
const otplib = require("otplib");
const QRCode = require("qrcode");
const crypto = require("crypto");
const logRouteDetails = require("../routeNameLog");

const Users = require("../../orm/schema/users");
const LoginType = require("../../orm/schema/login_type");
const UserLoginType = require("../../orm/schema/user_login_type");
const UserPasswordHistory = require("../../orm/schema/user_password_history");
const TwoFactorAuthentication = require("../../orm/schema/two_factor_authentication");

const TWO_FACTOR_AUTHENTICATION_KEY = process.env.TWO_FACTOR_AUTHENTICATION_KEY;

otplib.authenticator.options = {
    step: 30, // OTP 有效 30 秒
    window: 2, // 容錯範圍為前後 1 個時間片
};

function encryptTwoFactorSecret(text, key) {
    const cipher = crypto.createCipheriv("aes-256-ecb", Buffer.from(key, "hex"), null);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return encrypted;
}

function decryptTwoFactorSecret(encryptedText, key) {
    const decipher = crypto.createDecipheriv("aes-256-ecb", Buffer.from(key, "hex"), null);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

exports.updateUser = async function (req, res) {
    logRouteDetails("userController.updateUser", req);
    let rsmodel = new responseModel();
    const uid = req.session.userInfo.uid;
    // const uid = req.body.uid; // 從請求中取得 uid
    // const updateFields = req.body; // 從請求中取得要更新的欄位
    const updateFields = JSON.parse(req.body);
    console.info("userController.updateUser:", updateFields);

    if (!uid) {
        rsmodel.code = 501;
        rsmodel.message = "缺少 uid";
        return res.json(rsmodel);
    }

    // 刪除 uid 欄位
    delete updateFields.uid;

    // 動態產生 SQL 語句
    const keys = Object.keys(updateFields);
    const values = Object.values(updateFields);

    if (keys.length === 0) {
        rsmodel.code = 200;
        rsmodel.message = "沒有要更新的欄位";
        return res.json(rsmodel);
    }

    //keys可被注入先拿掉
    let queryStr = "UPDATE public.users SET ";

    for (let i = 0; i < keys.length; i++) {
        queryStr += `${keys[i]} = $${i + 1}`;
        if (i < keys.length - 1) {
            queryStr += ", ";
        }
    }
    queryStr += ` WHERE id = $${keys.length + 1} RETURNING *`;

    try {
        let rs = await sql.query(queryStr, [...values, uid]);
        if (rs.rowCount === 1) {
            rsmodel.code = 201;
            rsmodel.message = "更新成功";
            rsmodel.data = rs.rows[0]["name"]; // 取得更新後的資料
        } else {
            rsmodel.code = 404;
            rsmodel.message = "未找到該使用者";
        }
    } catch (e) {
        console.error(e);
        rsmodel.code = 400;
        rsmodel.message = "更新失敗";
    }

    res.json(rsmodel);
};

exports.getInfo = async function (req, res) {
    logRouteDetails("userController.getInfo", req);
    let rsmodel = new responseModel();
    try {
        const userInfo = req.session.userInfo;
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
        }
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = e.message;
    }
    res.json(rsmodel);
};

exports.logout = async function (req, res) {
    logRouteDetails("userController.logout", req);
    req.session.save(() => {
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                return res.status(500).send("登出失敗");
            } else {
                // 清除應用系統的 Cookie
                try {
                    res.clearCookie("s_id");
                    res.clearCookie("PUBLIC_APP_USER_SSO_TOKEN");

                    const SSO_TYPE = process.env.SSO_TYPE;

                    if (SSO_TYPE.toLowerCase() === "kcg") {
                        return res.send({
                            SSO_TYPE: SSO_TYPE,
                            Location: process.env.BACK_KCG_SSO_LOGOUT_URL,
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

exports.changePassword = async function (req, res) {
    logRouteDetails("userController.changePassword", req);
    let rsmodel = new responseModel();
    try {
        const reqBody = JSON.parse(req.body);
        const pwd = atob(reqBody.pwd);
        const uid = reqBody.uid;
        console.info("userController.changePassword:", reqBody);

        // 檢查密碼格式
        const isLongEnough = pwd.length >= 8; // 檢查長度
        const hasUpperCase = /[A-Z]/.test(pwd); // 檢查大寫字母
        const hasLowerCase = /[a-z]/.test(pwd); // 檢查小寫字母
        const hasNumber = /\d/.test(pwd); // 檢查數字
        const hasSpecialChar = /[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(pwd); // 檢查特殊符號
        const allowedChars = /^[A-Za-z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*$/.test(pwd); // 檢查例外字元

        const validPassword =
            isLongEnough && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar && allowedChars;

        if (!validPassword) {
            rsmodel.code = 1;
            rsmodel.message = "密碼格式錯誤。";
            return res.json(rsmodel);
        }

        // 檢查密碼是否與前3次重複
        let rs = await sql.query(`select * from user_password_history where user_id = $1`, [uid]);

        if (rs.rows.length) {
            // 檢查密碼和前3是是否重複
            const userID = rs.rows[0].user_id;
            const oldPWD1 = rs.rows[0].old_password_1;
            const oldPWD2 = rs.rows[0].old_password_2;
            const oldPWD3 = rs.rows[0].old_password_3;

            let isSamePWD = await bcrypt.compare(pwd, oldPWD1);
            if (!isSamePWD && oldPWD2) {
                isSamePWD = await bcrypt.compare(pwd, oldPWD2);
            }
            if (!isSamePWD && oldPWD3) {
                isSamePWD = await bcrypt.compare(pwd, oldPWD3);
            }

            if (isSamePWD) {
                rsmodel.code = 1;
                rsmodel.message = "密碼不可與前3次設定相同。";
                return res.json(rsmodel);
            }

            const hashPWD = await bcrypt.hash(pwd, 10);

            await sql.query(
                "UPDATE user_password_history SET old_password_1 = $1, old_password_2 = $2, old_password_3 = $3, is_login_before = 1,update_time = NOW() WHERE user_id = $4;",
                [hashPWD, oldPWD1, oldPWD2, userID]
            );

            await sql.query("UPDATE users SET password = $1 WHERE id = $2;", [hashPWD, userID]);

            rsmodel.code = 0;
            rsmodel.message = "變更成功。";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "使用者帳號資訊異常。";
            console.error("Can't find user data in user_password_history.");
        }
    } catch (error) {
        console.error("Changing password fail.", error);
        rsmodel.code = 1;
        rsmodel.message = "變更密碼失敗";
    }
    res.json(rsmodel);
};

exports.createUser = async function (req, res) {
    logRouteDetails("userController.createUser", req);
    let rsmodel = new responseModel();
    try {
        const { name, account, pwd } = JSON.parse(req.body);
        console.info("userController.createUser:", JSON.parse(req.body));
        if (!name || !account || !pwd) {
            throw new Error("缺少必要的參數");
        }
        const userId = uuidv4();

        // 密碼轉譯
        const hashPWD = await bcrypt.hash(pwd, 10);

        // Users表建資料
        await Users.create({
            id: userId,
            user_type_id: 2,
            account: account,
            password: hashPWD,
            name: name,
        });

        // UserLoginType表建資料
        await UserLoginType.create({
            login_type_id: 4,
            user_id: userId,
            auth_id: account,
            user_info_json: {
                idType: "E",
                birthday: "",
                sex: "",
                compNo: "",
                userNo: "",
                postNo: "",
                eMail: "",
                cName: "",
                depNo: "",
                subCompNo: "",
                city: "",
                eName: "",
            },
        });

        // UserPasswordHistory表建資料
        await UserPasswordHistory.create({
            user_id: userId,
            old_password_1: hashPWD,
        });

        rsmodel.code = 0;
        rsmodel.message = "建立成功";
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "使用者建立失敗";
    }

    res.json(rsmodel);
};

exports.getAuthSetting = async function (req, res) {
    logRouteDetails("userController.getAuthSetting", req);
    let rsmodel = new responseModel();
    try {
        let canUseAuth = 0;

        // 檢查該單位是否有二次驗證功能
        const loginTypeID = req.session.loginType;
        if (loginTypeID) {
            const loginTypeResult = await LoginType.findOne({
                attributes: ["use_two_factor_authentication"],
                where: { id: loginTypeID },
            });
            canUseAuth = loginTypeResult?.dataValues.use_two_factor_authentication;
            rsmodel.data = {
                useAuth: canUseAuth || 0,
            };
        } else {
            throw new Error("req.session.loginType is not defined.");
        }

        // 如果可用2FA，再進一步查詢
        if (canUseAuth == 1) {
            // 去 2FA 表找User資訊
            const uid = req.session.userInfo.uid;
            const rs = await TwoFactorAuthentication.findOne({
                attributes: ["is_enable"],
                where: {
                    user_id: uid,
                },
            });
            if (rs && rs.dataValues) {
                rsmodel.data.isEnable = rs.dataValues.is_enable;
            } else {
                rsmodel.message = "This user hasn't used two-factor authentication before.";
            }
        }

        rsmodel.code = 0;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = "取使用者二次驗證資訊時發生錯誤。";
        console.error("Error fetching two-factor authentication setting for user:", {
            userId: req.session?.userInfo?.uid,
            loginTypeID: req.session?.loginType,
            error: error,
        });
    }
    res.json(rsmodel);
};

exports.createSecretKey = async function (req, res) {
    logRouteDetails("userController.createSecretKey", req);
    let rsmodel = new responseModel();
    try {
        const uid = req.session.userInfo.uid;
        const secret = otplib.authenticator.generateSecret();
        const otpauth = otplib.authenticator.keyuri("AVA-2FA", "ava_expert", secret);
        const encryptedData = encryptTwoFactorSecret(secret, TWO_FACTOR_AUTHENTICATION_KEY);
        const [record, created] = await TwoFactorAuthentication.findOrCreate({
            // 查找的條件
            where: { user_id: uid },
            // 如果找不到，創建新記錄時預設的 user_id
            defaults: {
                user_id: uid,
                secret_key: encryptedData,
            },
        });

        if (created) {
            console.log("新的 two_factor_authentication 資料已建立:", record.toJSON());
        } else {
            await record.update(
                {
                    secret_key: encryptedData,
                },
                {
                    fields: ["secret_key"],
                }
            );
        }
        // 使用 qrcode 套件來生成 QR Code 的 Data URL
        const imageUrl = await QRCode.toDataURL(otpauth);
        rsmodel.data = { secretKey: secret, qrCodeUrl: imageUrl };
        rsmodel.code = 0;
        rsmodel.message = "二次驗證密鑰生成完畢";
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = "二次驗證密鑰生成時，發生錯誤";
    }

    res.json(rsmodel);
};

exports.authentication = async function (req, res) {
    logRouteDetails("userController.authentication", req);
    let rsmodel = new responseModel();
    try {
        const uid = req.session.userInfo.uid;
        const totp = JSON.parse(req.body).code;
        const action = JSON.parse(req.body).action;
        console.info("userController.authentication:", JSON.parse(req.body));
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

        if (isValid && action === "enable") {
            await record.update(
                {
                    is_enable: 1,
                    last_device: null,
                    ip: null,
                    last_auth_time: null,
                },
                {
                    fields: ["is_enable", "last_device", "ip", "last_auth_time"],
                }
            );
        } else if (isValid && action === "disable") {
            await record.update(
                {
                    is_enable: 0,
                    last_device: null,
                    ip: null,
                    last_auth_time: null,
                },
                {
                    fields: ["is_enable", "last_device", "ip", "last_auth_time"],
                }
            );
        } else {
            console.error("驗證失敗了");
            rsmodel.code = 1;
            rsmodel.message = "TOTP驗證失敗";
            return res.json(rsmodel);
        }

        // 驗證成功後刪除justLogin
        try {
            delete req.session.justLogin;
            console.log("justLogin 刪除成功");
        } catch (err) {
            console.log("justLogin 刪除失敗");
        }

        rsmodel.data = { isValid: isValid };
        rsmodel.code = 0;
        rsmodel.message = "TOTP驗證成功";
    } catch (e) {
        console.error("二次驗證過程發生錯誤:", e);
        rsmodel.code = 1;
        rsmodel.message = "二次驗證過程發生錯誤";
    }

    res.json(rsmodel);
};

exports.createJustTwoFactorAuth = async function (req, res) {
    logRouteDetails("userController.createJustTwoFactorAuth", req);
    let rsmodel = new responseModel();

    req.session.justTwoFactorAuth = true;
    setTimeout(() => {
        if (req.session) {
            req.session.justTwoFactorAuth = undefined;
            // 確保 Redis 同步更新 session
            req.session.save((err) => {
                if (err) {
                    console.error("創建justTwoFactorAuth時出錯", err);
                    rsmodel.code = 1;
                    rsmodel.message = "創建justTwoFactorAuth時出錯";
                }
            });
            rsmodel.code = 0;
            rsmodel.message = "justTwoFactorAuth建立成功";
        }
    }, 2500);

    res.json(rsmodel);
};

exports.checkJustTwoFactorAuth = async function (req, res) {
    logRouteDetails("userController.checkJustTwoFactorAuth", req);
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
