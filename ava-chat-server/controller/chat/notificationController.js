const responseModel = require("../../model/responseModel");
const TranslationTasks = require("../../orm/schema/translation_tasks");
const BotMessages = require("../../orm/schema/bot_messages");
const { Op } = require("sequelize");

exports.getUnnotifiedTasks = async (req, res) => {
    const rsmodel = new responseModel();
    try {
        const { user_id } = req.query;

        if (!user_id) throw new Error("Missing user_id");

        // 查出所有未通知且是 completed 的任務
        const completedTasks = await TranslationTasks.findAll({
            attributes: ["id", "room_id", "status", "result_files", "history_message_id"],
            where: {
                user_id,
                is_notified: false,
                status: "completed",
            },
            order: [["create_time", "DESC"]],
        });

        // 查出 failed / error 的任務
        const errorTasks = await TranslationTasks.findAll({
            attributes: ["id", "room_id", "status", "result_files", "history_message_id"],
            where: {
                user_id,
                is_notified: false,
                status: {
                    [Op.in]: ["failed", "error"],
                },
            },
        });

        // 將所有任務 ID 合併用於標記已通知
        const completedTaskIds = completedTasks.map((task) => task.id);
        const errorTaskIds = errorTasks.map((task) => task.id);
        const allTaskIds = [...completedTaskIds, ...errorTaskIds];

        if (allTaskIds.length > 0) {
            // 標記任務為已通知
            await TranslationTasks.update({ is_notified: true }, { where: { id: allTaskIds } });

            // 為每個任務更新 bot_messages 中的聊天內容
            for (const task of [...completedTasks, ...errorTasks]) {
                if (task.room_id && task.history_message_id) {
                    // 依據任務狀態決定新的標籤名稱
                    const newTagName =
                        task.status === "completed"
                            ? "file_translation_loading_success"
                            : "file_translation_loading_failed";

                    // 先獲取對應的 bot_messages 記錄
                    const botMessage = await BotMessages.findOne({
                        where: {
                            group_id: task.room_id,
                            users_id: user_id,
                        },
                    });

                    if (botMessage && botMessage.chat) {
                        // 更新符合條件元素的 tag
                        const updatedChat = botMessage.chat.map((element) => {
                            // 檢查是否是需要更新的元素
                            if (element.sender === "bot" && element.message && Array.isArray(element.message)) {
                                // 複製一份避免直接修改原始數據
                                const updatedElement = JSON.parse(JSON.stringify(element));

                                // 搜尋 message 陣列尋找需要更新的 html_json
                                updatedElement.message = updatedElement.message.map((msg) => {
                                    if (msg.html_json && Array.isArray(msg.html_json)) {
                                        msg.html_json = msg.html_json.map((html) => {
                                            // 檢查 html_json 內部的 history_message_id
                                            if (
                                                html.tag === "file_translation_loading" &&
                                                html.history_message_id === task.history_message_id
                                            ) {
                                                // 修改 tag，根據任務狀態決定新標籤
                                                return { ...html, tag: newTagName };
                                            }
                                            return html;
                                        });
                                    }
                                    return msg;
                                });

                                return updatedElement;
                            }

                            return element;
                        });

                        // 更新 chat 欄位
                        await botMessage.update({ chat: updatedChat });
                    }
                }
            }
        }

        rsmodel.code = 0;
        rsmodel.message = "Tasks retrieved successfully";
        rsmodel.data = {
            tasks: [...completedTasks, ...errorTasks],
        };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = "Error retrieving tasks";
        rsmodel.data = { error: error.message };
    }
    res.json(rsmodel);
};

// 獲取使用者的所有翻譯任務
exports.getTranslationTasks = async (req, res) => {
    const rsmodel = new responseModel();
    try {
        // 從 session 中獲取使用者 ID
        const uid = req.session.userInfo.uid;
        if (!uid) {
            throw new Error("找不到有效的使用者 ID");
        }

        // 查詢用戶所有的翻譯任務
        const tasks = await TranslationTasks.findAll({
            where: {
                user_id: uid,
            },
            order: [["create_time", "DESC"]], // 以創建時間降序排序
        });

        rsmodel.code = 0;
        rsmodel.message = "成功獲取翻譯任務";
        rsmodel.data = {
            translation_tasks: tasks,
        };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = "獲取翻譯任務失敗";
        rsmodel.data = { error: error.message };
    }

    res.json(rsmodel);
};

exports.markTasksAsNotified = async (req, res) => {
    const rsmodel = new responseModel();
    try {
        const { task_ids } = JSON.parse(req.body);

        if (!Array.isArray(task_ids) || task_ids.length === 0) {
            throw new Error("Invalid task_ids");
        }

        await TranslationTasks.update({ is_notified: true }, { where: { id: task_ids } });

        rsmodel.code = 0;
        rsmodel.message = "Tasks marked as notified";
        rsmodel.data = {};
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = "Failed to mark tasks";
        rsmodel.data = { error: error.message };
    }
    res.json(rsmodel);
};

// SSE 有要優化的話再使用
// const sseClients = new Map(); // user_id -> { res, interval }

// exports.sseStream = (req, res) => {
//     const userId = req.query.user_id;
//     if (!userId) return res.status(400).end("Missing user_id");

//     res.set({
//         "Content-Type": "text/event-stream",
//         "Cache-Control": "no-cache",
//         Connection: "keep-alive",
//     });
//     res.flushHeaders();

//     // 啟動小輪詢：每 5 秒查一次該使用者的任務
//     const interval = setInterval(async () => {
//         const tasks = await TranslationTasks.findAll({
//             where: {
//                 user_id: userId,
//                 is_notified: false,
//             },
//             order: [["create_time", "DESC"]],
//         });

//         if (tasks.length > 0) {
//             for (const task of tasks) {
//                 res.write(`data: ${JSON.stringify(task)}\n\n`);

//                 // 推送後立即標記為已通知，避免重複
//                 await TranslationTasks.update({ is_notified: true }, { where: { id: task.id } });
//             }
//         }
//     }, 5000); // 每 5 秒查一次

//     sseClients.set(userId, { res, interval });

//     req.on("close", () => {
//         const client = sseClients.get(userId);
//         if (client) {
//             clearInterval(client.interval);
//             sseClients.delete(userId);
//         }
//     });
// };
