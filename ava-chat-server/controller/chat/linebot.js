const responseModel = require("../../model/responseModel");
const { v4: uuidv4 } = require("uuid");
const sql = require("../../db/pgsql");
const { containsPrisonWord } = require("../../utils/common");
const LoginType = require("../../orm/schema/login_type");
const UserType = require("../../orm/schema/user_type");
const UserLoginType = require("../../orm/schema/user_login_type");
const Users = require("../../orm/schema/users");
const Settings = require("../../orm/schema/settings");
const Expert = require("../../orm/schema/expert");
const Announcement = require("../../orm/schema/announcement");
const UserAcknowledgement = require("../../orm/schema/user_acknowledgement");
const HistoryMessages = require("../../orm/schema/history_messages");
const Feedback = require("../../orm/schema/feedback");
const FeedbackOptions = require("../../orm/schema/feedback_options");
const FeedbackProcess = require("../../orm/schema/feedback_process");
const { redisClient } = require("../../global/redisStore");
const axios = require("axios");
const { isEventStream, createWritableStream } = require("../../utils/stream");
const { Op } = require("sequelize");

const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

const checkExpertAndGetLineSettings = async () => {
    return new Promise(async (resolve, reject) => {
        try {
            // 一次性查詢所有需要的設置
            const settingsResults = await Settings.findAll({
                where: {
                    key: {
                        [Op.in]: ["line_select_expert", "line_settings", "min_message_length"],
                    },
                },
            });

            const lineSelectExpert = settingsResults.find((s) => s.key === "line_select_expert")?.value;
            const lineSettings = settingsResults.find((s) => s.key === "line_settings")?.value;
            const minMessageLength =
                parseInt(settingsResults.find((s) => s.key === "min_message_length")?.value, 10) || 0;

            let expertState;
            const expertArray = await Expert.findAll({ attributes: ["id"] });

            if (lineSelectExpert) {
                const experts = expertArray.filter((expert) => expert.id === lineSelectExpert);
                if (experts.length > 0) {
                    expertState = "exist";
                } else {
                    expertState = "在後台 (linebot設定) 裡設定的專家已經被刪除，請聯絡人員去查看";
                }
            } else {
                expertState = "尚未在後台 (linebot設定) 裡設定專家，請聯絡人員去設定";
            }

            resolve([expertState, JSON.parse(lineSettings), minMessageLength]);
        } catch (error) {
            console.log("Table 'users' may not exist or database not ready. Skipping insert.");
            reject(error.message);
        }
    });
};

const createOrUpdateLineUser = async (profile) => {
    try {
        // 查詢 login_type_id
        const loginType = await LoginType.findOne({
            where: { type_value: "line" },
            attributes: ["id"],
        });
        const login_type_id = loginType?.id;

        // 查詢 user_type_id
        const userType = await UserType.findOne({
            where: { type_value: "member" },
            attributes: ["id"],
        });
        const user_type_id = userType?.id;

        if (!login_type_id || !user_type_id) {
            throw new Error("LoginType or UserType not found");
        }

        // 檢查是否已有此 line user
        const existingUserLoginType = await UserLoginType.findOne({
            where: { auth_id: profile.userId },
            attributes: ["user_id"],
        });

        let uuid;
        if (!existingUserLoginType) {
            // 生成新 UUID 並檢查唯一性
            let exists = true;
            let count = 1;

            while (exists) {
                uuid = uuidv4();
                const existingUser = await Users.findOne({ where: { id: uuid }, attributes: ["id"] });
                if (!existingUser) {
                    exists = false;
                }
                count++;
                if (count > 5) {
                    throw new Error("Failed to generate unique UUID");
                }
            }

            // 創建新 user
            await Users.create({
                id: uuid,
                user_type_id: user_type_id,
                name: profile.displayName,
                avatar: profile.pictureUrl,
            });

            // 創建 user_login_type
            await UserLoginType.create({
                login_type_id: login_type_id,
                user_id: uuid,
                auth_id: profile.userId,
                user_info_json: profile,
            });
        } else {
            uuid = existingUserLoginType.user_id;

            // 查詢現有 user 的名稱和頭像
            const existingUser = await Users.findOne({
                where: { id: uuid },
                attributes: ["name", "avatar"],
            });

            const name = existingUser?.name;
            const avatar = existingUser?.avatar;

            // 如果名稱或頭像有變更，則更新
            if (name !== profile.displayName || avatar !== profile.pictureUrl) {
                try {
                    const [updatedRows] = await Users.update(
                        {
                            name: profile.displayName,
                            avatar: profile.pictureUrl,
                        },
                        {
                            where: { id: uuid },
                            returning: true, // 返回更新後的資料
                        }
                    );

                    if (updatedRows === 0) {
                        console.warn(`未能更新用戶資料 (ID: ${uuid})`);
                    }
                } catch (error) {
                    console.error(`更新用戶資料時發生錯誤: ${error.message}`);
                    // 可以選擇是否要拋出錯誤
                    // throw error;
                }
            }
        }

        // 返回結果
        return {
            id: uuid,
            uid: uuid,
            nickname: profile.displayName,
            avatar: profile.pictureUrl,
            sex: "1",
            user_no: "line",
            login_type: "line",
            user_type: "member",
        };
    } catch (error) {
        console.error("Error in createOrUpdateLineUser:", error.message);
        throw error;
    }
};

exports.setupDataBeforeRequest = async function (req, res) {
    try {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        const { event } = JSON.parse(req.body);

        if (event === "set_up_data_before_ava_request") {
            console.log("set_up_data_before_ava_request");
            try {
                const { profile } = JSON.parse(req.body);
                // const { user_agreed, announcement_data } = await checkUserAgreedAndGetAnnouncementData(profile.userId);
                const key = `line_signature_data:${profile.userId}`;
                const value = await redisClient.get(key);
                if (value) {
                    const { signature } = JSON.parse(value);
                    console.log(`已將 key: ${key} 和 value: ${signature} 取出 Redis`);
                }
                const line_signature_data = JSON.parse(value);
                const [expert_state, line_settings, minMessageLength] = await checkExpertAndGetLineSettings();
                console.log("profile:", profile);
                console.log("expert_state:", expert_state);
                console.log("line_settings:", line_settings);
                console.log("minMessageLength:", minMessageLength);
                return res.json({
                    line_signature_data,
                    expert_state,
                    line_settings,
                    minMessageLength,
                });
            } catch (error) {
                console.error("取出 Redis 發生錯誤:", error);
                return res.json({ line_signature_data: null });
            }
        } else if (event === "save_sessionId_in_redis") {
            console.log("save_sessionId_in_redis");
            try {
                const { profile } = JSON.parse(req.body);
                let rs;
                rs = await createOrUpdateLineUser(profile);
                req.session.userType = "member";
                req.session.userInfo = rs;
                console.log(rs);
                await req.session.save();
            } catch {
                console.error("存取 Redis 發生錯誤:", error);
            }
            return res.send("ok");
        } else if (event === "save_line_signature_data") {
            console.log("save_line_signature_data");
            try {
                const { line_id, signature, salt_index, insert_index } = JSON.parse(req.body);
                const key = `line_signature_data:${line_id}`;
                const value = { signature, salt_index, insert_index };
                const sessionExpiredHour = parseInt(process.env.SESSION_EXPIRED_HOUR) || 23;
                await redisClient.set(key, JSON.stringify(value), {
                    EX: (sessionExpiredHour - 1) * 60 * 60, // 以秒為單位，提早1小時過期(確保比 sessionkey 早過期)
                });
                console.log(`已將 key: ${key} 和 value: ${signature} 存入 Redis`);
            } catch (error) {
                console.error("存取 Redis 發生錯誤:", error);
            }
            return res.send("ok");
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.getLineSettings = async function (req, res) {
    try {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        const settings = await Settings.findOne({ where: { key: "line_settings" } });
        const lineSettings = settings?.value;

        res.json({ lineSettings: JSON.parse(lineSettings) });
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.checkUserAgreeAnnouncement = async function (req, res) {
    try {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        const { line_id, announcement_id } = JSON.parse(req.body);

        const existingUserLoginType = await UserLoginType.findOne({
            where: { auth_id: line_id },
            attributes: ["user_id"],
        });
        const uuid = existingUserLoginType?.user_id;

        const userAcknowledgementData = await UserAcknowledgement.findOne({
            where: { announcement_id: announcement_id, uid: uuid },
            attributes: ["action"],
        });

        let user_agreed;
        if (userAcknowledgementData) {
            if (userAcknowledgementData?.action === "AGREED") {
                user_agreed = true;
            } else {
                user_agreed = null;
            }
        } else {
            user_agreed = null;
        }

        res.json({ user_agreed });
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.saveUserAgreeAnnouncement = async function (req, res) {
    try {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        const forwarded = req.headers["x-forwarded-for"];
        const { line_id, announcement_id } = JSON.parse(req.body);

        const existingUserLoginType = await UserLoginType.findOne({
            where: { auth_id: line_id },
            attributes: ["user_id"],
        });
        const uuid = existingUserLoginType.user_id;

        // 檢查是否已存在記錄
        const existingAcknowledgement = await UserAcknowledgement.findOne({
            where: { announcement_id: announcement_id, uid: uuid },
        });
        console.log("existingAcknowledgement", existingAcknowledgement);
        if (!existingAcknowledgement) {
            await UserAcknowledgement.create({
                announcement_id: announcement_id,
                uid: uuid,
                action: "AGREED",
                ip_address: forwarded,
            });
        }

        res.send("ok");
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.autoIncrementId = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    let rsmodel = new responseModel();
    try {
        const result = await sql.query("SELECT nextval('history_messages_id_seq')");
        const newId = result.rows[0].nextval;

        rsmodel.code = 0;
        rsmodel.data = { newId };
        res.json(rsmodel);
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.avaTextGeneration = async function (req, res) {
    try {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        let { message, stream } = JSON.parse(req.body);

        // linebot 選擇專家
        let expert_id;
        try {
            const lineBotSetting = await Settings.findOne({
                where: { key: "line_select_expert" },
            });

            if (lineBotSetting?.value) {
                expert_id = lineBotSetting.value;
            } else {
                const firstExpert = await Expert.findOne();
                expert_id = firstExpert.id;
            }
        } catch (error) {
            console.error("Error fetching expert settings:", error);
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
        // 取得使用者對話
        let messageData;
        try {
            messageData = JSON.parse(message).data;
        } catch (error) {
            console.error("Error parsing message data:", error);
            res.status(400).json({ error: "Invalid message format" });
            return;
        }

        // 檢查 messageData 的字數是否超過限制
        try {
            if (messageData.length > maxMessageLength) {
                res.status(400).json({
                    code: 1, // 自定義的錯誤代碼
                    message: `很抱歉，您輸入的文字長度已超出系統上限，請簡化內容後再嘗試送出。`,
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
        if (messageData) {
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
        message = JSON.stringify({ ...JSON.parse(message), data: messageData });

        console.log("Updated message data:", messageData);

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
        if (expertTextPrisonWords.length > 0 && containsPrisonWord(messageData, expertTextPrisonWords)) {
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
                    res.write(JSON.stringify({ type: "data" }));
                    res.write("</end>");
                    res.write("<p class='warning'>已中斷申請</p>");
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
            res.write(JSON.stringify({ type: "data" }));
            res.write("</end>");
            res.write("<p class='warning'>已中斷申請</p>");
            res.write("</end>");
            res.end();
            return;
        }

        const forwarded = req.headers["x-forwarded-for"];
        const ip = forwarded ? forwarded.split(",")[0] : req.connection.remoteAddress;

        axios
            .post(
                `${process.env.PYTHON_API_HOST}`,
                {
                    message: message,
                    ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
                    expert_id: expert_id,
                    device: "line",
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
                    res.send("error");
                } else {
                    // console.log("response.data:", response.data);
                    const isStreaming = isEventStream(response);
                    console.log("isStreaming:", isStreaming);
                    console.log("enableCacheStreamingReply:", enableCacheStreamingReply);
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
            });
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.getHistoryMessagesData = async function (req, res) {
    try {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        const { historyMessageId, feedbackName, feedbackOptionsStatus } = req.params;
        const historyMessages = await HistoryMessages.findAll({
            where: { id: historyMessageId },
            attributes: ["id", "input", "output", "users_id", "expert_id"],
        });

        const feedbackOptions = await FeedbackOptions.findAll({
            where: { name: decodeURIComponent(feedbackName), status: decodeURIComponent(feedbackOptionsStatus) },
            attributes: ["id", "status"],
        });

        res.json({ historyMessages: historyMessages[0], feedbackOptions: feedbackOptions[0] });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
};

exports.getFeedbackOptions = async function (req, res) {
    try {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        const { status } = req.params;
        const feedbackOptions = await FeedbackOptions.findAll({
            where: { status: status, is_enable: 1 },
            attributes: ["name"],
        });
        console.log(feedbackOptions);
        res.json({ feedbackOptions: feedbackOptions });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
};

exports.createOrUpdateFeedback = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    let rsmodel = new responseModel();
    try {
        const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress).split(",")[0];
        const data = JSON.parse(req.body);

        console.log("data", data);

        let feedback, feedbackProcess;

        if (data.comment) {
            console.log("linebot/createOrUpdateFeedback/comment");

            // Update existing Feedback
            const [updatedCount] = await FeedbackProcess.update(
                { comment: data.comment },
                {
                    where: { feedback_id: data.feedbackId },
                }
            );

            if (updatedCount === 0) {
                throw new Error(`找不到 feedback_id 為 ${data.feedbackId} 的 FeedbackProcess`);
            }

            rsmodel.code = 0;
            rsmodel.message = "Feedback comment updated successfully";
            return res.json(rsmodel);
        } else if (data.feedbackId && !data.comment) {
            console.log("linebot/createOrUpdateFeedback/feedbackId");

            // 更新 feedback 的 feedbackType
            const [updatedFeedbackCount] = await Feedback.update(
                { feedback_type: data.feedbackType },
                { where: { id: data.feedbackId } }
            );

            // 更新 feedbackProcess 的 feedback_options_ids
            const [updatedProcessCount] = await FeedbackProcess.update(
                { feedback_options_ids: data.feedbackOptionsIds },
                { where: { feedback_id: data.feedbackId } }
            );

            if (updatedFeedbackCount === 0 || updatedProcessCount === 0) {
                throw new Error(`找不到 feedback_id 為 ${data.feedbackId} 的資料`);
            }
            rsmodel.code = 0;
            rsmodel.data = {
                feedback: {
                    id: data.feedbackId,
                },
            };
            rsmodel.message = "Feedback updated successfully";
            return res.json(rsmodel);
        } else {
            // 拿到 historyMessage 的 input (question)
            const historyMessage = await HistoryMessages.findOne({
                where: { id: data.historyMessagesId },
                attributes: ["input"], // Assuming 'input' is the column name you want to retrieve
            });

            // 找不到代表 python 沒有新增這筆資料 拋出錯誤
            if (!historyMessage) {
                throw new Error(`No HistoryMessages found with id ${data.historyMessagesId}`);
            }

            const historyInput = historyMessage.input;

            // Create new Feedback
            feedback = await Feedback.create({
                question: historyInput,
                answer: data.answer,
                status: 0,
                feedback_type: data.feedbackType,
                expert_id: data.expert_id,
                datasets_ids: data.datasetsIds,
                datasource_info: data.datasourceInfo,
                source_chunk_ids: data.sourceChunkIds,
                documents_ids: data.uploadDocumentsIds,
                history_messages_id: data.historyMessagesId,
                ip: ip,
            });

            feedbackProcess = await FeedbackProcess.create({
                feedback_id: feedback.id,
                feedback_options_ids: data.feedbackOptionsIds,
                tags_id: [],
                comment: data.comment,
                user_type: "user",
                user_id: data.user_id,
            });

            if (data.historyMessagesId) {
                const [updatedHistoryCount] = await HistoryMessages.update(
                    { feedback_id: feedback.id },
                    {
                        where: { id: data.historyMessagesId },
                    }
                );

                if (updatedHistoryCount === 0) {
                    console.warn(`No HistoryMessages found with id ${data.historyMessagesId}`);
                }
            }
        }

        // Fetch feedback options with names using ORM
        const feedbackOptions = await FeedbackOptions.findAll({
            where: {
                id: data.feedbackOptionsIds,
            },
            attributes: ["id", "name"],
        });

        // Transform the result to include names
        const feedbackOptionsWithNames = data.feedbackOptionsIds.map((id) => {
            const option = feedbackOptions.find((option) => option.id === id);
            return {
                id: id,
                name: option ? option.name : null,
            };
        });

        rsmodel.data = {
            feedback: feedback.get({ plain: true }),
            feedbackProcess: feedbackProcess.get({ plain: true }),
            feedbackOptionsWithNames,
        };
        rsmodel.success = true;
        rsmodel.message = data.feedbackId ? "Feedback updated successfully" : "Feedback created successfully";
    } catch (error) {
        console.error("Error creating/updating feedback:", error);
        rsmodel.success = false;
        rsmodel.message = "Error creating/updating feedback";
        rsmodel.error = error.message;
    }

    res.json(rsmodel);
};

exports.checkPendingAnnouncements = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        const uid = req.session.userInfo.uid;

        // 查找當前有效的公告
        const announcements = await Announcement.findAll({
            where: {
                status: "PUBLISHED",
            },
            include: [
                {
                    model: UserAcknowledgement,
                    as: "acknowledgments",
                    where: { uid },
                    required: false,
                },
            ],
        });

        console.log("announcementsannouncements", announcements);

        // 過濾出使用者尚未確認的公告
        const pendingAnnouncements = announcements.filter(
            (ann) =>
                !ann.acknowledgments.length || (ann.require_agreement && ann.acknowledgments[0].action !== "AGREED")
        );

        rsmodel.code = 0;
        rsmodel.announcements = pendingAnnouncements.map((ann) => ({
            id: ann.id,
            title: ann.title,
            content: ann.content,
            type: ann.type,
            status: ann.status,
            require_agreement: ann.require_agreement,
        }));
    } catch (error) {
        console.error("Error checking pending announcements:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.checkUpdateFeedback = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    let rsmodel = new responseModel();
    try {
        const { feedbackId } = JSON.parse(req.body);

        // 使用 FeedbackProcess 模型查詢指定 feedback_id 的評論
        const result =
            (await FeedbackProcess.findOne({
                where: {
                    feedback_id: feedbackId,
                    comment: {
                        [Op.or]: [null, ""], // 檢查 comment 是否為 null 或空字串
                    },
                },
            })) !== null; // 轉換為布林值

        rsmodel.code = 0;
        rsmodel.data = result;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getFeedbackType = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    let rsmodel = new responseModel();
    try {
        const { feedback_id } = req.params;

        const feedbackType = await Feedback.findOne({
            where: { id: feedback_id },
            attributes: ["feedback_type"],
        });

        if (feedbackType) {
            rsmodel.code = 0;
            rsmodel.data = feedbackType.feedback_type;
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Feedback not found";
        }
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.cancelFeedback = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    let rsmodel = new responseModel();
    try {
        const { feedback_id } = JSON.parse(req.body);

        const historyMessages = await HistoryMessages.findAll({
            where: { feedback_id: feedback_id },
            attributes: ["id"],
        });

        // 獲取所有符合條件的 history_messages id
        const historyMessageIds = historyMessages.map((row) => row.id);

        rsmodel.code = 0;
        rsmodel.message = "Feedback cancelled successfully";
        rsmodel.data = { historyMessageIds };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};
