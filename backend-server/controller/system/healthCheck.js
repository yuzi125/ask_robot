const express = require("express");
const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
let { redisClient } = require("../../global/redisStore");
let { pool } = require("../../db/pgsql.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const {
    createDataset,
    uploadDocuments,
    getDownloadFileInfo,
    getDocumentStatus,
} = require("../../utils/healthCheckHelper");
const FormData = require("form-data");

const checkRedisConnect = async () => {
    let redis;

    try {
        // 使用 ping 測試 Redis 是否可用
        const pong = await redisClient.ping();
        console.log("pong", pong);
        if (pong === "PONG") {
            redis = { connect: true };
        } else {
            redis = { connect: false, "error-message": "redis 連接失敗" };
        }
    } catch (error) {
        redis = { connect: false, "error-message": error.message };
    }

    return redis;
};

const checkDbConnect = async () => {
    let db;

    try {
        var client = await pool.connect();
        await client.query("SELECT 1");
        db = { connect: true };
    } catch (error) {
        db = { connect: false, "error-message": error.message };
    } finally {
        client.release();
    }

    return db;
};

const connect_false_message = {
    redis: {
        connect: false,
    },
    db: {
        connect: false,
    },
};

const getAvaApiServerHealthCheck = async () => {
    let avaApiServer;
    try {
        const response = await axios.get(`${process.env.PYTHON_API_HOST}/serverHealthCheckList`);
        if (response.status === 200) {
            avaApiServer = { status: response.status, ...response.data };
        } else {
            avaApiServer = {
                status: response.status,
                ...connect_false_message,
                pgVector: {
                    "error-message": response.message,
                    connect: false,
                },
            };
        }
    } catch (error) {
        let errorMessage = "Unknown error";

        if (error.message) {
            console.log("In error.message condition");
            errorMessage = error.message;
        } else if (error.code) {
            console.log("In error.code condition");
            errorMessage = `Error code: ${error.code}`;
        } else if (error.errors && Array.isArray(error.errors)) {
            console.log("In error.errors condition");
            errorMessage = error.errors.map((err) => err.message || err.toString()).join("; ");
        }
        // api 連不到 就當作所有都連不到
        avaApiServer = {
            status: 503,
            ...connect_false_message,
            db: {
                "error-message": errorMessage,
                connect: false,
            },
            redis: {
                "error-message": errorMessage,
                connect: false,
            },
            pgVector: {
                "error-message": errorMessage,
                connect: false,
            },
        };
    }

    return avaApiServer;
};

const getAvaChatServerHealthCheck = async () => {
    let avaChatServer;

    try {
        const response = await axios.get(`${process.env.AVA_URL}/system/serverHealthCheckList`);
        if (response.status === 200) {
            if (response.data.code === 0) {
                avaChatServer = { status: response.status, ...response.data.data };
            } else {
                avaChatServer = {
                    status: response.status,
                    "error-message": response.data.message,
                    ...response.data.data,
                };
            }
        } else {
            avaChatServer = { status: response.status, "error-message": response.message, ...connect_false_message };
        }
    } catch (error) {
        let errorMessage = "Unknown error";

        if (error.message) {
            console.log("In error.message condition");
            errorMessage = error.message;
        } else if (error.code) {
            console.log("In error.code condition");
            errorMessage = `Error code: ${error.code}`;
        } else if (error.errors && Array.isArray(error.errors)) {
            console.log("In error.errors condition");
            errorMessage = error.errors.map((err) => err.message || err.toString()).join("; ");
        }
        avaChatServer = {
            status: 503,
            ...connect_false_message,
            redis: { connect: false, "error-message": errorMessage },
            db: { connect: false, "error-message": errorMessage },
        };
    }

    return avaChatServer;
};

const getAvaLinebotServerHealthCheck = async () => {
    let rsmodel = new responseModel();
    try {
        const response = await axios.get(`${process.env.LINEBOT_API_HOST}/serverHealthCheckList`);
        if (response.status === 200) {
            rsmodel.code = 0;
            rsmodel.data = { status: response.status, ...response.data };
        } else {
            rsmodel.code = 1;
            rsmodel.data = { status: response.status, "error-message": response.message };
        }
    } catch (error) {
        let errorMessage = "Unknown error";

        if (error.message) {
            errorMessage = error.message;
        } else if (error.code) {
            errorMessage = `Error code: ${error.code}`;
        } else if (error.errors && Array.isArray(error.errors)) {
            errorMessage = error.errors.map((err) => err.message || err.toString()).join("; ");
        }
        rsmodel.code = 1;
        rsmodel.data = {
            status: 503,
            redis: { connect: false, "error-message": errorMessage },
        };
    }
    return rsmodel;
};

// 全系統測試
// ava-api-server redis db pgVector
// ava-chat-server redis db
// ava-backend-server redis db
exports.serverHealthCheckList = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        const redis = await checkRedisConnect();
        const db = await checkDbConnect();
        const avaApiServer = await getAvaApiServerHealthCheck();
        const avaChatServer = await getAvaChatServerHealthCheck();
        const avaBackendServer = { status: 200, redis, db };
        const avaLinebotServerRedis = await getAvaLinebotServerHealthCheck();
        const avaLinebotServer = avaLinebotServerRedis.data;

        rsmodel.code = 0;
        rsmodel.message = "ok";
        rsmodel.data = { avaApiServer, avaChatServer, avaBackendServer, avaLinebotServer };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// ava-api-server redis single test
exports.avaApiServerRedisCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        const response = await axios.get(`${process.env.PYTHON_API_HOST}/serverHealthRedisCheck`);
        if (response.status === 200) {
            rsmodel.code = 0;
            rsmodel.data = { status: response.status, ...response.data };
        } else {
            rsmodel.code = 1;
            rsmodel.data = {
                status: response.status,
                "error-message": response.message,
                redis: { connect: false },
            };
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.data = {
            status: 503,
            "error-message": error.message,
            redis: { connect: false },
        };
    }
    res.json(rsmodel);
};

// ava-api-server db single test
exports.avaApiServerDbCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        const response = await axios.get(`${process.env.PYTHON_API_HOST}/serverHealthDbCheck`);
        if (response.status === 200) {
            rsmodel.code = 0;
            rsmodel.data = { status: response.status, ...response.data };
        } else {
            rsmodel.code = 1;
            rsmodel.data = {
                status: response.status,
                "error-message": response.message,
                db: { connect: false },
            };
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.data = {
            status: 503,
            "error-message": error.message,
            db: { connect: false },
        };
    }
    res.json(rsmodel);
};

// ava-api-server pgVector single test
exports.avaApiServerPgVectorCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        const response = await axios.get(`${process.env.PYTHON_API_HOST}/serverHealthpgVectorCheck`);
        if (response.status === 200) {
            rsmodel.code = 0;
            rsmodel.data = { status: response.status, ...response.data };
        } else {
            rsmodel.code = 1;
            rsmodel.data = {
                status: response.status,
                pgVector: { connect: false, "error-message": response.message },
            };
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.data = {
            status: 503,
            pgVector: { connect: false, "error-message": error.message },
        };
    }
    res.json(rsmodel);
};

// ava-chat-server redis single test
exports.avaChatServerRedisCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        const response = await axios.get(`${process.env.AVA_URL}/system/serverHealthRedisCheck`);
        if (response.status === 200) {
            rsmodel.code = 0;
            rsmodel.data = { status: response.status, redis: { connect: true } };
        } else {
            rsmodel.code = 1;
            rsmodel.data = {
                status: response.status,
                redis: { connect: false, "error-message": response.message },
            };
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.data = {
            status: 503,
            redis: { connect: false, "error-message": error.message },
        };
    }
    res.json(rsmodel);
};

// ava-chat-server db single test
exports.avaChatServerDbCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        const response = await axios.get(`${process.env.AVA_URL}/system/serverHealthDbCheck`);
        if (response.status === 200) {
            rsmodel.code = 0;
            rsmodel.data = { status: response.status, db: { connect: true } };
        } else {
            rsmodel.code = 1;
            rsmodel.data = {
                status: response.status,
                db: { connect: false, "error-message": response.message },
            };
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.data = {
            status: 503,
            db: { connect: false, "error-message": error.message },
        };
    }
    res.json(rsmodel);
};

// ava-backend-server redis single test
exports.avaBackendServerRedisCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        // 使用 ping 測試 Redis 是否可用
        const pong = await redisClient.ping();

        if (pong === "PONG") {
            rsmodel.code = 0;
            rsmodel.data = { status: 200, redis: { connect: true } };
        } else {
            rsmodel.code = 1;
            rsmodel.data = { status: 200, redis: { connect: false, "error-message": "redis 連接失敗" } };
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.data = { status: 200, redis: { connect: false, "error-message": error.message } };
    }
    res.json(rsmodel);
};

// ava-backend-server db single test
exports.avaBackendServerDbCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        var client = await pool.connect();
        await client.query("SELECT 1");
        rsmodel.code = 0;
        rsmodel.data = { status: 200, db: { connect: true } };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.data = { status: 200, db: { connect: false, "error-message": error.message } };
    } finally {
        client.release();
    }
    res.json(rsmodel);
};

// ava-linebot-server redis single test
exports.avaLinebotServerRedisCheck = async (req, res) => {
    const rsmodel = await getAvaLinebotServerHealthCheck();
    res.json(rsmodel);
};

const FILE_NAME = "temp.txt";
const FILE_PATH = path.join(__dirname, FILE_NAME);

exports.uploadFileCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        // Step 1: 建立測試檔案
        const fileContent = "這是測試的文件內容";
        fs.writeFileSync(FILE_PATH, fileContent, "utf8");
        console.log(`${FILE_NAME} 文件已創建`);

        // Step 2: 創建資料集（模擬或實際邏輯）
        const { id: datasets_id, folder_name, upload_folder_id } = await createDataset();

        // Step 3: 初始化上傳相關的參數 & 發送 API 請求上傳文件 & 新增資料到 upload_documents
        const rs = await uploadDocuments(folder_name, datasets_id, upload_folder_id, FILE_NAME, FILE_PATH);

        if (rs.rowCount === 1) {
            // Step 4: 設定成功回應
            rsmodel.code = 0;
            rsmodel.data = { canUploadFile: true };
        }
    } catch (error) {
        console.error("操作失敗：", error.message);

        // 如果發生錯誤，確保文件被刪除
        if (fs.existsSync(FILE_PATH)) {
            fs.unlinkSync(FILE_PATH);
            console.log(`${FILE_NAME} 文件已刪除`);
        }

        rsmodel.code = 1;
        rsmodel["error-message"] = error.message;
        rsmodel.data = { canUploadFile: false };
    }

    res.json(rsmodel);
};

// 點擊按鈕會下載(測試用知識庫)最新的 file
exports.downloadFileCheck = async (req, res) => {
    let rsmodel = new responseModel();
    try {
        const { folder_name, filename, originalname } = await getDownloadFileInfo();

        const apiUrl = `${process.env.AVA_FILE_SERVICE_URL}/download/doc`;

        // 發送 POST 請求到 API
        const response = await axios.post(
            apiUrl,
            {
                folder_path: folder_name, // 請求 body
                filename: filename,
            },
            {
                responseType: "stream", // 確保接收到的是流
            }
        );

        rsmodel.code = 0;
        rsmodel.data = { canDownloadFile: true };
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(originalname)}`);
        response.data.pipe(res);

        return;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel["error-message"] = error.message;
        rsmodel.data = { canDownloadFile: false };
        res.json(rsmodel);
    }
};

// 會修改(測試用知識庫)最新 file 的狀態
exports.modifyFileStatusCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        const cookie = req.cookies;

        const cookieString = Object.entries(cookie)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join("; ");

        const { datasets_id, id, state } = await getDocumentStatus();

        let data;
        // state === 0 || state === 2 || state === 3
        if (state === 0 || state === 2 || state === 3 || state === 7) {
            data = {
                updateData: [{ id, state: 4 }],
                datasets_id: datasets_id,
            };
        } else if (state === 4) {
            data = {
                updateData: [{ id, state: 2 }],
                datasets_id: datasets_id,
            };
        }
        const response = await axios.put(`${process.env.BACKEND_HOST}/datasets/documentStatus`, data, {
            headers: { Cookie: cookieString },
        });

        if (response.data.code === 0) {
            rsmodel.code = 0;
            rsmodel.data = { canModifyFileStatus: true };
        } else {
            rsmodel.code = 1;
            rsmodel["error-message"] = response.data.message;
            rsmodel.data = { canModifyFileStatus: false };
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel["error-message"] = error.message;
        rsmodel.data = { canModifyFileStatus: false };
    }
    res.json(rsmodel);
};

// 確認是否能問問題，會以串流形式回復(跟正常一樣)
exports.askQuestionCheck = async (req, res) => {
    let rsmodel = new responseModel();
    const expert_id = "test_expert";
    try {
        const forwarded = req.headers["x-forwarded-for"];
        const ip = forwarded ? forwarded.split(",")[0] : req.connection.remoteAddress;
        const cookie = req.cookies;

        // 將 Cookie 轉換為 HTTP 標頭所需的格式，並對值進行 URL 編碼
        const cookieString = Object.entries(cookie)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join("; ");

        const result = await sql.query("SELECT nextval('history_messages_id_seq')");
        const history_message_id = result.rows[0].nextval;
        const formData = new FormData();
        const test_message = "測試文字";
        const message = {
            data: test_message,
            type: "text",
            history_message_id,
        };

        formData.append("message", JSON.stringify(message));
        formData.append("expert_id", expert_id);
        formData.append("event", "health_check");

        const response = await axios.post(`${process.env.AVA_URL}/chat/bot/avaTextGeneration`, formData, {
            headers: { "X-Forwarded-For": ip, Cookie: cookieString },
        });

        if (response.data.startsWith('{"type": "data"}')) {
            rsmodel.code = 0;
            rsmodel.data = { canAskQuestion: true, test_message, response_data: response.data };
        } else {
            const data = response.data.replace("</end>", "");
            const error_message = JSON.parse(data);
            rsmodel.code = 1;
            rsmodel["error-message"] = error_message.message;
            rsmodel.data = { canAskQuestion: false };
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel["error-message"] = error.message;
        rsmodel.data = { canAskQuestion: false };
    }
    res.json(rsmodel);
};
