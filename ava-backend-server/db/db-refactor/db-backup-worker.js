const { parentPort, workerData } = require("worker_threads");
const sql = require("../pgsql");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const childProcess = require("child_process");
const execAsync = promisify(childProcess.exec);

let isCancelled = false;

// 監聽取消信號
parentPort.on("message", (message) => {
    if (message === "cancel") {
        isCancelled = true;
    }
});

// 檢查磁碟空間可用性
async function checkDiskSpace() {
    try {
        let command = "";
        if (process.platform === "win32") {
            command = "wmic logicaldisk get freespace,caption";
        } else {
            command = "df -k .";
        }

        const { stdout } = await execAsync(command);

        let freeSpaceBytes = 0;
        if (process.platform === "win32") {
            const lines = stdout.trim().split("\n");
            if (lines.length >= 2) {
                const parts = lines[1].trim().split(/\s+/);
                if (parts.length >= 2) {
                    freeSpaceBytes = parseInt(parts[0], 10);
                }
            }
        } else {
            const lines = stdout.trim().split("\n");
            if (lines.length >= 2) {
                const parts = lines[1].trim().split(/\s+/);
                if (parts.length >= 4) {
                    freeSpaceBytes = parseInt(parts[3], 10) * 1024;
                }
            }
        }

        const freeSpaceGB = freeSpaceBytes / (1024 * 1024 * 1024);
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

// 分批查詢大型資料表
async function exportTableInBatches(tableName, outputPath, batchSize = 10000) {
    try {
        const writeStream = fs.createWriteStream(outputPath);
        const countResult = await sql.query(`SELECT COUNT(*) FROM ${tableName}`);
        const totalCount = parseInt(countResult.rows[0].count, 10);

        writeStream.write("[");
        let processedRows = 0;
        let isFirstBatch = true;

        while (processedRows < totalCount && !isCancelled) {
            const query = `
                SELECT * FROM ${tableName}
                ORDER BY (SELECT 1)
                LIMIT ${batchSize} OFFSET ${processedRows}
            `;

            const result = await sql.query(query);
            const batch = result.rows;

            if (batch.length === 0) break;

            for (let i = 0; i < batch.length; i++) {
                const row = batch[i];
                const jsonStr = JSON.stringify(row);

                if (!isFirstBatch || i > 0) {
                    writeStream.write(",");
                }

                writeStream.write(jsonStr);
            }

            processedRows += batch.length;
            isFirstBatch = false;

            // 發送進度更新
            parentPort.postMessage({
                type: "progress",
                tableName,
                processedRows,
                totalCount,
            });

            if (isCancelled) {
                writeStream.end();
                throw new Error("備份已取消");
            }
        }

        writeStream.write("]");
        await new Promise((resolve) => {
            writeStream.end();
            writeStream.on("finish", resolve);
        });

        return processedRows;
    } catch (error) {
        if (isCancelled) {
            throw new Error("備份已取消");
        }
        throw error;
    }
}

// 備份指定的表格
async function backupTables(tableNames) {
    if (!tableNames || !Array.isArray(tableNames) || tableNames.length === 0) {
        throw new Error("請指定要備份的表格名稱");
    }

    const startTime = new Date();
    let now = new Date();
    now = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now
        .getDate()
        .toString()
        .padStart(2, "0")}${now.getHours().toString().padStart(2, "0")}${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`;
    const selectfolder = `db/db-backup/${now}_selected`;
    const backupId = `${now}_selected`;

    try {
        await checkDiskSpace();
        fs.mkdirSync(`${selectfolder}`, { recursive: true });

        const progressFile = `${selectfolder}/backup_progress.json`;
        const backupLog = {
            start_time: startTime.toISOString(),
            selected_tables: tableNames,
            tables: [],
            completed: false,
            errors: [],
        };

        const updateBackupLog = () => {
            fs.writeFileSync(progressFile, JSON.stringify(backupLog, null, 2), "utf-8");
        };

        updateBackupLog();

        let successCount = 0;
        let errorCount = 0;
        const totalTables = tableNames.length;

        // 發送初始狀態
        parentPort.postMessage({
            type: "status",
            data: {
                completed: false,
                successCount: 0,
                errorCount: 0,
                backupId: null,
                timeElapsed: "0",
                currentTable: "",
                totalTables: totalTables,
            },
        });

        for (const tableName of tableNames) {
            if (isCancelled) {
                throw new Error("備份已取消");
            }

            const filePath = `${selectfolder}/${tableName}.json`;

            try {
                // 更新當前處理的表格
                parentPort.postMessage({
                    type: "status",
                    data: {
                        completed: false,
                        successCount,
                        errorCount,
                        backupId: null,
                        timeElapsed: ((new Date() - startTime) / 1000).toFixed(2),
                        currentTable: tableName,
                        totalTables,
                    },
                });

                backupLog.tables.push({
                    table_name: tableName,
                    start_time: new Date().toISOString(),
                    status: "processing",
                    rows_processed: 0,
                });
                updateBackupLog();

                const processedRows = await exportTableInBatches(tableName, filePath, 10000);

                const tableIndex = backupLog.tables.findIndex((t) => t.table_name === tableName);
                backupLog.tables[tableIndex].status = "completed";
                backupLog.tables[tableIndex].end_time = new Date().toISOString();
                backupLog.tables[tableIndex].rows_processed = processedRows;
                updateBackupLog();

                successCount++;

                // 發送進度更新
                parentPort.postMessage({
                    type: "status",
                    data: {
                        completed: false,
                        successCount,
                        errorCount,
                        backupId: null,
                        timeElapsed: ((new Date() - startTime) / 1000).toFixed(2),
                        currentTable: tableName,
                        totalTables,
                    },
                });
            } catch (err) {
                errorCount++;
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

                // 發送錯誤更新
                parentPort.postMessage({
                    type: "status",
                    data: {
                        completed: false,
                        successCount,
                        errorCount,
                        backupId: null,
                        timeElapsed: ((new Date() - startTime) / 1000).toFixed(2),
                        currentTable: tableName,
                        totalTables,
                    },
                });
            }
        }

        backupLog.completed = true;
        backupLog.end_time = new Date().toISOString();
        updateBackupLog();

        const finalResult = {
            successCount,
            errorCount,
            backupId,
            timeElapsed: ((new Date() - startTime) / 1000).toFixed(2),
            currentTable: "",
            totalTables,
        };

        // 發送完成狀態
        parentPort.postMessage({
            type: "status",
            data: {
                completed: true,
                ...finalResult,
            },
        });

        return finalResult;
    } catch (error) {
        throw error;
    }
}

// 執行備份
async function main() {
    try {
        const result = await backupTables(workerData.tableNames);
        parentPort.postMessage({ type: "complete", result });
    } catch (error) {
        parentPort.postMessage({ type: "error", error: error.message });
    }
}

main();
