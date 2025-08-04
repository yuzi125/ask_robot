const sql = require("../db/pgsql");
const responseModel = require("../model/responseModel");
async function chkSSO(req, res, next) {
    let rsmodel = new responseModel();
    try {
        const sqlStr = `SELECT value FROM settings WHERE key='knowledge_permission'`;
        const { rows } = await sql.query(sqlStr);

        const knowledgePermission = JSON.parse(rows[0].value);
        const userId = req.session.userInfo.user_no;

        if (knowledgePermission.pagePermissions.usermanage.includes(userId)) {
            next();
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Permission denied.";
            return res.status(401).json(rsmodel);
        }
    } catch (error) {
        console.error(error);
    }
}
module.exports = { chkSSO };
