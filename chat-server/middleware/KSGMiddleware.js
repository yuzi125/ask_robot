const { v4: uuidv4 } = require("uuid");
const sql = require("../db/pgsql");
const { validateApiKey } = require("../utils/apiKeyUtils");

async function getGuestEnable() {
    let rs = await sql.query("select value from settings where key = 'guest_enable'");
    let guest_enable = rs.rows[0].value;
    if (guest_enable === "0") {
        return false;
    } else if (guest_enable === "1") {
        return true;
    }
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

async function KSGMiddleware(req, res, next) {
    // 檢查來源是否為 line
    if (req.headers.source && req.headers.source === "line") {
        return next();
    }

    // 檢查資料庫連線狀態
    try {
        const rs = await sql.checkDBConnection();
        if (rs && rs.code === 0) {
            console.error("DB checking error result: ", rs);
            return res.status(503).json(rs);
        } else if (!rs) {
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

    // 若是登入行為，不用後續檢查。
    const isLoginAction = req.path.match("/login");
    if (isLoginAction) {
        return next();
    }

    // 檢查使用者 cookie 是否具有資料庫中的身分
    const referer = req.headers.referer;

    if (!req.session.userInfo?.uid) {
        try {
            const isLoginPages = req.path.match("/changePassword|authentication/g");
            if (isLoginPages) {
                return next();
            } else {
                res.status(403).json({ error: "尚未登入，移動到登入頁面。" });
            }
        } catch (error) {
            console.error("checking authority go wrong: ", error);
            return res.status(403).json({ error: "權限檢查異常。" });
        }
    } else if (referer && referer.includes("/kaohsiung")) {
        // console.log("kaohsiung");
        req.session.userType = "guest";

        if (req.cookies["ava-guest"]) {
            req.session.userInfo = JSON.parse(req.cookies["ava-guest"]);
            return next(); // 結束流程，防止重複設置 headers
        } else {
            try {
                const rs = await createGuest();
                console.log(rs);
                req.session.userInfo = rs;
                res.cookie("ava-guest", JSON.stringify(rs));
                req.cookies["ava-guest"] = JSON.stringify(rs);
                return next(); // 同樣結束流程
            } catch (err) {
                console.error(err.message);
                return res.status(500).json({ error: "Internal Server Error" });
            }
        }
    } else {
        next();
    }
}

module.exports = KSGMiddleware;
