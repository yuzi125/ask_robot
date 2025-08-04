const mongoose = require("mongoose");
const dotenv = require("dotenv");

// 載入環境變數
dotenv.config();

// 連接到 MongoDB
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27018/LibreChat");

// 定義 User Schema (參考 LibreChat 的模型)
const userSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    name: { type: String },
    username: { type: String },
    email: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    password: { type: String },
    avatar: { type: String },
    provider: { type: String },
    role: { type: String },
    plugins: { type: Array },
    twoFactorEnabled: { type: Boolean },
    termsAccepted: { type: Boolean },
    backupCodes: { type: Array },
    refreshToken: { type: Array },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// 定義 Conversation Schema (參考 LibreChat 的模型)
const conversationSchema = new mongoose.Schema({
    conversationId: { type: String, required: true },
    user: { type: String, required: true },
    title: { type: String },
    endpoint: { type: String },
    model: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// 定義 Message Schema (參考 LibreChat 的模型)
const messageSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    conversationId: { type: String, required: true },
    user: { type: String, required: true },
    text: { type: String },
    sender: { type: String },
    isCreatedByUser: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// 創建模型
const User = mongoose.model("User", userSchema);
const Conversation = mongoose.model("Conversation", conversationSchema);
const Message = mongoose.model("Message", messageSchema);

// 獲取使用者資訊
async function getUserInfo(userId) {
    try {
        let query;
        try {
            // 嘗試將 userId 轉換為 ObjectId
            query = { _id: mongoose.Types.ObjectId(userId) };
        } catch (error) {
            // 如果轉換失敗，則使用原始字符串
            query = { _id: userId };
        }

        const user = await User.findOne(query).lean();
        console.log("Found user:", user); // 調試用
        return user;
    } catch (error) {
        console.error("Error getting user info:", error);
        return null;
    }
}

// 獲取特定使用者的對話列表，並包含使用者名稱
async function getUserConversationsWithName(userId, limit = 25) {
    try {
        const conversations = await Conversation.find({ user: userId }).sort({ updatedAt: -1 }).limit(limit).lean();

        // 獲取使用者資訊
        const userInfo = await getUserInfo(userId);

        // 將使用者資訊添加到對話列表中
        return {
            conversations,
            userInfo: userInfo
                ? {
                      userId: userInfo._id,
                      name: userInfo.name || "未知",
                      username: userInfo.username || "未知",
                      email: userInfo.email || "未知",
                  }
                : null,
        };
    } catch (error) {
        console.error("Error getting conversations:", error);
        return { message: "Error getting conversations" };
    }
}

// 獲取特定對話的所有訊息
async function getConversationMessages(userId, conversationId) {
    try {
        return await Message.find({ user: userId, conversationId }).sort({ createdAt: 1 }).lean();
    } catch (error) {
        console.error("Error getting messages:", error);
        return { message: "Error getting messages" };
    }
}

// 獲取在特定時間範圍內有對話的使用者列表
async function getUsersWithConversationsInTimeRange(startDate, endDate, limit = 100) {
    try {
        // 查詢在指定時間範圍內有對話的使用者
        const usersWithConversations = await Conversation.aggregate([
            {
                $match: {
                    updatedAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate),
                    },
                },
            },
            {
                $group: {
                    _id: "$user",
                    lastConversation: { $max: "$updatedAt" },
                    conversationCount: { $sum: 1 },
                },
            },
            {
                $sort: { lastConversation: -1 },
            },
            {
                $limit: limit,
            },
        ]);

        console.log("Users with conversations:", usersWithConversations); // 調試用

        // 獲取這些使用者的詳細資訊
        const userIds = usersWithConversations.map((item) => {
            try {
                // 嘗試將字符串 ID 轉換為 ObjectId
                return mongoose.Types.ObjectId(item._id);
            } catch (error) {
                // 如果無法轉換，則保留原始字符串
                console.log("Could not convert ID:", item._id, error); // 調試用
                return item._id;
            }
        });

        console.log("User IDs for query:", userIds); // 調試用

        const users = await User.find({ _id: { $in: userIds } }).lean();
        console.log("Found users:", users); // 調試用

        // 將使用者資訊與對話統計合併
        const result = usersWithConversations.map((item) => {
            // 使用 toString() 進行比較，確保類型一致
            const itemIdStr =
                typeof item._id === "object" && item._id !== null ? item._id.toString() : String(item._id);

            const userInfo =
                users.find((user) => {
                    const userIdStr =
                        typeof user._id === "object" && user._id !== null ? user._id.toString() : String(user._id);
                    return userIdStr === itemIdStr;
                }) || {};

            return {
                userId: item._id,
                name: userInfo.name || "未知",
                username: userInfo.username || "未知",
                email: userInfo.email || "未知",
                lastConversation: item.lastConversation,
                conversationCount: item.conversationCount,
            };
        });

        return result;
    } catch (error) {
        console.error("Error getting users with conversations:", error);
        return { message: "Error getting users with conversations" };
    }
}

// 使用範例
async function main() {
    const userId = "682bebfe7a598249e742c15b"; // 替換為實際的使用者 ID
    const startDate = "2025-01-01";
    const endDate = "2025-05-21"; // 今天的日期

    // 獲取使用者的對話列表（包含使用者名稱）
    const result = await getUserConversationsWithName(userId);
    console.log("User info:", result.userInfo);
    console.log("User conversations:", result.conversations);

    if (result.conversations && result.conversations.length > 0) {
        // 獲取第一個對話的所有訊息
        const messages = await getConversationMessages(userId, result.conversations[0].conversationId);
        console.log("Conversation messages:", messages);
    }

    // 獲取在特定時間範圍內有對話的使用者列表
    console.log("\n獲取在特定時間範圍內有對話的使用者列表:");
    const usersWithConversations = await getUsersWithConversationsInTimeRange(startDate, endDate);
    console.log(usersWithConversations);

    // 關閉連接
    mongoose.connection.close();
}

main().catch(console.error);
