const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const uploadedLogs = new Map(); // 使用 Map 記錄檔案上傳狀態

// 設定大小範圍限制（單位 MB）
const FILE_SIZE_LIMIT_MB = 30; // 限制檔案大小為 30 MB
const FILE_SIZE_LIMIT = FILE_SIZE_LIMIT_MB * 1024; // 換算為 KB

function uploadLogFile() {
    setInterval(async () => {
        try {
            const logDir = path.join(__dirname, "../log"); // 日誌目錄
            const identifier = process.env.SERVER_ID || "no-identifier";

            // 獲取當天的日期以過濾相關日誌
            const currentDate = new Date().toISOString().slice(0, 10); // 格式為 YYYY-MM-DD

            // 列出目錄中所有符合條件的文件（排除 .gz）
            const logFiles = fs
                .readdirSync(logDir)
                .filter((file) => file.startsWith(`${currentDate}-${identifier}-all`) && !file.endsWith(".gz"));

            if (logFiles.length === 0) {
                console.log(`當前沒有可上傳的日誌文件`);
                return;
            }

            for (const logFile of logFiles) {
                const filePath = path.join(logDir, logFile);
                if (!fs.existsSync(filePath)) continue;

                const stats = fs.statSync(filePath);
                const fileSizeKB = stats.size / 1024; // 檔案大小（KB）

                // 檢查檔案是否需要上傳
                const previousUploadInfo = uploadedLogs.get(logFile);

                if (previousUploadInfo) {
                    // 如果檔案已上傳且大小超過範圍，跳過
                    if (previousUploadInfo.size > FILE_SIZE_LIMIT) {
                        console.log(`Log ${logFile} 已上傳且大小超過範圍，跳過`);
                        continue;
                    }
                }

                console.log(`正在上傳檔案: ${logFile}, 大小: ${(fileSizeKB / 1024).toFixed(2)} MB`);

                // 上傳檔案
                const formData = new FormData();
                formData.append("file", fs.createReadStream(filePath));

                const uploadUrl = `${process.env.AVA_FILE_SERVICE_URL}/upload-log`;
                const response = await axios.post(uploadUrl, formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });

                if (response.status === 200) {
                    console.log(`Log ${logFile} 上傳成功`);
                    // 記錄檔案的大小
                    uploadedLogs.set(logFile, { size: fileSizeKB });
                } else {
                    console.log(`Log ${logFile} 上傳失敗`);
                }
            }
        } catch (err) {
            console.error(`Log 上傳失敗: ${err.message}`);
        }
    }, process.env.UPLOAD_BACKEND_SERVER_LOG_INTERVAL * 60 * 1000 || 5 * 60 * 1000); // 每 x 分鐘執行一次
}

// 導出這個函數
module.exports = { uploadLogFile };
