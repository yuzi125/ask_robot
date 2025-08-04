const responseModel = require("../model/responseModel");
async function tempPermissionCheck(req, res, next) {
    let rsmodel = new responseModel();
    try {
        const { user_no, user_type, login_type } = req.session.userInfo;
        console.log("user_no, user_type, login_type", user_no, user_type, login_type);
        if (user_no === "icsc-admin" && user_type === "member" && login_type === "system") {
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
module.exports = tempPermissionCheck;
