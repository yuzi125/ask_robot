const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const logRouteDetails = require("../routeNameLog");

// 檢查資料是否啟用（is_enable）
async function checkRecordEnableStatus(req, res) {
    logRouteDetails("commonController.checkRecordEnableStatus", req);
    let rsmodel = new responseModel();

    const { tableName, recordId } = req.query;
    console.info("commonController.checkRecordEnableStatus: ", req.query);

    if (!tableName || !recordId) {
        rsmodel.code = 1;
        rsmodel.message = "tableName or recordId is required";
    }

    try {
        // 查詢資料庫中的記錄
        const query = `SELECT is_enable FROM ${tableName} WHERE id = $1`;
        const result = await sql.query(query, [recordId]);
        const { is_enable } = result.rows[0];
        if (is_enable === 0) {
            rsmodel.code = 1;
            rsmodel.message = "Record is disabled";
        } else {
            // 如果 `is_enable` 為 1，返回啟用狀態
            rsmodel.code = 0;
            rsmodel.data = { is_enable };
        }
    } catch (error) {
        console.error("Error checking record enable status:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
}

module.exports = {
    checkRecordEnableStatus,
};
