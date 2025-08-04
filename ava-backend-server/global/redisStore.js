const redis = require("redis");
const redis_host = process.env.REDIS_HOST;
const redis_password = process.env.REDIS_PASSWORD;
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

const RedisStore = require("connect-redis").default;
const sql = require("../db/pgsql");

const CHANNEL_NAME = "rateLimitRulesChannel";

//Configure redis client
const redisClient = redis.createClient({
    url: "redis://:" + redis_password + "@" + redis_host + ":6379",
});
console.log("redis host: " + redis_host);

redisClient.connect().catch(console.error);

redisClient.on("error", function (err) {
    console.error("Could not establish a connection with redis. " + err);
});
redisClient.on("connect", function (err) {
    console.log("Connected to redis successfully");
});
let redisStore = new RedisStore({
    client: redisClient, // 指定 Redis 客戶端
    prefix: SESSION_KEY_PREFIX,      // 為 Redis 中的 session keys 設置一個前綴
    ttl: 24 * 60 * 60 + Math.floor(Math.random() * 3600) // 設置 session 的 TTL 為 1 天加上最多 1 小時的隨機偏移
});


// 限流規則更新相關功能

// 限流預設值 如果沒有從資料庫中讀取到限流規則 就使用預設值
const getDefaultRateLimitRules = () => {
    return {
        systemWide: { maxRequests: 1000, windowMs: 60000 },
        allExperts: { maxRequests: 500, windowMs: 60000 },
        expertSpecific: {},
        users: { maxRequests: 5, windowMs: 60000 },
    };
};

// 發布新的限流規則
const publishRateLimitRules = async (rateLimitRules) => {
    try {
        await redisClient.publish(CHANNEL_NAME, JSON.stringify(rateLimitRules));
        console.log("已發布新的限流規則");
    } catch (error) {
        console.error("發布限流規則時出錯:", error);
    }
};

// 從資料庫讀取並發布限流規則
const updateRulesFromDatabase = async () => {
    try {
        const rateLimitRules = await getRateLimitRulesFromDB();
        await publishRateLimitRules(rateLimitRules);
    } catch (error) {
        console.error("從資料庫更新限流規則時出錯:", error);
    }
};

// 這個函數應該連接到您的實際數據庫
const getRateLimitRulesFromDB = async () => {
    try {
        const sqlStr = `SELECT value FROM settings WHERE key = 'rate_limit_rules'`;
        const { rows } = await sql.query(sqlStr);

        if (rows.length === 0) {
            console.warn("資料庫中未找到限流規則，使用默認值");
            return getDefaultRateLimitRules();
        }

        const rateLimitRules = JSON.parse(rows[0].value);
        console.log("從資料庫獲取的限流規則:", rateLimitRules);

        // 驗證並確保所有必要的字段都存在
        return rateLimitRules;
    } catch (error) {
        console.error("從資料庫取得限流規則時出錯:", error);
        console.warn("使用默認限流規則");
        return getDefaultRateLimitRules();
    }
};
module.exports = { redisStore, redisClient, updateRulesFromDatabase };
