const { finished } = require("stream"); // 使用 stream.finished() 來監聽文件流結束
const fastify = require("fastify");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const rfs = require("rotating-file-stream");
const { v4: uuidv4 } = require("uuid");

// 設置 rotating file stream，使用日期和大小滾動
const logFileStream = rfs.createStream(
    (time, index) => {
        // 使用當前日期，如果 time 不存在則取當前時間
        const currentDate = time ? new Date(time) : new Date();
        const date = currentDate.toISOString().slice(0, 10); // 使用日期作為文件名

        // 如果 index 為 undefined，則設置為 0
        const fileIndex = index !== undefined ? index : 0;

        return `${date}-${fileIndex}.log`; // 日期加上文件索引
    },
    {
        size: "30M", // 當文件達到 30MB 時進行滾動
        interval: "1d", // 每天滾動一次
        path: path.join(__dirname, "logs"),
    }
);

// 創建多流支持的 pino logger，直接配置 stdout 和文件
const logger = pino(
    {
        level: "info",
    },
    pino.multistream([
        { stream: process.stdout }, // 日誌輸出到 stdout
        { stream: logFileStream }, // 日誌寫入滾動文件
    ])
);

// 創建 Fastify 實例，將日誌發送到滾動的日誌文件
const app = fastify({
    logger,
    maxParamLength: 500,
});

async function startServer() {
    app.register(require("@fastify/multipart"), {
        limits: {
            fileSize: 1024 * 1024 * 1024, // 1GB
        },
    });

    app.get("/list-logs", async function (req, reply) {
        try {
            const logDir = path.join(__dirname, "node_logs");

            // 檢查 logs 目錄是否存在
            if (!fs.existsSync(logDir)) {
                return reply.code(404).send({ error: "Logs directory not found." });
            }

            // 讀取 logs 目錄下的文件列表
            const logFiles = await fs.promises.readdir(logDir);

            // 返回文件名列表
            reply.send({ logs: logFiles });
        } catch (err) {
            req.log.error(`Error listing log files: ${err.message}`);
            reply.code(500).send({ error: `Error listing log files: ${err.message}` });
        }
    });

    app.post("/upload-log", async function (req, reply) {
        try {
            const parts = req.parts();
            let logUploadStatus = {};

            for await (const part of parts) {
                if (part.file) {
                    const logDir = path.join(__dirname, "node_logs");

                    // 確保 logs 目錄存在
                    if (!fs.existsSync(logDir)) {
                        await fs.promises.mkdir(logDir, { recursive: true });
                    }

                    const safeFilePath = path.join(logDir, path.basename(part.filename));

                    // 創建文件寫入流並使用 finished 監聽文件結束
                    const fileStream = fs.createWriteStream(safeFilePath);

                    // 對文件流進行錯誤處理
                    part.file.on("error", (err) => {
                        req.log.error(`File part encountered an error: ${err.message}`);
                        reply.code(500).send({ error: `Error uploading file: ${err.message}` });
                    });

                    part.file.pipe(fileStream);

                    await new Promise((resolve, reject) => {
                        finished(fileStream, (err) => {
                            if (err) {
                                logUploadStatus[part.filename] = {
                                    status: false,
                                    msg: `Failed to upload log: ${err.message}`,
                                };
                                return reject(err);
                            } else {
                                logUploadStatus[part.filename] = { status: true, msg: "Log uploaded successfully" };
                                resolve();
                            }
                        });
                    });
                }
            }

            reply.send(logUploadStatus);
        } catch (err) {
            req.log.error(`Error uploading logs: ${err.message}`);
            reply.code(500).send({ error: `Error uploading logs: ${err.message}` });
        }
    });

    // 文件下載 API，處理從指定路徑下載文件
    app.post("/download-log", async function (req, reply) {
        const { filename } = req.body;

        // 檢查是否提供了 filename
        if (!filename) {
            return reply.code(400).send({ error: "Filename is required." });
        }

        // 構造安全的文件路徑，避免目錄遍歷
        const logDir = path.join(__dirname, "node_logs"); // 假設日誌文件都存儲在 logs 目錄下
        const safeFilePath = path.resolve(logDir, filename);

        // 確保最終路徑仍然位於 logs 目錄內
        if (!safeFilePath.startsWith(logDir)) {
            return reply.code(400).send({ error: "Invalid path. Potential directory traversal attack detected." });
        }

        try {
            // 檢查文件是否存在
            await fs.promises.access(safeFilePath, fs.constants.R_OK);

            const stream = fs.createReadStream(safeFilePath);

            // 設置回應頭，指定文件名
            const encodedFilename = encodeURIComponent(filename);
            reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodedFilename}`);

            // 傳送文件流
            return reply.type("application/octet-stream").send(stream);
        } catch (err) {
            req.log.error(err);

            // 根據不同的錯誤代碼返回相應的錯誤訊息
            if (err.code === "ENOENT") {
                return reply.code(404).send({ error: "File not found." });
            }
            if (err.code === "EACCES") {
                return reply.code(403).send({ error: "Access denied." });
            }

            // 其他錯誤，返回500
            return reply.code(500).send({ error: `An unknown error occurred: ${err.message}` });
        }
    });

    app.post("/upload/:resource_type", async function (req, reply) {
        const { resource_type } = req.params;
        const allowedTypes = ["crawler", "doc"];

        if (!allowedTypes.includes(resource_type)) {
            return reply.code(400).send({ error: 'Invalid type provided. Allowed types are "crawler" and "doc".' });
        }

        const formFields = {}; // 用於存儲表單字段
        const fileStatuses = {}; // 用於存儲每個文件的狀態

        try {
            const parts = req.parts();

            for await (const part of parts) {
                if (part.file) {
                    const folder_path = formFields.folder_path;
                    if (!folder_path) {
                        return reply.code(400).send({ error: "folder_name is required" });
                    }

                    // 防止目錄遍歷：解析並檢查目錄路徑
                    const uploadDir = path.join(__dirname, "uploads", resource_type);
                    const safeDirPath = path.resolve(uploadDir, ...folder_path.split("/"));

                    // 檢查 safeDirPath 是否在 uploads 目錄內
                    if (!safeDirPath.startsWith(uploadDir)) {
                        return reply
                            .code(400)
                            .send({ error: "Invalid path. Potential directory traversal attack detected." });
                    }

                    // 構建文件路徑
                    const safeFilePath = path.join(safeDirPath, path.basename(part.filename)); // 只允許純文件名

                    // 檢查目錄是否存在，不存在則創建
                    try {
                        await fs.promises.access(safeDirPath);
                    } catch (accessErr) {
                        if (accessErr.code === "ENOENT") {
                            await fs.promises.mkdir(safeDirPath, { recursive: true });
                        } else {
                            return reply.code(500).send({ error: `Error accessing directory: ${accessErr.message}` });
                        }
                    }

                    // 處理文件上傳
                    try {
                        const fileStream = fs.createWriteStream(safeFilePath);

                        // 使用 stream.finished() 來確保文件寫入完成
                        part.file.pipe(fileStream);
                        await new Promise((resolve, reject) => {
                            finished(fileStream, (err) => {
                                if (err) {
                                    req.log.error(`Failed to write file: ${err.message}`);
                                    fileStatuses[part.filename] = {
                                        status: false,
                                        msg: `Failed to write file: ${err.message}`,
                                    };
                                    return reject(err);
                                } else {
                                    fileStatuses[part.filename] = { status: true, msg: "File written successfully" };
                                    resolve();
                                }
                            });
                        });
                    } catch (err) {
                        req.log.error(`Error writing file ${part.filename}: ${err.message}`);
                        fileStatuses[part.filename] = { status: false, msg: `Failed to write file: ${err.message}` };
                    }
                } else {
                    // 存儲表單字段
                    formFields[part.fieldname] = part.value;
                }
            }

            reply.send(fileStatuses);
        } catch (err) {
            req.log.error(`Error processing files: ${err.message}`);
            return reply.code(500).send({ error: `Error processing files: ${err.message}` });
        }
    });

    // 文件下載 API，帶有更詳細的錯誤處理
    app.post("/download/:resource_type", async function (req, reply) {
        const { resource_type } = req.params;
        const { folder_path, filename } = req.body;
        const allowedTypes = ["crawler", "doc"];

        if (!allowedTypes.includes(resource_type)) {
            return reply.code(400).send({ error: 'Invalid type provided. Allowed types are "crawler" and "doc".' });
        }

        // 檢查是否提供了 folder_path 和 filename
        if (!folder_path || !filename) {
            return reply.code(400).send({ error: "Both folder_path and filename are required." });
        }

        // 確保 folder_path 和 filename 不包含惡意的目錄遍歷字符
        const uploadDir = path.join(__dirname, "uploads", resource_type);
        const safeDirPath = path.resolve(uploadDir, ...folder_path.split("/"));
        const safeFilePath = path.resolve(safeDirPath, filename);

        // 確保最終的路徑仍然位於 uploads 目錄內
        if (!safeFilePath.startsWith(uploadDir)) {
            return reply.code(400).send({ error: "Invalid path. Potential directory traversal attack detected." });
        }

        try {
            // 檢查文件是否存在並且可訪問
            await fs.promises.access(safeFilePath);
            const stream = fs.createReadStream(safeFilePath);
            // 將中文文件名進行 URL 編碼
            const encodedFilename = encodeURIComponent(filename);

            // 設置 Content-Disposition 頭部，使用 filename* 指定編碼的文件名
            reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodedFilename}`);
            return reply.type("application/octet-stream").send(stream); // 設置 MIME 類型並發送文件流
        } catch (err) {
            // 檢查錯誤代碼，返回相應的錯誤訊息
            req.log.error(err);
            if (err.code === "ENOENT") {
                // 文件不存在
                reply.code(404).send({
                    status: "error",
                    message: "File not found. Please check the folder_name or filename.",
                });
            } else if (err.code === "EACCES") {
                // 沒有權限訪問
                reply.code(403).send({
                    status: "error",
                    message: "Access denied. You do not have permission to access this file.",
                });
            } else if (err.code === "EISDIR") {
                // 該路徑是目錄，不是文件
                reply.code(400).send({ status: "error", message: "Requested path is a directory, not a file." });
            } else if (err.code === "ENOTDIR") {
                // 指定路徑中的某個部分不是目錄
                reply.code(400).send({
                    status: "error",
                    message: "Invalid path. Part of the provided path is not a directory.",
                });
            } else {
                // 其他錯誤，返回500
                reply.code(500).send({ status: "error", message: `An unknown error occurred: ${err.message}` });
            }
        }
    });

    app.post("/delete/:resource_type", async function (req, reply) {
        const { resource_type } = req.params;
        const { folder_path, filenames } = req.body;
        const allowedTypes = ["crawler", "doc"];

        // Validate resource_type
        if (!allowedTypes.includes(resource_type)) {
            return reply.code(400).send({ error: 'Invalid type. Allowed types are "crawler" and "doc".' });
        }

        // Validate folder_path and filenames
        if (!folder_path || !Array.isArray(filenames) || filenames.length === 0) {
            return reply.code(400).send({ error: "Both folder_path and an array of filenames are required." });
        }

        // Resolve directory path to prevent directory traversal
        const uploadDir = path.join(__dirname, "uploads", resource_type);
        const safeDirPath = path.resolve(uploadDir, ...folder_path.split("/"));

        // Check if safeDirPath is within the allowed uploads directory
        if (!safeDirPath.startsWith(uploadDir)) {
            return reply.code(400).send({ error: "Invalid path. Potential directory traversal attack detected." });
        }

        // Initialize delete results counters and details
        const deleteResults = {
            successCount: 0,
            failureCount: 0,
            failures: [],
        };

        // Iterate over filenames to delete
        for (const filename of filenames) {
            try {
                // Construct the safe file path
                const safeFilePath = path.resolve(safeDirPath, filename);

                // Ensure the final file path is within the uploads directory
                if (!safeFilePath.startsWith(uploadDir)) {
                    deleteResults.failures.push({
                        filename: filename,
                        error: "Invalid path. Potential directory traversal attack detected.",
                    });
                    deleteResults.failureCount++;
                    continue;
                }

                // Attempt to delete the file
                await fs.promises.unlink(safeFilePath);
                deleteResults.successCount++;
            } catch (err) {
                let errorMessage = err.message.split(",")[0]; // Get only the error code and short description
                deleteResults.failures.push({
                    filename: filename,
                    error: errorMessage,
                });
                deleteResults.failureCount++;
            }
        }

        // Return the delete results
        reply.send(deleteResults);
    });

    app.post("/backend/uploadFilesLlmApi", async function (req, reply) {
        try {
            const parts = req.parts();
            const fileStatuses = {};
            const formFields = {};

            for await (const part of parts) {
                if (part.file) {
                    // 檢查是否提供了必要的欄位
                    if (!formFields.message) {
                        continue;
                    }

                    // 建立聊天檔案的目錄結構: chat/{messageId}/
                    const uploadDir = path.join(__dirname, "uploads", "chat");
                    const messageId = uuidv4();
                    const userDir = path.join(uploadDir, messageId);

                    // 確保目錄存在
                    if (!fs.existsSync(userDir)) {
                        await fs.promises.mkdir(userDir, { recursive: true });
                    }

                    // 修正：正確處理檔案名稱
                    // 使用原始檔案名稱而不是 path.basename，這樣可以保留完整檔案名稱
                    const originalFilename = part.filename;
                    // 處理可能的路徑注入攻擊
                    const safeFilename = originalFilename.replace(/[/\\?%*:|"<>]/g, "_");
                    const safeFilePath = path.join(userDir, safeFilename);

                    // 處理檔案上傳
                    const fileStream = fs.createWriteStream(safeFilePath);
                    part.file.pipe(fileStream);

                    await new Promise((resolve, reject) => {
                        finished(fileStream, (err) => {
                            if (err) {
                                fileStatuses[originalFilename] = {
                                    status: false,
                                    msg: `Failed to upload file: ${err.message}`,
                                };
                                return reject(err);
                            } else {
                                fileStatuses[originalFilename] = {
                                    status: true,
                                    msg: "File uploaded successfully",
                                    path: `chat/download/${messageId}/${safeFilename}`,
                                };
                                resolve();
                            }
                        });
                    });
                } else {
                    // 存儲表單字段
                    formFields[part.fieldname] = part.value;
                }
            }

            // 檢查是否提供了必要的欄位
            if (!formFields.message) {
                return reply.code(400).send({
                    error: "Missing required fields: message",
                });
            }

            reply.send({
                success: true,
                files: fileStatuses,
            });
        } catch (err) {
            req.log.error(`Error uploading chat files: ${err.message}`);
            reply.code(500).send({
                error: `Error uploading chat files: ${err.message}`,
            });
        }
    });
    //* 這邊處理前台聊天室的 API

    // 上傳聊天檔案 API
    // 修改 file-service 中的上傳 API
    app.post("/chat/upload", async function (req, reply) {
        try {
            const parts = req.parts();
            const fileStatuses = {};
            const formFields = {};

            for await (const part of parts) {
                if (part.file) {
                    // 檢查是否提供了必要的欄位
                    if (!formFields.userId || !formFields.conversationId) {
                        continue; // 等待所有欄位收集完再檢查
                    }

                    // 建立聊天檔案的目錄結構: chat/{userId}/{conversationId}/
                    const uploadDir = path.join(__dirname, "uploads", "chat");
                    const userDir = path.join(uploadDir, formFields.userId);
                    const conversationDir = path.join(userDir, formFields.conversationId);

                    // 確保目錄存在
                    if (!fs.existsSync(conversationDir)) {
                        await fs.promises.mkdir(conversationDir, { recursive: true });
                    }

                    // 修正：正確處理檔案名稱
                    // 使用原始檔案名稱而不是 path.basename，這樣可以保留完整檔案名稱
                    const originalFilename = part.filename;
                    // 處理可能的路徑注入攻擊
                    const safeFilename = originalFilename.replace(/[/\\?%*:|"<>]/g, "_");
                    const safeFilePath = path.join(conversationDir, safeFilename);

                    // 處理檔案上傳
                    const fileStream = fs.createWriteStream(safeFilePath);
                    part.file.pipe(fileStream);

                    await new Promise((resolve, reject) => {
                        finished(fileStream, (err) => {
                            if (err) {
                                fileStatuses[originalFilename] = {
                                    status: false,
                                    msg: `Failed to upload file: ${err.message}`,
                                };
                                return reject(err);
                            } else {
                                fileStatuses[originalFilename] = {
                                    status: true,
                                    msg: "File uploaded successfully",
                                    path: `chat/download/${formFields.userId}/${formFields.conversationId}/${safeFilename}`,
                                };
                                resolve();
                            }
                        });
                    });
                } else {
                    // 存儲表單字段
                    formFields[part.fieldname] = part.value;
                }
            }

            // 檢查是否提供了必要的欄位
            if (!formFields.userId || !formFields.conversationId) {
                return reply.code(400).send({
                    error: "Missing required fields: userId and conversationId",
                });
            }

            reply.send({
                success: true,
                files: fileStatuses,
            });
        } catch (err) {
            req.log.error(`Error uploading chat files: ${err.message}`);
            reply.code(500).send({
                error: `Error uploading chat files: ${err.message}`,
            });
        }
    });
    // 獲取聊天檔案列表 API
    app.get("/chat/files/:userId/:conversationId", async function (req, reply) {
        try {
            const { userId, conversationId } = req.params;

            // 安全檢查
            if (!userId || !conversationId) {
                return reply.code(400).send({
                    error: "Both userId and conversationId are required",
                });
            }

            // 構建目錄路徑
            const dirPath = path.join(__dirname, "uploads", "chat", userId, conversationId);

            // 檢查目錄是否存在
            try {
                await fs.promises.access(dirPath);
            } catch (err) {
                // 目錄不存在，返回空列表
                return reply.send({
                    success: true,
                    files: [],
                });
            }

            // 讀取目錄內容
            const files = await fs.promises.readdir(dirPath);

            // 獲取每個檔案的詳細資訊
            const fileDetails = await Promise.all(
                files.map(async (file) => {
                    const filePath = path.join(dirPath, file);
                    const stats = await fs.promises.stat(filePath);

                    return {
                        name: file,
                        size: stats.size,
                        createdAt: stats.birthtime,
                        path: `chat/${userId}/${conversationId}/${file}`,
                    };
                })
            );

            reply.send({
                success: true,
                files: fileDetails,
            });
        } catch (err) {
            req.log.error(`Error listing chat files: ${err.message}`);
            reply.code(500).send({
                error: `Error listing chat files: ${err.message}`,
            });
        }
    });

    // 下載聊天檔案 API

    app.get("/chat/download/:userId/:conversationId/:filename", async function (req, reply) {
        try {
            const { userId, conversationId, filename } = req.params;
            const { preview } = req.query; // 獲取預覽模式參數

            // 安全檢查
            if (!userId || !conversationId || !filename) {
                return reply.code(400).send({
                    error: "UserId, conversationId and filename are required",
                });
            }

            // 構建檔案路徑
            const filePath = path.join(__dirname, "uploads", "chat", userId, conversationId, filename);

            // 檢查檔案是否存在
            try {
                await fs.promises.access(filePath, fs.constants.R_OK);
            } catch (err) {
                return reply.code(404).send({
                    error: "File not found or not accessible",
                });
            }

            // 設置檔案名稱，包含編碼處理
            const encodedFilename = encodeURIComponent(filename);

            // 根據檔案類型和預覽模式決定內容類型和下載方式
            const isPreview = preview === "true";
            const fileExt = filename.split(".").pop().toLowerCase();

            // 檢查檔案類型
            let contentType = "application/octet-stream";

            // 先預覽 PDF 就好，其他的看情況 +
            const previewableTypes = {
                pdf: "application/pdf",
            };

            // 設置正確的內容類型
            if (previewableTypes[fileExt]) {
                contentType = previewableTypes[fileExt];
            }

            // 設置內容處理方式（inline 用於預覽，attachment 用於下載）
            const disposition = isPreview ? "inline" : "attachment";
            reply.header("Content-Disposition", `${disposition}; filename*=UTF-8''${encodedFilename}`);

            // 發送檔案
            const stream = fs.createReadStream(filePath);
            return reply.type(contentType).send(stream);
        } catch (err) {
            req.log.error(`Error downloading chat file: ${err.message}`);
            reply.code(500).send({
                error: `Error downloading chat file: ${err.message}`,
            });
        }
    });

    // 刪除聊天檔案 API
    app.delete("/chat/files/:userId/:conversationId", async function (req, reply) {
        try {
            const { userId, conversationId } = req.params;
            const { filenames } = req.body; // 可選參數，如果提供則只刪除特定檔案

            // 安全檢查
            if (!userId || !conversationId) {
                return reply.code(400).send({
                    error: "Both userId and conversationId are required",
                });
            }

            // 構建目錄路徑
            const dirPath = path.join(__dirname, "uploads", "chat", userId, conversationId);

            // 檢查目錄是否存在
            try {
                await fs.promises.access(dirPath);
            } catch (err) {
                // 目錄不存在，視為成功
                return reply.send({
                    success: true,
                    message: "No files to delete",
                });
            }

            // 如果提供了特定檔案名稱，則只刪除這些檔案
            if (filenames && Array.isArray(filenames) && filenames.length > 0) {
                const deleteResults = {
                    success: true,
                    deleted: [],
                    failed: [],
                };

                for (const filename of filenames) {
                    try {
                        const filePath = path.join(dirPath, filename);
                        // 確保檔案路徑不超出指定目錄範圍
                        if (!filePath.startsWith(dirPath)) {
                            deleteResults.failed.push({
                                filename,
                                error: "Invalid filename",
                            });
                            continue;
                        }

                        await fs.promises.unlink(filePath);
                        deleteResults.deleted.push(filename);
                    } catch (err) {
                        deleteResults.failed.push({
                            filename,
                            error: err.message,
                        });
                    }
                }

                reply.send(deleteResults);
            } else {
                // 沒有提供特定檔案名稱，刪除整個對話目錄
                const deleteFolderRecursive = async (folderPath) => {
                    if (fs.existsSync(folderPath)) {
                        const files = await fs.promises.readdir(folderPath);

                        for (const file of files) {
                            const curPath = path.join(folderPath, file);
                            const stats = await fs.promises.stat(curPath);

                            if (stats.isDirectory()) {
                                // 遞歸刪除子目錄
                                await deleteFolderRecursive(curPath);
                            } else {
                                // 刪除檔案
                                await fs.promises.unlink(curPath);
                            }
                        }

                        // 刪除目錄本身
                        await fs.promises.rmdir(folderPath);
                    }
                };

                await deleteFolderRecursive(dirPath);

                reply.send({
                    success: true,
                    message: "All files deleted successfully",
                });
            }
        } catch (err) {
            req.log.error(`Error deleting chat files: ${err.message}`);
            reply.code(500).send({
                error: `Error deleting chat files: ${err.message}`,
            });
        }
    });

    app.listen({ port: 8090, host: "0.0.0.0" }, (err, address) => {
        if (err) {
            app.log.error(err);
            process.exit(1);
        }
    });
}

// 啟動服務器
startServer().catch((err) => {
    logger.error(`Failed to start server: ${err}`);
    process.exit(1);
});
