const Users = require("../schema/users");

exports.getList = async function () {
    let rs = null;
    try {
        rs = await Users.findOne({
            attributes: [],
            where: { },
        });
        if (rs) rs = rs.dataValues;
    } catch (e) {
        console.error(e.message);
    }
    return rs;
};


