const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const js_title = ["將備份資料表壓縮成ZIP檔案", "支援選擇特定表格壓縮下載", "減少網路傳輸量"];

// 壓縮指定資料夾中的特定檔案為 ZIP
async function createBackupZip(backupFolderId, tableNames = []) {
    try {
        // 找出備份資料夾路徑
        const backupDir = "db/db-backup";
        let backupFolderPath;

        // 處理選擇性備份的資料夾格式（帶有"_selected"後綴）
        if (backupFolderId.toString().includes("_selected")) {
            backupFolderPath = path.join(backupDir, backupFolderId.toString());
        } else {
            backupFolderPath = path.join(backupDir, backupFolderId.toString());
        }

        // 檢查備份資料夾是否存在
        if (!fs.existsSync(backupFolderPath)) {
            throw new Error(`找不到備份資料夾: ${backupFolderId}`);
        }

        // 取得資料夾中的所有檔案
        const allFiles = fs.readdirSync(backupFolderPath);

        // 如果沒有指定表格名稱，則使用所有的JSON檔案
        let filesToZip = [];
        if (!tableNames || tableNames.length === 0) {
            filesToZip = allFiles.filter((file) => file.endsWith(".json") && file !== "backup_progress.json");
        } else {
            // 只包含指定的表格
            filesToZip = tableNames.map((table) => `${table}.json`).filter((file) => allFiles.includes(file));

            // 如果沒有找到任何指定的表格，返回錯誤
            if (filesToZip.length === 0) {
                throw new Error("在備份中找不到指定的表格");
            }
        }

        // 創建 ZIP 檔案
        const zip = new AdmZip();

        // 取得備份資訊 (如果有)
        const progressFilePath = path.join(backupFolderPath, "backup_progress.json");
        let backupInfo = {};

        if (fs.existsSync(progressFilePath)) {
            try {
                backupInfo = JSON.parse(fs.readFileSync(progressFilePath, "utf-8"));
            } catch (e) {
                console.warn("無法讀取備份進度檔案:", e.message);
            }
        }

        // 建立匯出資訊檔案
        const exportInfo = {
            export_time: new Date().toISOString(),
            backup_id: backupFolderId,
            selected_tables: tableNames.length > 0 ? tableNames : "all",
            files_count: filesToZip.length,
            backup_info: backupInfo,
        };

        // 添加匯出資訊到 ZIP
        zip.addFile("export_info.json", Buffer.from(JSON.stringify(exportInfo, null, 2), "utf8"));

        // 添加所有檔案到 ZIP
        for (const file of filesToZip) {
            const filePath = path.join(backupFolderPath, file);
            if (fs.existsSync(filePath)) {
                // 使用表格名稱作為檔案名稱 (移除 .json 副檔名)
                const tableName = file.replace(".json", "");
                // 添加到 ZIP，保留原檔名
                zip.addLocalFile(filePath);
            }
        }

        // 創建暫存輸出路徑
        const tempDir = path.join(process.cwd(), "tempResource");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 使用備份ID和時間戳建立唯一檔名
        const timestamp = new Date().getTime();
        const zipFileName = `backup_${backupFolderId}_${timestamp}.zip`;
        const zipFilePath = path.join(tempDir, zipFileName);

        // 寫入 ZIP 檔案
        zip.writeZip(zipFilePath);

        return {
            zipFileName: zipFileName,
            zipFilePath: zipFilePath,
            tablesCount: filesToZip.length,
        };
    } catch (error) {
        console.error(`建立備份ZIP檔案時發生錯誤: ${error.message}`);
        throw error;
    }
}

const js_program = async function () {
    try {
        // 這個程式不需要直接執行，只用於提供函數給其他模組使用
        return "請從API呼叫使用此功能";
    } catch (error) {
        console.error(`壓縮備份失敗: ${error.message}`);
        return `壓縮備份失敗: ${error.message}`;
    }
};

module.exports = { js_title, js_program, createBackupZip };
