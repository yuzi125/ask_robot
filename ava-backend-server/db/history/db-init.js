const fs = require("fs");
const path = require("path");

const pgsql = require("./db/pgsql");
const sqlDir = "./db/db-init";
const files = fs.readdirSync(sqlDir);

let fullSql = "";
for (const file of files) {
    const fullPath = path.join(sqlDir, file);
    const sql = fs.readFileSync(fullPath, "utf8");
    fullSql += sql;
}

(async function () {
    await pgsql.query(fullSql);
    console.log("資料表初始化完畢");
    const sql = fs.readFileSync("./db/init-data.sql", "utf-8");
    await pgsql.query(sql);
    console.log("資料初始化完畢");
    process.exit();
})();

// const sqlstr = fs.readFileSync("./table-schema-version/table-schema_1.0.1.sql", "utf-8");
// const sqlstr1 = fs.readFileSync("./init-data.sql", "utf-8");
