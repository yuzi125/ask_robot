import { storeToRefs } from "pinia";
import { createRouter, createWebHashHistory } from "vue-router";
import axios from "../global/axios";

import { getRedirectUrl } from "@/utils/common";
import { useSettingStore, useUserStore, usePermissionStore } from "../store";
import emitter from "@/global/emitter";

const routes = [
    {
        path: "/",
        name: "home",
        component: () => import("../views/DashboardView.vue"),
        meta: { title: "AVA 智慧特助", auth: true },
    },
    {
        path: "/usermanageold",
        name: "usermanageold",
        component: () => import("../views/UserManageView.vue"),
        meta: { title: "使用者管理", auth: true },
        children: [
            {
                path: "messages/:user_type",
                component: () => import("../views/UserManageMessagesView.vue"),
                meta: { private: true },
                props: (route) => {
                    return {
                        user_type: route.params.user_type,
                    };
                },
            },
        ],
    },
    {
        path: "/usermanage",
        name: "usermanage",
        component: () => import("../views/chat/UserChatHistoryView.vue"),
        meta: { title: "使用者管理", private: true, auth: true },
    },
    {
        path: "/systemsets",
        name: "systemsets",
        component: () => import("../views/SystemsetsView.vue"),
        meta: { title: "系統設定", auth: true },
        children: [
            {
                path: "recommends",
                component: () => import("../views/SystemRecommendView.vue"),
            },
            {
                path: "announcements",
                component: () => import("../views/system/AnnouncementsView.vue"),
            },
            {
                path: "announcements_check_record",
                component: () => import("@/views/system/AnnouncementsCheckRecordView.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "bulletin",
                component: () => import("../views/SystemBulletinView.vue"),
            },
            {
                path: "theme",
                component: () => import("@/views/system/ChatThemeSettingsView.vue"),
            },
            {
                path: "expert_sort",
                component: () => import("@/views/system/ExpertSort.vue"),
            },
            {
                path: "chat_settings",
                component: () => import("@/views/system/SystemChatSettingsView.vue"),
            },
            {
                path: "chat_advance_settings",
                component: () => import("@/views/system/SystemChatAdvanceSettingsView.vue"),
            },
            {
                path: "rate_limit_settings",
                component: () => import("@/views/system/SystemRateLimitSettingsView.vue"),
            },
            {
                path: "monitor",
                component: () => import("@/views/system/SystemMonitorView.vue"),
            },
            {
                path: "audit_log",
                component: () => import("@/views/system/AuditLogView.vue"),
            },
            {
                path: "crawler_schedule",
                component: () => import("@/views/system/SystemCrawlerScheduleView.vue"),
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "crawler_attachment_schedule",
                component: () => import("@/views/system/SystemCrawlerAttachmentScheduleView.vue"),
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "version",
                component: () => import("../views/SystemVersionView.vue"),
            },

            {
                path: "db",
                component: () => import("../views/DB.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },

            {
                path: "log",
                component: () => import("../views/LOG.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "prometheus",
                component: () => import("@/views/system/Prometheus.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "loki",
                component: () => import("@/views/system/Loki.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "crawler",
                component: () => import("@/views/system/CrawlerStatusCheck.vue"),
                meta: { auth: true, private: true },
            },
            {
                path: "session_mock",
                component: () => import("../views/SessionMockView.vue"),
                meta: { private: false, auth: false },
            },
            {
                path: "user-permission",
                component: () => import("@/views/system/UserPermission.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "group-permission",
                component: () => import("@/views/system/GroupPermissionManagement.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "line_bot_settings",
                component: () => import("@/views/system/LineBotSetting.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "safety_settings",
                component: () => import("@/views/system/SafetySettingsView.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "api_key_management",
                component: () => import("@/views/system/APIKeyManagement.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
            {
                path: "model_management",
                component: () => import("@/views/system/ModelManagement.vue"),
                meta: { onlyAdmin: true }, // 確保權限標記
            },
        ],
    },
    {
        path: "/overview",
        name: "overview",
        component: () => import("../views/OverviewView.vue"),
        meta: { title: "概覽", auth: true },
        children: [
            // {
            //     path: "datasets",
            //     component: () => import("../views/SystemRecommendView.vue"),
            // },
        ],
    },
    {
        path: "/experts",
        name: "experts",
        component: () => import("../views/ExpertsView.vue"),
        meta: { title: "專家", auth: true },
    },
    {
        path: "/experts/:expert_id",
        component: () => import("../views/ExpertView.vue"),
        meta: { title: "專家", auth: true },
        props: (route) => {
            return {
                expert_id: route.params.expert_id,
            };
        },
        children: [
            {
                path: "overview",
                component: () => import("../views/ExpertOverviewView.vue"),
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
            {
                path: "binding",
                component: () => import("../views/ExpertBindingView.vue"),
            },
            {
                path: "configuration",
                component: () => import("../views/ExpertConfigurationView.vue"),
                meta: { private: true },
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
            {
                path: "search",
                component: () => import("@/views/experts/SearchConfigurationView.vue"),
                meta: { private: true },
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
            {
                path: "intention",
                component: () => import("@/views/experts/intentionConfigurationView.vue"),
                meta: { private: true },
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
            {
                path: "kor",
                component: () => import("@/views/experts/KorConfigurationView.vue"),
                meta: { private: true },
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
            {
                path: "voice",
                component: () => import("@/views/experts/VoiceConfigurationView.vue"),
                meta: { private: true },
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
            {
                path: "record",
                component: () => import("@/views/ExpertRecordView.vue"),
            },
            {
                path: "cacheCharts",
                component: () => import("@/views/experts/cacheCharts.vue"),
            },
            {
                path: "cache",
                component: () => import("@/views/experts/QACache.vue"),
                meta: { private: true },
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
            {
                path: "feedbackCharts",
                component: () => import("@/views/FeedbackCharts.vue"),
            },
            {
                path: "feedbackTable",
                component: () => import("@/views/FeedbackTable.vue"),
            },
            {
                path: "exportFeedback",
                component: () => import("@/components/experts/feedback/ExportFeedback.vue"),
                meta: { title: "專家評價匯出", auth: true },
            },
            {
                path: "settings",
                component: () => import("../views/ExpertSetView.vue"),
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
        ],
    },
    {
        path: "/datasets",
        name: "datasets",
        component: () => import("../views/DatasetsView.vue"),
        meta: { title: "知識庫", auth: true },
    },
    {
        path: "/datasets/create",
        component: () => import("../views/DatasetsCreateView.vue"),
        meta: { title: "知識庫", auth: true },
    },
    {
        path: "/datasets/:datasets_id",
        component: () => import("../views/DatasetView.vue"),
        meta: { title: "知識庫", auth: true },
        props: (route) => {
            return {
                datasets_id: route.params.datasets_id,
            };
        },
        children: [
            {
                path: "overview",
                component: () => import("@/views/datasets/DatasetOverviewView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
            },
            {
                path: "source",
                component: () => import("@/views/DatasetSourceView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
            },
            {
                path: "documents",
                component: () => import("@/views/DocumentsView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
            },
            {
                path: "crawlerSite",
                component: () => import("@/views/datasets/crawler/CrawlerSiteView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "syncCrawler",
                component: () => import("@/views/datasets/crawler/DocumentsCrawlerView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "syncCrawler/byDatasetId/:crawler_id",
                component: () => import("@/views/datasets/crawler/DocumentsCrawlerSyncLogView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                        crawler_id: route.params.crawler_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "syncCrawler/:synchronize_id",
                component: () => import("@/views/datasets/crawler/DocumentsCrawlerContentView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                        synchronize_id: route.params.synchronize_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "crawlerSchedule",
                component: () => import("@/views/datasets/crawler/CrawlerScheduleView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "crawlerAttachmentSite",
                component: () => import("@/views/datasets/crawlerAttachment/CrawlerAttachmentSiteView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "syncAttachmentCrawler",
                component: () => import("@/views/datasets/crawlerAttachment/DocumentsCrawlerAttachmentView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "syncAttachmentCrawler/:synchronize_id",
                component: () => import("@/views/datasets/crawlerAttachment/DocumentsCrawlerAttachmentContentView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                        synchronize_id: route.params.synchronize_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "crawlerAttachmentSchedule",
                component: () => import("@/views/datasets/crawlerAttachment/CrawlerAttachmentScheduleView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
                meta: { requiresCrawlerCheck: true },
            },
            {
                path: "documents/:documents_id",
                component: () => import("@/views/DocumentView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                        documents_id: route.params.documents_id,
                    };
                },
            },
            {
                path: "settings",
                component: () => import("@/views/DatasetsSetView.vue"),
                props: (route) => {
                    return {
                        datasets_id: route.params.datasets_id,
                    };
                },
            },
            {
                path: "configuration",
                component: () => import("@/views/DatasetConfigurationView.vue"),
                props: (route) => {
                    return {
                        expert_id: route.params.expert_id,
                    };
                },
            },
        ],
    },
    {
        path: "/ava-gpt",
        name: "ava-gpt",
        component: () => import("@/views/AVAGPTView.vue"),
        meta: { title: "AVA-GPT", auth: true },
        children: [
            {
                path: "overview",
                component: () => import("@/views/avagpt/AVAGPTOverviewView.vue"),
            },
            {
                path: "chat",
                component: () => import("@/views/avagpt/AVAGPTChatView.vue"),
                meta: { requiresSuperAdmin: true },
            },
            {
                path: "share-links",
                component: () => import("@/views/avagpt/AVAGPTShareLinks.vue"),
            },
            {
                path: "balance",
                component: () => import("@/views/avagpt/AVAGPTBalanceView.vue"),
            },
            {
                path: "files",
                component: () => import("@/views/avagpt/AVAGPTFilesView.vue"),
                meta: { requiresSuperAdmin: true },
            },
        ],
    },
    {
        path: "/skills",
        name: "skills",
        component: () => import("../views/SkillsView.vue"),
        meta: { title: "技能", auth: true },
    },
    {
        path: "/forms",
        name: "forms",
        component: () => import("../views/FormsView.vue"),
        meta: { title: "表單", auth: true },
    },
    {
        path: "/two-factor-authentication",
        name: "TwoFactorAuthentication",
        component: () => import("../views/TwoFactorAuthentication.vue"), // 無權限頁面的 Vue 組件
        meta: { title: "二次驗證設定", auth: false },
    },
    {
        path: "/no-access",
        name: "NoAccess",
        component: () => import("../views/NoAccessView.vue"), // 無權限頁面的 Vue 組件
        meta: { title: "無權限", auth: false },
    },
    {
        path: "/:pathMatch(.*)*",
        name: "not-found",
        component: () => import("../views/NotFoundView.vue"),
        meta: { title: "404 Not Found", auth: true },
    },
];
const router = createRouter({ history: createWebHashHistory(), routes });
let isUserInfoLoaded = false;
let isPermissionsLoaded = false;

router.beforeEach(async (to, from, next) => {
    if (to.meta.title) {
        document.title = to.meta.title;
    }

    const userStore = useUserStore();

    const { uid, image, nickname, email, user_no } = storeToRefs(userStore);
    const permissionStore = usePermissionStore();

    // 如果是 session_mock 的頁面，不需要檢查權限
    if (to.path.includes("/systemsets/session_mock")) {
        return next();
    }

    // 確保使用者資訊和頁面權限已加載
    if (!isUserInfoLoaded || !isPermissionsLoaded) {
        try {
            const [userResponse, permissionsResponse] = await Promise.all([
                axios.get("/user/info"),
                axios.get("/system/getUserPermissions"),
            ]);

            const userData = userResponse.data.data;
            const permissionsData = permissionsResponse.data.data;

            if (userData) {
                uid.value = userData.uid;
                image.value = userData.avatar || "user-raw.png";
                nickname.value = userData.nickname;
                email.value = userData.e_mail;
                user_no.value = userData.user_no;
                isUserInfoLoaded = true;
            } else {
                next({ path: "/" });
                return;
            }

            if (permissionsData) {
                permissionStore.setPermissions(permissionsData);
                isPermissionsLoaded = true;
            } else {
                next(false);
                return;
            }
        } catch (error) {
            console.error("Error fetching user info or permissions:", error);
            next(false);
            return;
        }
    }

    // 檢查首頁特殊情況
    if (to.path === "/") {
        const { pagePermissions } = permissionStore;
        if (pagePermissions.home) {
            return next();
        } else {
            // 尋找第一個有權限的頁面
            const pages = ["experts", "datasets", "skills", "usermanage", "systemsets", "forms", "db", "ava-gpt"];
            const firstAllowedPage = pages.find((page) => pagePermissions[page]);

            if (firstAllowedPage) {
                return next({ path: `/${firstAllowedPage}` });
            } else {
                console.log("no access");
                return next({ path: "/no-access" });
            }
        }
    }

    // 處理普遍能靠網址進去二次驗證的情況
    if (to.path === "/two-factor-authentication") {
        const isAuthorized = await axios.get("/user/checkJustTwoFactorAuth");

        if (isAuthorized.data.data.authorized) {
            return next();
        } else {
            return next({ path: "/" });
        }
    }

    // 在二次驗驗按上一頁後，會清空紀錄不讓下一頁回去
    if (from.path === "/two-factor-authentication") {
        next();
        window.history.replaceState(null, "", "/");
        window.history.pushState(null, "", "/");
    }

    // 需要權限的頁面驗證
    if (to.meta.auth) {
        const { pagePermissions, expertPermissions, datasetPermissions } = permissionStore;

        // 取得當前頁面的基本路徑
        const basePath = to.path.split("/")[1];

        // 檢查基本頁面權限
        if (!pagePermissions[basePath]) {
            return next({ path: "/no-access" });
        }
        // console.log("basePath", basePath);
        // 特殊頁面的進階權限檢查
        if (basePath === "datasets") {
            const datasetId = to.path.split("/")[2];
            // 只有當 datasetId 存在於 datasetPermissions 中才進行權限檢查
            if (datasetId && datasetId in datasetPermissions && !datasetPermissions[datasetId]) {
                console.log("in here");
                return next({ path: "/no-access" });
            }
        }

        if (basePath === "experts") {
            const expertId = to.path.split("/")[2];
            // 只有當 expertId 存在於 expertPermissions 中才進行權限檢查
            if (expertId && expertId in expertPermissions && !expertPermissions[expertId]) {
                return next({ path: "/no-access" });
            }
        }

        return next();
    } else {
        return next();
    }
});

router.beforeResolve(async (to, from, next) => {
    if (to.matched.some((record) => record.meta.onlyAdmin)) {
        const permissionsResponse = await axios.get("/system/getUserPermissions");
        const userPermission = permissionsResponse.data.data.userPermission;

        if (!userPermission) {
            return next({ path: "/no-access" });
        } else {
            return next();
        }
    }

    if (to.matched.some((record) => record.meta.requiresSuperAdmin)) {
        const permissionsResponse = await axios.get("/system/getUserPermissions");
        const permissionData = permissionsResponse.data.data;
        if (permissionData.actionPermissions.allowedToViewSuperAdmin) {
            return next();
        } else {
            return next({ path: "/no-access" });
        }
    }

    if (to.matched.some((record) => record.meta.requiresCrawlerCheck)) {
        const permissionsResponse = await axios.get("/system/getUserPermissions");

        const pathSegments = to.path.split("/");
        const datasetsIndex = pathSegments.indexOf("datasets");
        const systemsetsIndex = pathSegments.indexOf("systemsets");

        const permissionData = permissionsResponse.data.data;

        if (permissionData) {
            const enableCrawler = permissionData.enableCrawler;

            // 判斷是否是 datasets 或 systemsets 路徑
            if (datasetsIndex !== -1 && datasetsIndex < pathSegments.length - 1) {
                const afterDatasets = pathSegments.slice(datasetsIndex + 1).join("/");
                if (afterDatasets.toLowerCase().includes("crawler")) {
                    if (enableCrawler) {
                        return next();
                    } else {
                        return next({ name: "not-found" });
                    }
                }
            }

            if (systemsetsIndex !== -1 && systemsetsIndex < pathSegments.length - 1) {
                const afterSystemsets = pathSegments.slice(systemsetsIndex + 1).join("/");
                if (afterSystemsets.toLowerCase().includes("crawler")) {
                    if (enableCrawler) {
                        return next();
                    } else {
                        return next({ name: "not-found" });
                    }
                }
            }
        }
    }

    next();
});

export default router;
