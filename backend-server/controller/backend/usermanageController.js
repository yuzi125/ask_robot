const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const logRouteDetails = require("../routeNameLog");
const { transformResults, transformResultsByExpertIdVersion, decodeUnicode } = require("../../utils/common");
const HistoryMessage = require("../../orm/schema/history_messages");
const User = require("../../orm/schema/users");
const Expert = require("../../orm/schema/expert");
const UserLoginType = require("../../orm/schema/user_login_type");
const UserType = require("../../orm/schema/user_type");
const { Op, fn, col, literal, QueryTypes } = require("sequelize");
const sequelize = require("../../orm/sequelize");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

exports.getUsers = async function (req, res) {
    logRouteDetails("usermanageController.getUsers", req);
    let rsmodel = new responseModel();
    try {
        let { user_type, user_name, start_time, end_time, last_user_time } = req.query;
        console.info("usermanageController.getUsers:", req.query);
        if (start_time) {
            start_time = new Date(start_time);
        }
        if (end_time) {
            end_time = new Date(end_time);
            end_time.setDate(end_time.getDate() + 1);
        }
        if (start_time && end_time && start_time > end_time) {
            console.error("起始時間大於結束時間");
            rsmodel.message = "起始時間大於結束時間";
            return res.json(rsmodel);
        }
        let rs;

        rs = await sql.query("select id from user_type where type_value = $1", [user_type]);
        const user_type_id = rs.rows[0]?.id;

        let whereClause = "";
        let params = [user_type_id];
        let placeholder = 1;
        if (user_name?.trim()) {
            placeholder++;
            whereClause += " and a.name like $" + placeholder;
            params.push(`%${user_name}%`);
        }
        rs = await sql.query(
            "select a.id,a.create_time,a.user_type_id,a.is_enable,a.name,a.avatar,a.sex,a.create_time,a.update_time, \
                        b.group_id,b.expert_id,c.name expert_name,c.avatar expert_avatar,d.auth_id \
                        from users a \
                        left join bot_messages b on a.id = b.users_id \
                        left join expert c on b.expert_id = c.id \
                        left join user_login_type d on a.id = d.user_id\
                        where a.user_type_id = $1" + whereClause,
            params
        );
        rs = rs.rows.filter((f) => f.group_id && f.expert_id);
        // console.log(rs);
        // console.log(new Date(last_user_time).getTime() === rs[0].create_time.getTime());
        // rs = rs.filter((f) => f.create_time.getTime() !== new Date(last_user_time).getTime());
        // console.log(rs);

        let users = {};

        const filterRangeTime = function (chat) {
            if (chat.length === 0) return;
            if (start_time && end_time) {
                //只要有一個大於start_time及小於end_time 則回傳true
                return chat.findIndex((f) => new Date(f.time) > start_time && new Date(f.time) < end_time) !== -1;
            } else if (start_time) {
                //只要有一個大於start_time 則回傳true
                return chat.findIndex((f) => new Date(f.time) > start_time) !== -1;
            } else if (end_time) {
                //只要有一個小於end_time 則回傳true
                return chat.findIndex((f) => new Date(f.time) < end_time) !== -1;
            } else {
                //沒有設條件，全搜
                return true;
            }
        };
        for (let i = 0; i < rs.length; i++) {
            let item = rs[i];
            if (!filterRangeTime(item)) continue;
            if (users[item.id] === undefined) {
                users[item.id] = {
                    id: item.id,
                    avatar: item.avatar,
                    auth_id: item.auth_id,
                    user_type_id: item.user_type_id,
                    is_enable: item.is_enable,
                    name: item.name,
                    avatar: item.avatar,
                    sex: item.sex,
                    create_time: item.create_time,
                    update_time: item.update_time,
                    roomInfo: [
                        {
                            group_id: item.group_id,
                            expert_id: item.expert_id,
                            expert_name: item.expert_name,
                            expert_avatar: item.expert_avatar,
                        },
                    ],
                };
            } else {
                users[item.id].roomInfo.push({
                    group_id: item.group_id,
                    expert_id: item.expert_id,
                    expert_name: item.expert_name,
                    expert_avatar: item.expert_avatar,
                });
            }
        }
        users = Object.values(users);
        // if (last_user_time) {
        //     users = users.filter((f) => f.create_time > parseInt(last_user_time));
        // }
        // users = users.slice(0, 2);
        rsmodel.data = { users };
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getUserMessages = async function (req, res) {
    logRouteDetails("usermanageController.getUserMessages", req);
    let rsmodel = new responseModel();
    try {
        let { user_id, room_id, start_time, end_time, last_msg_time } = req.query;
        console.info("usermanageController.getUserMessages:", req.query);
        let rs;
        rs = await sql.query("select chat from bot_messages where users_id = $1 and group_id = $2", [user_id, room_id]);
        rs = rs.rows[0];
        if (start_time && end_time) {
            if (new Date(start_time) > new Date(end_time)) {
                console.error("起始時間大於結束時間");
                rsmodel.message = "起始時間大於結束時間";
                return res.json(rsmodel);
            }
        }
        if (start_time) {
            start_time = new Date(start_time);
            rs.chat = rs.chat.filter((f) => new Date(f.time) >= start_time);
        }
        if (end_time) {
            end_time = new Date(end_time);
            end_time.setDate(end_time.getDate() + 1);
            rs.chat = rs.chat.filter((f) => f.time < end_time);
        }

        if (last_msg_time) {
            rs.chat = rs.chat.filter((f) => f.time > parseInt(last_msg_time));
        }
        rs.chat = rs.chat.slice(0, 10);
        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getUserType = async function (req, res) {
    logRouteDetails("usermanageController.getUserType", req);
    let rsmodel = new responseModel();
    try {
        let rs = await sql.query("select * from user_type");
        rs = rs.rows;
        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getUsersWithExperts = async function (req, res) {
    logRouteDetails("usermanageController.getUsersWithExperts", req);
    let rsmodel = new responseModel();
    try {
        let { userType, startDate, endDate, enabledDeleteExpert, page, pageSize, searchQuery } = req.query;

        if (userType === "遊客") {
            userType = "guest";
        }

        // 取得 user_type_id
        const userTypeRecord = await UserType.findOne({
            where: { type_value: userType },
        });
        if (!userTypeRecord) {
            throw new Error("User type not found");
        }
        const user_type_id = userTypeRecord.id;

        // 查詢符合條件且有與專家對話的使用者 ID
        const userIdsWithExpertMessages = await HistoryMessage.findAll({
            where: {
                expert_id: { [Op.ne]: null }, // 必須有專家對話
                create_time: {
                    ...(startDate && { [Op.gte]: startDate }),
                    ...(endDate && { [Op.lt]: dayjs(endDate).endOf("day").format() }),
                },
            },
            attributes: ["users_id"],
            group: ["users_id"],
        }).then((rows) => rows.map((row) => row.users_id));

        if (userIdsWithExpertMessages.length === 0) {
            rsmodel.data = {
                users: [],
                total: 0,
                page: parseInt(page),
                pageSize: parseInt(pageSize),
            };
            rsmodel.code = 0;
            return res.json(rsmodel);
        }

        // 使用者的基本條件
        const userConditions = {
            id: { [Op.in]: userIdsWithExpertMessages }, // 必須有與專家對話的使用者
            user_type_id,
            ...(searchQuery && {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${searchQuery}%` } },
                    { id: { [Op.in]: await getUserIdsByAuthId(searchQuery) } },
                ],
            }),
        };

        const allUsers = await User.findAll({
            where: userConditions,
            attributes: ["id", "user_type_id", "is_enable", "name", "avatar", "sex", "create_time", "update_time"],
            order: [["id", "ASC"]],
        });

        const userIds = allUsers.map((user) => user.id);

        // 查詢歷史訊息
        const historyMessages = await HistoryMessage.findAll({
            where: {
                users_id: { [Op.in]: userIds },
                expert_id: { [Op.ne]: null }, // 必須有專家對話
                ...(startDate && { create_time: { [Op.gte]: startDate } }),
                ...(endDate && {
                    create_time: { [Op.lt]: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000) },
                }),
            },
            attributes: ["users_id", "expert_id", [fn("MAX", col("create_time")), "last_message_time"]],
            group: ["users_id", "expert_id"],
        });

        const expertIds = historyMessages.map((msg) => msg.expert_id).filter(Boolean);

        // 查詢專家
        const expertConditions = {
            id: { [Op.in]: expertIds },
        };

        if (enabledDeleteExpert === "false") {
            expertConditions.is_enable = 1;
        }

        const experts = await Expert.findAll({
            where: expertConditions,
            attributes: ["id", "name", "avatar", "is_enable"],
        });

        const userLoginTypes = await UserLoginType.findAll({
            where: { user_id: { [Op.in]: userIds } },
            attributes: ["user_id", "auth_id"],
        });

        const usersMap = new Map();
        allUsers.forEach((user) => {
            const authId = userLoginTypes.find((login) => login.user_id === user.id)?.auth_id || null;

            usersMap.set(user.id, {
                id: user.id,
                user_type_id: user.user_type_id,
                is_enable: user.is_enable,
                name: user.name,
                auth_id: authId,
                create_time: user.create_time,
                update_time: user.update_time,
                experts: [],
            });
        });

        historyMessages.forEach((msg) => {
            const user = usersMap.get(msg.users_id);
            if (!user) return;

            const expert = experts.find((exp) => exp.id === msg.expert_id);
            if (expert) {
                user.experts.push({
                    expert_id: expert.id,
                    expert_name: expert.name,
                    expert_avatar: expert.avatar,
                    expert_is_enable: expert.is_enable,
                    last_message_time: msg.dataValues.last_message_time,
                });
            }
        });

        const filteredUsers = Array.from(usersMap.values()).filter((user) => user.experts.length > 0);

        // 進行分頁
        const total = filteredUsers.length;
        const offset = (page - 1) * pageSize;
        const paginatedUsers = filteredUsers.slice(offset, offset + parseInt(pageSize));

        rsmodel.data = {
            users: paginatedUsers,
            total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
        };
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = e.message;
    }
    res.json(rsmodel);
};

async function getUserIdsByAuthId(searchQuery) {
    const loginTypes = await UserLoginType.findAll({
        where: { auth_id: { [Op.iLike]: `%${searchQuery}%` } },
        attributes: ["user_id"],
    });
    return loginTypes.map((login) => login.user_id);
}

exports.getUserExpertChat = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { userId, expertId, page, pageSize, startDate, endDate, searchQuery } = req.query;

        // 建立基礎查詢條件
        const whereConditions = {
            users_id: userId,
            expert_id: expertId,
        };

        let endTime;
        // 添加日期條件
        if (startDate || endDate) {
            whereConditions.create_time = {};
            if (startDate) {
                whereConditions.create_time[Op.gte] = startDate;
            }
            if (endDate) {
                // 搜尋結束時間設定為結束日的23:59:59
                endTime = dayjs(endDate).endOf("day").format();
                whereConditions.create_time[Op.lt] = endTime;
            }
        }

        // 添加搜尋條件
        if (searchQuery) {
            whereConditions[Op.or] = [
                {
                    input: {
                        [Op.iLike]: `%${searchQuery}%`,
                    },
                },
                literal(`output::text ILIKE '%${searchQuery}%'`),
            ];
        }

        // 計算總筆數
        const total = await HistoryMessage.count({
            where: whereConditions,
        });

        // 分頁查詢
        const offset = (page - 1) * pageSize;

        const replacements = {
            userId,
            expertId,
            startDate: startDate || null,
            endDate: endTime || null,
            searchQuery: searchQuery ? `%${searchQuery.toLowerCase()}%` : null,
            limit: parseInt(pageSize),
            offset,
        };

        const result = await sequelize.query(
            `
                SELECT 
                    hm.id as history_message_id,
                    hm.input,
                    hm.output,
                    hm.type,
                    hm.create_time as message_create_time,
                    u.id as user_id,
                    u.name as user_name,
                    e.id as expert_id,
                    e.name as expert_name
                FROM history_messages hm
                JOIN users u ON hm.users_id = u.id
                JOIN expert e ON hm.expert_id = e.id
                WHERE hm.users_id = :userId 
                AND hm.expert_id = :expertId
                ${startDate ? "AND hm.create_time >= :startDate" : ""}
                ${endDate ? "AND hm.create_time < :endDate" : ""}
                ${
                    searchQuery
                        ? "AND (LOWER(hm.input) LIKE :searchQuery OR LOWER(hm.output::text) LIKE :searchQuery)"
                        : ""
                }
                ORDER BY hm.create_time DESC
                LIMIT :limit OFFSET :offset
            `,
            {
                replacements,
                type: QueryTypes.SELECT,
            }
        );

        rsmodel.data = {
            chatHistory: result.map((row) => ({
                ...row,
                output: decodeUnicode(row.output),
            })),
            total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
        };
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = e.message;
    }
    res.json(rsmodel);
};

exports.getUserExpertChatDates = async function (req, res) {
    logRouteDetails("usermanageController.getUserExpertChatDates", req);
    let rsmodel = new responseModel();
    try {
        const { userId, expertId, startDate, endDate, searchQuery } = req.query;

        // 建立 where 條件
        const whereConditions = {
            users_id: userId,
            expert_id: expertId,
        };

        // 添加日期條件
        if (startDate || endDate) {
            whereConditions.create_time = {};
            if (startDate) {
                whereConditions.create_time[Op.gte] = startDate;
            }
            if (endDate) {
                // 搜尋結束時間設定為結束日的23:59:59
                whereConditions.create_time[Op.lt] = dayjs(endDate).endOf("day").format();
            }
        }

        // 添加搜尋條件
        if (searchQuery) {
            whereConditions[Op.or] = [
                {
                    input: {
                        [Op.iLike]: `%${searchQuery}%`,
                    },
                },
                literal(`output::text ILIKE '%${searchQuery}%'`), // 因為 output 是 JSONB
            ];
        }

        const result = await HistoryMessage.findAll({
            attributes: [
                [fn("DATE", col("create_time")), "date"],
                [fn("COUNT", "*"), "count"],
            ],
            where: whereConditions,
            group: [fn("DATE", col("create_time"))],
            order: [[fn("DATE", col("create_time")), "DESC"]],
            raw: true,
        });

        rsmodel.data = result.map((row) => ({
            date: row.date,
            count: parseInt(row.count),
        }));
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = e.message;
    }
    res.json(rsmodel);
};

exports.getFiltedExpertChat = async function (req, res) {
    logRouteDetails("usermanageController.getFiltedExpertChat", req);
    let rsmodel = new responseModel();
    try {
        let { expertId, startTime, endTime, date, page, itemsPerPage, chatType, userType, userIds, searchQuery } =
            JSON.parse(req.body);
        console.info("usermanageController.getFiltedExpertChat:", req.body);

        userType = userType || [];
        chatType = chatType || [];
        userIds = userIds || [];

        if (date && date !== "All") {
            startTime = dayjs(date).startOf("day").format();
            endTime = dayjs(date).endOf("day").format();
        } else {
            startTime = dayjs(startTime).tz("Asia/Taipei").format();
            endTime = dayjs(endTime).tz("Asia/Taipei").format();
        }

        let params = [expertId, startTime, endTime, chatType, userType, itemsPerPage, page, searchQuery];

        let queryStr = `WITH filtered_messages AS (
                SELECT 
                    hm.id, 
                    hm.input, 
                    hm.output, 
                    hm.users_id AS user_id, 
                    hm.type, 
                    hm.create_time, 
                    u.user_type_id, 
                    u.name
                FROM 
                    history_messages hm
                LEFT JOIN 
                    users u ON hm.users_id = u.id
                WHERE 
                    hm.expert_id = $1
                    AND hm.create_time >= $2
                    AND hm.create_time < $3
                    AND hm.type = ANY($4)
                    AND u.user_type_id = ANY($5)
                    AND (LOWER(hm.input) LIKE LOWER('%' || COALESCE($8, '') || '%'))
            )
            SELECT 
                (SELECT json_agg(
                    DISTINCT jsonb_build_object(
                        'id', fm.user_id,
                        'name', fm.name,
                        'user_type_id', fm.user_type_id
                    )
                ) FROM filtered_messages fm) AS users_data,
                (SELECT COUNT(*) FROM filtered_messages) AS total_chats, 
                (SELECT json_agg(t) 
                 FROM (
                     SELECT * FROM filtered_messages 
                     ORDER BY create_time DESC 
                     LIMIT $6 
                     OFFSET (($7 - 1) * $6)
                 ) t
                ) AS chats_data,
                COALESCE(
                    (SELECT json_agg(
                        jsonb_build_object(
                            'date', d.date,
                            'chatNumber', d.chat_number
                        )
                    ) 
                     FROM (
                         SELECT 
                             COUNT(*) AS chat_number, 
                             TO_CHAR(create_time, 'YYYY-MM-DD') AS date
                         FROM 
                             filtered_messages 
                         GROUP BY 
                             date
                         ORDER BY 
                             date DESC
                     ) d
                    ), '[]'::json
                ) AS dates_data;`;

        // 如果有給userIds，不用user_type_id查詢；改成直接用user_id查詢
        if (userIds.length > 0) {
            params[4] = userIds;
            queryStr = queryStr.replace("AND u.user_type_id = ANY($5)", "AND hm.users_id = ANY($5)");
        }

        let rs = await sql.query(queryStr, params);

        const result = {
            chats_data: rs.rows[0].chats_data || [],
            total_chats: rs.rows[0].total_chats || 0,
            dates_data: rs.rows[0].dates_data || [],
            users_data: rs.rows[0].users_data || [],
        };

        rsmodel.data = result;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = e.message;
    }
    res.json(rsmodel);
};
