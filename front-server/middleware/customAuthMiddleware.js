// login fail ENV URL
// validate auth url

// 登入失敗後 要跳轉的網址
const CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL = process.env.CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL;

const sql = require("../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const { validateApiKey } = require("../utils/apiKeyUtils");

async function customAuthMiddleware(req, res, next) {
    // 檢查是否是 /system 開頭的路徑
    if (req.path.startsWith("/system")) {
        // 允許訪問 /system 路徑
        return next();
    }

    // 檢查來源是否為 line
    if (req.headers.source && req.headers.source === "line") {
        return next();
    }

    // apiKey 檢查
    const apiKey = req.headers["api-key"];
    if ((apiKey && (await validateApiKey(apiKey)))) {
        return next();
    }

    try {
        if (req.session.userInfo && req.session.userType != "guest") {
            return next();
        }
        // need_login 是 1 就會回傳 true
        const need_login = await getNeedLogin();
        // need_login 是 1 就一定要登入 跳轉到驗證的網址
        if (need_login) {
            return res.status(401).json({ Location: CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL });
        }
        //  0 的話 就要判斷 guest 是不是 1 是 1 就走遊客流程
        // guest_enable 是 1 就會回傳 true
        const guest_enable = await getGuestEnable();
        //  guest_enable 是 0 就一定要登入 跳轉到驗證的網址
        if (!guest_enable) {
            return res.status(401).json({ Location: CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL });
        }
        // 這邊是 need_login 是 0 而 guest_enable 是 1 的情況 走遊客流程
        req.session.userType = "guest";

        // 檢查是否已經創建過遊客
        if (req.cookies["ava-guest"]) {
            req.session.userInfo = JSON.parse(req.cookies["ava-guest"]);
        } else {
            // 只有在 session 中沒有標記已創建遊客時才創建
            const rs = await createGuest();
            req.session.userInfo = rs;
            res.cookie("ava-guest", JSON.stringify(rs));
            req.cookies["ava-guest"] = JSON.stringify(rs);
        }

        await req.session.save();

        next();
    } catch (error) {
        console.error(error.message);

        return res.status(401).json({ Location: CUSTOM_AUTH_LOGIN_FAIL_REDIRECT_URL });
    }
}

let isCreatingGuest = false;
let guestPromise = null; // 用來存儲當前請求的 Promise

async function createGuest() {
    if (isCreatingGuest) {
        // 返回當前進行中的 Promise，等待其完成
        return guestPromise;
    }

    isCreatingGuest = true;

    guestPromise = (async () => {
        const uuid = uuidv4();
        const user_type = "guest";

        try {
            let rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
            const user_type_id = rs.rows[0]?.id;

            rs = await sql.query("SELECT id FROM users WHERE id = $1", [uuid]);
            if (rs.rows.length === 0) {
                await sql.query("INSERT INTO users(id, user_type_id) VALUES($1, $2)", [uuid, user_type_id]);
            }

            return {
                uid: uuid,
                nickname: "遊客",
                user_no: "guest",
                sex: "1",
                avatar: null,
                user_type: user_type,
            };
        } catch (error) {
            throw new Error("Error while creating guest");
        } finally {
            isCreatingGuest = false;
            guestPromise = null; // 清除鎖
        }
    })();

    return guestPromise; // 返回 Promise，等待完成
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

async function getNeedLogin() {
    let rs = await sql.query("select value from settings where key = 'need_login'");
    let need_login = rs.rows[0].value;
    if (need_login === "0") {
        return false;
    } else if (need_login === "1") {
        return true;
    }
}

module.exports = customAuthMiddleware;
