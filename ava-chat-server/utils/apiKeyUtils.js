const APIKey = require("../orm/schema/api_keys");
const APIKeyScopes = require("../orm/schema/api_key_scopes");

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
    validateApiKey,
    checkScope,
};
