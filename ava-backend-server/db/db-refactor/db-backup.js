const sql = require("../pgsql");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const childProcess = require("child_process");
const execAsync = promisify(childProcess.exec);
const os = require("os");

const js_title = [
    "備份所有表(可重複使用)",
    "每次備份都會生成當前時間戳的資料夾",
    "資料庫備份前檢查磁碟空間",
    "支援大量資料表分批導出",
];

// 檢查磁碟空間可用性
async function checkDiskSpace() {
    try {
        // 使用不同操作系統的命令檢查磁碟空間
        let command = "";
        if (process.platform === "win32") {
            command = "wmic logicaldisk get freespace,caption";
        } else {
            command = "df -k ."; // 檢查當前目錄所在的磁碟
        }

        const { stdout } = await execAsync(command);

        let freeSpaceBytes = 0;
        if (process.platform === "win32") {
            // 在 Windows 解析 wmic 輸出
            const lines = stdout.trim().split("\n");
            if (lines.length >= 2) {
                const parts = lines[1].trim().split(/\s+/);
                if (parts.length >= 2) {
                    freeSpaceBytes = parseInt(parts[0], 10);
                }
            }
        } else {
            // 在 Linux/macOS 解析 df 輸出
            const lines = stdout.trim().split("\n");
            if (lines.length >= 2) {
                const parts = lines[1].trim().split(/\s+/);
                if (parts.length >= 4) {
                    freeSpaceBytes = parseInt(parts[3], 10) * 1024; // 轉換 KB 為 bytes
                }
            }
        }

        // 計算可用空間（GB）
        const freeSpaceGB = freeSpaceBytes / (1024 * 1024 * 1024);

        // 需要至少 2GB 的可用空間
        const minRequiredGB = 2;
        if (freeSpaceGB < minRequiredGB) {
            throw new Error(`磁碟空間不足，可用空間: ${freeSpaceGB.toFixed(2)}GB，需要至少 ${minRequiredGB}GB`);
        }

        return true;
    } catch (error) {
        console.error(`檢查磁碟空間時發生錯誤: ${error.message}`);
        throw error;
    }
}

// 取得資料表大小資訊
async function getTableSizes() {
    try {
        const result = await sql.query(`
            SELECT 
                table_name,
                pg_total_relation_size(quote_ident(table_name)) as total_size,
                pg_relation_size(quote_ident(table_name)) as table_size,
                pg_table_size(quote_ident(table_name)) as table_size_with_toast,
                (SELECT reltuples FROM pg_class WHERE relname = table_name) as row_estimate
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY total_size DESC;
        `);

        return result.rows;
    } catch (error) {
        console.error(`無法取得資料表大小: ${error.message}`);
        throw error;
    }
}

// 分批查詢大型資料表
async function exportTableInBatches(tableName, outputPath, batchSize = 10000) {
    try {
        // 建立可寫入串流
        const writeStream = fs.createWriteStream(outputPath);

        // 取得總筆數
        const countResult = await sql.query(`SELECT COUNT(*) FROM ${tableName}`);
        const totalCount = parseInt(countResult.rows[0].count, 10);
        console.log(`[BACKUP] 資料表 ${tableName} 總筆數: ${totalCount}`);

        // 開始寫入 JSON 陣列
        writeStream.write("[");

        let processedRows = 0;
        let isFirstBatch = true;

        while (processedRows < totalCount) {
            // 分批查詢
            const query = `
                SELECT * FROM ${tableName}
                ORDER BY (SELECT 1)
                LIMIT ${batchSize} OFFSET ${processedRows}
            `;

            const result = await sql.query(query);
            const batch = result.rows;

            if (batch.length === 0) break;

            // 逐一寫入每筆資料
            for (let i = 0; i < batch.length; i++) {
                const row = batch[i];
                const jsonStr = JSON.stringify(row);

                // 如果不是第一批的第一列，或是在同一批但不是第一列，則加上逗號
                if (!isFirstBatch || i > 0) {
                    writeStream.write(",");
                }

                // 寫入 JSON 物件
                writeStream.write(jsonStr);
            }

            processedRows += batch.length;
            isFirstBatch = false;

            console.log(`[BACKUP] 資料表 ${tableName} 已處理 ${processedRows}/${totalCount} 筆資料`);
        }

        // 關閉 JSON 陣列
        writeStream.write("]");

        // 關閉串流
        await new Promise((resolve) => {
            writeStream.end();
            writeStream.on("finish", resolve);
        });

        console.log(`[BACKUP] 資料表 ${tableName} 備份完成，檔案路徑: ${outputPath}`);
        return processedRows;
    } catch (error) {
        console.error(`導出資料表 ${tableName} 時發生錯誤: ${error.message}`);
        throw error;
    }
}

const js_program = async function () {
    const startTime = new Date();
    console.log(`[BACKUP] 開始資料庫備份，時間: ${startTime.toISOString()}`);

    try {
        // 檢查磁碟空間
        await checkDiskSpace();

        // 取得資料表大小資訊
        const tableSizes = await getTableSizes();

        // 取得當前時間戳記作為資料夾名稱
        let now = new Date();
        now = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now
            .getDate()
            .toString()
            .padStart(2, "0")}${now.getHours().toString().padStart(2, "0")}${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`;
        const selectfolder = `db/db-backup/${now}`;

        // 建立備份資料夾
        try {
            fs.accessSync(`${selectfolder}`);
        } catch (e) {
            fs.mkdirSync(`${selectfolder}`, { recursive: true });
        }

        // 紀錄備份進度
        const progressFile = `${selectfolder}/backup_progress.json`;
        const backupLog = {
            start_time: startTime.toISOString(),
            tables: [],
            completed: false,
            errors: [],
        };

        // 更新備份進度的函數
        const updateBackupLog = () => {
            fs.writeFileSync(progressFile, JSON.stringify(backupLog, null, 2), "utf-8");
        };

        // 初始化進度檔案
        updateBackupLog();

        // 取得所有資料表
        const tables = await sql.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        );

        // 處理每個資料表
        let successCount = 0;
        let errorCount = 0;

        for (let row of tables.rows) {
            const tableName = row.table_name;
            const filePath = `${selectfolder}/${tableName}.json`;
            const tableSize = tableSizes.find((t) => t.table_name === tableName);

            try {
                console.log(`[BACKUP] 開始備份資料表: ${tableName}`);

                // 記錄開始處理此資料表
                backupLog.tables.push({
                    table_name: tableName,
                    start_time: new Date().toISOString(),
                    status: "processing",
                    rows_processed: 0,
                });
                updateBackupLog();

                // 根據表大小決定是否使用批次處理
                const rowEstimate = tableSize ? parseInt(tableSize.row_estimate, 10) : 0;

                if (rowEstimate > 10000) {
                    // 大型資料表使用分批導出
                    const processedRows = await exportTableInBatches(tableName, filePath, 10000);

                    // 更新進度
                    const tableIndex = backupLog.tables.findIndex((t) => t.table_name === tableName);
                    backupLog.tables[tableIndex].status = "completed";
                    backupLog.tables[tableIndex].end_time = new Date().toISOString();
                    backupLog.tables[tableIndex].rows_processed = processedRows;
                    updateBackupLog();
                } else {
                    // 小型資料表使用普通查詢
                    const data = await sql.query(`SELECT * FROM ${tableName}`);
                    fs.writeFileSync(filePath, JSON.stringify(data.rows), "utf-8");

                    // 更新進度
                    const tableIndex = backupLog.tables.findIndex((t) => t.table_name === tableName);
                    backupLog.tables[tableIndex].status = "completed";
                    backupLog.tables[tableIndex].end_time = new Date().toISOString();
                    backupLog.tables[tableIndex].rows_processed = data.rows.length;
                    updateBackupLog();
                }

                successCount++;
                console.log(`[BACKUP] 成功備份資料表: ${tableName}`);
            } catch (err) {
                errorCount++;
                console.error(`[BACKUP] 導出資料表 ${tableName} 時發生錯誤: ${err.message}`);

                // 更新進度
                const tableIndex = backupLog.tables.findIndex((t) => t.table_name === tableName);
                if (tableIndex !== -1) {
                    backupLog.tables[tableIndex].status = "failed";
                    backupLog.tables[tableIndex].end_time = new Date().toISOString();
                    backupLog.tables[tableIndex].error = err.message;
                }
                backupLog.errors.push({
                    table_name: tableName,
                    error: err.message,
                    time: new Date().toISOString(),
                });
                updateBackupLog();
            }
        }

        // 完成備份
        const endTime = new Date();
        const durationMs = endTime - startTime;
        const durationMinutes = Math.floor(durationMs / 60000);
        const durationSeconds = ((durationMs % 60000) / 1000).toFixed(2);

        backupLog.completed = true;
        backupLog.end_time = endTime.toISOString();
        backupLog.duration = `${durationMinutes}分 ${durationSeconds}秒`;
        backupLog.success_count = successCount;
        backupLog.error_count = errorCount;

        updateBackupLog();

        console.log(`[BACKUP] 備份完成，耗時: ${durationMinutes}分 ${durationSeconds}秒`);
        console.log(`[BACKUP] 成功備份 ${successCount} 個資料表，失敗 ${errorCount} 個資料表`);

        return `成功取得所有表存成檔案，總共 ${successCount} 個資料表，失敗 ${errorCount} 個資料表，耗時 ${durationMinutes}分 ${durationSeconds}秒`;
    } catch (err) {
        console.error(`[BACKUP] 導出時發生錯誤: ${err.message}`);
        return `備份失敗: ${err.message}`;
    }
};

module.exports = { js_title, js_program };
