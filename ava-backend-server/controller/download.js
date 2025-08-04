const sql = require("../db/pgsql");
const { readFile } = require("../global/backend_upload");
const responseModel = require("../model/responseModel");
const { processUploadDocument } = require("../utils/download-utils");
const JSZip = require("jszip");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const {
    getUploadDocumentInfo,
    getCrawlerDocumentInfo,
    getImageStoreInfo,
    downloadFile,
    downloadChatFile,
} = require("../utils/download-utils"); // utils 位置視情況調整
const Settings = require("../orm/schema/settings");

exports.download = async function (req, res) {
    let rsmodel = { code: 0, message: "" };
    try {
        let { filename } = req.params;
        let { preview, token, attachmentId } = req.query;

        // 驗證 token
        if (token) {
            try {
                const fileJwtKey = process.env.FILE_EXPIRE_JWT_SECRET_KEY || "d436fce7-efa4-412b-af9b-151dc4298403";
                jwt.verify(token, fileJwtKey);
            } catch (e) {
                console.error("Invalid token:", e.message);
                rsmodel.code = 1;
                rsmodel.message = e.name === "TokenExpiredError" ? "token 已過期" : "無效的 token";
                return res.json(rsmodel);
            }
        }

        const filenameArray = filename.split(".");
        let fileId = filenameArray[0];
        const downloadFileType = filenameArray[filenameArray.length - 1];
        let fileInfo;

        // 先找 image store，再看權限。主要是聊天室"圖片來源"會用到
        fileInfo = await getImageStoreInfo(fileId);
        if (fileInfo) {
            return downloadFile(res, "doc", fileInfo.folderPath, fileInfo.filename, filename, "jpeg");
        }

        const guest_enable = await Settings.findOne({ where: { key: "guest_enable" } });
        if (guest_enable && guest_enable.value !== "1" && req.session?.userType === "guest") {
            rsmodel.code = 1;
            rsmodel.message = "下載權限不足";
            return res.json(rsmodel);
        }

        // 嘗試從 upload_documents 查詢
        fileInfo = await getUploadDocumentInfo(fileId);
        if (fileInfo) {
            let { folder, originalname } = fileInfo;
            originalname = originalname.replace(/\.[^.]+$/, `.${downloadFileType}`);
            return downloadFile(res, "doc", folder, filename, originalname, downloadFileType, preview);
        }

        // 如果 upload_documents 沒有，再查 crawler_documents_content 或 crawler_attachment
        fileInfo = await getCrawlerDocumentInfo(fileId, filename, attachmentId);
        if (fileInfo) {
            return downloadFile(
                res,
                "crawler",
                fileInfo.folderPath,
                fileInfo.filename,
                filename,
                downloadFileType,
                preview
            );
        }

        console.error("資料庫找不到檔案");
        rsmodel.message = "資料庫找不到檔案";
        res.json(rsmodel);
    } catch (e) {
        console.error("發生錯誤", e.message);
        rsmodel.message = "發生錯誤，請稍後再試";
        res.json(rsmodel);
    }
};

exports.downloadChat = async function (req, res) {
    let rsmodel = { code: 0, message: "" };
    try {
        let { userId } = req.params;
        let { conversationId, conversationFilename, preview } = req.query;

        if (userId && conversationId && conversationFilename) {
            return downloadChatFile(res, userId, conversationId, conversationFilename, preview);
        }

        console.error("資料庫找不到檔案");
        rsmodel.message = "資料庫找不到檔案";
        res.json(rsmodel);
    } catch (e) {
        console.error("發生錯誤", e.message);
        rsmodel.message = "發生錯誤，請稍後再試";
        res.json(rsmodel);
    }
};

exports.downloadfilename = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { filenames } = JSON.parse(req.body);
        const zip = new JSZip();

        for (let filename of filenames) {
            let fileId = filename.split(".")[0];

            // 查詢資料庫獲取 folder_name 和 originalname
            let rs = await sql.query(
                "select b.folder_name,a.originalname from upload_documents a LEFT JOIN datasets b ON b.id = a.datasets_id where a.id = $1",
                [fileId]
            );

            if (rs.rows.length > 0) {
                rs = rs.rows[0];
                let folder = rs.folder_name;
                let originalname = rs.originalname;

                // 構建 API 請求 URL 和參數
                const resourceType = "doc"; // 根據需要設定 resourceType
                const apiUrl = `${process.env.AVA_FILE_SERVICE_URL}/download/${resourceType}`; // 替換成實際 API URL

                // 發送 POST 請求到 API
                const response = await axios.post(
                    apiUrl,
                    {
                        folder_path: folder,
                        filename: filename,
                    },
                    {
                        responseType: "arraybuffer", // 確保接收到的是二進位資料
                    }
                );

                // 添加檔案到壓縮檔
                zip.file(originalname, response.data);
            }
        }

        const zipData = await zip.generateAsync({ type: "nodebuffer" });
        const uuid = uuidv4();
        const zipPath = `temp_zip/${uuid}.zip`;
        fs.writeFileSync(zipPath, zipData);
        console.info("檔案下載壓縮完畢");
        rsmodel.code = 0;
        rsmodel.data = { filename: `${uuid}.zip` };
        res.json(rsmodel);
    } catch (e) {
        console.error(e.message);
        rsmodel.message = e.message;
        res.json(rsmodel);
    }
};

exports.downloadzip = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { filename } = req.params;
        let { zip_name } = req.query;
        const filePath = `temp_zip/${filename}`;
        const fileData = fs.createReadStream(filePath);
        if (fileData) {
            let now = new Date();
            now = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now
                .getDate()
                .toString()
                .padStart(2, "0")}${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
            res.setHeader("Content-Type", "application/zip");
            res.setHeader("Content-Disposition", `attachment; filename=${zip_name}-${now}.zip`);
            fileData.on("end", () => {
                fs.unlinkSync(filePath);
                console.info("檔案下載刪除完畢");
            });
            fileData.pipe(res);
        } else {
            console.error("資料夾找不到檔案");
            rsmodel.message = "資料夾找不到檔案";
            res.json(rsmodel);
        }
    } catch (e) {
        console.error(e.message);
        rsmodel.message = e.message;
        res.json(rsmodel);
    }
};
