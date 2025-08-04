const { Writable } = require("stream");
const responseModel = require("../../model/responseModel");
const ModelTokenLog = require("../../orm/schema/model_token_log");
const sql = require("../../db/pgsql");
const axios = require("axios");
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

exports.query = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { message, expert_id, stream } = req.body;

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
            console.error("Error fetching enable cache streaming reply:", error);
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
        if (containsPrisonWord(messageData, globalTextPrisonWords) || containsPrisonWord(messageData, expertTextPrisonWords)) {
            res.write(JSON.stringify({ type: "data" }));
            res.write("</end>");
            res.write("<p>不好意思，我還尚未了解過相關知識，也許你可以換個方式問問題。</p>");
            res.write("</end>");
            res.end();
            return;
        }

        // 處理 "/t" 和 "/tunnel" 命令
        if (JSON.parse(message).type === "text") {
            let msgText = JSON.parse(message).data || "";
            const tunnel_cmd = ["/t ", "/tunnel "];
            tunnel_cmd.forEach((cmd) => {
                if (msgText.startsWith(cmd)) {
                    let input_message = msgText.substring(cmd.length);
                    message = JSON.stringify({ type: "tunnel", input_message: input_message });
                    console.log(message);
                }
            });
        }

        if (JSON.parse(message).type === "tunnel") {
            let msgText = JSON.parse(message).input_message || "";
            if (msgText.startsWith("/e ")) {
                const remainingText = msgText.substring(3).trim();
                if (remainingText.startsWith("/t ")) {
                    let input_message = remainingText.substring(3);
                    // 退出隧道模式並進入新隧道模式
                    res.write(JSON.stringify({ type: "tunnel" }));
                    res.write("</end>");
                    res.write(JSON.stringify({ state: "aborted" }));
                    res.write("</end>");
                    res.write(JSON.stringify({ type: "data" }));
                    res.write("</end>");
                    res.write("<p class='warning'>已中斷申請</p>");
                    res.write("</end>");

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

        let data = "";
        const isJSON = function (s) {
            try {
                return JSON.parse(s);
            } catch (error) {
                return false;
            }
        };

        const writableStream = new Writable({
            write(chunk, encoding, callback) {
                if (stream === "false") {
                    data += chunk.toString();
                } else {
                    slowSend(chunk.toString(), callback);
                }
                callback();
            },
            final: async function (callback) {
                if (stream === "false") {
                    let arr = data.split("</end>");
                    let filteredArr = [];
                    let hmiData = {
                        type: "token_log",
                        data: []
                    };
            
                    for (let i = 0; i < arr.length; i++) {
                        let temp = isJSON(arr[i]);
                        if (temp) {
                            arr[i] = temp;
                            
                            if (arr[i].type === "hmi") {
                                const hmi_id = arr[i + 1];
                                if (!isNaN(hmi_id)) {
                                    try {
                                        const record = await ModelTokenLog.findOne({
                                            where: {
                                                history_message_id: hmi_id
                                            }
                                        });
                                        if (record) {
                                            hmiData.data.push({
                                                prompt_token: record.prompt_token,
                                                completion_token: record.completion_token
                                            });
                                        }
                                    } catch (error) {
                                        console.error("Error fetching model token log:", error);
                                    }
                                    arr.splice(i + 1, 1);
                                }
                                continue;
                            } else if (arr[i].type === "data") {
                                arr[i].data = arr[i + 1];
                                arr.splice(i + 1, 1);
                            } else if (arr[i].type === "source_chunk") {
                                arr[i].data = JSON.parse(arr[i + 1]);
                                arr.splice(i + 1, 1);
                            } else if (arr[i].type === "extra_chunk") {
                                arr[i].data = JSON.parse(arr[i + 1]);
                                arr.splice(i + 1, 1);
                            }
 
                            filteredArr.push(arr[i]);
                        }
                    }

                    filteredArr.push(hmiData);
                    res.json(filteredArr);
                } else {
                    res.end();
                }
                callback();
            }
            
            


        });

        axios
            .post(
                `${process.env.PYTHON_API_HOST}`,
                {
                    message: message,
                    ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
                    expert_id: expert_id,
                },
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                        token: "efa0d936-34de-4c6b-a130-bfbb89957133",
                        Cookie: req.headers.cookie,
                    },
                    responseType: "stream",
                }
            )
            .then((response) => {
                if (response.request.res.responseUrl !== process.env.PYTHON_API_HOST) {
                    res.redirect(response.request.res.responseUrl);
                } else {
                    const isStreaming = isEventStream(response);
                    response.data.pipe(writableStream).on("finish", () => {
                        console.log("Finished sending data");
                    }).on("error", (error) => {
                        console.error("stream error:", error);
                        res.status(500).send("server error");
                    });
                }
            })
            .catch((error) => {
                if (error.response) {
                    console.log("錯誤數據: ", error.response.data);
                    console.log("錯誤狀態碼: ", error.response.status);
                    console.log("錯誤頭部: ", error.response.headers);
                    rsmodel.message = "python api not return 200 status";
                } else if (error.request) {
                    console.log("無響應: ", error.request);
                    rsmodel.message = "python api error request";
                } else {
                    console.dir(error.message);
                    rsmodel.message = "python api error message";
                }
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

function containsPrisonWord(message, prisonWords) {
    return prisonWords.some((word) => message.includes(word));
}

function isEventStream(response) {
    const contentType = response.headers['content-type'];
    return contentType && contentType.includes('text/event-stream');
}

function slowSend(chunk, callback) {
    setTimeout(() => {
        callback(null, chunk);
    }, 100);
}
