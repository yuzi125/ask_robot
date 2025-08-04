const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const logRouteDetails = require("../routeNameLog");
exports.recommend = async function (req, res) {
    logRouteDetails("clientsets.recommend", req);
    let rsmodel = new responseModel();

    try {
        let rs = await sql.query("select * from recommend_preset");
        rsmodel.code = 0;
        rsmodel.data = rs.rows;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
exports.updateRecommend = async function (req, res) {
    logRouteDetails("clientsets.updateRecommend", req);
    let rsmodel = new responseModel();

    try {
        const { id, text } = JSON.parse(req.body);
        console.info("clientsets.updateRecommend:", JSON.parse(req.body));
        await sql.query("update recommend_preset set text = $1 where id = $2", [text, id]);

        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.insertRecommend = async function (req, res) {
    logRouteDetails("clientsets.insertRecommend", req);
    let rsmodel = new responseModel();

    try {
        const { text, expert_id } = JSON.parse(req.body);
        console.info("clientsets.insertRecommend:", JSON.parse(req.body));
        if (!text.trim() || !expert_id.trim()) {
            return;
        }
        let rs = await sql.query(
            "insert into recommend_preset(id,text,expert_id) values((select coalesce(max(id),0)+1 from recommend_preset),$1,$2) returning id",
            [text, expert_id]
        );
        if (rs.rowCount === 1) {
            rsmodel.code = 0;
            rsmodel.data = { id: rs.rows[0].id, text: text, expert_id: expert_id };
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.delRecommend = async function (req, res) {
    logRouteDetails("clientsets.delRecommend", req);
    let rsmodel = new responseModel();

    try {
        const { id } = req.params;
        console.info("clientsets.delRecommend:", req.params);
        let rs = await sql.query("delete from recommend_preset where id = $1", [id]);
        if (rs.rowCount > 0) {
            rsmodel.code = 0;
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.bulletin = async function (req, res) {
    logRouteDetails("clientsets.bulletin", req);
    let rsmodel = new responseModel();
    try {
        let rs = (await sql.query("select * from settings")).rows;
        const obj = {};
        rs.forEach((item) => {
            switch (item.key) {
                case "system_bulletin":
                case "system_bulletin_color":
                case "system_bulletin_color_back":
                    obj[item.key] = item.value;
                    break;
            }
        });
        rsmodel.code = 0;
        rsmodel.data = obj;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.updateBulletin = async function (req, res) {
    logRouteDetails("clientsets.updateBulletin", req);
    let rsmodel = new responseModel();
    try {
        const { id, text } = JSON.parse(req.body);
        console.info("clientsets.updateBulletin:", JSON.parse(req.body));
        let chk = await sql.query('update settings set "value" = $1 where "key" = $2', [text, id]);
        if (chk.rowCount >= 1) {
            rsmodel.code = 0;
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
