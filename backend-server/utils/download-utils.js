const sql = require("../db/pgsql"); // 假設這是你的 DB 連線
const axios = require("axios");

// 查詢 upload_documents
async function getUploadDocumentInfo(fileId) {
    const rs = await sql.query(
        "SELECT b.folder_name, a.originalname FROM upload_documents a LEFT JOIN datasets b ON b.id = a.datasets_id WHERE a.id = $1",
        [fileId]
    );

    if (rs.rows.length > 0) {
        return {
            folder: rs.rows[0].folder_name,
            originalname: rs.rows[0].originalname,
        };
    }
    return null;
}

// 查詢 crawler_documents_content 或 crawler_attachment
async function getCrawlerDocumentInfo(fileId, filename, attachmentId) {
    // 先查詢 crawler_documents_content

    let rs = await sql.query("SELECT meta_data FROM crawler_documents_content WHERE crawler_documents_id = $1", [
        fileId,
    ]);

    if (rs.rows.length > 0) {
        const { filename: metaFilename, sub_folder_id, upload_folder_id } = rs.rows[0].meta_data;
        return {
            folderPath: sub_folder_id ? `${upload_folder_id}/${sub_folder_id}` : `${upload_folder_id}`,
            filename: metaFilename,
        };
    }

    // 查詢 crawler_attachment，根據 attachmentId 找到對應的 upload_folder_id 和 parentId
    rs = await sql.query("SELECT upload_folder_id, parent_id FROM crawler_attachment WHERE id = $1", [attachmentId]);

    if (rs.rows.length > 0) {
        let { upload_folder_id, parent_id } = rs.rows[0];

        // 如果該附件有 parentId，則需要進一步查找 parentId 的資料
        if (parent_id) {
            rs = await sql.query("SELECT upload_folder_id, filename FROM crawler_attachment WHERE id = $1", [
                parent_id,
            ]);

            // 如果 parent 附件存在，則使用它的資料
            if (rs.rows.length > 0) {
                upload_folder_id = rs.rows[0].upload_folder_id;
                filename = rs.rows[0].filename;
            }
        }

        return {
            folderPath: `${upload_folder_id}`,
            filename,
        };
    }

    return null;
}

// 6eddbc59-1446-4993-b5bd-992000a1db41/77c7b08b-eb3c-4f86-a6c7-6ab0e263ee6b/images
// 25b1395cf29340158c01fbd5bff5582e
async function getImageStoreInfo(fileId) {
    const rs = await sql.query("SELECT download_path, image_uuid FROM document_image_store WHERE image_uuid = $1", [
        fileId,
    ]);

    if (rs.rows.length > 0) {
        return {
            folderPath: rs.rows[0].download_path,
            filename: rs.rows[0].image_uuid + ".jpeg",
        };
    }
    return null;
}

async function downloadFile(res, resourceType, folderPath, apiFilename, downloadFilename, downloadFileType, preview) {
    const apiUrl = `${process.env.AVA_FILE_SERVICE_URL}/download/${resourceType}`;
    const response = await axios.post(
        apiUrl,
        { folder_path: folderPath, filename: apiFilename },
        { responseType: "stream" }
    );

    const contentType = getContentType(downloadFileType, preview);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`);
    response.data.pipe(res);
}

// 在 downloadChatFile 函數中修改
async function downloadChatFile(res, userId, conversationId, conversationFilename, preview) {
    // 確保只編碼一次

    const apiUrl = `${process.env.AVA_FILE_SERVICE_URL}/chat/download/${userId}/${conversationId}/${conversationFilename}`;

    try {
        const response = await axios.get(apiUrl, {
            responseType: "stream",
            validateStatus: false,
        });

        if (response.status !== 200) {
            console.error("Download failed with status:", response.status);
            return res.status(response.status).send("Download failed");
        }

        const extension = conversationFilename.split(".").pop().toLowerCase();
        const contentType = getContentType(extension, preview);
        const encodedFilename = encodeURIComponent(conversationFilename);

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodedFilename}`);
        response.data.pipe(res);
    } catch (error) {
        console.error("Download error:", error.message);
        res.status(500).send("Download error: " + error.message);
    }
}
function getContentType(extension, preview) {
    const mimeTypes = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        // txt: "text/plain; charset=utf-8", // 先把 txt 註解掉 讓他直接下載檔案
        csv: "text/csv",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
        mp4: "video/mp4",
        mov: "video/quicktime",
        avi: "video/x-msvideo",
        zip: "application/zip",
        rar: "application/vnd.rar",
        "7z": "application/x-7z-compressed",
        json: "application/json",
    };

    let contentType = mimeTypes[extension.toLowerCase()] || "application/octet-stream";

    // 如果是預覽模式，某些類型需要設定 `inline`
    if (!preview && extension === "pdf") {
        contentType = "application/octet-stream";
    }

    return contentType;
}

module.exports = { getUploadDocumentInfo, getCrawlerDocumentInfo, getImageStoreInfo, downloadFile, downloadChatFile };
