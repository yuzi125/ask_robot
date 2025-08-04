"use strict";

require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
require("./utils/log-utils.js");

const express = require("express");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
const app = express();
const session = require("express-session");
const { uploadLogFile } = require("./utils/logUploader.js");

// 引入log檔案
const path = require("path");
global.appRoot = path.resolve(__dirname);

//  這邊是 prometheus 的設定

const promBundle = require("express-prom-bundle");
const promMetrics = promBundle({ includePath: true });
app.use(promMetrics);
//  結尾
let { redisStore } = require("./global/redisStore.js");
app.use(cookieParser());
app.use(
    session({
        store: redisStore, // 使用你配置的 redisStore
        name: "s_id", // session 名稱
        secret: "awb-pve-ess", // 用於加密 session 的 secret key
        resave: false, // 如果 session 沒有變更，則避免重新儲存
        saveUninitialized: true, // 即使 session 沒有被修改也會儲存
        cookie: {
            maxAge: 24 * 60 * 60 * 1000, // 設置 cookie 的有效期為 1 天（以毫秒為單位）
            httpOnly: true, // 設置 httpOnly 屬性來增強安全性
        },
        rolling: true,
    })
);

//檢查資料庫是否已準備好
const db_ready_check = require("./orm/db_ready_check.js");
db_ready_check();

// 定時上傳 log 檔案
if (process.env.ENABLE_LOG_UPLOAD === "1") {
    uploadLogFile();
}

const port = 8082;

// app.use(cors());

app.use(express.text({ type: "application/json", limit: "20mb" }));
// app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// health check 路由為 /ava/system/healthCheck
const system = require("./router/system");
app.use("/ava/system", system);

const apiKeyMiddleware = require("./middleware/apiKeyMiddleware");
app.use("/ava/backend", apiKeyMiddleware);

const SSO_TYPE = process.env.SSO_TYPE;

if (SSO_TYPE.toLowerCase() === "kcg") {
    console.log("SSO_TYPE is kcg");
    const kcgSSOMiddleware = require("./middleware/kcgSSO");
    app.use("/ava/", kcgSSOMiddleware);
    // } else if (SSO_TYPE.toLowerCase() === "csc") {
    //     console.log("SSO_TYPE is csc");
    //     const cscSSOMiddleware = require("./middleware/cscSSO");
    //     app.use("/ava/", cscSSOMiddleware);
} else {
    const ssoBackendMiddleware = require("./middleware/sso_backend");
    app.use("/ava/", ssoBackendMiddleware);
}

const backend = require("./router/backend");
app.use("/ava/backend", backend);

const downloadController = require("./controller/download");
/* 檔案下載 */
app.get("/ava/backend/download/:filename", downloadController.download);
/* 聊天室檔案下載 */
app.get("/ava/backend/downloadChat/:userId", downloadController.downloadChat);
/* 取得壓縮檔下載位置 */
app.post("/ava/backend/downloadzip", downloadController.downloadfilename);
/* 下載壓縮檔 */
app.get("/ava/backend/downloadzip/:filename", downloadController.downloadzip);

app.listen(port, () => {
    console.log("server is connection at http://localhost:" + port);
});
