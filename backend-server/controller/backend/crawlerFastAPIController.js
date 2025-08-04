const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const axios = require("axios");
const logRouteDetails = require("../routeNameLog");
const Crawler = require("../../orm/schema/crawler");
const { Op } = require("sequelize");
const { mapSiteToCrawler } = require("../../utils/crawler");
const sequelize = require("../../orm/sequelize");

exports.getCrawlerList = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.getCrawlerList", req);
    let rsmodel = new responseModel();
    try {
        const result = await sql.query("SELECT title,site_id FROM crawler");
        const data = result.rows;

        rsmodel.code = 0;
        rsmodel.data = data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }
    res.json(rsmodel);
};

exports.getCrawlerSiteStatusList = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.getCrawlerSiteStatusList", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API;

        // CRAWLER_API = http://10.201.86.46:8000/spider
        // api 位置是 http://10.201.86.46:8000/spiders
        const response = await axios.get(`${CRAWLER_API}s`);

        rsmodel.code = 0;
        rsmodel.data = response.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.getCrawlerSiteStatus = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.getCrawlerSiteStatus", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API;

        const crawlerUUID = req.query.crawlerUUID;
        console.info("crawlerFastAPIController.getCrawlerSiteStatus: ", crawlerUUID);
        const response = await axios.get(`${CRAWLER_API}/${crawlerUUID}`);

        rsmodel.code = 0;
        rsmodel.data = response.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.checkSiteStatus = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.checkSiteStatus", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API?.replace("/spider", "");
        const crawlerUUID = req.query.crawlerUUID;
        const siteId = req.query.siteId;
        console.info("crawlerFastAPIController.checkSiteStatus: ", crawlerUUID, siteId);
        const response = await axios.get(`${CRAWLER_API}/site/${siteId}?crawler_id=${crawlerUUID}`);
        // console.log("response", response.data);
        rsmodel.code = 0;
        rsmodel.data = response.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.createCrawler = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.createCrawler", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API;

        const { site_ids } = JSON.parse(req.body);
        console.info("crawlerFastAPIController.createCrawler: ", site_ids);
        const response = await axios.post(
            CRAWLER_API,
            { site_ids },
            {
                headers: {
                    "Content-Type": "application/json",
                    accept: "application/json",
                },
            }
        );

        rsmodel.code = 0;
        rsmodel.data = response.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.downloadZip = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.downloadZip", req);
    try {
        const { zipPath } = JSON.parse(req.body);
        console.info("crawlerFastAPIController.downloadZip: ", zipPath);
        const CRAWLER_DOWNLOAD = process.env.CRAWLER_DOWNLOAD;

        if (!zipPath) {
            return res.status(400).send("請提供有效的爬蟲目錄");
        }

        // 檢查路徑是否符合要求的模式
        const regex = /^output\/[a-zA-Z0-9._-]+\/zip\/[a-zA-Z0-9._-]+\/pages_data\.zip$/;
        if (!regex.test(zipPath)) {
            return res.status(400).send("路徑無效，請確認路徑格式是否正確");
        }

        // 拼接下載 URL
        const zipUrl = `${CRAWLER_DOWNLOAD}/${zipPath}`;

        const response = await axios({
            url: zipUrl,
            method: "GET",
            responseType: "stream",
        });

        // 設置下載 headers
        res.setHeader("Content-Disposition", `attachment; filename=pages_data.zip`);
        res.setHeader("Content-Type", "application/zip");

        // 流式傳輸文件
        response.data.pipe(res);
    } catch (error) {
        console.error("下載爬蟲文件失敗:", error.message);
        res.status(500).send("下載爬蟲文件失敗");
    }
};

exports.deleteCrawler = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.deleteCrawler", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API;

        const { crawlerUUID } = JSON.parse(req.body);
        console.info("crawlerFastAPIController.deleteCrawler: ", crawlerUUID);

        const response = await axios.delete(`${CRAWLER_API}/${crawlerUUID}`);

        rsmodel.code = 0;
        rsmodel.data = response.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.getCrawlerSiteConfig = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.getCrawlerSiteConfig", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API?.replace("/spider", "");

        // 直接發請求到 /config/site 把資料回傳到前端
        const response = await axios.get(`${CRAWLER_API}/config/site`);

        rsmodel.code = 0;
        rsmodel.data = response.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.updateCrawlerSiteConfig = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.updateCrawlerSiteConfig", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API?.replace("/spider", "");

        // 解析請求內容
        const { sites, operation, operatedSite } = JSON.parse(req.body);

        console.log("operatedSite", operatedSite);

        // 如果有操作特定站點，處理該站點
        if (operatedSite) {
            switch (operation) {
                case "add":
                case "edit":
                    // 將 operatedSite 資料轉換為 Crawler 模型格式
                    const crawlerData = mapSiteToCrawler(operatedSite);

                    // 嘗試根據 ID 查詢現有記錄
                    let existingCrawler = await Crawler.findByPk(operatedSite.id);

                    if (existingCrawler) {
                        // 如果記錄存在，更新它
                        console.log(`更新站點: ${operatedSite.site_name} (ID: ${operatedSite.id})`);
                        await existingCrawler.update(crawlerData);
                    } else if (operation === "add") {
                        // 如果記錄不存在且操作為新增，創建新記錄
                        console.log(`新增站點: ${operatedSite.site_name} (ID: ${operatedSite.id})`);
                        await Crawler.create(crawlerData);
                    }
                    break;

                case "delete":
                    // 如果操作為刪除，找到並刪除該記錄
                    console.log(`刪除站點: ${operatedSite.site_name} (ID: ${operatedSite.id})`);
                    await Crawler.destroy({
                        where: { id: operatedSite.id },
                    });
                    break;

                default:
                    console.log(`未知操作: ${operation}`);
            }
        } else if (sites && sites.length > 0) {
            // 如果沒有指定特定站點但提供了所有站點的列表，同步所有站點
            console.log("同步所有站點...");

            // 獲取資料庫中所有現有的站點 ID
            const existingCrawlers = await Crawler.findAll({
                attributes: ["id"],
            });
            const existingIds = existingCrawlers.map((crawler) => crawler.id);

            // 獲取請求中所有的站點 ID
            const requestIds = sites.map((site) => site.id);

            // 找出需要刪除的站點 ID (在資料庫中但不在請求中)
            const idsToDelete = existingIds.filter((id) => !requestIds.includes(id));

            if (idsToDelete.length > 0) {
                console.log(`刪除 ${idsToDelete.length} 個站點`, idsToDelete);
                await Crawler.destroy({
                    where: { id: { [Op.in]: idsToDelete } },
                });
            }

            // 更新或創建請求中的每個站點
            for (const site of sites) {
                if (!site.active) {
                    // 如果站點被停用，跳過
                    continue;
                }

                const crawlerData = mapSiteToCrawler(site);
                await Crawler.upsert(crawlerData);
            }
        }

        // 如果環境中有配置 CRAWLER_API，也更新爬蟲 API 的設定
        if (CRAWLER_API) {
            try {
                await axios.put(`${CRAWLER_API}/config/site`, sites);
                console.log("已同步更新爬蟲 API 設定");
            } catch (apiError) {
                console.error("更新爬蟲 API 設定失敗:", apiError.message);
            }
        }

        rsmodel.code = 0;
        rsmodel.message = "更新成功";
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error("更新站點設定出錯:", error);
    }

    res.json(rsmodel);
};

exports.getCrawlerTemplateConfig = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.getCrawlerTemplateConfig", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API?.replace("/spider", "");

        // 直接發請求到 /config/template 把資料回傳到前端
        const response = await axios.get(`${CRAWLER_API}/config/template`);

        rsmodel.code = 0;
        rsmodel.data = response.data;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.updateCrawlerTemplateConfig = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.updateCrawlerTemplateConfig", req);
    let rsmodel = new responseModel();
    try {
        const CRAWLER_API = process.env.CRAWLER_API?.replace("/spider", "");

        const data = JSON.parse(req.body);

        await axios.put(`${CRAWLER_API}/config/template`, data);

        rsmodel.code = 0;
        rsmodel.message = "更新成功";
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error(error.message);
    }

    res.json(rsmodel);
};

exports.getCrawlerSite = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.getCrawlerSite", req);
    let rsmodel = new responseModel();
    try {
        // 從資料庫獲取所有爬蟲站點資料
        const crawlers = await Crawler.findAll({
            attributes: [
                "id",
                "domain",
                "title",
                "site_id",
                "download_attachment",
                "is_show",
                "crawler_type_id",
                "alias",
                "config_jsonb",
            ],
            order: [
                ["title", "ASC"], // 按站點名稱排序
            ],
        });

        // 轉換資料為前端需要的格式
        const sites = crawlers.map((crawler) => ({
            id: crawler.id,
            domain: crawler.domain,
            title: crawler.title,
            site_id: crawler.site_id,
            download_attachment: crawler.download_attachment,
            is_show: crawler.is_show,
            alias: crawler.alias,
            config: crawler.config_jsonb, // 包含完整配置
        }));

        rsmodel.code = 0;
        rsmodel.data = sites;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error("獲取爬蟲站點資料失敗:", error);
    }

    res.json(rsmodel);
};

// 切換爬蟲站點的附件下載功能（支援批量操作）
exports.toggleCrawlerAttachment = async function (req, res) {
    logRouteDetails("crawlerFastAPIController.toggleCrawlerAttachment", req);
    let rsmodel = new responseModel();
    try {
        const { ids, download_attachment } = JSON.parse(req.body);

        // 支援單個 ID 或多個 ID 的數組
        const siteIds = Array.isArray(ids) ? ids : [ids];

        if (siteIds.length === 0) {
            throw new Error("站點 ID 不能為空");
        }

        if (download_attachment !== 0 && download_attachment !== 1) {
            throw new Error("附件下載狀態必須為 0 或 1");
        }

        // 開始資料庫交易
        const result = await sequelize.transaction(async (t) => {
            // 查詢符合條件的站點
            const crawlers = await Crawler.findAll({
                where: {
                    id: {
                        [Op.in]: siteIds,
                    },
                },
                transaction: t,
            });

            if (crawlers.length === 0) {
                throw new Error("找不到指定的站點");
            }

            // 批量更新站點的 download_attachment 欄位
            await Crawler.update(
                { download_attachment },
                {
                    where: {
                        id: {
                            [Op.in]: siteIds,
                        },
                    },
                    transaction: t,
                }
            );

            // 對於每個站點，如果有 config_jsonb，也更新其中的 download_attachment
            const updatePromises = crawlers.map(async (crawler) => {
                if (crawler.config_jsonb && typeof crawler.config_jsonb === "object") {
                    const configJsonb = { ...crawler.config_jsonb };
                    configJsonb.download_attachment = download_attachment === 1; // 轉換為 boolean

                    await crawler.update({ config_jsonb: configJsonb }, { transaction: t });
                }
            });

            // 等待所有更新完成
            await Promise.all(updatePromises);

            return crawlers.length; // 返回更新的站點數量
        });

        rsmodel.code = 0;
        rsmodel.message = `成功${download_attachment === 1 ? "開啟" : "關閉"} ${result} 個站點的附件下載功能`;
        rsmodel.data = {
            count: result,
            ids: siteIds,
        };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error("更新爬蟲站點附件設定失敗:", error);
    }

    res.json(rsmodel);
};
