"use strict";
const path = require("path");
global.appRoot = path.resolve(__dirname);
require("./utils/env.js");
require("./utils/log-utils.js");
const express = require("express");
const methodOverride = require("method-override");
const expressWs = require("express-ws");
const ws = require("./ws");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const whitelistMiddleware = require("./middleware/whitelistMiddleware");
const checkRateLimitThenSession = require("./middleware/accessControlIp");
const { redisClient } = require("./global/redisStore");

const sql = require("./db/pgsql"); // 確保正確引入 sql 模塊

const app = express();

//  這邊是 prometheus 的設定

const promBundle = require("express-prom-bundle");
const promMetrics = promBundle({ includePath: true });
app.use(promMetrics);

// 中間件檢查請求來源域名

app.use(whitelistMiddleware);

// health check 路由為 /ava/system/healthCheck
const system = require("./router/system");
app.use("/ava/system", system);

const SSO_TYPE = process.env.SSO_TYPE;
console.log("SSO_TYPE:", SSO_TYPE);
// 不是kcg 也不是ksg 才要 cors
if (SSO_TYPE.toLowerCase() !== "kcg" && SSO_TYPE.toLowerCase() !== "ksg") {
    app.use(cors());
}
const sessionExpiredHour = parseInt(process.env.SESSION_EXPIRED_HOUR) || 24;
let { redisStore } = require("./global/redisStore.js");
app.use(cookieParser());
app.use(
    session({
        store: redisStore,
        name: "s_id",
        secret: "awb-pve-ess",
        resave: false,
        saveUninitialized: true, // 即使 session 沒有被修改也會儲存
        cookie: {
            maxAge: sessionExpiredHour * 60 * 60 * 1000, // 設置 cookie 的有效期為 1 天（以毫秒為單位）
            httpOnly: true, // 設置 httpOnly 屬性來增強安全性
        },
        rolling: true,
        genid: function (req) {
            // 根據特定條件決定是否自定義 session ID
            if (req.headers.source === "line") {
                // 如果請求中有 customSession 參數，則使用自定義邏輯
                console.log("line redis:", req.cookies.session_id);
                return req.cookies.session_id;
            } else {
                // 否則，使用默認的 UUID 作為 session ID
                console.log("initial reids:", uuidv4);
                return uuidv4();
            }
        },
    })
);

const port = 8081;

expressWs(app);
app.use(ws);

app.use(methodOverride("_method"));

const ssoMiddleware = require("./middleware/sso");
const cscSSOMiddleware = require("./middleware/cscSSO");
const customAuthMiddleware = require("./middleware/customAuthMiddleware.js");
const KSGMiddleware = require("./middleware/KSGMiddleware.js");
const twoFactorAuthentication = require("./middleware/TwoFactorAuthentication.js");
const kcgSSOMiddleware = require("./middleware/kcgSSO");
const linebotMiddleware = require("./middleware/linebotMiddleware");

app.use(express.text({ type: "application/json", limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/ava/chat/cdn", express.static("cdn"));
// app.use("/ava/", customAuthMiddleware);
// 中鋼 SSO

const apiKeyMiddleware = require("./middleware/apiKeyMiddleware");
app.use("/ava/chat", apiKeyMiddleware);

if (SSO_TYPE.toLowerCase() === "custom") {
    app.use("/ava/", customAuthMiddleware);
    app.use("/ava/chat/uploads", customAuthMiddleware, express.static("uploads"));
} else if (SSO_TYPE.toLowerCase() === "csc") {
    const auth = require("./router/auth.js");
    app.use("/auth", auth);
    app.use("/ava/chat/uploads", cscSSOMiddleware, express.static("uploads"));
    app.use("/ava/", cscSSOMiddleware);
} else if (SSO_TYPE.toLowerCase() === "ksg") {
    app.use("/ava/chat/uploads", KSGMiddleware, express.static("uploads"));
    app.use("/ava/", KSGMiddleware);
} else if (SSO_TYPE.toLowerCase() === "kcg") {
    // 新增這個判斷
    app.use("/ava/chat/uploads", kcgSSOMiddleware, express.static("uploads"));
    app.use("/ava/", kcgSSOMiddleware);
} else {
    app.use("/ava/chat/uploads", ssoMiddleware, express.static("uploads"));
    app.use("/ava/", ssoMiddleware);
}

app.use("/ava/", twoFactorAuthentication);

app.use(checkRateLimitThenSession);

const apiController = require("./controller/api");
const jwtdecoder = require("./controller/jwtdecoder");

const { upload } = require("./global/upload.js");
const responseModel = require("./model/responseModel");
/* 清除測試聊天資料 */
app.post("/ava/chat/clearTest", async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const uid = req.session.userInfo.uid;
        const { partner, roomId } = JSON.parse(req.body);
        if (partner === "bot") {
            await sql.query("update bot_messages set chat=$1 where users_id = $2 and group_id = $3", [
                "[]",
                uid,
                roomId,
            ]);
        } else if (partner === "user") {
            await sql.query("delete from user_messages where room_id = $1", [roomId]);
        }
        rsmodel.code = 0;

        const cachePattern = `messages:${roomId}:page:*`;
        const keys = await redisClient.keys(cachePattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
});
/* 測試 */
app.post("/ava/api", upload, apiController.api);
/* 停止測試 */
app.post("/ava/api/stop", apiController.stopAPI);
///////////////////////////////前端測試用///////////////////////////////
///////////////////////////////python用///////////////////////////////

/* decode jwt for python server */
app.post("/ava/decode/jwt", jwtdecoder.decode);

///////////////////////////////前端用///////////////////////////////
const customAuthRouter = require("./router/customAuth");

app.use("/v1", customAuthRouter);

const chat = require("./router/chat");
app.use("/ava/chat", chat);
app.use("/ava/chat/linebot", linebotMiddleware, chat);

app.listen(port, () => {
    console.log("server is connection at http://localhost:" + port);
});

// 這段可以建立目前連線的IP，給AVA-Loader 測試時連接用。
// const os = require("os");

// const host = "0.0.0.0"; // 代表綁定所有可用的 IP

// app.listen(port, host, () => {
//     const interfaces = os.networkInterfaces();
//     console.log("Server is running on the following addresses:");
//     for (let iface in interfaces) {
//         for (let alias of interfaces[iface]) {
//             if (alias.family === "IPv4" && !alias.internal) {
//                 console.log(`→ http://${alias.address}:${port}`);
//             }
//         }
//     }
// });
