const fs = require("fs");
const path = require("path");
const sql = require("../../db/pgsql");
const AdmZip = require("adm-zip");
const axios = require("axios");
require("../../utils/log-utils.js");
const axiosRetry = require("axios-retry").default;
const { processCrawlerFiles } = require("../../utils/crawler/processCrawlerFiles");
const { processCrawlerAttachmentFiles } = require("../../utils/crawler/processCrawlerAttachmentFiles");

const action = "syncCrawler";

// 設定 axios-retry，重試 3 次，每次等待 2 秒
axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount, error) => {
        // 獲取請求的URL信息
        const requestUrl = error?.config?.url || "未知網址";
        const requestMethod = error?.config?.method?.toUpperCase() || "UNKNOWN";

        console.log(`重試第 ${retryCount} 次請求... ${requestMethod} ${requestUrl}`);
        console.log(`錯誤信息: ${error.message}`);

        return retryCount * 2000; // 每次重試等待時間
    },
    retryCondition: (error) => {
        // 只在 socket hang up 或 5xx 狀態碼時重試
        return (
            axiosRetry.isNetworkOrIdempotentRequestError(error) ||
            error.code === "ECONNABORTED" ||
            error.message.includes("socket hang up")
        );
    },
});

async function syncCrawler(siteIds, datasetsFolderName, message, syncTableName, taskTableName, type, client) {
    try {
        const CRAWLER_ATTACHMENT_API = process.env.CRAWLER_ATTACHMENT_API;
        const CRAWLER_API = process.env.CRAWLER_API;
        const CRAWLER_DOWNLOAD = process.env.CRAWLER_DOWNLOAD;

        if (type === "attachment") {
            console.log("開始同步爬蟲附件，site_ids:", siteIds);
        } else {
            console.log("開始同步爬蟲，site_ids:", siteIds);
        }

        // 檢查並清空資料夾
        const targetDirectory = path.join(__dirname, "../../resource", datasetsFolderName);

        // clearDirectory(targetDirectory);
        // console.log(`資料夾 ${targetDirectory} 已清空`);

        // 確保目標資料夾存在
        if (!fs.existsSync(targetDirectory)) {
            fs.mkdirSync(targetDirectory, { recursive: true });
        }

        // 步驟1：發送爬蟲請求
        const spiderResponse = await axios.post(
            type === "attachment" ? `${CRAWLER_ATTACHMENT_API}/download` : CRAWLER_API,
            { site_ids: siteIds },
            {
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                },
            }
        );

        if (!spiderResponse.data.result) {
            throw new Error("爬蟲請求失敗");
        }

        const spiderUuids = spiderResponse.data.data.uuid;
        console.log("爬蟲請求成功，獲得 spider UUIDs:", spiderUuids);

        let completedSites = new Set();
        let terminatedSites = new Set();
        let activeUuids = [];

        if (type === "attachment") {
            activeUuids = [spiderUuids];
        } else {
            activeUuids = [...spiderUuids];
        }

        let processingPromises = [];
        let folderMap = new Map();

        while (activeUuids.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            for (let i = activeUuids.length - 1; i >= 0; i--) {
                const spiderUuid = activeUuids[i];

                const statusResponse = await axios.get(`${CRAWLER_API}/${spiderUuid}`, {
                    headers: { accept: "application/json" },
                });

                if (!statusResponse.data.result) {
                    console.error(`獲取爬蟲狀態失敗: ${spiderUuid}`);
                    continue;
                }

                const siteDir = statusResponse.data.data.dir;

                if (statusResponse.data.data.status === "terminated") {
                    console.log(`整個爬蟲任務被終止 (UUID: ${spiderUuid})`);
                    const tasks = await getTasksByUuid(spiderUuid, taskTableName, client);

                    // 檢查 sites_status 狀態
                    const sitesStatus = statusResponse.data.data.sites_status;

                    for (const task of tasks) {
                        const siteStatus = sitesStatus.find((site) => site.site_id === task.site_id);
                        // 如果該站點的狀態為 "done"，則不更新該站點的狀態
                        if (siteStatus && siteStatus.status === "done") {
                            console.log(`站點 ${task.site_id} 已經完成 (done)，跳過狀態更新`);
                            continue;
                        }

                        const siteKey = `${spiderUuid}_${task.site_id}`;
                        if (!terminatedSites.has(siteKey)) {
                            terminatedSites.add(siteKey);
                            await updateTerminatedSiteStatus(task.site_id, message, syncTableName, client);
                            await updateCrawlerTaskStatus(
                                task.crawler_synchronize_id,
                                spiderUuid,
                                task.site_id,
                                "terminated",
                                "",
                                taskTableName,
                                client
                            );
                        }
                    }
                    activeUuids.splice(i, 1);
                    continue;
                }

                const sitesStatus = statusResponse.data.data.sites_status;
                const runningSites = sitesStatus.filter(
                    (site) => site.status !== "done" && site.status !== "terminated"
                );
                if (runningSites.length > 0) {
                    console.log(`當前運行中的站點狀態 (UUID: ${spiderUuid}):`, runningSites);
                }
                let allSitesDone = true;
                for (let site of sitesStatus) {
                    const siteKey = `${spiderUuid}_${site.site_id}`;
                    const syncItem = message.crawlerSyncArray.find((item) => item.siteId === site.site_id);

                    if (!syncItem) {
                        continue;
                    }

                    const { crawler_synchronize_id } = syncItem;
                    if (site.status === "failed" && !terminatedSites.has(siteKey)) {
                        console.log(`站點 ${site.site_id} (UUID: ${spiderUuid}) 爬蟲失敗`);
                        terminatedSites.add(siteKey);
                        await updateTerminatedSiteStatus(site.site_id, message, syncTableName, client);
                        await updateCrawlerTaskStatus(
                            crawler_synchronize_id,
                            spiderUuid,
                            site.site_id,
                            "terminated",
                            "",
                            taskTableName,
                            client
                        );
                    } else if (site.status === "done" && !completedSites.has(siteKey)) {
                        console.log(`站點 ${site.site_id} (UUID: ${spiderUuid}) 爬蟲和清洗完成`);
                        completedSites.add(siteKey);

                        // 下載並解壓縮
                        const downloadUrl = `${CRAWLER_DOWNLOAD}/${site.cleaned_data_directory}`;
                        console.log(`下載 URL: ${downloadUrl}`);

                        const response = await axios({
                            method: "get",
                            url: downloadUrl,
                            responseType: "arraybuffer",
                        });

                        const uniqueFilename = `temp_${siteKey}_${Date.now()}.zip`;
                        const zipFilePath = path.join(targetDirectory, uniqueFilename);

                        fs.writeFileSync(zipFilePath, response.data);
                        console.log(`ZIP 文件已保存到: ${zipFilePath}`);

                        const siteFolder = path.join(targetDirectory, siteKey);
                        folderMap.set(siteKey, siteFolder);
                        if (!fs.existsSync(siteFolder)) {
                            fs.mkdirSync(siteFolder, { recursive: true });
                        }

                        const zip = new AdmZip(zipFilePath);
                        zip.extractAllTo(siteFolder, true);
                        console.log(`文件已解壓縮到: ${siteFolder}`);

                        fs.unlinkSync(zipFilePath);
                        console.log("臨時 ZIP 文件已刪除");

                        await updateCrawlerTaskStatus(
                            crawler_synchronize_id,
                            spiderUuid,
                            site.site_id,
                            "downloaded",
                            "",
                            taskTableName,
                            client
                        );

                        const processingPromise = processSiteData(
                            syncItem,
                            message,
                            siteKey,
                            siteFolder,
                            type,
                            client
                        ).then(async () => {
                            await updateCrawlerTaskStatus(
                                crawler_synchronize_id,
                                spiderUuid,
                                site.site_id,
                                "completed",
                                "",
                                taskTableName,
                                client
                            );
                        });
                        processingPromises.push(processingPromise);
                    } else if (site.status === "waiting") {
                        await updateCrawlerTaskStatus(
                            crawler_synchronize_id,
                            spiderUuid,
                            site.site_id,
                            "waiting",
                            siteDir,
                            taskTableName,
                            client
                        );
                    } else if (site.status === "running") {
                        await updateCrawlerTaskStatus(
                            crawler_synchronize_id,
                            spiderUuid,
                            site.site_id,
                            "running",
                            siteDir,
                            taskTableName,
                            client
                        );
                    }

                    if (site.status !== "done" && site.status !== "terminated" && site.status !== "failed") {
                        allSitesDone = false;
                    }
                }

                if (allSitesDone) {
                    activeUuids.splice(i, 1);
                }
            }
        }

        await Promise.all(processingPromises);

        // 處理完成後刪除資料夾
        for (let [siteKey, folder] of folderMap) {
            if (fs.existsSync(folder)) {
                fs.rmSync(folder, { recursive: true, force: true }); // 改用 fs.rmSync
                console.log(`資料夾已刪除: ${folder}`);
            }
        }

        console.log("所有爬蟲和清洗過程完成");
        console.log(`完成的站點: ${JSON.stringify(Array.from(completedSites))} 共 ${completedSites.size} 個站點`);
        console.log(`被終止的站點: ${JSON.stringify(Array.from(terminatedSites))} 共 ${terminatedSites.size} 個站點`);

        return {
            result: "success",
            completedSites: Array.from(completedSites),
            terminatedSites: Array.from(terminatedSites),
            completedCount: completedSites.size,
            terminatedCount: terminatedSites.size,
        };
    } catch (error) {
        console.error("同步爬蟲過程出錯:", error);
        throw error;
    }
}

async function updateCrawlerTaskStatus(
    crawler_synchronize_id,
    spider_uuid,
    site_id,
    status,
    dir,
    taskTableName,
    client
) {
    try {
        // 先檢查該記錄是否已經存在
        const existingTask = await client.query(
            `
            SELECT id FROM ${taskTableName} 
            WHERE crawler_synchronize_id = $1 AND spider_uuid = $2 AND site_id = $3
            `,
            [crawler_synchronize_id, spider_uuid, site_id]
        );

        let result;

        if (existingTask.rows.length > 0) {
            // 如果記錄已經存在，進行更新操作
            result = await client.query(
                `
                UPDATE ${taskTableName} 
                SET status = $4, update_time = CURRENT_TIMESTAMP
                WHERE crawler_synchronize_id = $1 AND spider_uuid = $2 AND site_id = $3
                RETURNING id
                `,
                [crawler_synchronize_id, spider_uuid, site_id, status]
            );
        } else {
            // 如果記錄不存在，進行插入操作
            const progress = JSON.stringify({ dir });

            result = await client.query(
                `
                INSERT INTO ${taskTableName} 
                (crawler_synchronize_id, spider_uuid, site_id, status, progress)
                VALUES ($1, $2, $3, $4, $5::jsonb)
                RETURNING id
                `,
                [crawler_synchronize_id, spider_uuid, site_id, status, progress]
            );
        }

        return result.rows[0].id;
    } catch (error) {
        console.error(`更新任務狀態時出錯:`, error);
        throw error;
    }
}

async function getTasksByUuid(spider_uuid, taskTableName, client) {
    const result = await client.query(
        `
        SELECT * FROM ${taskTableName}
        WHERE spider_uuid = $1
        `,
        [spider_uuid]
    );
    return result.rows;
}

async function updateTerminatedSiteStatus(siteId, message, syncTableName, client) {
    try {
        const siteData = message.crawlerSyncArray.find((item) => item.siteId === siteId);
        if (siteData) {
            const { crawlerId, crawler_synchronize_id } = siteData;
            await client.query(
                `UPDATE ${syncTableName} SET training_state = $1 WHERE id = $2 AND datasource_id = $3 AND crawler_id = $4`,
                [98, crawler_synchronize_id, message.datasourceId, crawlerId]
            );
            console.log(`已更新被終止的站點 ${siteId} 的 training_state 為 98`);
        }
    } catch (error) {
        console.error(`更新被終止站點 ${siteId} 狀態時出錯:`, error);
    }
}

async function processSiteData(siteData, message, siteKey, siteFolder, type, client) {
    const { siteId } = siteData;

    // 更新資料庫

    // 處理檔案
    const siteMessage = {
        ...message,
        crawlerSyncArray: [siteData],
        siteKey: siteKey,
        siteFolder: siteFolder,
    };

    if (type === "attachment") {
        await processCrawlerAttachmentFiles(client, action, siteMessage);
    } else {
        await processCrawlerFiles(client, action, siteMessage);
    }

    console.log(`檔案已處理完畢: ${siteId}`);
}

process.on("message", async (message) => {
    // 將物件轉換回 Map
    let client;
    let connectionId;
    let pid;
    let type = message.type;
    const syncTableName = type === "attachment" ? "crawler_attachment_synchronize" : "crawler_synchronize";
    const taskTableName = type === "attachment" ? "crawler_attachment_tasks" : "crawler_tasks";
    try {
        client = await sql.pool.connect();
        connectionId = await client.query("SELECT pg_backend_pid()");
        pid = connectionId.rows[0].pg_backend_pid;

        // 替換 message 中的 Map
        if (type !== "attachment") {
            const previousCrawlerDocumentsContentHashMap = new Map(
                Object.entries(message.previousCrawlerDocumentsContentHashMap)
            );
            message.previousCrawlerDocumentsContentHashMap = previousCrawlerDocumentsContentHashMap;
        }
        // console.log("previousCrawlerDocumentsContentHashMap", previousCrawlerDocumentsContentHashMap);

        // 測試先拿 pwib(29個) 和 kgo(7個)
        if (message?.test !== "test") {
            // const crawlerResult = await syncCrawler(message?.crawlerSiteIds, message?.datasetsFolderName);

            const crawlerResult = await syncCrawler(
                message.crawlerSiteIds,
                message.datasetsFolderName,
                message,
                syncTableName,
                taskTableName,
                type,
                client
            );
            if (crawlerResult.result === "success") {
                console.log("所有站點處理完成");
            } else {
                // 不是 success 就代表有問題 可能爬蟲被中斷了 要把 training_state 設為 98 爬蟲錯誤
                const updatePromises = message.crawlerSyncArray.map(({ crawlerId, crawler_synchronize_id }) =>
                    client.query(
                        `update ${syncTableName} set training_state = $1 where id = $2 and datasource_id = $3 and crawler_id = $4`,
                        [98, crawler_synchronize_id, message.datasourceId, crawlerId]
                    )
                );

                await Promise.all(updatePromises);
            }
        } else {
            const updatePromises = message.crawlerSyncArray.map(({ crawlerId, crawler_synchronize_id }) =>
                client.query(
                    `update ${syncTableName} set training_state = $1 where id = $2 and datasource_id = $3 and crawler_id = $4`,
                    [2, crawler_synchronize_id, message.datasourceId, crawlerId]
                )
            );

            // 同時執行資料庫更新操作和背景處理檔案
            await Promise.all([
                Promise.all(updatePromises), // 執行資料庫更新
                // processCrawlerFiles(client, action, message), // 處理檔案
                processCrawlerAttachmentFiles(client, action, message),
            ]);
        }
        process.exit();
    } catch (error) {
        // 爬蟲錯誤
        const updatePromises = message.crawlerSyncArray.map(({ crawlerId, crawler_synchronize_id }) =>
            client.query(
                "update crawler_synchronize set training_state = $1 where id = $2 and datasource_id = $3 and crawler_id = $4",
                [98, crawler_synchronize_id, message.datasourceId, crawlerId]
            )
        );

        await Promise.all(updatePromises);
        console.log("process error", error);
        process.exit();
    } finally {
        console.log(`(backgroundProcess)準備釋放資料庫連線 - Connection ID: ${pid}`);
        await client.release();
        console.log(`(backgroundProcess)資料庫連線釋放 - Connection ID: ${pid}`);
    }
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
    // 可以選擇進行適當的恢復操作或進行重啟
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err.message, err.stack);
    // 可以選擇進行適當的恢復操作或進行重啟
});

process.on("exit", () => {
    console.log("檔案處理完成 退出 process");
    process.exit();
});
