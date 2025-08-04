const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const tipFormatDate = require("../tipFormatData");

exports.getExpertTip = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let groupId = req.query.groupId;
        const config_jsonb = [];
        let query = "SELECT expert_id FROM bot_messages WHERE group_id = $1";
        let params = [groupId];

        let result = await sql.query(query, params);
        const botMessagesRows = result.rows;

        /**
     * 拿著 expert_id 搜 expert_skill_mapping 找出所有 expert_id 吻合的 row 的 skill_id
       拿著 skill_id 搜 skill 表找出所有 skill_id 吻合的 row 的 config_jsonb
       取出所有 skill row 的 config_jsonb
     */
        if (botMessagesRows.length > 0) {
            const expert_id = botMessagesRows[0].expert_id;
            // 拿 expert_id 搜尋 expert_skill_mapping 找出所有 export_id 吻合的 row 的 skill_id
            query = "SELECT skill_id FROM expert_skill_mapping WHERE expert_id = $1";
            params = [expert_id];
            result = await sql.query(query, params);
            const expertSkillRows = result.rows;
            console.log("expertSkillRows", expertSkillRows);
            if (expertSkillRows.length > 0) {
                // 拿著 skill_id 搜 skill 表找出所有 skill_id 吻合的 row 的 config_jsonb skill_id 會是陣列
                for (const row of expertSkillRows) {
                    const skill_id = row.skill_id;
                    const query = "SELECT config_jsonb FROM skill WHERE id = $1";
                    const params = [skill_id];
                    console.log("params", params);
                    const result = await sql.query(query, params);
                    const skillRows = result.rows;
                    config_jsonb.push(skillRows[0].config_jsonb);
                }
            }

            // 拿著 expert_id 搜 expert_datasets_mapping 找出所有 expert_id 吻合的 row 的 datasets_id
            query = "SELECT datasets_id FROM expert_datasets_mapping WHERE expert_id = $1";
            params = [expert_id];
            result = await sql.query(query, params);
            const expertDatasetsRows = result.rows;
            // 拿著 datasets_id 搜 datasets 表找出所有 datasets_id 吻合的 row 的 config_jsonb
            if (expertDatasetsRows.length > 0) {
                for (const row of expertDatasetsRows) {
                    const datasets_id = row.datasets_id;
                    // 拿著 datasets_id 搜 datasets 表找出所有 datasets_id 吻合的 row 的 config_jsonb
                    query = "SELECT config_jsonb FROM datasets WHERE id = $1";
                    params = [datasets_id];
                    const result = await sql.query(query, params);
                    const datasetsRows = result.rows;
                    config_jsonb.push(datasetsRows[0].config_jsonb);
                }
            }
        }

        const filteredTipData = config_jsonb.filter((item) => item.tip);
        const tipData = filteredTipData.reduce((acc, item) => {
            if (item.tip) {
                return acc.concat(item.tip);
            }
            return acc;
        }, []);

        rsmodel.data = tipData;
        rsmodel.code = 0;
    } catch (error) {
        console.error(error.message);
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getExpertData = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const html_json = [];
        const config_jsonb = [];
        let expertId = req.query.expertId;
        let query = `SELECT name, welcome, avatar, source_chunk_mode, url, config_jsonb->>'show_dataset_name' as show_dataset_name, config_jsonb->>'translation_expert' as translation_expert FROM expert WHERE id = $1`;
        let params = [expertId];

        let result = await sql.query(query, params);

        // 將 show_dataset_name 從字串轉換為布林值
        // todo: 整合 welcome 和 tip
        if (result.rows.length > 0) {
            const welcome = result.rows[0].welcome;
            html_json.push({ tag: "buttonTipP", text: welcome, isTip: true });

            if (expertId) {
                // 取得 datasets 的 tip
                let sqlstr = "SELECT datasets_id FROM expert_datasets_mapping WHERE expert_id = $1";
                let sqlparam = [expertId];
                let result = await sql.query(sqlstr, sqlparam);
                const expertDatasetsRows = result.rows;

                if (expertDatasetsRows.length > 0) {
                    for (const row of expertDatasetsRows) {
                        const datasets_id = row.datasets_id;
                        sqlstr = "SELECT config_jsonb FROM datasets WHERE id = $1";
                        sqlparam = [datasets_id];
                        const result = await sql.query(sqlstr, sqlparam);
                        const datasetsRows = result.rows;
                        config_jsonb.push(datasetsRows[0].config_jsonb);
                    }
                }

                // 取得 skill 的 tip
                sqlstr = "SELECT skill_id FROM expert_skill_mapping WHERE expert_id = $1";
                sqlparam = [expertId];
                result = await sql.query(sqlstr, sqlparam);
                const expertSkillRows = result.rows;
                if (expertSkillRows.length > 0) {
                    for (const row of expertSkillRows) {
                        const skill_id = row.skill_id;
                        sqlstr = "SELECT config_jsonb FROM skill WHERE id = $1";
                        sqlparam = [skill_id];
                        const result = await sql.query(sqlstr, sqlparam);
                        const skillRows = result.rows;
                        config_jsonb.push(skillRows[0].config_jsonb);
                    }
                }

                const filteredTipData = config_jsonb.filter(
                    (item) => item.tip && Array.isArray(item.tip) && item.tip.length > 0
                );

                if (filteredTipData.length > 0) {
                    html_json.push({ tag: "buttonTipBr", isTip: true });
                    html_json.push({ tag: "buttonTipHr", isTip: true });
                    html_json.push({ tag: "buttonTipP", text: "你可以這樣問我：", isTip: true });
                    // 將 tip 內容加到 welcome 文字後
                    filteredTipData.map((item) => {
                        item.tip.map((tip) => {
                            if (typeof tip === "object") {
                                html_json.push({
                                    tag: "buttonTipWithParams",
                                    text: tipFormatDate(tip.buttonValue),
                                    params: tipFormatDate(tip.clickValue),
                                    action: "buttonTextToInput",
                                    isTip: true,
                                });
                            } else {
                                html_json.push({
                                    tag: "buttonTip",
                                    text: tipFormatDate(tip),
                                    action: "buttonTextToInput",
                                    isTip: true,
                                });
                            }
                        });
                    });

                    html_json.push({
                        tag: "buttonTipP",
                        text: "或者，你也可以使用上方的問號按鈕來詢問問題。",
                        isTip: true,
                    });
                }
            }

            result.rows = result.rows.map((row) => {
                const welcomeMessage = {
                    avatar: row.avatar,
                    sender: "bot",
                    message: [
                        {
                            html_json,
                        },
                    ],
                    time: new Date().getTime(),
                };
                return {
                    ...row,
                    show_dataset_name: row.show_dataset_name === "true", // 將 "true" 轉為 true，"false" 轉為 false
                    translation_expert: row.translation_expert === "true", // 將 "true" 轉為 true，"false" 轉為 false
                    welcomeMessage,
                };
            });
        }

        rsmodel.data = result.rows;
        rsmodel.code = 0;
    } catch (error) {
        console.error(error.message);
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};
