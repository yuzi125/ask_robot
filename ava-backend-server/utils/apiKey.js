const crypto = require("crypto");
const APIKey = require("../orm/schema/api_keys");
const APIKeyScopes = require("../orm/schema/api_key_scopes");

function generateApiKey() {
    // 生成 32 位元的隨機字串
    const randomBytes = crypto.randomBytes(32);
    // 轉換成 base64 並移除非英數字符號
    const key = randomBytes.toString("base64").replace(/[^a-zA-Z0-9]/g, "");
    // 加上前綴
    return `ak_${key}`;
}

async function validateApiKey(apiKey) {
    if (!apiKey) return false;

    try {
        const keyData = await APIKey.findOne({
            where: {
                key: apiKey,
                status: 1, // 確認是啟用狀態
            },
        });

        return !!keyData; // 如果找到且狀態正確則返回 true
    } catch (error) {
        console.error("Error validating API key:", error);
        return false;
    }
}

const checkScope = async (keyData, requestPath) => {
    const scopes = await APIKeyScopes.findAll({
        where: { api_key_id: keyData.id },
    });
    return scopes.some((scope) => scope.path === "*" || requestPath.startsWith(scope.path));
};

module.exports = {
    generateApiKey,
    validateApiKey,
    checkScope,
};
