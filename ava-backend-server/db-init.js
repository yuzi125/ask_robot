const fs = require("fs");
const path = require("path");

const pgsql = require("./db/pgsql");

(async function () {
    let sql;

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
