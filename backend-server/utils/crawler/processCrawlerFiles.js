const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const md5 = require("md5");
const pythonAPI = require("../../utils/pythonAPI");
const { filterAndConvertHtml } = require("../../utils/crawler");
const { upload_host } = require("../../global/backend_upload");
const { datasource } = require("../../model/dbConvertModel");
const async = require("async");
const axios = require("axios");
const FormData = require("form-data");
const axiosRetry = require("axios-retry").default;
const CrawlerDocuments = require("../../orm/schema/crawler_documents");
const CrawlerDocumentsContent = require("../../orm/schema/crawler_documents_content");
const CrawlerAttachment = require("../../orm/schema/crawler_attachment");
const CrawlerAttachmentHash = require("../../orm/schema/crawler_attachment_hash");
const sequelize = require("../../orm/sequelize");
const { segmentContent } = require("../../utils/common");

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

const processCrawlerFiles = async (
    client,
    action,
    {
        crawlerSyncArray, // 使用陣列物件
        folder_name,
        upload_folder_id,
        datasetsFolderName,
        datasetsId,
        ava_token,
        previousCrawlerDocumentsContentHashMap,
        test,
        siteFolder,
    }
) => {
    try {
        if (action === "recoverCrawler") {
            // 將 message 中的 Map 轉換為 Map 物件
            const convertPreviousCrawlerDocumentsContentHashMap = new Map(
                Object.entries(previousCrawlerDocumentsContentHashMap)
            );

            // 替換 message 中的 Map
            previousCrawlerDocumentsContentHashMap = convertPreviousCrawlerDocumentsContentHashMap;
        } else {
            if (!(previousCrawlerDocumentsContentHashMap instanceof Map)) {
                previousCrawlerDocumentsContentHashMap = new Map();
            }
        }
        const crawlerDeleteAttemptsLimit = process.env.CRAWLER_DELETE_ATTEMPTS_LIMIT || 3;

        console.log("crawlerSyncArray", crawlerSyncArray);

        const crawlerDataMap = new Map();
        let processedHashesBySite = new Map();
        for (let { crawlerId, crawler_synchronize_id, siteId } of crawlerSyncArray) {
            const crawlerData = await client.query("SELECT site_id,domain FROM crawler WHERE id = $1", [crawlerId]);
            const domain = crawlerData.rows[0]?.domain;
            crawlerDataMap.set(crawlerId, { domain, siteId, crawler_synchronize_id });
            processedHashesBySite.set(siteId, new Set());
        }

        const datasource_type = "B";
        const concurrency = 3;

        // 用來儲存哪些 crawler_synchronize_id 是沒有資料的
        const missingData = [];

        // 記錄新增和刪除的記錄數
        let newRecordCounts = new Map();
        let deleteRecordCounts = new Map();

        let allFiles = [];
        const foldersToDelete = [];

        for (const { crawlerId, siteId, crawler_synchronize_id } of crawlerSyncArray) {
            console.log("處理 site_id:", siteId);

            // 使用傳入的特定資料夾路徑
            let folderPath;
            if (test === "test") {
                // 測試模式：在 resource 目錄下查找匹配的文件夾
                const resourcePath = path.join(__dirname, "../../resource");
                const matchingFolders = fs
                    .readdirSync(resourcePath)
                    .filter(
                        (folder) =>
                            folder.startsWith(siteId) && fs.statSync(path.join(resourcePath, folder)).isDirectory()
                    );

                if (matchingFolders.length === 0) {
                    console.log(`找不到與 siteId ${siteId} 對應的資料夾`);
                    missingData.push({ crawlerId, siteId, crawler_synchronize_id, reason: "資料夾不存在" });
                    continue;
                }

                folderPath = path.join(resourcePath, matchingFolders[0]);
            } else {
                // 非測試模式：使用傳入的特定資料夾路徑
                folderPath = siteFolder;
            }
            // 檢查資料夾是否存在
            if (!fs.existsSync(folderPath)) {
                console.log(`資料夾不存在: ${folderPath}`);
                missingData.push({ crawlerId, siteId, crawler_synchronize_id, reason: "資料夾不存在" });
                continue;
            }

            try {
                const files = fs.readdirSync(folderPath).filter((file) => file.endsWith(".json"));
                if (files.length > 0) {
                    allFiles = allFiles.concat(
                        files.map((file) => ({ filePath: path.join(folderPath, file), crawlerId }))
                    );
                } else {
                    console.log(`找不到與 siteId ${siteId} 對應的檔案`);
                    missingData.push({ crawlerId, siteId, crawler_synchronize_id, reason: "沒有檔案" });
                }
            } catch (error) {
                console.error(`無法讀取資料夾 ${folderPath} 中的檔案:`, error);
            }
        }

        // 處理沒有檔案的爬蟲 crawler_synchronize 的 training_state 設為 8
        if (missingData.length > 0) {
            try {
                await client.query("BEGIN"); // 開始交易
                for (const { crawler_synchronize_id, crawlerId } of missingData) {
                    // 更新 crawler_synchronize 表中的 training_state 為 8
                    await client.query(
                        "UPDATE crawler_synchronize SET training_state = 8 WHERE id = $1 AND crawler_id = $2",
                        [crawler_synchronize_id, crawlerId]
                    );
                    console.log(
                        `已將 crawler_synchronize_id 為 ${crawler_synchronize_id} 的紀錄 training_state 設為 8`
                    );
                }
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                console.error("更新 crawler_synchronize 資料表時發生錯誤:", error);
                throw error;
            }
        }

        console.log(`在所有目錄中找到 ${allFiles.length} 個 JSON 檔案`);

        if (allFiles.length === 0) {
            return null;
        }

        const batchSize = 300;

        // 將每一批檔案上傳至 API 的函數
        const uploadBatchToAPI = async (batch) => {
            const formData = new FormData();
            if (folder_name && upload_folder_id) {
                formData.append("folder_path", `${datasetsFolderName}/${upload_folder_id}`);
            } else {
                formData.append("folder_path", datasetsFolderName);
            }

            batch.forEach((d) => {
                formData.append("files", fs.createReadStream(d.filePath), d.newFileName);
            });

            try {
                const response = await axios.post(`${process.env.AVA_FILE_SERVICE_URL}/upload/crawler`, formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });

                if (response.status === 200) {
                    console.log("(file-service) 批次上傳成功");
                }
            } catch (error) {
                console.error("Error uploading batch to API:", error);
                throw error;
            }
        };

        const processFile = async ({ filePath, crawlerId }) => {
            console.log("正在處理檔案:", filePath);
            let jsonContent = fs.readFileSync(filePath, "utf-8");
            let jsonData = JSON.parse(jsonContent);

            const filteredResult = filterAndConvertHtml(jsonData.html, jsonData.url);
            const crawler_documents_id = uuidv4();
            const newFileName = `${crawler_documents_id}.json`;

            // 建立 meta_data，排除 `filename` 和 `originalname` 作為 hash 計算
            let meta_data = {};
            Object.keys(jsonData).forEach((key) => {
                if (!["title", "text", "url", "html"].includes(key)) {
                    meta_data[key] = jsonData[key];
                }
            });

            const hash = md5(filteredResult.filteredHtml + jsonData.title + JSON.stringify(meta_data));
            const siteId = crawlerDataMap.get(crawlerId)?.siteId;
            const mapKey = `${siteId}|${crawlerId}|${hash}`;

            if (previousCrawlerDocumentsContentHashMap.has(mapKey)) {
                console.log(`雜湊值：${hash} 已存在，跳過檔案處理`);
                processedHashesBySite.get(siteId).add(hash);

                // 查詢該記錄是否已被標記為刪除
                const crawler_documents_id = previousCrawlerDocumentsContentHashMap.get(mapKey).crawler_documents_id;
                const res = await client.query(
                    `SELECT delete_attempts FROM crawler_documents_content WHERE crawler_documents_id = $1`,
                    [crawler_documents_id]
                );

                const content = res.rows[0];
                if (content && content.delete_attempts > 0) {
                    // 如果 delete_attempts > 0，則將其重置
                    await client.query(
                        `UPDATE crawler_documents_content SET delete_attempts = 0, update_time = CURRENT_TIMESTAMP WHERE crawler_documents_id = $1`,
                        [crawler_documents_id]
                    );
                    console.log(`記錄 ${crawler_documents_id} 已重新出現，delete_attempts 已重置為 0`);
                }

                return null; // 跳過檔案處理
            }

            // 更新 meta_data 以包含 `filename` 和 `originalname`，供後續處理使用
            meta_data.filename = newFileName;
            meta_data.originalname = newFileName;

            // 記錄已處理的雜湊值 後面要計數
            newRecordCounts.set(crawlerId, (newRecordCounts.get(crawlerId) || 0) + 1);

            let targetPath;

            if (folder_name && upload_folder_id) {
                targetPath = path.join(
                    __dirname,
                    `../../${upload_host}/${datasetsFolderName}/${datasource[datasource_type]}/${upload_folder_id}/${newFileName}`
                );
                meta_data = {
                    ...meta_data,
                    sub_folder_id: upload_folder_id,
                    upload_folder_id: datasetsFolderName,
                };
            } else {
                targetPath = path.join(
                    __dirname,
                    `../../${upload_host}/${datasetsFolderName}/${datasource[datasource_type]}/${newFileName}`
                );
                meta_data = {
                    ...meta_data,
                    upload_folder_id: datasetsFolderName,
                };
            }
            // todo: 要是確認上傳到 API 那段沒問題的話 就把這段拿掉 不用存本地了
            // fs.writeFileSync(targetPath, jsonContent, "utf-8");

            const crawler_document_content_id = uuidv4();
            const crawler_synchronize_id = crawlerDataMap.get(crawlerId).crawler_synchronize_id; // 根據 crawlerId 獲取對應的同步 ID

            // 檢查檔案有沒有 attachments
            // "attachment": [
            //     {
            //         "href": "https://orgws.kcg.gov.tw/001/KcgOrgUploadFiles/471/relfile/78673/352669/ae772dfd-f23c-4ce5-a327-2d13195124e1.pdf",
            //         "title": "民眾向行政機關引用CEDAW指引及案例.pdf[另開新視窗]",
            //         "path": "attachment/ae772dfd-f23c-4ce5-a327-2d13195124e1.pdf"
            //     }
            // ],

            return {
                crawler_documents_id,
                crawler_document_content_id,
                newFileName,
                filePath,
                jsonData,
                filteredResult,
                hash,
                meta_data,
                crawler_synchronize_id,
                crawlerId,
            };
        };

        const batchInsert = async (batch) => {
            const t = await sequelize.transaction();
            try {
                console.log(`準備批量插入 ${batch.length} 條記錄`);

                // 準備 crawler_documents 的插入數據
                const documentData = batch.map((d) => ({
                    id: d.crawler_documents_id,
                    filename: d.newFileName,
                    crawler_synchronize_id: d.crawler_synchronize_id,
                    training_state: 2,
                }));

                // 插入 crawler_documents
                await CrawlerDocuments.bulkCreate(documentData, { transaction: t });

                // 準備 crawler_documents_content 的插入數據
                const contentData = batch.map((d) => ({
                    id: d.crawler_document_content_id,
                    text: d.jsonData.text.replace(/'/g, "''"),
                    title: d.jsonData.title.replace(/'/g, "''"),
                    url: d.jsonData.url,
                    html: d.jsonData.html.replace(/'/g, "''"),
                    content: d.filteredResult.markdown.replace(/'/g, "''"),
                    content_segmented: segmentContent(
                        d.jsonData.title.replace(/'/g, "''") + " " + d.filteredResult.markdown.replace(/'/g, "''")
                    ),
                    crawler_documents_id: d.crawler_documents_id,
                    crawler_synchronize_id: d.crawler_synchronize_id,
                    crawler_id: d.crawlerId,
                    hash: d.hash,
                    meta_data: d.meta_data,
                    training_state: 2,
                }));

                // 插入 crawler_documents_content
                await CrawlerDocumentsContent.bulkCreate(contentData, { transaction: t });

                await t.commit();
                console.log(`已批量插入並提交 ${batch.length} 條記錄`);
            } catch (error) {
                await t.rollback();
                console.error("批量插入時發生錯誤，已回滾:", error);
                throw error;
            }
        };

        let processedData = [];

        const queue = async.queue(async (fileData) => {
            try {
                const processedFileData = await processFile(fileData);
                if (processedFileData) {
                    processedData.push(processedFileData);

                    if (processedData.length >= batchSize) {
                        await batchInsert(processedData);
                        await uploadBatchToAPI(processedData);
                        processedData = []; // 清空已處理的資料
                    }
                }
            } catch (err) {
                console.error("處理檔案時發生錯誤:", fileData.filePath, err);
            }
        }, concurrency);

        const queueComplete = new Promise((resolve) => {
            queue.drain(() => {
                resolve();
            });
        });

        for (const file of allFiles) {
            await queue.push(file);
        }

        await queueComplete;

        if (processedData.length > 0) {
            await batchInsert(processedData);
            await uploadBatchToAPI(processedData);
        }

        console.log(`檔案處理完畢。`);

        // 刪除處理後的資料夾
        if (test !== "test") {
            for (const folderPath of foldersToDelete) {
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                    console.log(`已刪除資料夾: ${folderPath}`);
                } catch (err) {
                    console.error(`刪除資料夾 ${folderPath} 時發生錯誤:`, err);
                }
            }
        }

        const recordsToDeleteDocumentIds = new Map();
        for (const [siteId, processedHashes] of processedHashesBySite) {
            const siteRecordsToDelete = [];
            previousCrawlerDocumentsContentHashMap.forEach((value, key) => {
                const [mapSiteId, mapCrawlerId, hash] = key.split("|");
                if (mapSiteId === siteId && !processedHashes.has(hash)) {
                    const { crawler_documents_id } = value;
                    siteRecordsToDelete.push(crawler_documents_id);
                }
            });
            if (siteRecordsToDelete.length > 0) {
                recordsToDeleteDocumentIds.set(siteId, siteRecordsToDelete);
            }
        }

        let recordsToRemoveDocumentContent = [];

        // 這段的邏輯就是逐一處理所有要刪除的 document
        for (const [siteId, recordsToDelete] of recordsToDeleteDocumentIds) {
            console.log(`需要刪除的記錄 (站點 ${siteId}):`, recordsToDelete);

            for (const crawlerDocumentId of recordsToDelete) {
                // 查詢該記錄的當前 delete_attempts 數值
                const res = await client.query(
                    `SELECT delete_attempts, training_state FROM crawler_documents_content WHERE crawler_documents_id = $1`,
                    [crawlerDocumentId]
                );

                const content = res.rows[0];

                if (content) {
                    if (content.delete_attempts < crawlerDeleteAttemptsLimit) {
                        // 如果刪除次數小於 5，則增加 delete_attempts
                        await client.query(
                            `
                            UPDATE crawler_documents_content 
                            SET delete_attempts = delete_attempts + 1, update_time = CURRENT_TIMESTAMP 
                            WHERE crawler_documents_id = $1
                        `,
                            [crawlerDocumentId]
                        );
                    } else {
                        // 如果達到刪除次數上限，將 recordId 加入待刪除陣列
                        recordsToRemoveDocumentContent.push(crawlerDocumentId);
                        console.log(`記錄 ${crawlerDocumentId} 已達到刪除次數上限，加入待刪除列表`);
                    }
                }
            }

            // 更新刪除記錄計數
            const crawlerId = crawlerSyncArray.find((item) => item.siteId === siteId).crawlerId;
            deleteRecordCounts.set(crawlerId, (deleteRecordCounts.get(crawlerId) || 0) + recordsToDelete.length);
        }

        // 在處理完所有記錄後，最後一次性呼叫 Python API 進行刪除
        if (recordsToRemoveDocumentContent.length > 0) {
            await pythonAPI.removeCrawlerDocumentContent(
                datasetsId,
                recordsToRemoveDocumentContent, // 傳入待刪除的多個記錄 ID
                process.env.PYTHON_API_HOST,
                ava_token
            );
            await pythonAPI.removeCrawlerDocument(
                datasetsId,
                recordsToRemoveDocumentContent, // 傳入待刪除的多個記錄 ID
                process.env.PYTHON_API_HOST,
                ava_token
            );
        }

        // 更新 crawler_synchronize 表的 training_state

        for (const { crawlerId, crawler_synchronize_id } of crawlerSyncArray) {
            const deleteCount = deleteRecordCounts.get(crawlerId) || 0;
            const newCount = newRecordCounts.get(crawlerId) || 0;
            if (deleteCount !== 0 || newCount !== 0) {
                let newTrainingState;
                if (deleteCount > 0) {
                    newTrainingState = 3; // 有刪除記錄
                }

                if (newCount > 0) {
                    newTrainingState = 2; // 有新增記錄
                }

                await client.query(
                    "UPDATE crawler_synchronize SET training_state = $1, added_files_count = $2, deleted_files_count = $3, pending_delete_files_count = $4 WHERE id = $5",
                    [
                        newTrainingState,
                        newCount,
                        recordsToRemoveDocumentContent.length,
                        deleteCount,
                        crawler_synchronize_id,
                    ]
                );

                console.log(
                    `已更新 crawler_synchronize_id ${crawler_synchronize_id} 的 training_state 為 ${newTrainingState}`
                );
                console.log(`crawler_id ${crawlerId}: 預計被刪除 ${deleteCount} 筆，新增 ${newCount} 筆`);
            } else if (deleteCount === 0 && newCount === 0) {
                await client.query(
                    "UPDATE crawler_synchronize SET training_state = $1, added_files_count = $2, deleted_files_count = $3, pending_delete_files_count = $4 WHERE id = $5",
                    [3, 0, 0, recordsToRemoveDocumentContent.length, crawler_synchronize_id]
                );
            }
        }

        console.log("所有檔案處理完成，耶呼！");
    } catch (err) {
        console.error("處理檔案時發生錯誤:", err.message, err.stack);

        for (let i = 0; i < crawlerSyncArray.length; i++) {
            const { crawlerId, crawler_synchronize_id } = crawlerSyncArray[i]; // 從陣列物件中取得對應的同步 ID

            if (crawler_synchronize_id) {
                await client.query("UPDATE crawler_synchronize SET training_state = 99 WHERE id = $1", [
                    crawler_synchronize_id,
                ]);
            } else {
                let crawlerData = await client.query("SELECT config_jsonb FROM crawler WHERE id = $1", [crawlerId]);
                const crawlerConfigJsonb = crawlerData.rows[0]?.config_jsonb;
                await client.query(
                    "INSERT INTO crawler_synchronize (config_jsonb, datasource_id, crawler_id, training_state) VALUES($1, $2, $3, $4) RETURNING id",
                    [crawlerConfigJsonb, datasetsId, crawlerId, 99]
                );
            }
        }
        throw err;
    }
};

module.exports = {
    processCrawlerFiles,
};

process.on("unhandledRejection", (reason, promise) => {
    console.error("(processFile.js)未處理的 Promise 拒絕:", reason);
    console.error("(processFile.js)Promise:", promise);
});

process.on("uncaughtException", (error) => {
    console.error("(processFile.js)未捕獲的異常:", error);
});
