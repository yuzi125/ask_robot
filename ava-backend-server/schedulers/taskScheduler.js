const sql = require("../db/pgsql");

const {
    checkAndSyncCrawlers,
    checkAndDeleteCrawlerDocuments,
    checkAndSyncCrawlersAttachment,
    checkAndDeleteCrawlerAttachmentFiles,
} = require("./crawler/crawlerUtils");
const { checkAndDeleteExpiredDocuments } = require("./documentUtils");
const { checkAndDeleteExpiredCache } = require("./cacheUtils");
require("../utils/log-utils.js");
async function checkAndCreateTasks(taskId) {
    const client = await sql.pool.connect();
    try {
        await client.query("BEGIN");

        // 檢查任務是否存在並且是啟用的
        const taskResult = await client.query("SELECT * FROM cron_tasks WHERE id = $1 AND is_active = TRUE", [taskId]);
        const task = taskResult.rows[0];

        if (!task) {
            console.log(`Task ${taskId} not found or not active.`);
            return;
        }

        if (task.function_name === "checkExpiredDocuments") {
            // console.log("check");
            await checkAndDeleteExpiredDocuments(task, client);
        } else if (task.function_name === "syncCrawlers") {
            // console.log("sync");
            await checkAndSyncCrawlers(task, client);
        } else if (task.function_name === "syncCrawlersAttachment") {
            await checkAndSyncCrawlersAttachment(task, client);
        } else if (task.function_name === "clearCache") {
            await checkAndDeleteExpiredCache(task, client);
        } else if (task.function_name === "deleteCrawlerDocuments") {
            await checkAndDeleteCrawlerDocuments(task, client);
        } else if (task.function_name === "deleteCrawlerAttachmentFiles") {
            await checkAndDeleteCrawlerAttachmentFiles(task, client);
        } else if (task.function_name === "feedbacksClassify") {
            await checkAndSyncFeedbacksClassify(task, client);
        }

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(`Error in checkAndCreateTasks for task ${taskId}:`, error);
    } finally {
        await client.release();
    }
}

async function setupScheduler() {
    const client = await sql.pool.connect();
    let hasSentReady = false;
    try {
        // 取得主要的任務設定
        const tasksResult = await client.query("SELECT * FROM cron_tasks WHERE is_active = TRUE");
        const tasks = tasksResult.rows;

        // 設定任務排程 會根據 interval 的設定來決定任務的執行頻率
        // 每個 interval 秒執行一次 checkAndCreateTasks
        tasks.forEach((task) => {
            console.log(`Scheduling task: ${task.task_name} (${task.id}) to run every ${task.interval} seconds.`);
            setInterval(() => checkAndCreateTasks(task.id), task.interval * 1000);
        });

        console.log("Task scheduler setup completed.");
        if (!hasSentReady) {
            process.send("ready"); // 確保只發送一次
            hasSentReady = true;
        }
    } catch (error) {
        console.error("Error setting up scheduler:", error);
    } finally {
        await client.release();
    }
}

setupScheduler();
