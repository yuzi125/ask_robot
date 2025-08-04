const responseModel = require("../model/responseModel");
const { getUploadDocumentInfo, getCrawlerDocumentInfo, downloadFile } = require("../utils/download-utils");

exports.chatroomDownload = async function (req, res) {
    let rsmodel = { code: 0, message: "" };
    try {
        let filename = JSON.parse(req.body).url.match(/(?<=download\/)[^\/]+$/)[0];
        let { preview = undefined, attachmentId = undefined } = req.query || {};

        const filenameArray = filename.split(".");
        let fileId = filenameArray[0];
        const downloadFileType = filenameArray[filenameArray.length - 1];

        // 嘗試從 upload_documents 查詢
        let fileInfo = await getUploadDocumentInfo(fileId);
        
        if (fileInfo) {
            let { folder, config_jsonb, originalname } = fileInfo;
            originalname = originalname.replace(/\.[^.]+$/, `.${downloadFileType}`);
            if (!config_jsonb.is_downloadable) {
                rsmodel.code = 1;
                rsmodel.message = "此檔案目前未提供下載。如需更多資訊，請參閱「資料來源」。";
                return res.json(rsmodel);
            }
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

        rsmodel.code = 1;
        rsmodel.message = "資料庫找不到檔案";
        res.json(rsmodel);
    } catch (e) {
        console.error("發生錯誤", e.message);
        rsmodel.code = 1;
        rsmodel.message = "發生錯誤，請稍後再試";
        res.json(rsmodel);
    }
};
