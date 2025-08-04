const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const axios = require("axios");
const { processCrawlerFiles } = require("../../utils/crawler/processCrawlerFiles");

const axiosRetry = require("axios-retry").default;

const action = "schedulerCrawler";

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

// todo: 把變數命名統一
async function processSyncCrawler(params) {
    const { crawlerIds, datasourceId, datasetsId, folder, client: sql } = params;
    let crawlerSyncArray = [];
    let crawlerSiteIds = [];
    try {
        const folder_name = folder && folder.name ? folder.name : "";
        let rs;

        let upload_folder_id = "";

        // 獲取 datasets folder_name
        rs = await sql.query("SELECT folder_name FROM datasets WHERE id = $1", [datasetsId]);
        const datasetsFolderName = rs.rows[0]?.folder_name;
        upload_folder_id = datasetsFolderName;

        if (folder_name) {
            rs = await sql.query("SELECT id FROM upload_folder WHERE name = $1 AND datasourceId = $2", [
                folder_name,
                datasourceId,
            ]);

            if (rs.rows.length > 0) {
                upload_folder_id = rs.rows[0].id;
            }
        }

        let previousCrawlerDocumentsContentHashMap = new Map();
        const taskMap = new Map();

        for (let crawlerId of crawlerIds) {
            rs = await sql.query("SELECT site_id FROM crawler WHERE id = $1", [crawlerId]);
            const siteId = rs.rows[0]?.site_id;
            crawlerSiteIds.push(siteId);

            rs = await sql.query("SELECT id FROM crawler_synchronize WHERE datasource_id = $1 AND crawler_id = $2", [
                datasourceId,
                crawlerId,
            ]);

            const previousCrawlerSynchronizeIds = rs.rows.map((m) => +m.id);

            if (previousCrawlerSynchronizeIds.length > 0) {
                rs = await sql.query(
                    "SELECT crawler_synchronize_id, crawler_documents_id, hash FROM crawler_documents_content WHERE crawler_synchronize_id = ANY($1::bigint[]) AND (crawler_documents_content.training_state = 3 OR crawler_documents_content.training_state = 4)",
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

            rs = await sql.query("SELECT config_jsonb FROM crawler WHERE id = $1", [crawlerId]);
            const crawlerConfigJsonb = rs.rows[0]?.config_jsonb;

            rs = await sql.query(
                "INSERT INTO crawler_synchronize (config_jsonb, datasource_id, crawler_id, training_state) VALUES($1, $2, $3, $4) RETURNING id",
                [crawlerConfigJsonb, datasourceId, crawlerId, 1]
            );

            const crawler_synchronize_id = +rs.rows[0]?.id;
            if (!crawler_synchronize_id) throw new Error("Failed to insert crawler_synchronize");

            crawlerSyncArray.push({ crawlerId, siteId, crawler_synchronize_id });
            taskMap.set(crawlerId, { status: "pending", crawler_synchronize_id });
        }
        console.log("爬蟲同步資料新增完成");

        const onSiteComplete = async (crawlerId, siteId) => {
            try {
                const task = taskMap.get(crawlerId);
                if (task) {
                    task.status = "completed";
                    // 更新對應的 task_operations
                    await sql.query(
                        `
                    UPDATE task_operations 
                    SET status = 'completed' 
                    WHERE params->>'crawler_id' = $1 AND params->>'dataset_id' = $2
                `,
                        [crawlerId, datasetsId]
                    );
                }
            } catch (error) {
                console.error(`(onSiteComplete) 更新 task_operations 時發生錯誤:`, error);
            }
        };

        const onSiteError = async (crawlerId, siteId, error) => {
            try {
                console.error(`站點 ${siteId} 處理失敗:`, error);
                const task = taskMap.get(crawlerId);
                if (task) {
                    task.status = "failed";
                    await sql.query(
                        `
                    UPDATE task_operations 
                    SET status = 'failed' 
                    WHERE params->>'crawler_id' = $1 AND params->>'dataset_id' = $2
                `,
                        [crawlerId, datasetsId]
                    );
                }
            } catch (error) {
                console.error(`(onSiteError) 更新 task_operations 時發生錯誤:`, error);
            }
        };

        const result = await syncCrawler(sql, crawlerSiteIds, datasetsFolderName, {
            crawlerSyncArray,
            folder_name,
            upload_folder_id,
            datasetsFolderName,
            datasetsId,
            datasourceId,
            previousCrawlerDocumentsContentHashMap,
            onSiteComplete,
            onSiteError,
        });

        if (result.result === "success") {
            return { result: "success" };
        } else {
            throw new Error("排程同步爬蟲過程出錯: ", result.error);
        }
    } catch (error) {
        // console.error("sync crawler fail", error);
        console.log("crawlerSyncArray", crawlerSyncArray);
        const updatePromises = crawlerSyncArray.map(({ crawlerId, crawler_synchronize_id }) =>
            sql.query(
                "update crawler_synchronize set training_state = $1 where id = $2 and datasource_id = $3 and crawler_id = $4",
                [98, crawler_synchronize_id, datasourceId, crawlerId]
            )
        );

        await Promise.all(updatePromises);
        return { result: "fail" };
    }
}

async function syncCrawler(sql, siteIds, datasetsFolderName, message) {
    try {
        const CRAWLER_API = process.env.CRAWLER_API;
        const CRAWLER_DOWNLOAD = process.env.CRAWLER_DOWNLOAD;
        console.log("開始同步爬蟲過程，site_ids:", siteIds);

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
            CRAWLER_API,
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

        // 為每個 UUID 和 site_id 組合創建任務，但只創建實際存在的組合
        for (const spiderUuid of spiderUuids) {
            const statusResponse = await axios.get(`${CRAWLER_API}/${spiderUuid}`, {
                headers: { accept: "application/json" },
            });

            if (!statusResponse.data.result) {
                console.error(`獲取爬蟲狀態失敗: ${spiderUuid}`);
                continue;
            }

            const sitesStatus = statusResponse.data.data.sites_status;
            for (const site of sitesStatus) {
                const syncItem = message.crawlerSyncArray.find((item) => item.siteId === site.site_id);
                if (syncItem) {
                    await updateCrawlerTaskStatus(
                        sql,
                        syncItem.crawler_synchronize_id,
                        spiderUuid,
                        site.site_id,
                        "pending"
                    );
                }
            }
        }

        let completedSites = new Set();
        let terminatedSites = new Set();
        let activeUuids = [...spiderUuids];
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
                    const tasks = await getTasksByUuid(sql, spiderUuid);

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
                            await updateTerminatedSiteStatus(sql, task.site_id, message);
                            await updateCrawlerTaskStatus(
                                sql,
                                task.crawler_synchronize_id,
                                spiderUuid,
                                task.site_id,
                                "terminated"
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
                        await updateTerminatedSiteStatus(sql, site.site_id, message);
                        await updateCrawlerTaskStatus(
                            sql,
                            crawler_synchronize_id,
                            spiderUuid,
                            site.site_id,
                            "terminated"
                        );
                    } else if (site.status === "done" && !completedSites.has(siteKey)) {
                        try {
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
                                sql,
                                crawler_synchronize_id,
                                spiderUuid,
                                site.site_id,
                                "downloaded"
                            );
                            const processingPromise = processSiteData(sql, syncItem, message, siteKey, siteFolder)
                                .then(async () => {
                                    console.log(`開始更新站點 ${syncItem.siteId} 的狀態`);
                                    try {
                                        await updateCrawlerTaskStatus(
                                            sql,
                                            crawler_synchronize_id,
                                            spiderUuid,
                                            site.site_id,
                                            "completed"
                                        );
                                        console.log("任務狀態更新完成");

                                        await message.onSiteComplete(syncItem.crawlerId, site.site_id);
                                        console.log("站點完成處理");
                                    } catch (error) {
                                        console.error("更新任務狀態或完成處理時出錯:", error);
                                        throw error;
                                    }
                                })
                                .catch(async (error) => {
                                    console.error(`處理站點 ${syncItem.siteId} 時發生錯誤:`, error);
                                    try {
                                        await message.onSiteError(syncItem.crawlerId, site.site_id, error);
                                        console.error("錯誤已記錄到資料庫");
                                    } catch (logError) {
                                        console.error("記錄錯誤到資料庫時失敗:", logError);
                                    }
                                    throw error;
                                });
                            processingPromises.push(processingPromise);
                        } catch (error) {
                            console.log("處理站點資料時出錯:", error);
                        }
                        console.log(`站點 ${site.site_id} (UUID: ${spiderUuid}) 爬蟲和清洗完成`);
                        completedSites.add(siteKey);
                    } else if (site.status === "waiting") {
                        await updateCrawlerTaskStatus(
                            sql,
                            crawler_synchronize_id,
                            spiderUuid,
                            site.site_id,
                            "waiting",
                            siteDir
                        );
                    } else if (site.status === "running") {
                        await updateCrawlerTaskStatus(
                            sql,
                            crawler_synchronize_id,
                            spiderUuid,
                            site.site_id,
                            "running",
                            siteDir
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

        try {
            await Promise.all(processingPromises).catch((error) => {
                console.error("處理所有站點時發生錯誤:", error);
                throw error;
            });

            console.log("所有站點處理完成");
        } catch (error) {
            console.error("Promise.all 執行失敗:", error);
            throw error;
        }

        // 處理完成後刪除資料夾
        for (let [siteKey, folder] of folderMap) {
            if (fs.existsSync(folder)) {
                await fs.promises.rmdir(folder, { recursive: true });
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
        console.error("排程同步爬蟲過程出錯:", error);
        return {
            result: "error",
            error: error,
        };
    }
}

async function updateCrawlerTaskStatus(sql, crawler_synchronize_id, spider_uuid, site_id, status, dir) {
    try {
        // 先檢查該記錄是否已經存在
        const existingTask = await sql.query(
            `
            SELECT id FROM crawler_tasks 
            WHERE crawler_synchronize_id = $1 AND spider_uuid = $2 AND site_id = $3
            `,
            [crawler_synchronize_id, spider_uuid, site_id]
        );

        let result;

        if (existingTask.rows.length > 0) {
            // 如果記錄已經存在，進行更新操作
            result = await sql.query(
                `
                UPDATE crawler_tasks 
                SET status = $4, update_time = CURRENT_TIMESTAMP
                WHERE crawler_synchronize_id = $1 AND spider_uuid = $2 AND site_id = $3
                RETURNING id
                `,
                [crawler_synchronize_id, spider_uuid, site_id, status]
            );
        } else {
            // 如果記錄不存在，進行插入操作
            const progress = JSON.stringify({ dir });

            result = await sql.query(
                `
                INSERT INTO crawler_tasks 
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

async function getTasksByUuid(sql, spider_uuid) {
    const result = await sql.query(
        `
        SELECT * FROM crawler_tasks
        WHERE spider_uuid = $1
        `,
        [spider_uuid]
    );
    return result.rows;
}

async function updateTerminatedSiteStatus(sql, siteId, message) {
    try {
        const siteData = message.crawlerSyncArray.find((item) => item.siteId === siteId);
        if (siteData) {
            const { crawlerId, crawler_synchronize_id } = siteData;
            await sql.query(
                "UPDATE crawler_synchronize SET training_state = $1 WHERE id = $2 AND datasource_id = $3 AND crawler_id = $4",
                [98, crawler_synchronize_id, message.datasourceId, crawlerId]
            );
            console.log(`已更新被終止的站點 ${siteId} 的 training_state 為 98`);
        }
    } catch (error) {
        console.error(`更新被終止站點 ${siteId} 狀態時出錯:`, error);
    }
}
async function processSiteData(sql, siteData, message, siteKey, siteFolder) {
    const { siteId } = siteData;
    const PROCESS_TIMEOUT = 60 * 60 * 1000; // 1小時超時

    try {
        // 使用 Promise.race 來實現超時機制
        await Promise.race([
            // 實際的處理邏輯
            (async () => {
                console.log(`開始處理站點 ${siteId} 的檔案`);
                const siteMessage = {
                    ...message,
                    crawlerSyncArray: [siteData],
                    siteKey: siteKey,
                    siteFolder: siteFolder,
                };

                await processCrawlerFiles(sql, action, siteMessage);
                console.log(`站點 ${siteId} 的檔案處理完成`);
            })(),

            // 超時處理
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`處理站點 ${siteId} 的檔案超時（${PROCESS_TIMEOUT / 1000}秒）`));
                }, PROCESS_TIMEOUT);
            }),
        ]);

        console.log(`檔案已處理完畢: ${siteId}`);
    } catch (error) {
        console.error(`處理站點 ${siteId} 時發生錯誤:`, error);
        throw error;
    }
}

function clearDirectory(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file) => {
            const curPath = path.join(directoryPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                clearDirectory(curPath);
                fs.rmSync(curPath, { recursive: true, force: true }); // 改用 fs.rmSync
            } else {
                fs.rmSync(curPath, { force: true }); // 改用 fs.rmSync 刪除檔案
            }
        });
    }
}

async function processDeleteCrawlerDocuments(folderPath, crawlerDocumentsIds, filenames, client) {
    try {
        // 1. 呼叫檔案服務刪除檔案
        try {
            const fileServiceResponse = await axios.post(`${process.env.AVA_FILE_SERVICE_URL}/delete/crawler`, {
                folder_path: folderPath,
                filenames: filenames, // 直接使用 IDs 作為檔案名稱
            });

            if (fileServiceResponse.data.failureCount > 0) {
                console.warn("Some files failed to delete:", fileServiceResponse.data.failures);
            }
        } catch (fileError) {
            console.error("Error calling file service:", fileError);
            throw new Error("Failed to delete files from file service");
        }

        // 2. 刪除資料庫記錄

        // 刪除 crawler_documents_extra
        await client.query(
            `
            DELETE FROM crawler_documents_extra
            WHERE crawler_documents_id = ANY($1)
        `,
            [crawlerDocumentsIds]
        );

        // 刪除 crawler_documents_content
        await client.query(
            `
            DELETE FROM crawler_documents_content
            WHERE crawler_documents_id = ANY($1)
        `,
            [crawlerDocumentsIds]
        );

        // 刪除 crawler_documents
        await client.query(
            `
            DELETE FROM crawler_documents
            WHERE id = ANY($1)
        `,
            [crawlerDocumentsIds]
        );

        return { code: 0, message: "Delete crawler documents successfully" };
    } catch (error) {
        console.error("Error delete crawler documents:", error);
        throw error;
    }
}

async function processDeleteCrawlerAttachmentFiles(folderPath, crawlerAttachmentIds, filenames, hash, client) {
    try {
        console.log("處理刪除爬蟲附件檔案，IDs:", crawlerAttachmentIds);

        // 開始事務以確保資料一致性
        await client.query("BEGIN");

        // 處理每個待刪除的附件
        for (let i = 0; i < crawlerAttachmentIds.length; i++) {
            const attachmentId = crawlerAttachmentIds[i];
            const attachmentHash = hash[i];
            const filename = filenames[i];

            // 1. 檢查此 hash 的附件總數
            const countResult = await client.query(
                `SELECT COUNT(*) FROM crawler_attachment WHERE hash = $1 AND upload_folder_id = $2`,
                [attachmentHash, folderPath]
            );

            const totalCount = parseInt(countResult.rows[0].count);

            // 2. 獲取要刪除的附件資訊
            const attachmentResult = await client.query(
                `SELECT id, parent_id, filename, url FROM crawler_attachment WHERE id = $1`,
                [attachmentId]
            );

            if (attachmentResult.rows.length === 0) {
                console.log(`附件 ID ${attachmentId} 不存在，跳過處理`);
                continue;
            }

            const attachmentInfo = attachmentResult.rows[0];

            // 如果是唯一一個，直接刪除
            if (totalCount <= 1) {
                console.log(`Hash ${attachmentHash} 只有一個附件，直接刪除`);

                // 刪除檔案
                try {
                    const fileServiceResponse = await axios.post(`${process.env.AVA_FILE_SERVICE_URL}/delete/crawler`, {
                        folder_path: folderPath,
                        filenames: [filename],
                    });
                    console.log(`檔案刪除結果: ${fileServiceResponse.data}`);
                } catch (fileError) {
                    console.error("刪除檔案服務發生錯誤:", fileError);
                    // 繼續執行，不中斷流程
                }

                // 刪除資料庫記錄
                await client.query(`DELETE FROM crawler_attachment WHERE id = $1`, [attachmentId]);

                continue;
            }

            // 3. 處理多個相同 hash 的附件情況
            // 檢查被刪除的附件是否為父記錄（parent_id 為 null）
            if (attachmentInfo.parent_id === null) {
                console.log(`附件 ID ${attachmentId} 是父記錄，需要重新安排父子關係`);

                // 4. 如果是父記錄，找出引用此記錄作為父記錄的所有附件
                const childrenResult = await client.query(
                    `SELECT id FROM crawler_attachment WHERE parent_id = $1 AND training_state IN (2, 3, 4)`,
                    [attachmentId]
                );

                if (childrenResult.rows.length > 0) {
                    // 5. 找出創建時間最早的子記錄作為新父記錄
                    const oldestChildResult = await client.query(
                        `SELECT id, filename, url FROM crawler_attachment 
                         WHERE parent_id = $1 AND training_state IN (2, 3, 4)
                         ORDER BY create_time ASC LIMIT 1`,
                        [attachmentId]
                    );

                    const newParentId = oldestChildResult.rows[0].id;
                    console.log(`選擇附件 ID ${newParentId} 作為新的父記錄`);

                    // 將最早的子記錄升級為父記錄
                    await client.query(
                        `UPDATE crawler_attachment 
                         SET parent_id = NULL,
                             filename = $2,
                             url = $3
                         WHERE id = $1`,
                        [newParentId, attachmentInfo.filename, attachmentInfo.url]
                    );

                    // 更新其他子記錄的父記錄ID
                    const childIds = childrenResult.rows.map((row) => row.id).filter((id) => id !== newParentId); // 排除新父記錄自己

                    if (childIds.length > 0) {
                        await client.query(
                            `UPDATE crawler_attachment 
                             SET parent_id = $1,
                                 url = $2
                             WHERE id = ANY($3)`,
                            [newParentId, attachmentInfo.url, childIds]
                        );
                        console.log(`已將 ${childIds.length} 個子記錄的父記錄更新為 ${newParentId}`);
                    }
                }

                // 刪除原父記錄
                await client.query(`DELETE FROM crawler_attachment WHERE id = $1`, [attachmentId]);
            } else {
                // 如果不是父記錄，直接刪除
                console.log(`附件 ID ${attachmentId} 不是父記錄，直接刪除`);
                await client.query(`DELETE FROM crawler_attachment WHERE id = $1`, [attachmentId]);
            }
        }

        // 提交事務
        await client.query("COMMIT");

        return { code: 0, message: "成功刪除爬蟲附件檔案" };
    } catch (error) {
        // 回滾事務
        await client.query("ROLLBACK");
        console.error("刪除爬蟲附件檔案時發生錯誤:", error);
        throw error;
    }
}

module.exports = {
    processSyncCrawler,
    syncCrawler,
    processDeleteCrawlerDocuments,
    processDeleteCrawlerAttachmentFiles,
};
