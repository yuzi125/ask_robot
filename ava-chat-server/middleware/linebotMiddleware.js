const sql = require("../db/pgsql");

async function linebotMiddleware(req, res, next) {
    // 檢查資料庫連線狀態
    try {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        const rs = await sql.checkDBConnection();
        if (rs && rs.code === 0) {
            console.error("DB checking error result: ", rs);
            return res.status(503).json(rs);
        } else if (!rs) {
            console.error("DB checking no response");
            return res.status(503).json(rs);
        }
    } catch (error) {
        console.error("checkDBConnection go wrong: ", error);
        return res.status(503).json({ error: "Internal Server Error(503)" });
    }

    // console.log("source is line");
    // console.log("req.cookies", req.cookies);
    // console.log("req.session", req.session);
    // console.log("req.sessionID", req.sessionID);
    next();
}

module.exports = linebotMiddleware;
