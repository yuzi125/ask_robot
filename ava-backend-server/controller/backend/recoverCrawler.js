const fs = require("fs");
const path = require("path");
const sql = require("../../db/pgsql");
const AdmZip = require("adm-zip");
const axios = require("axios");
require("../../utils/log-utils.js");
const axiosRetry = require("axios-retry").default;
const { processCrawlerFiles } = require("../../utils/crawler/processCrawlerFiles");

// 設定 axios-retry，重試 3 次，每次等待 2 秒
axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
        console.log(`重試第 ${retryCount} 次請求...`);
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

const action = "recoverCrawler";

(async function recoverCrawler() {
    let client;
    let connectionId;
    let pid;

    try {
        client = await sql.pool.connect();
        connectionId = await client.query("SELECT pg_backend_pid()");
        pid = connectionId.rows[0].pg_backend_pid;
        while (true) {
            await client.query("BEGIN");

            // 一次拿 5 個任務 怕打架 華打~
            const res = await client.query(`
                SELECT ct.*, cs.datasource_id, cs.crawler_id, c.site_id AS crawler_site_id, d.datasets_id
                FROM crawler_tasks ct
                JOIN crawler_synchronize cs ON ct.crawler_synchronize_id = cs.id
                JOIN crawler c ON cs.crawler_id = c.id
                JOIN datasource d ON cs.datasource_id = d.id
                WHERE ct.status IN ('pending','waiting','running', 'downloaded')
                FOR UPDATE SKIP LOCKED
                LIMIT 5
            `);

            const tasks = res.rows;

            if (tasks.length === 0) {
                await client.query("COMMIT");
                console.log("沒有任務要執行");
                break;
            }

            // 收集需要更新的 task id
            const taskIds = tasks.map((task) => task.id);

            // 更新任務狀態為 'processing'
            await client.query(
                `
                UPDATE crawler_tasks
                SET status = 'processing'
                WHERE id = ANY($1::bigint[])
                `,
                [taskIds]
            );

            await client.query("COMMIT");

            const crawlerSyncArray = tasks.map((task) => ({
                crawlerId: task.crawler_id,
                siteId: task.crawler_site_id,
                crawler_synchronize_id: task.crawler_synchronize_id,
                spider_uuid: task.spider_uuid,
                status: task.status,
                datasource_id: task.datasource_id,
                datasets_id: task.datasets_id,
            }));

            const crawlerSiteIds = [...new Set(crawlerSyncArray.map((item) => item.siteId))];

            let previousCrawlerDocumentsContentHashMap = await buildPreviousHashMap(crawlerSyncArray, client);

            const serializedHashMap = Object.fromEntries(previousCrawlerDocumentsContentHashMap);

            const { folder_name, upload_folder_id, datasetsFolderName, datasetsId, datasourceId, test } =
                await getAdditionalParams(tasks, client);
            await recoverCrawlerTasks(
                {
                    crawlerSyncArray,
                    folder_name,
                    upload_folder_id: datasetsFolderName,
                    datasetsFolderName,
                    datasetsId,
                    datasourceId,
                    previousCrawlerDocumentsContentHashMap: serializedHashMap,
                    crawlerSiteIds,
                    test,
                },
                client
            );
        }

        console.log(`(recoverCrawler)準備釋放資料庫連線 - Connection ID: ${pid}`);
        await client.release();
        console.log(`(recoverCrawler)資料庫連線釋放 - Connection ID: ${pid}`);
        process.exit(0);
    } catch (err) {
        if (client) {
            console.log(`(recoverCrawler)發生錯誤 資料庫連線釋放 - Connection ID: ${pid}`);
            await client.query("ROLLBACK");
            await client.release();
        }

        process.exit(1);
    }
})();

async function recoverCrawlerTasks(message, client) {
    const { crawlerSyncArray, datasetsFolderName, datasourceId, crawlerSiteIds } = message;
    try {
        const CRAWLER_API = process.env.CRAWLER_API;
        const CRAWLER_DOWNLOAD = process.env.CRAWLER_DOWNLOAD;
        console.log("開始恢復爬蟲任務喔，crawlerSiteIds:", crawlerSiteIds);

        for (const task of crawlerSyncArray) {
            await updateCrawlerTaskStatus(
                task.crawler_synchronize_id,
                task.spider_uuid,
                task.siteId,
                "running",
                "",
                client
            );
        }

        let completedSites = new Set();
        let terminatedSites = new Set();
        let folderMap = new Map();

        // 獲取所有 spider_uuid
        const spiderUUIDs = [...new Set(crawlerSyncArray.map((item) => item.spider_uuid).filter((uuid) => uuid))];

        // 同時處理所有 spider_uuid
        await Promise.all(
            spiderUUIDs.map(async (spider_uuid) => {
                let active = true;

                while (active) {
                    await new Promise((resolve) => setTimeout(resolve, 5000));

                    // 查詢該 spider_uuid 的所有站點狀態
                    let statusResponse;
                    try {
                        statusResponse = await axios.get(`${CRAWLER_API}/${spider_uuid}`, {
                            headers: { accept: "application/json" },
                        });
                    } catch (error) {
                        console.error(`取得爬蟲狀態失敗: ${spider_uuid}`, error);
                        throw new Error(error);
                    }

                    const { status, sites_status: sitesStatus } = statusResponse.data.data;

                    // 如果整個 spider_uuid 的任務已被終止，則更新所有相關站點狀態
                    if (status === "terminated") {
                        console.log(`爬蟲任務已終止 (UUID: ${spider_uuid})，正在更新相關站點狀態...`);
                        await Promise.all(
                            sitesStatus.map(async (site) => {
                                const siteKey = `${spider_uuid}_${site.site_id}`;

                                // 檢查是否已經完成，若已完成則跳過
                                if (site.status === "done" && !completedSites.has(siteKey)) {
                                    let syncItem = await getSyncItem(
                                        client,
                                        crawlerSyncArray,
                                        site.site_id,
                                        spider_uuid
                                    );
                                    await updateCrawlerTaskStatus(
                                        syncItem.crawler_synchronize_id,
                                        spider_uuid,
                                        site.site_id,
                                        "completed",
                                        "",
                                        client
                                    );
                                    completedSites.add(siteKey);
                                    return;
                                }

                                // 更新終止的站點狀態
                                if (!terminatedSites.has(siteKey)) {
                                    terminatedSites.add(siteKey);
                                    let syncItem = await getSyncItem(
                                        client,
                                        crawlerSyncArray,
                                        site.site_id,
                                        spider_uuid
                                    );
                                    await updateCrawlerTaskStatus(
                                        syncItem.crawler_synchronize_id,
                                        spider_uuid,
                                        site.site_id,
                                        "terminated",
                                        "",
                                        client
                                    );

                                    await updateCrawlerSynchronizeState(
                                        syncItem.crawler_synchronize_id,
                                        datasourceId,
                                        syncItem.crawlerId,
                                        98,
                                        client
                                    );
                                }
                            })
                        );
                        active = false;
                        continue;
                    }

                    // 處理站點的個別狀態
                    await Promise.all(
                        sitesStatus.map(async (site) => {
                            const siteKey = `${spider_uuid}_${site.site_id}`;

                            if (site.status === "failed" && !terminatedSites.has(siteKey)) {
                                let syncItem = await getSyncItem(client, crawlerSyncArray, site.site_id, spider_uuid);
                                console.log(`站點 ${site.site_id} (UUID: ${spider_uuid}) 爬蟲失敗`);
                                terminatedSites.add(siteKey);
                                await updateTerminatedSiteStatus(site.site_id, message, client);
                                await updateCrawlerTaskStatus(
                                    syncItem.crawler_synchronize_id,
                                    spider_uuid,
                                    site.site_id,
                                    "terminated",
                                    "",
                                    client
                                );
                            }

                            // 處理已完成的站點
                            if (site.status === "done" && !completedSites.has(siteKey)) {
                                completedSites.add(siteKey);

                                let syncItem = await getSyncItem(client, crawlerSyncArray, site.site_id, spider_uuid);

                                // 確認任務狀態不是已經是 completed
                                const currentStatus = await getCurrentTaskStatus(
                                    client,
                                    syncItem.crawler_synchronize_id,
                                    spider_uuid,
                                    site.site_id
                                );

                                if (currentStatus === "completed") {
                                    console.log(`任務 ${site.site_id} 已經完成，跳過下載和狀態更新`);
                                    return;
                                }

                                // 下載並解壓縮
                                const downloadUrl = `${CRAWLER_DOWNLOAD}/${site.cleaned_data_directory}`;
                                console.log(`下載 URL: ${downloadUrl}`);

                                let response;
                                try {
                                    response = await axios({
                                        method: "get",
                                        url: downloadUrl,
                                        responseType: "arraybuffer",
                                    });
                                } catch (error) {
                                    console.error(`下載檔案失敗: ${downloadUrl}`, error);
                                    throw new Error(error);
                                }

                                const uniqueFilename = `temp_${siteKey}_${Date.now()}.zip`;
                                const targetDirectory = path.join(__dirname, "../../resource", datasetsFolderName);
                                const zipFilePath = path.join(targetDirectory, uniqueFilename);

                                fs.writeFileSync(zipFilePath, response.data);
                                console.log(`ZIP 已保存到: ${zipFilePath}`);

                                const siteFolder = path.join(targetDirectory, siteKey);
                                folderMap.set(siteKey, siteFolder);
                                if (!fs.existsSync(siteFolder)) {
                                    fs.mkdirSync(siteFolder, { recursive: true });
                                }

                                const zip = new AdmZip(zipFilePath);
                                zip.extractAllTo(siteFolder, true);
                                console.log(`文件已解壓縮到: ${siteFolder}`);

                                fs.unlinkSync(zipFilePath);
                                console.log("臨時 ZIP 已删除");

                                // 更新 crawler_documents_content 和 crawler_tasks 狀態
                                await updateCrawlerTaskStatus(
                                    syncItem.crawler_synchronize_id,
                                    spider_uuid,
                                    site.site_id,
                                    "downloaded",
                                    "",
                                    client
                                );

                                await processSiteData(syncItem, message, siteKey, siteFolder, client);
                                await updateCrawlerTaskStatus(
                                    syncItem.crawler_synchronize_id,
                                    spider_uuid,
                                    site.site_id,
                                    "completed",
                                    "",
                                    client
                                );

                                if (fs.existsSync(siteFolder)) {
                                    fs.rmSync(siteFolder, { recursive: true, force: true });
                                    console.log(`資料夾已刪除: ${siteFolder}`);
                                }
                            }
                        })
                    );

                    const runningSites = sitesStatus.filter(
                        (site) => site.status !== "done" && site.status !== "terminated" && site.status !== "failed"
                    );

                    if (runningSites.length > 0) {
                        console.log(`當前運行中的站點狀態 (UUID: ${spider_uuid}):`, runningSites);
                    }

                    if (runningSites.length === 0) {
                        active = false;
                    }
                }
            })
        );

        console.log("所有爬蟲和清洗過程完成");
    } catch (error) {
        console.error("恢復爬蟲任務的過程中出錯:", error);
        await Promise.all(
            crawlerSyncArray.map((task) => {
                updateCrawlerSynchronizeState(task.crawler_synchronize_id, datasourceId, task.crawlerId, 99, client);
                return updateCrawlerTaskStatus(
                    task.crawler_synchronize_id,
                    task.spider_uuid,
                    task.siteId,
                    "terminated",
                    "",
                    client
                );
            })
        );
        // process.exit(1);
    }
}

async function processSiteData(siteData, message, siteKey, siteFolder, client) {
    try {
        const { siteId } = siteData;

        const siteMessage = {
            ...message,
            crawlerSyncArray: [siteData],
            siteKey: siteKey,
            siteFolder: siteFolder,
        };

        await processCrawlerFiles(client, action, siteMessage);

        console.log(`檔案已處理完畢: ${siteId}`);
    } catch (error) {
        console.error(`處理站點 ${siteId} 的檔案時發生錯誤:`, error);
    }
}

async function buildPreviousHashMap(crawlerSyncArray, client) {
    try {
        let previousCrawlerDocumentsContentHashMap = new Map();

        for (let syncItem of crawlerSyncArray) {
            const { crawlerId, siteId, datasource_id } = syncItem;

            let rs = await client.query(
                "SELECT id FROM crawler_synchronize WHERE datasource_id = $1 AND crawler_id = $2",
                [datasource_id, crawlerId]
            );

            const previousCrawlerSynchronizeIds = rs.rows.map((m) => +m.id);
            if (previousCrawlerSynchronizeIds.length > 0) {
                rs = await client.query(
                    `SELECT crawler_synchronize_id, crawler_documents_id, hash 
                FROM crawler_documents_content 
                WHERE crawler_synchronize_id = ANY($1::bigint[]) 
                AND training_state IN (3, 4)`,
                    [previousCrawlerSynchronizeIds]
                );

                rs.rows.forEach((item) => {
                    const { crawler_synchronize_id, crawler_documents_id, hash } = item;
                    const key = `${siteId}|${crawlerId}|${hash}`;
                    previousCrawlerDocumentsContentHashMap.set(key, {
                        crawler_synchronize_id,
                        crawler_documents_id,
                    });
                });
            }
        }

        return previousCrawlerDocumentsContentHashMap;
    } catch (error) {
        console.error(`建立 previousCrawlerDocumentsContentHashMap 時發生錯誤:`, error);
        throw error;
    }
}

async function getAdditionalParams(tasks, client) {
    // 從 tasks 中取得 datasetsId 和 datasourceId
    const datasetsId = tasks[0]?.datasets_id;
    const datasourceId = tasks[0]?.datasource_id;

    // 取得 datasetsFolderName
    let rs = await client.query("SELECT folder_name FROM datasets WHERE id = $1", [datasetsId]);
    const datasetsFolderName = rs.rows[0]?.folder_name;

    // 取得 folder_name 和 upload_folder_id
    let upload_folder_id = "";
    let folder_name = "";

    // 查詢 upload_folder，如果有的话
    rs = await client.query("SELECT id, name FROM upload_folder WHERE datasource_id = $1", [datasourceId]);
    if (rs.rows.length > 0) {
        upload_folder_id = rs.rows[0].id;
        folder_name = rs.rows[0].name;
    }

    const test = false; // 測試狀態 先不要動

    return {
        folder_name,
        upload_folder_id,
        datasetsFolderName,
        datasetsId,
        datasourceId,
        test,
    };
}

async function updateCrawlerTaskStatus(crawler_synchronize_id, spider_uuid, site_id, status, dir, client) {
    try {
        // 先檢查該記錄是否已經存在
        const existingTask = await client.query(
            `
            SELECT id FROM crawler_tasks 
            WHERE spider_uuid = $1 AND site_id = $2
            `,
            [spider_uuid, site_id]
        );
        let result;

        // 如果記錄已經存在，進行更新操作
        if (existingTask.rows.length > 0) {
            result = await client.query(
                `
                UPDATE crawler_tasks 
                SET status = $3, update_time = CURRENT_TIMESTAMP
                WHERE spider_uuid = $1 AND site_id = $2
                RETURNING id
                `,
                [spider_uuid, site_id, status]
            );
        } else {
            console.log("not found", crawler_synchronize_id, spider_uuid, site_id);
        }

        return result.rows[0].id;
    } catch (error) {
        console.error(`更新任務狀態時出錯:`, error);
        throw error;
    }
}

async function updateTerminatedSiteStatus(siteId, message, client) {
    try {
        const siteData = message.crawlerSyncArray.find((item) => item.siteId === siteId);
        if (siteData) {
            const { crawlerId, crawler_synchronize_id } = siteData;
            await client.query(
                "UPDATE crawler_synchronize SET training_state = $1 WHERE id = $2 AND datasource_id = $3 AND crawler_id = $4",
                [98, crawler_synchronize_id, message.datasourceId, crawlerId]
            );
            console.log(`已更新被終止的站點 ${siteId} 的 training_state 為 98`);
        }
    } catch (error) {
        console.error(`更新被終止站點 ${siteId} 狀態時出錯:`, error);
    }
}

async function updateCrawlerSynchronizeState(
    crawler_synchronize_id,
    datasource_id,
    crawler_id,
    training_state,
    client
) {
    try {
        await client.query(
            `
            UPDATE crawler_synchronize
            SET training_state = $1
            WHERE id = $2 AND datasource_id = $3 AND crawler_id = $4
            `,
            [training_state, crawler_synchronize_id, datasource_id, crawler_id]
        );
        console.log(`更新 crawler_synchronize_id=${crawler_synchronize_id} 的 training_state 為 ${training_state}`);
    } catch (error) {
        console.error(`更新 crawler_synchronize 狀態時出錯:`, error);
        throw error;
    }
}

async function getSyncItem(client, crawlerSyncArray, siteId, spiderUuid) {
    // 首先嘗試從 crawlerSyncArray 中找到對應的項目
    let syncItem = crawlerSyncArray.find((item) => item.siteId === siteId && item.spider_uuid === spiderUuid);

    if (!syncItem) {
        // 如果 crawlerSyncArray 中找不到，則查詢資料庫以獲取 syncItem
        const queryRes = await client.query(
            `
            SELECT cs.id AS crawler_synchronize_id, cs.crawler_id AS "crawlerId"
            FROM crawler_synchronize cs
            JOIN crawler_tasks ct ON ct.crawler_synchronize_id = cs.id
            WHERE ct.site_id = $1 AND ct.spider_uuid = $2
            `,
            [siteId, spiderUuid]
        );

        syncItem = queryRes.rows[0];

        if (!syncItem) {
            console.error(`未找到對應的任務： site_id: ${siteId}, spider_uuid: ${spiderUuid}`);
            return null;
        }
    }

    return syncItem;
}

async function getCurrentTaskStatus(client, crawler_synchronize_id, spider_uuid, site_id) {
    try {
        // 查詢資料庫中該任務的當前狀態
        const res = await client.query(
            `
        SELECT status 
        FROM crawler_tasks 
        WHERE crawler_synchronize_id = $1 AND spider_uuid = $2 AND site_id = $3
        `,
            [crawler_synchronize_id, spider_uuid, site_id]
        );

        if (res.rows.length > 0) {
            return res.rows[0].status;
        }

        return null; // 如果沒有找到該任務，返回 null
    } catch (error) {
        console.error(`取得當前任務狀態時發生錯誤:`, error);
        throw error;
    }
}

process.on("unhandledRejection", (reason, promise) => {
    console.error("(recoverCrawler.js)未處理的 Promise 拒絕:", reason);
    console.error("(recoverCrawler.js)Promise:", promise);
});

process.on("uncaughtException", (error) => {
    console.error("(recoverCrawler.js)未捕獲的異常:", error);
});
