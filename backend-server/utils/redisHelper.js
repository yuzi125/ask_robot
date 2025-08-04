const { redisClient } = require("../global/redisStore");

async function getSystemStatus(rules) {
    const count = (await redisClient.get("rateLimit:systemWide")) || 0;
    const ttl = await redisClient.pTTL("rateLimit:systemWide");
    return {
        currentCount: parseInt(count),
        remainingTime: ttl,
        limit: rules.maxRequests,
        windowMs: rules.windowMs,
        isLimited: parseInt(count) >= rules.maxRequests,
        remainingRequests: Math.max(0, rules.maxRequests - parseInt(count)),
    };
}

async function getExpertsStatus(rules) {
    const count = (await redisClient.get("rateLimit:allExperts")) || 0;
    const ttl = await redisClient.pTTL("rateLimit:allExperts");
    return {
        currentCount: parseInt(count),
        remainingTime: ttl,
        limit: rules.maxRequests,
        windowMs: rules.windowMs,
        isLimited: parseInt(count) >= rules.maxRequests,
        remainingRequests: Math.max(0, rules.maxRequests - parseInt(count)),
    };
}

module.exports = {
    getSystemStatus,
    getExpertsStatus,
};
