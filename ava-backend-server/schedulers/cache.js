// clearCache.js
const pythonAPI = require("../utils/pythonAPI");

async function processClearCacheTasks(expertId, cacheIds, client) {
    try {
        // 先刪除 history_cache_mapping 的相關記錄
        await client.query(
            `
            DELETE FROM history_cache_mapping 
            WHERE cache_id = ANY($1)
        `,
            [cacheIds]
        );

        // 刪除 cached_knowledge 記錄
        await client.query(
            `
            DELETE FROM cached_knowledge 
            WHERE id = ANY($1) AND expert_id = $2
        `,
            [cacheIds, expertId]
        );

        // 調用 Python API 刪除快取
        const avaToken = `ava:system`;
        await pythonAPI.deleteCachedKnowledge(expertId, cacheIds, process.env.PYTHON_API_HOST, avaToken);

        return { code: 0, message: "Cache cleared successfully" };
    } catch (error) {
        console.error("Error clearing cache:", error);
        throw error;
    }
}

module.exports = { processClearCacheTasks };
