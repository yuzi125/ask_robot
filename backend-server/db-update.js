const sql = require("./db/db-update-version/db-update-1_0_1");
const updatedb = require("./db/db-update");

(async function () {
    await updatedb(sql);
})();
