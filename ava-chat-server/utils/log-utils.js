const fs = require("fs");
const path = require("path");
const winston = require("winston");
const LokiTransport = require("winston-loki");
require("winston-daily-rotate-file");

function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

const baseLogDirectory = "log";
ensureDirectoryExists(baseLogDirectory);
function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getLogFileName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}-all.log`;
}

const logFileName = getLogFileName();
const logFilePath = path.join(baseLogDirectory, logFileName);
const lokiUrl = process.env.LOKI_URL;
const parsedUrl = new URL(lokiUrl);
const loki_host = parsedUrl.origin;

const SERVER_ID = process.env.SERVER_ID || "no-identifier";

const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
    dirname: baseLogDirectory, // 日誌檔案存放目錄
    filename: `%DATE%-${SERVER_ID}-all.log`, // 檔名格式
    datePattern: "YYYY-MM-DD", // 日期格式
    zippedArchive: true, // 是否壓縮
    maxSize: "30m", // 單個檔案最大尺寸
    maxFiles: "14d", // 最長保留天數
});

const logger = winston.createLogger({
    level: "debug",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, extra }) => {
            const extraInfo = extra && Object.keys(extra).length > 0 ? `, extra=${safeStringify(extra)}` : "";
            return `${timestamp} - ${getCallerFile()} - ${level.toUpperCase()} - ${message}${extraInfo}`;
        })
    ),
    transports: [
        dailyRotateFileTransport,
        new LokiTransport({
            host: loki_host,
            labels: { application: "chat-server", server: SERVER_ID },
            json: true,
            format: winston.format.json(),
            level: "debug",
            // 批量發送配置
            // batching: true, // 啟用批量發送
            // batchSize: 500, // 每次最多發送 500 條日志
            // interval: 5000, // 每 5 秒發送一次
            // minBatch: 1, // 當累積 1 條日誌時就發送，不用等待 interval

            // // 重試機制配置
            // retry: {
            //     retries: 100, // 最多重試 100 次
            //     factor: 2, // 指數退避倍數
            //     minTimeout: 1000, // 初始重試間隔為 1 秒
            //     maxTimeout: 600000, // 最大重試間隔為 600 秒
            // },
        }),
    ],
});
logger.on("error", (err) => {
    console.error("Logging to Loki failed:", err);
});
function safeStringify(obj, indent = 2) {
    const seen = new WeakSet();
    return JSON.stringify(
        obj,
        (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                    return "[Circular]";
                }
                seen.add(value);
            }
            return value;
        },
        indent
    );
}

function getCallerFile() {
    const originalPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const err = new Error();
    const stack = err.stack;
    Error.prepareStackTrace = originalPrepareStackTrace;

    for (const callSite of stack) {
        const filename = callSite.getFileName();
        if (filename !== __filename) {
            return path.basename(filename);
        }
    }
    return "unknown";
}
function logWithExtra(level, message, extra = {}) {
    logger.log({ level, message, extra });
}

originalConsoleLog = console.log;
originalConsoleInfo = console.info;
originalConsoleError = console.error;
originalConsoleWarn = console.warn;
originalConsoleDebug = console.debug;

console.log = (...args) => {
    const timestamp = getCurrentTimestamp();
    const filename = getCallerFile();
    const logMessage = `${timestamp} - ${filename} - INFO -`;
    originalConsoleLog(logMessage, ...args);
    let extra = {};
    if (args.length > 1 && typeof args[args.length - 1] === "object" && !Array.isArray(args[args.length - 1])) {
        extra = args.pop();
    }
    const message = args.map((arg) => (typeof arg === "object" ? safeStringify(arg) : arg)).join(" ");
    logWithExtra("info", message, extra);
};

console.info = (...args) => {
    const timestamp = getCurrentTimestamp();
    const filename = getCallerFile();
    const logMessage = `${timestamp} - ${filename} - INFO -`;
    originalConsoleInfo(logMessage, ...args);
    let extra = {};
    if (args.length > 1 && typeof args[args.length - 1] === "object" && !Array.isArray(args[args.length - 1])) {
        extra = args.pop();
    }
    const message = args.map((arg) => (typeof arg === "object" ? safeStringify(arg) : arg)).join(" ");
    logWithExtra("info", message, extra);
};

console.error = (...args) => {
    const timestamp = getCurrentTimestamp();
    const filename = getCallerFile();
    const logMessage = `${timestamp} - ${filename} - ERROR -`;
    originalConsoleError(logMessage, ...args);
    let extra = {};
    if (args.length > 1 && typeof args[args.length - 1] === "object" && !Array.isArray(args[args.length - 1])) {
        extra = args.pop();
    }
    const message = args.map((arg) => (typeof arg === "object" ? safeStringify(arg) : arg)).join(" ");
    logWithExtra("error", message, extra);
};

console.warn = (...args) => {
    const timestamp = getCurrentTimestamp();
    const filename = getCallerFile();
    const logMessage = `${timestamp} - ${filename} - WARN -`;
    originalConsoleWarn(logMessage, ...args);
    let extra = {};
    if (args.length > 1 && typeof args[args.length - 1] === "object" && !Array.isArray(args[args.length - 1])) {
        extra = args.pop();
    }
    const message = args.map((arg) => (typeof arg === "object" ? safeStringify(arg) : arg)).join(" ");
    logWithExtra("warn", message, extra);
};

console.debug = (...args) => {
    const timestamp = getCurrentTimestamp();
    const filename = getCallerFile();
    const logMessage = `${timestamp} - ${filename} - DEBUG -`;
    originalConsoleDebug(logMessage, ...args);
    let extra = {};
    if (args.length > 1 && typeof args[args.length - 1] === "object" && !Array.isArray(args[args.length - 1])) {
        extra = args.pop();
    }
    const message = args.map((arg) => (typeof arg === "object" ? safeStringify(arg) : arg)).join(" ");
    logWithExtra("debug", message, extra);
};

function deleteOldLogs(deleteTime) {
    const now = new Date();
    const thresholdDate = new Date(now.setDate(now.getDate() - deleteTime));

    fs.readdir(baseLogDirectory, (err, files) => {
        if (err) throw err;

        files.forEach((file) => {
            const filePath = path.join(baseLogDirectory, file);
            fs.stat(filePath, (err, stats) => {
                if (err) throw err;

                if (new Date(stats.mtime) < thresholdDate) {
                    fs.unlink(filePath, (err) => {
                        if (err) throw err;
                        logger.info(`Deleted old log file: ${file}`);
                    });
                }
            });
        });
    });
}

deleteOldLogs(process.env.LOG_DELETE_TIME || 30);
