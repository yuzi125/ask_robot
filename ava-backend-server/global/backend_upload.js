const multer = require("multer");
const FormData = require("form-data");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const iconv = require("iconv-lite");
const fs = require("fs");
const path = require("path");
const upload_host = "uploads_backend";
const { datasource } = require("../model/dbConvertModel");
const sql = require("../db/pgsql");
const Datasets = require("../orm/schema/datasets");
const ApiKeyMapping = require("../orm/schema/api_key_mapping");

const createFolder = (folder, source) => {
    try {
        fs.accessSync(`${upload_host}/${folder}/${datasource[source]}`);
    } catch (e) {
        fs.mkdirSync(`${upload_host}/${folder}/${datasource[source]}`, { recursive: true });
    }
};

const createCrawlerFolder = (folder, source, crawlerFolder) => {
    try {
        fs.accessSync(`${upload_host}/${folder}/${datasource[source]}/${crawlerFolder}`);
    } catch (e) {
        fs.mkdirSync(`${upload_host}/${folder}/${datasource[source]}/${crawlerFolder}`, { recursive: true });
    }
};

const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, `../tempResource/`));
    },
    filename: function (req, file, cb) {
        let mimetype = file.originalname.split(".").pop();
        const isDecodeUtf8 = req.headers["x-decode-uft8"] === "true";
        if (!isDecodeUtf8) {
            file.originalname = iconv.decode(Buffer.from(file.originalname, "binary"), "UTF-8");
        }
        cb(null, `${uuidv4()}.${mimetype}`);
    },
});
const readFile = (filePath) => {
    try {
        let file = path.join(__dirname, `../${upload_host}`, filePath);
        if (fs.existsSync(file)) {
            return fs.createReadStream(file);
        } else {
            return undefined;
        }
    } catch (e) {
        console.log(e.message);
    }
};
const getFullFilePath = (filePath) => {
    return path.join(__dirname, `../${upload_host}`, filePath);
};

exports.getFullFilePath = getFullFilePath;
exports.readFile = readFile;
exports.upload_host = upload_host;
exports.createFolder = createFolder;
exports.createCrawlerFolder = createCrawlerFolder;

exports.backend_upload = multer({
    storage: diskStorage,
    limits: {
        fileSize: 1024 * 1024 * 15,
        fieldSize: 1024 * 1024 * 15,
    },
    fileFilter(req, file, callback) {
        const allowedMimes = [
            "application/pdf",
            "text/plain",
            "text/csv",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/bmp",
            "image/webp",
        ];
        if (!allowedMimes.includes(file.mimetype)) {
            callback((new Error().message = `檔案格式錯誤，禁止${file.mimetype}`));
        } else {
            callback(null, true);
        }
    },
}).any();

const isImageFile = (filename) => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", "jfif", "txt"];
    return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
};

const deleteFile = (filePath) => {
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(`Error deleting file ${filePath}:`, err.message);
        } else {
            console.log(`File deleted: ${filePath}`);
        }
    });
};

async function getFileSizeLimit() {
    try {
        const result = await sql.query("SELECT value FROM settings WHERE key = $1", ["max_file_size"]);
        if (result.rows.length > 0) {
            const fileSizeLimit = parseInt(result.rows[0].value, 10); // 返回設定的 fileSize 大小
            return 1024 * 1024 * fileSizeLimit;
        }

        return 1024 * 1024 * 15; // 如果沒有設定，則返回默認的 15MB
    } catch (error) {
        console.log("Error getting file size limit:", error.message);
        return 1024 * 1024 * 15; // 如果發生錯誤，返回默認的 15MB
    }
}

async function createMulterInstance() {
    const fileSizeLimit = await getFileSizeLimit(); // 從資料庫獲取 fileSize 設定
    return multer({
        storage: diskStorage,
        limits: {
            fileSize: fileSizeLimit,
            fieldSize: 1024 * 1024 * 15, // 你也可以根據需要從資料庫讀取 fieldSize
        },
        fileFilter(req, file, callback) {
            const allowedMimes = [
                "application/pdf",
                "text/plain",
                "text/csv",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/bmp",
                "image/webp",
            ];
            if (!allowedMimes.includes(file.mimetype)) {
                callback(new Error(`檔案格式錯誤，禁止${file.mimetype}`));
            } else {
                callback(null, true);
            }
        },
    }).any();
}

// 把原檔跟轉完後的都傳到 API
const uploadToAPI = async (req, res, next) => {
    const upload = await createMulterInstance();
    upload(req, res, async function (err) {
        if (err) {
            return res.status(500).send({ error: err.message });
        }

        const { folder_name } = req.body;

        const resource_type = req.body.resource_type || "doc"; // 設定 resource_type，預設為 "crawler"
        let formData = new FormData();
        formData.append("folder_path", folder_name);

        // 儲存要刪除的文件路徑
        let filesToDelete = [];
        const maxBatchSize = 100 * 1024 * 1024; // 100M
        let currentBatchSize = 0;

        // 處理每一個上傳的文件
        for (let file of req.files) {
            let originalFileStream = fs.createReadStream(file.path); // 原始文件 stream
            let PDFFilename = null;
            let fileSize = fs.statSync(file.path).size; // 取得文件大小

            try {
                // 如果檔案不是圖片或文本文件，也不是 PDF，就轉換成 PDF
                console.log("file.originalname", file.originalname);
                if (!isImageFile(file.originalname) && !file.originalname.endsWith(".pdf")) {
                    console.log("如果檔案不是圖片或文本文件，也不是 PDF，就轉換成 PDF");
                    let tempFormData = new FormData();
                    tempFormData.append("file", fs.createReadStream(file.path));

                    // 調用 API 進行文件轉換成 PDF
                    let rs = await axios.post(process.env.DR_FILE_MGR, tempFormData, {
                        headers: { "Content-Type": "multipart/form-data" },
                        responseType: "arraybuffer",
                    });

                    // 轉換完成後，將 PDF 檔案儲存在臨時目錄中
                    PDFFilename = file.filename.replace(/\.[^.]+$/, ".pdf");
                    let pdfFilePath = path.join(__dirname, `../tempResource/`, PDFFilename); // 將 PDF 儲存在臨時目錄
                    fs.writeFileSync(pdfFilePath, rs.data);

                    // 取得 PDF 文件大小
                    let pdfFileSize = fs.statSync(pdfFilePath).size;
                    console.log("pdfFileSize", pdfFileSize);
                    // 上傳原始檔案和轉換後的 PDF
                    formData.append("files", originalFileStream, file.filename);
                    formData.append("files", fs.createReadStream(pdfFilePath), PDFFilename);

                    currentBatchSize += fileSize + pdfFileSize;

                    // 將轉換後的 PDF 文件路徑加入刪除列表
                    filesToDelete.push(pdfFilePath);
                } else {
                    console.log("如果是圖片或 PDF，直接上傳原始文件");
                    // 如果是圖片或 PDF，直接上傳原始文件
                    formData.append("files", originalFileStream, file.filename);
                    currentBatchSize += fileSize;
                }

                // 將原始文件路徑加入刪除列表
                filesToDelete.push(file.path);

                // 如果批次大小達到或超過 100MB，則上傳並重置
                if (currentBatchSize >= maxBatchSize) {
                    const uploadError = await uploadBatch(formData, resource_type, filesToDelete, res);
                    if (uploadError) return; // 如果上傳失敗，立即返回
                    formData = new FormData(); // 重置 formData
                    formData.append("folder_path", folder_name); // 重置 folder_name
                    filesToDelete = []; // 重置要刪除的文件列表
                    currentBatchSize = 0; // 重置批次大小
                }
            } catch (error) {
                console.error("Error processing file:", error.message);
                // 處理文件錯誤，不要回傳 res 以免重複發送
                continue;
            }
        }

        // 把剩餘的文件上傳
        if (currentBatchSize > 0) {
            const uploadError = await uploadBatch(formData, resource_type, filesToDelete, res);
            if (uploadError) return; // 如果上傳失敗，立即返回
        }

        next(); // 成功時才進行後續的處理
    });
};

// 批次上傳函數
const uploadBatch = async (formData, resource_type, filesToDelete, res) => {
    try {
        const response = await axios.post(`${process.env.AVA_FILE_SERVICE_URL}/upload/${resource_type}`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        if (response.status === 200) {
            filesToDelete.forEach(deleteFile);
            console.log("批次上傳並刪除成功");
            return null; // 無錯誤
        }
    } catch (uploadErr) {
        console.log("Error uploading to API:", uploadErr.message);
        if (!res.headersSent) {
            // 確保回應尚未發送
            res.status(500).send({ error: uploadErr.message });
        }
        return uploadErr; // 傳回錯誤訊息，讓外層判斷
    }
};

exports.uploadToAPI = uploadToAPI;

exports.datasetsIdUploadToAPI = async (req, res, next) => {
    // req.on('data', (chunk) => {
    //     console.log(chunk.toString()); // 打印請求主體內容
    // });

    const upload = await createMulterInstance();
    upload(req, res, async function (err) {
        if (err) {
            return res.status(500).send({ error: err.message });
        }

        const { datasets_id } = req.body;

        if (datasets_id) {
            try {
                await ApiKeyMapping.create({
                    api_key_id: req.apiKeyData.id,
                    mapping_type: 2, // 1對應expert 2對應dataset
                    mapping_id: datasets_id,
                    usage_id: req.usage_id,
                });
            } catch (error) {
                try {
                    const errorFilesToDelete = [...req.files.map((file) => file.path)];
                    errorFilesToDelete.forEach(deleteFile);
                    return res.status(500).json({ error: error.message });
                } catch (error) {
                    console.error(error);
                    return res.status(500).json({ error: "datasetsIdUploadToAPI delete file error" });
                }
            }
        }

        let dataset;
        try {
            dataset = await Datasets.findOne({
                where: { id: datasets_id },
                attributes: ["folder_name"],
            });

            if (!dataset) {
                const errorFilesToDelete = [...req.files.map((file) => file.path)];
                errorFilesToDelete.forEach(deleteFile);
                return res.status(404).send({ error: "Dataset not found" });
            }

            // 將 folder_name 設置到 req.body
            req.body.folder_name = dataset.folder_name;
        } catch (error) {
            try {
                const errorFilesToDelete = [...req.files.map((file) => file.path)];
                errorFilesToDelete.forEach(deleteFile);
                return res.status(500).send({ error: error.message });
            } catch (error) {
                console.error(error);
                return res.status(500).send({ error: "datasetsIdUploadToAPI delete file error" });
            }
        }

        const folder_name = dataset.folder_name;

        const resource_type = req.body.resource_type || "doc"; // 設定 resource_type，預設為 "crawler"
        let formData = new FormData();
        formData.append("folder_path", folder_name);

        // 儲存要刪除的文件路徑
        let filesToDelete = [];
        const maxBatchSize = 100 * 1024 * 1024; // 100M
        let currentBatchSize = 0;

        // 處理每一個上傳的文件
        for (let file of req.files) {
            let originalFileStream = fs.createReadStream(file.path); // 原始文件 stream
            let PDFFilename = null;
            let fileSize = fs.statSync(file.path).size; // 取得文件大小

            try {
                // 如果檔案不是圖片或文本文件，也不是 PDF，就轉換成 PDF
                if (!isImageFile(file.originalname) && !file.originalname.endsWith(".pdf")) {
                    console.log("如果檔案不是圖片或文本文件，也不是 PDF，就轉換成 PDF");
                    let tempFormData = new FormData();
                    tempFormData.append("file", fs.createReadStream(file.path));

                    // 調用 API 進行文件轉換成 PDF
                    let rs = await axios.post(process.env.DR_FILE_MGR, tempFormData, {
                        headers: { "Content-Type": "multipart/form-data" },
                        responseType: "arraybuffer",
                    });

                    // 轉換完成後，將 PDF 檔案儲存在臨時目錄中
                    PDFFilename = file.filename.replace(/\.[^.]+$/, ".pdf");
                    let pdfFilePath = path.join(__dirname, `../tempResource/`, PDFFilename); // 將 PDF 儲存在臨時目錄
                    fs.writeFileSync(pdfFilePath, rs.data);

                    // 取得 PDF 文件大小
                    let pdfFileSize = fs.statSync(pdfFilePath).size;
                    console.log("pdfFileSize", pdfFileSize);
                    // 上傳原始檔案和轉換後的 PDF
                    formData.append("files", originalFileStream, file.filename);
                    formData.append("files", fs.createReadStream(pdfFilePath), PDFFilename);

                    currentBatchSize += fileSize + pdfFileSize;

                    // 將轉換後的 PDF 文件路徑加入刪除列表
                    filesToDelete.push(pdfFilePath);
                } else {
                    console.log("如果是圖片或 PDF，直接上傳原始文件");
                    // 如果是圖片或 PDF，直接上傳原始文件
                    formData.append("files", originalFileStream, file.filename);
                    currentBatchSize += fileSize;
                }

                // 將原始文件路徑加入刪除列表
                filesToDelete.push(file.path);

                // 如果批次大小達到或超過 100MB，則上傳並重置
                if (currentBatchSize >= maxBatchSize) {
                    const uploadError = await uploadBatch(formData, resource_type, filesToDelete, res);
                    if (uploadError) return; // 如果上傳失敗，立即返回
                    formData = new FormData(); // 重置 formData
                    formData.append("folder_path", folder_name); // 重置 folder_name
                    filesToDelete = []; // 重置要刪除的文件列表
                    currentBatchSize = 0; // 重置批次大小
                }
            } catch (error) {
                console.error("Error processing file:", error.message);
                // 處理文件錯誤，不要回傳 res 以免重複發送
                continue;
            }
        }

        // 把剩餘的文件上傳
        if (currentBatchSize > 0) {
            const uploadError = await uploadBatch(formData, resource_type, filesToDelete, res);
            if (uploadError) return; // 如果上傳失敗，立即返回
        }

        next(); // 成功時才進行後續的處理
    });
};
