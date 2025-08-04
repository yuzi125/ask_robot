const Users = require("../schema/users");

exports.getUserByUserNo = async function (user_no) {
    let rs = null;
    try {
        rs = await Users.findOne({
            attributes: ["id", "nickname", "avatar", "e_mail", "user_no"],
            where: { user_no: user_no },
        });
        if (rs) rs = rs.dataValues;
    } catch (e) {
        console.error(e.message);
    }
    return rs;
};

exports.setUserByUid = async function (){
    let rs = null;
    try {
    } catch (e) {
        console.error(e.message);
    }
    return rs;
}

exports.createUser = async function (){
    let rs = null;
    try {
    } catch (e) {
        console.error(e.message);
    }
    return rs;
}

exports.deleteUserByUid = async function (){
    let rs = null;
    try {
    } catch (e) {
        console.error(e.message);
    }
    return rs;
}