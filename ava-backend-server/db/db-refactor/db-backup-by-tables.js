const sql = require("../pgsql");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const childProcess = require("child_process");
const execAsync = promisify(childProcess.exec);

const js_title = ["備份指定的資料表", "可指定要備份的表格名稱", "支援多表備份"];

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
async function getTableSizes(tableNames = []) {
    try {
        let query = `
            SELECT 
                table_name,
                pg_total_relation_size(quote_ident(table_name)) as total_size,
                pg_relation_size(quote_ident(table_name)) as table_size,
                pg_table_size(quote_ident(table_name)) as table_size_with_toast,
                (SELECT reltuples FROM pg_class WHERE relname = table_name) as row_estimate
            FROM information_schema.tables
            WHERE table_schema = 'public'
        `;

        // 如果指定了特定表格，則只查詢這些表格
        if (tableNames.length > 0) {
            const tableList = tableNames.map((name) => `'${name}'`).join(",");
            query += ` AND table_name IN (${tableList})`;
        }

        query += ` ORDER BY total_size DESC;`;

        const result = await sql.query(query);
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

// 獲取所有表格名稱
async function getAllTableNames() {
    try {
        console.log("[DB_OPERATION] 開始獲取所有表格名稱");

        // 檢查資料庫連接
        if (!sql) {
            throw new Error("資料庫連接未初始化");
        }

        const query =
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
        console.log("[DB_OPERATION] 執行查詢:", query);

        const result = await sql.query(query);

        if (!result || !result.rows) {
            throw new Error("查詢結果格式不正確");
        }

        console.log("[DB_OPERATION] 成功獲取表格列表，數量:", result.rows.length);
        return result.rows.map((row) => row.table_name);
    } catch (error) {
        console.error("[DB_OPERATION] 獲取表格名稱時發生錯誤:", error);
        throw error;
    }
}

// 備份指定的表格
async function backupTables(tableNames) {
    if (!tableNames || !Array.isArray(tableNames) || tableNames.length === 0) {
        throw new Error("請指定要備份的表格名稱");
    }

    const startTime = new Date();
    console.log(`[BACKUP] 開始備份指定資料表，時間: ${startTime.toISOString()}`);

    try {
        // 檢查磁碟空間
        await checkDiskSpace();

        // 確認表格是否存在
        const allTables = await getAllTableNames();
        const invalidTables = tableNames.filter((name) => !allTables.includes(name));

        if (invalidTables.length > 0) {
            throw new Error(`以下表格不存在: ${invalidTables.join(", ")}`);
        }

        // 取得資料表大小資訊
        const tableSizes = await getTableSizes(tableNames);

        // 取得當前時間戳記作為資料夾名稱
        let now = new Date();
        now = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now
            .getDate()
            .toString()
            .padStart(2, "0")}${now.getHours().toString().padStart(2, "0")}${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`;
        const selectfolder = `db/db-backup/${now}_selected`;
        const backupId = `${now}_selected`; // 將備份ID保存下來

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
            selected_tables: tableNames,
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

        // 處理每個資料表
        let successCount = 0;
        let errorCount = 0;

        for (const tableName of tableNames) {
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

        // 更新完成狀態
        backupLog.completed = true;
        backupLog.end_time = new Date().toISOString();
        updateBackupLog();

        const endTime = new Date();
        const timeElapsed = (endTime - startTime) / 1000; // 以秒為單位
        console.log(`[BACKUP] 完成備份指定資料表，花費時間: ${timeElapsed.toFixed(2)} 秒`);

        // 返回結果，包含backupId以便前端可以用於下載
        return {
            successCount,
            errorCount,
            backupId: backupId, // 添加backupId到返回值
            timeElapsed: timeElapsed.toFixed(2),
        };
    } catch (error) {
        console.error(`[BACKUP] 備份資料表時發生錯誤: ${error.message}`);
        throw error;
    }
}

// 執行備份，需要傳入要備份的表格名稱
const js_program = async function () {
    try {
        // 從環境變數或參數中獲取表格名稱，這裡我們示範備份一些常用的系統表格
        // 在實際使用時，這些表格名稱應該從前端傳入
        const tableToBackup = ["users", "user_login_record", "settings", "datasets", "expert"];

        const result = await backupTables(tableToBackup);
        return {
            success: true,
            message: `備份完成，成功: ${result.successCount} 個表格，失敗: ${result.errorCount} 個表格`,
            backupId: result.backupId,
            timeElapsed: result.timeElapsed,
        };
    } catch (err) {
        console.error(`備份指定表格時發生錯誤: ${err.message}`);
        return {
            success: false,
            message: `備份失敗: ${err.message}`,
        };
    }
};

module.exports = { js_title, js_program, backupTables, getAllTableNames };
