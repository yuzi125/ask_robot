const redis = require("redis");
const redis_host = process.env.REDIS_HOST;
const redis_password = process.env.REDIS_PASSWORD;
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

const RedisStore = require("connect-redis").default;
//Configure redis client
// 創建兩個 Redis 客戶端
const createRedisClient = () => {
    const client = redis.createClient({
        url: "redis://:" + redis_password + "@" + redis_host + ":6379",
    });

    client.on("error", (err) => {
        console.error("Redis 客戶端錯誤:", err);
    });

    client.on("connect", () => {
        console.log("Redis 客戶端連接成功");
    });

    return client;
};

// 操作用客戶端
const redisClient = createRedisClient();
// 訂閱用客戶端
const subscriberClient = createRedisClient();

// 連接兩個客戶端
Promise.all([redisClient.connect(), subscriberClient.connect()])
    .then(() => console.log("所有 Redis 客戶端已連接"))
    .catch(console.error);

let redisStore = new RedisStore({
    client: redisClient, // 指定 Redis 客戶端
    prefix: SESSION_KEY_PREFIX, // 為 Redis 中的 session keys 設置一個前綴
    ttl: 24 * 60 * 60 + Math.floor(Math.random() * 3600), // 設置 session 的 TTL 為 1 天加上最多 1 小時的隨機偏移
});

// 限流相關功能
const CHANNEL_NAME = "rateLimitRulesChannel";
// 訂閱頻道
subscriberClient.subscribe(CHANNEL_NAME, (message) => {
    try {
        const rateLimitRules = JSON.parse(message);
        updateRateLimitRules(rateLimitRules);
    } catch (error) {
        console.error("解析限流規則時出錯:", error);
    }
});

// 更新 Redis 中的限流規則
const updateRateLimitRules = async (rules) => {
    try {
        console.log("rules", rules);
        await redisClient.set("rateLimitRules", JSON.stringify(rules));
        console.log("Redis 中的限流規則已更新");
    } catch (error) {
        console.error("更新限流規則時出錯:", error);
    }
};

// 限流 middleware
/**
 * 限流優先順序：
 * 1. 系統範圍限制
 * 2. 使用者限制
 * 3. 專家範圍限制
 * 4. 特定專家限制
 */
const createRateLimiter = () => {
    return async function rateLimiter(req, res, next) {
        if (!req.session || !req.session.userInfo || !req.session.userInfo.uid) {
            return res.status(400).json({ error: "使用者未認證" });
        }

        try {
            const message = JSON.parse(req.body.message);
            const expertId = req.body.expert_id;
            const userId = req.session.userInfo.uid;
            const apiKey = req.headers["api-key"] || req.query.api_key || req.body.api_key;
            // 檢查 message 是否有 type 屬性 並且 type 是 'tunnel'
            if (message.type && message.type === "tunnel") {
                return next(); // 直接跳過限流邏輯
            }

            const rulesString = await redisClient.get("rateLimitRules");
            if (!rulesString) {
                console.error("Redis 中未找到限流規則");
                return next();
            }

            const rules = JSON.parse(rulesString);

            // 檢查 API Key 限制 API 先自己獨立一個限流 之後看要不要跟其他限流一起
            if (apiKey) {
                const apiKeyRule = rules.apiKeySpecific[apiKey];
                if (apiKeyRule && (await checkLimit(`apiKey:${apiKey}`, apiKeyRule))) {
                    const errorMessage = apiKeyRule.errorMessage || "API Key 請求過多，請稍後再試。";
                    return res.status(429).json({ error: errorMessage });
                }
            } else {
                // 檢查系統範圍限制
                if (await checkLimit("systemWide", rules.systemWide)) {
                    const errorMessage = rules.systemWide.errorMessage || "系統請求過多，請稍後再試。";
                    return res.status(429).json({ error: errorMessage });
                }

                // 檢查使用者限制
                if (await checkLimit(`user:${userId}`, rules.users)) {
                    const errorMessage = rules.users.errorMessage || "請求過多，請稍後再試。";
                    return res.status(429).json({ error: errorMessage });
                }

                // 如果是專家相關的請求
                if (expertId) {
                    // 檢查所有專家的限制
                    if (await checkLimit("allExperts", rules.allExperts)) {
                        const errorMessage = rules.allExperts.errorMessage || "專家請求過多，請稍後再試。";
                        return res.status(429).json({ error: errorMessage });
                    }

                    // 檢查特定專家的限制
                    const expertRule = rules.expertSpecific[expertId];

                    if (expertRule && (await checkLimit(`expert:${expertId}`, expertRule))) {
                        const errorMessage = expertRule.errorMessage || "該專家請求過多，請稍後再試。";
                        return res.status(429).json({ error: errorMessage });
                    }
                }
            }

            next();
        } catch (error) {
            console.error("限流錯誤:", error);
            next(error);
        }
    };
};

const checkLimit = async (key, rule) => {
    const { maxRequests, windowMs } = rule;
    const requests = await redisClient.incr(`rateLimit:${key}`);

    if (requests === 1) {
        await redisClient.pExpire(`rateLimit:${key}`, windowMs);
    }

    console.log(`${key} 已發送 ${requests} 個請求`);

    if (requests > maxRequests) {
        console.log(`${key} 達到流量限制`);
        return true;
    }

    return false;
};

const rateLimiter = createRateLimiter();

// 清理函數
const cleanup = async () => {
    await redisClient.quit();
    await subscriberClient.quit();
    console.log("Redis 連接已關閉");
};

// 處理程序退出
process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
});

module.exports = { redisStore, redisClient, rateLimiter, cleanup };
