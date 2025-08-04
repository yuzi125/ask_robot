const Settings = require("./schema/settings");
const DeploymentRecord = require("./schema/deployment_record"); // 引入 DeploymentRecord 模型
const { syncForce } = require("./plz_only_run_me_once");
const updatedb = require("../db/db-update");
const fs = require("fs");
const path = require("path");
const ensureSettingsTable = require("../config/ensureSettingsTable");
const { syncDatabase } = require("../config/systemDB");
const { fork } = require("child_process");
const { addChildProcess, terminateAll } = require("../utils/processManager");
const mongoose = require("mongoose");

async function waitForMongoConnection() {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27018/LibreChat";
    try {
        await mongoose.connect(mongoUri, {
            connectTimeoutMS: 90000,
            socketTimeoutMS: 90000,
            serverSelectionTimeoutMS: 90000,
        });
        console.log("✅ 成功連線 MongoDB");
    } catch (err) {
        console.error("❌ MongoDB 連線失敗：", err.message);
        // process.exit(1);
    }
}

module.exports = async function () {
    const ENABLE_AVA_GPT = process.env.ENABLE_AVA_GPT || "0";
    if (ENABLE_AVA_GPT === "1") {
        await waitForMongoConnection(); // 新增這行
    }
    let is_db_ready;

    try {
        let rs = await Settings.findOne({
            attributes: ["key", "value"],
            where: { key: "is_db_ready" },
        });

        if (rs) {
            rs = rs.dataValues;
            console.info(rs);
            is_db_ready = rs.value === "1";
        } else {
            is_db_ready = false;
        }
    } catch (error) {
        console.error("資料庫連接錯誤：", error);
    }

    if (is_db_ready) {
        console.info("資料庫已準備");
    } else {
        await syncForce();
        console.info("建立資料庫");

        const sqlT = fs.readFileSync(path.join(__dirname, "../db/db-init/updateTimeTrigger.sql"), "utf-8");
        await updatedb(sqlT);
        console.info("更新觸發器(postgresql用update_time)");

        let env = process.env.NODE_ENV;
        if (env === "dev" || env === "test") {
            env = "test";
        }
        const filename = `init-data-${env}.js`;
        const { js_program } = require(`../db/db-refactor/${filename}`);
        await js_program();
        console.info("塞入資料");
    }

    // 確保 Settings 資料表裡面的資料有包含預設值，沒有的話就幫它新增到資料表裡。
    await ensureSettingsTable();
    // 確保資料表同步
    await syncDatabase();

    const NODE_TASK = process.env.NODE_TASK;
    const MAX_RESTARTS = 5; // 最大重試次數
    const RESTART_DELAY = 2000; // 每次重啟間隔 單位:毫秒
    const RESET_THRESHOLD = 60000; // 執行超過一分鐘時間後重置重試次數 單位:毫秒

    if (!NODE_TASK) {
        console.error("NODE_TASK 未設定。請將其設定為 'crawler'、'schedule' 或 'all'。");
    } else {
        if (NODE_TASK === "crawler" || NODE_TASK === "all") {
            try {
                const recoverCrawlerPath = path.join(__dirname, "../controller/backend/", "recoverCrawler.js");
                const recoverProcess = fork(recoverCrawlerPath);
                addChildProcess(recoverProcess);
                console.log("已啟動 recoverCrawler");

                recoverProcess.on("exit", (code) => {
                    console.log(`已關閉 recoverCrawler child process code : ${code}`);
                });
            } catch (error) {
                console.error("recoverCrawler.js 錯誤：", error);
            }
        }

        if (NODE_TASK === "schedule" || NODE_TASK === "all") {
            // 紀錄每個子進程的重試次數
            const restartAttempts = {
                taskScheduler: 0,
                taskExecutor: 0,
            };

            // 紀錄每個子進程的啟動時間
            const processStartTime = {
                taskScheduler: null,
                taskExecutor: null,
            };

            function startProcess(scriptPath, name) {
                const processInstance = fork(scriptPath);
                addChildProcess(processInstance);
                console.log(`${name} 子進程啟動，PID: ${processInstance.pid}`);

                // 記錄啟動時間
                // 添加記憶體使用監控
                const memoryCheckInterval = setInterval(() => {
                    const memoryUsage = process.memoryUsage();
                    console.log(`${name} 記憶體使用情況:`, {
                        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                    });
                }, 60000); // 每分鐘檢查一次

                processInstance.on("message", (message) => {
                    if (message.type === "heartbeat") {
                        console.log(`${name} 心跳收到，時間戳: ${new Date(message.timestamp).toISOString()}`);
                    } else if (message === "ready") {
                        console.log(`${name} 已成功啟動`);
                        processStartTime[name] = Date.now();
                        restartAttempts[name] = 0; // 啟動成功後重置重試計數器
                    }
                });

                processInstance.on("exit", (code) => {
                    clearInterval(memoryCheckInterval);
                    console.error(`${name} 子進程已關閉，退出碼: ${code}`);
                    const elapsedTime = Date.now() - processStartTime[name];

                    // 若子進程運行時間超過閾值，重置計數器
                    if (elapsedTime > RESET_THRESHOLD) {
                        console.log(`${name} 運行超過 ${RESET_THRESHOLD} 毫秒，重置重試計數器`);
                        restartAttempts[name] = 0;
                    }

                    if (restartAttempts[name] < MAX_RESTARTS) {
                        restartAttempts[name]++;
                        console.log(`嘗試第 ${restartAttempts[name]} 次重啟 ${name}...`);
                        setTimeout(() => startProcess(scriptPath, name), RESTART_DELAY);
                    } else {
                        console.error(`${name} 已達到最大重啟次數 (${MAX_RESTARTS})，不再嘗試重啟`);
                    }
                });

                process.on("uncaughtException", (err) => {
                    console.error("Uncaught Exception:", err);
                });
                process.on("unhandledRejection", (reason, promise) => {
                    console.error("Unhandled Rejection:", promise, "reason:", reason);
                });

                processInstance.on("error", (err) => {
                    console.error(`${name} 子進程發生錯誤:`, err);
                });
            }

            try {
                const taskSchedulerPath = path.join(__dirname, "../schedulers/taskScheduler.js");
                startProcess(taskSchedulerPath, "taskScheduler");
                console.log("已啟動 taskScheduler");

                // taskSchedulerProcess.on("exit", (code) => {
                //     console.log(`已關閉 taskScheduler child process code : ${code}`);
                // });
            } catch (error) {
                console.error("taskScheduler.js 錯誤：", error);
            }

            try {
                const taskExecutorPath = path.join(__dirname, "../schedulers/taskExecutor.js");
                startProcess(taskExecutorPath, "taskExecutor");
                console.log("已啟動 taskExecutor");

                // taskExecutorProcess.on("exit", (code) => {
                //     console.log(`已關閉 taskExecutor child process code : ${code}`);
                // });
            } catch (error) {
                console.error("taskExecutor.js 錯誤：", error);
            }
        }
    }

    // 檢查是否設置了 COMMIT_SHA 和 BRANCH_NAME
    const commitSha = process.env.COMMIT_SHA;
    const branchName = process.env.BRANCH_NAME;

    // 新增：從 project.json 讀取 version_name
    let versionName;
    try {
        const projectJsonPath = path.join(__dirname, "../project.json");
        const projectData = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
        versionName = projectData.version;
    } catch (error) {
        console.error("讀取 project.json 時發生錯誤：", error);
        return; // 如果讀取失敗，直接退出
    }

    if (!commitSha || !branchName) {
        console.warn("COMMIT_SHA 或 BRANCH_NAME 環境變數未設置，跳過版本插入操作");
        return; // 直接退出，不執行版本插入操作
    }

    // 將 COMMIT_SHA、BRANCH_NAME 和 version_name 寫入 deployment_records 表
    try {
        // 檢查該版本是否已存在
        const existingRecord = await DeploymentRecord.findOne({
            where: {
                commit_sha: commitSha,
                branch_name: branchName,
                version_name: versionName, // 新增：檢查 version_name
            },
        });

        if (existingRecord) {
            console.info("該版本已存在於資料庫中，跳過插入操作");
        } else {
            await DeploymentRecord.create({
                commit_sha: commitSha,
                branch_name: branchName,
                version_name: versionName, // 新增：插入 version_name
            });

            console.info("COMMIT_SHA、BRANCH_NAME 和 version_name 已插入至 deployment_records 表中");
        }
    } catch (error) {
        console.error("插入 COMMIT_SHA、BRANCH_NAME 和 version_name 時發生錯誤：", error);
    }
};

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    terminateAll();
    process.exit(1); // 結束主進程
});

process.on("SIGINT", () => {
    console.log("SIGINT received. Shutting down gracefully...");
    terminateAll();
    process.exit(0);
});

process.on("exit", () => {
    console.log("Main process exiting...");
    terminateAll();
});
