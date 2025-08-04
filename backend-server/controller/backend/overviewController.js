const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const logRouteDetails = require("../routeNameLog");


exports.menu = async function(req,res){
    logRouteDetails("overviewController.menu", req);
    let rsmodel = new responseModel();
    try {
        const query = {
            text:"",
            values:[]
        }
        let rs = await sql.query("");
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
}

exports.overview = async function (req, res) {
    /**
     * token_price  時間內token數與總花費
     * total_message  AVA每天的互動總次數
     * active_user  AVA每天有效互動的用戶數
     * model_use  時間內知識庫與技能的使用數
     */
    logRouteDetails("overviewController.overview", req);
    let rsmodel = new responseModel();
    try {
        let { expert_id, period, subject } = req.query;
        console.info("overviewController.overview: ", req.query);
        let query, rs;
        switch (subject) {
            case "token_price":
                query = {
                    text: "select to_char(create_time,'YYYY-MM-DD') date, sum(price_usd) 花費金額, (sum(prompt_token)::integer) 輸入token數, (sum(completion_token)::integer) 輸出token數 \
                                from model_token_log where expert_id = $1 and create_time >= current_date - cast($2 as interval) and create_time < current_date + interval '1 day' \
                                group by date order by date",
                    values: [expert_id, period],
                };
                rs = await sql.query(query);
                break;
            case "total_message":
                query = {
                    text: "select to_char(create_time,'YYYY-MM-DD') date, count(distinct chat_uuid) 訊息數 \
                                from model_token_log where expert_id = $1 and create_time >= current_date - cast($2 as interval) and create_time < current_date + interval '1 day' \
                                group by date order by date",
                    values: [expert_id, period],
                };
                rs = await sql.query(query);
                break;
            case "active_user":
                query = {
                    text: "select to_char(create_time,'YYYY-MM-DD') date, count(distinct users_id) 用戶數 \
                                from model_token_log where expert_id = $1 and create_time >= current_date - cast($2 as interval) and create_time < current_date + interval '1 day' \
                                group by date order by date",
                    values: [expert_id, period],
                };
                rs = await sql.query(query);
                break;
            case "model_use":
                query = {
                    text: "select to_char(create_time,'YYYY-MM-DD') date, count(case when expert_model_type = 1 then 1 end) 知識庫, \
                                count(case when expert_model_type = 2 then 1 end) 技能 \
                                from model_token_log where expert_id = $1 and create_time >= current_date - cast($2 as interval) and create_time < current_date + interval '1 day' \
                                group by date order by date",
                    values: [expert_id, period],
                };
                rs = await sql.query(query);
                break;
        }

        rsmodel.code = 0;
        rsmodel.data = rs.rows;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};