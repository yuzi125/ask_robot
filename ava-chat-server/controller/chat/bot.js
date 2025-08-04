const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const { containsPrisonWord } = require("../../utils/common");
const Expert = require("../../orm/schema/expert");
const Settings = require("../../orm/schema/settings");
const BotMessages = require("../../orm/schema/bot_messages");
const UserAcknowledgement = require("../../orm/schema/user_acknowledgement");
const Announcement = require("../../orm/schema/announcement");
const permissionUtils = require("../../utils/permission");
const { redisClient } = require("../../global/redisStore");
const { validateApiKey } = require("../../utils/apiKeyUtils");
// const axios = require("../../global/axios");
const axios = require("axios");
const { isEventStream, createWritableStream } = require("../../utils/stream");
const { getCurrentTimestamp } = require("../../utils/common");
const tipFormatDate = require("../tipFormatData");

const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

function isSameDay(timestamp1, timestamp2) {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);

    date1.setHours(0, 0, 0, 0);
    date2.setHours(0, 0, 0, 0);

    return date1.getTime() === date2.getTime();
}
function calculateSmartLength(input) {
    if (!input) return 0;
    if (typeof input.replace !== "function") {
        return input.length || 0;
    }
    const cleanInput = input.replace(/\r?\n/g, "");

    // 中文單字、英文單字、數字串、emoji、標點、符號等等
    const tokens = cleanInput.match(/[\u4e00-\u9fff]|[a-zA-Z]+|\d+|[^\s]/gu) || [];

    let length = 0;

    for (const token of tokens) {
        if (/^[a-zA-Z]+$/.test(token)) {
            // 每 12 字元算 1 長度，無條件進位
            length += Math.ceil(token.length / 12);
        } else {
            // 其他單元（中文、emoji、符號等）每個算 1
            length += 1;
        }
    }

    return length;
}

//https://www.postgresql.org/docs/9.5/functions-json.html jsonb函數
// const botMessage = require("../model/botMessage");
// let users = ["p001", "p002", "p003", "p004"];
// users.forEach((item) => {
//     let welcome = `Hi, 我是 Ava，您的智慧特助。我可以幫您處理以下事情:
//     - 回答人事請假規章問題
//     - 回答出差管理規章問題
//     - … 其他，我待回會 demo 給你看 😊
//     `;
//     botMessage.setRoomMsg(item, {
//         sender: "bot",
//         message: {
//             data: welcome,
//             type: "text",
//         },
//     });
// });

exports.createRoom = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        const uid = req.session.userInfo.uid;
        const { expertId } = JSON.parse(req.body);
        const config_jsonb = [];
        const html_json = [];
        let rs;
        let expertName = "";
        let expertAvatar = "";
        rs = await sql.query("select group_id from bot_messages where users_id = $1 and expert_id = $2", [
            uid,
            expertId,
        ]);
        let roomId = rs.rows[0]?.group_id;

        // 沒有 roomId
        if (!roomId) {
            rs = (await sql.query("select id,name,welcome,avatar from expert where id = $1", [expertId])).rows[0];
            expertName = rs.name;
            expertAvatar = rs.avatar;
            let sqlstr = `
                INSERT INTO bot_messages(group_id, users_id, subject, chat, expert_id) 
                VALUES($1, $2, $3, $4, $5)
                ON CONFLICT (users_id, expert_id) 
                DO UPDATE SET group_id = bot_messages.group_id 
                RETURNING group_id
            `;
            roomId = uuidv4();
            let chat = JSON.stringify([]);
            let sqlparam = [roomId, uid, "New chat", chat, expertId];
            rs = await sql.query(sqlstr, sqlparam);
            roomId = rs.rows[0].group_id;

            /**
             * 取得知識庫 tip 加到 welcome 文字後
             * */
            sqlstr = "SELECT expert_id FROM bot_messages WHERE group_id = $1";
            sqlparam = [roomId];
            let result = await sql.query(sqlstr, sqlparam);
            const botMessagesRows = result.rows;

            if (botMessagesRows.length > 0) {
                const expert_id = botMessagesRows[0].expert_id;

                // 取得 skill 的 tip
                sqlstr = "SELECT skill_id FROM expert_skill_mapping WHERE expert_id = $1";
                sqlparam = [expert_id];
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

                // 取得 datasets 的 tip
                sqlstr = "SELECT datasets_id FROM expert_datasets_mapping WHERE expert_id = $1";
                sqlparam = [expert_id];
                result = await sql.query(sqlstr, sqlparam);
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

                    // 將 config_jsonb 裡的 tip 內容取出
                    const filteredTipData = config_jsonb.filter((item) => item.tip.length > 0);

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

                        chat = JSON.stringify([
                            { sender: "bot", message: [{ html_json: html_json }], time: Date.now() },
                        ]);
                    }
                }
            }

            sqlstr = "UPDATE bot_messages SET chat = $2 WHERE group_id = $1;";
            sqlparam = [roomId, chat];
            await sql.query(sqlstr, sqlparam);
        }
        rsmodel.code = 0;
        rsmodel.data = { roomId, expertName, expertAvatar };
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.updateChatJson = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const uid = req.session.userInfo.uid;
        const { roomId, expertId, type } = JSON.parse(req.body);
        const config_jsonb = [];
        const html_json = [];
        let chat;
        let rs;

        // 檢查 bot_messages 裡面的 chat 是否為空陣列
        rs = await sql.query("select chat from bot_messages where group_id = $1 and users_id = $2 and expert_id = $3", [
            roomId,
            uid,
            expertId,
        ]);

        if (rs.rows[0].chat.length !== 0) {
            rs2 = (await sql.query("select id,welcome from expert where id = $1", [expertId])).rows[0];
            history = rs.rows[0].chat;
            let lastItem = history[history.length - 1];
            // 使用歡迎詞和普通回覆的回傳格不一樣。
            let lastMessageData =
                lastItem.message && Array.isArray(lastItem.message) && lastItem.message.length > 0
                    ? lastItem.message[0].html_json &&
                      Array.isArray(lastItem.message[0].html_json) &&
                      lastItem.message[0].html_json.length > 0
                        ? lastItem.message[0].html_json[0].text
                        : null
                    : null;
            let lastTime = lastItem.time ? lastItem.time : null;
            let nowTime = Date.now();
            let welcome = rs2.welcome;
            let sender = lastItem.sender;

            if (isSameDay(lastTime, nowTime)) {
                if (sender === "bot" && lastMessageData === welcome) {
                    rsmodel.code = 0;
                    rsmodel.data = { roomId: roomId };
                    return res.json(rsmodel);
                }
            }
        }
        chat = rs.rows[0].chat;

        // 如果是空陣列，代表被清除聊天過，新增歡迎詞。
        // type 如果是 expiredDateNeedInsertWelcome 代表超過設定的更新頻率了，需要更新 chatJson，將歡迎詞 push 一筆到原本的 json。
        if (rs.rows[0].chat.length === 0 || type === "expiredDateNeedInsertWelcome") {
            /**
             * 取得知識庫 tip 加到 welcome 文字後
             * */
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

                // 將 config_jsonb 裡的 tip 內容取出
                console.log("config_jsonb: ", config_jsonb);
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

            if (type === "expiredDateNeedInsertWelcome") {
                chat.push({ sender: "bot", message: [{ html_json: html_json }], time: Date.now() });
                chat = JSON.stringify(chat);
            } else {
                chat = JSON.stringify([{ sender: "bot", message: [{ html_json: html_json }], time: Date.now() }]);
            }

            sqlstr = "UPDATE bot_messages SET chat = $1 where group_id = $2 and users_id = $3 and expert_id = $4";
            sqlparam = [chat, roomId, uid, expertId];
            await sql.query(sqlstr, sqlparam);
        }
        rsmodel.code = 0;
        rsmodel.data = { roomId: roomId };
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/**
 *
 * @param {string} uid 使用者uid
 * @param {string} roomId 房間號
 * @param {string} message 使用者傳來的訊息
 * @param {string} time 使用者何時傳來訊息
 * @param {string} rs 機器人全部回傳的內容
 */
exports.saveMessage = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let uid = req.session.userInfo.uid;
        let { roomId, userMsg, userMsgTime, botMsg, botMsgTime, history_message_id, is_tunnel } = JSON.parse(req.body);
        if (!uid || !roomId || !userMsg || !userMsgTime || !botMsg || !botMsgTime) return;

        let userMessage = { sender: uid, message: userMsg, time: userMsgTime };
        let botMessage = { sender: "bot", message: botMsg, time: botMsgTime, history_message_id };

        if (is_tunnel) {
            userMessage.is_tunnel = true;
            botMessage.is_tunnel = true;
        }

        if (!is_tunnel) {
            let deleteSql = `
              UPDATE bot_messages
                SET chat = COALESCE((
                    SELECT jsonb_agg(
                        jsonb_strip_nulls(
                            elem - 'is_tunnel'
                        )
                    )
                    FROM jsonb_array_elements(chat) AS elem
                ), '[]'::jsonb)
                WHERE group_id = $1;
            `;
            let deleteParams = [roomId];
            await sql.query(deleteSql, deleteParams);
        }

        let sqlstr =
            "update bot_messages set chat = chat || jsonb_build_array($1::jsonb,$2::jsonb) where group_id = $3";
        let sqlparam = [userMessage, botMessage, roomId];
        let chk = (await sql.query(sqlstr, sqlparam)).rowCount;
        if (chk) {
            rsmodel.code = 0;

            const cachePattern = `messages:${roomId}:page:*`;
            const keys = await redisClient.keys(cachePattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } else {
            rsmodel.message = "儲存失敗";
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.updateMessageJson = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let uid = req.session.userInfo.uid;
        let { roomId, historyMessagesId, updatedMessage, newFeedbackMessage } = JSON.parse(req.body);

        if (!uid || !roomId || !historyMessagesId || !updatedMessage || !newFeedbackMessage) {
            rsmodel.message = "缺少必要的參數";
            res.json(rsmodel);
            return;
        }

        // 要更新的訊息 和 評論訊息
        const newMessageJson = JSON.stringify(newFeedbackMessage);
        const updatedMessageJson = JSON.stringify(updatedMessage);

        // 透過 history id 找到那一筆資料 並且更新那一筆對話 和 新增評論對話到該筆對話的下方
        let updateQuery = `
            WITH message_idx AS (
                SELECT idx
                FROM bot_messages,
                jsonb_array_elements(chat) WITH ORDINALITY arr(message, idx)
                WHERE group_id = $1
                AND message->>'history_message_id' = $2
            )
            UPDATE bot_messages
            SET chat = jsonb_insert(
                jsonb_set(chat, ('{' || idx - 1 || '}')::text[], $3::jsonb),
                ('{' || idx || '}')::text[], $4::jsonb, true
            )
            FROM message_idx
            WHERE group_id = $1;
        `;
        let updateParams = [roomId, historyMessagesId, updatedMessageJson, newMessageJson];

        let result = await sql.query(updateQuery, updateParams);

        if (result.rowCount > 0) {
            rsmodel.code = 0;
            rsmodel.message = "更新成功";
            const cachePattern = `messages:${roomId}:page:*`;
            const keys = await redisClient.keys(cachePattern);
            console.log("keys", keys);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } else {
            rsmodel.message = "更新失敗";
        }
    } catch (e) {
        console.error(e);
        rsmodel.message = "伺服器錯誤";
    }
    res.json(rsmodel);
};
exports.message = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const uid = req.session.userInfo.uid;
        let { roomId, pageSize = 10, page = 0 } = JSON.parse(req.body);
        const offset = page * pageSize;

        // 快取 key
        const cacheKey = `messages:${roomId}:page:${page}:${pageSize}`;

        // 檢查 Redis 快取 先拿掉
        // const cachedData = await redisClient.get(cacheKey);

        // if (cachedData) {
        //     // code 2 測試
        //     rsmodel.code = 2;
        //     rsmodel.data = JSON.parse(cachedData);
        //     res.json(rsmodel);
        //     return;
        // }

        // 檢查房間權限（保持不變）
        let chk = (await sql.query("select users_id,expert_id from bot_messages where group_id=$1", [roomId])).rows[0];
        if (chk.users_id && chk.users_id !== uid) {
            chk = await sql.query("select group_id from bot_messages where expert_id = $1 and users_id = $2", [
                chk.expert_id,
                uid,
            ]);
            rsmodel.code = 100;
            if (chk.rowCount === 0) {
                rsmodel.data = { roomId: "creating" };
            } else {
                rsmodel.data = { roomId: chk.rows[0].roomId };
            }
            res.json(rsmodel);
            return;
        }

        // 使用 OFFSET 進行分頁

        // 注意：在 PostgreSQL 中正確的順序是 LIMIT 先於 OFFSET
        let sqlstr = `
            WITH message_set AS (
                SELECT element,
                       COUNT(*) OVER() AS total_count
                FROM bot_messages bm 
                CROSS JOIN jsonb_array_elements(bm.chat) AS element 
                WHERE group_id = $1 
                  AND users_id = $2
                ORDER BY element->>'time' DESC
                LIMIT $4
                OFFSET $3
            )
            SELECT 
                jsonb_agg(element ORDER BY element->>'time' DESC) AS chat,
                MAX(total_count) AS total_count
            FROM message_set;
        `;

        let rs = (await sql.query(sqlstr, [roomId, uid, offset, pageSize])).rows[0];

        // 保持原有的排序邏輯
        if (rs.chat) {
            rs.chat = rs.chat.reverse();
        }

        const messages = rs.chat || [];
        const totalCount = parseInt(rs.total_count || 0);

        // 回傳資料
        const responseData = {
            chat: messages,
            hasMore: offset + messages.length < totalCount,
            totalCount: totalCount,
        };

        rsmodel.code = 0;
        rsmodel.data = responseData;

        await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 300 });
    } catch (e) {
        console.error("Error in message API:", e);
        rsmodel.code = 500;
        rsmodel.message = "Internal Server Error";
    }

    res.json(rsmodel);
};
// exports.message = async function (req, res) {
//     let rsmodel = new responseModel();
//     try {
//         // let t = botMessage.getRoomMsg(roomId);
//         // botMessage.setRoomMsg(roomId, { sender: roomId, message: message });

//         const uid = req.session.userInfo.uid;
//         let { roomId, firstTime } = JSON.parse(req.body);
//         console.log("uid: ", uid);
//         console.log("roomId: ", roomId);
//         //檢查這個房號是否屬於這個uid，不屬於就找這個uid的這個專家房號
//         let chk = (await sql.query("select users_id,expert_id from bot_messages where group_id=$1", [roomId])).rows[0];
//         // TODO: 加上 chk 沒資料的防呆
//         if (chk.users_id && chk.users_id !== uid) {
//             chk = await sql.query("select group_id from bot_messages where expert_id = $1 and users_id = $2", [
//                 chk.expert_id,
//                 uid,
//             ]);
//             rsmodel.code = 100;
//             if (chk.rowCount === 0) {
//                 rsmodel.data = { roomId: "creating" };
//             } else {
//                 rsmodel.data = { roomId: chk.rows[0].roomId };
//             }
//             res.json(rsmodel);
//             return;
//         }
//         // console.error(roomId, firstTime);
//         let addSQL = "";
//         if (firstTime) {
//             addSQL = "and element->'time'<$3";
//         }
//         let sqlstr = `select jsonb_agg(element) as chat from
//                         (select element from bot_messages bm
//                             cross join jsonb_array_elements(bm.chat) as element
//                             where group_id=$1 and users_id=$2 ${addSQL}
//                             order by element->'time' desc
//                             limit 50)
//                         as temptable`;
//         let sqlparam = [roomId, uid];
//         if (firstTime) sqlparam.push(firstTime);

//         let rs = (await sql.query(sqlstr, sqlparam)).rows[0];
//         if (rs.chat) {
//             rs.chat = rs.chat.reverse();
//         }
//         // let rs = (await sql.query(sqlstr, sqlparam)).rows;
//         // rs = rs.map((m) => {
//         //     return {
//         //         subject: m.subject,
//         //         chat: m.chat,
//         //     };
//         // })[0];
//         rsmodel.code = 0;
//         rsmodel.data = rs || [];
//     } catch (e) {
//         console.error(e);
//     }
//     res.json(rsmodel);
// };

exports.chkSyncMsg = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { roomId, lastTime } = JSON.parse(req.body);
        let sqlstr =
            "select jsonb_agg(element) as rs from bot_messages bm \
                    cross join jsonb_array_elements(bm.chat) as element \
                    where group_id = $1 and element->'time'>$2";
        let sqlparam = [roomId, lastTime];
        let rs = (await sql.query(sqlstr, sqlparam)).rows[0].rs;
        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.recommendList = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let sqlstr = "select * from recommend_preset";
        let rs = (await sql.query(sqlstr)).rows;
        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.customRecommendList = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let uid = req.session.userInfo.uid;
        let sqlstr = "select text,sort from recommend_custom where users_id=$1";
        let sqlparam = [uid];
        let rs = (await sql.query(sqlstr, sqlparam)).rows;
        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.addCustomRecommend = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let uid = req.session.userInfo.uid;
        console.log(uid);
        let { text } = JSON.parse(req.body);

        let sqlstr = `insert into recommend_custom(users_id,text,sort) 
                values($1,$2,(select coalesce(max(sort),0)+1 sort from recommend_custom where users_id = $3)) returning sort`;
        // (select coalesce(max(sort),0)+1 from recommend_custom where users_id = $1)
        let sqlparam = [uid, text, uid];
        let rs = await sql.query(sqlstr, sqlparam);
        if (rs.rowCount == 1) {
            rsmodel.code = 0;
            rsmodel.data = { sort: rs.rows[0].sort };
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.delCustomRecommend = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let uid = req.session.userInfo.uid;
        let { sort } = JSON.parse(req.body);
        let sqlstr = `delete from recommend_custom where users_id=$1 and sort=$2`;
        let sqlparam = [uid, sort];
        let rs = await sql.query(sqlstr, sqlparam);
        if (rs.rowCount == 1) {
            rsmodel.code = 0;
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.updateContext = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { roomId, context } = JSON.parse(req.body);
        let sqlstr = `update bot_messages set context = $1 where group_id = $2`;
        let sqlparam = [context, roomId];
        let rs = await sql.query(sqlstr, sqlparam);
        if (rs.rowCount == 1) {
            rsmodel.code = 0;
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.chkSyncContext = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { roomId } = JSON.parse(req.body);
        let sqlstr = `select context from bot_messages where group_id = $1`;
        let sqlparam = [roomId];
        let rs = await sql.query(sqlstr, sqlparam);
        rsmodel.code = 0;
        rsmodel.data = rs.rows[0]?.context;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
exports.updateMessage = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { message, roomId } = JSON.parse(req.body);
        if (!message || !roomId) {
            throw new Error("Invalid input data: message or roomId missing");
        }
        if (!message.time || !message.sender) {
            throw new Error("Invalid message data: time or sender missing");
        }

        let sqlstr = `update bot_messages set chat = (
                            select jsonb_agg(
                                case when element->>'time' = $1 and element->>'sender' = $2 
                                then jsonb_set(element, '{message}', $3::jsonb, false)
                                else element end
                            )
                            from (
                                select element from bot_messages bm
                                cross join jsonb_array_elements(bm.chat) as element
                                where group_id = $4
                            ) as temptable
                        ) where group_id = $5`;
        let sqlparam = [message.time, message.sender, JSON.stringify(message.message), roomId, roomId];
        let chk = (await sql.query(sqlstr, sqlparam)).rowCount;
        if (chk) {
            rsmodel.code = 1; // 成功代碼
            rsmodel.message = "修改成功";
        } else {
            rsmodel.code = 0; // 失敗代碼
            rsmodel.message = "修改失敗";
        }
    } catch (e) {
        console.error("Error in updateMessage:", e.message);
        rsmodel.code = 0; // 捕獲異常的失敗代碼
        rsmodel.message = "修改失敗，發生錯誤: " + e.message;
    }
    res.json(rsmodel);
};

exports.addHistoryMessage = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const uid = req.session.userInfo.uid;
        const { text, expert_id } = JSON.parse(req.body);
        console.log(text, expert_id);
        let rs = await sql.query("select count(*) c from recommend_history where users_id = $1 and expert_id = $2", [
            uid,
            expert_id,
        ]);

        if (rs.rows[0].c >= 10) {
            rs = await sql.query(
                "delete from recommend_history where time in (select time from recommend_history where users_id = $1 order by time limit 1) and users_id = $2",
                [uid, uid]
            );
        }
        let sqlstr = `insert into recommend_history(users_id,text,expert_id) values($1,$2,$3)`;
        let sqlparam = [uid, text, expert_id];
        await sql.query(sqlstr, sqlparam);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.message = e.message;
    }
    res.json(rsmodel);
};

exports.historyMessage = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let uid = req.session.userInfo.uid;
        let sqlstr = 'select text,"time" from recommend_history where users_id=$1';
        let sqlparam = [uid];
        let rs = (await sql.query(sqlstr, sqlparam)).rows;
        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.recommend = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let uid = req.session.userInfo.uid;
        let expert_id = req.query.expert_id;
        let sqlstr1 =
            'select text,"time" from recommend_history where users_id=$1 and expert_id=$2 order by "time" desc limit 10';
        let sqlstr2 = "select text,sort from recommend_custom where users_id=$1";
        let sqlstr3 = "select * from recommend_preset where expert_id=$1";
        let rs = {};
        rs.historyList = (await sql.query(sqlstr1, [uid, expert_id])).rows;
        rs.customList = (await sql.query(sqlstr2, [uid])).rows;
        rs.recommendList = (await sql.query(sqlstr3, [expert_id])).rows;
        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getForm = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let sqlstr = "select id,form_name,form_description,create_time from form_configuration where is_enable = 1";
        sqlparam = [];
        let rs = await sql.query(sqlstr, sqlparam);
        rs = rs.rows;
        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.avaTextGeneration = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        let { message, expert_id, stream, event } = req.body;

        // 取得使用者對話
        let parsedMessage;
        let messageData;
        let messageType;

        try {
            parsedMessage = JSON.parse(message);

            messageData = parsedMessage.data;

            if (parsedMessage.text) {
                messageData = parsedMessage.text;
            } else if (parsedMessage.input_message) {
                messageData = parsedMessage.input_message;
            }

            messageType = parsedMessage.type;

            // messageData 沒有資料就丟錯
            const isInvalidData =
                messageData === undefined ||
                messageData === null ||
                (typeof messageData === "string" && messageData.trim() === "") ||
                (Array.isArray(messageData) && messageData.length === 0);

            if (isInvalidData) {
                throw new Error("Invalid message data: messageData is empty or undefined");
            }
        } catch (error) {
            console.error("Error parsing message data:", error);
            res.status(400).json({
                code: 1,
                message: `很抱歉，接收到的訊息格式錯誤。`,
            });
            return;
        }

        let maxMessageLength = 200; // 預設值
        try {
            const result = await sql.query("SELECT value FROM public.settings WHERE key = 'max_message_length'");
            if (result.rows.length > 0) {
                maxMessageLength = parseInt(result.rows[0].value, 10); // 將字串轉換為整數
            }
        } catch (error) {
            console.error("Error fetching max_message_length from DB:", error);
        }

        let minMessageLength = 4; // 預設值
        try {
            const result = await sql.query("SELECT value FROM public.settings WHERE key = 'min_message_length'");
            if (result.rows.length > 0) {
                minMessageLength = parseInt(result.rows[0].value, 10); // 將字串轉換為整數
            }
        } catch (error) {
            console.error("Error fetching min_input_limit_value from DB:", error);
        }

        if (event !== "health_check") {
            try {
                const uid = req?.session?.userInfo?.uid;
                const apiKey = req.headers["api-key"];
                if (!(apiKey && (await validateApiKey(apiKey)))) {
                    // 檢查是否有任何未同意的條款
                    const latestTerms = await Announcement.findAll({
                        where: {
                            type: "TERMS",
                            status: "PUBLISHED",
                            require_agreement: true,
                        },
                        order: [["create_time", "DESC"]],
                    });

                    if (latestTerms.length > 0) {
                        // 檢查用戶是否同意了所有條款
                        const userAgreements = await UserAcknowledgement.findAll({
                            where: {
                                uid: uid,
                                announcement_id: latestTerms.map((term) => term.id),
                                action: "AGREED",
                            },
                        });

                        // 如果同意的數量少於條款數量，表示有未同意的條款
                        if (userAgreements.length < latestTerms.length) {
                            const agreementAlert = await Settings.findOne({
                                where: { key: "agreement_alert" },
                            });
                            let errorMsg = "請先同意使用說明才能使用此功能";
                            if (agreementAlert) {
                                errorMsg = agreementAlert.dataValues.value;
                            }
                            res.status(403).json({
                                code: 1,
                                message: errorMsg,
                            });
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error("Error checking terms agreement:", error);
            }
        }

        // 檢查 messageData 的字數是否超過限制
        try {
            if (calculateSmartLength(messageData) > maxMessageLength) {
                res.status(400).json({
                    code: 1, // 自定義的錯誤代碼
                    message: `很抱歉，您輸入的文字長度已超出系統上限，請簡化內容後再嘗試送出。`,
                });
                return;
            }

            if (messageType !== "tunnel" && typeof messageData === "string" && !/^\/[te]/.test(messageData) && messageData.length < minMessageLength) {
                res.status(400).json({
                    code: 1, // 自定義的錯誤代碼
                    message: `請多描述您的提問，讓我們更好地協助您取得相關資訊！`,
                });
                return;
            }
        } catch (error) {
            console.log("Error checking message length:", error);
        }

        // 處理全域禁用詞
        let globalTextPrisonWords = [];
        try {
            let globalTextPrisonWordsSqlstr = "SELECT value FROM settings WHERE key='text_prison_words'";
            let globalTextPrisonWordsResponse = await sql.query(globalTextPrisonWordsSqlstr);

            if (globalTextPrisonWordsResponse.rows.length > 0 && globalTextPrisonWordsResponse.rows[0].value) {
                globalTextPrisonWords = JSON.parse(globalTextPrisonWordsResponse.rows[0].value);
            }
        } catch (error) {
            console.error("Error fetching global text prison words:", error);
        }

        // 處理專家禁用詞和內容替換列表
        let expertTextPrisonWords = [];
        let contentReplacementList = {};
        try {
            let expertConfigSqlstr = `
                SELECT 
                config_jsonb->'text_prison_words' as text_prison_words,
                config_jsonb->'content_replacement_list' as content_replacement_list
                FROM expert 
                WHERE id=$1
            `;

            let expertConfigResponse = await sql.query(expertConfigSqlstr, [expert_id]);

            if (expertConfigResponse.rows.length > 0) {
                if (expertConfigResponse.rows[0].text_prison_words) {
                    expertTextPrisonWords = expertConfigResponse.rows[0].text_prison_words;
                }
                if (expertConfigResponse.rows[0].content_replacement_list) {
                    contentReplacementList = JSON.parse(expertConfigResponse.rows[0].content_replacement_list);
                }
            }
        } catch (error) {
            console.error("Error fetching expert config:", error);
        }

        let enableCacheStreamingReply = false;

        try {
            let enableCacheStringReplySqlStr = "SELECT value FROM settings WHERE key='enable_cache_streaming_reply'";
            let enableCacheStringReplyResponse = await sql.query(enableCacheStringReplySqlStr);

            if (enableCacheStringReplyResponse.rows[0].value) {
                enableCacheStreamingReply = enableCacheStringReplyResponse.rows[0].value === "1" ? true : false;
            }
        } catch (error) {
            console.error("Error fetching expert config:", error);
        }

        // 應用內容替換（支援正規表達式和普通字符串替換）
        if (messageData && typeof messageData === "string") {
            Object.entries(contentReplacementList).forEach(([key, value]) => {
                try {
                    let pattern = key;
                    let flags = "g"; // 默認使用全局替換

                    // 檢查是否有 inline flags
                    const inlineFlagsMatch = key.match(/^\(\?([a-z]*)\)(.*)/);
                    if (inlineFlagsMatch) {
                        const inlineFlags = inlineFlagsMatch[1];
                        pattern = inlineFlagsMatch[2];

                        if (inlineFlags.includes("i")) {
                            flags = "gi"; // 新增不區分大小寫的標誌
                        }
                    }

                    console.log(`Processing: pattern="${pattern}", flags="${flags}"`);

                    // 建立正則表達式對象
                    const regex = new RegExp(pattern, flags);
                    const originalMessageData = messageData;
                    messageData = messageData.replace(regex, value);

                    if (originalMessageData !== messageData) {
                        console.log(`Replacement applied: "${key}" -> "${value}"`);
                    } else {
                        console.log(`No replacement made for: "${key}"`);
                    }
                } catch (error) {
                    console.warn(`Error applying regex replacement for "${key}": ${error.message}`);
                    // 如果正則表達式無效，退回到普通字符串替換
                    messageData = messageData.replace(new RegExp(escapeRegExp(key), "g"), value);
                }
            });
        }

        // 更新 message 與替換後的內容
        if (parsedMessage) {
            if (parsedMessage.text !== undefined) {
                parsedMessage.text = messageData;
            } else if (parsedMessage.input_message !== undefined) {
                parsedMessage.input_message = messageData;
            } else {
                parsedMessage.data = messageData;
            }
            message = JSON.stringify(parsedMessage);
        }

        // 如果使用者的文字有包含禁用詞裡面的字串，就回覆不支援。
        if (globalTextPrisonWords.length > 0 && containsPrisonWord(messageData, globalTextPrisonWords)) {
            res.write(JSON.stringify({ type: "data" }));
            res.write("</end>");
            res.write("<p>不好意思，我還尚未了解過相關知識，也許你可以換個方式問問題。</p>");
            res.write("</end>");
            res.end();

            return;
        }

        // 如果使用者的文字有包含禁用詞裡面的字串，就回覆不支援。
        if (expertTextPrisonWords.length > 0 && typeof messageData === "string" && containsPrisonWord(messageData, expertTextPrisonWords)) {
            res.write(JSON.stringify({ type: "data" }));
            res.write("</end>");
            res.write("<p>不好意思，我還尚未了解過相關知識，也許你可以換個方式問問題。</p>");
            res.write("</end>");
            res.end();

            return;
        }

        if (JSON.parse(message).type === "text") {
            let msgText = JSON.parse(message).data || "";
            let input_message = "";
            const tunnel_cmd = ["/t ", "/tunnel "];
            //檢查有無 "/t"
            // let firstLetter = msgText.substring(0,3);
            // let noFirstLetter = msgText.substring(3);
            // if(firstLetter==="/t "){
            //     message = JSON.stringify({type:"tunnel",input_message:noFirstLetter});
            // }
            tunnel_cmd.forEach((cmd) => {
                if (msgText.startsWith(cmd)) {
                    input_message = msgText.substring(cmd.length);
                    message = JSON.stringify({ type: "tunnel", input_message: input_message });
                    console.log(message);
                    return;
                }
            });
        }

        if (JSON.parse(message).type === "tunnel") {
            // 新增處理 /e /t xxx 的邏輯
            let msgText = JSON.parse(message).input_message || "";
            if (msgText.startsWith("/e ")) {
                const remainingText = msgText.substring(3).trim();
                if (remainingText.startsWith("/t ")) {
                    input_message = remainingText.substring(3);
                    // 先退出隧道模式
                    res.write(JSON.stringify({ type: "tunnel" }));
                    res.write("</end>");
                    res.write(JSON.stringify({ state: "aborted" }));
                    res.write("</end>");
                    res.write(JSON.stringify({ type: "hmi" }));
                    res.write("</end>");
                    res.write("-1");
                    res.write("</end>");
                    res.write(JSON.stringify({ type: "data" }));
                    res.write("</end>");
                    res.write("<p class='warning'>已中斷</p>");
                    res.write("</end>");

                    // 再進入隧道模式並帶上數據
                    message = JSON.stringify({ type: "tunnel", input_message: input_message });
                    console.log(message);
                }
            }
        }
        let tunnelText = JSON.parse(message).input_message || "";

        const exit_cmd = ["/e", "/exit"];
        if (exit_cmd.includes(tunnelText)) {
            res.write(JSON.stringify({ type: "tunnel" }));
            res.write("</end>");
            res.write(JSON.stringify({ state: "aborted" }));
            res.write("</end>");
            res.write(JSON.stringify({ type: "hmi" }));
            res.write("</end>");
            res.write("-1");
            res.write("</end>");
            res.write(JSON.stringify({ type: "data" }));
            res.write("</end>");
            res.write("<p class='warning'>已中斷</p>");
            res.write("</end>");
            res.end();

            return;
        }

        let data = "";
        const isJSON = function (s) {
            try {
                return JSON.parse(s);
            } catch (error) {
                return false;
            }
        };
        const { Writable } = require("stream");
        const writableStream = new Writable({
            write(chunk, encoding, callback) {
                if (stream === "false") {
                    data += chunk.toString();
                } else {
                    slowSend(chunk.toString(), callback);
                }
                callback();
            },
            final(callback) {
                if (stream === "false") {
                    let arr = data.split("</end>");
                    for (let i = 0; i < arr.length; i++) {
                        let temp = isJSON(arr[i]);
                        if (temp) {
                            arr[i] = temp;
                            if (arr[i].type === "data") {
                                arr[i].data = arr[i + 1];
                                arr.splice(i + 1, 1);
                            }
                        }
                    }
                    arr.pop();
                    res.json(arr);
                } else {
                    res.end();
                }
                callback();
            },
        });

        const forwarded = req.headers["x-forwarded-for"];
        const ip = forwarded ? forwarded.split(",")[0] : req.connection.remoteAddress;
        console.log("ip", ip);
        console.log("expert_id", expert_id);
        console.log("message", message);
        console.log("req.headers.cookie", req.headers.cookie);
        console.log("req.sessionID", req.sessionID);
        axios
            .post(
                `${process.env.PYTHON_API_HOST}`,
                {
                    message: message,
                    ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
                    expert_id: expert_id,
                    device: "browser",
                },
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                        token: "efa0d936-34de-4c6b-a130-bfbb89957133",
                        Cookie: req.headers.cookie, // 確保這裡正確傳遞 Cookie
                        "X-Forwarded-For": ip, // 手動設定 X-Forwarded-For 為前端的 IP
                    },
                    responseType: "stream",
                }
            )
            .then((response) => {
                if (response.request.res.responseUrl !== process.env.PYTHON_API_HOST) {
                    res.redirect(response.request.res.responseUrl);
                } else {
                    const isStreaming = isEventStream(response);
                    const writableStream = createWritableStream(res, isStreaming, stream, enableCacheStreamingReply);
                    response.data
                        .pipe(writableStream)
                        .on("finish", () => {
                            console.log("Finished sending data");
                        })
                        .on("error", (error) => {
                            console.error("stream error:", error);
                            res.status(500).send("server error");
                        });
                }
            })
            .catch((error) => {
                res.status(500).send("server error");
                return;
                if (error.response) {
                    // 伺服器響應狀態碼不在 2xx 範圍內
                    console.log("錯誤數據: ", error.response.data);
                    console.log("錯誤狀態碼: ", error.response.status);
                    console.log("錯誤頭部: ", error.response.headers);
                    rsmodel.message = "python api not return 200 status";
                    rsmodel.data = error.response.data;
                    res.json(rsmodel);
                } else if (error.request) {
                    // 請求已經發出，但沒有收到響應
                    // `error.request` 是在瀏覽器中的 XMLHttpRequest 實例，
                    // 而在 Node.js 中是 http.ClientRequest 的實例
                    console.log("無響應: ", error.request);
                    res.json(rsmodel);
                } else {
                    // 觸發請求的錯誤信息
                    console.dir(error.message);
                    res.json(rsmodel);
                }
                console.dir(error.config);
                res.json(rsmodel);
            });
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

// 輔助函數：轉義正規表達式特殊字符
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.avaApiSkillPost = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const forwarded = req.headers["x-forwarded-for"];
        const ip = forwarded ? forwarded.split(",")[0] : req.connection.remoteAddress;
        console.log("ip", ip);
        const { post_data, expert_id } = JSON.parse(req.body);
        console.log("post_data: ", post_data);
        console.log("expert_id: ", expert_id);

        const response = await axios.post(
            `${process.env.PYTHON_API_HOST}/skillPost`,
            {
                post_data,
                ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
                expert_id: expert_id,
                device: "browser",
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    token: "efa0d936-34de-4c6b-a130-bfbb89957133",
                    "X-Forwarded-For": ip,
                },
            }
        );

        const rawData = response.data.data;
        const parts = rawData.split("</end>");

        if (parts.length >= 2) {
            try {
                // parts[1] 是 JSON 陣列字串
                const jsonArray = JSON.parse(parts[1]);

                // 加上 action
                const modifiedArray = jsonArray.map((item) => ({
                    ...item,
                    action: response.data.action || "skill",
                }));

                // 重組成原格式
                const resultString = `${parts[0]}</end>${JSON.stringify(modifiedArray)}</end>`;
                rsmodel.data = resultString;
            } catch (err) {
                console.error("JSON parse error:", err);
                rsmodel.data = rawData; // fallback 保留原始資料
            }
        } else {
            rsmodel.data = rawData;
        }

        res.json(rsmodel);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("server error: " + error.message);
    }
};

const FormData = require("form-data");
const fs = require("fs");

exports.avaUploadAudioFile = async function (req, res) {
    try {
        // 檢查是否有文件上傳
        if (!req.file) {
            return res.status(400).send("No file uploaded.");
        }

        const formData = new FormData();
        formData.append("audio", fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });
        formData.append("ava_token", `${SESSION_KEY_PREFIX}${req.sessionID}`);
        formData.append("expert_id", req.body.expert_id);
        const pythonServerResponse = await axios.post(`${process.env.PYTHON_API_HOST}/voice`, formData, {
            headers: {
                "x-code": req.headers["x-code"],
            },
        });

        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting temporary file:", err);
        });

        res.status(pythonServerResponse.status).send(pythonServerResponse.data);
    } catch (error) {
        console.error("Error processing upload:", error);
        res.status(500).send("Error processing upload");
    }
};

exports.autoIncrementId = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const result = await sql.query("SELECT nextval('history_messages_id_seq')");
        const newId = result.rows[0].nextval;

        // 取得 history_messages 表的最大 ID
        // const maxId = await HistoryMessages.max("id");
        // const newId = maxId + 1;

        rsmodel.code = 0;
        rsmodel.data = { newId };
        res.json(rsmodel);
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.checkExpertUrl = async function (req, res) {
    const rsmodel = new responseModel();
    const userId = req.session.userInfo.uid;
    const userNo = req.session.userInfo.user_no;

    const { expertUrl, mode } = JSON.parse(req.body);

    try {
        let botMessages;
        let expert;

        if (mode === "custom") {
            expert = await Expert.findOne({
                where: {
                    url: expertUrl,
                    is_enable: 1,
                },
                order: [["sort_order", "ASC"]], // 加入排序
            });
            if (expert) {
                // 檢查權限
                const accessCheck = await permissionUtils.checkExpertAccess(expert.id, userNo);
                if (!accessCheck.hasAccess) {
                    // 尋找其他可用的專家，排除當前沒權限的專家
                    const availableExpertData = await permissionUtils.findAvailableExpert(userId, userNo, expert.id);

                    if (availableExpertData) {
                        rsmodel.code = 0;
                        rsmodel.message = "您沒有權限訪問此專家，已為您導向可用的專家";
                        rsmodel.data = {
                            roomId: availableExpertData.botMessage.group_id,
                            expertId: availableExpertData.botMessage.expert_id,
                            partner: "bot",
                            nickname: availableExpertData.expert.name,
                            avatar: availableExpertData.expert.avatar,
                            redirected: true,
                        };
                    } else {
                        rsmodel.code = 1;
                        rsmodel.message = accessCheck.message;
                    }
                    res.json(rsmodel);
                    return;
                }

                botMessages = await BotMessages.findOne({
                    where: { expert_id: expert.id, users_id: userId },
                });

                rsmodel.code = 0;
                rsmodel.data = {
                    roomId: botMessages?.group_id || null,
                    expertId: expert.id,
                    nickname: expert.name,
                    avatar: expert.avatar,
                };
            } else {
                rsmodel.code = 1;
                rsmodel.data = { roomId: null };
            }
        } else {
            botMessages =
                (await BotMessages.findOne({
                    where: { group_id: expertUrl, users_id: userId },
                    include: [
                        {
                            model: Expert,
                            required: true,
                            where: {
                                is_enable: 1,
                            },
                        },
                    ],
                    order: [[{ model: Expert }, "sort_order", "ASC"]], // 加入排序
                })) ||
                (await BotMessages.findOne({
                    where: { users_id: userId },
                    include: [
                        {
                            model: Expert,
                            required: true,
                            where: {
                                is_enable: 1,
                            },
                        },
                    ],
                    order: [[{ model: Expert }, "sort_order", "ASC"]], // 加入排序
                }));

            if (botMessages) {
                expert = await Expert.findOne({
                    where: { id: botMessages.expert_id },
                    order: [["sort_order", "ASC"]], // 加入排序
                });

                if (expert) {
                    // 檢查權限

                    const accessCheck = await permissionUtils.checkExpertAccess(expert.id, userNo);
                    if (!accessCheck.hasAccess) {
                        // 尋找其他可用的專家，排除當前沒權限的專家
                        const availableExpertData = await permissionUtils.findAvailableExpert(
                            userId,
                            userNo,
                            expert.id
                        );

                        if (availableExpertData) {
                            rsmodel.code = 0;
                            rsmodel.message = "您沒有權限訪問此專家，已為您導向可用的專家";
                            rsmodel.data = {
                                roomId: availableExpertData.botMessage.group_id,
                                expertId: availableExpertData.botMessage.expert_id,
                                partner: "bot",
                                nickname: availableExpertData.expert.name,
                                avatar: availableExpertData.expert.avatar,
                                redirected: true,
                            };
                        } else {
                            rsmodel.code = 1;
                            rsmodel.message = accessCheck.message;
                        }
                        res.json(rsmodel);
                        return;
                    }

                    rsmodel.code = 0;
                    rsmodel.data = {
                        roomId: botMessages.group_id,
                        expertId: botMessages.expert_id,
                        partner: "bot",
                        nickname: expert.name,
                        avatar: expert.avatar,
                    };
                } else {
                    rsmodel.code = 1;
                    rsmodel.data = { roomId: null };
                }
            } else {
                rsmodel.code = 1;
                rsmodel.data = { roomId: null };
            }
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};
exports.getIconList = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    let rsmodel = new responseModel();
    try {
        const setting = await Settings.findOne({
            where: { key: "popular_tags" },
            attributes: ["value"],
        });

        let popularTags = [];
        if (setting && setting.value) {
            const settingValue = JSON.parse(setting.value?.trim());
            popularTags = settingValue.currentIcons;
        }

        const { expertId } = req.query;
        console.info("bot.getIconList:", req.query);

        const expert = await Expert.findOne({
            where: { id: expertId },
            attributes: ["popular_tags"],
        });

        let iconList = [];
        if (expert && expert.popular_tags) {
            iconList = JSON.parse(expert.popular_tags);
        }

        // 合併 popularTags 和 iconList
        const combinedList = [...popularTags, ...iconList];

        rsmodel.code = 0;
        rsmodel.data = combinedList;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getMinMessageLength = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const minMessageLength = await Settings.findOne({
            where: { key: "min_message_length" },
            attributes: ["value"],
        });

        rsmodel.code = 0;
        rsmodel.data = minMessageLength.value;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};
