const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const md5 = require("md5");
const pythonAPI = require("../../utils/pythonAPI");
const { filterAndConvertHtml } = require("../../utils/crawler");
const { upload_host } = require("../../global/backend_upload");
const os = require("os");
const { datasource } = require("../../model/dbConvertModel");
const async = require("async");
const axios = require("axios");
const FormData = require("form-data");
const axiosRetry = require("axios-retry").default;
const CrawlerAttachment = require("../../orm/schema/crawler_attachment");

const sequelize = require("../../orm/sequelize");
const mime = require("mime-types");

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

const processCrawlerAttachmentFiles = async (
    client,
    action,
    {
        crawlerSyncArray,
        folder_name,
        upload_folder_id,
        datasetsFolderName,
        datasetsId,
        test,
        siteFolder,
        datasourceId,
        ava_token,
    }
) => {
    try {
        console.log("處理爬蟲附件檔案，crawlerSyncArray:", crawlerSyncArray);

        if (!client) {
            throw new Error("無法獲取資料庫連接");
        }

        const crawlerDataMap = new Map();
        const SERVICE_URL = process.env.SERVICE_URL;
        let processedHashesBySite = new Map();

        // 建立爬蟲資料映射
        for (let { crawlerId, crawler_synchronize_id, siteId } of crawlerSyncArray) {
            const crawlerData = await client.query("SELECT site_id,domain FROM crawler WHERE id = $1", [crawlerId]);
            const domain = crawlerData.rows[0]?.domain;
            crawlerDataMap.set(crawlerId, { domain, siteId, crawler_synchronize_id });
            processedHashesBySite.set(siteId, new Set());
        }

        const concurrency = 3;
        const missingData = [];
        let newRecordCounts = new Map();
        let deleteRecordCounts = new Map();

        // 用來收集所有站點的所有附件
        let allAttachmentsFromAllSites = [];

        // 處理每個知識庫站點的資料夾
        for (const { crawlerId, siteId, crawler_synchronize_id } of crawlerSyncArray) {
            console.log("處理 site_id:", siteId);

            // 確定資料夾路徑
            let folderPath;
            if (test === "test") {
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
                folderPath = siteFolder;
            }

            // 檢查資料夾是否存在
            if (!fs.existsSync(folderPath)) {
                console.log(`資料夾不存在: ${folderPath}`);
                missingData.push({ crawlerId, siteId, crawler_synchronize_id, reason: "資料夾不存在" });
                continue;
            }

            let siteAttachments = [];

            try {
                // 讀取所有 JSON 檔案
                const jsonFiles = fs.readdirSync(folderPath).filter((file) => file.endsWith(".json"));
                if (jsonFiles.length === 0) {
                    console.log(`找不到與 siteId ${siteId} 對應的JSON檔案`);
                    missingData.push({ crawlerId, siteId, crawler_synchronize_id, reason: "沒有檔案" });
                    continue;
                }

                // 檢查附件資料夾
                const attachmentFolderPath = path.join(folderPath, "attachment");
                if (!fs.existsSync(attachmentFolderPath)) {
                    console.log(`附件資料夾不存在: ${attachmentFolderPath}`);
                    missingData.push({ crawlerId, siteId, crawler_synchronize_id, reason: "附件資料夾不存在" });
                    continue;
                }

                // 建立所有附件檔案的映射
                const attachmentFilesMap = new Map();
                try {
                    const attachmentFiles = fs.readdirSync(attachmentFolderPath);
                    for (const file of attachmentFiles) {
                        attachmentFilesMap.set(file, {
                            filePath: path.join(attachmentFolderPath, file),
                            fileName: file,
                        });
                    }
                    console.log(`找到 ${attachmentFiles.length} 個附件檔案`);

                    if (attachmentFiles.length === 0) {
                        missingData.push({ crawlerId, siteId, crawler_synchronize_id, reason: "沒有附件" });
                        continue;
                    }
                } catch (error) {
                    console.error(`讀取附件資料夾時發生錯誤:`, error);
                    continue;
                }

                // 處理每個 JSON 檔案中的附件資訊
                for (const jsonFile of jsonFiles) {
                    try {
                        const jsonContent = fs.readFileSync(path.join(folderPath, jsonFile), "utf-8");
                        if (!jsonContent || jsonContent.trim() === "" || jsonContent.trim() === "[]") {
                            console.log(`JSON 檔案 ${jsonFile} 為空或僅包含空陣列，跳過處理`);
                            continue;
                        }

                        let jsonData;
                        try {
                            jsonData = JSON.parse(jsonContent);
                        } catch (parseError) {
                            console.error(`解析 JSON 檔案 ${jsonFile} 時發生錯誤:`, parseError);
                            continue;
                        }

                        // 確保 jsonData 是陣列
                        if (!Array.isArray(jsonData) || jsonData.length === 0) {
                            console.log(`JSON 檔案 ${jsonFile} 不包含附件陣列或附件陣列為空，跳過處理`);
                            continue;
                        }

                        // 處理每個附件
                        for (const item of jsonData) {
                            if (!item || !item.path) {
                                console.log(`附件資料中缺少路徑資訊，跳過處理`);
                                continue;
                            }

                            const fileName = item.path.split("/").pop();
                            const attachmentFile = attachmentFilesMap.get(fileName);

                            if (!attachmentFile) {
                                console.log(`找不到對應的附件檔案: ${fileName}`);
                                continue;
                            }

                            // 計算附件的 hash
                            let hash = null;
                            try {
                                const fileContent = fs.readFileSync(attachmentFile.filePath);
                                hash = md5(fileContent);
                            } catch (error) {
                                console.error(`計算附件 hash 時發生錯誤: ${error.message}`);
                                continue;
                            }

                            // 將 hash 加入已處理集合，用於後續判斷是否需要刪除
                            processedHashesBySite.get(siteId).add(hash);

                            const fileExtension = fileName.split(".").pop() || "";
                            const fileMimeType = mime.lookup(fileName) || "application/octet-stream";

                            // 加入附件列表，使用新的欄位映射
                            siteAttachments.push({
                                id: uuidv4(),
                                crawler_synchronize_id,
                                upload_folder_id,
                                // 頁面資訊
                                page_title: item.page_title || "",
                                page_url: item.page || "",
                                // 附件資訊
                                filename: fileName,
                                attachment_link_title: item.title || "",
                                attachment_link_text: item.text || "",
                                attachment_href: item.href || "",
                                // 檔案資訊
                                file_extension: fileExtension,
                                file_mime_type: fileMimeType,
                                url: `${SERVICE_URL}/download/${fileName}`,
                                hash,
                                // 狀態資訊
                                is_enable: 1,
                                training_state: 2,

                                // 附加資訊
                                meta_data: {
                                    site_id: item.site_id || siteId, // 使用項目中的 site_id 或預設使用當前處理的 siteId
                                },
                                siteId,
                                filePath: attachmentFile.filePath,
                                crawlerId,
                            });
                        }
                    } catch (error) {
                        console.error(`處理 JSON 檔案 ${jsonFile} 時發生錯誤:`, error);
                    }
                }

                // 將這個站點的附件加入到總清單
                allAttachmentsFromAllSites = allAttachmentsFromAllSites.concat(siteAttachments);
            } catch (error) {
                console.error(`處理資料夾 ${folderPath} 時發生錯誤:`, error);
            }
        }

        if (allAttachmentsFromAllSites.length === 0) {
            console.log("沒有找到可處理的附件");

            // 處理沒有檔案的情況
            console.log("missingData", missingData);
            if (missingData.length > 0) {
                try {
                    await client.query("BEGIN");
                    for (const { crawler_synchronize_id, crawlerId } of missingData) {
                        await client.query(
                            "UPDATE crawler_attachment_synchronize SET training_state = 8 WHERE id = $1 AND crawler_id = $2",
                            [crawler_synchronize_id, crawlerId]
                        );
                        console.log(`已將 crawler_synchronize_id ${crawler_synchronize_id} 的狀態設為 8`);
                    }
                    await client.query("COMMIT");
                } catch (error) {
                    await client.query("ROLLBACK");
                    console.error("更新 crawler_attachment_synchronize 狀態時發生錯誤:", error);
                    throw error;
                }
            }

            return null;
        }

        // 先查詢資料庫中所有已存在的 hash，針對所有站點同步執行去重判斷
        console.log("查詢資料庫中已存在的附件 Hash...");
        const existingHashesRes = await client.query(
            `SELECT ca.hash, ca.id, c.site_id, ca.delete_attempts, ca.parent_id
             FROM crawler_attachment ca
             JOIN crawler_attachment_synchronize cas ON ca.crawler_synchronize_id = cas.id
             JOIN crawler c ON cas.crawler_id = c.id
             WHERE cas.datasource_id = $1
             AND ca.training_state IN (2, 3, 4)
             ORDER BY ca.create_time ASC`, // 按創建時間排序，確保最早的記錄在前
            [datasourceId]
        );

        // 建立 hash 到原始 ID 和父 ID 的映射
        const hashToOriginalId = new Map();
        const hashToParentId = new Map();
        const existingSameSiteHashMap = new Map();
        const existingAnyHashMap = new Map();

        // 首先處理所有已存在於資料庫的附件
        existingHashesRes.rows.forEach((row) => {
            const { hash, id, site_id, delete_attempts, parent_id } = row;

            // 同一站點的映射
            existingSameSiteHashMap.set(`${hash}|${site_id}`, { id, delete_attempts });

            // 為每個 hash 記錄其第一個出現的 ID
            if (!hashToOriginalId.has(hash)) {
                hashToOriginalId.set(hash, id);

                // 如果這個記錄有父 ID，則使用它的父 ID
                if (parent_id) {
                    hashToParentId.set(hash, parent_id);
                } else {
                    // 否則，它自己就是父記錄
                    hashToParentId.set(hash, id);
                }
            }

            // 全局映射
            if (!existingAnyHashMap.has(hash)) {
                existingAnyHashMap.set(hash, { id });
            }
        });

        // 收集需要重置 delete_attempts 的記錄
        const attachmentsToResetDeleteAttempts = [];

        // 進行內存去重處理和 parent_id 設置
        console.log("進行所有附件的去重處理和 parent_id 設置...");
        const finalAttachments = [];
        const processedHashesInMemory = new Map();
        const newHashToIdMap = new Map(); // 用於記錄新創建的附件 ID

        // 第一遍處理：找出需要上傳的附件和設置臨時 parent_id
        for (const attachment of allAttachmentsFromAllSites) {
            const { hash, siteId, crawlerId } = attachment;
            const sameSiteKey = `${hash}|${siteId}`;

            // 檢查是否在同一站點已存在
            if (existingSameSiteHashMap.has(sameSiteKey)) {
                console.log(`雜湊值：${hash} 在站點 ${siteId} 已存在，跳過處理`);

                // 檢查是否需要重置 delete_attempts
                const recordInfo = existingSameSiteHashMap.get(sameSiteKey);
                if (recordInfo.delete_attempts && recordInfo.delete_attempts > 0) {
                    attachmentsToResetDeleteAttempts.push(recordInfo.id);
                }

                continue;
            }

            // 檢查是否已經在其他站點存在
            let existingId = null;
            if (existingAnyHashMap.has(hash)) {
                console.log(`雜湊值：${hash} 在其他站點已存在，記錄但不上傳`);
                attachment.skipUpload = true;
                existingId = existingAnyHashMap.get(hash).id;
            }

            // 檢查是否在當前批次中已處理過
            if (processedHashesInMemory.has(hash)) {
                console.log(`雜湊值：${hash} 在當前批次內已存在，跳過上傳僅記錄`);
                attachment.skipUpload = true;
            }

            // 設置 parent_id
            if (hashToParentId.has(hash)) {
                // 如果這個 hash 已存在，使用資料庫中的 parent_id
                attachment.parent_id = hashToParentId.get(hash);
                attachment.training_state = 3;
            } else if (processedHashesInMemory.has(hash)) {
                // 如果這個 hash 在當前批次已處理過，使用批次中第一個記錄的 ID
                attachment.parent_id = processedHashesInMemory.get(hash);
                attachment.training_state = 3;
            } else {
                // 新的 hash，暫時用自己的 ID（後續會更新）
                // 注意：這些新記錄的 parent_id 在所有記錄都處理完後會在第二遍處理中決定
                processedHashesInMemory.set(hash, attachment.id);
            }

            // 將 hash 加入已處理集合
            finalAttachments.push(attachment);
            // 更新計數
            newRecordCounts.set(crawlerId, (newRecordCounts.get(crawlerId) || 0) + 1);
        }

        // 第二遍處理：更新新創建附件的 parent_id
        for (const attachment of finalAttachments) {
            const { hash } = attachment;

            // 如果這個 hash 是本次批次中第一次出現，且不在資料庫中
            if (processedHashesInMemory.get(hash) === attachment.id && !hashToParentId.has(hash)) {
                // 它自己是父記錄，不需要 parent_id
                attachment.parent_id = null;

                // 記錄這個 ID 供其他記錄參考
                newHashToIdMap.set(hash, attachment.id);
            } else if (!hashToParentId.has(hash)) {
                // 這個記錄不是第一個出現的，但 hash 是新的，使用本批次中的第一個 ID
                attachment.parent_id = processedHashesInMemory.get(hash);
            }
            // 其他情況（在資料庫中已有記錄的）已在第一遍處理中設置好 parent_id
        }

        // 重置需要重置的 delete_attempts
        if (attachmentsToResetDeleteAttempts.length > 0) {
            await client.query(
                `UPDATE crawler_attachment 
                 SET delete_attempts = 0, update_time = CURRENT_TIMESTAMP 
                 WHERE id = ANY($1)`,
                [attachmentsToResetDeleteAttempts]
            );
            console.log(`已重置 ${attachmentsToResetDeleteAttempts.length} 個記錄的 delete_attempts`);
        }

        const batchSize = 30;

        // 上傳附件檔案
        const uploadBatchToAPI = async (batch) => {
            try {
                const baseFolderPath =
                    folder_name && upload_folder_id ? `${datasetsFolderName}/${upload_folder_id}` : datasetsFolderName;

                // 過濾掉不需要上傳的附件
                const attachmentsToUpload = batch.filter((att) => !att.skipUpload);

                if (attachmentsToUpload.length === 0) {
                    console.log("沒有需要上傳的新附件");
                    return;
                }

                // 按父 ID 分組附件
                const attachmentsByParent = new Map();
                attachmentsToUpload.forEach((attachment) => {
                    const key = attachment.parent_id || "no_parent"; // 沒有parent_id的用'no_parent'分組
                    if (!attachmentsByParent.has(key)) {
                        attachmentsByParent.set(key, []);
                    }
                    attachmentsByParent.get(key).push(attachment);
                });

                // 為每組附件創建請求
                for (const [parentId, attachmentGroup] of attachmentsByParent) {
                    const formData = new FormData();
                    formData.append("folder_path", baseFolderPath);

                    // 處理每個附件，必要時進行PDF轉換
                    for (const attachment of attachmentGroup) {
                        const fileExt = attachment.file_extension.toLowerCase();

                        // 檢查是否需要轉換為PDF（doc, docx, xls, xlsx等格式）
                        const needConversion = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf"].includes(
                            fileExt
                        );

                        if (needConversion) {
                            try {
                                console.log(`嘗試將 ${attachment.filename} 轉換為 PDF`);

                                // 創建轉換請求的FormData
                                const conversionFormData = new FormData();
                                conversionFormData.append("file", fs.createReadStream(attachment.filePath));

                                // 調用轉換API
                                const conversionResponse = await axios.post(
                                    process.env.DR_FILE_MGR,
                                    conversionFormData,
                                    {
                                        headers: { "Content-Type": "multipart/form-data" },
                                        responseType: "arraybuffer",
                                        timeout: 30000, // 30秒超時
                                    }
                                );

                                // 轉換成功，生成PDF檔名
                                const pdfFileName = attachment.filename.replace(/\.[^.]+$/, ".pdf");
                                const tempPdfPath = path.join(os.tmpdir(), pdfFileName);

                                // 寫入暫存PDF檔案
                                fs.writeFileSync(tempPdfPath, conversionResponse.data);

                                // 上傳轉換後的PDF
                                formData.append("files", fs.createReadStream(tempPdfPath), pdfFileName);

                                // 更新附件資訊為PDF
                                attachment.filename = pdfFileName;
                                attachment.file_extension = "pdf";
                                attachment.file_mime_type = "application/pdf";
                                attachment.url = `${SERVICE_URL}/download/${pdfFileName}`;
                                attachment.converted_from_original = true;

                                // 將暫存檔案路徑儲存起來，以便之後刪除
                                attachment.tempPdfPath = tempPdfPath;

                                console.log(`成功將 ${attachment.filename} 轉換為 PDF`);
                            } catch (conversionError) {
                                console.error(`轉換 ${attachment.filename} 為 PDF 時出錯:`, conversionError.message);
                                console.log(`將使用原始檔案格式上傳: ${attachment.filename}`);

                                // 轉換失敗時使用原始檔案
                                formData.append("files", fs.createReadStream(attachment.filePath), attachment.filename);
                            }
                        } else {
                            // 不需要轉換的檔案直接上傳
                            formData.append("files", fs.createReadStream(attachment.filePath), attachment.filename);
                        }
                    }

                    try {
                        const response = await axios.post(
                            `${process.env.AVA_FILE_SERVICE_URL}/upload/crawler`,
                            formData,
                            {
                                headers: {
                                    ...formData.getHeaders(),
                                },
                                timeout: 5 * 60 * 1000, // 5分鐘超時
                                maxContentLength: Infinity,
                                maxBodyLength: Infinity,
                            }
                        );

                        if (response.status === 200) {
                            console.log(`上傳附件成功，共 ${attachmentGroup.length} 個附件`);

                            // 上傳成功後，刪除臨時PDF檔案
                            for (const attachment of attachmentGroup) {
                                if (attachment.tempPdfPath && fs.existsSync(attachment.tempPdfPath)) {
                                    try {
                                        fs.unlinkSync(attachment.tempPdfPath);
                                        console.log(`已刪除暫存檔案: ${attachment.tempPdfPath}`);
                                    } catch (err) {
                                        console.error(`刪除暫存檔案 ${attachment.tempPdfPath} 時出錯:`, err);
                                    }
                                }
                            }
                        }
                    } catch (uploadError) {
                        console.error(`上傳附件組 ${parentId} 時出錯:`, uploadError.message);
                        // 上傳失敗時不中斷整個流程，繼續處理其他組
                    }
                }

                console.log(`批次上傳完成，共 ${attachmentsToUpload.length} 個附件`);
            } catch (error) {
                console.error("上傳附件時發生錯誤:", error);
                // 不拋出異常，避免中斷整個流程
                console.log("繼續處理其他附件...");
            }
        };

        // 批次插入附件記錄
        const batchInsert = async (batch) => {
            const t = await sequelize.transaction();
            try {
                console.log(`準備批量插入 ${batch.length} 條附件記錄`);

                // 準備要插入的資料
                const attachmentData = batch.map((att) => ({
                    id: att.id,
                    crawler_synchronize_id: att.crawler_synchronize_id,
                    upload_folder_id: att.upload_folder_id,
                    page_title: att.page_title || "",
                    page_url: att.page_url || "",
                    filename: att.filename,
                    attachment_link_title: att.attachment_link_title || "",
                    attachment_link_text: att.attachment_link_text || "",
                    attachment_href: att.attachment_href || "",
                    file_extension: att.file_extension || "",
                    file_mime_type: att.file_mime_type || "application/octet-stream",
                    url: att.url || "",
                    hash: att.hash,
                    is_enable: att.is_enable || 1,
                    training_state: att.training_state || 2,
                    meta_data: att.meta_data || {},
                    parent_id: att.parent_id, // 允許為 null
                }));

                // 批次插入
                await CrawlerAttachment.bulkCreate(attachmentData, { transaction: t });

                await t.commit();
                console.log(`成功插入 ${batch.length} 條附件記錄`);
            } catch (error) {
                await t.rollback();
                console.error("批量插入時發生錯誤:", error);
                throw error;
            }
        };

        // 處理需要刪除的記錄 - 直接從資料庫查詢
        const recordsToDeleteIds = new Map();

        // 對每個站點，查詢需要刪除的記錄
        for (const [siteId, processedHashes] of processedHashesBySite.entries()) {
            const processedHashesArray = Array.from(processedHashes);

            // 如果沒有處理任何附件，則跳過
            if (processedHashesArray.length === 0) continue;

            // 查詢該站點下所有不在已處理 hash 集合中的附件
            const deletionQuery = `
                SELECT ca.id
                FROM crawler_attachment ca
                JOIN crawler_attachment_synchronize cas ON ca.crawler_synchronize_id = cas.id
                JOIN crawler c ON cas.crawler_id = c.id
                WHERE cas.datasource_id = $1
                AND c.site_id = $2
                AND ca.training_state IN (2, 3, 4)
                AND NOT (ca.hash = ANY($3))
            `;

            const deleteRes = await client.query(deletionQuery, [datasourceId, siteId, processedHashesArray]);

            if (deleteRes.rows.length > 0) {
                const idsToDelete = deleteRes.rows.map((row) => row.id);
                recordsToDeleteIds.set(siteId, idsToDelete);
            }
        }

        let recordsToRemoveAttachment = [];
        const deleteAttemptsLimit = process.env.CRAWLER_DELETE_ATTEMPTS_LIMIT || 3;

        // 處理所有要刪除的附件
        for (const [siteId, recordsToDelete] of recordsToDeleteIds.entries()) {
            console.log(`需要刪除的附件記錄 (站點 ${siteId}):`, recordsToDelete);

            for (const attachmentId of recordsToDelete) {
                // 查詢該記錄的當前 delete_attempts 數值
                const res = await client.query(`SELECT delete_attempts FROM crawler_attachment WHERE id = $1`, [
                    attachmentId,
                ]);

                const content = res.rows[0];
                if (content) {
                    if (content.delete_attempts < deleteAttemptsLimit) {
                        // 如果刪除次數小於限制，則增加 delete_attempts
                        await client.query(
                            `UPDATE crawler_attachment 
                            SET delete_attempts = delete_attempts + 1, update_time = CURRENT_TIMESTAMP 
                            WHERE id = $1`,
                            [attachmentId]
                        );
                    } else {
                        // 如果達到刪除次數上限，將 recordId 加入待刪除陣列
                        recordsToRemoveAttachment.push(attachmentId);
                        console.log(`記錄 ${attachmentId} 已達到刪除次數上限，加入待刪除列表`);
                    }
                }
            }

            // 更新刪除記錄計數
            const crawlerId = crawlerSyncArray.find((item) => item.siteId === siteId)?.crawlerId;
            if (crawlerId) {
                deleteRecordCounts.set(crawlerId, (deleteRecordCounts.get(crawlerId) || 0) + recordsToDelete.length);
            }
        }

        // 如果有需要實際刪除的記錄，執行刪除操作
        if (recordsToRemoveAttachment.length > 0) {
            console.log(`已將 ${recordsToRemoveAttachment.length} 條記錄標記為刪除狀態`);
            await pythonAPI.removeCrawlerAttachment(
                datasetsId,
                recordsToRemoveAttachment, // 傳入待刪除的多個記錄 ID
                process.env.PYTHON_API_HOST,
                ava_token
            );
        }

        // 使用隊列處理附件
        let processedAttachments = [];
        const queue = async.queue(async (attachment) => {
            try {
                processedAttachments.push(attachment);

                if (processedAttachments.length >= batchSize) {
                    const batchToProcess = [...processedAttachments];
                    processedAttachments = [];

                    await uploadBatchToAPI(batchToProcess);
                    await batchInsert(batchToProcess);
                }
            } catch (error) {
                console.error("處理附件時發生錯誤:", error);
            }
        }, concurrency);

        // 檢查是否有附件需要處理
        if (finalAttachments.length === 0) {
            console.log("沒有需要處理的附件，跳過隊列處理");
        } else {
            const queueComplete = new Promise((resolve) => {
                queue.drain(() => {
                    resolve();
                });
            });

            // 將所有附件添加到隊列
            for (const attachment of finalAttachments) {
                await queue.push(attachment);
            }

            await queueComplete;

            // 處理剩餘的附件
            if (processedAttachments.length > 0) {
                await uploadBatchToAPI(processedAttachments);
                await batchInsert(processedAttachments);
            }
        }

        // 更新同步狀態
        for (const { crawlerId, crawler_synchronize_id } of crawlerSyncArray) {
            const newCount = newRecordCounts.get(crawlerId) || 0;
            const deleteCount = deleteRecordCounts.get(crawlerId) || 0;

            let newTrainingState;
            if (deleteCount > 0) {
                newTrainingState = 3; // 有刪除記錄
            }
            if (newCount > 0) {
                newTrainingState = 2; // 有新增記錄
            }

            if (newTrainingState) {
                await client.query("UPDATE crawler_attachment_synchronize SET training_state = $1 WHERE id = $2", [
                    newTrainingState,
                    crawler_synchronize_id,
                ]);
                console.log(`更新 crawler_synchronize_id ${crawler_synchronize_id} 狀態為 ${newTrainingState}`);
            } else {
                await client.query("UPDATE crawler_attachment_synchronize SET training_state = 3 WHERE id = $1", [
                    crawler_synchronize_id,
                ]);
                console.log(`更新 crawler_synchronize_id ${crawler_synchronize_id} 狀態為 3，沒有變更記錄`);
            }
        }

        console.log("附件處理完成！");
        return finalAttachments.length;
    } catch (err) {
        console.error("處理檔案時發生錯誤:", err.message, err.stack);

        // 處理錯誤情況
        for (const { crawlerId, crawler_synchronize_id } of crawlerSyncArray) {
            if (crawler_synchronize_id) {
                await client.query("UPDATE crawler_attachment_synchronize SET training_state = 99 WHERE id = $1", [
                    crawler_synchronize_id,
                ]);
            } else {
                let crawlerData = await client.query("SELECT config_jsonb FROM crawler WHERE id = $1", [crawlerId]);
                const crawlerConfigJsonb = crawlerData.rows[0]?.config_jsonb;
                await client.query(
                    "INSERT INTO crawler_attachment_synchronize (config_jsonb, datasource_id, crawler_id, training_state) VALUES($1, $2, $3, $4) RETURNING id",
                    [crawlerConfigJsonb, datasourceId, crawlerId, 99]
                );
            }
        }
        throw err;
    }
};

module.exports = {
    processCrawlerAttachmentFiles,
};

process.on("unhandledRejection", (reason, promise) => {
    console.error("(processFile.js)未處理的 Promise 拒絕:", reason);
    console.error("(processFile.js)Promise:", promise);
});

process.on("uncaughtException", (error) => {
    console.error("(processFile.js)未捕獲的異常:", error);
});
