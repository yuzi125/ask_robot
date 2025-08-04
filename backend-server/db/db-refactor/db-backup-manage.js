const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const childProcess = require("child_process");
const execAsync = promisify(childProcess.exec);

const js_title = ["管理資料庫備份歷史", "自動清理舊的備份資料", "維護磁碟空間", "支援刪除所有備份資料"];

// 取得資料夾大小（遞迴計算）
async function getFolderSize(folderPath) {
    try {
        let totalSize = 0;
        const files = fs.readdirSync(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                totalSize += await getFolderSize(filePath);
            } else {
                totalSize += stats.size;
            }
        }

        return totalSize;
    } catch (error) {
        console.error(`計算資料夾大小時發生錯誤: ${error.message}`);
        return 0;
    }
}

// 取得所有備份歷史
async function getBackupHistory() {
    try {
        const backupDir = "db/db-backup";

        // 確保備份目錄存在
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
            return [];
        }

        // 讀取所有備份資料夾
        const folders = fs
            .readdirSync(backupDir)
            .filter((f) => !isNaN(f)) // 只取數字命名的資料夾
            .map((f) => parseInt(f, 10))
            .sort((a, b) => b - a); // 依時間戳降序排列

        const history = [];

        // 計算每個備份資料夾的資訊
        for (const folder of folders) {
            const folderPath = path.join(backupDir, folder.toString());

            // 檢查進度檔案是否存在
            let progressData = null;
            const progressFile = path.join(folderPath, "backup_progress.json");

            if (fs.existsSync(progressFile)) {
                try {
                    progressData = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
                } catch (e) {
                    console.error(`讀取進度檔案失敗: ${e.message}`);
                }
            }

            // 計算資料夾大小
            const size = await getFolderSize(folderPath);
            const fileCount = fs.readdirSync(folderPath).length;

            // 格式化日期時間
            const timestamp = folder.toString();
            const year = timestamp.substring(0, 4);
            const month = timestamp.substring(4, 6);
            const day = timestamp.substring(6, 8);
            const hour = timestamp.substring(8, 10);
            const minute = timestamp.substring(10, 12);
            const second = timestamp.substring(12, 14);
            const formattedDate = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

            history.push({
                id: folder,
                timestamp: folder.toString(),
                formattedDate,
                size,
                sizeFormatted: formatFileSize(size),
                fileCount,
                folderPath,
                isComplete: progressData ? progressData.completed : false,
                tableCount: progressData ? progressData.tables.length : null,
                successCount: progressData ? progressData.success_count : null,
                errorCount: progressData ? progressData.error_count : null,
                duration: progressData ? progressData.duration : null,
            });
        }

        return history;
    } catch (error) {
        console.error(`讀取備份歷史時發生錯誤: ${error.message}`);
        return [];
    }
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 刪除指定的備份
async function deleteBackup(backupId) {
    try {
        const backupDir = "db/db-backup";
        const folderPath = path.join(backupDir, backupId.toString());

        if (!fs.existsSync(folderPath)) {
            throw new Error(`備份 ${backupId} 不存在`);
        }

        // 在 Windows 使用 rimraf 或 recursive 選項刪除目錄
        if (process.platform === "win32") {
            await execAsync(`rmdir /s /q "${folderPath}"`);
        } else {
            await execAsync(`rm -rf "${folderPath}"`);
        }

        return `成功刪除備份 ${backupId}`;
    } catch (error) {
        console.error(`刪除備份時發生錯誤: ${error.message}`);
        throw error;
    }
}

// 自動清理舊的備份
async function autoCleanBackups(keepCount = 5, maxTotalSizeGB = 10) {
    try {
        const history = await getBackupHistory();

        if (history.length <= keepCount) {
            return `目前備份數量 ${history.length} 不超過保留數量 ${keepCount}，無需清理`;
        }

        // 計算當前總大小
        const totalSizeBytes = history.reduce((sum, backup) => sum + backup.size, 0);
        const totalSizeGB = totalSizeBytes / (1024 * 1024 * 1024);

        let deletedCount = 0;
        let freedSpace = 0;

        // 從最舊的備份開始刪除
        for (let i = keepCount; i < history.length; i++) {
            const backupToDelete = history[i];

            await deleteBackup(backupToDelete.id);
            deletedCount++;
            freedSpace += backupToDelete.size;

            // 檢查是否已經釋放足夠空間
            if ((totalSizeBytes - freedSpace) / (1024 * 1024 * 1024) <= maxTotalSizeGB) {
                break;
            }
        }

        return `已清理 ${deletedCount} 個舊備份，釋放空間 ${formatFileSize(freedSpace)}`;
    } catch (error) {
        console.error(`自動清理備份時發生錯誤: ${error.message}`);
        throw error;
    }
}

// 刪除所有備份資料夾
async function deleteAllBackups() {
    try {
        const backupDir = "db/db-backup";

        // 確保備份目錄存在
        if (!fs.existsSync(backupDir)) {
            return { success: true, message: "沒有備份資料夾需要刪除" };
        }

        // 讀取所有備份資料夾
        const folders = fs
            .readdirSync(backupDir)
            .filter((f) => !isNaN(f) || f.includes("_selected")) // 包含數字命名的資料夾和包含 _selected 的資料夾
            .sort((a, b) => {
                // 將資料夾名稱轉換為數字進行比較
                const numA = parseInt(a.split("_")[0], 10);
                const numB = parseInt(b.split("_")[0], 10);
                return numB - numA; // 降序排列
            });

        if (folders.length === 0) {
            return { success: true, message: "沒有備份資料夾需要刪除" };
        }

        let deletedCount = 0;
        let errors = [];

        // 刪除每個備份資料夾
        for (const folder of folders) {
            const folderPath = path.join(backupDir, folder);

            try {
                // 在 Windows 使用 rimraf 或 recursive 選項刪除目錄
                if (process.platform === "win32") {
                    await execAsync(`rmdir /s /q "${folderPath}"`);
                } else {
                    await execAsync(`rm -rf "${folderPath}"`);
                }
                deletedCount++;
            } catch (error) {
                console.error(`刪除備份 ${folder} 時發生錯誤: ${error.message}`);
                errors.push(`${folder}: ${error.message}`);
            }
        }

        const resultMessage = `成功刪除 ${deletedCount} 個備份資料夾`;
        if (errors.length > 0) {
            return {
                success: deletedCount > 0,
                message: `${resultMessage}，但有 ${errors.length} 個資料夾刪除失敗`,
                errors,
            };
        }

        return { success: true, message: resultMessage };
    } catch (error) {
        console.error(`刪除所有備份時發生錯誤: ${error.message}`);
        return { success: false, message: `刪除所有備份時發生錯誤: ${error.message}` };
    }
}

const js_program = async function () {
    try {
        // 自動清理備份，保留最近的 5 個備份，總大小不超過 10GB
        const result = await autoCleanBackups(5, 10);

        // 獲取清理後的備份歷史
        const history = await getBackupHistory();
        const totalSize = history.reduce((sum, backup) => sum + backup.size, 0);

        return `${result}\n目前共有 ${history.length} 個備份，總大小 ${formatFileSize(totalSize)}`;
    } catch (error) {
        console.error(`管理備份時發生錯誤: ${error.message}`);
        return `管理備份失敗: ${error.message}`;
    }
};

module.exports = { js_title, js_program, getBackupHistory, deleteBackup, autoCleanBackups, deleteAllBackups };
