const sql = require("../pgsql");
const fs = require("fs");
const path = require("path");

const js_title = ["備份所有表(可重複使用)", "每次備份都會生成當前時間戳的資料夾"];

// 備份多個表
async function backupTables(tableNames) {
    try {
        let now = new Date();
        now = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now
            .getDate()
            .toString()
            .padStart(2, "0")}${now.getHours().toString().padStart(2, "0")}${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`;
        const selectfolder = `db/db-backup/${now}`;

        try {
            fs.accessSync(`${selectfolder}`);
        } catch (e) {
            fs.mkdirSync(`${selectfolder}`, { recursive: true });
        }

        const results = [];

        for (const tableName of tableNames) {
            const data = await sql.query(`SELECT * FROM ${tableName}`);
            const filePath = `${selectfolder}/${tableName}.json`;
            fs.writeFileSync(filePath, JSON.stringify(data.rows), "utf-8");
            results.push(`成功備份表 ${tableName} 到文件 ${filePath}`);
        }

        return results;
    } catch (err) {
        console.error(`備份表時發生錯誤：`, err.stack);
        throw err;
    }
}
module.exports = { backupTables };
