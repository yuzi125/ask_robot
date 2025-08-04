const fs = require("fs");
const path = require("path");

const pgsql = require("./db/pgsql");

(async function () {
    let sql = fs.readFileSync("./db/db-init/drop-all-table.sql", "utf-8");
    const sqlCommands = sql.split(";"); // Split SQL commands by semicolon

    for (const sqlCommand of sqlCommands) {
        if (sqlCommand.trim() !== "") { // Skip empty lines
            try {
                await pgsql.query(sqlCommand); // Execute each SQL command
            } catch (error) {
                console.error("An error occurred while executing:" + sqlCommand, error);
            }
        }
    }
    console.log("刪除既有資料表完畢");

    sql = fs.readFileSync("./db/db-init/init-schema.sql", "utf-8");
    await pgsql.query(sql);
    console.log("資料表初始化完畢");

    sql = fs.readFileSync("./db/db-init/init-data.sql", "utf-8");
    await pgsql.query(sql);
    console.log("資料初始化完畢");

    sql = fs.readFileSync("./db/db-init/updateTimeTrigger.sql", "utf-8");
    await pgsql.query(sql);
    console.log("trigger初始化完畢");

    process.exit();
})();

// const sqlstr = fs.readFileSync("./table-schema-version/table-schema_1.0.1.sql", "utf-8");
// const sqlstr1 = fs.readFileSync("./init-data.sql", "utf-8");
