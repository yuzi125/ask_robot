const responseModel = require("../../model/responseModel");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sql = require("../../db/pgsql");
const logRouteDetails = require("../routeNameLog");
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

exports.getFilenames = async function (req, res) {
    logRouteDetails("logController.getFilenames", req);
    let rsmodel = new responseModel();
    try {
        let files = fs.readdirSync(path.join(__dirname, "../../log"));
        files = files.reverse().filter((f) => f !== "sql.log");
        rsmodel.code = 0;
        rsmodel.data = files;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getFile = async function (req, res) {
    logRouteDetails("logController.getFile", req);
    let rsmodel = new responseModel();
    try {
        let { filename, count } = req.query;
        console.info("logController.getFile:", req.query);
        const file = fs.readFileSync(path.join(__dirname, `../../log/${filename}`), "utf-8");

        const level_color = [
            { level: "LOG", color: "white" },
            { level: "INFO", color: "blue" },
            { level: "ERROR", color: "red" },
            { level: "WARNING", color: "yellow" },
            { level: "DEBUG", color: "orange" },
        ];
        const regex =
            /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (.*?) - (.*?) - (.*?)(?=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} -|\s*$|(?=\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] -))/gm;
        let rsArr = [];
        let match;
        while ((match = regex.exec(file)) !== null) {
            let colorObj = level_color.find((f) => f.level === match[3]);
            let color = colorObj ? colorObj.color : "gray"; // 設置預設顏色
            rsArr.push({ time: match[1], level: match[3], module: match[2], message: match[4], color: color });
        }
        if (count) {
            rsArr = rsArr.slice(-1 * count);
        }

        rsmodel.code = 0;
        rsmodel.data = rsArr;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.downloadPythonLog = async function (req, res) {
    logRouteDetails("logController.downloadPythonLog", req);
    try {
        const { filename } = JSON.parse(req.body);
        console.info("logController.downloadPythonLog:", JSON.parse(req.body));
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;
        if (!filename) {
            return res.status(400).send("請提供有效的文件名");
        }

        // 向 Python 日誌 API 發送請求
        const response = await axios.post(
            `${pythonAPIHost}/downloadLogFile`, // 替換為正確的 Python 日誌 API 路徑
            { filename, ava_token },
            { responseType: "stream" } // 以流的形式處理文件
        );

        // 設置文件下載的 header
        res.setHeader("Content-Disposition", `attachment; filename=${filename}.log`);
        res.setHeader("Content-Type", "text/plain");

        // 將 Python API 返回的日誌文件流傳給前端
        response.data.pipe(res);
    } catch (error) {
        console.error("下載 Python 日誌失敗:", error.message);
        res.status(500).send("下載 Python 日誌失敗");
    }
};

exports.downloadBackendServerLog = async function (req, res) {
    logRouteDetails("logController.downloadBackendServerLog", req);
    try {
        let { filename } = JSON.parse(req.body); // 改從 req.body 取得文件名
        console.info("logController.downloadBackendServerLog:", JSON.parse(req.body));
        const filePath = path.join(__dirname, `../../log/${filename}`);

        // 檢查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).send("文件不存在");
        }

        // 設置返回的文件類型和文件名
        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
        res.setHeader("Content-Type", "text/plain");

        // 將文件流發送給前端
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (e) {
        console.error(e);
        res.status(500).send("伺服器錯誤，無法下載文件");
    }
};

exports.downloadSQLLog = async function (req, res) {
    logRouteDetails("logController.downloadSQLLog", req);
    try {
        let { time } = JSON.parse(req.body); // 從請求中取得時間 (格式：YYYY-MM-DD)
        console.info("logController.downloadSQLLog:", JSON.parse(req.body));

        if (!time) {
            return res.status(400).send("請提供時間參數");
        }

        const filename = "sql.log"; // 假設所有 SQL 日誌都存放在一個名為 SQL.log 的文件中
        const filePath = path.join(__dirname, `../../log/${filename}`);

        // 檢查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).send("SQL 日誌文件不存在");
        }

        // 讀取 SQL 日誌文件
        let sqllog = fs.readFileSync(filePath, "utf-8");

        // 使用正則表達式解析日誌
        const regex =
            /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (.*?) - (sql=>[\s\S]*?)(?=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} -|\s*$)/g;
        let rsArr = [];
        let match;

        while ((match = regex.exec(sqllog)) !== null) {
            let statu = match[2].split("=>");
            let sql = match[3].split("=>");
            rsArr.push({
                time: match[1],
                status: statu[0],
                message: statu[1],
                sql: sql[1],
            });
        }

        // 根據提供的 time 過濾當日數據
        rsArr = rsArr.filter((f) => {
            let day = f.time.split(" ")[0];
            return day === time;
        });

        // 如果沒有找到符合條件的日誌，返回 404
        if (rsArr.length === 0) {
            return res.status(404).send(`找不到 ${time} 的日誌`);
        }

        // 構建日誌文件內容
        const logContent = rsArr.map((log) => `${log.time} - ${log.status} - sql=>${log.sql}`).join("\n");

        // 設置返回的文件類型和文件名
        res.setHeader("Content-Disposition", `attachment; filename=${time}-sql.log`);
        res.setHeader("Content-Type", "text/plain");

        // 將過濾後的日誌內容作為文件返回
        res.send(logContent);
    } catch (e) {
        console.error(e.message);
        res.status(500).send("伺服器錯誤，無法下載文件");
    }
};

exports.downloadCrawlerLog = async function (req, res) {
    logRouteDetails("logController.downloadCrawlerLog", req);
    try {
        const { dir, crawlerId } = JSON.parse(req.body);
        console.info("logController.downloadCrawlerLog:", JSON.parse(req.body));
        const CRAWLER_DOWNLOAD = process.env.CRAWLER_DOWNLOAD;

        if (!dir) {
            return res.status(400).send("請提供有效的爬蟲目錄");
        }
        const result = await sql.query("SELECT site_id FROM crawler WHERE id = $1", [crawlerId]);
        const siteId = result?.rows[0]?.site_id;
        // 目前 site id 要是有 .crawler 的話 log 就會是 WebCrawler
        // 如果沒有的話 就是 spider-${dir}.log
        const filename = siteId.includes(".crawler") ? "WebCrawler.log" : `spider-${dir}.log`;

        const logUrl = `${CRAWLER_DOWNLOAD}/output/${dir}/${filename}`;

        const response = await axios({
            url: logUrl,
            method: "GET",
            responseType: "stream",
        });

        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
        res.setHeader("Content-Type", "text/plain");

        response.data.pipe(res);
    } catch (error) {
        console.error("下載爬蟲log失敗:", error.message);
        res.status(500).send("下載爬蟲log失敗");
    }
};

// file service 上的 backend server log

exports.getFileServiceBackendServerLogFileList = async function (req, res) {
    logRouteDetails("logController.getFileServiceBackendServerLogFileList", req);
    try {
        // 發送 GET 請求到 file-service 的 /list-logs API
        const fileServiceUrl = `${process.env.AVA_FILE_SERVICE_URL}/list-logs`;
        const response = await axios.get(fileServiceUrl);

        // 如果請求成功，返回文件列表給前端
        if (response.status === 200) {
            res.status(200).send(response.data); // 將 logs 清單發送給前端
        } else {
            res.status(response.status).send("無法獲取 log 文件列表，請重試");
        }
    } catch (e) {
        console.error(e);
        res.status(500).send("伺服器錯誤，無法取得 log 文件清單");
    }
};

exports.downloadFileServiceBackendServerLog = async function (req, res) {
    logRouteDetails("logController.downloadFileServiceBackendServerLog", req);
    try {
        let { filename } = JSON.parse(req.body);
        console.info("logController.downloadFileServiceBackendServerLog:", JSON.parse(req.body));

        if (!filename) {
            return res.status(400).send("Filename is required.");
        }

        // 呼叫 file service 的下載 log API
        const downloadUrl = `${process.env.AVA_FILE_SERVICE_URL}/download-log`;
        const response = await axios.post(
            downloadUrl,
            { filename },
            {
                responseType: "stream", // 設置返回類型為流
            }
        );

        // 如果成功，將文件流發送給前端
        if (response.status === 200) {
            res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
            res.setHeader("Content-Type", "text/plain");
            response.data.pipe(res); // 將文件流發送給客戶端
        } else {
            res.status(response.status).send("文件下載失敗，請重試");
        }
    } catch (e) {
        console.error(e);
        res.status(500).send("伺服器錯誤，無法下載文件");
    }
};

exports.lokiQuery = async function (req, res) {
    logRouteDetails("logController.lokiQuery", req);
    const query = req.query.query || '{application="backend-server"}';
    const limit = parseInt(req.query.limit) || 100;
    const start = parseInt(req.query.start);
    const end = parseInt(req.query.end);

    const headers = {
        "Content-Type": "application/json",
    };

    const params = {
        query,
        start,
        end,
        limit,
    };

    const LOKI_URL_OBJ = new URL(process.env.LOKI_URL || "http://localhost:3100");

    // http://loki:3100
    const LOKI_URL = `${LOKI_URL_OBJ.origin}`;

    try {
        const response = await axios.get(`${LOKI_URL}/loki/api/v1/query_range`, {
            headers,
            params,
        });

        const logs = response.data;
        const logEntries = logs.data.result.map((stream) => ({
            labels: stream.stream,
            entries: stream.values.map(([timestamp, log]) => ({
                timestamp: new Date(parseInt(timestamp) / 1e6).toISOString(),
                log,
            })),
        }));

        res.json({ status: "success", data: logEntries });
    } catch (error) {
        console.error("Error querying Loki:", error.message);
        if (error.response) {
            console.error("Loki API Response:", error.response.data);
            res.status(error.response.status).json({
                status: "error",
                message: error.response.statusText,
                details: error.response.data,
            });
        } else {
            res.status(500).json({
                status: "error",
                message: "An error occurred while querying Loki",
            });
        }
    }
};

// 獲取所有可用的標籤
exports.getLokiLabels = async function (req, res) {
    logRouteDetails("logController.getLokiLabels", req);
    try {
        const LOKI_URL_OBJ = new URL(process.env.LOKI_URL || "http://localhost:3100");

        // http://loki:3100
        const LOKI_URL = `${LOKI_URL_OBJ.origin}`;

        const response = await axios.get(`${LOKI_URL}/loki/api/v1/labels`);

        if (response.data.status === "success") {
            res.json({
                status: "success",
                data: response.data.data,
            });
        } else {
            throw new Error("Failed to fetch Loki labels");
        }
    } catch (error) {
        console.error("Error fetching Loki labels:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch labels",
            details: error.message,
        });
    }
};

// 獲取特定標籤的所有可能值
exports.getLokiLabelValues = async function (req, res) {
    logRouteDetails("logController.getLokiLabelValues", req);
    try {
        const { labelName } = req.params;
        console.info("logController.getLokiLabelValues:", req.params);
        const LOKI_URL_OBJ = new URL(process.env.LOKI_URL || "http://localhost:3100");

        // http://loki:3100
        const LOKI_URL = `${LOKI_URL_OBJ.origin}`;

        const response = await axios.get(`${LOKI_URL}/loki/api/v1/label/${labelName}/values`);

        if (response.data.status === "success") {
            res.json({
                status: "success",
                data: response.data.data,
            });
        } else {
            throw new Error(`Failed to fetch values for label: ${labelName}`);
        }
    } catch (error) {
        console.error(`Error fetching values for label ${req.params.labelName}:`, error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch label values",
            details: error.message,
        });
    }
};
