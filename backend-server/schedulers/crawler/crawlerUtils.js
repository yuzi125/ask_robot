async function checkAndSyncCrawlers(task, client) {
    const now = new Date();
    const syncResult = await client.query(
        `
        SELECT * FROM crawler_sync_schedule
        WHERE is_active = TRUE AND next_sync_date <= $1
        `,
        [now]
    );

    for (const schedule of syncResult.rows) {
        // 創建同步爬蟲任務
        await client.query(
            `
            INSERT INTO task_operations (id, cron_task_id, operation, status, params)
            VALUES (gen_random_uuid(), $1, $2, 'pending', $3)
        `,
            [
                task.id,
                task.function_name,
                JSON.stringify({
                    dataset_id: schedule.dataset_id,
                    datasource_id: schedule.datasource_id,
                    crawler_id: schedule.crawler_id,
                }),
            ]
        );

        // 計算下一次同步時間
        const nextSyncDate = calculateNextSyncDate(schedule.sync_days, schedule.sync_time);

        // 更新下一次同步時間
        await client.query(
            `
            UPDATE crawler_sync_schedule
            SET next_sync_date = $1
            WHERE id = $2
        `,
            [nextSyncDate, schedule.id]
        );
    }
}

async function checkAndSyncCrawlersAttachment(task, client) {
    const now = new Date();
    const syncResult = await client.query(
        `
        SELECT * FROM crawler_attachment_sync_schedule
        WHERE is_active = TRUE AND next_sync_date <= $1
        `,
        [now]
    );

    for (const schedule of syncResult.rows) {
        // 創建同步爬蟲附件任務
        await client.query(
            `
            INSERT INTO task_operations (id, cron_task_id, operation, status, params)
            VALUES (gen_random_uuid(), $1, $2, 'pending', $3)
        `,
            [
                task.id,
                task.function_name,
                JSON.stringify({
                    dataset_id: schedule.dataset_id,
                    datasource_id: schedule.datasource_id,
                    crawler_id: schedule.crawler_id,
                }),
            ]
        );

        // 計算下一次同步時間
        const nextSyncDate = calculateNextSyncDate(schedule.sync_days, schedule.sync_time);

        // 更新下一次同步時間
        await client.query(
            `
            UPDATE crawler_attachment_sync_schedule
            SET next_sync_date = $1
            WHERE id = $2
        `,
            [nextSyncDate, schedule.id]
        );
    }
}

async function checkAndDeleteCrawlerDocuments(task, client) {
    try {
        // 計算30天前的時間點
        const result = await client.query(`
            WITH ExpiredDocuments AS (
                SELECT 
                    id,
                    crawler_documents_id,
                    meta_data->>'filename' as filename,
                    meta_data->>'upload_folder_id' as folder_path
                FROM crawler_documents_content
                WHERE training_state = 6
                AND update_time < NOW() - INTERVAL '30 days'
                LIMIT 1000  -- 限制每次處理的數量
            )
            SELECT * FROM ExpiredDocuments
        `);

        const expiredDocs = result.rows;
        console.log(`找到 ${expiredDocs.length} 筆需要刪除的爬蟲文件`);

        // 為每個過期文件創建任務
        for (const doc of expiredDocs) {
            await client.query(
                `
                INSERT INTO task_operations (
                    id,
                    cron_task_id,
                    operation,
                    status,
                    params
                ) VALUES (
                    gen_random_uuid(),
                    $1,
                    $2,
                    'pending',
                    $3
                )
            `,
                [
                    task.id,
                    task.function_name,
                    JSON.stringify({
                        crawler_document_content_id: doc.id,
                        crawler_document_id: doc.crawler_documents_id,
                        folder_path: doc.folder_path,
                        filename: doc.filename,
                    }),
                ]
            );
        }

        console.log(`已創建 ${expiredDocs.length} 個刪除爬蟲文件任務`);
    } catch (error) {
        console.error("檢查需要刪除的爬蟲文件時發生錯誤:", error);
        throw error;
    }
}

async function checkAndDeleteCrawlerAttachmentFiles(task, client) {
    try {
        // 計算30天前的時間點
        const result = await client.query(`
            WITH ExpiredDocuments AS (
                SELECT 
                    id,
                    filename,
                    upload_folder_id as folder_path,
                    hash
                FROM crawler_attachment
                WHERE training_state = 6
                AND update_time < NOW() - INTERVAL '30 days'
                LIMIT 1000  -- 限制每次處理的數量
            )
            SELECT * FROM ExpiredDocuments
        `);

        const expiredDocs = result.rows;
        console.log(`找到 ${expiredDocs.length} 筆需要刪除的爬蟲附件`);

        // 為每個過期文件創建任務
        for (const doc of expiredDocs) {
            await client.query(
                `
                    INSERT INTO task_operations (
                        id,
                        cron_task_id,
                        operation,
                        status,
                        params
                    ) VALUES (
                        gen_random_uuid(),
                        $1,
                        $2,
                        'pending',
                        $3
                    )
                `,
                [
                    task.id,
                    task.function_name,
                    JSON.stringify({
                        id: doc.id,
                        folder_path: doc.folder_path,
                        filename: doc.filename,
                        hash: doc.hash,
                    }),
                ]
            );
        }

        console.log(`已創建 ${expiredDocs.length} 個刪除爬蟲附件任務`);
    } catch (error) {
        console.error("檢查需要刪除的爬蟲文件時發生錯誤:", error);
        throw error;
    }
}

function calculateNextSyncDate(syncDays, syncTime) {
    const now = new Date();
    const nextSyncDate = new Date(now.getTime() + syncDays * 24 * 60 * 60 * 1000);
    const [hours, minutes] = syncTime.split(":");
    nextSyncDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    // 如果計算出的下一次同步時間早於現在，再加一個週期
    if (nextSyncDate <= now) {
        nextSyncDate.setDate(nextDate.getDate() + syncDays);
    }

    return nextSyncDate;
}

function groupBy(array, keyGetter) {
    const map = new Map();
    array.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    });
    return map;
}
module.exports = {
    checkAndSyncCrawlers,
    calculateNextSyncDate,
    checkAndSyncCrawlersAttachment,
    checkAndDeleteCrawlerDocuments,
    checkAndDeleteCrawlerAttachmentFiles,
    groupBy,
};
