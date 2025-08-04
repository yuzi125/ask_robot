const sql = require("../db/pgsql"); // 假設這是你的 DB 連線
const axios = require("axios");

// 查詢 upload_documents
async function getUploadDocumentInfo(fileId) {
    const rs = await sql.query(
        "SELECT b.folder_name, b.config_jsonb, a.originalname FROM upload_documents a LEFT JOIN datasets b ON b.id = a.datasets_id WHERE a.id = $1",
        [fileId]
    );

    if (rs.rows.length > 0) {
        return {
            folder: rs.rows[0].folder_name,
            config_jsonb: rs.rows[0].config_jsonb,
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

module.exports = { getUploadDocumentInfo, getCrawlerDocumentInfo, downloadFile };
