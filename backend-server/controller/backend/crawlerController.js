const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const axios = require("axios");
const pythonAPI = require("../../utils/pythonAPI");

const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createFolder, createCrawlerFolder } = require("../../global/backend_upload");
const { logActivity, AUDIT_LOG_ACTION_TYPE, AUDIT_LOG_ENTITY_TYPE } = require("../../utils/auditLog");

const { fork } = require("child_process");
const moment = require("moment-timezone");

const { Op, literal } = require("sequelize");
const sequelize = require("../../orm/sequelize");
const CrawlerSynchronize = require("../../orm/schema/crawler_synchronize");
const CrawlerAttachmentSynchronize = require("../../orm/schema/crawler_attachment_synchronize");
const Datasource = require("../../orm/schema/datasource");
const CrawlerDocumentsContent = require("../../orm/schema/crawler_documents_content");
const CrawlerAttachment = require("../../orm/schema/crawler_attachment");
const { segmentContentForTsquery } = require("../../utils/common");
const logRouteDetails = require("../routeNameLog");
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;
const CrawlerDocumentsExtra = require("../../orm/schema/crawler_documents_extra");
const CrawlerDocuments = require("../../orm/schema/crawler_documents");
const AUDIT_LOG_TARGET_CATEGORY = "crawler";

// 同步爬蟲區塊 --------------------------------------

exports.list = async function (req, res) {
    // logRouteDetails("crawlerController.list", req);
    let rsmodel = new responseModel();
    try {
        const { datasetsId, type } = req.query;
        const syncTableName = type === "attachment" ? "crawler_attachment_synchronize" : "crawler_synchronize";
        // console.info("crawlerController.list: ", datasetsId);
        let query, rs;
        query = {
            text: "select id from datasource where datasets_id = $1 and type = $2",
            values: [datasetsId, "B"],
        };
        rs = await sql.query(query);
        const datasourceId = rs.rows[0]?.id;

        if (!datasourceId) {
            query = {
                text: `
                    select 
                        id, 
                        title, 
                        domain, 
                        create_time as update_time
                        ${type === "attachment" ? ", download_attachment" : ""} 
                    from 
                        crawler 
                    where
                        crawler.is_show = 1
                        ${type === "attachment" ? "AND download_attachment = 1" : ""}
                `,
            };
            rs = await sql.query(query);
            rs = rs.rows;
        } else {
            query = {
                text: `
                    select 
                        id, 
                        title, 
                        domain, 
                        alias,
                        create_time as update_time,
                        site_id
                        ${type === "attachment" ? ",download_attachment" : ""}
                    from 
                        crawler 
                    where
                        crawler.is_show = 1
                        ${type === "attachment" ? "AND download_attachment = 1" : ""}
                `,
            };
            rs = await sql.query(query);
            const crawlerList = rs.rows;

            // create_time 最新的優先
            query = {
                text: `
                    select 
                        id, 
                        crawler_id, 
                        create_time as last_time, 
                        training_state
                    from 
                        ${syncTableName} 
                    where 
                        datasource_id = $1 
                        and training_state in (1, 2, 3, 4, 5, 98,99) 
                    order by create_time desc
                `,
                values: [datasourceId],
            };
            rs = await sql.query(query);
            const synchronizeResults = rs.rows;

            // 結合 crawlerList 和 synchronizeResults 的資料
            rs = crawlerList.map((m) => {
                // 因為是由 create_time 排序，所以取第一筆就是最新同步的那一筆。
                let crawlerInfo = synchronizeResults.find((f) => f.crawler_id === m.id);
                return {
                    id: m.id,
                    title: m.title,
                    update_time: m.update_time,
                    domain: m.alias || m.domain,
                    last_time: crawlerInfo?.last_time || null,
                    training_state: crawlerInfo?.training_state || null,
                    sync_id: crawlerInfo?.id || null,
                    site_id: m.site_id,
                };
            });

            rs.sort((a, b) => (b.training_state || 0) - (a.training_state || 0));
        }

        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.uploadFolder = async function (req, res) {
    logRouteDetails("crawlerController.uploadFolder", req);
    let rsmodel = new responseModel();
    try {
        const { datasetsId } = req.query;
        console.info("crawlerController.uploadFolder: ", datasetsId);
        const queryText = "SELECT * FROM upload_folder WHERE datasource_id = $1";
        const result = await sql.query(queryText, [datasetsId]);
        // createFolder(folderName, "B");

        rsmodel.data = result.rows;
        rsmodel.code = 0;
    } catch (e) {
        rsmodel.code = 1;
        rsmodel.message = e.message;
        console.error(e);
    }
    res.json(rsmodel);
};

exports.addCrawlerToCrawlerList = async function (req, res) {
    logRouteDetails("crawlerController.addCrawlerToCrawlerList", req);
    let rsmodel = new responseModel();
    try {
        const datasource_type = "B";
        const { crawlerIds, datasetsId, folder } = JSON.parse(req.body);
        console.info("crawlerController.addCrawlerToCrawlerList: ", JSON.parse(req.body));
        const folder_name = folder && folder.name ? folder.name : "";
        let datasource_id = "";

        // 1.  拿 datasets_id 去檢查 datasource 資料表是否有資料
        let rs = await sql.query(
            "select a.id datasource_id,b.id upload_folder_id from datasource a left join upload_folder b on a.id = b.datasource_id where a.datasets_id = $1 and a.type = 'B'",
            [datasetsId]
        );

        rs = rs.rows[0];

        // 1.1 沒有的話，新增一筆資料，並且 type 為 B。
        if (!rs || !rs.datasource_id) {
            datasource_id = uuidv4();
            await sql.query("insert into datasource(id,datasets_id,type,is_enable) values($1,$2,$3,$4)", [
                datasource_id,
                datasetsId,
                datasource_type,
                1,
            ]);
        } else {
            // 有的話就直接取得
            datasource_id = rs.datasource_id;
        }

        // 2. 針對每個 crawlerId 處理
        for (let crawlerId of crawlerIds) {
            // 拿 crawlerId 去 crawler 表找到 id 對應的 config_jsonb
            rs = await sql.query("select config_jsonb from crawler where id = $1", [crawlerId]);
            const crawlerConfigJsonb = rs.rows[0]?.config_jsonb;

            // 先新增一筆同步資料到 crawler_synchronize 並且 training_state 設為 1 (代表爬蟲正在爬)
            // 把 datasource_id, crawler_id, training_state, config_jsonb 新增至 crawler_synchronize 資料表。
            await sql.query(
                "insert into crawler_synchronize (config_jsonb,datasource_id,crawler_id,training_state) values($1,$2,$3,$4) returning id",
                [crawlerConfigJsonb, datasource_id, crawlerId, 1]
            );
        }

        rsmodel.code = 0;
        rsmodel.message = "新增爬蟲成功";
    } catch (error) {
        console.error(error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};

exports.syncCrawler = async function (req, res) {
    logRouteDetails("crawlerController.syncCrawler", req);
    let rsmodel = new responseModel();

    // 要記錄 crawlerId 和 syncId 的對應關係
    let crawlerSyncArray = [];

    let crawlerSiteIds = [];

    try {
        /**
         * 1. 拿 datasets_id 去檢查 datasource 資料表是否有資料
         * 1.1 沒有的話，新增一筆資料，並且 type 為 B。
         * 1.2 在知識庫的 folder_name 資料夾底下建立一個 crawler 的資料夾。
         * 1.3 要是前端的 folder_name 有傳送值過來的話，
         *     就去 upload_folder 資料表新增一筆資料，並且拿這筆新的資料 id 當它的 folder_name。
         * 2.  把 datasource_id, crawler_id, training_state, config_jsonb 新增至 crawler_synchronize 資料表，
         *     並且把 training_state 設為 2。
         * 3.  先拿測試的 json 檔案(crawler_json 資料夾)，並且放到指定的資料夾中。
         */
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        const datasource_type = "B";

        const { crawlerIds, datasetsId, folder, test, type } = JSON.parse(req.body);
        console.info("crawlerController.syncCrawler: ", JSON.parse(req.body));

        const folder_name = folder && folder.name ? folder.name : "";
        let rs, query;
        let datasource_id = "";
        let upload_folder_id = "";
        // 1.  拿 datasets_id 去檢查 datasource 資料表是否有資料
        rs = await sql.query(
            "select a.id datasource_id,b.id upload_folder_id from datasource a left join upload_folder b on a.id = b.datasource_id where a.datasets_id = $1 and a.type = 'B'",
            [datasetsId]
        );

        rs = rs.rows[0];

        // 1.1 沒有的話，新增一筆資料，並且 type 為 B。
        if (!rs || !rs.datasource_id) {
            datasource_id = uuidv4();
            await sql.query("insert into datasource(id,datasets_id,type,is_enable) values($1,$2,$3,$4)", [
                datasource_id,
                datasetsId,
                datasource_type,
                1,
            ]);
        } else {
            // 有的話就直接取得
            datasource_id = rs.datasource_id;
        }

        // 1.2. 透過 datasets_id 撈出 folder_name，並新增資料夾。
        rs = await sql.query("select folder_name from datasets where id = $1", [datasetsId]);
        const datasetsFolderName = rs.rows[0]?.folder_name;
        upload_folder_id = datasetsFolderName;

        //createFolder 會檢查有沒有這個資料夾 沒有的話就新增
        createFolder(datasetsFolderName, datasource_type);

        /**
         * 1.3 要是前端的 folder_name 有傳送值過來的話，
         *     就去 upload_folder 資料表新增一筆資料，並且拿這筆新的資料 id 當它的 folder_name。
         */

        if (folder_name) {
            // 檢查 folder_name 是否已經存在於 upload_folder 資料表中
            rs = await sql.query("select id from upload_folder where name = $1 and datasource_id = $2", [
                folder_name,
                datasource_id,
            ]);

            if (rs.rows.length > 0) {
                // 如果存在，直接使用現有的 upload_folder_id
                upload_folder_id = rs.rows[0].id;
            } else {
                // 如果不存在，新增新的資料夾記錄並建立資料夾
                upload_folder_id = uuidv4();
                await sql.query("insert into upload_folder(id,datasource_id,name) values($1,$2,$3)", [
                    upload_folder_id,
                    datasource_id,
                    folder_name,
                ]);
                createCrawlerFolder(datasetsFolderName, datasource_type, upload_folder_id);
            }
        }
        // --------------- 這邊開始有處理複數筆資料的問題 -------------------
        // crawlerId 現在會是一個陣列
        // 拿 datasource_id 和 crawler_id 去 crawler_synchronize 表找到全部的 id

        // 處理每一個爬蟲 ID
        let previousCrawlerDocumentsContentHashMap = new Map();

        console.log("正在新增爬蟲同步資料");
        for (let crawlerId of crawlerIds) {
            rs = await sql.query("SELECT site_id FROM crawler WHERE id = $1", [crawlerId]);
            const siteId = rs.rows[0]?.site_id;
            crawlerSiteIds.push(siteId);

            rs = await sql.query("SELECT id FROM crawler_synchronize WHERE datasource_id = $1 AND crawler_id = $2", [
                datasource_id,
                crawlerId,
            ]);

            const previousCrawlerSynchronizeIds = rs.rows.map((m) => +m.id);

            if (previousCrawlerSynchronizeIds.length > 0) {
                rs = await sql.query(
                    "SELECT crawler_synchronize_id, crawler_documents_id, hash FROM crawler_documents_content WHERE crawler_synchronize_id = ANY($1::bigint[]) and (crawler_documents_content.training_state = 3 or crawler_documents_content.training_state = 4)",
                    [previousCrawlerSynchronizeIds]
                );

                // 記錄已經存在資料庫的 hash 到時候要比對重複用的
                rs.rows.forEach((item) => {
                    const { crawler_synchronize_id, crawler_documents_id, hash } = item;
                    const key = `${siteId}|${crawlerId}|${hash}`;
                    previousCrawlerDocumentsContentHashMap.set(key, {
                        crawler_synchronize_id,
                        crawler_documents_id,
                    });
                });
            }

            rs = await sql.query("select config_jsonb from crawler where id = $1", [crawlerId]);
            const crawlerConfigJsonb = rs.rows[0]?.config_jsonb;

            rs = await sql.query(
                "insert into crawler_synchronize (config_jsonb,datasource_id,crawler_id,training_state) values($1,$2,$3,$4) returning id",
                [crawlerConfigJsonb, datasource_id, crawlerId, 1]
            );

            const crawler_synchronize_id = +rs.rows[0]?.id;
            if (!crawler_synchronize_id) return res.json(rsmodel);

            crawlerSyncArray.push({ crawlerId, siteId, crawler_synchronize_id }); // 將 crawlerId 和對應的 crawler_synchronize_id 存入陣列物件

            // await sql.query(
            //     "update crawler_synchronize set training_state = $1 where id = $2 and datasource_id = $3 and crawler_id = $4",
            //     [2, crawler_synchronize_id, datasource_id, crawlerId]
            // );
        }
        console.log("爬蟲同步資料新增完成");

        rsmodel.code = 0;
        // res.json(rsmodel);

        const serializedHashMap = Object.fromEntries(previousCrawlerDocumentsContentHashMap);

        try {
            const backgroundProcess = fork(path.join(__dirname, "backgroundProcess.js"));
            backgroundProcess.send({
                crawlerSyncArray, // 傳遞陣列物件給 backgroundProcess
                folder_name,
                upload_folder_id,
                datasetsFolderName,
                datasetsId,
                datasourceId: datasource_id,
                ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
                previousCrawlerDocumentsContentHashMap: serializedHashMap,
                crawlerSiteIds,
                test,
            });
        } catch (error) {
            rsmodel.code = 1;
            rsmodel.message = error.message;
            // res.json(rsmodel);
        }

        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.CREATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.CREATE_CRAWLER,
            targetId: datasetsId,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                datasets_id: datasetsId,
                crawler_ids: crawlerIds,
                crawlerSyncArray,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (error) {
        console.error("sync crawler fail", error);

        // 解析請求中的爬蟲 ID 和 datasets ID
        const { crawlerIds, datasetsId } = JSON.parse(req.body);
        console.log(crawlerIds, datasetsId);

        // 對每個 crawlerId 進行處理
        for (const crawlerId of crawlerIds) {
            let crawler_synchronize_id;

            // 確認是否有已存在的 crawler_synchronize_id
            const syncEntry = crawlerSyncArray.find((entry) => entry.crawlerId === crawlerId);
            if (syncEntry) {
                crawler_synchronize_id = syncEntry.crawler_synchronize_id;
            }

            if (crawler_synchronize_id) {
                // 更新 training_state 為 98，表示爬蟲有問題
                await sql.query("update crawler_synchronize set training_state = 98 where id = $1", [
                    crawler_synchronize_id,
                ]);
            } else {
                // 沒有 crawler_synchronize_id 時，插入一條新的記錄，並將 training_state 設為 98
                let crawlerData = await sql.query("select config_jsonb from crawler where id = $1", [crawlerId]);
                const crawlerConfigJsonb = crawlerData.rows[0]?.config_jsonb;

                await sql.query(
                    "insert into crawler_synchronize (config_jsonb, datasource_id, crawler_id, training_state) values($1, $2, $3, $4) returning id",
                    [crawlerConfigJsonb, datasetsId, crawlerId, 98]
                );
            }
        }

        rsmodel.code = 1;
        rsmodel.message = error.message;
        // res.json(rsmodel);
    }

    res.json(rsmodel);
};

exports.syncCrawlerSchedule = async function (req, res) {
    logRouteDetails("crawlerController.syncCrawlerSchedule", req);
    let rsmodel = new responseModel();
    try {
        const datasource_type = "B";
        const { crawlerIds, datasetsId, syncDays, syncTime, type } = JSON.parse(req.body);
        const syncScheduleTableName =
            type === "attachment" ? "crawler_attachment_sync_schedule" : "crawler_sync_schedule";
        // console.info("crawlerController.syncCrawlerSchedule: ", JSON.parse(req.body));
        let rs;
        let datasource_id = "";

        // 1. 檢查 datasource 資料表
        rs = await sql.query(
            "SELECT a.id datasource_id, b.id upload_folder_id FROM datasource a LEFT JOIN upload_folder b ON a.id = b.datasource_id WHERE a.datasets_id = $1 AND a.type = 'B'",
            [datasetsId]
        );
        rs = rs.rows[0];

        // 1.1 如果沒有資料，新增一筆
        if (!rs || !rs.datasource_id) {
            datasource_id = uuidv4();
            await sql.query("INSERT INTO datasource(id, datasets_id, type, is_enable) VALUES($1, $2, $3, $4)", [
                datasource_id,
                datasetsId,
                datasource_type,
                1,
            ]);
        } else {
            // 如果有資料，直接使用
            datasource_id = rs.datasource_id;
        }

        // 計算 next_sync_date
        const calculateNextSyncDate = () => {
            if (!syncDays || !syncTime) return null;

            const now = moment.tz("Asia/Taipei");
            const nextSyncDate = now.add(syncDays, "days");
            const [hours, minutes] = syncTime.split(":");
            nextSyncDate.set({ hour: parseInt(hours, 10), minute: parseInt(minutes, 10), second: 0 });
            return nextSyncDate.format("YYYY-MM-DD HH:mm:ss");
        };

        const next_sync_date = calculateNextSyncDate();

        // 為每個 crawlerId 插入或更新排程記錄
        for (let crawlerId of crawlerIds) {
            // 檢查是否已經存在該 crawlerId 和 datasetsId 的排程
            const existingSchedule = await sql.query(
                `SELECT id FROM ${syncScheduleTableName} WHERE dataset_id = $1 AND crawler_id = $2`,
                [datasetsId, crawlerId]
            );

            if (existingSchedule.rows.length > 0) {
                // 如果已經存在，則進行更新
                await sql.query(
                    `UPDATE ${syncScheduleTableName} SET sync_days = $1, sync_time = $2, next_sync_date = $3 WHERE dataset_id = $4 AND crawler_id = $5`,
                    [syncDays || null, syncTime || null, next_sync_date, datasetsId, crawlerId]
                );
            } else {
                // 如果不存在，則插入新的記錄

                await sql.query(
                    `INSERT INTO ${syncScheduleTableName} (dataset_id, datasource_id, crawler_id, sync_days, sync_time, next_sync_date) VALUES($1, $2, $3, $4, $5, $6)`,
                    [datasetsId, datasource_id, crawlerId, syncDays || null, syncTime || null, next_sync_date]
                );
            }
        }

        rsmodel.code = 0;
        rsmodel.message = "爬蟲排程設定成功";
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};

exports.deleteCrawlerSchedule = async function (req, res) {
    logRouteDetails("crawlerController.deleteCrawlerSchedule", req);
    let rsmodel = new responseModel();
    try {
        const { datasetsId, crawlerIds, type } = JSON.parse(req.body);
        console.info("crawlerController.deleteCrawlerSchedule: ", JSON.parse(req.body));
        const syncScheduleTableName =
            type === "attachment" ? "crawler_attachment_sync_schedule" : "crawler_sync_schedule";
        // 將 sync_days, sync_time 和 next_sync_date 設定為 NULL
        await sql.query(
            `UPDATE ${syncScheduleTableName} SET sync_days = NULL, sync_time = NULL, next_sync_date = NULL WHERE dataset_id = $1 AND crawler_id = ANY($2)`,
            [datasetsId, crawlerIds]
        );

        rsmodel.code = 0;
        rsmodel.message = "成功更新爬蟲排程";
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error);
    }

    res.json(rsmodel);
};

exports.getCrawlerScheduleList = async function (req, res) {
    logRouteDetails("crawlerController.getCrawlerScheduleList", req);
    let rsmodel = new responseModel();

    try {
        const { datasets_id } = req.params;
        const { type } = req.query;
        const tableName = type === "attachment" ? "crawler_attachment_sync_schedule" : "crawler_sync_schedule";

        let query = `
            SELECT csc.id, d.name, d.id AS dataset_id, c.title, csc.crawler_id, 
                   csc.sync_days, csc.sync_time, csc.next_sync_date 
            FROM ${tableName} csc
            LEFT JOIN crawler c ON csc.crawler_id = c.id
            LEFT JOIN datasets d ON csc.dataset_id = d.id
            WHERE d.is_enable = 1
        `;

        const params = datasets_id ? [datasets_id] : [];
        if (datasets_id) query += " AND csc.dataset_id = $1";

        const rs = await sql.query(query, params);
        res.json({ code: 0, message: "取得爬蟲排程列表成功", data: rs.rows });
    } catch (error) {
        res.json({ code: 1, message: error.message });
    }
};

exports.getCrawlerSiteSyncSettings = async function (req, res) {
    logRouteDetails("crawlerController.getCrawlerSiteSyncSettings", req);
    let rsmodel = new responseModel();
    try {
        const { datasetsId, crawlerId, type } = req.query;
        console.info("crawlerController.getCrawlerSiteSyncSettings: ", req.query);

        let rs, query;
        const syncScheduleTableName =
            type === "attachment" ? "crawler_attachment_sync_schedule" : "crawler_sync_schedule";
        console.log("syncScheduleTableName", syncScheduleTableName);
        query = {
            text: `
                SELECT css.sync_days, css.sync_time 
                FROM ${syncScheduleTableName} css
                LEFT JOIN datasets d ON css.dataset_id = d.id
                WHERE css.dataset_id = $1 
                AND css.crawler_id = $2
                AND d.is_enable = 1
            `,
            values: [datasetsId, crawlerId],
        };
        rs = await sql.query(query);

        rsmodel.data = rs.rows[0];
        rsmodel.code = 0;
        rsmodel.message = "取得爬蟲同步設定成功";
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error);
    }

    res.json(rsmodel);
};

// 取得爬蟲同步後的清單
exports.getSyncCrawlerList = async function (req, res) {
    logRouteDetails("crawlerController.getSyncCrawlerList", req);
    let rsmodel = new responseModel();
    try {
        const datasets_id = req.params.datasets_id;
        const type = req.query.type;
        // console.info("crawlerController.getSyncCrawlerList: ", datasets_id);
        let query, rs;

        const syncTableName = type === "attachment" ? "crawler_attachment_synchronize" : "crawler_synchronize";
        const syncScheduleTableName =
            type === "attachment" ? "crawler_attachment_sync_schedule" : "crawler_sync_schedule";
        const crawlerTasksTableName = type === "attachment" ? "crawler_attachment_tasks" : "crawler_tasks";
        // 獲取與數據集關聯的 datasource_id
        query = {
            text: "SELECT id FROM datasource WHERE datasets_id = $1 AND type = $2",
            values: [datasets_id, "B"],
        };
        rs = await sql.query(query);
        const datasource_id = rs.rows[0]?.id;
        if (!datasource_id) {
            rsmodel.code = 0;
            rsmodel.data = [];
            return res.json(rsmodel);
        }

        // 查詢 crawler_synchronize 以及關聯的 crawler_tasks 中的單一 spider_uuid (task_id)
        query = {
            text: `
                       WITH tempSync AS (
                    SELECT 
                        cs.id AS sync_id, 
                        cs.crawler_id, 
                        cs.training_state, 
                        cs.create_time AS last_time, 
                        c.title, 
                        c.domain, 
                        c.alias,
                        ct.spider_uuid AS task_id,
                        ct.progress ->> 'dir' AS dir,
                        css.next_sync_date,
                        ROW_NUMBER() OVER (PARTITION BY cs.crawler_id ORDER BY cs.create_time DESC) AS row_num
                    FROM 
                        ${syncTableName} cs
                    JOIN 
                        crawler c ON cs.crawler_id = c.id
                    LEFT JOIN 
                        ${crawlerTasksTableName} ct ON ct.crawler_synchronize_id = cs.id
                    LEFT JOIN 
                        ${syncScheduleTableName} css ON cs.crawler_id = css.crawler_id
                    WHERE 
                        cs.datasource_id = $1
                    AND 
                        cs.training_state IN (1, 2, 3, 4, 8, 98, 99)
                )
                SELECT 
                    sync_id, 
                    crawler_id, 
                    training_state, 
                    last_time, 
                    title, 
                    domain, 
                    alias,
                    task_id,
                    dir,
                    next_sync_date
                FROM 
                    tempSync
                WHERE 
                    row_num = 1;
            `,
            values: [datasource_id],
        };

        rs = await sql.query(query);
        const syncCrawlerList = rs.rows;

        // 保留你的排序規則
        const sortedSyncCrawlerList = syncCrawlerList.sort((a, b) => {
            // 如果 a 或 b 的 training_state 是 3，則該項目應排在最前面
            if (a.training_state === 3) return -1;
            if (b.training_state === 3) return 1;

            // 否則按照 training_state 進行排序，從小到大
            return a.training_state - b.training_state;
        });

        // 更新 rsmodel.data 為排序後的爬蟲清單
        rsmodel.data = sortedSyncCrawlerList.map((syncCrawler) => ({
            id: syncCrawler.sync_id,
            crawlerId: syncCrawler.crawler_id,
            title: syncCrawler.title,
            domain: syncCrawler.alias || syncCrawler.domain,
            last_time: syncCrawler.last_time,
            training_state: syncCrawler.training_state,
            task_id: syncCrawler.task_id, // 單一 task_id
            dir: syncCrawler.dir,
            next_sync_date: syncCrawler.next_sync_date,
        }));

        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
    }
    res.json(rsmodel);
};

exports.getSyncCrawlerListByDatasetCrawlerId = async function (req, res) {
    logRouteDetails("crawlerController.getSyncCrawlerListByDatasetCrawlerId", req);
    let rsmodel = new responseModel();
    try {
        const datasets_id = req.params.datasets_id;
        const crawler_id = req.params.crawler_id;

        // Get pagination parameters from query
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 10;
        const offset = (page - 1) * perPage;

        // Get search and filter parameters
        const searchQuery = req.query.search || "";
        const trainingStates = req.query.states ? req.query.states.split(",").map(Number) : [1, 2, 3, 4, 8, 98, 99];

        // 獲取與數據集關聯的 datasource_id
        let query = {
            text: "SELECT id FROM datasource WHERE datasets_id = $1 AND type = $2",
            values: [datasets_id, "B"],
        };
        let rs = await sql.query(query);
        const datasource_id = rs.rows[0]?.id;
        if (!datasource_id) {
            rsmodel.code = 0;
            rsmodel.data = {
                items: [],
                total: 0,
                page,
                perPage,
            };
            return res.json(rsmodel);
        }

        // First get the total count with filters but without pagination
        const countQuery = {
            text: `
                WITH tempSync AS (
                    SELECT 
                        cs.id AS sync_id, 
                        cs.crawler_id,
                        cs.training_state,
                        c.title, 
                        c.domain, 
                        c.alias
                    FROM 
                        crawler_synchronize cs
                    JOIN 
                        crawler c ON cs.crawler_id = c.id
                    WHERE 
                        cs.datasource_id = $1
                    AND 
                        cs.crawler_id = $2
                    AND 
                        cs.training_state = ANY($3)
                    AND 
                        (
                            LOWER(c.title) LIKE LOWER($4) OR
                            LOWER(COALESCE(c.alias, c.domain)) LIKE LOWER($4)
                        )
                )
                SELECT COUNT(*) FROM tempSync
            `,
            values: [datasource_id, crawler_id, trainingStates, `%${searchQuery}%`],
        };

        const countResult = await sql.query(countQuery);
        const totalItems = parseInt(countResult.rows[0].count);

        // Query crawler_synchronize with pagination
        query = {
            text: `
                WITH tempSync AS (
                    SELECT 
                        cs.id AS sync_id, 
                        cs.crawler_id, 
                        cs.training_state, 
                        cs.create_time AS last_time, 
                        cs.added_files_count,
                        cs.deleted_files_count,
                        cs.pending_delete_files_count,
                        c.title, 
                        c.domain, 
                        c.alias,
                        ct.spider_uuid AS task_id,
                        ct.progress ->> 'dir' AS dir
                    FROM 
                        crawler_synchronize cs
                    JOIN 
                        crawler c ON cs.crawler_id = c.id
                    LEFT JOIN 
                        crawler_tasks ct ON ct.crawler_synchronize_id = cs.id
                    WHERE 
                        cs.datasource_id = $1
                    AND 
                        cs.crawler_id = $2
                    AND 
                        cs.training_state = ANY($3)
                    AND 
                        (
                            LOWER(c.title) LIKE LOWER($4) OR
                            LOWER(COALESCE(c.alias, c.domain)) LIKE LOWER($4)
                        )
                )
                SELECT 
                    t.sync_id, 
                    t.crawler_id, 
                    t.training_state, 
                    t.last_time, 
                    t.title, 
                    t.domain, 
                    t.alias,
                    t.task_id,
                    t.dir,
                    t.added_files_count,
                    t.deleted_files_count,
                    t.pending_delete_files_count
                FROM 
                    tempSync t
                ORDER BY 
                    CASE WHEN t.training_state = 3 THEN 0 ELSE t.training_state END ASC,
                    t.last_time DESC
                LIMIT $5 OFFSET $6;
            `,
            values: [datasource_id, crawler_id, trainingStates, `%${searchQuery}%`, perPage, offset],
        };

        rs = await sql.query(query);
        const syncCrawlerList = rs.rows;

        // 更新 rsmodel.data 為爬蟲清單和分頁訊息
        rsmodel.data = {
            items: syncCrawlerList.map((syncCrawler) => ({
                id: syncCrawler.sync_id,
                crawlerId: syncCrawler.crawler_id,
                title: syncCrawler.title,
                domain: syncCrawler.alias || syncCrawler.domain,
                last_time: syncCrawler.last_time,
                training_state: syncCrawler.training_state,
                task_id: syncCrawler.task_id, // 單一 task_id
                dir: syncCrawler.dir,
                added_files_count: syncCrawler.added_files_count,
                deleted_files_count: syncCrawler.deleted_files_count,
                pending_delete_files_count: syncCrawler.pending_delete_files_count,
                // document_count: syncCrawler.document_count,
            })),
            total: totalItems,
            page,
            perPage,
        };

        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
        rsmodel.message = e.message;
    }
    res.json(rsmodel);
};

exports.getCrawlerSyncTrainingState = async function (req, res) {
    logRouteDetails("crawlerController.getCrawlerSyncTrainingState", req);
    let rsmodel = new responseModel();
    try {
        const sync_id = req.params.sync_id;
        console.info("crawlerController.getCrawlerSyncTrainingState: ", sync_id);

        let query, rs;
        query = {
            text: `select training_state from crawler_synchronize where id = $1`,
            values: [sync_id],
        };
        rs = await sql.query(query);
        const training_state = rs.rows[0]?.training_state;

        rsmodel.data = { training_state };
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getSyncCrawlerInfo = async function (req, res) {
    logRouteDetails("crawlerController.getSyncCrawlerInfo", req);
    let rsmodel = new responseModel();
    try {
        const crawler_sync_id = req.params.crawler_sync_id;
        // console.info("crawlerController.getSyncCrawlerInfo: ", crawler_sync_id);

        let query, rs;
        //搜索爬蟲id 後取得爬蟲資訊
        query = {
            text: `select crawler_id,create_time from crawler_synchronize where id = $1`,
            values: [crawler_sync_id],
        };
        rs = await sql.query(query);
        const crawler_id = rs.rows[0]?.crawler_id;
        const last_time = rs.rows[0]?.create_time;

        query = {
            text: `select title, domain as url from crawler where id = $1`,
            values: [crawler_id],
        };
        rs = await sql.query(query);

        const crawler_info = {
            title: rs.rows[0]?.title,
            url: rs.rows[0]?.url,
            update_time: last_time,
        };

        rsmodel.data = { crawler_info };
    } catch (error) {
        rsmodel.code = 1;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.getSyncCrawlerInfoByCrawlerId = async function (req, res) {
    logRouteDetails("crawlerController.getSyncCrawlerInfoByCrawlerId", req);
    let rsmodel = new responseModel();
    try {
        const crawler_id = req.params.crawler_id;
        query = {
            text: `select title, domain as url from crawler where id = $1`,
            values: [crawler_id],
        };
        rs = await sql.query(query);

        const crawler_info = {
            title: rs.rows[0]?.title,
            url: rs.rows[0]?.url,
        };

        rsmodel.data = { crawler_info };
    } catch (error) {
        rsmodel.code = 1;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.getSyncCrawlerContent = async function (req, res) {
    logRouteDetails("crawlerController.getSyncCrawlerContent", req);
    let rsmodel = new responseModel();
    try {
        const crawler_sync_id = req.params.crawler_sync_id;
        const datasets_id = req.params.datasets_id;
        const crawler_sync_log = req.query.crawlerSyncLog === "true";

        console.log("crawler_sync_log", crawler_sync_log);
        // console.info("crawlerController.getSyncCrawlerContent: ", crawler_sync_id, datasets_id);

        const [crawlerSync, datasource] = await Promise.all([
            CrawlerSynchronize.findOne({ where: { id: crawler_sync_id }, attributes: ["crawler_id", "create_time"] }),
            Datasource.findOne({ where: { datasets_id, type: "B" }, attributes: ["id"] }),
        ]);

        const crawler_id = crawlerSync?.crawler_id;

        if (!crawler_id) {
            rsmodel.message = "無法找到對應的爬蟲";
            return res.json(rsmodel);
        }

        const datasource_id = datasource?.id;

        if (!datasource_id) {
            rsmodel.message = "無法找到對應的 datasource";
            return res.json(rsmodel);
        }

        // 驗證 crawler_synchronize 是否屬於該 datasets_id
        const syncCount = await CrawlerSynchronize.count({
            where: { datasource_id, id: crawler_sync_id },
        });

        if (syncCount === 0) {
            rsmodel.message = "不同 datasets 的同步";
            return res.json(rsmodel);
        }

        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
        const searchTerm = req.query.searchTerm || "";
        const trainingStates = req.query.trainingStates || [];
        const offset = (page - 1) * itemsPerPage;
        const segmentedTerms = segmentContentForTsquery(searchTerm);

        // 建立條件
        const whereClause = {
            "$CrawlerSynchronize.datasource_id$": datasource_id,
            "$CrawlerSynchronize.crawler_id$": crawler_id,
        };

        // 如果是要看同步記錄的話 就需要帶入 sync id 這樣就只會拿到那一次 sync 的檔案
        if (crawler_sync_log) {
            whereClause["$CrawlerSynchronize.id$"] = crawler_sync_id;
        }

        // 使用全文檢索條件來查詢分詞後的內容
        if (searchTerm) {
            whereClause[Op.or] = [
                literal(
                    `to_tsvector('simple', content_segmented) @@ plainto_tsquery('simple', ${sequelize.escape(
                        segmentedTerms
                    )})`
                ),
            ];
        }

        // 處理 training_state 條件
        if (trainingStates.length > 0) {
            // 如果有指定 trainingStates，使用指定的值
            whereClause.training_state = {
                [Op.in]: trainingStates,
            };
        } else {
            // 如果沒有指定 trainingStates，預設排除 training_state = 9 的資料
            whereClause.training_state = {
                [Op.ne]: 9,
            };
        }

        // 查詢 crawler_documents_content
        const crawlerDocumentsContent = await CrawlerDocumentsContent.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: CrawlerSynchronize,
                    attributes: [],
                },
                {
                    model: CrawlerDocumentsExtra,
                    as: "CrawlerDocumentsExtras",
                    attributes: [],
                },
            ],
            attributes: [
                "id", // 主鍵
                "content", // 清洗後的內容
                "crawler_documents_id", // 文件 ID
                "crawler_id", // 爬蟲 ID
                "crawler_synchronize_id", // 同步 ID
                "delete_attempts", // 刪除嘗試次數
                "is_enable", // 是否啟用
                "text", // 文字內容
                "title", // 標題
                "training_state", // 訓練狀態
                "url", // 網址
                "update_time", // 更新時間 要用來算過期時間
                [
                    sequelize.fn("COUNT", sequelize.col("CrawlerDocumentsExtras.id")),
                    "extra_count", // 關聯的額外文件數量
                ],
            ],
            group: ["CrawlerDocumentsContent.id"],
            order: [
                ["training_state", "ASC"],
                ["id", "ASC"],
            ],
            limit: itemsPerPage,
            offset,
            subQuery: false,
        });

        const totalItems = crawlerDocumentsContent.count.length;

        rsmodel.data = {
            crawler_content_list: crawlerDocumentsContent.rows,
            total_items: totalItems,
            current_page: page,
            items_per_page: itemsPerPage,
        };
        rsmodel.code = 0;
    } catch (e) {
        rsmodel.code = 1;
        console.error(e.message);
    }
    res.json(rsmodel);
};

exports.getDeleteCrawlerSiteList = async function (req, res) {
    logRouteDetails("crawlerController.getDeleteCrawlerSiteList", req);
    let rsmodel = new responseModel();
    try {
        const { crawler_ids, datasets_id } = JSON.parse(req.body);
        console.info("crawlerController.getDeleteCrawlerSiteList: ", crawler_ids, datasets_id);
        const CRAWLER_API = process.env.CRAWLER_API;
        let query, rs;
        query = {
            text: "SELECT id FROM datasource WHERE datasets_id = $1 AND type = $2",
            values: [datasets_id, "B"],
        };
        rs = await sql.query(query);
        const datasource_id = rs.rows[0]?.id;
        if (!datasource_id) {
            rsmodel.code = 0;
            rsmodel.data = [];
            return res.json(rsmodel);
        }

        // Modify the SQL query to include filtering by crawler_ids
        query = {
            text: `
                WITH tempSync AS (
                    SELECT 
                        cs.id AS sync_id, 
                        cs.crawler_id, 
                        cs.training_state, 
                        cs.create_time AS last_time, 
                        c.title, 
                        c.domain, 
                        c.alias,
                        ct.spider_uuid AS task_id,
                        ROW_NUMBER() OVER (PARTITION BY cs.crawler_id ORDER BY cs.create_time DESC) AS row_num
                    FROM 
                        crawler_synchronize cs
                    JOIN 
                        crawler c ON cs.crawler_id = c.id
                    LEFT JOIN
                        crawler_tasks ct ON ct.crawler_synchronize_id = cs.id
                    WHERE 
                        cs.datasource_id = $1
                    AND 
                        cs.training_state IN (1, 2, 3, 4, 8, 98, 99)
                    AND
                        cs.crawler_id = ANY($2)
                )
                SELECT 
                    sync_id, 
                    crawler_id, 
                    training_state, 
                    last_time, 
                    title, 
                    domain, 
                    alias,
                    task_id
                FROM 
                    tempSync
                WHERE 
                    row_num = 1;
            `,
            values: [datasource_id, crawler_ids],
        };

        rs = await sql.query(query);
        const syncCrawlerList = rs.rows;

        // 獲取所有的 task_id
        const taskIds = syncCrawlerList.map((item) => item.task_id);

        // 發送請求到指定 API，獲取正在運行的 task 資料
        const response = await axios.get(`${CRAWLER_API}s`);
        const spiderData = response.data.data;

        // 過濾回傳的資料，找出與 SQL 查詢結果 task_id 符合的 site_ids
        const runningSiteIds = spiderData
            .filter((spider) => taskIds.includes(spider.uuid))
            .flatMap((spider) => spider.site_ids);

        // 根據這些 site_ids 從 crawler 表查詢對應的 title
        query = {
            text: `
                SELECT site_id, title
                FROM crawler
                WHERE site_id = ANY($1);
            `,
            values: [runningSiteIds],
        };

        rs = await sql.query(query);
        const siteTitles = rs.rows;
        rsmodel.code = 0;
        rsmodel.data = {
            syncCrawlerList: syncCrawlerList.map((item) => ({ ...item, domain: item.alias || item.domain })),
            relateSite: siteTitles,
        };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.deleteCrawler = async function (req, res) {
    logRouteDetails("crawlerController.deleteCrawler", req);
    let rsmodel = new responseModel();
    let rs, query;
    const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
    const pythonAPIHost = process.env.PYTHON_API_HOST;
    const CRAWLER_API = process.env.CRAWLER_API;
    const { crawler_ids, datasets_id, mode, cancelCrawlerList } = JSON.parse(req.body);
    console.info("crawlerController.deleteCrawler: ", crawler_ids, datasets_id, mode, cancelCrawlerList);

    // 從 cancelCrawlerList 中提取唯一的 task_id
    const taskIds = [...new Set(cancelCrawlerList.map((item) => item.task_id))];

    // 對每個唯一的 task_id 發送 DELETE 請求

    try {
        const deletePromises = taskIds.map(async (task_id) => {
            const url = `${CRAWLER_API}/${task_id}`;
            try {
                await axios.delete(url, {
                    headers: {
                        Accept: "application/json",
                    },
                });
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    console.warn(`Task ID ${task_id} 未找到 (404)，跳過該請求`);
                } else {
                    console.error(`刪除 Task ID ${task_id} 時出錯:`, error.message);
                }
            }
        });
        await Promise.all(deletePromises);
    } catch (error) {
        console.error("Error deleting crawlers:", error);
    }

    try {
        // 先拿 datasets_id 找到 datasource_id
        const { uid = "", name: username = "" } = req.session.userInfo || {};

        query = {
            text: "select id from datasource where datasets_id = $1 and type = $2",
            values: [datasets_id, "B"],
        };
        rs = await sql.query(query);
        const datasource_id = rs.rows[0]?.id;

        if (!datasource_id) {
            throw new Error("找不到對應的 datasource_id");
        }

        // 拿 datasource_id 和 crawler_ids 找到對應的 crawler_synchronize_id
        query = {
            text: `
                select id from crawler_synchronize
                where datasource_id = $1 and crawler_id = ANY($2::varchar[])
            `,
            values: [datasource_id, crawler_ids],
        };
        rs = await sql.query(query);
        const synchronizeIds = rs.rows.map((row) => row.id);

        if (synchronizeIds.length === 0) {
            throw new Error("找不到對應的 crawler_synchronize_id");
        }

        // 多個 id 的查詢字串
        const idPlaceholders = synchronizeIds.map((_, i) => `$${i + 1}`).join(", ");

        // 更新 crawler_documents_content 的資料
        const updateDocumentsContentQuery = `
            UPDATE crawler_documents_content
            SET training_state = 5
            WHERE crawler_synchronize_id IN (${idPlaceholders});
        `;

        // 刪除 crawler_sync_schedule 的資料
        const deleteCrawlerScheduleQuery = `  
            DELETE FROM crawler_sync_schedule
            WHERE dataset_id = $1
            AND crawler_id = ANY($2);
        `;

        // 更新 crawler_documents 的資料
        const updateDocumentsQuery = `
            UPDATE crawler_documents
            SET training_state = 5
            WHERE crawler_synchronize_id IN (${idPlaceholders});
        `;

        // 更新 crawler_synchronize 的資料
        const updateSynchronizeQuery = `
            UPDATE crawler_synchronize
            SET training_state = 5
            WHERE id IN (${idPlaceholders});
        `;

        // 拿著 sync id 去 crawler_tasks 更新那筆資料的 status 為 terminated
        const updateCrawlerTasksQuery = `
            UPDATE crawler_tasks
            SET status = 'terminated'
            WHERE crawler_synchronize_id IN (${idPlaceholders});
        `;

        await sql.query("BEGIN"); // 開始事務

        await sql.query(updateDocumentsContentQuery, synchronizeIds); // 刪除 crawler_documents_content 的資料
        await sql.query(deleteCrawlerScheduleQuery, [datasets_id, crawler_ids]); // 刪��� crawler_sync_schedule 的資料
        await sql.query(updateDocumentsQuery, synchronizeIds); // 更新 crawler_documents 的資料
        await sql.query(updateSynchronizeQuery, synchronizeIds); // 更新 crawler_synchronize 的資料
        await sql.query(updateCrawlerTasksQuery, synchronizeIds); // 更新 crawler_synchronize 的資料

        await sql.query("COMMIT"); // 提交事務
        // call python 禁用整批

        await pythonAPI.cancelAllCrawler(synchronizeIds, pythonAPIHost, ava_token);

        rsmodel.message = "資料刪除成功";
        rsmodel.code = 0;
        res.json(rsmodel);

        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.DELETE,
            entityType: AUDIT_LOG_ENTITY_TYPE.DELETE_CRAWLER,
            targetId: datasets_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                datasets_id,
                crawler_ids,
                synchronizeIds,
                cancelCrawlerList,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (error) {
        await sql.query("ROLLBACK"); // 回滾事務
        rsmodel.message = "資料刪除失敗";
        rsmodel.error = error.message;
        rsmodel.code = 1;
        res.status(500).json(rsmodel);
    }
};

// 爬蟲同步的啟用禁用
exports.toggleSyncCrawlerEnable = async function (req, res) {
    logRouteDetails("crawlerController.toggleSyncCrawlerEnable", req);
    let rsmodel = new responseModel();
    try {
        let query, params;
        const { uid = "", name: username = "" } = req.session.userInfo || {};

        const { training_state, datasetsId, crawlerId } = JSON.parse(req.body);
        console.info("crawlerController.toggleSyncCrawlerEnable: ", training_state, datasetsId, crawlerId);
        console.log("req.body", req.body);
        // datasetsId
        const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;

        // 拿 datasetsId 去 datasource 表找到對應的 id
        query = `SELECT id FROM datasource WHERE datasets_id = $1 AND type = $2`;
        params = [datasetsId, "B"];

        let rs = await sql.query(query, params);
        const datasourceId = rs.rows[0]?.id;

        // 更新 crawler_synchronize 表的 training_state 狀態
        // 禁用 training_state = 4 的時候 不要改狀態 給 python 改

        // 啟用的時候看  是 3 or 4 還要判斷 is_enable 是不是1 事就 改成 2 (sync,document,content) 一起改

        if (training_state === 4) {
            console.log("不呼叫 python api");
            // 更新 crawler_synchronize 表的 training_state 狀態
            query = `
                UPDATE 
                    crawler_synchronize
                SET 
                    training_state = $1
                WHERE 
                    datasource_id = $2
                    AND crawler_id = $3
            `;
            params = [2, datasourceId, crawlerId];
            await sql.query(query, params);

            // 拿到所有 crawler_synchronize 的 id
            query = `
                SELECT 
                    id 
                FROM 
                    crawler_synchronize 
                WHERE 
                    datasource_id = $1
                AND 
                    crawler_id = $2
            `;
            params = [datasourceId, crawlerId];
            rs = await sql.query(query, params);
            const crawlerSynchronizeIds = rs.rows.map((m) => m.id);

            // 更新 crawler_documents_content 表和 crawler_documents 表
            query = `
                UPDATE 
                    crawler_documents_content
                SET 
                    training_state = 2
                WHERE 
                    crawler_synchronize_id = ANY($1::bigint[])
                    AND is_enable = 1
                    AND training_state IN (3, 4)
            `;
            params = [crawlerSynchronizeIds];
            await sql.query(query, params);

            query = `
                UPDATE 
                    crawler_documents
                SET 
                    training_state = 2
                WHERE 
                    crawler_synchronize_id = ANY($1::bigint[])
                    AND is_enable = 1
                    AND training_state IN (3, 4)
            `;
            params = [crawlerSynchronizeIds];
            await sql.query(query, params);

            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.ENABLE,
                entityType: AUDIT_LOG_ENTITY_TYPE.ENABLE_CRAWLER,
                targetId: datasetsId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    training_state,
                    datasetsId,
                    crawlerId,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } else if (training_state === 3) {
            // training_state 3 代表傳過來之前是啟用的 要禁用
            console.log("呼叫 python api 全部禁用");
            query = `
            SELECT 
                id 
            FROM 
                crawler_synchronize 
            WHERE 
                datasource_id = $1
            AND 
                crawler_id = $2
            `;
            params = [datasourceId, crawlerId];

            rs = await sql.query(query, params);
            const crawlerSynchronizeIds = rs.rows.map((m) => m.id);
            console.log("crawlerSynchronizeIds", crawlerSynchronizeIds);
            // 整批禁用 newState = 4

            await pythonAPI.disabledAllCrawler(crawlerSynchronizeIds, pythonAPIHost, ava_token);

            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.DISABLE,
                entityType: AUDIT_LOG_ENTITY_TYPE.DISABLE_CRAWLER,
                targetId: datasetsId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    training_state,
                    datasetsId,
                    crawlerId,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        }
        rsmodel.code = 0;
        rsmodel.message = "Update successful";
    } catch (error) {
        rsmodel.message = error.message;
        rsmodel.code = 1;
        console.error(error);
    }

    res.json(rsmodel);
};

// 爬蟲同步內容的啟用禁用
exports.toggleSyncCrawlerContentEnable = async function (req, res) {
    logRouteDetails("crawlerController.toggleSyncCrawlerContentEnable", req);
    // 外層看裡面的 只要有 document 有 2 的 都不能啟用近用 和立即同步
    let rsmodel = new responseModel();
    try {
        let query, params;
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;

        const { enableStatus, documentContentIds, datasetsId, crawlerSyncTrainingState, synchronizeId } = JSON.parse(
            req.body
        );
        console.info("crawlerController.toggleSyncCrawlerContentEnable: ", JSON.parse(req.body));

        // 給 python 用的
        query = `
            SELECT id 
            FROM crawler_documents_content
            WHERE id = ANY($1)
            AND crawler_documents_id NOT IN (
                SELECT id
                FROM crawler_documents
                WHERE training_state = 6
            )
        `;

        params = [documentContentIds];
        const { rows: filteredDocumentContentIds } = await sql.query(query, params);

        const validDocumentContentIds = filteredDocumentContentIds.map((row) => row.id);

        // 更新 crawler_documents_content,document 表的 is_enable 和 training_state 狀態
        // 更新 sync 的 training_state
        // 啟用的時候 is_enable 改成 1 training_state 不管是什麼狀態都改成 2
        if (enableStatus === 1) {
            query = `
                UPDATE
                    crawler_synchronize
                SET
                    training_state = 2
                WHERE
                    id = $1
            `;
            params = [synchronizeId];
            await sql.query(query, params);
            query = `
                UPDATE 
                    crawler_documents_content
                SET 
                    is_enable = 1,
                    training_state = 2,
                    update_time = CURRENT_TIMESTAMP
                WHERE 
                    id = ANY($1)
            `;
            params = [validDocumentContentIds];
            await sql.query(query, params);

            query = `
                UPDATE
                    crawler_documents
                SET
                    is_enable = 1,
                    training_state = 2,
                    update_time = CURRENT_TIMESTAMP
                WHERE
                    id IN (
                        SELECT DISTINCT crawler_documents_id
                        FROM crawler_documents_content
                        WHERE id = ANY($1)
                    )
            `;
            params = [validDocumentContentIds];
            await sql.query(query, params);

            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.ENABLE,
                entityType: AUDIT_LOG_ENTITY_TYPE.ENABLE_CRAWLER_CONTENT,
                targetId: datasetsId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    datasetsId,
                    enableStatus,
                    validDocumentContentIds,
                    synchronizeId,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        }

        // 禁用 把 is_enable 改成 0
        if (enableStatus === 0) {
            query = `
                UPDATE 
                    crawler_documents_content
                SET 
                    is_enable = 0,
                    training_state = 4,
                    update_time = CURRENT_TIMESTAMP
                WHERE 
                    id = ANY($1)
            `;
            params = [validDocumentContentIds];
            await sql.query(query, params);

            query = `
                UPDATE
                    crawler_documents
                SET
                    is_enable = 0,
                    update_time = CURRENT_TIMESTAMP
                WHERE
                    id IN (
                        SELECT DISTINCT crawler_documents_id
                        FROM crawler_documents_content
                        WHERE id = ANY($1)
                    )
            `;
            params = [validDocumentContentIds];
            await sql.query(query, params);

            await pythonAPI.disabledBatchCrawlerContent(datasetsId, validDocumentContentIds, pythonAPIHost, ava_token);

            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.DISABLE,
                entityType: AUDIT_LOG_ENTITY_TYPE.DISABLE_CRAWLER_CONTENT,
                targetId: datasetsId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    datasetsId,
                    enableStatus,
                    validDocumentContentIds,
                    synchronizeId,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        }

        rsmodel.code = 0;
        rsmodel.message = "Update successful";
    } catch (error) {
        rsmodel.message = error.message;
        rsmodel.code = 1;
        console.error(error);
    }

    res.json(rsmodel);
};

const Crawler = require("../../orm/schema/crawler");
const jsonData = require("../../site_config.json");

exports.insertCrawlerFromJson = async function (req, res) {
    logRouteDetails("crawlerController.insertCrawlerFromJson", req);
    try {
        // 準備插入資料
        const insertData = jsonData.sites.map((item) => {
            const url = new URL(item.url.includes("http") ? item.url : `http://${item.url}`);
            return {
                id: item.id,
                domain: url.hostname,
                title: item.site_name.includes("(") ? item.site_name.split("(")[0] : item.site_name,
                site_id: item.site_id,
                config_jsonb: {
                    template_id: item.template_id,
                    template_name: item.template_name,
                    start: item.start,
                    active: item.active === true ? 1 : 0,
                },
                alias: item.alias,
                use_selenium: 0,
                download_attachment: item?.download_attachment === true ? 1 : 0,
                crawler_type_id: 1,
                is_show: item.active === true ? 1 : 0,
            };
        });

        // 使用 ORM 插入資料
        await Crawler.bulkCreate(insertData);

        res.status(200).send("Insertion successful");
    } catch (error) {
        console.error("Error inserting crawler data:", error);
        res.status(500).send("Error inserting crawler data");
    }
};

exports.folder = async function (req, res) {
    logRouteDetails("crawlerController.folder", req);
    let rsmodel = new responseModel();
    try {
        const { datasetsId } = req.query;
        console.info("crawlerController.folder: ", datasetsId);

        let rs, query;

        console.log("datasetsId", datasetsId);

        const datasource_type = "B";
        let datasource_id = "";
        query = {
            text: "select id from datasource where datasets_id = $1 and type = $2",
            values: [datasetsId, datasource_type],
        };
        rs = await sql.query(query);

        datasource_id = rs.rows[0]?.id;
        console.log("datasource_id", datasource_id);

        query = {
            text: "select id,name from upload_folder where datasource_id = $1",
            values: [datasource_id],
        };
        rs = await sql.query(query);

        rsmodel.data = rs.rows;
        rsmodel.code = 0;
        rsmodel.message = "取得資料夾成功";
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error);
    }

    res.json(rsmodel);
};

// 獲取文件補全內容
exports.getDocumentExtra = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { crawler_documents_id } = req.params;

        const extras = await CrawlerDocumentsExtra.findAll({
            where: {
                crawler_documents_id,
                is_enable: 1,
            },
            order: [["create_time", "DESC"]],
        });

        rsmodel.code = 0;
        rsmodel.data = extras;
    } catch (error) {
        console.error("Error getting document extra:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 更新文件補全內容
exports.updateDocumentExtra = async function (req, res) {
    logRouteDetails("crawlerController.updateDocumentExtra", req);
    let rsmodel = new responseModel();
    try {
        const { extras, datasets_id, crawler_documents_id } = JSON.parse(req.body);
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;

        // 儲存新增記錄的 ID
        // const crawler_documents_extra_ids = [];

        // 使用事務來確保數據一致性
        await sequelize.transaction(async (t) => {
            for (const extra of extras) {
                const { id, crawler_documents_id, extra_text, is_included_in_large_chunk, is_enable } = extra;

                // 檢查 crawler_documents_id 是否存在
                const existingDocument = await CrawlerDocuments.findByPk(crawler_documents_id);
                if (!existingDocument) {
                    throw new Error(`Document with ID ${crawler_documents_id} does not exist`);
                }

                if (id) {
                    // crawler_documents_extra_ids.push(id);
                    if (is_enable === 0) {
                        // 如果 is_enable 為 0，則刪除記錄
                        await CrawlerDocumentsExtra.destroy({
                            where: { id },
                            transaction: t,
                        });
                    } else {
                        // 否則更新記錄
                        await CrawlerDocumentsExtra.update(
                            {
                                extra_text,
                                is_included_in_large_chunk: is_included_in_large_chunk ? 1 : 0,
                                update_time: sequelize.literal("CURRENT_TIMESTAMP"),
                            },
                            {
                                where: { id },
                                transaction: t,
                            }
                        );
                    }
                } else {
                    // 創建新記錄，並取得生成的 id
                    const newRecord = await CrawlerDocumentsExtra.create(
                        {
                            crawler_documents_id,
                            extra_text,
                            is_included_in_large_chunk: is_included_in_large_chunk ? 1 : 0,
                            is_enable: 1,
                        },
                        { transaction: t }
                    );

                    // 將新生成的 ID 添加到陣列中
                    // crawler_documents_extra_ids.push(newRecord.id);
                }
            }
        });

        // 更新 CrawlerDocuments 的 training_state
        await CrawlerDocuments.update({ training_state: 10 }, { where: { id: crawler_documents_id } });

        // 更新 CrawlerDocumentsContent 的 training_state
        await CrawlerDocumentsContent.update({ training_state: 10 }, { where: { crawler_documents_id } });

        await pythonAPI.updateCrawlerDocumentExtra(
            datasets_id,
            crawler_documents_id,
            // crawler_documents_extra_ids,
            pythonAPIHost,
            ava_token
        );

        rsmodel.code = 0;
        rsmodel.message = "補全內容已更新";
    } catch (error) {
        console.error("Error updating document extra:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.crawlerAttachmentSiteList = async function (req, res) {
    // logRouteDetails("crawlerController.list", req);
    let rsmodel = new responseModel();
    try {
        const { datasetsId } = req.query;
        const CRAWLER_ATTACHMENT_URL = process.env.CRAWLER_ATTACHMENT_API || "http://10.201.86.46:8000/attachments";
        let query, rs;
        query = {
            text: "select id from datasource where datasets_id = $1 and type = $2",
            values: [datasetsId, "B"],
        };
        rs = await sql.query(query);
        const datasourceId = rs.rows[0]?.id;

        if (!datasourceId) {
            query = {
                text: `
                    select 
                        id, 
                        title, 
                        domain, 
                        create_time as update_time
                    from 
                        crawler 
                    where
                        crawler.is_show = 1 AND download_attachment = 1
                `,
            };
            rs = await sql.query(query);
            rs = rs.rows;
        } else {
            query = {
                text: `
                    select 
                        id, 
                        title, 
                        domain, 
                        alias,
                        create_time as update_time,
                        site_id
                    from 
                        crawler 
                    where
                        crawler.is_show = 1 AND download_attachment = 1
                       
                `,
            };
            rs = await sql.query(query);
            const crawlerList = rs.rows;

            // create_time 最新的優先
            query = {
                text: `
                    select 
                        id, 
                        crawler_id, 
                        create_time as last_time, 
                        training_state
                    from 
                        crawler_attachment_synchronize
                    where 
                        datasource_id = $1 
                        and training_state in (1, 2, 3, 4, 5, 98,99) 
                    order by create_time desc
                `,
                values: [datasourceId],
            };
            rs = await sql.query(query);
            const synchronizeResults = rs.rows;

            // 結合 crawlerList 和 synchronizeResults 的資料
            rs = crawlerList.map((m) => {
                // 因為是由 create_time 排序，所以取第一筆就是最新同步的那一筆。
                let crawlerInfo = synchronizeResults.find((f) => f.crawler_id === m.id);
                return {
                    id: m.id,
                    title: m.title,
                    update_time: m.update_time,
                    domain: m.alias || m.domain,
                    last_time: crawlerInfo?.last_time || null,
                    training_state: crawlerInfo?.training_state || null,
                    sync_id: crawlerInfo?.id || null,
                    site_id: m.site_id,
                };
            });

            rs = await Promise.all(
                rs.map(async (item) => {
                    const attachments = await axios.get(
                        `${CRAWLER_ATTACHMENT_URL}?site_id=${item.site_id}&page=1&page_size=3`
                    );

                    const attachmentsData = attachments?.data?.data;

                    return {
                        ...item,
                        attachments: attachmentsData?.items.map((attachment) => ({
                            name: attachment.title,
                            href: attachment.href,
                        })),
                        attachments_count: attachmentsData?.total_count,
                        attachments_select_count: attachmentsData?.need_download_count,
                    };
                })
            );

            rs.sort((a, b) => (b.training_state || 0) - (a.training_state || 0));
        }

        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

// 取得爬蟲附件同步後的清單
exports.getSyncCrawlerAttachmentList = async function (req, res) {
    logRouteDetails("crawlerController.getSyncCrawlerAttachmentList", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_ATTACHMENT_URL = process.env.CRAWLER_ATTACHMENT_API || "http://10.201.86.46:8000/attachments";
        const datasets_id = req.params.datasets_id;

        // console.info("crawlerController.getSyncCrawlerList: ", datasets_id);
        let query, rs;

        // 獲取與數據集關聯的 datasource_id
        query = {
            text: "SELECT id FROM datasource WHERE datasets_id = $1 AND type = $2",
            values: [datasets_id, "B"],
        };
        rs = await sql.query(query);
        const datasource_id = rs.rows[0]?.id;
        if (!datasource_id) {
            rsmodel.code = 0;
            rsmodel.data = [];
            return res.json(rsmodel);
        }

        // 查詢 crawler_synchronize 以及關聯的 crawler_tasks 中的單一 spider_uuid (task_id)
        query = {
            text: `
                       WITH tempSync AS (
                    SELECT 
                        cs.id AS sync_id, 
                        cs.crawler_id, 
                        cs.training_state, 
                        cs.create_time AS last_time, 
                        c.title, 
                        c.domain, 
                        c.alias,
                        c.site_id,
                        ct.spider_uuid AS task_id,
                        ct.progress ->> 'dir' AS dir,
                        css.next_sync_date,
                        ROW_NUMBER() OVER (PARTITION BY cs.crawler_id ORDER BY cs.create_time DESC) AS row_num
                    FROM 
                        crawler_attachment_synchronize cs
                    JOIN 
                        crawler c ON cs.crawler_id = c.id
                    LEFT JOIN 
                        crawler_attachment_tasks ct ON ct.crawler_synchronize_id = cs.id
                    LEFT JOIN 
                        crawler_attachment_sync_schedule css ON cs.crawler_id = css.crawler_id
                    WHERE 
                        cs.datasource_id = $1
                    AND 
                        cs.training_state IN (1, 2, 3, 4, 8, 98, 99)
                )
                SELECT 
                    sync_id, 
                    crawler_id, 
                    training_state, 
                    last_time, 
                    title, 
                    domain, 
                    alias,
                    site_id,
                    task_id,
                    dir,
                    next_sync_date
                FROM 
                    tempSync
                WHERE 
                    row_num = 1;
            `,
            values: [datasource_id],
        };

        rs = await sql.query(query);
        // http://10.201.86.46:8000/attachments?site_id=labor&page=1&page_size=3
        const syncCrawlerList = await Promise.all(
            rs.rows.map(async (item) => {
                const attachments = await axios.get(
                    `${CRAWLER_ATTACHMENT_URL}?site_id=${item.site_id}&page=1&page_size=3`
                );

                const attachmentsData = attachments?.data?.data;

                return {
                    ...item,
                    attachments: attachmentsData?.items.map((attachment) => ({
                        name: attachment.title,
                        href: attachment.href,
                    })),
                    attachments_count: attachmentsData?.total_count,
                    attachments_select_count: attachmentsData?.need_download_count,
                };
            })
        );

        // console.log("syncCrawlerList", syncCrawlerList);

        // 保留你的排序規則
        const sortedSyncCrawlerList = syncCrawlerList.sort((a, b) => {
            // 如果 a 或 b 的 training_state 是 3，則該項目應排在最前面
            if (a.training_state === 3) return -1;
            if (b.training_state === 3) return 1;

            // 否則按照 training_state 進行排序，從小到大
            return a.training_state - b.training_state;
        });

        // 更新 rsmodel.data 為排序後的爬蟲清單
        rsmodel.data = sortedSyncCrawlerList.map((syncCrawler) => ({
            id: syncCrawler.sync_id,
            crawlerId: syncCrawler.crawler_id,
            title: syncCrawler.title,
            site_id: syncCrawler.site_id,
            domain: syncCrawler.alias || syncCrawler.domain,
            last_time: syncCrawler.last_time,
            training_state: syncCrawler.training_state,
            task_id: syncCrawler.task_id, // 單一 task_id
            dir: syncCrawler.dir,
            next_sync_date: syncCrawler.next_sync_date,
            attachments: syncCrawler.attachments,
            attachments_count: syncCrawler.attachments_count,
            attachments_select_count: syncCrawler.attachments_select_count,
        }));

        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
        rsmodel.code = 1;
    }
    res.json(rsmodel);
};

exports.syncCrawlerAttachment = async function (req, res) {
    logRouteDetails("crawlerController.syncCrawlerAttachment", req);
    let rsmodel = new responseModel();
    // 要記錄 crawlerId 和 syncId 的對應關係
    let crawlerAttachmentSyncArray = [];

    let crawlerAttachmentSiteIds = [];
    try {
        /**
         * 1. 拿 datasets_id 去檢查 datasource 資料表是否有資料
         * 1.1 沒有的話，新增一筆資料，並且 type 為 B。
         * 1.2 在知識庫的 folder_name 資料夾底下建立一個 crawler 的資料夾。
         * 1.3 要是前端的 folder_name 有傳送值過來的話，
         *     就去 upload_folder 資料表新增一筆資料，並且拿這筆新的資料 id 當它的 folder_name。
         * 2.  把 datasource_id, crawler_id, training_state, config_jsonb 新增至 crawler_synchronize 資料表，
         *     並且把 training_state 設為 2。
         * 3.  先拿測試的 json 檔案(crawler_json 資料夾)，並且放到指定的資料夾中。
         */

        const datasource_type = "B";

        const { crawlerIds, datasetsId, folder, test } = JSON.parse(req.body);
        console.info("crawlerController.syncCrawlerAttachment: ", JSON.parse(req.body));

        const folder_name = folder && folder.name ? folder.name : "";
        let rs, query;
        let datasource_id = "";
        let upload_folder_id = "";
        // 1.  拿 datasets_id 去檢查 datasource 資料表是否有資料
        rs = await sql.query(
            "select a.id datasource_id,b.id upload_folder_id from datasource a left join upload_folder b on a.id = b.datasource_id where a.datasets_id = $1 and a.type = 'B'",
            [datasetsId]
        );

        rs = rs.rows[0];

        // 1.1 沒有的話，新增一筆資料，並且 type 為 B。
        if (!rs || !rs.datasource_id) {
            datasource_id = uuidv4();
            await sql.query("insert into datasource(id,datasets_id,type,is_enable) values($1,$2,$3,$4)", [
                datasource_id,
                datasetsId,
                datasource_type,
                1,
            ]);
        } else {
            // 有的話就直接取得
            datasource_id = rs.datasource_id;
        }

        // 1.2. 透過 datasets_id 撈出 folder_name，並新增資料夾。
        rs = await sql.query("select folder_name from datasets where id = $1", [datasetsId]);
        const datasetsFolderName = rs.rows[0]?.folder_name;
        upload_folder_id = datasetsFolderName;

        //createFolder 會檢查有沒有這個資料夾 沒有的話就新增
        createFolder(datasetsFolderName, datasource_type);

        /**
         * 1.3 要是前端的 folder_name 有傳送值過來的話，
         *     就去 upload_folder 資料表新增一筆資料，並且拿這筆新的資料 id 當它的 folder_name。
         */

        if (folder_name) {
            // 檢查 folder_name 是否已經存在於 upload_folder 資料表中
            rs = await sql.query("select id from upload_folder where name = $1 and datasource_id = $2", [
                folder_name,
                datasource_id,
            ]);

            if (rs.rows.length > 0) {
                // 如果存在，直接使用現有的 upload_folder_id
                upload_folder_id = rs.rows[0].id;
            } else {
                // 如果不存在，新增新的資料夾記錄並建立資料夾
                upload_folder_id = uuidv4();
                await sql.query("insert into upload_folder(id,datasource_id,name) values($1,$2,$3)", [
                    upload_folder_id,
                    datasource_id,
                    folder_name,
                ]);
                createCrawlerFolder(datasetsFolderName, datasource_type, upload_folder_id);
            }
        }
        // --------------- 這邊開始有處理複數筆資料的問題 -------------------
        // crawlerId 現在會是一個陣列
        // 拿 datasource_id 和 crawler_id 去 crawler_synchronize 表找到全部的 id

        console.log("正在新增爬蟲同步資料");
        for (let crawlerId of crawlerIds) {
            rs = await sql.query("SELECT site_id FROM crawler WHERE id = $1", [crawlerId]);
            const siteId = rs.rows[0]?.site_id;
            crawlerAttachmentSiteIds.push(siteId);

            rs = await sql.query("select config_jsonb from crawler where id = $1", [crawlerId]);
            const crawlerConfigJsonb = rs.rows[0]?.config_jsonb;

            rs = await sql.query(
                "insert into crawler_attachment_synchronize (config_jsonb,datasource_id,crawler_id,training_state) values($1,$2,$3,$4) returning id",
                [crawlerConfigJsonb, datasource_id, crawlerId, 1]
            );

            const crawler_attachment_synchronize_id = +rs.rows[0]?.id;
            if (!crawler_attachment_synchronize_id) return res.json(rsmodel);
            // crawlerSyncArray.push({ crawlerId, siteId, crawler_synchronize_id }); // 將 crawlerId 和對應的 crawler_synchronize_id 存入陣列物件
            crawlerAttachmentSyncArray.push({
                crawlerId,
                siteId,
                crawler_synchronize_id: crawler_attachment_synchronize_id,
            }); // 將 crawlerId 和對應的 crawler_attachment_synchronize_id 存入陣列物件
        }
        console.log("爬蟲同步資料新增完成");

        rsmodel.code = 0;
        // res.json(rsmodel);

        try {
            const backgroundProcess = fork(path.join(__dirname, "backgroundProcess.js"));
            backgroundProcess.send({
                crawlerSyncArray: crawlerAttachmentSyncArray, // 傳遞陣列物件給 backgroundProcess
                folder_name,
                upload_folder_id,
                datasetsFolderName,
                datasetsId,
                datasourceId: datasource_id,
                ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
                crawlerSiteIds: crawlerAttachmentSiteIds,
                test,
                type: "attachment",
            });
        } catch (error) {
            rsmodel.code = 1;
            rsmodel.message = error.message;
            // res.json(rsmodel);
        }
    } catch (error) {
        console.error("sync crawler fail", error);

        // 解析請求中的爬蟲 ID 和 datasets ID
        const { crawlerIds, datasetsId } = JSON.parse(req.body);
        console.log(crawlerIds, datasetsId);

        // 對每個 crawlerId 進行處理
        for (const crawlerId of crawlerIds) {
            let crawler_attachment_synchronize_id;

            // 確認是否有已存在的 crawler_attachment_synchronize_id
            const syncEntry = crawlerAttachmentSyncArray.find((entry) => entry.crawlerId === crawlerId);
            if (syncEntry) {
                crawler_attachment_synchronize_id = syncEntry.crawler_attachment_synchronize_id;
            }

            if (crawler_attachment_synchronize_id) {
                // 更新 training_state 為 98，表示爬蟲有問題
                await sql.query("update crawler_attachment_synchronize set training_state = 98 where id = $1", [
                    crawler_attachment_synchronize_id,
                ]);
            } else {
                // 沒有 crawler_attachment_synchronize_id 時，插入一條新的記錄，並將 training_state 設為 98
                let crawlerData = await sql.query(
                    "select config_jsonb from crawler where id = $1 && download_attachment = 1",
                    [crawlerId]
                );
                const crawlerConfigJsonb = crawlerData.rows[0]?.config_jsonb;

                await sql.query(
                    "insert into crawler_attachment_synchronize (config_jsonb, datasource_id, crawler_id, training_state) values($1, $2, $3, $4) returning id",
                    [crawlerConfigJsonb, datasetsId, crawlerId, 98]
                );
            }
        }

        rsmodel.code = 1;
        rsmodel.message = error.message;
        // res.json(rsmodel);
    }

    res.json(rsmodel);
};

exports.getSyncCrawlerAttachmentInfo = async function (req, res) {
    logRouteDetails("crawlerController.getSyncCrawlerAttachmentInfo", req);
    let rsmodel = new responseModel();
    try {
        const crawler_sync_id = req.params.crawler_sync_id;
        // console.info("crawlerController.getSyncCrawlerInfo: ", crawler_sync_id);

        let query, rs;
        //搜索爬蟲id 後取得爬蟲資訊
        query = {
            text: `select crawler_id,create_time from crawler_attachment_synchronize where id = $1`,
            values: [crawler_sync_id],
        };
        rs = await sql.query(query);
        const crawler_id = rs.rows[0]?.crawler_id;
        const last_time = rs.rows[0]?.create_time;

        query = {
            text: `select title, domain as url from crawler where id = $1`,
            values: [crawler_id],
        };
        rs = await sql.query(query);

        const crawler_info = {
            title: rs.rows[0]?.title,
            url: rs.rows[0]?.url,
            update_time: last_time,
        };

        rsmodel.data = { crawler_info };
    } catch (error) {
        rsmodel.code = 1;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.getCrawlerAttachmentSyncTrainingState = async function (req, res) {
    logRouteDetails("crawlerController.getCrawlerAttachmentSyncTrainingState", req);
    let rsmodel = new responseModel();
    try {
        const sync_id = req.params.sync_id;
        console.info("crawlerController.getCrawlerAttachmentSyncTrainingState: ", sync_id);

        let query, rs;
        query = {
            text: `select training_state from crawler_attachment_synchronize where id = $1`,
            values: [sync_id],
        };
        rs = await sql.query(query);
        const training_state = rs.rows[0]?.training_state;

        rsmodel.data = { training_state };
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getSyncCrawlerAttachmentContent = async function (req, res) {
    logRouteDetails("crawlerController.getSyncCrawlerAttachmentContent", req);
    let rsmodel = new responseModel();
    try {
        const crawler_sync_id = req.params.crawler_sync_id;
        const datasets_id = req.params.datasets_id;
        // console.info("crawlerController.getSyncCrawlerContent: ", crawler_sync_id, datasets_id);

        const [crawlerSync, datasource] = await Promise.all([
            CrawlerAttachmentSynchronize.findOne({
                where: { id: crawler_sync_id },
                attributes: ["crawler_id", "create_time"],
            }),
            Datasource.findOne({ where: { datasets_id, type: "B" }, attributes: ["id"] }),
        ]);

        const crawler_id = crawlerSync?.crawler_id;

        if (!crawler_id) {
            rsmodel.message = "無法找到對應的爬蟲";
            return res.json(rsmodel);
        }

        const datasource_id = datasource?.id;

        if (!datasource_id) {
            rsmodel.message = "無法找到對應的 datasource";
            return res.json(rsmodel);
        }

        // 驗證 crawler_synchronize 是否屬於該 datasets_id
        const syncCount = await CrawlerAttachmentSynchronize.count({
            where: { datasource_id, id: crawler_sync_id },
        });

        if (syncCount === 0) {
            rsmodel.message = "不同 datasets 的同步";
            return res.json(rsmodel);
        }

        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
        const searchTerm = req.query.searchTerm || "";
        const trainingStates = req.query.trainingStates || [];
        const offset = (page - 1) * itemsPerPage;

        // 建立條件
        const whereClause = {
            "$CrawlerAttachmentSynchronize.datasource_id$": datasource_id,
            "$CrawlerAttachmentSynchronize.crawler_id$": crawler_id,
        };

        // 處理 training_state 條件
        if (trainingStates.length > 0) {
            // 如果有指定 trainingStates，使用指定的值
            whereClause.training_state = {
                [Op.in]: trainingStates,
            };
        } else {
            // 如果沒有指定 trainingStates，預設排除 training_state = 9 的資料
            whereClause.training_state = {
                [Op.ne]: 9,
            };
        }

        // 處理 fileExtension 條件
        const fileExtension = req.query.fileExtension || [];
        if (fileExtension.length > 0) {
            whereClause.file_extension = {
                [Op.in]: fileExtension,
            };
        }

        // 處理搜尋條件 - 特別處理中文搜尋
        if (searchTerm) {
            // 將搜尋詞轉換為安全格式
            const escapedSearchTerm = searchTerm.replace(/'/g, "''");

            // 對於中文搜尋，使用 ILIKE (不區分大小寫的模糊匹配)
            whereClause[Op.or] = [
                { page_title: { [Op.iLike]: `%${escapedSearchTerm}%` } },
                { attachment_link_text: { [Op.iLike]: `%${escapedSearchTerm}%` } },
            ];
        }

        // 查詢 crawler_attachment
        const crawlerDocumentsContent = await CrawlerAttachment.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: CrawlerAttachmentSynchronize,
                    attributes: [],
                    required: true,
                },
            ],
            attributes: [
                "id", // 主鍵
                "crawler_synchronize_id",
                "page_title",
                "page_url",
                "filename",
                "url",
                "delete_attempts",
                "attachment_link_title",
                "attachment_link_text",
                "attachment_href",
                "file_extension",
                "training_state", // 訓練狀態
                "parent_id", // 父附件 id
                "update_time", // 更新時間
            ],
            group: ["CrawlerAttachment.id"],
            order: [
                ["training_state", "ASC"],
                ["id", "ASC"],
            ],
            limit: itemsPerPage,
            offset,
            subQuery: false,
        });

        const totalItems = crawlerDocumentsContent.count.length;

        rsmodel.data = {
            crawler_content_list: crawlerDocumentsContent.rows,
            total_items: totalItems,
            current_page: page,
            items_per_page: itemsPerPage,
            search_term: searchTerm, // 加入搜尋詞，方便前端顯示
        };
        rsmodel.code = 0;
    } catch (e) {
        rsmodel.code = 1;
        console.error("Error in getSyncCrawlerAttachmentContent:", e);
        rsmodel.message = "搜尋過程發生錯誤: " + e.message;
    }
    res.json(rsmodel);
};

// 爬蟲同步的啟用禁用
exports.toggleSyncCrawlerAttachmentEnable = async function (req, res) {
    logRouteDetails("crawlerController.toggleSyncCrawlerAttachmentEnable", req);
    let rsmodel = new responseModel();
    try {
        let query, params;
        const { training_state, datasetsId, crawlerId } = JSON.parse(req.body);
        console.info("crawlerController.toggleSyncCrawlerAttachmentEnable: ", training_state, datasetsId, crawlerId);
        console.log("req.body", req.body);
        // datasetsId
        const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;

        // 拿 datasetsId 去 datasource 表找到對應的 id
        query = `SELECT id FROM datasource WHERE datasets_id = $1 AND type = $2`;
        params = [datasetsId, "B"];

        let rs = await sql.query(query, params);
        const datasourceId = rs.rows[0]?.id;

        // 更新 crawler_synchronize 表的 training_state 狀態
        // 禁用 training_state = 4 的時候 不要改狀態 給 python 改

        // 啟用的時候看  是 3 or 4 還要判斷 is_enable 是不是1 事就 改成 2 (sync,document,content) 一起改

        if (training_state === 4) {
            console.log("不呼叫 python api");
            // 更新 crawler_synchronize 表的 training_state 狀態
            query = `
                UPDATE 
                    crawler_attachment_synchronize
                SET 
                    training_state = $1
                WHERE 
                    datasource_id = $2
                    AND crawler_id = $3
            `;
            params = [2, datasourceId, crawlerId];
            await sql.query(query, params);

            // 拿到所有 crawler_synchronize 的 id
            query = `
                SELECT 
                    id 
                FROM 
                    crawler_attachment_synchronize 
                WHERE 
                    datasource_id = $1
                AND 
                    crawler_id = $2
            `;
            params = [datasourceId, crawlerId];
            rs = await sql.query(query, params);
            const crawlerSynchronizeIds = rs.rows.map((m) => m.id);

            // 更新 crawler_attachment 表和 crawler_documents 表
            query = `
                UPDATE 
                    crawler_attachment
                SET 
                    training_state = 2
                WHERE 
                    crawler_synchronize_id = ANY($1::bigint[])
                    AND is_enable = 1
                    AND training_state IN (3, 4)
            `;
            params = [crawlerSynchronizeIds];
            await sql.query(query, params);
        } else if (training_state === 3) {
            // training_state 3 代表傳過來之前是啟用的 要禁用
            console.log("呼叫 python api 全部禁用");
            query = `
                SELECT 
                    id 
                FROM 
                    crawler_attachment_synchronize 
                WHERE 
                    datasource_id = $1
                AND 
                    crawler_id = $2
            `;
            params = [datasourceId, crawlerId];

            rs = await sql.query(query, params);
            const crawlerSynchronizeIds = rs.rows.map((m) => m.id);
            console.log("crawlerSynchronizeIds", crawlerSynchronizeIds);
            // 整批禁用 newState = 4

            await pythonAPI.disabledAllCrawlerAttachment(crawlerSynchronizeIds, datasetsId, pythonAPIHost, ava_token);
        }
        rsmodel.code = 0;
        rsmodel.message = "Update successful";
    } catch (error) {
        rsmodel.message = error.message;
        rsmodel.code = 1;
        console.error(error);
    }

    res.json(rsmodel);
};

// 爬蟲同步內容的啟用禁用
exports.toggleSyncCrawlerAttachmentContentEnable = async function (req, res) {
    logRouteDetails("crawlerController.toggleSyncCrawlerAttachmentContentEnable", req);
    // 外層看裡面的 只要有 document 有 2 的 都不能啟用近用 和立即同步
    let rsmodel = new responseModel();
    try {
        let query, params;
        const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const pythonAPIHost = process.env.PYTHON_API_HOST;

        const { enableStatus, documentContentIds, datasetsId, crawlerSyncTrainingState, synchronizeId } = JSON.parse(
            req.body
        );
        console.info("crawlerController.toggleSyncCrawlerAttachmentContentEnable: ", JSON.parse(req.body));

        // // 給 python 用的
        // query = `
        //     SELECT id
        //     FROM crawler_attachment
        //     WHERE id = ANY($1)
        //     AND crawler_attachment_id NOT IN (
        //         SELECT id
        //         FROM crawler_attachment
        //         WHERE training_state = 6
        //     )
        // `;

        // params = [documentContentIds];
        // const { rows: filteredDocumentContentIds } = await sql.query(query, params);

        // const validDocumentContentIds = filteredDocumentContentIds.map((row) => row.id);

        // 更新 crawler_documents_content,document 表的 is_enable 和 training_state 狀態
        // 更新 sync 的 training_state
        // 啟用的時候 is_enable 改成 1 training_state 不管是什麼狀態都改成 2
        if (enableStatus === 1) {
            query = `
                UPDATE
                    crawler_attachment_synchronize
                SET
                    training_state = 2
                WHERE
                    id = $1
            `;
            params = [synchronizeId];
            await sql.query(query, params);
            query = `
                UPDATE 
                    crawler_attachment
                SET 
                    is_enable = 1,
                    training_state = 2,
                    update_time = CURRENT_TIMESTAMP
                WHERE 
                    id = ANY($1)
            `;
            params = [documentContentIds];
            await sql.query(query, params);
        }

        // 禁用 把 is_enable 改成 0
        if (enableStatus === 0) {
            query = `
                UPDATE 
                    crawler_attachment
                SET 
                    is_enable = 0,
                    training_state = 4,
                    update_time = CURRENT_TIMESTAMP
                WHERE 
                    id = ANY($1)
            `;
            params = [documentContentIds];
            await sql.query(query, params);

            await pythonAPI.disabledBatchCrawlerAttachmentContent(
                datasetsId,
                documentContentIds,
                pythonAPIHost,
                ava_token
            );
        }

        rsmodel.code = 0;
        rsmodel.message = "Update successful";
    } catch (error) {
        rsmodel.message = error.message;
        rsmodel.code = 1;
        console.error(error);
    }

    res.json(rsmodel);
};

exports.getCrawlerAttachmentList = async function (req, res) {
    logRouteDetails("crawlerController.getCrawlerAttachmentList", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_ATTACHMENT_API = process.env.CRAWLER_ATTACHMENT_API;
        const site_id = req.params.site_id;
        const page = parseInt(req.query.page) || 1;
        const page_size = parseInt(req.query.page_size) || 10;
        const title = req.query.title || "";
        const text = req.query.text || "";
        const need_download = req.query.need_download || "all";

        const need_download_params = need_download === "all" ? "" : `&need_download=${need_download}`;
        const title_params = title ? `&title=${encodeURIComponent(title)}` : "";
        const text_params = text ? `&text=${encodeURIComponent(text)}` : "";

        // 確保參數有效
        if (!site_id) {
            throw new Error("缺少站點ID");
        }

        // 構建API URL
        const apiUrl = `${CRAWLER_ATTACHMENT_API}?site_id=${site_id}&page=${page}&page_size=${page_size}${need_download_params}${title_params}${text_params}`;

        const response = await axios.get(apiUrl);

        // 檢查響應
        if (!response.data || !response.data.result) {
            throw new Error(response.data?.message || "無法獲取附件數據");
        }

        // 將數據返回給前端
        rsmodel.data = response.data.data;
        rsmodel.code = 0;
        rsmodel.message = "查詢成功";
    } catch (error) {
        rsmodel.message = error.message;
        rsmodel.code = 1;
        console.error(error);
    }

    res.json(rsmodel);
};

exports.selectNeedDownloadAttachment = async function (req, res) {
    logRouteDetails("crawlerController.selectNeedDownloadAttachment", req);
    let rsmodel = new responseModel();
    try {
        const attachments = JSON.parse(req.body);

        // 確保參數有效
        if (!attachments) {
            throw new Error("缺少附件資料");
        }

        const response = await axios.put(`${process.env.CRAWLER_ATTACHMENT_API}/need_download`, attachments);

        if (response.data.result) {
            rsmodel.code = 0;
            rsmodel.message = "更新成功";
        } else {
            rsmodel.code = 1;
            rsmodel.message = "更新失敗";
        }
    } catch (error) {
        rsmodel.message = error.message;
        rsmodel.code = 1;
        console.error(error);
    }

    res.json(rsmodel);
};

exports.deleteCrawlerAttachment = async function (req, res) {
    logRouteDetails("crawlerController.deleteCrawlerAttachment", req);
    let rsmodel = new responseModel();
    let rs, query;
    const ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
    const pythonAPIHost = process.env.PYTHON_API_HOST;
    const CRAWLER_API = process.env.CRAWLER_API;
    const { crawler_ids, datasets_id, mode, cancelCrawlerList } = JSON.parse(req.body);
    console.info("crawlerController.deleteCrawlerAttachment: ", crawler_ids, datasets_id, mode, cancelCrawlerList);

    // 從 cancelCrawlerList 中提取唯一的 task_id
    const taskIds = [...new Set(cancelCrawlerList.map((item) => item.task_id))];

    // 對每個唯一的 task_id 發送 DELETE 請求

    try {
        const deletePromises = taskIds.map(async (task_id) => {
            const url = `${CRAWLER_API}/${task_id}`;
            try {
                await axios.delete(url, {
                    headers: {
                        Accept: "application/json",
                    },
                });
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    console.warn(`Task ID ${task_id} 未找到 (404)，跳過該請求`);
                } else {
                    console.error(`刪除 Task ID ${task_id} 時出錯:`, error.message);
                }
            }
        });
        await Promise.all(deletePromises);
    } catch (error) {
        console.error("Error deleting crawlers:", error);
    }

    try {
        // 先拿 datasets_id 找到 datasource_id
        query = {
            text: "select id from datasource where datasets_id = $1 and type = $2",
            values: [datasets_id, "B"],
        };
        rs = await sql.query(query);
        const datasource_id = rs.rows[0]?.id;

        if (!datasource_id) {
            throw new Error("找不到對應的 datasource_id");
        }

        // 拿 datasource_id 和 crawler_ids 找到對應的 crawler_synchronize_id
        query = {
            text: `
                select id from crawler_attachment_synchronize
                where datasource_id = $1 and crawler_id = ANY($2::varchar[])
            `,
            values: [datasource_id, crawler_ids],
        };
        rs = await sql.query(query);
        const synchronizeIds = rs.rows.map((row) => row.id);

        if (synchronizeIds.length === 0) {
            throw new Error("找不到對應的 crawler_synchronize_id");
        }

        // 多個 id 的查詢字串
        const idPlaceholders = synchronizeIds.map((_, i) => `$${i + 1}`).join(", ");

        // 更新 crawler_attachment 的資料
        const updateDocumentsContentQuery = `
            UPDATE crawler_attachment
            SET training_state = 5
            WHERE crawler_synchronize_id IN (${idPlaceholders});
        `;

        // 刪除 crawler_attachment_sync_schedule 的資料
        const deleteCrawlerScheduleQuery = `  
            DELETE FROM crawler_attachment_sync_schedule
            WHERE dataset_id = $1
            AND crawler_id = ANY($2);
        `;

        // 更新 crawler_attachment_synchronize 的資料
        const updateSynchronizeQuery = `
            UPDATE crawler_attachment_synchronize
            SET training_state = 5
            WHERE id IN (${idPlaceholders});
        `;

        // 拿著 sync id 去 crawler_attachment_tasks 更新那筆資料的 status 為 terminated
        const updateCrawlerTasksQuery = `
            UPDATE crawler_attachment_tasks
            SET status = 'terminated'
            WHERE crawler_synchronize_id IN (${idPlaceholders});
        `;

        await sql.query("BEGIN"); // 開始事務

        await sql.query(deleteCrawlerScheduleQuery, [datasets_id, crawler_ids]); // 刪除 crawler_attachment_sync_schedule 的資料
        await sql.query(updateDocumentsContentQuery, synchronizeIds); // 更新 crawler_documents 的資料
        await sql.query(updateSynchronizeQuery, synchronizeIds); // 更新 crawler_attachment_synchronize 的資料
        await sql.query(updateCrawlerTasksQuery, synchronizeIds); // 更新 crawler_attachment_tasks 的資料

        await sql.query("COMMIT"); // 提交事務
        // call python 禁用整批

        await pythonAPI.cancelAllCrawlerAttachment(synchronizeIds, pythonAPIHost, ava_token);

        rsmodel.message = "資料刪除成功";
        rsmodel.code = 0;
        res.json(rsmodel);
    } catch (error) {
        await sql.query("ROLLBACK"); // 回滾事務
        rsmodel.message = "資料刪除失敗";
        rsmodel.error = error.message;
        rsmodel.code = 1;
        res.status(500).json(rsmodel);
    }
};
