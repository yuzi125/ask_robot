import { storeToRefs } from "pinia";
import { createRouter, createWebHashHistory } from "vue-router";
import axios from "../global/axios";
import { useApiStatusStore, useSettingsStore, useStateStore, useUserStore } from "../store";

const getHomeComponent = () => {
    if (process.env.VITE_APP_MODE === "kaohsiung" || process.env.VITE_APP_MODE === "kaohsiung-iframe") {
        return import("../views/KaohsiungView.vue").then((module) => {
            module.default.displayName = "KaohsiungView";
            return module;
        });
    }
    return import("../views/HomeView.vue").then((module) => {
        module.default.displayName = "HomeView";
        return module;
    });
};

const getMessageComponent = () => {
    if (process.env.VITE_APP_MODE === "kaohsiung" || process.env.VITE_APP_MODE === "kaohsiung-iframe") {
        return import("../components/kaohsiung/MessagesComponents.vue").then((module) => {
            module.default.displayName = "KaohsiungMessagesComponent";
            return module;
        });
    }
    return import("../components/MessagesComponents.vue").then((module) => {
        module.default.displayName = "MessagesComponent";
        return module;
    });
};

const routes = [
    {
        path: "/",
        name: "home",
        component: () => getHomeComponent(),
        meta: { auth: true },
        redirect: "/b/creating/",
        children: [
            {
                path: ":identity/:roomId",
                component: () => getMessageComponent(),
                props: (route) => {
                    return {
                        identity: route.params.identity,
                        roomId: route.params.roomId,
                    };
                },
            },
        ],
    },
    {
        path: "/maintenance",
        name: "maintenance",
        component: () => import("../views/MaintenancePageView.vue"),
        meta: { title: "系統維護中", auth: true },
    },
    {
        path: "/restricted",
        name: "restricted",
        component: () => import("../views/RestrictedView.vue"),
        meta: { title: "使用權限受限", auth: false },
    },
    {
        path: "/KSG-login",
        name: "KSGLogin",
        component: () => import("../views/KSGLogin.vue"),
        meta: { title: "AVA系統登入", auth: false },
    },
    {
        path: "/two-factor-authentication",
        name: "TwoFactorAuthentication",
        component: () => import("../views/TwoFactorAuthentication.vue"),
        meta: { title: "二次驗證", auth: false },
    },
];
const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach(async (to, from, next) => {
    if (to.meta.title) {
        document.title = to.meta.title;
    }

    const userStore = useUserStore();
    const apiStatusStore = useApiStatusStore();
    const { user_type, uid, avatar, nickname, sex, user_no, tempUser } = storeToRefs(userStore);
    const settingsStore = useSettingsStore();
    const { theme } = storeToRefs(settingsStore);
    if (to.meta.auth) {
        const stateStore = useStateStore();
        const { chatFontSize, db_first_check, db_error } = storeToRefs(stateStore);

        // 第一次載入專案時，檢查db的連線狀態。
        if (!db_first_check.value) {
            apiStatusStore.registerRequest();
            try {
                await axios.get("/system/checkConnection");
                db_first_check.value = true;
            } catch (error) {
                console.error("Database connection error:", error);
                db_error.value = true;
                return next("/maintenance");
            } finally {
                apiStatusStore.markRequestComplete();
            }
        }

        // 如果資料庫連線錯誤，直接導向到維護頁面
        if (db_error.value && to.path !== "/maintenance") {
            console.log("db_error route to maintenance", db_error.value);
            return next("/maintenance");
        }

        if (!db_error.value) {
            apiStatusStore.registerRequest();
            try {
                const userInfoResponse = await axios.get("/user/info");
                const userInfo = userInfoResponse.data.data;
                if (userInfo) {
                    uid.value = userInfo.uid;
                    avatar.value = userInfo.avatar || (userInfo.sex === "0" ? "user_woman.png" : "user_man.png");
                    nickname.value = userInfo.nickname;
                    sex.value = userInfo.sex;
                    user_no.value = userInfo.user_no;
                    user_type.value = userInfo.user_type;
                    chatFontSize.value = localStorage.getItem(`chatFontSize-${userInfo.uid}`) || "16";
                }
                const currentThemeSettingResponse = await axios.get("/system/getCurrentThemeSetting");
                const currentThemeSetting = currentThemeSettingResponse.data.data;

                // 取得當前主題設定
                let { currentTheme, lockTheme } = currentThemeSetting;
                if (currentTheme === "dark") currentTheme = "dark-ava"; // .dark 這個名稱會跟原本 shadcn 還是 tailwind 的 class 名稱衝突 所以改成 dark-ava
                // 如果 lockTheme 為 true，則鎖定主題，使用者只能使用系統預設主題，否則不鎖定。
                if (lockTheme) {
                    theme.value.lockTheme = true;
                    document.body.className = currentTheme;
                } else {
                    // 如果有 uid 則使用 uid 作為 localStorage 的 key，否則使用 "ava-theme"
                    const themeLocalStorageUid = userInfo.uid ? `ava-theme-${userInfo.uid}` : "ava-theme";

                    // 如果 localStorage 有主題，則使用 localStorage 的主題，否則使用 currentTheme(系統預設)
                    const savedTheme = localStorage.getItem(themeLocalStorageUid) || currentTheme;
                    document.body.className = savedTheme;
                }
                const chatZoomLocalStorageUid = userInfo?.uid ? `chatZoom-${userInfo?.uid}` : "chatZoom";
                // 取得並應用縮放比例設定
                const savedZoom = localStorage.getItem(chatZoomLocalStorageUid);
                const zoom = savedZoom ? Number(savedZoom) : 100;

                // 計算縮放比例
                const scale = zoom / 100;

                // 取得 .scale-container 元素
                const scaleContainer = document.querySelector(".scale-container");
                if (scaleContainer) {
                    // 設定縮放樣式
                    scaleContainer.style.transform = `scale(${scale})`;
                    scaleContainer.style.transformOrigin = "top left";
                    scaleContainer.style.width = `${100 / scale}%`;
                    scaleContainer.style.height = `${100 / scale}%`;
                }
            } catch (error) {
                console.error("Failed to fetch user info:", error);
            } finally {
                apiStatusStore.markRequestComplete();
            }
        }
    }

    // 處理普遍能靠網址進去二次驗證的情況
    if (to.path === "/two-factor-authentication") {
        const isAuthorized = await axios.get("/user/checkJustTwoFactorAuth");
        console.log("isAuthorized", isAuthorized.data);

        if (isAuthorized.data.data.authorized) {
            return next();
        } else {
            return next("/");
        }
    }

    // 新增檢查 `/e/expertUrl` 的邏輯
    // e for expert, s for single
    if (to.path.startsWith("/e/") || to.path.startsWith("/s/")) {
        const stateStore = useStateStore();
        const { chatPartner } = storeToRefs(stateStore);
        const expertUrl = to.path.split("/e/")[1] || to.path.split("/s/")[1];

        try {
            // 發送 POST 請求到 checkExpertUrl

            const botResponse = await axios.post("/bot/checkExpertUrl", { expertUrl, mode: "custom" });
            const expertId = botResponse.data.data.expertId;
            const roomId = botResponse.data.data.roomId;
            let isSingle = false;

            if (to.path.startsWith("/s/")) {
                isSingle = true;
            }

            if (roomId) {
                return next(`/b/${roomId}?single=${isSingle}`);
            } else {
                // 沒有房間 直接呼叫 createBotRoom
                const roomResponse = await axios.post("/bot/room", JSON.stringify({ expertId }));
                const roomId = roomResponse.data.data.roomId;
                chatPartner.value.roomId = roomId;
                return next(`/b/${roomId}?single=${isSingle}`);
            }
        } catch (error) {
            console.error("API Error:", error);

            // 如果 API 返回錯誤，重定向到其他頁面或顯示錯誤信息
            return next("/"); // 替換為適合的頁面
        }
    }

    next();
});

router.beforeResolve(async (to, from, next) => {
    try {
        if (to.path.startsWith("/b/") && !to.query.switchExpert) {
            const stateStore = useStateStore();
            const { chatPartner } = storeToRefs(stateStore);

            let expertUrl = to.path.split("/b/")[1];
            if (expertUrl.includes("/")) {
                expertUrl = expertUrl.split("/")[0];
            }

            if (expertUrl == "undefined" || expertUrl == "creating") {
                return next();
            }

            // 如果 pendingTargetRoomId 有值，則不進行任何操作 這是在 iframe 中設定 targetExpert 的結果
            if (stateStore.pendingTargetRoomId) {
                // localStorage.setItem("iframeChatPartnerRoomId", stateStore.pendingTargetRoomId);
                stateStore.pendingTargetRoomId = "";
                return next();
            }

            const botResponse = await axios.post("/bot/checkExpertUrl", { expertUrl });

            if (botResponse.data.code === 0) {
                const { roomId: groupId, expertId, nickname, avatar } = botResponse.data.data;

                if (expertUrl === groupId) {
                    return next();
                } else {
                    chatPartner.value = {
                        partner: "bot",
                        expertId: expertId,
                        roomId: groupId,
                        nickname: nickname,
                        avatar: avatar,
                    };
                    return next({
                        path: `/b/${groupId}`,
                        replace: true,
                    });
                }
            }
        }

        next();
    } catch (error) {
        console.log("error", error);
        next();
    }
});

export default router;
