const jwt = require("jsonwebtoken");

exports.decode = async function (req, res) {
    const data = JSON.parse(req.body)
    const token = data.t ;
    console.log("token", token)
    let userInfo = jwt.decode(token);
    console.log("userInfo", userInfo)
    res.json(userInfo);
};
