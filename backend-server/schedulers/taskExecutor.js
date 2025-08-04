const sql = require("../db/pgsql");
const { deactivateDocuments } = require("./document");
const {
    processSyncCrawler,
    processDeleteCrawlerDocuments,
    processDeleteCrawlerAttachmentFiles,
} = require("./crawler/crawler");
const { processSyncCrawlerAttachment } = require("./crawler/crawlerAttachment");

const { groupBy } = require("./crawler/crawlerUtils");
const { processClearCacheTasks } = require("./cache");
require("../utils/log-utils.js");

async function executeBatchTasks(tasks, client) {
    // 將任務分類
    const expiredDocumentTasks = tasks.filter((task) => task.operation === "checkExpiredDocuments");
    const syncCrawlerTasks = tasks.filter((task) => task.operation === "syncCrawlers");
    const clearCacheTasks = tasks.filter((task) => task.operation === "clearCache");
    const deleteCrawlerDocumentsTasks = tasks.filter((task) => task.operation === "deleteCrawlerDocuments");
    const deleteCrawlerAttachmentFilesTasks = tasks.filter((task) => task.operation === "deleteCrawlerAttachmentFiles");
    const syncCrawlerAttachmentTasks = tasks.filter((task) => task.operation === "syncCrawlersAttachment");
    const feedbacksClassifyTasks = tasks.filter((task) => task.operation === "feedbacksClassify");
    // 更新所有任務的狀態為 'processing'
    const taskIds = tasks.map((task) => task.id);

    await client.query(
        `
        UPDATE task_operations 
        SET status = 'processing' 
        WHERE id = ANY($1)
    `,
        [taskIds]
    );

    // 處理 checkExpiredDocuments 任務
    if (expiredDocumentTasks.length > 0) {
        console.log("準備處理 expiredDocumentTasks (刪除過期文件)");
        const batchParams = {
            folder_name: expiredDocumentTasks[0].params.folder_name,
            operation_files: expiredDocumentTasks.map((task) => ({
                upload_documents_id: task.params.document_id,
                is_delete: 1,
                updated_by: "system",
            })),
        };

        try {
            const result = await deactivateDocuments(batchParams, "system", client);
            if (result.code === 0) {
                await client.query(
                    `
                    UPDATE task_operations 
                    SET status = 'completed' 
                    WHERE id = ANY($1)
                `,
                    [expiredDocumentTasks.map((task) => task.id)]
                );
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error(`Error executing batch expired document tasks:`, error);
            await client.query(
                `
                UPDATE task_operations 
                SET status = 'failed', retry_count = retry_count + 1 
                WHERE id = ANY($1)
            `,
                [expiredDocumentTasks.map((task) => task.id)]
            );
        }
    }

    // 處理 syncCrawlers 任務
    if (syncCrawlerTasks.length > 0) {
        console.log("準備處理 syncCrawlerTasks (同步爬蟲)");
        const taskGroups = groupBy(syncCrawlerTasks, (task) => task.params.dataset_id);
        for (const [datasetsId, tasks] of taskGroups) {
            const crawlerIds = tasks.map((task) => task.params.crawler_id);
            const datasourceId = tasks[0].params.datasource_id;

            try {
                const result = await processSyncCrawler({
                    crawlerIds,
                    datasetsId,
                    datasourceId,
                    client,
                });

                if (result.result === "success") {
                    await client.query(
                        `
                        UPDATE task_operations
                        SET status = 'completed'
                        WHERE id = ANY($1)
                    `,
                        [tasks.map((task) => task.id)]
                    );
                } else {
                    throw new Error("排程同步爬蟲過程出錯: ", result.error);
                }
            } catch (error) {
                console.error(`排程同步爬蟲過程出錯:`, error);
                await client.query(
                    `
                    UPDATE task_operations
                    SET status = 'failed', retry_count = retry_count + 1
                    WHERE id = ANY($1)
                `,
                    [tasks.map((task) => task.id)]
                );
                continue;
            }
        }
    }

    // 處理 syncCrawlerAttachmentTasks 任務
    if (syncCrawlerAttachmentTasks.length > 0) {
        console.log("準備處理 syncCrawlerAttachmentTasks (同步爬蟲)");
        const taskGroups = groupBy(syncCrawlerAttachmentTasks, (task) => task.params.dataset_id);
        for (const [datasetsId, tasks] of taskGroups) {
            const crawlerIds = tasks.map((task) => task.params.crawler_id);
            const datasourceId = tasks[0].params.datasource_id;

            try {
                const result = await processSyncCrawlerAttachment({
                    crawlerIds,
                    datasetsId,
                    datasourceId,
                    client,
                });

                if (result.result === "success") {
                    await client.query(
                        `
                        UPDATE task_operations
                        SET status = 'completed'
                        WHERE id = ANY($1)
                    `,
                        [tasks.map((task) => task.id)]
                    );
                } else {
                    throw new Error("排程同步爬蟲過程出錯: ", result.error);
                }
            } catch (error) {
                console.error(`排程同步爬蟲過程出錯:`, error);
                await client.query(
                    `
                    UPDATE task_operations
                    SET status = 'failed', retry_count = retry_count + 1
                    WHERE id = ANY($1)
                `,
                    [tasks.map((task) => task.id)]
                );
                continue;
            }
        }
    }

    // 處理 clearCache 任務
    if (clearCacheTasks.length > 0) {
        console.log("準備處理 clearCacheTasks (刪除專家 cache)");

        const taskGroups = groupBy(clearCacheTasks, (task) => task.params.expert_id);

        for (const [expertId, tasks] of taskGroups) {
            try {
                const cacheIds = tasks.map((task) => task.params.cache_id);
                const result = await processClearCacheTasks(expertId, cacheIds, client);

                if (result.code === 0) {
                    await client.query(
                        `
                    UPDATE task_operations 
                    SET status = 'completed' 
                    WHERE id = ANY($1)
                `,
                        [tasks.map((task) => task.id)]
                    );
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error(`Error executing clear cache tasks for expert ${expertId}:`, error);
                await client.query(
                    `
                UPDATE task_operations 
                SET status = 'failed', retry_count = retry_count + 1 
                WHERE id = ANY($1)
            `,
                    [tasks.map((task) => task.id)]
                );
            }
        }
    }

    // 處理 deleteCrawlerDocuments 任務
    if (deleteCrawlerDocumentsTasks.length > 0) {
        try {
            console.log("準備處理 deleteCrawlerDocumentsTasks (刪除爬蟲文件)");
            const taskGroups = groupBy(deleteCrawlerDocumentsTasks, (task) => task.params.folder_path);

            for (const [folderPath, tasks] of taskGroups) {
                const crawlerDocumentsIds = tasks.map((task) => task.params.crawler_document_id);
                const filenames = tasks.map((task) => task.params.filename);
                const result = await processDeleteCrawlerDocuments(folderPath, crawlerDocumentsIds, filenames, client);

                if (result.code === 0) {
                    await client.query(
                        `
                        UPDATE task_operations
                        SET status = 'completed'
                        WHERE id = ANY($1)
                    `,
                        [tasks.map((task) => task.id)]
                    );
                }
            }

            console.log("taskGroups", taskGroups);
        } catch (error) {
            console.error("Error executing delete crawler documents tasks:", error);
            await client.query(
                `
                UPDATE task_operations
                SET status = 'failed', retry_count = retry_count + 1
                WHERE id = ANY($1)
            `,
                [deleteCrawlerDocumentsTasks.map((task) => task.id)]
            );
        }
    }

    // 處理 deleteCrawlerAttachmentFiles 任務
    if (deleteCrawlerAttachmentFilesTasks.length > 0) {
        try {
            console.log("準備處理 deleteCrawlerAttachmentFilesTasks (刪除爬蟲附件)");
            const taskGroups = groupBy(deleteCrawlerAttachmentFilesTasks, (task) => task.params.folder_path);

            for (const [folderPath, tasks] of taskGroups) {
                const crawlerAttachmentIds = tasks.map((task) => task.params.id);
                const filenames = tasks.map((task) => task.params.filename);
                const hash = tasks.map((task) => task.params.hash);
                const result = await processDeleteCrawlerAttachmentFiles(
                    folderPath,
                    crawlerAttachmentIds,
                    filenames,
                    hash,
                    client
                );

                if (result.code === 0) {
                    await client.query(
                        `
                        UPDATE task_operations
                        SET status = 'completed'
                        WHERE id = ANY($1)
                    `,
                        [tasks.map((task) => task.id)]
                    );
                }
            }

            console.log("taskGroups", taskGroups);
        } catch (error) {
            console.error("Error executing delete crawler documents tasks:", error);
            await client.query(
                `
                UPDATE task_operations
                SET status = 'failed', retry_count = retry_count + 1
                WHERE id = ANY($1)
            `,
                [deleteCrawlerDocumentsTasks.map((task) => task.id)]
            );
        }
    }

    // 處理 feedbackClassify 任務
    if (feedbacksClassifyTasks.length > 0) {
        console.log("準備處理 feedbackClassifyTasks (分類回報)");
        const taskGroups = groupBy(feedbacksClassifyTasks, (task) => task.params);
        for (const [params, task] of taskGroups) {
            const startDate = params.startDate;
            const endDate = params.endDate;
            const now = new Date();
            const diffTime = Math.abs(now - startDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays !== 2) {
                continue;
            }

            try {
                const result = await processFeedbacksClassify(startDate, endDate, client);
                if (result.success) {
                    await client.query(
                        `
                        UPDATE task_operations
                        SET status = 'completed'
                        WHERE id = $1
                    `,
                        task.id
                    );
                }
            } catch (error) {
                console.error(`Error executing feedback classify tasks:`, error);
                await client.query(
                    `
                    UPDATE task_operations
                    SET status = 'failed', retry_count = retry_count + 1
                    WHERE id = $1
                `,
                    task.id
                );
            }
            break;
        }
    }

    // 處理其他類型的任務
    // for (const task of otherTasks) {
    //     await executeTask(task, client);
    // }
}

async function processTasks() {
    const startTime = Date.now();
    const client = await sql.pool.connect();
    const connectionId = await client.query("SELECT pg_backend_pid()");
    const pid = connectionId.rows[0].pg_backend_pid;
    let taskCount = 0;

    try {
        await client.query("BEGIN");

        const result = await client.query(`
            SELECT * FROM task_operations
            WHERE status = 'pending'
            ORDER BY create_time ASC
            LIMIT 10
            FOR UPDATE SKIP LOCKED
        `);

        const pendingTasks = result.rows;
        taskCount = pendingTasks.length;

        await client.query("COMMIT");

        await executeBatchTasks(pendingTasks, client);
    } catch (error) {
        console.error(`[Connection ${pid}] Error in processTasks:`, error);
        await client.query("ROLLBACK");
    } finally {
        const endTime = Date.now();
        const executionTime = (endTime - startTime) / 1000;
        const timestamp = new Date().toISOString();
        await client.release();
        if (taskCount > 0) {
            console.log(
                `[${timestamp}] 資料庫連線釋放 | Connection ID: ${pid} | 執行時間: ${executionTime}秒 | 處理任務數: ${taskCount} | 間隔執行時間: ${process.env.TASK_EXECUTION_INTERVAL}秒`
            );
        }
    }
}

function startExecutor() {
    console.log("Task executor started.");
    const TASK_EXECUTION_INTERVAL = +process.env.TASK_EXECUTION_INTERVAL * 1000 || 3000;
    const HEARTBEAT_INTERVAL = 60 * 1000; // 心跳間隔，一分鐘一次
    let hasSentReady = false;
    console.log(`排程每 ${TASK_EXECUTION_INTERVAL / 1000} 秒執行一次任務`);

    // 心跳機制
    const heartbeat = setInterval(() => {
        process.send({ type: "heartbeat", timestamp: Date.now() });
    }, HEARTBEAT_INTERVAL);

    function processTasksWrapper() {
        try {
            processTasks(); // 執行任務邏輯
            if (!hasSentReady) {
                process.send("ready"); // 第一次執行成功後通知父進程
                hasSentReady = true; // 確保只發送一次
            }
        } catch (error) {
            console.error("Error during task execution:", error);
        }
    }

    setInterval(processTasksWrapper, TASK_EXECUTION_INTERVAL); // 每 TASK_EXECUTION_INTERVAL 秒執行一次

    // 確保在進程退出時清除心跳
    process.on("exit", () => {
        clearInterval(heartbeat);
        console.log("Task executor is exiting, heartbeat stopped.");
    });
}

startExecutor();
