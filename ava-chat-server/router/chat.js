"use strict";
const express = require("express");
const router = express.Router();

const { upload } = require("../global/upload");
const iconv = require("iconv-lite");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const audioUpload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 1024 * 1024 * 15, // 限制文件大小為 15MB
    },
});
const { rateLimiter } = require("../global/redisStore.js");
const responseModel = require("../model/responseModel");

const userController = require("../controller/chat/user");
const botController = require("../controller/chat/bot");
const contactController = require("../controller/chat/contact");
const systemController = require("../controller/chat/system");
const logController = require("../controller/chat/logController");
const expertController = require("../controller/chat/expert");
const feedbackController = require("../controller/chat/feedback");
const ragController = require("../controller/rag/ragController.js"); // 新增 RAG Controller
const linebotController = require("../controller/chat/linebot");
const fileProcessController = require("../controller/chat/fileProcessController");
const downloadController = require("../controller/download");
const apiKeyMiddleware = require("../middleware/apiKeyMiddleware");
const notificationController = require("../controller/chat/notificationController");
/* 高雄市政府 簡易登入 */
router.post("/KSG/login", userController.KSGLogin);

/* 高雄市政府 第一次登入修改密碼 */
router.post("/KSG/changePassword", userController.KSGChangePassword);

/* 登入 */
router.post("/user/login", userController.login);
/* 登出 */
router.get("/user/logout", userController.logout);
/* 給身分 */
router.get("/user/info", userController.getInfo);
/* 驗證TOTP */
router.post("/user/authentication", userController.authentication);
/* 驗證TOTP */
router.get("/user/checkLockButton", userController.checkLockButton);
/* 檢查是否有JustTwoFactorAuth這個session */
router.get("/user/checkJustTwoFactorAuth", userController.checkJustTwoFactorAuth);

/* 取得前端設定檔 */
router.get("/system/settings", systemController.settings);
/* 檢查db連線狀態 */
router.get("/system/checkConnection", systemController.checkConnection);
/* 取得主題色 */
router.get("/system/getChatTheme", systemController.getChatTheme);
/* 取得當前主題 */
router.get("/system/getCurrentThemeSetting", systemController.getCurrentThemeSetting);
/* 檢查用戶是否有需要確認的公告 */
router.get("/system/checkPendingAnnouncements", systemController.checkPendingAnnouncements);
/* 記錄用戶確認 */
router.post("/system/acknowledgeAnnouncement/:announcementId", systemController.acknowledgeAnnouncement);
/* 批量記錄用戶確認 */
router.post("/system/acknowledgeAnnouncements", systemController.acknowledgeAnnouncements);
/* 取得所有公告 */
router.get("/system/announcements", systemController.getAnnouncements);
/* 檢查用戶是否有未讀的公告 */
router.get("/system/checkUnread", systemController.checkUnread);

/* 取得與機器人聊天訊息 */
router.post("/bot/message", botController.message);
/* 建立聊天房間 */
router.post("/bot/room", botController.createRoom);
/* 新增機器人聊天 */
router.post("/bot/saveMessage", botController.saveMessage);
/* 更新機器人聊天 */
router.put("/bot/saveMessage", botController.updateMessageJson);

/* 檢查聊天同步 */
router.post("/bot/chkSyncMsg", botController.chkSyncMsg);
/* 取得推薦詞列表 */
router.get("/bot/recommendList", botController.recommendList);
/* 取得自訂義推薦列表 */
router.get("/bot/customRecommendList", botController.customRecommendList);
/* 新增自訂義推薦 */
router.post("/bot/customRecommend", botController.addCustomRecommend);
/* 刪除自訂義推薦 */
router.post("/bot/delCustomRecommend", botController.delCustomRecommend);
/* 更新上下文 */
router.put("/bot/context", botController.updateContext);
/* 同步上下文 */
router.post("/bot/chkSyncContext", botController.chkSyncContext);
/* 修改聊天訊息 */
router.post("/bot/updateMessage", botController.updateMessage);
/* 新增歷史訊息 */
router.post("/bot/historyMessage", botController.addHistoryMessage);
/* 取得歷史訊息 */
router.get("/bot/historyMessage", botController.historyMessage);
/* 取得所有提示詞 */
router.get("/bot/recommend", botController.recommend);
/* 取得所有報修單 */
router.get("/bot/form", botController.getForm);
/* 更新 bot_message 的 chat json */
router.put("/bot/updateChatJson", botController.updateChatJson);
/* 取得 history_messages 表的最新自增 id */
router.get("/bot/autoIncrementId", botController.autoIncrementId);
/* 檢查專家網址 */
router.post("/bot/checkExpertUrl", botController.checkExpertUrl);

/* 送出問題 */
router.post("/bot/avaTextGeneration", upload, rateLimiter, botController.avaTextGeneration);
/* post API通道 */
router.post("/bot/avaApiSkillPost", upload, botController.avaApiSkillPost);
/* post API通道 */
router.post("/bot/avaUploadAudioFile", audioUpload.single("audio"), botController.avaUploadAudioFile);
/* 取得icon列表 */
router.get("/bot/getIconList", botController.getIconList);
/* 取得最小輸入字數 */
router.get("/bot/getMinMessageLength", botController.getMinMessageLength);

/* 取得所有員工列表 */
router.get("/contact/list", contactController.list);
/* 建立聊天房間 */
router.post("/contact/room", contactController.createRoom);
/* 取得聯絡人聊天 */
router.post("/contact/message", contactController.message);
/* 發送聊天 */
router.post("/contact/sendMessage", contactController.sendMessage);
/* 發送圖片 */
router.post("/contact/picture", upload, contactController.sendPicture);
/* 檢查聊天同步 */
router.post("/contact/chkSyncMsg", contactController.chkSyncMsg);
/* 分享給其他人 */
router.post("/contact/share", upload, contactController.share);

//取得所有log檔案名稱
router.get("/log/filenames", logController.getFilenames);
//取得檔案內容
router.get("/log/file", logController.getFile);
/* 下載 log */
router.post("/log/downloadLogFile", logController.downloadLogFile);

//取得專家 tip
router.get("/expert/tip", expertController.getExpertTip);
//取得專家的相關資料
router.get("/expert/expert", expertController.getExpertData);

//取得 feedback 選項
router.get("/feedback/options", feedbackController.getFeedbackOptions);
//取得 feedback id 取得 feedback 資料
router.get("/feedback/:feedback_id", feedbackController.getFeedbackByFeedbackId);

//新增 feedback
router.post("/feedback", feedbackController.createOrUpdateFeedback);

/* RAG 系統相關路由 */
/* 處理 RAG 查詢請求 */
router.post("/rag/query", upload, ragController.query);
/* 健康檢查 */
// router.get("/rag/healthcheck", ragController.healthcheck);

// linebot
router.post("/setupDataBeforeRequest", linebotController.setupDataBeforeRequest);
router.post("/checkUserAgreeAnnouncement", linebotController.checkUserAgreeAnnouncement);
router.post("/saveUserAgreeAnnouncement", linebotController.saveUserAgreeAnnouncement);
router.get("/getLineSettings", linebotController.getLineSettings);
router.get("/autoIncrementId", linebotController.autoIncrementId);
router.post("/avaTextGeneration", linebotController.avaTextGeneration);
router.get(
    "/getHistoryMessagesData/:historyMessageId/:feedbackName/:feedbackOptionsStatus",
    linebotController.getHistoryMessagesData
);
router.get("/getFeedbackOptions/:status", linebotController.getFeedbackOptions);
router.post("/createOrUpdateFeedback", linebotController.createOrUpdateFeedback);
router.get("/checkPendingAnnouncements", linebotController.checkPendingAnnouncements);
router.post("/checkUpdateFeedback", linebotController.checkUpdateFeedback);
router.get("/getFeedbackType/:feedback_id", linebotController.getFeedbackType);
router.post("/cancelFeedback", linebotController.cancelFeedback);

//* 處理聊天室的上傳檔案

// 配置 multer 存儲選項，保留原始檔案名稱
const storage = multer.diskStorage({
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

const uploadChatFile = multer({ storage: storage });

// 檔案上傳路由
router.post("/upload-files", uploadChatFile.array("files", 10), fileProcessController.processUploadedFile);

// 獲取對話中的檔案列表
router.get("/files/:userId/:conversationId", fileProcessController.getConversationFiles);

// 刪除對話中的檔案
router.delete("/files/:userId/:conversationId", fileProcessController.deleteConversationFiles);

// 提供檔案路徑給AI服務
router.post("/file-paths", fileProcessController.getFilePathsForAI);

// 輪巡翻譯任務
router.get("/translation-tasks", notificationController.getUnnotifiedTasks);

router.get("/notification/translation-tasks", notificationController.getTranslationTasks);

// 標記翻譯任務已通知
router.post("/translation-tasks/mark-notified", notificationController.markTasksAsNotified);

// SSE 即時推播翻譯任務 有要優化的話再使用
// router.get("/translation-tasks/stream", notificationController.sseStream);

// 處理上傳的檔案 (翻譯文件 先分開 到時候再合併 DRY)
const translationStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        // 獲取文件擴展名
        const fileExtension = file.originalname.split(".").pop();

        // 處理文件名編碼問題
        const isDecodeUtf8 = req.headers["x-decode-uft8"] === "true";
        if (!isDecodeUtf8) {
            file.originalname = iconv.decode(Buffer.from(file.originalname, "binary"), "UTF-8");
        }

        // 獲取原始文件名（去除擴展名）
        const originalNameWithoutExtension = file.originalname.replace(new RegExp(`\\.${fileExtension}$`), "");

        // 生成當前時間戳
        const timestamp = Date.now();

        // 組合新文件名: 原始檔案名稱_{timestamp}.副檔名
        const newFilename = `${originalNameWithoutExtension}_${timestamp}.${fileExtension}`;

        cb(null, newFilename);
    },
});

const uploadTranslationFile = multer({ storage: translationStorage });

router.post(
    "/upload-translation-files",
    uploadTranslationFile.array("files", 10),
    fileProcessController.processUploadTranslationFile
);

/* 聊天室下載檔案 */
router.post("/chatroom/download", downloadController.chatroomDownload);

router.get("/initial", async function (req, res) {
    let rsmodel = new responseModel();
    try {
        rsmodel.code = 0;
        rsmodel.message = "初始化成功";
        res.json(rsmodel);
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;
