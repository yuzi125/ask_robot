const pythonAPI = require("../utils/pythonAPI");

async function checkAndDeleteExpiredCache(task, client) {
    try {
        // 1. Get experts with their cache deletion frequency
        const expertsResult = await client.query(`
            SELECT id, config_jsonb->>'cache_delete_frequency' as cache_delete_frequency
            FROM expert
            WHERE config_jsonb->>'cache_delete_frequency' IS NOT NULL AND config_jsonb->>'cache_delete_frequency' != ''
        `);

        for (const expert of expertsResult.rows) {
            const daysToDelete = parseInt(expert.cache_delete_frequency, 10);
            if (isNaN(daysToDelete)) {
                console.warn(`Invalid cache_delete_frequency for expert ${expert.id}`);
                continue;
            }

            // 2 & 3. Find cached knowledge and check their latest history cache mapping
            const expiredCachesResult = await client.query(
                `
                WITH LatestHistory AS (
                    SELECT 
                        hcm.cache_id,
                        ck.expert_id,
                        hcm.create_time,
                        ROW_NUMBER() OVER (PARTITION BY ck.id ORDER BY hcm.create_time DESC) as rn
                    FROM cached_knowledge ck
                    JOIN history_cache_mapping hcm ON ck.id = hcm.cache_id
                    WHERE ck.expert_id = $1
                )
                SELECT 
                    cache_id,
                    expert_id,
                    create_time
                FROM LatestHistory
                WHERE rn = 1 
                AND create_time < NOW() - ($2 || ' days')::interval
            `,
                [expert.id, daysToDelete]
            );

            // 4. Create task operations for expired caches
            for (const expiredCache of expiredCachesResult.rows) {
                await client.query(
                    `
                    INSERT INTO task_operations (id, cron_task_id, operation, status, params)
                    VALUES (gen_random_uuid(), $1, $2, 'pending', $3)
                    `,
                    [
                        task.id,
                        task.function_name,
                        JSON.stringify({
                            expert_id: expiredCache.expert_id,
                            cache_id: expiredCache.cache_id,
                        }),
                    ]
                );
            }
        }
    } catch (error) {
        console.error("Error checking expired cache:", error);
        throw error;
    }
}

async function clearCache(cacheId, userNo = "系統", sql) {
    if (cacheId.length === 0) {
        return { message: "沒有需要停用的文檔", code: 0 };
    }

    try {
        const documentIds = fileToDeactivate.operation_files.map((file) => file.upload_documents_id);

        const updateQuery = `
            UPDATE upload_documents
            SET training_state = $2, updated_by = $1, update_time = NOW()
            WHERE id = ANY($3)
        `;

        await sql.query(updateQuery, [userNo, 8, documentIds]);

        const pythonUploadResult = await pythonAPI.updateDocumentStatus(fileToDeactivate, process.env.PYTHON_API_HOST);

        if (pythonUploadResult.data.code !== 200) {
            throw new Error("Python API 檔案刪除失敗");
        }

        return { message: "文檔已成功停用", code: 0 };
    } catch (error) {
        console.error("停用文檔時發生錯誤:", error);
        return { message: "停用文檔失敗", code: 1, error: error.message };
    }
}

module.exports = { checkAndDeleteExpiredCache };
