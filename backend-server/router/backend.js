"use strict";
const express = require("express");
const router = express.Router();
const sql = require("../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const { verifyUserNo } = require("../utils/common");
const { backend_upload, uploadToAPI, datasetsIdUploadToAPI } = require("../global/backend_upload");
const { backupTables } = require("../db/db-refactor/db-backup-single");
const usermanageController = require("../controller/backend/usermanageController");
const clientsetsController = require("../controller/backend/clientsets");
const datasetsController = require("../controller/backend/datasets");
const userContoller = require("../controller/backend/userContoller");
const expertContoller = require("../controller/backend/expertController");
const skillController = require("../controller/backend/skillController");
const formController = require("../controller/backend/formController");
const systemController = require("../controller/backend/systemController");
const logController = require("../controller/backend/logController");
const crawlerController = require("../controller/backend/crawlerController");
const overviewController = require("../controller/backend/overviewController");
const modelController = require("../controller/backend/modelController");
const feedbackController = require("../controller/backend/feedbackController");
const commonController = require("../controller/backend/commonController");
const crawlerFastAPIController = require("../controller/backend/crawlerFastAPIController");
const prometheusAPIController = require("../controller/backend/prometheusAPIController");
const healthCheckController = require("../controller/system/healthCheck");
const fileProcessController = require("../controller/backend/fileProcessController");
const permissionController = require("../controller/backend/permissionController");

const { createSuperAdmin } = require("../utils/common");
const tempPermissionCheckMiddleware = require("../middleware/tempPermissionCheckMiddleware");
const { Worker } = require("worker_threads");

const pythonAPI = require("../utils/pythonAPI");

const permissions = require("../middleware/permissions");

const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

const fs = require("fs");
const path = require("path");
const responseModel = require("../model/responseModel");
const updatedb = require("../db/db-update");
const multer = require("multer");
const iconv = require("iconv-lite");

// 追蹤正在運行的備份任務
const activeBackupWorkers = new Map();
const backupStatus = new Map();

const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 1024 * 1024 * 15, // 限制文件大小為 15MB
    },
});

// Changelog 專用的上傳設定
const changelogStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 使用 path.join 來指定到專案根目錄
        cb(null, path.join(process.cwd())); // process.cwd() 會返回專案根目錄路徑
    },
    filename: (req, file, cb) => {
        cb(null, "changelog.md");
    },
});

const uploadChangelog = multer({
    storage: changelogStorage,
    limits: {
        fileSize: 1024 * 1024 * 1, // 限制 changelog 檔案大小為 1MB
    },
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith(".md")) {
            cb(null, true);
        } else {
            cb(new Error("Only markdown files are allowed!"));
        }
    },
});

/* 更新User */
router.post("/user/update", userContoller.updateUser);
/* 取得user */
router.get("/user/info", userContoller.getInfo);
/* 登出user */
router.post("/user/logout", userContoller.logout);
/* 變更user密碼 */
router.post("/user/changePassword", userContoller.changePassword);
/* 建立User */
router.post("/user/createUser", userContoller.createUser);
/* 取得2FA 資訊 */
router.get("/user/getAuthSetting", userContoller.getAuthSetting);
/* 建立2FA secret_key */
router.post("/user/createSecretKey", userContoller.createSecretKey);
/* 啟用或停用2FA時，驗證TOTP */
router.post("/user/authentication", userContoller.authentication);
/* 建立JustTwoFactorAuth這個session */
router.get("/user/createJustTwoFactorAuth", userContoller.createJustTwoFactorAuth);
/* 檢查是否有JustTwoFactorAuth這個session */
router.get("/user/checkJustTwoFactorAuth", userContoller.checkJustTwoFactorAuth);

/* 取得所有user */
router.get("/usermanage/users", permissions.chkSSO, usermanageController.getUsers);
/* 取得此user聊天 */
router.get("/usermanage/userMessages", permissions.chkSSO, usermanageController.getUserMessages);
/* 取得所有userType */
router.get("/usermanage/userType", permissions.chkSSO, usermanageController.getUserType);
/* 取得使用者對話記錄 */
router.get("/usermanage/getUsersWithExperts", permissions.chkSSO, usermanageController.getUsersWithExperts);
/* 取得使用者對話記錄 */
router.get("/usermanage/getUserExpertChat", permissions.chkSSO, usermanageController.getUserExpertChat);
/* 取得使用者對話記錄日期 */
router.get("/usermanage/getUserExpertChatDates", permissions.chkSSO, usermanageController.getUserExpertChatDates);

/* 取得專家聊天紀錄 */
router.post("/usermanage/getFiltedExpertChat", usermanageController.getFiltedExpertChat);

/* 取得推薦詞 */
router.get("/clientsets/recommend", clientsetsController.recommend);
/* 更新推薦詞 */
router.put("/clientsets/recommend", clientsetsController.updateRecommend);
/* 新增推薦詞 */
router.post("/clientsets/recommend", clientsetsController.insertRecommend);
/* 刪除推薦詞 */
router.delete("/clientsets/recommend/:id", clientsetsController.delRecommend);
/* 取得公告 */
router.get("/clientsets/bulletin", clientsetsController.bulletin);
/* 更新公告 */
router.put("/clientsets/bulletin", clientsetsController.updateBulletin);

/* 取得版號 */
router.get("/system/getSystemVersion", systemController.getSystemVersion);
/* 修改版本號 */
router.put("/system/updateSystemVersion", systemController.updateSystemVersion);
/* 取得聊天室設定 */
router.get("/system/getChatSettings", systemController.getChatSettings);
/* 取得使用者權限 */
router.get("/system/getSettings", systemController.getSettings);
/* 取得專家與知識庫權限 */
router.get("/system/getKnowledgePermission", systemController.getKnowledgePermission);
/* 取得主題色配置 */
router.get("/system/getChatTheme", systemController.getChatTheme);
/* 取得主題鎖定狀態 */
router.get("/system/getLockTheme", systemController.getLockTheme);
/* 取得使用者權限 */
router.get("/system/getUserPermissions", systemController.getUserPermissions);
/* 更新設定 */
router.put("/system/updateSettings", systemController.updateSettings);

/* 新增主題色配置 */
router.post("/system/createChatTheme", systemController.createChatTheme);
/* 更新主題色 */
router.put("/system/updateChatThemeColors", systemController.updateChatThemeColors);
/* 更新目前主題色 */
router.put("/system/updateCurrentChatTheme", systemController.updateCurrentChatTheme);
/* 更新主題鎖定狀態 */
router.put("/system/toggleLockTheme", systemController.toggleLockTheme);
/* 刪除主題 */
router.delete("/system/theme/:name", systemController.deleteTheme);
/* 更新主題名稱 */
router.put("/system/themes", systemController.updateThemes);
/* 生成主題 */
router.post("/system/generateTheme", systemController.generateTheme);

/* 更新聊天室使用者對話位置 */
router.put("/system/updateUserDialogConversationDirection", systemController.updateUserDialogConversationDirection);
/* 更新聊天室預設主題 */
router.put("/system/updateSystemClientThemeDefault", systemController.updateSystemClientThemeDefault);
/* 更新聊天室歡迎詞頻率 */
router.put("/system/updateWelcomeWordUpdateFrequency", systemController.updateWelcomeWordUpdateFrequency);
/* 更新聊天室預設主題 */
router.put("/system/updateShowSourceChunk", systemController.updateShowSourceChunk);
/* 更新聊天室歡迎詞頻率 */
router.put("/system/updateShowExtraChunk", systemController.updateShowExtraChunk);
/* 更新聊天室禁用詞頻率 */
router.put("/system/updateTextPrison", systemController.updateTextPrison);
/* 更新系統設定中的熱門標籤 */
router.put("/system/updatePopularTags", systemController.updatePopularTags);
/* 取得icon列表 */
router.get("/system/getIconList", systemController.getIconList);
/* 新增icon */
router.post("/system/addIcon", systemController.addIcon);
/* 刪除icon */
router.post("/system/deleteIcon", systemController.deleteIcon);

/* 更新語音輸入功能狀態 */
router.put("/system/updateRecordRTC", systemController.updateRecordRTC);
/* 更新前台系統流量限制 */
router.put("/system/updateRateLimit", systemController.updateRateLimit);

/* 系統頁面爬蟲同步週期 */
router.post("/system/systemSyncCrawlerSchedule", systemController.systemSyncCrawlerSchedule);
/* 系統頁面爬蟲同步週期 */
router.post("/system/delayCrawlerSchedule", systemController.delayCrawlerSchedule);
/* 系統頁面刪除爬蟲同步週期 */
router.delete("/system/deleteCrawlerSchedule", systemController.deleteCrawlerSchedule);

/* 使用者權限設置頁面 - 取得使用者清單 */
router.get("/system/getUsers", systemController.getUsers);
/* 使用者權限設置頁面 - 取得f */
router.get("/system/getExpertsAndDatasets", systemController.getExpertsAndDatasets);
/* 使用者權限設置頁面 - 取得權限設置表 */
router.get("/system/getPermissionSetting", systemController.getPermissionSetting);
/* 使用者權限設置頁面 - 更新權限設置表 */
router.put("/system/updatePermissionSetting", systemController.updatePermissionSetting);
/* 使用者權限設置頁面 - 批量設定使用者權限 */
router.put("/system/setMultiUsersPermission", systemController.setMultiUsersPermission);
/* 取得封鎖IP列表 */
router.get("/system/getBanIpList", systemController.getBanIpList);
/* 刪除封鎖IP列表 */
router.delete("/system/deleteBanIpListItem", systemController.deleteBanIpListItem);
/* 新增封鎖IP列表 */
router.post("/system/createBanIpListItem", systemController.createBanIpListItem);
/* 更新封鎖IP列表 */
router.put("/system/updateBanIpListItem", systemController.updateBanIpListItem);
/* 更新session限制 */
router.put("/system/updateBanRuleSettings", systemController.updateBanRuleSettings);

/* 取得公告 */
router.get("/system/announcements", systemController.getAnnouncements);
/* 新增公告 */
router.post("/system/announcements", systemController.createAnnouncement);
/* 更新公告 */
router.put("/system/announcements/:id", systemController.updateAnnouncement);
/* 刪除公告 */
router.delete("/system/announcements/:id", systemController.deleteAnnouncement);
/* 取得單個公告 */
router.get("/system/announcements/:id", systemController.getAnnouncementById);
/* 取得使用說明確認紀錄 */
router.get("/system/announcementsRecord", systemController.getAnnouncementCheckRecord);
/* 取得禁用說明 */
router.get("/system/announcements/alertText/getAlertText", systemController.getAlertText);
/* 更新禁用說明 */
router.put("/system/announcements/alertText/updateAlertText", systemController.updateAlertText);

/* 取得限流規則 */
// router.get("/system/getRateLimitRules", systemController.getRateLimitRules);
/* 取得限流狀態 */
router.get("/system/getRateLimitStatus", systemController.getRateLimitStatus);

/* LINE BOT 設置 - 取得專家清單與已綁定專家 */
router.get("/system/getExpertsAndSetting", systemController.getExpertsAndSetting);
/* LINE BOT 設置 - 變更綁定專家 */
router.put("/system/setLineExpert", systemController.setLineExpert);
/* LINE BOT 設置 - 更新設定 */
router.put("/system/updateLineSetting", systemController.updateLineSetting);
/* 取得API Key列表 */
router.get("/system/getAPIKeys", systemController.getAPIKeys);
/* 建立API Key */
router.post("/system/createAPIKey", systemController.createAPIKey);
/* 更新API Key網域白名單 */
router.put("/system/updateDomains", systemController.updateDomains);
/* 更新API Key路徑白名單 */
router.put("/system/updatePaths", systemController.updatePaths);
/* 更新API Key一般設定 */
router.put("/system/updateCommonSettings", systemController.updateCommonSettings);
/* 刪除API Key */
router.delete("/system/deleteAPIKey", systemController.deleteAPIKey);
/* 刪除domain */
router.delete("/system/deleteDomain", systemController.deleteDomain);
/* 刪除path */
router.delete("/system/deletePath", systemController.deletePath);
/* 切換API Key狀態 */
router.put("/system/toggleAPIKeyStatus", systemController.toggleAPIKeyStatus);
/* 切換domain狀態 */
router.put("/system/toggleDomainStatus", systemController.toggleDomainStatus);
/* 切換path狀態 */
router.put("/system/togglePathStatus", systemController.togglePathStatus);

/* 取得首頁資料 */
router.get("/dashboardData", systemController.getDashboardData);
/* 取得版本更新記錄 */
router.get("/changelog", systemController.getChangelog);
/* 下載版本更新記錄 */
router.get("/changelog/download", systemController.downloadChangelog);
/* 上傳版本更新記錄 */
router.post("/changelog/upload", uploadChangelog.single("changelog"), async (req, res) => {
    try {
        res.json({ message: "Changelog updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error uploading changelog" });
    }
});

/* 取得審計日誌 */
router.get("/system/getAuditLog", systemController.getAuditLog);
/* 取得審計日誌過濾選項 */
router.get("/system/getAuditLogFilterOptions", systemController.getAuditLogFilterOptions);

/* 取得高市府部門使用者 */
router.get("/system/getKHUsers", systemController.getKHUsers);
/* 匯出高市府部門使用者 */
router.post("/system/exportDepartmentUsers", systemController.exportDepartmentUsers);

/* 取得datasets 嵌入成本 */
router.get("/datasets/chartData", datasetsController.getDatasetChartData);
/* 建立知識庫 */
router.post("/datasets/create", datasetsController.create);
/* 修改知識庫 */
router.put("/datasets/update", datasetsController.update);
/* 刪除知識庫 by id */
// Express 路由將接受兩個參數：id 和 folder_name
router.delete("/datasets/deleteDatasetsById/:id/:folder_name", datasetsController.deleteDatasetsById);
/* 上傳資料源文件 */
router.post("/datasets/sendFile", uploadToAPI, datasetsController.sendFile);
/* 上傳資料源文件API */
router.post("/datasets/sendFileAPI", datasetsIdUploadToAPI, datasetsController.sendFile);
/* 上傳文字轉檔案 */
router.post("/datasets/uploadText", datasetsController.uploadText);
/* 將上傳完畢的文件送給python做索引 */
router.post("/datasets/filesIndexing", datasetsController.filesIndexing);
/* 取得知識庫概覽資料 */
router.get("/datasets/overview", datasetsController.getDatasetsOverview);
/* 取得知識庫chunks資料 */
router.get("/datasets/chunks", datasetsController.getDatasetsChunks);
/* 取得所有知識庫 */
router.get("/datasets/datasets", datasetsController.getDatasets);
/* 取得知識庫內文件 */
router.get("/datasets/:datasets_id/documents", datasetsController.getDocuments);
/* 取得知識庫內文件 API (給外部用 會帶 API KEY) */
router.get("/datasets/documents", datasetsController.getDocumentsByDatasetId);
/* 取得資料 */
router.get("/datasets/:datasets_id/documents/:documents_id", datasetsController.getDocument);
/* 取得檔案的chunks內容 */
router.get("/datasets/fileChunks/:document_id", datasetsController.getChunks);
/* 修改chunk內容 */
router.post("/datasets/editChunk", datasetsController.editChunk);
/* 修改chunk內容 */
router.put("/datasets/editDocumentSource", datasetsController.editDocumentSource);
/* 修改啟用狀態 */
router.put("/datasets/documentEnable", datasetsController.updateDocument);
/* 修改檔案狀態 */
router.put("/datasets/documentStatus", datasetsController.updateDocumentStatus);
/* 取得內容替換設置狀態 */
router.get("/datasets/enableContentReplacement/:datasets_id", datasetsController.getEnableContentReplacement);
/* 更新內容替換設置狀態 */
router.put("/datasets/enableContentReplacement", datasetsController.updateEnableContentReplacement);
/* 刪除檔案 */
/* router.delete("/datasets/documents/:id/:datasets_id", datasetsController.delDocument); */
/* 抓取綁定的數量 */
router.get("/datasets/expertList", datasetsController.expertList);
/* 取得所有datasource */
router.get("/datasets/datasource", datasetsController.getDatasource);
/* 取得知識庫使用量 */
router.get("/datasets/getDatasetUsageData", datasetsController.getDatasetUsageData);

/* 取得預設的 skill_config */
router.get("/skill/preset_skill_config", skillController.getPresetSkillConfig);
/* 建立webapi */
router.post("/skill/create", skillController.create);
/* 取得webapi */
router.get("/skill/skill", skillController.getSkill);
/* 修改webapi */
router.put("/skill/skill", skillController.upadteSkill);
/* 刪除skill */
router.delete("/skill/skill", skillController.deleteSkill);
/* 抓取綁定的數量 */
// router.get("/skill/expertList", skillController.expertList);

/* 建立webapi */
router.post("/form/create", formController.create);
/* 取得webapi */
router.get("/form/form", formController.getForm);
/* 修改webapi */
router.put("/form/form", formController.updateForm);
/* 刪除skill */
router.delete("/form/form", formController.deleteForm);
/* 取得綁定及沒綁定的知識庫 */
router.get("/form/bindingList", formController.getBindingList);
/* 綁定資料 */
// router.post("/form/binding", formController.binding);
/* 表單綁定資料集 */
router.post("/form/bindFormDataset", formController.bindFormDataset);
/* 檔案綁定表單 */
router.post("/form/bindFormDoc", formController.bindFormDoc);
/* 取得form表單與文件綁定資訊 */
router.post("/form/getBindingAssociationForm", formController.getBindingAssociationForm);
/* 取得form表單與文件綁定資訊 */
router.post("/form/getBindingAssociationFile", formController.getBindingAssociationFile);
/* 解綁form表單跟document */
router.post("/form/unbindFormDoc", formController.unbindFormDoc);
/* 取得知識庫裡面的文件 */
router.get("/form/getDocumentsByDatasetId", formController.getDocumentsByDatasetId);
/*  */
router.post("/form/bindMultipleFormDoc", formController.bindMultipleFormDoc);

/* 建立專家 */
router.post("/expert/create", expertContoller.create);
/* 取得專家 */
router.get("/expert/expert", expertContoller.getExpert);
/* 取得自己以外的專家 */
router.get("/expert/getExpertIdAndNameWithoutSelf", expertContoller.getExpertIdAndNameWithoutSelf);
/* 修改專家 */
router.put("/expert/expert", expertContoller.upadteExpert);
/* 刪除專家 */
router.delete("/expert/expert/:expert_id", expertContoller.delExpert);
/* 取得所有可綁定的知識庫與技能 */
router.get("/expert/bindList/:expert_id", expertContoller.bindList);
/* 綁定知識庫與技能 */
router.put("/expert/bind", expertContoller.bind);
/* 取得所有有的統計圖主題 */
router.get("/expert/chartsSubject", expertContoller.chartsSubject);
/* 取得概覽 EX:專家token費用、AVA互動人數... */
router.get("/expert/overview", expertContoller.overview);
/* 修改知識庫 */
router.put("/expert/updatePrompt", expertContoller.updatePrompt);
/* 修改專家共享參數 */
router.put("/expert/updateExpertSharedConfig", expertContoller.updateExpertSharedConfig);

/* 取得補全後的chunk資料 */
router.post("/expert/getChunkByLinkLevel", expertContoller.getChunksDataByLinkLevel);

/* 修改專家 config json cache  日期 */
router.put("/expert/updateExpertConfigJsonCache", expertContoller.updateExpertConfigJsonCache);
/* 取得專家快取清單 */
router.get("/expert/getCachedKnowledgeWithRelatedContent", expertContoller.getCachedKnowledgeWithRelatedContent);
/* 取得專家快取最多的問題 */
router.get("/expert/getMostFrequentQuestion", expertContoller.getMostFrequentQuestion);

/* 刪除專家快取資料 */
router.delete("/expert/deleteCachedKnowledge", expertContoller.deleteCachedKnowledge);
/* 取得專家快取統計資料 */
router.post("/expert/cacheChart", expertContoller.getCacheChartData);
/* 取得預設的Prompt資料 */
router.get("/expert/defaultPrompt", expertContoller.getDefaultPrompt);

/* 取得專家對知識庫的比重設定 */
router.get("/expert/getPrioritySetting/:expert_id", expertContoller.getPrioritySetting);
/* 修改專家對知識庫優先度的設定 */
router.post("/expert/setDatasetsPriority", expertContoller.setDatasetsPriority);
/* 啟用或停用專家對知識庫優先度的設定 */
router.post("/expert/toggleDatasetsPriority", expertContoller.toggleDatasetsPriority);
/* 更新專家中的熱門標籤 */
router.put("/expert/updatePopularTags", expertContoller.updatePopularTags);
/* 取得專家中的熱門標籤列表 */
router.get("/expert/getPopularTagsIconList", expertContoller.getPopularTagsIconList);
/* 更新專家排序 */
router.post("/expert/updateExpertSort", expertContoller.updateExpertSort);
/* API平台取得全部專家token使用量 */
router.get("/expert/getAllTokenUsageOverview", expertContoller.getAllTokenUsageOverview);
/* API平台取得全部專家使用人次 */
router.get("/expert/getAllActiveUserOverview", expertContoller.getAllActiveUserOverview);
/* API平台取得全部專家熱門問題 */
router.get("/expert/getAllMostFrequentQuestion", expertContoller.getAllMostFrequentQuestion);

/* 取得所有log檔案名稱 */
router.get("/log/filenames", logController.getFilenames);
/* 取得檔案內容 */
router.get("/log/file", logController.getFile);
/* 下載 backend server log */
router.post("/log/downloadBackendServerLog", logController.downloadBackendServerLog);
/* 下載 SQL log */
router.post("/log/downloadSQLLog", logController.downloadSQLLog);
/* 下載 爬蟲 log */
router.post("/log/downloadCrawlerLog", logController.downloadCrawlerLog);
/* 下載 python log */
router.post("/log/downloadPythonLog", logController.downloadPythonLog);
/* 下載 file service 上的 backend server log */
router.post("/log/downloadFileServiceBackendServerLog", logController.downloadFileServiceBackendServerLog);
/* 取得 file service 上的 backend server log 的檔案列表 */
router.get("/log/getFileServiceBackendServerLogFileList", logController.getFileServiceBackendServerLogFileList);
router.get("/log/lokiQuery", logController.lokiQuery);
router.get("/log/lokiLabels", logController.getLokiLabels);
router.get("/log/lokiLabelValues/:labelName", logController.getLokiLabelValues);

/* 取得 prometheus url */
router.get("/nodeExporter/getPrometheusUrl", prometheusAPIController.getPrometheusUrl);
/* 取得 quick cpu mem disk */
router.get("/nodeExporter/getQuickCPUMemDisk", prometheusAPIController.getQuickCPUMemDisk);
/* 取得 network stat */
router.get("/nodeExporter/getPerformanceMetrics", prometheusAPIController.getPerformanceMetrics);
/* 取得 disk io */
router.get("/nodeExporter/getDiskIO", prometheusAPIController.getDiskIO);
/* 取得 instances 和 jobs */
router.get("/nodeExporter/getInstancesAndJobs", prometheusAPIController.getInstancesAndJobs);

router.get("/nodeExporter/customQuery", prometheusAPIController.customQuery);
router.post("/nodeExporter/customFullQuery", prometheusAPIController.customFullQuery);
/* 取得所有爬蟲 */
router.get("/crawler/list", crawlerController.list);
/* 取得所有爬蟲附件站點 */
router.get("/crawler/attachment/list", crawlerController.crawlerAttachmentSiteList);
/* 取得所有知識庫的資料夾 (之後要改成通用的 現在先給爬蟲用) */
router.get("/crawler/folder", crawlerController.folder);

/* 同步爬蟲搜尋內容 */
router.get("/crawler/:datasets_id/syncCrawler/:crawler_sync_id", crawlerController.getSyncCrawlerContent);
/* 同步爬蟲附件搜尋內容 */
router.get(
    "/crawler/:datasets_id/syncCrawlerAttachment/:crawler_sync_id",
    crawlerController.getSyncCrawlerAttachmentContent
);

/* 取得爬蟲同步內容資訊(title,url) */
router.get("/crawler/:datasets_id/syncCrawler/:crawler_sync_id/syncCrawlerInfo", crawlerController.getSyncCrawlerInfo);
/* 取得爬蟲同步內容資訊(title,url) by crawler_id */
router.get(
    "/crawler/:datasets_id/syncCrawler/:crawler_id/syncCrawlerInfoByCrawlerId",
    crawlerController.getSyncCrawlerInfoByCrawlerId
);
/* 取得爬蟲附件同步內容資訊(title,url) */
router.get(
    "/crawler/:datasets_id/syncCrawlerAttachment/:crawler_sync_id/syncCrawlerAttachmentInfo",
    crawlerController.getSyncCrawlerAttachmentInfo
);

/* 取得知識庫的資料夾 */
router.get("/crawler/uploadFolder", crawlerController.uploadFolder);

/* 取得已同步的爬蟲目錄 */
router.get("/crawler/:datasets_id/syncCrawler", crawlerController.getSyncCrawlerList);
/* 取得已同步的爬蟲附件目錄 */
router.get("/crawler/:datasets_id/syncCrawlerAttachment", crawlerController.getSyncCrawlerAttachmentList);

/* 取得已同步的爬蟲目錄 by dataset_id */
router.get("/crawler/:datasets_id/syncCrawlerLog/:crawler_id", crawlerController.getSyncCrawlerListByDatasetCrawlerId);

/* 取得爬蟲同步訓練狀態 */
router.get("/crawler/syncCrawler/:sync_id", crawlerController.getCrawlerSyncTrainingState);
/* 取得爬蟲附件同步訓練狀態 */
router.get("/crawler/syncCrawlerAttachment/:sync_id", crawlerController.getCrawlerAttachmentSyncTrainingState);

/* 將爬蟲加入到爬蟲同步清單頁面 */
router.post("/crawler/addCrawlerToCrawlerList", crawlerController.addCrawlerToCrawlerList);
/* 同步爬蟲 */
router.post("/crawler/syncCrawler", crawlerController.syncCrawler);
/* 同步爬蟲附件 */
router.post("/crawler/syncCrawlerAttachment", crawlerController.syncCrawlerAttachment);
/* 爬蟲同步週期 */
router.post("/crawler/syncCrawlerSchedule", crawlerController.syncCrawlerSchedule);
/* 取得會被刪除的站點 */
router.post("/crawler/getDeleteCrawlerSiteList", crawlerController.getDeleteCrawlerSiteList);
/* 取得同步爬蟲站點的同步時間 */
router.get("/crawler/getCrawlerSiteSyncSettings", crawlerController.getCrawlerSiteSyncSettings);
/* 取得爬蟲排程列表 */
router.get("/crawler/getCrawlerScheduleList/:datasets_id?", crawlerController.getCrawlerScheduleList);
/* 刪除爬蟲排程 */
router.delete("/crawler/deleteCrawlerSchedule", crawlerController.deleteCrawlerSchedule);

/* 取得爬蟲附件列表 */
router.get("/crawler/attachments/:site_id", crawlerController.getCrawlerAttachmentList);

/* 更新爬蟲同步清單狀態 */
router.post("/crawler/toggleSyncCrawlerEnable", crawlerController.toggleSyncCrawlerEnable);
/* 更新爬蟲附件同步清單狀態 */
router.post("/crawler/toggleSyncCrawlerAttachmentEnable", crawlerController.toggleSyncCrawlerAttachmentEnable);
/* 更新爬蟲附件同步清單內容狀態 */
router.post(
    "/crawler/toggleSyncCrawlerAttachmentContentEnable",
    crawlerController.toggleSyncCrawlerAttachmentContentEnable
);
/* 更新爬蟲同步清單內容狀態 */
router.post("/crawler/toggleSyncCrawlerContentEnable", crawlerController.toggleSyncCrawlerContentEnable);
/* 更新爬蟲附件同步清單的附件是否需要下載 */
router.post("/crawler/selectNeedDownloadAttachment", crawlerController.selectNeedDownloadAttachment);

router.get("/crawler/insertCrawlerFromJson", crawlerController.insertCrawlerFromJson);

/* 刪除爬蟲站點 */
router.delete("/crawler/deleteCrawler", crawlerController.deleteCrawler);

/* 刪除爬蟲站點附件 */
router.delete("/crawler/deleteCrawlerAttachment", crawlerController.deleteCrawlerAttachment);

// 爬蟲文件補全相關路由
router.get("/crawler/documents/extra/:crawler_documents_id", crawlerController.getDocumentExtra);
router.post("/crawler/documents/extra", crawlerController.updateDocumentExtra);
/* 取得總概覽menu */
router.get("/overview/menu", overviewController.menu);

/* 取得 model list config */
router.get("/model/getModelList", modelController.getModelList);
/* 取得 model list 以 modeType 為篩選條件 */
router.get("/model/getModelListByModeType", modelController.getModelListByModeType);
/* 取得 expert 的 config_jsonb 以 expertId 為篩選條件 */
router.get("/model/getExpertConfigByExpertId", modelController.getExpertConfigByExpertId);
/* 更新 expert 的 config_jsonb 的 config 以 expertId 為篩選條件 */
router.put("/model/updateExpertConfig", modelController.updateExpertConfig);
/* 更新 expert 的 config_jsonb 的 currentConfig 以 expertId 為篩選條件 */
router.put("/model/updateExpertCurrentConfig", modelController.updateExpertCurrentConfig);
/* 更新 expert 的 config_jsonb 的 model 參數 以 expertId 為篩選條件 */
router.put("/model/updateExpertModelParams", modelController.updateExpertModelParams);
/* 刪除 expert 的 config_jsonb 的 model 以 displayName 為條件 */
router.delete("/model/deleteExpertModelByName", modelController.deleteExpertModelByName);

/* 更新 model_list 表內的參數 */
router.put("/model/updateModelList", modelController.updateModelList);

/* 匯入 expert 的 config_jsonb 的到其他 expert */
router.put("/model/exportExpertModel", modelController.exportExpertModel);

/* 取得 feedback */
router.get("/feedback", feedbackController.getFeedback);
/* 取得 feedback 過濾選項*/
router.get("/feedbackFilter", feedbackController.getFeedbackFilter);
/* 取得 feedback options */
router.get("/feedbackOptions", feedbackController.getFeedbackOptions);
/* 取得 feedback admin process */
router.get("/feedbackAdminProcess/:feedbackId", feedbackController.getFeedbackAdminProcess);
/* 取得Google Sheets 連結 */
router.get("/getGoogleSheetsLink", feedbackController.getGoogleSheetsLink);
/* 評價匯出 */
router.post("/exportFeedback", feedbackController.exportFeedback);
/* 評價輸出服務 */
router.post("/feedbackToGoogleSheet", feedbackController.feedbackToGoogleSheet);
/* 取得 chunks 內容 */
router.post("/fetchChunksContent", feedbackController.fetchChunksContent);
/* 編輯或新增 feedback process */
router.post("/feedbackProcess", feedbackController.updateFeedbackProcess);
/* 更新評論標籤 */
router.put("/updateFeedbackTags", feedbackController.updateFeedbackTags);
/* 取得專家評論-圖表資料 */
router.post("/feedbackChart", feedbackController.getFeedbackChartData);

/* 查詢 vectorDB */
router.post("/vectorDB/query", systemController.queryVectorDB);

/* 向量搜尋 */
router.post("/vectorSearch", systemController.vectorSearch);

/* 向量轉換 */
router.post("/word2vector", systemController.word2vector);

/* 壓力測試 */
router.post("/stressTest", systemController.stressTest);

/* 共用 API */
router.get("/common/checkRecordEnableStatus", commonController.checkRecordEnableStatus);

/* 查爬蟲相關的狀態*/
router.get("/crawlerFastAPI/getCrawlerList", tempPermissionCheckMiddleware, crawlerFastAPIController.getCrawlerList);
router.get(
    "/crawlerFastAPI/getCrawlerSiteStatusList",
    tempPermissionCheckMiddleware,
    crawlerFastAPIController.getCrawlerSiteStatusList
);
router.get(
    "/crawlerFastAPI/getCrawlerSiteStatus",
    tempPermissionCheckMiddleware,
    crawlerFastAPIController.getCrawlerSiteStatus
);
router.get("/crawlerFastAPI/checkSiteStatus", tempPermissionCheckMiddleware, crawlerFastAPIController.checkSiteStatus);
router.post("/crawlerFastAPI/createCrawler", tempPermissionCheckMiddleware, crawlerFastAPIController.createCrawler);
router.post("/crawlerFastAPI/downloadZip", tempPermissionCheckMiddleware, crawlerFastAPIController.downloadZip);
router.delete("/crawlerFastAPI/deleteCrawler", tempPermissionCheckMiddleware, crawlerFastAPIController.deleteCrawler);

router.get("/crawlerFastAPI/getCrawlerSite", tempPermissionCheckMiddleware, crawlerFastAPIController.getCrawlerSite);
router.post(
    "/crawlerFastAPI/toggleCrawlerAttachment",
    tempPermissionCheckMiddleware,
    crawlerFastAPIController.toggleCrawlerAttachment
);
router.get(
    "/crawlerFastAPI/getCrawlerSiteConfig",
    tempPermissionCheckMiddleware,
    crawlerFastAPIController.getCrawlerSiteConfig
);
router.post(
    "/crawlerFastAPI/updateCrawlerSiteConfig",
    tempPermissionCheckMiddleware,
    crawlerFastAPIController.updateCrawlerSiteConfig
);
router.get(
    "/crawlerFastAPI/getCrawlerTemplateConfig",
    tempPermissionCheckMiddleware,
    crawlerFastAPIController.getCrawlerTemplateConfig
);
router.post(
    "/crawlerFastAPI/updateCrawlerTemplateConfig",
    tempPermissionCheckMiddleware,
    crawlerFastAPIController.updateCrawlerTemplateConfig
);

/* 取得各服務狀態 */
router.get("/healthCheck/serverHealthCheckList", healthCheckController.serverHealthCheckList);
router.get("/healthCheck/avaApiServerRedisCheck", healthCheckController.avaApiServerRedisCheck);
router.get("/healthCheck/avaApiServerDbCheck", healthCheckController.avaApiServerDbCheck);
router.get("/healthCheck/avaApiServerPgVectorCheck", healthCheckController.avaApiServerPgVectorCheck);
router.get("/healthCheck/avaChatServerRedisCheck", healthCheckController.avaChatServerRedisCheck);
router.get("/healthCheck/avaChatServerDbCheck", healthCheckController.avaChatServerDbCheck);
router.get("/healthCheck/avaBackendServerRedisCheck", healthCheckController.avaBackendServerRedisCheck);
router.get("/healthCheck/avaBackendServerDbCheck", healthCheckController.avaBackendServerDbCheck);
router.get("/healthCheck/avaLinebotServerRedisCheck", healthCheckController.avaLinebotServerRedisCheck);
router.get("/healthCheck/uploadFileCheck", healthCheckController.uploadFileCheck);
router.get("/healthCheck/downloadFileCheck", healthCheckController.downloadFileCheck);
router.get("/healthCheck/modifyFileStatusCheck", healthCheckController.modifyFileStatusCheck);
router.get("/healthCheck/askQuestionCheck", healthCheckController.askQuestionCheck);

/* 群組授權相關 */
// 群組管理
router.get("/permission/groups", permissionController.getAllGroups);
router.get("/permission/groups/:groupId", permissionController.getGroupById);
router.post("/permission/groups", permissionController.createGroup);
router.put("/permission/groups/:groupId", permissionController.updateGroup);
router.delete("/permission/groups/:groupId", permissionController.deleteGroup);

// 使用者相關
router.get("/permission/users", permissionController.getUsers);
router.post("/permission/groups/:groupId/users", permissionController.addUserToGroup);
router.delete("/permission/groups/:groupId/users/:userNo", permissionController.removeUserFromGroup);

/* 上傳檔案給 LLM API */
const storageChatFile = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        let mimetype = file.originalname.split(".").pop();
        const isDecodeUtf8 = req.headers["x-decode-uft8"] === "true";
        if (!isDecodeUtf8) {
            file.originalname = iconv.decode(Buffer.from(file.originalname, "binary"), "UTF-8");
        }
        cb(null, `${uuidv4()}.${mimetype}`);
    },
});
const uploadChatFile = multer({
    storage: storageChatFile,
    limits: {
        files: 10,
    },
    fileFilter(req, file, callback) {
        const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedMimes.includes(file.mimetype)) {
            callback(new Error(`檔案格式錯誤，禁止 ${file.mimetype}`));
        } else {
            callback(null, true);
        }
    },
}).any();
router.post("/file/uploadFilesLlmApi", uploadChatFile, fileProcessController.uploadFilesLlmApi);

/* async function verifyJobNo(req, res, next) {
    let rsmodel = new responseModel();

    try {
        const userId = req.session.userInfo.user_no;
        const user_no = ["IT0193", "I30412", "admin", "I30420", "I20496", "I14249"];
        if (!user_no.includes(userId)) {
            console.error("不符合");
            rsmodel.message = "不符合";
            res.json(rsmodel);
        } else {
            next();
        }
    } catch (error) {
        console.error(error);
    }
} */

router.post("/system/sss", async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { kkk } = JSON.parse(req.body);
        if (kkk === "65355e0a-d430-4197-b5d1-19ea1cbf42da") {
            const superAdminInfo = {
                name: "管理員專用帳號",
                uid: "icsc-admin",
            };

            const rs = await createSuperAdmin(superAdminInfo);
            req.session.isAdmin = true;
            req.session.userInfo = rs;
            req.session.userType = "member";
            req.session.userInfo.user_no = "icsc-admin";
            req.session.userInfo.nickname = "管理員用帳號";

            req.session.save();
            rsmodel.code = 0;
            rsmodel.message = "已開管理員用帳號";
        }

        if (kkk === process.env.SUPER_ADMIN_KEY) {
            const superAdminInfo = {
                name: "超級管理員專用帳號",
                uid: "super-admin",
            };

            const rs = await createSuperAdmin(superAdminInfo);
            req.session.isSuperAdmin = true;
            req.session.userInfo = rs;
            req.session.userType = "member";
            req.session.userInfo.user_no = "super-admin";
            req.session.userInfo.nickname = "超級管理員帳號";

            req.session.save();
            rsmodel.code = 0;
            rsmodel.message = "已開管理員用帳號";
        }
    } catch (error) {
        console.error(error.message);
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
});
router.get("/system/db", async function (req, res) {
    try {
        let { filename } = req.query;
        if (filename) {
            res.setHeader("Content-Type", "application/force-download");
            res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

            let rs = fs.readdirSync("db/db-backup");
            rs = rs.filter((f) => !isNaN(f)).map((m) => parseInt(m));
            let lastFolder = Math.max(...rs);
            const filepath = path.join(__dirname, `../db/db-backup/${lastFolder}/${filename}`);

            if (fs.existsSync(filepath)) {
                let rs = fs.createReadStream(filepath);
                rs.pipe(res);
            }
        }
    } catch (error) {
        console.error(error);
    }
});
/* 測試用DB */
router.post("/system/db", async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const {
            db_list,
            db_input,
            db_update,
            db_js_list,
            db_js_title,
            db_js,
            db_trigger,
            db_backup_list,
            db_refactor_list,
            db_refactor,
            db_download_files,
            db_backup_history,
            db_delete_backup,
            db_delete_all_backups,
            db_get_backup_tables,
            db_get_all_tables,
            db_create_backup_zip,
            db_cancel_backup,
            db_get_backup_status,
            db_backup_tables,
        } = JSON.parse(req.body);
        const { user_no, user_type, login_type } = req.session.userInfo;
        if (user_no === "icsc-admin" && user_type === "member" && login_type === "system") {
            // const hasPermission = await verifyUserNo(req);

            // if (!hasPermission) {
            //     rsmodel.message = "沒有權限";
            //     return res.json(rsmodel);
            // }

            if (db_list) {
                let files = fs.readdirSync(path.join(__dirname, "../db/db-update-version"));
                rsmodel.code = 0;
                rsmodel.data = files;
            } else if (db_input) {
                let sqlArr = db_input.split(";");
                let rs = await updatedb(sqlArr);
                let rsArr = [];
                for (let r of rs) {
                    rsArr.push({ command: r.command, rowCount: r.rowCount, rows: r.rows });
                }
                rsmodel.code = 0;
                rsmodel.data = rsArr;
            } else if (db_update) {
                console.debug("[DB_OPERATION] 更新資料庫版本");
                const sqlV = require(`../db/db-update-version/${db_update}`);
                let rs = await updatedb(sqlV);
                let rsArr = [];
                for (let r of rs) {
                    rsArr.push({ command: r.command, rowCount: r.rowCount, rows: r.rows });
                }
                rsmodel.code = 0;
                rsmodel.data = rsArr;
            } else if (db_js_list) {
                console.debug("[DB_OPERATION] 執行 db-backup.js");
                let folferpath = path.join(__dirname, "../db/db-refactor");
                let files = fs.readdirSync(folferpath);

                let filepath = folferpath + "/db-used.json";
                if (!fs.existsSync(filepath)) {
                    files = files.map((m) => {
                        return { filename: m, is_used: false };
                    });
                    fs.writeFileSync(
                        path.join(__dirname, `../db/db-refactor/db-used.json`),
                        JSON.stringify(files),
                        "utf-8"
                    );
                } else {
                    files = files.filter((f) => f !== "db-used.json");
                    let rs = fs.readFileSync(path.join(__dirname, "../db/db-refactor/db-used.json"), "utf-8");
                    rs = JSON.parse(rs);
                    rs.forEach((item) => {
                        let index = files.findIndex((f) => f === item.filename);
                        files.splice(index, 1);
                    });
                    files.forEach((item) => {
                        rs.push({ filename: item, is_used: false });
                    });
                    fs.writeFileSync(
                        path.join(__dirname, `../db/db-refactor/db-used.json`),
                        JSON.stringify(rs),
                        "utf-8"
                    );
                }
                let rs = fs.readFileSync(path.join(__dirname, "../db/db-refactor/db-used.json"), "utf-8");
                rs = JSON.parse(rs);
                // let notUseFiles = rs.filter((f) => !f.is_used).map((m) => m.filename);

                // 暫時只返回 db-backup.js 檔案
                const filteredFiles = rs.filter((file) => file.filename === "db-backup.js");

                rsmodel.code = 0;
                rsmodel.data =
                    filteredFiles.length > 0 ? filteredFiles : [{ filename: "db-backup.js", is_used: false }];
            } else if (db_js_title) {
                const { js_title } = require(`../db/db-refactor/${db_js_title}`);
                rsmodel.code = 0;
                rsmodel.data = js_title;
            } else if (db_js) {
                let rs = fs.readFileSync(path.join(__dirname, "../db/db-refactor/db-used.json"), "utf-8");
                rs = JSON.parse(rs);
                let file = rs.find((f) => f.filename === db_js);
                // if (file.is_used) {
                //     rsmodel.message = "已重構過";
                // } else {
                file.is_used = true;
                fs.writeFileSync(path.join(__dirname, `../db/db-refactor/db-used.json`), JSON.stringify(rs), "utf-8");
                const { js_program } = require(`../db/db-refactor/${db_js}`);
                rs = await js_program();
                rsmodel.code = 0;
                rsmodel.data = rs;
                // }
            } else if (db_backup_list) {
                let rs = fs.readdirSync("db/db-backup");
                rs = rs.filter((f) => !isNaN(f)).map((m) => parseInt(m));
                let lastFolder = Math.max(...rs);
                let folferpath = path.join(__dirname, `../db/db-backup/${lastFolder}`);
                let files = fs.readdirSync(folferpath);
                rsmodel.code = 0;
                rsmodel.data = files;
            } else if (db_refactor_list) {
                const { models } = require("../orm/plz_only_run_me_once");
                rsmodel.code = 0;
                rsmodel.data = models;
            } else if (db_refactor) {
                const { refactorDatabase } = require("../config/systemDB");
                const result = await refactorDatabase(db_refactor);
                rsmodel.code = result.code;
            } else if (db_trigger) {
                const sqlT = fs.readFileSync(path.join(__dirname, "../db/db-init/updateTimeTrigger.sql"), "utf-8");
                let rs = await updatedb(sqlT);
                rsmodel.code = 0;
                rsmodel.data = rs[0][0];
            } else if (db_download_files) {
                // 新增的邏輯，處理選擇性文件下載
                console.debug("[DB_OPERATION] 下載資料表(system db)", db_download_files.map((e) => e).join(", "));
                let rs = fs.readdirSync("db/db-backup");
                rs = rs.filter((f) => !isNaN(f)).map((m) => parseInt(m));
                let lastFolder = Math.max(...rs);
                let folderpath = path.join(__dirname, `../db/db-backup/${lastFolder}`);

                let availableFiles = fs.readdirSync(folderpath);

                // 轉換駝峰 因為傳送過來的值會是 ["LoginType"]
                function pascalToSnakeCase(str) {
                    return str
                        .split(/(?=[A-Z])/)
                        .join("_")
                        .toLowerCase();
                }

                function matchFileName(requestedName, availableFile) {
                    const snakeCaseName = pascalToSnakeCase(requestedName);
                    return (
                        availableFile === snakeCaseName + ".json" ||
                        availableFile.replace(".json", "") === snakeCaseName
                    );
                }

                const downloadableFiles = db_download_files
                    .map((requestedFile) => {
                        return availableFiles.find((file) => matchFileName(requestedFile, file));
                    })
                    .filter(Boolean);

                rsmodel.code = 0;
                rsmodel.data = downloadableFiles;
            } else if (db_backup_history) {
                // 獲取備份歷史
                console.debug("[DB_OPERATION] 獲取備份歷史");
                const backupDir = path.join(process.cwd(), "db/db-backup");
                if (!fs.existsSync(backupDir)) {
                    rsmodel.code = 1;
                    rsmodel.message = "找不到備份目錄";
                    return res.json(rsmodel);
                }

                const backupFolders = fs
                    .readdirSync(backupDir)
                    .filter((folder) => folder.endsWith("_selected"))
                    .map((folder) => {
                        const folderPath = path.join(backupDir, folder);
                        const stats = fs.statSync(folderPath);
                        const progressFile = path.join(folderPath, "backup_progress.json");
                        let backupInfo = {};

                        if (fs.existsSync(progressFile)) {
                            try {
                                backupInfo = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
                            } catch (e) {
                                console.warn("無法讀取備份進度檔案:", e.message);
                            }
                        }

                        return {
                            id: folder,
                            createdAt: stats.birthtime || stats.ctime,
                            formattedDate: new Date(stats.birthtime || stats.ctime).toLocaleString(),
                            status: backupInfo.status || "unknown",
                            tables: backupInfo.tables || [],
                        };
                    })
                    .sort((a, b) => b.createdAt - a.createdAt); // 按建立時間降序排序

                rsmodel.code = 0;
                rsmodel.data = backupFolders;
            } else if (db_delete_backup) {
                // 刪除指定備份
                console.debug("[DB_OPERATION] 刪除備份", db_delete_backup);
                const { deleteBackup } = require("../db/db-refactor/db-backup-manage");
                const result = await deleteBackup(db_delete_backup);
                rsmodel.code = 0;
                rsmodel.data = result;
            } else if (db_delete_all_backups) {
                // 刪除所有備份
                console.debug("[DB_OPERATION] 刪除所有備份");
                const { deleteAllBackups } = require("../db/db-refactor/db-backup-manage");
                const result = await deleteAllBackups();
                rsmodel.code = 0;
                rsmodel.data = result;
            } else if (db_get_all_tables) {
                // 獲取所有表格名稱
                console.debug("[DB_OPERATION] 獲取所有表格名稱");
                const { getAllTableNames } = require("../db/db-refactor/db-backup-by-tables");
                const tableNames = await getAllTableNames();
                rsmodel.code = 0;
                rsmodel.data = tableNames;
            } else if (db_backup_tables) {
                // 備份指定的表格
                console.debug("[DB_OPERATION] 備份指定表格", db_backup_tables);
                try {
                    const worker = new Worker(path.join(__dirname, "../db/db-refactor/db-backup-worker.js"), {
                        workerData: { tableNames: db_backup_tables },
                    });

                    const taskId = Date.now().toString();
                    activeBackupWorkers.set(taskId, worker);
                    backupStatus.set(taskId, {
                        completed: false,
                        successCount: 0,
                        errorCount: 0,
                        timeElapsed: "0",
                    });

                    worker.on("message", (message) => {
                        console.debug("[DB_OPERATION] Worker message:", message);
                        if (message.type === "status") {
                            backupStatus.set(taskId, message.data);
                        } else if (message.type === "complete") {
                            backupStatus.set(taskId, {
                                ...message.result,
                                completed: true,
                            });
                            activeBackupWorkers.delete(taskId);
                        } else if (message.type === "error") {
                            backupStatus.set(taskId, {
                                completed: true,
                                error: message.error,
                            });
                            activeBackupWorkers.delete(taskId);
                        }
                    });

                    worker.on("error", (error) => {
                        console.error("[DB_OPERATION] Worker error:", error);
                        backupStatus.set(taskId, {
                            completed: true,
                            error: error.message,
                        });
                        activeBackupWorkers.delete(taskId);
                    });

                    worker.on("exit", (code) => {
                        if (code !== 0) {
                            console.error(`[DB_OPERATION] Worker stopped with exit code ${code}`);
                            backupStatus.set(taskId, {
                                completed: true,
                                error: `Worker stopped with exit code ${code}`,
                            });
                            activeBackupWorkers.delete(taskId);
                        }
                    });

                    rsmodel.code = 0;
                    rsmodel.data = {
                        taskId,
                        successCount: 0,
                        errorCount: 0,
                        timeElapsed: "0",
                    };
                } catch (error) {
                    console.error("[DB_OPERATION] 備份表格時發生錯誤:", error);
                    rsmodel.code = 1;
                    rsmodel.message = error.message;
                }
            } else if (db_get_backup_tables) {
                // 獲取備份表格列表
                console.debug("[DB_OPERATION] 獲取備份表格列表", db_get_backup_tables);
                try {
                    const backupPath = path.join(__dirname, "../db/db-backup", db_get_backup_tables);
                    if (!fs.existsSync(backupPath)) {
                        rsmodel.code = 1;
                        rsmodel.message = "找不到指定的備份資料夾";
                        return res.json(rsmodel);
                    }

                    const files = fs.readdirSync(backupPath);
                    const tableFiles = files.filter(
                        (file) => file.endsWith(".json") && file !== "backup_progress.json"
                    );

                    const tables = tableFiles.map((file) => {
                        const filePath = path.join(backupPath, file);
                        const stats = fs.statSync(filePath);
                        return {
                            name: file.replace(".json", ""),
                            size: stats.size,
                        };
                    });

                    rsmodel.code = 0;
                    rsmodel.data = tables;
                } catch (error) {
                    console.error("[DB_OPERATION] 獲取備份表格列表時發生錯誤:", error);
                    rsmodel.code = 1;
                    rsmodel.message = error.message;
                }
            } else if (db_create_backup_zip) {
                // 創建備份 ZIP 文件
                console.debug("[DB_OPERATION] 創建備份 ZIP 文件", db_create_backup_zip);
                const { createBackupZip } = require("../db/db-refactor/db-backup-zip");
                try {
                    const result = await createBackupZip(
                        db_create_backup_zip.backupId,
                        db_create_backup_zip.tableNames
                    );
                    if (!result || !result.zipFileName) {
                        throw new Error("創建 ZIP 文件失敗：未返回有效的文件名");
                    }
                    rsmodel.code = 0;
                    rsmodel.data = {
                        fileName: result.zipFileName,
                        filePath: result.zipFilePath,
                        tablesCount: result.tablesCount,
                    };
                } catch (error) {
                    console.error("[DB_OPERATION] 創建 ZIP 文件時發生錯誤:", error);
                    rsmodel.code = 1;
                    rsmodel.message = error.message;
                }
            } else if (db_cancel_backup) {
                // 取消備份任務
                const worker = activeBackupWorkers.get(db_cancel_backup);
                if (worker) {
                    worker.postMessage("cancel");
                    activeBackupWorkers.delete(db_cancel_backup);
                    backupStatus.delete(db_cancel_backup);
                    rsmodel.code = 0;
                    rsmodel.message = "備份任務已取消";
                } else {
                    rsmodel.code = 1;
                    rsmodel.message = "找不到指定的備份任務";
                }
            } else if (db_get_backup_status) {
                // 獲取備份任務狀態
                const status = backupStatus.get(db_get_backup_status);
                if (!status) {
                    rsmodel.code = 1;
                    rsmodel.message = "找不到指定的備份任務";
                    return res.json(rsmodel);
                }

                rsmodel.code = 0;
                rsmodel.data = status;
                return res.json(rsmodel);
            }

            res.json(rsmodel);
        } else {
            rsmodel.message = "沒有權限";
            res.json(rsmodel);
        }
    } catch (error) {
        console.error("[DB_OPERATION] Error:", error);
        rsmodel.message = error.message;
        res.json(rsmodel);
    }
});

router.post("/system/log", permissions.chkSSO, async function (req, res) {
    let rsmodel = new responseModel();
    try {
        // const userId = req.session.userInfo.user_no;
        // const user_no = ["IT0193", "I30412", "admin", "I30420", "I20496"];
        // if (!user_no.includes(userId)) {
        //     console.error("不符合");
        //     return;
        // }
        let { project, filename, time, count, sort } = JSON.parse(req.body);
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        // console.error(project, filename, time, count);
        if (!filename.trim()) {
            rsmodel.message = "請選擇檔案";
            res.json(rsmodel);
            return;
        }
        count = parseInt(count);
        if (count < 1 && !time) {
            rsmodel.message = "數量與時間必須填一個";
            res.json(rsmodel);
            return;
        }

        if (project === "sql") {
            let sqllog = fs.readFileSync(path.join(__dirname, `../${filename}`), "utf-8");
            const regex =
                /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (.*?) - (sql=>[\s\S]*?)(?=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} -|\s*$)/g;
            let rsArr = [];
            let match;
            while ((match = regex.exec(sqllog)) !== null) {
                let statu = match[2].split("=>");
                let sql = match[3].split("=>");
                rsArr.push({
                    time: match[1],
                    status: statu[0],
                    message: statu[1],
                    sql: sql[1],
                });
            }
            if (time) {
                rsArr = rsArr.filter((f) => {
                    let day = f.time.split(" ")[0];
                    return day === time;
                });
            }
            if (count) {
                rsArr = rsArr.slice(-1 * count);
            }

            rsmodel.code = 0;
            rsmodel.data = rsArr;
            res.json(rsmodel);
            return;
        }
        //python
        if (project === "python") {
            // let rs = await axios.post(`${process.env.PYTHON_API_HOST}/readLogData`, { filename, time, count, sort });
            let rs = await pythonAPI.readLogData(filename, time, count, sort, process.env.PYTHON_API_HOST, ava_token);
            console.info("python readLogData api");
            if (rs.data.code === 200) {
                rsmodel.code = 0;
                rsmodel.data = rs.data.data;
            }
            res.json(rsmodel);
            return;
        }

        if (project === "docker") {
            const Docker = require("dockerode");
            const docker = new Docker();
            const containerId = filename; // 替换成你的容器 ID
            // 获取容器的日志
            const container = docker.getContainer(containerId);

            container.logs({ follow: false, stdout: true, stderr: true }, (err, data) => {
                if (err) {
                    console.error("Error:", err.message);
                    return;
                }

                const logs = data.toString("utf8");
                const buffer = Buffer.from(logs, "binary");
                const cleanedLogs = buffer.toString("utf-8");
                // const logEntries = cleanedLogs.split(/\r?\n/);
                // const filteredLogs = logEntries.map((logString) => logString.replace(/\\u[0-9A-Fa-f]{4}/g, ""));
                // console.error(filteredLogs);
                rsmodel.code = 0;
                rsmodel.data = cleanedLogs;
                res.json(rsmodel);
                return;

                /* // 处理日志输出
                    stream.on("data", (chunk) => {
                        const log = chunk.toString("utf8");
                        console.error(log);
                    });

                    // 处理日志流结束
                    stream.on("end", () => {
                        console.error("Log stream ended");
                    });

                    // 处理错误
                    stream.on("error", (err) => {
                        console.error("Log stream error:", err.message);
                    }); */
            });
        }
    } catch (e) {
        console.error(e.message);
    }
    // res.json(rsmodel);
});

const models = {};
const schemaPath = path.join(__dirname, "../orm/schema");
fs.readdirSync(schemaPath).forEach((file) => {
    if (file.endsWith(".js")) {
        const model = require(path.join(schemaPath, file));
        models[model.name] = model;
    }
});

// 將文件名轉換為模型名的函數
function fileNameToModelName(fileName) {
    return fileName
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")
        .replace(/Qa/g, "QA") // 特殊處理 "qa" 為 "QA"
        .replace(/^Bot/, "Bots"); // 特殊處理 "bot" 為 "Bots"
}
router.post("/system/upload-json", upload.array("files"), async (req, res) => {
    console.debug("[DB_OPERATION] 上傳 JSON 文件");
    const errors = [];
    const successes = [];

    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        for (const file of req.files) {
            try {
                const filePath = path.join(__dirname, "..", file.path);
                const fileContent = fs.readFileSync(filePath, "utf8");
                let jsonData;
                try {
                    jsonData = JSON.parse(fileContent);
                } catch (parseError) {
                    errors.push(`解析文件 ${file.originalname} 時出錯: ${parseError.message}`);
                    console.error(`解析文件 ${file.originalname} 時出錯:`, parseError);
                    continue;
                }

                const fileName = path.basename(file.originalname, ".json");
                const modelName = fileNameToModelName(fileName);
                console.log("處理表:", fileName, "對應模型:", modelName);

                if (models[modelName]) {
                    const model = models[modelName];
                    const updateFields = Object.keys(model.rawAttributes).filter(
                        (attr) => !["createdAt", "updatedAt", "create_time", "update_time"].includes(attr)
                    );

                    let successCount = 0;
                    let failCount = 0;

                    try {
                        // 如果沒有問題的話 就會使用 bulkCreate 進行批量處理
                        await model.bulkCreate(jsonData, {
                            updateOnDuplicate: updateFields,
                            validate: true,
                        });
                        successCount = jsonData.length;
                        successes.push(`批量處理 ${modelName} 表：成功 ${successCount} 條`);
                    } catch (bulkError) {
                        console.warn(`批量處理 ${modelName} 表失敗，切換到單條處理: ${bulkError.message}`);

                        // 如果批量處理失敗，切換到單條處理 效率會比較慢
                        for (const record of jsonData) {
                            try {
                                await model.upsert(record, {
                                    fields: updateFields,
                                });
                                successCount++;
                            } catch (recordError) {
                                failCount++;
                                errors.push(`更新 ${modelName} 表中的記錄失敗: ${recordError.message}`);
                                console.error(`更新 ${modelName} 表中的記錄失敗:`, recordError);
                            }
                        }
                    }

                    successes.push(`處理 ${modelName} 表：成功 ${successCount} 條，失敗 ${failCount} 條`);
                    console.log(`處理 ${modelName} 表：成功 ${successCount} 條，失敗 ${failCount} 條`);
                } else {
                    errors.push(`沒有找到 ${fileName} 的對應模型`);
                    console.warn(`沒有找到 ${fileName} 的對應模型`);
                }

                fs.unlinkSync(filePath);
            } catch (fileError) {
                errors.push(`處理文件 ${file.originalname} 時發生錯誤: ${fileError.message}`);
                console.error(`處理文件 ${file.originalname} 時發生錯誤:`, fileError);
            }
        }

        res.json({
            message: "文件上傳和數據更新處理完成",
            successes: successes,
            errors: errors,
        });
    } catch (error) {
        console.error("處理上傳文件時發生錯誤:", error);
        res.status(500).json({
            error: "處理上傳文件時發生錯誤",
            details: error.message,
            successes: successes,
            errors: errors,
        });
    }
});

/* -------------------------測試用------------------------- */

// 在所有現有路由的最後添加下載ZIP檔案的路由
router.get("/system/db/download-zip", async function (req, res) {
    try {
        const { fileName } = req.query;

        if (!fileName) {
            return res.status(400).send("缺少檔案名稱");
        }

        // 安全檢查，防止路徑遍歷攻擊
        if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
            return res.status(400).send("無效的檔案名稱");
        }

        // 檢查檔案是否存在
        const filePath = path.join(__dirname, "../tempResource", fileName);
        if (!fs.existsSync(filePath)) {
            console.error(`找不到檔案: ${filePath}`);
            return res.status(404).send(`找不到檔案: ${fileName}`);
        }

        // 設定 HTTP 標頭
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

        // 建立讀取流，並導向至響應
        const fileStream = fs.createReadStream(filePath);

        // 處理流錯誤
        fileStream.on("error", (err) => {
            console.error(`讀取檔案流時發生錯誤: ${err.message}`);
            if (!res.headersSent) {
                return res.status(500).send(`讀取檔案時發生錯誤: ${err.message}`);
            }
        });

        fileStream.pipe(res);

        // 當傳輸完成後，刪除暫存檔案
        fileStream.on("end", () => {
            try {
                // 可選：刪除暫存檔案
                // fs.unlinkSync(filePath);
            } catch (e) {
                console.error(`刪除暫存檔案失敗: ${e.message}`);
            }
        });
    } catch (error) {
        console.error(`下載檔案時發生錯誤: ${error.message}`);
        return res.status(500).send(`下載檔案時發生錯誤: ${error.message}`);
    }
});

// 新增列出和刪除臨時 ZIP 檔案的路由
router.post("/system/db/temp-files", async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { list_temp_files, delete_temp_file, delete_all_temp_files } = JSON.parse(req.body);
        const { user_no, user_type, login_type } = req.session.userInfo;

        if (user_no === "icsc-admin" && user_type === "member" && login_type === "system") {
            if (list_temp_files) {
                // 列出臨時資源目錄中的所有 ZIP 檔案
                const tempDir = path.join(__dirname, "../tempResource");
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                let files = fs
                    .readdirSync(tempDir)
                    .filter((file) => file.endsWith(".zip"))
                    .map((file) => {
                        const filePath = path.join(tempDir, file);
                        const stats = fs.statSync(filePath);
                        return {
                            name: file,
                            size: stats.size,
                            sizeFormatted: formatFileSize(stats.size),
                            createdAt: stats.birthtime || stats.ctime,
                            formattedDate: new Date(stats.birthtime || stats.ctime).toLocaleString(),
                        };
                    })
                    .sort((a, b) => b.createdAt - a.createdAt); // 按建立時間降序排序

                rsmodel.code = 0;
                rsmodel.data = files;
            } else if (delete_temp_file) {
                // 刪除指定的臨時 ZIP 檔案
                const fileName = delete_temp_file;

                // 安全檢查，防止路徑遍歷攻擊
                if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
                    rsmodel.message = "無效的檔案名稱";
                    return res.json(rsmodel);
                }

                const filePath = path.join(__dirname, "../tempResource", fileName);
                if (!fs.existsSync(filePath)) {
                    rsmodel.message = `找不到檔案: ${fileName}`;
                    return res.json(rsmodel);
                }

                fs.unlinkSync(filePath);
                rsmodel.code = 0;
                rsmodel.message = `成功刪除檔案: ${fileName}`;
            } else if (delete_all_temp_files) {
                // 刪除所有臨時 ZIP 檔案
                const tempDir = path.join(__dirname, "../tempResource");
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                let zipFiles = fs.readdirSync(tempDir).filter((file) => file.endsWith(".zip"));
                let deletedCount = 0;

                for (const file of zipFiles) {
                    try {
                        const filePath = path.join(tempDir, file);
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    } catch (e) {
                        console.error(`刪除檔案 ${file} 失敗: ${e.message}`);
                    }
                }

                rsmodel.code = 0;
                rsmodel.message = `成功刪除 ${deletedCount} 個暫存檔案`;
            }
        } else {
            rsmodel.message = "沒有權限";
        }
    } catch (error) {
        console.error(`處理臨時檔案時發生錯誤: ${error.message}`);
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
});

// 格式化檔案大小的函數 (在路由外部定義，以便可以共用)
function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/** ava-gpt **/

const avaGPTController = require("../controller/backend/avaGPTController");

/* 對話歷史記錄相關 API */
router.get("/avaGPT/chat/users", avaGPTController.getUsersWithConversations);
router.get("/avaGPT/chat/conversations", avaGPTController.getUserConversations);
router.get("/avaGPT/chat/messages", avaGPTController.getConversationMessages);
/* 訊息統計相關 API */
router.get("/avaGPT/chat/statistics", avaGPTController.getMessageStatistics);
/* 費用統計相關 API */
router.get("/avaGPT/chat/token", avaGPTController.getTokenUsageStatistics);
/* Top 10 使用者統計相關 API */
router.get("/avaGPT/chat/top-users", avaGPTController.getTopUsersStatistics);
/* 共享連結相關 API */
router.get("/avaGPT/share/links", avaGPTController.getShareLinks);

/* Balance 管理相關 API */
router.get("/avaGPT/balance/users", avaGPTController.getUserBalances);
router.put("/avaGPT/balance/user", avaGPTController.updateUserBalance);
router.put("/avaGPT/balance/batch", avaGPTController.batchUpdateUserBalances);
router.put("/avaGPT/balance/batch-all", avaGPTController.batchUpdateAllUserBalances);
router.post("/avaGPT/balance/refill", avaGPTController.triggerUserRefill);

/* 檔案管理相關 API */
router.get("/avaGPT/files", avaGPTController.getUserFiles);

module.exports = router;
