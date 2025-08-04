const responseModel = require("../../model/responseModel");
const userMessage = require("../../model/userMessage");
const sql = require("../../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const tipFormatDate = require("../tipFormatData");
const permissionUtils = require("../../utils/permission");

const { filterExpertsByCSCPermission } = require("../../utils/csc-permissionFilter");

// exports.login = async function (req, res) {
//     let rsmodel = new responseModel();
//     try {
//         let { uid, message } = JSON.parse(req.body);
//         let rs = { message: uid + "傳過來的是" + message };
//         rsmodel.code = 0;
//         rsmodel.data = rs;
//     } catch (e) {
//         console.error(e);
//     }
//     res.json(rsmodel);
// };

// exports.messenger = async function (req, res) {
//     let rsmodel = new responseModel();
//     try {
//         let { uid, message } = JSON.parse(req.body);
//         let rs = { message: uid + "傳過來的是" + message };
//         rsmodel.code = 0;
//         rsmodel.data = rs;
//     } catch (e) {
//         console.error(e);
//     }
//     res.json(rsmodel);
// };

// userMessage.setRoomMsg("r001_002", { sender: "p001", message: { data: "嗨 我是鄧世雄", type: "text" } });
// userMessage.setRoomMsg("r001_003", { sender: "p001", message: { data: "嗨 我是鄧世雄", type: "text" } });
// userMessage.setRoomMsg("r001_004", { sender: "p001", message: { data: "嗨 我是鄧世雄", type: "text" } });

// userMessage.setRoomMsg("r002_003", { sender: "p002", message: { data: "嗨 我是Jeason", type: "text" } });
// userMessage.setRoomMsg("r002_004", { sender: "p002", message: { data: "嗨 我是Jeason", type: "text" } });
// userMessage.setRoomMsg("r003_004", { sender: "p003", message: { data: "嗨 我是WillSon", type: "text" } });
/* rs = contactList
                .filter((f) => f.uid !== uid)
                .map((m) => {
                    let roomId;
                    if (parseInt(uid.slice(-3)) > parseInt(m.uid.slice(-3))) {
                        roomId = `r00${parseInt(m.uid.slice(-3))}_00${parseInt(uid.slice(-3))}`;
                    } else {
                        roomId = `r00${parseInt(uid.slice(-3))}_00${parseInt(m.uid.slice(-3))}`;
                    }
                    return { roomId, uid: m.uid, nickname: m.nickname, avatar: m.avatar };
                }); */

// let contactList = [
//     { uid: "316747e9-2f89-4be1-a954-f590a72c10f2", nickname: "鄧世雄", avatar: "https://i.imgur.com/PU1dSFFb.jpg" },
//     { uid: "3b78c6be-3769-43a7-be1a-f01e9f79a80c", nickname: "Jeason", avatar: "https://i.imgur.com/whno75D.jpeg" },
//     { uid: "d089793f-18ff-449d-b711-6196766581c7", nickname: "WillSon", avatar: "https://i.imgur.com/WuBZE.jpeg" },
//     { uid: "45c65dbb-ff45-4ea9-91e8-369402205fd4", nickname: "Allen", avatar: "https://i.imgur.com/aEGNG9D.jpeg" },
// ];

const SSO_TYPE = process.env.SSO_TYPE;

function validateExpertPermission(expertId, userId, permissions) {
    return (
        permissions.chatExperts &&
        permissions.chatExperts[expertId] &&
        permissions.chatExperts[expertId].includes(userId)
    );
}

function filterChatExpertsByPermission(experts, userId, permissions) {
    return experts.filter((expert) => {
        // 如果專家ID不在權限列表中，保留該專家
        if (!permissions.chatExperts || !permissions.chatExperts[expert.expertId]) {
            return true;
        }
        // 如果專家ID在權限列表中，檢查是否有權限
        return validateExpertPermission(expert.expertId, userId, permissions);
    });
}

exports.list = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let uid = req.session.userInfo.uid;
        let userNo = req.session.userInfo.user_no;
        const compNo = req.session.userInfo.comp_no;

        let { isIframe, showExpertIds, hideExpertIds } = req.query;

        let responseData;
        if (uid) {
            let bots = (
                await sql.query(
                    'SELECT a.*, b.group_id AS "roomId", subject FROM expert a LEFT JOIN bot_messages b ON a.id = b.expert_id AND b.users_id = $1 WHERE is_enable = 1 ORDER BY a.sort_order ASC',
                    [uid]
                )
            ).rows;

            if (bots.length > 0) {
                bots = await Promise.all(
                    bots.map(async (bot) => {
                        let roomId = bot.roomId;

                        if (!roomId) {
                            console.log(`專家${bot.name}尚無聊天室，開始建立聊天室...`);

                            const html_json = [];
                            const config_jsonb = [];

                            // 使用 INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING 確保返回的 room ID 實際存在於資料庫中
                            let tempRoomId = uuidv4();
                            let chat = JSON.stringify([]);

                            // 修改為返回 group_id
                            let sqlstr = `
                                INSERT INTO bot_messages(group_id, users_id, subject, chat, expert_id) 
                                VALUES($1, $2, $3, $4, $5)
                                ON CONFLICT (users_id, expert_id) 
                                DO UPDATE SET group_id = bot_messages.group_id 
                                RETURNING group_id`;

                            let sqlparam = [tempRoomId, uid, "New chat", chat, bot.id];
                            let result = await sql.query(sqlstr, sqlparam);
                            roomId = result.rows[0].group_id;

                            // 取得 skill 的 tip
                            sqlstr = "SELECT skill_id FROM expert_skill_mapping WHERE expert_id = $1";
                            sqlparam = [bot.id];
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
                            sqlparam = [bot.id];
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
                                    filteredTipData.forEach((item) => {
                                        item.tip.forEach((tip) => {
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

                            chat = JSON.stringify([]);

                            sqlstr = "UPDATE bot_messages SET chat = $2 WHERE group_id = $1;";
                            sqlparam = [roomId, chat];
                            await sql.query(sqlstr, sqlparam);

                            console.log(`專家${bot.name}聊天室建立完成 !`);
                        }

                        return {
                            roomId: roomId,
                            expertId: bot.id,
                            nickname: bot.name,
                            avatar: bot.avatar,
                            createTime: bot.create_time,
                            identity: "bot",
                        };
                    })
                );

                if (isIframe === "true" && Array.isArray(hideExpertIds) && hideExpertIds.length > 0) {
                    bots = bots.filter((bot) => !hideExpertIds.includes(bot.expertId));
                }

                // AVALoader 會傳 showExpertIds 進來，這邊要過濾掉不在 showExpertIds 裡面的專家，也就是只顯示 showExpertIds 裡面的專家。
                if (isIframe === "true" && Array.isArray(showExpertIds) && showExpertIds.length > 0) {
                    bots = bots.filter((bot) => showExpertIds.includes(bot.expertId));
                }
            }
            responseData = bots;

            const sqlStr = `SELECT value FROM settings WHERE key='knowledge_permission'`;
            const { rows } = await sql.query(sqlStr);
            const knowledgePermission = JSON.parse(rows[0].value);
            //暫用的權限過濾
            if (knowledgePermission) {
                if (SSO_TYPE.toLowerCase() === "csc") {
                    responseData = await filterExpertsByCSCPermission(
                        responseData,
                        compNo,
                        userNo,
                        knowledgePermission
                    );
                } else {
                    // 這裡改為 await
                    responseData = await permissionUtils.filterChatExpertsByPermission(
                        responseData,
                        userNo,
                        knowledgePermission
                    );
                }
                if (responseData.length === 0) {
                    rsmodel.code = 1;
                    rsmodel.message = "目前沒有可用的專家";
                    res.json(rsmodel);
                    return;
                }
            }
        } else {
            responseData = "";
        }

        rsmodel.code = 0;
        rsmodel.data = responseData;
    } catch (e) {
        console.error("An error occurred while retrieving the list of expert chat rooms.", e);
    }
    res.json(rsmodel);
};
exports.createRoom = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let user1Uid = req.session.userInfo.uid;
        let { user2Uid } = JSON.parse(req.body);
        if (!user1Uid || !user2Uid) {
            rsmodel.code = 1;
            rsmodel.message = "有參數為空";
            res.json(rsmodel);
            return;
        }
        let sqlstr = "insert into user_rooms(room_id,user1_uid,user2_uid) values($1,least($2,$3),greatest($2,$3))";
        let uuid = uuidv4();
        let sqlparam = [uuid, user1Uid, user2Uid];
        let rs = (await sql.query(sqlstr, sqlparam)).rowCount;
        if (rs) {
            rsmodel.code = 0;
            rsmodel.data = { roomId: uuid };
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.message = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { roomId, firstTime } = JSON.parse(req.body);
        let addSQL = "";
        if (firstTime) {
            firstTime = new Date(firstTime);
            addSQL = "and create_time<$2";
        }
        // let rs = userMessage.getRoomMsg(roomId);
        let sqlstr = `select from_uid,message,message_type,create_time from user_messages 
                        where room_id = $1 ${addSQL} order by create_time desc limit 50`;
        let sqlparam = [roomId];
        if (firstTime) sqlparam.push(firstTime);
        let rs = (await sql.query(sqlstr, sqlparam)).rows;
        rs = rs.reverse();
        rs = rs.map((m) => {
            return {
                sender: m.from_uid,
                message: {
                    data: m.message,
                    type: m.message_type,
                },
                time: m.create_time,
            };
        });
        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.sendMessage = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let body = JSON.parse(req.body);
        let fromUid = req.session.userInfo.uid;
        let { toUid, roomId, message } = body;
        userMessage.setRoomMsg(roomId, { sender: fromUid, message });
        let sqlstr =
            "insert into user_messages(room_id,from_uid,to_uid,message,message_type) values($1,$2,$3,$4,$5) returning create_time";
        let sqlparam = [roomId, fromUid, toUid, message.data, message.type];
        let rs = await sql.query(sqlstr, sqlparam);
        if (rs.rowCount) {
            rsmodel.code = 0;
            rsmodel.data = { time: rs.rows[0].create_time };
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.sendPicture = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let path = process.env.CHAT_HOST + "/uploads/" + req.files[0].filename;
        rsmodel.data = path;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.chkSyncMsg = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { roomId, lastTime } = JSON.parse(req.body);
        lastTime = new Date(lastTime);
        // console.error(lastTime);
        let sqlstr = "select * from user_messages where room_id = $1 and create_time > $2";

        let sqlparam = [roomId, lastTime];
        let rs = (await sql.query(sqlstr, sqlparam)).rows;
        // console.error(rs[0].create_time);
        // console.error(lastTime.toISOString() == rs[0].create_time.toISOString());
        if (rs.length) {
            rs = rs.filter((f) => f.create_time.toISOString() !== lastTime.toISOString());
        }
        rs = rs.map((m) => {
            return {
                sender: m.from_uid,
                message: {
                    data: m.message,
                    type: m.message_type,
                },
                time: m.create_time,
            };
        });
        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.share = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let fromUid = req.session.userInfo.uid;
        let { toUid, roomId } = req.body;
        let path = process.env.CHAT_HOST + "/uploads/" + req.files[0].filename;
        let message = { data: path, type: "image" };

        let sqlstr =
            "insert into user_messages(room_id,from_uid,to_uid,message,message_type) values($1,$2,$3,$4,$5) returning create_time";
        let sqlparam = [roomId, fromUid, toUid, message.data, message.type];
        let rs = await sql.query(sqlstr, sqlparam);
        if (rs.rowCount) {
            rsmodel.code = 0;
            // rsmodel.data = path;
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
