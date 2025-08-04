const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const axios = require("axios");
const { processCrawlerAttachmentFiles } = require("../../utils/crawler/processCrawlerAttachmentFiles");

const axiosRetry = require("axios-retry").default;

const action = "schedulerCrawlerAttachment";

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

// todo: 把變數命名統一
async function processSyncCrawlerAttachment(params) {
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

        const taskMap = new Map();

        for (let crawlerId of crawlerIds) {
            rs = await sql.query("SELECT site_id FROM crawler WHERE id = $1", [crawlerId]);
            const siteId = rs.rows[0]?.site_id;
            crawlerSiteIds.push(siteId);

            rs = await sql.query("SELECT config_jsonb FROM crawler WHERE id = $1", [crawlerId]);
            const crawlerConfigJsonb = rs.rows[0]?.config_jsonb;

            rs = await sql.query(
                "INSERT INTO crawler_attachment_synchronize (config_jsonb, datasource_id, crawler_id, training_state) VALUES($1, $2, $3, $4) RETURNING id",
                [crawlerConfigJsonb, datasourceId, crawlerId, 1]
            );

            const crawler_synchronize_id = +rs.rows[0]?.id;
            if (!crawler_synchronize_id) throw new Error("Failed to insert crawler_attachment_synchronize");

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

        const result = await syncCrawlerAttachment(sql, crawlerSiteIds, datasetsFolderName, {
            crawlerSyncArray,
            folder_name,
            upload_folder_id,
            datasetsFolderName,
            datasetsId,
            datasourceId,
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
                "update crawler_attachment_synchronize set training_state = $1 where id = $2 and datasource_id = $3 and crawler_id = $4",
                [98, crawler_synchronize_id, datasourceId, crawlerId]
            )
        );

        await Promise.all(updatePromises);
        return { result: "fail" };
    }
}

async function syncCrawlerAttachment(sql, siteIds, datasetsFolderName, message) {
    try {
        const CRAWLER_ATTACHMENT_API = process.env.CRAWLER_ATTACHMENT_API;
        const CRAWLER_API = process.env.CRAWLER_API;
        const CRAWLER_DOWNLOAD = process.env.CRAWLER_DOWNLOAD;
        console.log("開始同步爬蟲附件，site_ids:", siteIds);

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
            `${CRAWLER_ATTACHMENT_API}/download`,
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

        const spiderUuids = [spiderResponse.data.data.uuid];
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
            SELECT id FROM crawler_attachment_tasks 
            WHERE crawler_synchronize_id = $1 AND spider_uuid = $2 AND site_id = $3
            `,
            [crawler_synchronize_id, spider_uuid, site_id]
        );

        let result;

        if (existingTask.rows.length > 0) {
            // 如果記錄已經存在，進行更新操作
            result = await sql.query(
                `
                UPDATE crawler_attachment_tasks 
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
                INSERT INTO crawler_attachment_tasks 
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
        SELECT * FROM crawler_attachment_tasks
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
                "UPDATE crawler_attachment_synchronize SET training_state = $1 WHERE id = $2 AND datasource_id = $3 AND crawler_id = $4",
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

                await processCrawlerAttachmentFiles(sql, action, siteMessage);
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

module.exports = {
    processSyncCrawlerAttachment,
    syncCrawlerAttachment,
    processDeleteCrawlerDocuments,
};
