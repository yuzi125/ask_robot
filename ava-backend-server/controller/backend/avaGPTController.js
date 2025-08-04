const responseModel = require("../../model/responseModel");
const mongoose = require("mongoose");
const User = require("../../odm/schema/user");
const Conversation = require("../../odm/schema/convo");
const Message = require("../../odm/schema/message");
const Share = require("../../odm/schema/share");
const Transaction = require("../../odm/schema/transaction");
const Balance = require("../../odm/schema/balance");
const File = require("../../odm/schema/file");

/**
 * 獲取在特定時間範圍內有對話的使用者列表
 */
exports.getUsersWithConversations = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { startDate, endDate, limit = 10, page = 1, searchQuery = "" } = req.query;

        // console.log("查詢參數:", { startDate, endDate, limit, page, searchQuery });

        // 計算分頁
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pageSize = parseInt(limit);

        // 建立基本的 match 條件
        let matchCondition = {};

        // 如果有提供時間範圍，則加入時間條件
        if (startDate && endDate) {
            const startDateTime = new Date(startDate);
            const endDateTime = new Date(endDate);

            // console.log("處理後的日期範圍:", {
            //     startDateTime: startDateTime.toISOString(),
            //     endDateTime: endDateTime.toISOString(),
            // });

            matchCondition.updatedAt = {
                $gte: startDateTime,
                $lte: endDateTime,
            };
        }

        // 查詢在指定時間範圍內有對話的使用者
        const usersWithConversations = await Conversation.aggregate([
            {
                $match: matchCondition,
            },
            {
                $lookup: {
                    from: "messages",
                    localField: "messages",
                    foreignField: "_id",
                    as: "messageDetails",
                },
            },
            {
                $addFields: {
                    userMessagesCount: {
                        $size: {
                            $filter: {
                                input: "$messageDetails",
                                cond: { $eq: ["$$this.sender", "User"] },
                            },
                        },
                    },
                },
            },
            {
                $group: {
                    _id: "$user",
                    lastConversation: { $max: "$updatedAt" },
                    conversationCount: { $sum: 1 },
                    totalMessagesCount: { $sum: "$userMessagesCount" }, // 只計算 User 發送的訊息
                },
            },
            {
                $sort: { totalMessagesCount: -1 }, // 按使用者訊息數量降序排序
            },
        ]);

        // 獲取這些使用者的詳細資訊
        const userIds = usersWithConversations.map((item) => {
            try {
                return mongoose.Types.ObjectId(item._id);
            } catch (error) {
                return item._id;
            }
        });

        let userQuery = { _id: { $in: userIds } };

        // 添加搜尋條件
        if (searchQuery) {
            userQuery.$or = [
                { name: { $regex: searchQuery, $options: "i" } },
                { email: { $regex: searchQuery, $options: "i" } },
                { username: { $regex: searchQuery, $options: "i" } },
            ];
        }

        // 先獲取總數
        const totalUsers = await User.countDocuments(userQuery);

        // 再獲取分頁資料，但要保持原有的排序
        const users = await User.find(userQuery).lean();

        // 建立使用者對應表
        const userMap = {};
        users.forEach((user) => {
            userMap[user._id.toString()] = user;
        });

        // 按照原始聚合的順序重新組織結果，並應用搜尋過濾和分頁
        let filteredResults = usersWithConversations
            .map((conversationStat) => {
                const user = userMap[conversationStat._id.toString()];
                if (!user) return null;

                // 如果有搜尋條件，檢查是否符合
                if (searchQuery && searchQuery.trim() !== "") {
                    const query = searchQuery.toLowerCase();
                    const matchesSearch =
                        (user.name && user.name.toLowerCase().includes(query)) ||
                        (user.email && user.email.toLowerCase().includes(query)) ||
                        (user.username && user.username.toLowerCase().includes(query));
                    if (!matchesSearch) return null;
                }

                return {
                    userId: user._id,
                    name: user.name || "未知",
                    username: user.username || "未知",
                    email: user.email || "未知",
                    lastConversation: conversationStat.lastConversation,
                    conversationCount: conversationStat.conversationCount,
                    totalMessagesCount: conversationStat.totalMessagesCount || 0,
                };
            })
            .filter(Boolean); // 移除 null 值

        // 重新計算總數（考慮搜尋條件）
        const filteredTotal = filteredResults.length;

        // 應用分頁
        const result = filteredResults.slice(skip, skip + pageSize);

        rsmodel.code = 200;
        rsmodel.message = "成功獲取使用者列表";
        rsmodel.data = {
            users: result,
            total: filteredTotal,
            page: parseInt(page),
            pageSize: pageSize,
            totalPages: Math.ceil(filteredTotal / pageSize),
        };
    } catch (e) {
        console.error("獲取使用者列表時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "獲取使用者列表失敗: " + e.message;
    }
    res.json(rsmodel);
};

/**
 * 獲取特定使用者的對話列表
 */
exports.getUserConversations = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { userId, limit = 10, page = 1, searchQuery = "", startDate, endDate } = req.query;

        if (!userId) {
            rsmodel.code = 400;
            rsmodel.message = "使用者ID為必填參數";
            return res.json(rsmodel);
        }

        // 計算分頁
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pageSize = parseInt(limit);

        // 建立查詢條件
        let query = { user: userId };

        // 如果有提供時間範圍，則加入時間條件
        if (startDate && endDate) {
            const startDateTime = new Date(startDate);
            const endDateTime = new Date(endDate);

            query.updatedAt = {
                $gte: startDateTime,
                $lte: endDateTime,
            };
        }

        // 添加搜尋條件
        if (searchQuery && searchQuery.trim() !== "") {
            query.title = { $regex: searchQuery, $options: "i" };
        }

        // 先獲取總數
        const totalConversations = await Conversation.countDocuments(query);

        // 獲取分頁的對話列表
        const conversations = await Conversation.find(query).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).lean();

        // 獲取使用者資訊
        let userQuery;
        try {
            userQuery = { _id: mongoose.Types.ObjectId(userId) };
        } catch (error) {
            userQuery = { _id: userId };
        }

        const userInfo = await User.findOne(userQuery).lean();

        rsmodel.code = 200;
        rsmodel.message = "成功獲取對話列表";
        rsmodel.data = {
            conversations,
            total: totalConversations,
            page: parseInt(page),
            pageSize: pageSize,
            totalPages: Math.ceil(totalConversations / pageSize),
            userInfo: userInfo
                ? {
                      userId: userInfo._id,
                      name: userInfo.name || "未知",
                      username: userInfo.username || "未知",
                      email: userInfo.email || "未知",
                  }
                : null,
        };
    } catch (e) {
        console.error(e);
        rsmodel.code = 500;
        rsmodel.message = "獲取對話列表失敗";
    }
    res.json(rsmodel);
};

/**
 * 獲取特定對話的所有訊息
 */
exports.getConversationMessages = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { userId, conversationId, limit = 10, page = 1, searchQuery = "", startDate, endDate } = req.query;

        if (!userId || !conversationId) {
            rsmodel.code = 400;
            rsmodel.message = "使用者ID和對話ID為必填參數";
            return res.json(rsmodel);
        }

        // 計算分頁
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pageSize = parseInt(limit);

        // 建立查詢條件
        let query = { user: userId, conversationId };

        // 添加日期範圍條件
        if (startDate && endDate) {
            const startDateTime = new Date(startDate);
            const endDateTime = new Date(endDate);

            query.createdAt = {
                $gte: startDateTime,
                $lte: endDateTime,
            };
        }

        // 添加搜尋條件
        if (searchQuery && searchQuery.trim() !== "") {
            query.$or = [
                // 搜尋主要的 text 欄位
                { text: { $regex: searchQuery, $options: "i" } },
                // 搜尋 content 陣列中的 text
                {
                    content: {
                        $elemMatch: {
                            type: "text",
                            text: { $regex: searchQuery, $options: "i" },
                        },
                    },
                },
            ];
        }

        // 先獲取總數
        const totalMessages = await Message.countDocuments(query);

        // 獲取分頁的訊息
        const messages = await Message.find(query).sort({ createdAt: 1 }).skip(skip).limit(pageSize).lean();

        rsmodel.code = 200;
        rsmodel.message = "成功獲取對話訊息";
        rsmodel.data = {
            messages,
            total: totalMessages,
            page: parseInt(page),
            pageSize: pageSize,
            totalPages: Math.ceil(totalMessages / pageSize),
        };
    } catch (e) {
        console.error(e);
        rsmodel.code = 500;
        rsmodel.message = "獲取對話訊息失敗";
    }
    res.json(rsmodel);
};

/**
 * 獲取每日訊息統計
 */
exports.getMessageStatistics = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            rsmodel.code = 400;
            rsmodel.message = "開始日期和結束日期為必填參數";
            return res.json(rsmodel);
        }

        // 處理時區問題 - 將日期轉換為UTC並調整時間範圍
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);

        endDateTime.setHours(23, 59, 59, 999);

        // console.log("處理後的日期範圍:", {
        //     startDateTime: startDateTime.toISOString(),
        //     endDateTime: endDateTime.toISOString(),
        // });

        // 檢查資料庫總記錄數，用於console
        const totalCount = await Message.countDocuments({});
        // console.log(`資料庫中總共有 ${totalCount} 條訊息記錄`);

        // 獲取時間範圍內的記錄數，用於console
        const timeRangeCount = await Message.countDocuments({
            createdAt: {
                $gte: startDateTime,
                $lte: endDateTime,
            },
        });
        // console.log(`指定時間範圍內有 ${timeRangeCount} 條訊息記錄`);

        // 單獨檢查今天的數據（服務器UTC時間）
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const todayCount = await Message.countDocuments({
            createdAt: {
                $gte: todayStart,
                $lte: todayEnd,
            },
        });
        // console.log(
        //     `今天(UTC時間 ${todayStart.toISOString()} 到 ${todayEnd.toISOString()})有 ${todayCount} 條訊息記錄`
        // );

        // 檢查今天的數據（台灣時間 UTC+8）
        const tzOffset = 8 * 60 * 60 * 1000; // 台灣時區 UTC+8，轉換為毫秒
        const twTodayStart = new Date(todayStart.getTime() - tzOffset);
        const twTodayEnd = new Date(todayEnd.getTime() - tzOffset);

        const twTodayCount = await Message.countDocuments({
            createdAt: {
                $gte: twTodayStart,
                $lte: twTodayEnd,
            },
        });
        // console.log(
        //     `今天(台灣時間 ${twTodayStart.toISOString()} 到 ${twTodayEnd.toISOString()})有 ${twTodayCount} 條訊息記錄`
        // );

        // 聚合查詢每日消息數 - 使用 $addFields 做時區調整
        const pipeline = [
            {
                $match: {
                    createdAt: {
                        $gte: startDateTime,
                        $lte: endDateTime,
                    },
                },
            },
            {
                $addFields: {
                    // 調整為台灣時間 (UTC+8)
                    localDate: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt",
                            timezone: "+08:00", // 台灣時區
                        },
                    },
                },
            },
            {
                $group: {
                    _id: "$localDate",
                    count: { $sum: 1 },
                    userMessageCount: {
                        $sum: { $cond: [{ $eq: ["$isCreatedByUser", true] }, 1, 0] },
                    },
                    botMessageCount: {
                        $sum: { $cond: [{ $eq: ["$isCreatedByUser", false] }, 1, 0] },
                    },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ];

        // 執行聚合查詢
        const dailyStatistics = await Message.aggregate(pipeline);
        // console.log(`聚合查詢結果包含 ${dailyStatistics.length} 天的數據`);
        // console.log("聚合查詢結果:", JSON.stringify(dailyStatistics, null, 2));

        // 計算總計數
        let totalMessages = 0;
        let totalUserMessages = 0;
        let totalBotMessages = 0;

        dailyStatistics.forEach((day) => {
            totalMessages += day.count;
            totalUserMessages += day.userMessageCount;
            totalBotMessages += day.botMessageCount;
        });

        // console.log(
        //     `聚合統計總計: 總訊息 ${totalMessages}, 使用者訊息 ${totalUserMessages}, 機器人訊息 ${totalBotMessages}`
        // );

        // 填充缺失的日期
        const allDates = [];
        const currentDate = new Date(startDateTime);
        while (currentDate <= endDateTime) {
            // 轉換為台灣時間日期格式 (UTC+8)
            const localDate = new Date(currentDate.getTime());
            localDate.setHours(localDate.getHours() + 8);
            const dateStr = localDate.toISOString().split("T")[0];

            allDates.push(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // 將數據轉換為前端所需格式
        const result = allDates.map((date) => {
            const existingData = dailyStatistics.find((item) => item._id === date);
            return {
                date: date,
                count: existingData ? existingData.count : 0,
                userMessageCount: existingData ? existingData.userMessageCount : 0,
                botMessageCount: existingData ? existingData.botMessageCount : 0,
            };
        });

        rsmodel.code = 200;
        rsmodel.message = "成功獲取訊息統計";
        rsmodel.data = result;
    } catch (e) {
        console.error("獲取訊息統計時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "獲取訊息統計失敗: " + e.message;
    }
    res.json(rsmodel);
};

/**
 * 獲取所有共享連結列表
 */
exports.getShareLinks = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { limit = 10, page = 1, searchQuery = "", startDate, endDate } = req.query;

        // console.log("獲取共享連結請求參數:", { limit, page, searchQuery, startDate, endDate });

        // 計算分頁
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pageSize = parseInt(limit);

        // 建立查詢條件
        let query = {};

        // 如果有提供時間範圍，則加入時間條件
        if (startDate && endDate) {
            const startDateTime = new Date(startDate);
            const endDateTime = new Date(endDate);

            // 確保時間範圍足夠寬鬆
            startDateTime.setHours(0, 0, 0, 0);
            endDateTime.setHours(23, 59, 59, 999);

            query.createdAt = {
                $gte: startDateTime,
                $lte: endDateTime,
            };
        }

        // 添加搜尋條件
        if (searchQuery && searchQuery.trim() !== "") {
            query.title = { $regex: searchQuery, $options: "i" };
        }

        // 先獲取符合條件的記錄總數
        const totalShares = await Share.countDocuments(query);

        const shares = await Share.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean();

        const userIds = [...new Set(shares.map((share) => share.user))];

        const users = await User.find({
            $or: [{ _id: { $in: userIds } }, { ldapId: { $in: userIds } }],
        }).lean();

        const userMap = {};
        users.forEach((user) => {
            // 使用 _id 作為鍵
            if (user._id) {
                userMap[user._id.toString()] = user;
            }

            // 使用 ldapId 作為鍵 (如果存在)
            if (user.ldapId) {
                userMap[user.ldapId] = user;
            }
        });

        // 將使用者資訊加入到共享連結
        const sharesWithUserInfo = shares.map((share) => {
            const userId = share.user;

            // 嘗試通過不同方式找到匹配的使用者
            let user = userMap[userId] || null;

            // 如果找不到，嘗試將 userId 作為 ObjectId 字符串進行匹配
            if (!user && mongoose.Types.ObjectId.isValid(userId)) {
                user = userMap[userId.toString()];
            }

            // 如果仍然找不到，使用默認值
            if (!user) {
                user = { name: "未知使用者", email: "未知" };
            }

            return {
                ...share,
                userName: user.name || "未知",
                userEmail: user.email || "未知",
                messagesCount: share.messages ? share.messages.length : 0,
                shareUrl: `https://gpt.icsc.com.tw/share/${share.shareId}`,
            };
        });

        rsmodel.code = 200;
        rsmodel.message = "成功獲取共享連結列表";
        rsmodel.data = {
            shares: sharesWithUserInfo,
            total: totalShares,
            page: parseInt(page),
            pageSize: pageSize,
            totalPages: Math.ceil(totalShares / pageSize),
        };
    } catch (e) {
        console.error("獲取共享連結列表時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "獲取共享連結列表失敗: " + e.message;
    }
    res.json(rsmodel);
};

/**
 * 獲取token費用統計 https://www.librechat.ai/docs/configuration/token_usage
 */
exports.getTokenUsageStatistics = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            rsmodel.code = 400;
            rsmodel.message = "開始日期和結束日期為必填參數";
            return res.json(rsmodel);
        }

        // 處理時區問題 - 將日期轉換為UTC並調整時間範圍
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);

        // console.log("Token費用統計 - 處理後的日期範圍:", {
        //     startDateTime: startDateTime.toISOString(),
        //     endDateTime: endDateTime.toISOString(),
        // });

        // 檢查資料庫總記錄數，用於console
        // const totalCount = await Transaction.countDocuments({});
        // console.log(`資料庫中總共有 ${totalCount} 條交易記錄`);

        // 獲取時間範圍內的記錄數，用於console
        // const timeRangeCount = await Transaction.countDocuments({
        //     createdAt: {
        //         $gte: startDateTime,
        //         $lte: endDateTime,
        //     },
        // });
        // console.log(`指定時間範圍內有 ${timeRangeCount} 條交易記錄`);

        // 聚合查詢每日token費用 - 使用 $addFields 做時區調整
        const pipeline = [
            {
                $match: {
                    createdAt: {
                        $gte: startDateTime,
                        $lte: endDateTime,
                    },
                    tokenValue: { $lt: 0 }, // 確保只處理有效的費用記錄
                },
            },
            {
                $addFields: {
                    // 調整為台灣時間 (UTC+8)
                    localDate: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt",
                            timezone: "+08:00", // 台灣時區
                        },
                    },
                    // 將負數轉為正數並轉換為美元
                    costUSD: {
                        $divide: [{ $abs: "$tokenValue" }, 1000000],
                    },
                },
            },
            {
                $group: {
                    _id: {
                        date: "$localDate",
                        model: "$model",
                    },
                    totalCost: { $sum: "$costUSD" },
                    totalTokens: { $sum: { $abs: "$rawAmount" } },
                    inputTokens: { $sum: { $abs: { $ifNull: ["$inputTokens", 0] } } },
                    outputTokens: { $sum: { $abs: { $ifNull: ["$writeTokens", 0] } } },
                    count: { $sum: 1 },
                },
            },
            {
                $group: {
                    _id: "$_id.date",
                    models: {
                        $push: {
                            model: "$_id.model",
                            cost: { $round: ["$totalCost", 6] }, // 四捨五入到6位小數
                            tokens: "$totalTokens",
                            inputTokens: "$inputTokens",
                            outputTokens: "$outputTokens",
                            count: "$count",
                        },
                    },
                    totalDailyCost: { $sum: "$totalCost" },
                    totalDailyTokens: { $sum: "$totalTokens" },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ];

        // 執行聚合查詢
        const dailyStatistics = await Transaction.aggregate(pipeline);
        // console.log(`Token費用聚合查詢結果包含 ${dailyStatistics.length} 天的數據`);

        // 填充缺失的日期
        const allDates = [];
        const currentDate = new Date(startDateTime);
        while (currentDate <= endDateTime) {
            // 轉換為台灣時間日期格式 (UTC+8)
            const localDate = new Date(currentDate.getTime());
            localDate.setHours(localDate.getHours() + 8);
            const dateStr = localDate.toISOString().split("T")[0];

            allDates.push(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // 將數據轉換為前端所需格式
        const result = allDates.map((date) => {
            const existingData = dailyStatistics.find((item) => item._id === date);
            return {
                date: date,
                models: existingData ? existingData.models : [],
                totalCost: existingData ? parseFloat(existingData.totalDailyCost.toFixed(6)) : 0,
                totalTokens: existingData ? existingData.totalDailyTokens : 0,
            };
        });

        rsmodel.code = 200;
        rsmodel.message = "成功獲取token費用統計";
        rsmodel.data = result;
    } catch (e) {
        console.error("獲取token費用統計時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "獲取token費用統計失敗: " + e.message;
    }
    res.json(rsmodel);
};

/* ------------------------------------------ Balance 設定 ------------------------------------------ */

// balance.enabled:
// 啟用使用者代幣餘額機制，設為 true 時會追蹤使用者的代幣消耗並限制使用量

// balance.startBalance:
// 使用者註冊時預設的初始代幣數量（例如：20000），僅在首次建立帳號時給予

// balance.autoRefillEnabled:
// 是否啟用自動補充代幣功能，設為 true 時系統會定期補充代幣給使用者

// balance.refillIntervalValue:
// 補充間隔的數值，例如設定為 30 搭配 "days" 就表示每 30 天補充一次

// balance.refillIntervalUnit:
// 補充間隔的時間單位，支援：seconds、minutes、hours、days、weeks、months

// balance.refillAmount:
// 每次自動補充時要增加的代幣數量（例如：10000）

// Auto-refill 補充邏輯說明：
// 1. 使用者嘗試消耗代幣時，先檢查目前餘額是否足夠
// 2. 如果扣除後餘額小於等於 0，且已啟用 auto-refill：
//    - 檢查距離上次 refill 的時間是否超過設定的 refill 間隔
//    - 若已超過，就補充 refillAmount 指定的代幣數量，並更新 lastRefill 時間
// 3. 若經補充後餘額仍不足，則拒絕本次交易

// 系統啟動時，會將目前全域 balance 設定同步到所有使用者的個人設定中
// 包含 startBalance、autoRefillEnabled、refillIntervalValue、refillIntervalUnit、refillAmount
// 如果使用者尚未有 balance 記錄，會建立一筆並使用全域設定

/**
 * 獲取所有使用者的 Balance 設定
 */
exports.getUserBalances = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { limit = 10, page = 1, searchQuery = "" } = req.query;

        // 計算分頁
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pageSize = parseInt(limit);

        // 建立查詢條件
        let balanceQuery = {};

        // 先獲取所有 balance 記錄，按 tokenCredits 降序排序
        const totalBalances = await Balance.countDocuments(balanceQuery);
        const balances = await Balance.find(balanceQuery).sort({ tokenCredits: -1, lastRefill: -1 }).lean(); // 按 tokenCredits 降序，lastRefill 降序

        // 獲取對應的使用者資訊
        const userIds = balances.map((balance) => balance.user);
        let userQuery = { _id: { $in: userIds } };

        // 添加搜尋條件
        if (searchQuery && searchQuery.trim() !== "") {
            userQuery.$or = [
                { name: { $regex: searchQuery, $options: "i" } },
                { email: { $regex: searchQuery, $options: "i" } },
                { username: { $regex: searchQuery, $options: "i" } },
            ];
        }

        const users = await User.find(userQuery).lean();

        // 建立使用者對應表
        const userMap = {};
        users.forEach((user) => {
            userMap[user._id.toString()] = user;
        });

        // 合併 balance 和使用者資訊
        const result = balances
            .filter((balance) => {
                const user = userMap[balance.user.toString()];
                if (!user) return false;

                // 如果有搜尋條件，檢查是否符合
                if (searchQuery && searchQuery.trim() !== "") {
                    const query = searchQuery.toLowerCase();
                    return (
                        (user.name && user.name.toLowerCase().includes(query)) ||
                        (user.email && user.email.toLowerCase().includes(query)) ||
                        (user.username && user.username.toLowerCase().includes(query))
                    );
                }
                return true;
            })
            .map((balance) => {
                const user = userMap[balance.user.toString()];

                // 計算下次 refill 時間
                let nextRefillTime = null;
                if (balance.autoRefillEnabled && balance.lastRefill) {
                    const lastRefill = new Date(balance.lastRefill);
                    const intervalMs = getIntervalInMs(balance.refillIntervalValue, balance.refillIntervalUnit);
                    nextRefillTime = new Date(lastRefill.getTime() + intervalMs);
                }

                return {
                    _id: balance._id,
                    userId: balance.user,
                    userName: user?.name || "未知使用者",
                    userEmail: user?.email || "未知",
                    username: user?.username || "未知",
                    tokenCredits: balance.tokenCredits || 0,
                    autoRefillEnabled: balance.autoRefillEnabled || false,
                    refillAmount: balance.refillAmount || 0,
                    refillIntervalValue: balance.refillIntervalValue || 30,
                    refillIntervalUnit: balance.refillIntervalUnit || "days",
                    lastRefill: balance.lastRefill,
                    nextRefillTime,
                };
            });

        // 重新計算總數（考慮搜尋條件）
        const filteredTotal = searchQuery && searchQuery.trim() !== "" ? result.length : totalBalances;

        // 應用分頁
        const paginatedResult = result.slice(skip, skip + pageSize);

        rsmodel.code = 200;
        rsmodel.message = "成功獲取使用者 Balance 列表";
        rsmodel.data = {
            balances: paginatedResult,
            total: filteredTotal,
            page: parseInt(page),
            pageSize: pageSize,
            totalPages: Math.ceil(filteredTotal / pageSize),
        };
    } catch (e) {
        console.error("獲取使用者 Balance 列表時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "獲取使用者 Balance 列表失敗: " + e.message;
    }
    res.json(rsmodel);
};

/**
 * 更新使用者 Balance 設定
 */
exports.updateUserBalance = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { userId, tokenCredits, autoRefillEnabled, refillAmount, refillIntervalValue, refillIntervalUnit } =
            JSON.parse(req.body);

        if (!userId) {
            rsmodel.code = 400;
            rsmodel.message = "使用者ID為必填參數";
            return res.json(rsmodel);
        }

        // 驗證 refillIntervalUnit
        const validUnits = ["seconds", "minutes", "hours", "days", "weeks", "months"];
        if (refillIntervalUnit && !validUnits.includes(refillIntervalUnit)) {
            rsmodel.code = 400;
            rsmodel.message = "無效的時間單位";
            return res.json(rsmodel);
        }

        // 建立更新資料
        const updateData = {};
        if (typeof tokenCredits === "number") updateData.tokenCredits = tokenCredits;
        if (typeof autoRefillEnabled === "boolean") updateData.autoRefillEnabled = autoRefillEnabled;
        if (typeof refillAmount === "number") updateData.refillAmount = refillAmount;
        if (typeof refillIntervalValue === "number") updateData.refillIntervalValue = refillIntervalValue;
        if (refillIntervalUnit) updateData.refillIntervalUnit = refillIntervalUnit;

        // 更新或建立 balance 記錄
        const balance = await Balance.findOneAndUpdate({ user: userId }, updateData, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        });

        rsmodel.code = 200;
        rsmodel.message = "成功更新使用者 Balance 設定";
        rsmodel.data = balance;
    } catch (e) {
        console.error("更新使用者 Balance 設定時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "更新使用者 Balance 設定失敗: " + e.message;
    }
    res.json(rsmodel);
};

/**
 * 批次更新使用者 Balance 設定
 */
exports.batchUpdateUserBalances = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { userIds, tokenCredits, autoRefillEnabled, refillAmount, refillIntervalValue, refillIntervalUnit } =
            JSON.parse(req.body);

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            rsmodel.code = 400;
            rsmodel.message = "使用者ID列表為必填參數";
            return res.json(rsmodel);
        }

        // 驗證 refillIntervalUnit
        const validUnits = ["seconds", "minutes", "hours", "days", "weeks", "months"];
        if (refillIntervalUnit && !validUnits.includes(refillIntervalUnit)) {
            rsmodel.code = 400;
            rsmodel.message = "無效的時間單位";
            return res.json(rsmodel);
        }

        // 建立更新資料
        const updateData = {};
        if (typeof tokenCredits === "number") updateData.tokenCredits = tokenCredits;
        if (typeof autoRefillEnabled === "boolean") updateData.autoRefillEnabled = autoRefillEnabled;
        if (typeof refillAmount === "number") updateData.refillAmount = refillAmount;
        if (typeof refillIntervalValue === "number") updateData.refillIntervalValue = refillIntervalValue;
        if (refillIntervalUnit) updateData.refillIntervalUnit = refillIntervalUnit;

        // 批次更新
        const results = [];
        for (const userId of userIds) {
            try {
                const balance = await Balance.findOneAndUpdate({ user: userId }, updateData, {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                });
                results.push({ userId, success: true, balance });
            } catch (error) {
                results.push({ userId, success: false, error: error.message });
            }
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        rsmodel.code = 200;
        rsmodel.message = `批次更新完成：成功 ${successCount} 個，失敗 ${failCount} 個`;
        rsmodel.data = {
            results,
            successCount,
            failCount,
        };
    } catch (e) {
        console.error("批次更新使用者 Balance 設定時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "批次更新使用者 Balance 設定失敗: " + e.message;
    }
    res.json(rsmodel);
};

/**
 * 批次更新所有使用者 Balance 設定
 */
exports.batchUpdateAllUserBalances = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { tokenCredits, autoRefillEnabled, refillAmount, refillIntervalValue, refillIntervalUnit } = JSON.parse(
            req.body
        );

        // 驗證 refillIntervalUnit
        const validUnits = ["seconds", "minutes", "hours", "days", "weeks", "months"];
        if (refillIntervalUnit && !validUnits.includes(refillIntervalUnit)) {
            rsmodel.code = 400;
            rsmodel.message = "無效的時間單位";
            return res.json(rsmodel);
        }

        // 建立更新資料
        const updateData = {};
        if (typeof tokenCredits === "number") updateData.tokenCredits = tokenCredits;
        if (typeof autoRefillEnabled === "boolean") updateData.autoRefillEnabled = autoRefillEnabled;
        if (typeof refillAmount === "number") updateData.refillAmount = refillAmount;
        if (typeof refillIntervalValue === "number") updateData.refillIntervalValue = refillIntervalValue;
        if (refillIntervalUnit) updateData.refillIntervalUnit = refillIntervalUnit;

        // 獲取所有使用者
        const users = await User.find({}).lean();
        const userIds = users.map((user) => user._id);

        // 批次更新所有使用者
        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const userId of userIds) {
            try {
                const balance = await Balance.findOneAndUpdate({ user: userId }, updateData, {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                });
                results.push({ userId, success: true, balance });
                successCount++;
            } catch (error) {
                results.push({ userId, success: false, error: error.message });
                failCount++;
            }
        }

        rsmodel.code = 200;
        rsmodel.message = `批次更新所有使用者完成：成功 ${successCount} 個，失敗 ${failCount} 個`;
        rsmodel.data = {
            results,
            successCount,
            failCount,
            totalUsers: userIds.length,
        };
    } catch (e) {
        console.error("批次更新所有使用者 Balance 設定時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "批次更新所有使用者 Balance 設定失敗: " + e.message;
    }
    res.json(rsmodel);
};

/**
 * 手動觸發使用者 refill
 */
exports.triggerUserRefill = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { userId } = JSON.parse(req.body);

        if (!userId) {
            rsmodel.code = 400;
            rsmodel.message = "使用者ID為必填參數";
            return res.json(rsmodel);
        }

        const balance = await Balance.findOne({ user: userId });
        if (!balance) {
            rsmodel.code = 404;
            rsmodel.message = "找不到使用者的 Balance 記錄";
            return res.json(rsmodel);
        }

        if (!balance.autoRefillEnabled) {
            rsmodel.code = 400;
            rsmodel.message = "該使用者未啟用自動補充功能";
            return res.json(rsmodel);
        }

        // 執行 refill
        const updatedBalance = await Balance.findOneAndUpdate(
            { user: userId },
            {
                $inc: { tokenCredits: balance.refillAmount },
                $set: { lastRefill: new Date() },
            },
            { new: true }
        );

        rsmodel.code = 200;
        rsmodel.message = `成功為使用者補充 ${balance.refillAmount} token credits`;
        rsmodel.data = updatedBalance;
    } catch (e) {
        console.error("觸發使用者 refill 時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "觸發使用者 refill 失敗: " + e.message;
    }
    res.json(rsmodel);
};

// 輔助函數：將時間間隔轉換為毫秒
function getIntervalInMs(value, unit) {
    const multipliers = {
        seconds: 1000,
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        weeks: 7 * 24 * 60 * 60 * 1000,
        months: 30 * 24 * 60 * 60 * 1000, // 假設一個月為30天
    };

    return value * (multipliers[unit] || multipliers.days);
}

/**
 * 獲取 Top 10 使用者統計 (支援按訊息數或花費排序)
 */
exports.getTopUsersStatistics = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { startDate, endDate, sortBy = "messages" } = req.query; // 新增 sortBy 參數，預設為 messages

        if (!startDate || !endDate) {
            rsmodel.code = 400;
            rsmodel.message = "開始日期和結束日期為必填參數";
            return res.json(rsmodel);
        }

        // 處理時區問題 - 將日期轉換為UTC並調整時間範圍
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);

        // console.log("Top 10 使用者統計 - 處理後的日期範圍:", {
        //     startDateTime: startDateTime.toISOString(),
        //     endDateTime: endDateTime.toISOString(),
        // });

        let result = [];

        if (sortBy === "cost") {
            // 按花費排序：先查詢 Transaction 集合
            const tokenCostPipeline = [
                {
                    $match: {
                        createdAt: {
                            $gte: startDateTime,
                            $lte: endDateTime,
                        },
                        tokenValue: { $lt: 0 }, // 確保只處理有效的費用記錄
                    },
                },
                {
                    $group: {
                        _id: "$user",
                        totalCostUSD: {
                            $sum: {
                                $divide: [{ $abs: "$tokenValue" }, 1000000],
                            },
                        },
                        totalTokens: { $sum: { $abs: "$rawAmount" } },
                    },
                },
                {
                    $sort: { totalCostUSD: -1 },
                },
                {
                    $limit: 10,
                },
            ];

            const topCostUsers = await Transaction.aggregate(tokenCostPipeline);

            // 獲取這些使用者的訊息統計
            const userIds = topCostUsers
                .map((cost) => {
                    try {
                        return cost._id.toString();
                    } catch (error) {
                        console.error("處理使用者ID失敗:", cost._id, error);
                        return null;
                    }
                })
                .filter(Boolean);

            const messagePipeline = [
                {
                    $match: {
                        user: { $in: userIds },
                        createdAt: {
                            $gte: startDateTime,
                            $lte: endDateTime,
                        },
                    },
                },
                {
                    $group: {
                        _id: "$user",
                        totalMessages: { $sum: 1 },
                        userMessages: {
                            $sum: { $cond: [{ $eq: ["$isCreatedByUser", true] }, 1, 0] },
                        },
                        botMessages: {
                            $sum: { $cond: [{ $eq: ["$isCreatedByUser", false] }, 1, 0] },
                        },
                    },
                },
            ];

            const messageStats = await Message.aggregate(messagePipeline);

            // 建立訊息統計對應表
            const messageMap = {};
            messageStats.forEach((msg) => {
                messageMap[msg._id.toString()] = msg;
            });

            // 獲取使用者詳細資訊
            const userObjectIds = userIds.map((id) => {
                try {
                    return new mongoose.Types.ObjectId(id);
                } catch (error) {
                    return id;
                }
            });
            const users = await User.find({ _id: { $in: userObjectIds } }).lean();

            // 建立使用者對應表
            const userMap = {};
            users.forEach((user) => {
                userMap[user._id.toString()] = user;
            });

            // 合併統計數據和使用者資訊
            result = topCostUsers.map((cost, index) => {
                const userId = cost._id.toString();
                const user = userMap[userId];
                const messages = messageMap[userId] || { totalMessages: 0, userMessages: 0, botMessages: 0 };

                return {
                    rank: index + 1,
                    userId: cost._id,
                    userName: user?.name || "未知使用者",
                    userEmail: user?.email || "未知",
                    username: user?.username || "未知",
                    totalMessages: messages.totalMessages,
                    userMessages: messages.userMessages,
                    botMessages: messages.botMessages,
                    totalCostUSD: parseFloat(cost.totalCostUSD.toFixed(6)),
                    totalTokens: cost.totalTokens,
                };
            });
        } else {
            // 按訊息數排序：原有邏輯
            const messagePipeline = [
                {
                    $match: {
                        createdAt: {
                            $gte: startDateTime,
                            $lte: endDateTime,
                        },
                    },
                },
                {
                    $group: {
                        _id: "$user",
                        totalMessages: { $sum: 1 },
                        userMessages: {
                            $sum: { $cond: [{ $eq: ["$isCreatedByUser", true] }, 1, 0] },
                        },
                        botMessages: {
                            $sum: { $cond: [{ $eq: ["$isCreatedByUser", false] }, 1, 0] },
                        },
                    },
                },
                {
                    $sort: { totalMessages: -1 },
                },
                {
                    $limit: 10,
                },
            ];

            const topUsersStats = await Message.aggregate(messagePipeline);

            // 獲取這些使用者的 token 費用統計
            const userIds = topUsersStats
                .map((stat) => {
                    try {
                        return new mongoose.Types.ObjectId(stat._id);
                    } catch (error) {
                        console.error("轉換 ObjectId 失敗:", stat._id, error);
                        return null;
                    }
                })
                .filter(Boolean);

            const tokenCostPipeline = [
                {
                    $match: {
                        user: { $in: userIds },
                        createdAt: {
                            $gte: startDateTime,
                            $lte: endDateTime,
                        },
                        tokenValue: { $lt: 0 },
                    },
                },
                {
                    $group: {
                        _id: "$user",
                        totalCostUSD: {
                            $sum: {
                                $divide: [{ $abs: "$tokenValue" }, 1000000],
                            },
                        },
                        totalTokens: { $sum: { $abs: "$rawAmount" } },
                    },
                },
            ];

            const tokenCostStats = await Transaction.aggregate(tokenCostPipeline);

            // 建立費用對應表
            const costMap = {};
            tokenCostStats.forEach((cost) => {
                costMap[cost._id.toString()] = {
                    totalCostUSD: cost.totalCostUSD,
                    totalTokens: cost.totalTokens,
                };
            });

            // 獲取使用者詳細資訊
            const users = await User.find({ _id: { $in: userIds } }).lean();

            // 建立使用者對應表
            const userMap = {};
            users.forEach((user) => {
                userMap[user._id.toString()] = user;
            });

            // 合併統計數據和使用者資訊
            result = topUsersStats.map((stat, index) => {
                const user = userMap[stat._id.toString()];
                const cost = costMap[stat._id.toString()] || { totalCostUSD: 0, totalTokens: 0 };

                return {
                    rank: index + 1,
                    userId: stat._id,
                    userName: user?.name || "未知使用者",
                    userEmail: user?.email || "未知",
                    username: user?.username || "未知",
                    totalMessages: stat.totalMessages,
                    userMessages: stat.userMessages,
                    botMessages: stat.botMessages,
                    totalCostUSD: parseFloat(cost.totalCostUSD.toFixed(6)),
                    totalTokens: cost.totalTokens,
                };
            });
        }

        rsmodel.code = 200;
        rsmodel.message = `成功獲取 Top 10 使用者統計 (${sortBy === "cost" ? "按花費排序" : "按訊息數排序"})`;
        rsmodel.data = result;
    } catch (e) {
        console.error("獲取 Top 10 使用者統計時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "獲取 Top 10 使用者統計失敗: " + e.message;
    }
    res.json(rsmodel);
};

/**
 * 獲取所有使用者上傳的文件列表
 */
exports.getUserFiles = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { limit = 10, page = 1, searchQuery = "", startDate, endDate } = req.query;

        // 計算分頁
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pageSize = parseInt(limit);

        // 建立文件查詢條件
        let fileQuery = {};

        // 如果有提供時間範圍，則加入時間條件
        if (startDate && endDate) {
            const startDateTime = new Date(startDate);
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);

            fileQuery.createdAt = {
                $gte: startDateTime,
                $lte: endDateTime,
            };
        }

        // 如果有搜尋條件，先處理文件相關的搜尋
        if (searchQuery && searchQuery.trim() !== "") {
            const query = searchQuery.trim();
            fileQuery.$or = [
                { filename: { $regex: query, $options: "i" } },
                { type: { $regex: query, $options: "i" } },
            ];
        }

        // 如果有使用者搜尋條件，需要先找到符合的使用者
        let userIds = [];
        if (searchQuery && searchQuery.trim() !== "") {
            const query = searchQuery.trim();
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { email: { $regex: query, $options: "i" } },
                    { username: { $regex: query, $options: "i" } },
                ],
            }).lean();

            userIds = matchingUsers.map((user) => user._id);

            // 如果有使用者匹配，將使用者條件加入文件查詢
            if (userIds.length > 0) {
                if (fileQuery.$or) {
                    // 如果已經有文件搜尋條件，則合併使用者條件
                    fileQuery.$or.push({ user: { $in: userIds } });
                } else {
                    // 如果沒有文件搜尋條件，只加入使用者條件
                    fileQuery.user = { $in: userIds };
                }
            }
        }

        // 重新計算符合所有條件的總數
        const filteredTotal = await File.countDocuments(fileQuery);

        // 總 bytes
        const totalBytes = await File.aggregate([
            { $match: fileQuery },
            { $group: { _id: null, totalBytes: { $sum: "$bytes" } } },
        ]);

        // 獲取分頁的文件列表，按創建時間降序排序
        const files = await File.find(fileQuery).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean();

        // 獲取相關的使用者資訊
        const fileUserIds = [...new Set(files.map((file) => file.user))];
        const users = await User.find({ _id: { $in: fileUserIds } }).lean();

        // 建立使用者對應表
        const userMap = {};
        users.forEach((user) => {
            userMap[user._id.toString()] = user;
        });

        // 為每個文件查詢相關的問題
        const fileIds = files.map((file) => file.file_id);
        const messagesWithFiles = await Message.find({
            sender: "User",
            "files.file_id": { $in: fileIds },
        }).lean();

        // 建立文件ID到問題的對應表
        const fileQuestionsMap = {};
        messagesWithFiles.forEach((message) => {
            if (message.files && message.files.length > 0) {
                message.files.forEach((file) => {
                    if (fileIds.includes(file.file_id)) {
                        if (!fileQuestionsMap[file.file_id]) {
                            fileQuestionsMap[file.file_id] = [];
                        }
                        fileQuestionsMap[file.file_id].push({
                            messageId: message.messageId,
                            conversationId: message.conversationId,
                            text: message.text,
                            createdAt: message.createdAt,
                        });
                    }
                });
            }
        });

        // 合併文件和使用者資訊
        const result = files.map((file) => {
            const user = userMap[file.user.toString()];

            // 處理圖片類型的 filepath
            let fileUrl = file.filepath;
            if (file.type && file.type.startsWith("image/") && process.env.AVA_GPT_FQDN) {
                fileUrl = process.env.AVA_GPT_FQDN + file.filepath;
            }

            // 獲取這個文件相關的問題
            const questions = fileQuestionsMap[file.file_id] || [];

            return {
                _id: file._id,
                fileId: file.file_id,
                filename: file.filename,
                filepath: file.filepath,
                fileUrl: fileUrl,
                type: file.type,
                bytes: file.bytes,
                width: file.width,
                height: file.height,
                context: file.context,
                source: file.source,
                usage: file.usage || 0,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
                userId: file.user,
                userName: user?.name || "未知使用者",
                userEmail: user?.email || "未知",
                username: user?.username || "未知",
                questions: questions, // 新增：使用者用這個檔案問的問題
                questionsCount: questions.length, // 新增：問題數量
            };
        });

        rsmodel.code = 200;
        rsmodel.message = "成功獲取使用者文件列表";
        rsmodel.data = {
            files: result,
            total: filteredTotal,
            page: parseInt(page),
            pageSize: pageSize,
            totalPages: Math.ceil(filteredTotal / pageSize),
            totalBytes: totalBytes[0]?.totalBytes || 0,
        };
    } catch (e) {
        console.error("獲取使用者文件列表時發生錯誤:", e);
        rsmodel.code = 500;
        rsmodel.message = "獲取使用者文件列表失敗: " + e.message;
    }
    res.json(rsmodel);
};
