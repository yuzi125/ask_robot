const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const axios = require("axios");
const backendHost = process.env.AVA_BACKEND_URL;
const ChatTheme = require("../../orm/schema/chat_theme");
const Settings = require("../../orm/schema/settings");
const Announcement = require("../../orm/schema/announcement");
const UserAcknowledgment = require("../../orm/schema/user_acknowledgement");
const { Op, Sequelize } = require("sequelize");
exports.settings = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let rs = (await sql.query("select * from settings")).rows;
        let version = "";
        const bulletin = {};
        const theme = {};
        let guest_enable = 0;
        let conversation_direction = "left";
        let welcome_word_update_frequency = 1;
        let system_version = "1.0.0";
        let show_source_chunk = true;
        let show_extra_chunk = true;
        let enable_rtc_recording = false;
        let max_message_length = 1000;
        let chat_input_height = 1;
        let chat_input_placeholder = "請輸入訊息";
        let agreement_alert = "請先同意使用說明才能使用此功能。";
        let current_environment = process.env.SSO_TYPE; // 傳到前端用 current_environment 不要讓別人知道是 SSO_TYPE
        let chat_file_upload_enable = false;
        let chat_file_translate_enable = false;
        rs.forEach((item) => {
            switch (item.key) {
                case "system_bulletin":
                case "system_bulletin_color":
                case "system_bulletin_color_back":
                    bulletin[item.key] = item.value;
                    break;
                case "system_client_theme":
                case "system_client_theme_default":
                    theme[item.key] = item.value;
                    break;
                case "guest_enable":
                    guest_enable = item.value;
                    break;
                case "conversation_direction":
                    conversation_direction = item.value;
                    break;
                case "welcome_word_update_frequency":
                    welcome_word_update_frequency = item.value;
                    break;
                case "system_version":
                    system_version = item.value;
                    break;
                case "show_source_chunk":
                    show_source_chunk = item.value;
                    break;
                case "show_extra_chunk":
                    show_extra_chunk = item.value;
                    break;
                case "is_maintenance":
                    is_maintenance = item.value;
                    break;
                case "enable_rtc_recording":
                    enable_rtc_recording = item.value;
                    break;
                case "max_message_length":
                    max_message_length = item.value;
                    break;
                case "chat_input_height":
                    chat_input_height = item.value;
                    break;
                case "chat_input_placeholder":
                    chat_input_placeholder = item.value;
                    break;
                case "agreement_alert":
                    agreement_alert = item.value;
                    break;
                case "chat_file_upload_enable":
                    chat_file_upload_enable = item.value == "1";
                    break;
                case "chat_file_translate_enable":
                    chat_file_translate_enable = item.value == "1";
                    break;
            }
        });

        const obj = {
            bulletin,
            theme,
            guest_enable,
            conversation_direction,
            welcome_word_update_frequency,
            system_version,
            show_source_chunk,
            show_extra_chunk,
            is_maintenance,
            enable_rtc_recording,
            max_message_length,
            chat_input_height,
            chat_input_placeholder,
            agreement_alert,
            current_environment,
            chat_file_upload_enable,
            chat_file_translate_enable,
        };
        rsmodel.code = 0;
        rsmodel.data = obj;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.checkConnection = async function (req, res) {
    // 檢查方法已經寫在middleware中了，所以這邊直接回傳即可。
    let rsmodel = new responseModel();
    rsmodel.code = 0;
    rsmodel.message = "success";
    res.json(rsmodel);
};

exports.getChatTheme = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        // 使用 Settings ORM 來查詢預設主題
        const defaultThemeSetting = await Settings.findOne({
            where: { key: "system_client_theme_default" },
        });
        const defaultTheme = defaultThemeSetting?.value || "dark";

        // 獲取所有主題
        const themes = await ChatTheme.findAll({
            order: [
                ["is_system", "DESC"],
                ["create_time", "ASC"],
            ],
        });

        // 將主題數據轉換為前端需要的格式
        const themeData = {};

        // 遍歷所有主題並添加到 themeData
        themes.forEach((theme) => {
            themeData[theme.name] = {
                ...theme.colors,
                remark: theme.remark || theme.name, // 如果沒有 remark，使用主題名稱
                is_system: theme.is_system,
            };
        });

        rsmodel.code = 0;
        rsmodel.data = themeData;
    } catch (error) {
        console.error("Error getting chat themes:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getCurrentThemeSetting = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        // 使用 Settings ORM 同時查詢兩個設定
        const [themeSetting, lockThemeSetting] = await Promise.all([
            Settings.findOne({
                where: { key: "system_client_theme_default" },
            }),
            Settings.findOne({
                where: { key: "lock_chat_theme" },
            }),
        ]);

        // 將 "1" 轉為 true，其他值("0" 或 null)轉為 false
        const isLocked = lockThemeSetting?.value === "1";

        rsmodel.code = 0;
        rsmodel.data = {
            currentTheme: themeSetting?.value || "dark", // 如果沒有設定，返回預設值 "dark"
            lockTheme: isLocked,
        };
    } catch (error) {
        console.error("Error getting theme settings:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 檢查使用者是否有需要確認的公告
exports.checkPendingAnnouncements = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        const uid = req.session.userInfo.uid;

        // 查找當前有效的公告
        const announcements = await Announcement.findAll({
            where: {
                status: "PUBLISHED",
            },
            include: [
                {
                    model: UserAcknowledgment,
                    as: "acknowledgments",
                    where: { uid },
                    required: false,
                },
            ],
        });

        // 過濾出使用者尚未確認的公告
        const pendingAnnouncements = announcements.filter(
            (ann) =>
                !ann.acknowledgments.length || (ann.require_agreement && ann.acknowledgments[0].action !== "AGREED")
        );

        rsmodel.code = 0;
        rsmodel.data = {
            hasPending: pendingAnnouncements.length > 0,
            announcements: pendingAnnouncements.map((ann) => ({
                id: ann.id,
                title: ann.title,
                content: ann.content,
                type: ann.type,
                use_markdown: ann.use_markdown,
                require_agreement: ann.require_agreement,
                version: ann.version,
            })),
        };
    } catch (error) {
        console.error("Error checking pending announcements:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 記錄使用者確認
exports.acknowledgeAnnouncement = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { announcementId } = req.params;
        const uid = req.session.userInfo.uid;

        // 確認公告存在且有效
        const announcement = await Announcement.findOne({
            where: {
                id: announcementId,
                status: "PUBLISHED",
            },
        });

        if (!announcement) {
            throw new Error("公告不存在或已失效");
        }

        // 檢查使用者是否已經確認過
        const userAcknowledgment = await UserAcknowledgment.findOne({
            where: {
                announcement_id: announcementId,
                uid: uid,
            },
        });

        if (!userAcknowledgment) {
            // 記錄新的確認
            await UserAcknowledgment.create({
                announcement_id: announcementId,
                uid: uid,
                action: announcement.require_agreement ? "AGREED" : "READ",
                ip_address: req.ip,
                user_agent: req.headers["user-agent"],
            });

            // 查找當前有效的條款
            const terms = await Announcement.findAll({
                where: {
                    status: "PUBLISHED",
                    type: "TERMS",
                },
                include: [
                    {
                        model: UserAcknowledgment,
                        as: "acknowledgments",
                        where: { uid },
                        required: false,
                    },
                ],
            });

            // 過濾出使用者尚未確認的條款
            const pendingTerms = terms.filter(
                (ann) =>
                    !ann.acknowledgments.length || (ann.require_agreement && ann.acknowledgments[0].action !== "AGREED")
            );

            rsmodel.data = {
                hasPending: pendingTerms.length > 0,
                terms: pendingTerms.map((ann) => ({
                    id: ann.id,
                    title: ann.title,
                })),
            };
            rsmodel.code = 0;
            rsmodel.message = "成功記錄使用者確認";
        } else {
            // 檢查是否需要更新行為（當公告類型是 TERMS 且需要同意時）
            if (
                announcement.type === "TERMS" &&
                announcement.require_agreement === true &&
                userAcknowledgment.action === "READ"
            ) {
                // 更新為已同意
                await userAcknowledgment.update({
                    action: "AGREED",
                    ip_address: req.ip,
                    user_agent: req.headers["user-agent"],
                });

                rsmodel.code = 0;
                rsmodel.message = "已更新為同意狀態";
            } else {
                rsmodel.code = 0;
                rsmodel.message = "使用者已經確認過";
            }
        }
    } catch (error) {
        console.error("Error recording acknowledgment:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 批量記錄使用者確認
exports.acknowledgeAnnouncements = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const { announcementIds } = JSON.parse(req.body);
        const uid = req.session.userInfo.uid;

        // 確認所有公告存在且有效
        const announcements = await Announcement.findAll({
            where: {
                id: {
                    [Op.in]: announcementIds,
                },
                status: "PUBLISHED",
            },
        });

        if (!announcements.length) {
            throw new Error("找不到有效的公告");
        }

        // 批量記錄使用者確認
        const acknowledgments = announcements.map((announcement) => ({
            announcement_id: announcement.id,
            uid: uid,
            action: announcement.require_agreement ? "AGREED" : "READ",
            ip_address: req.ip,
            user_agent: req.headers["user-agent"],
        }));

        await UserAcknowledgment.bulkCreate(acknowledgments, {
            ignoreDuplicates: true, // 忽略重複的記錄
        });

        rsmodel.code = 0;
        rsmodel.message = "成功批量記錄使用者確認";
    } catch (error) {
        console.error("Error recording bulk acknowledgment:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getAnnouncements = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const uid = req.session.userInfo.uid;

        // 獲取所有已發布的條款和公告
        const [terms, announcements] = await Promise.all([
            Announcement.findAll({
                where: {
                    type: "TERMS",
                    status: "PUBLISHED",
                },
                order: [["create_time", "DESC"]],
            }),
            Announcement.findAll({
                where: {
                    type: "NOTICE",
                    status: "PUBLISHED",
                },
                order: [["create_time", "DESC"]],
            }),
        ]);

        // 獲取使用者的確認記錄
        const userAcknowledgments = await UserAcknowledgment.findAll({
            where: {
                uid: uid,
                announcement_id: [...terms, ...announcements].map((a) => a.id),
            },
        });

        // 處理條款狀態
        const termsWithStatus = terms.map((term) => ({
            id: term.id,
            title: term.title,
            content: term.content,
            create_time: term.create_time,
            agreed: userAcknowledgments.some((ack) => ack.announcement_id === term.id && ack.action === "AGREED"),
            use_markdown: term.use_markdown,
        }));

        // 處理公告狀態
        const announcementsWithStatus = announcements.map((announcement) => ({
            id: announcement.id,
            title: announcement.title,
            content: announcement.content,
            create_time: announcement.create_time,
            read: userAcknowledgments.some((ack) => ack.announcement_id === announcement.id),
            use_markdown: announcement.use_markdown,
        }));

        rsmodel.code = 0;
        rsmodel.data = {
            terms: termsWithStatus,
            announcements: announcementsWithStatus,
        };
    } catch (error) {
        console.error("Error fetching user notifications:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// 後端 API
exports.checkUnread = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        const uid = req.session.userInfo.uid;

        // 檢查是否有未讀的公告或未同意的條款
        const [unreadAnnouncements, unacceptedTerms] = await Promise.all([
            Announcement.count({
                where: {
                    type: "NOTICE",
                    status: "PUBLISHED",
                },
                include: [
                    {
                        model: UserAcknowledgment,
                        as: "acknowledgments", // 添加別名
                        where: { uid },
                        required: false,
                    },
                ],
                having: Sequelize.literal("COUNT(acknowledgments.id) = 0"), // 使用別名
            }),
            Announcement.count({
                where: {
                    type: "TERMS",
                    status: "PUBLISHED",
                    require_agreement: true,
                },
                include: [
                    {
                        model: UserAcknowledgment,
                        as: "acknowledgments", // 添加別名
                        where: {
                            uid,
                            action: "AGREED",
                        },
                        required: false,
                    },
                ],
                having: Sequelize.literal("COUNT(acknowledgments.id) = 0"), // 使用別名
            }),
        ]);

        rsmodel.code = 0;
        rsmodel.data = {
            hasUnread: unreadAnnouncements > 0 || unacceptedTerms > 0,
        };
    } catch (error) {
        console.error("Error checking unread notifications:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};
