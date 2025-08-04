<script setup>
import { onMounted, provide, ref, watchEffect } from "vue";
import axios from "./global/axios.js";
import { fetchStream, stopFetchStream } from "./global/fetchStream";
import { useWebNotification } from "@vueuse/core";
import emitter from "./global/emitter.js";
import { timeDateFormat } from "./global/timeFormat";
import { useRouter } from "vue-router";
import { useUserStore, useStateStore, useSettingsStore, useApiStatusStore, useSystemStore } from "./store/index";
import { storeToRefs } from "pinia";
import Toaster from "@/components/ui/toast/Toaster.vue";
import { useToast } from "@/components/ui/toast";
import { sanitizeUrl } from "@braintree/sanitize-url";
import { convertToCSSString, generateCSSVariables } from "@/utils/colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { VueQueryDevtools } from "@tanstack/vue-query-devtools";
import WelcomeBanner from "@/components/SplashScreen.vue";
import ExpertAccessRestrictedComponent from "@/components/ExpertAccessRestrictedComponent.vue";
import PermissionPrompt from "@/components/PermissionPrompt.vue";

const { toast } = useToast();
const userStore = useUserStore();
const stateStore = useStateStore();
const settingsStore = useSettingsStore();
const apiStatusStore = useApiStatusStore();
const systemStore = useSystemStore();

const { isStatic } = systemStore;

const { uid, contactList } = storeToRefs(userStore);

const { chatZoom, chatPartner, isOpenMenu, pendingTargetRoomId, showExpertAccessRestricted } = storeToRefs(stateStore);

const { chat_file_translate_enable } = storeToRefs(settingsStore);

provide("axios", axios);
provide("emitter", emitter);
provide("timeFormat", timeDateFormat);
provide("fetchStream", fetchStream);
provide("stopFetchStream", stopFetchStream);

const router = useRouter();
const queryClient = useQueryClient();

// 用 Map 存每個通知對應的 room_id
const notificationMap = new Map();
const { permissionGranted, show, onClick } = useWebNotification({
    requestPermissions: true,
    renotify: true,
    tag: "translation-task",
    requireInteraction: true,
    icon: "https://i.imgur.com/vWBGOw3.png",
});

// 點擊通知後跳轉
onClick((event) => {
    const notif = event.currentTarget;
    const roomId = notificationMap.get(notif);
    const ids = taskData.value.map((task) => task.id);
    markAsNotified(ids);

    if (roomId) {
        if (chatPartner.value.roomId === roomId) {
            emitter.emit("refreshMessages");
            return;
        }
        const chatPartnerInfo = contactList.value.find((f) => f.roomId === roomId);
        chatPartner.value.expertId = chatPartnerInfo.expertId;
        chatPartner.value.roomId = chatPartnerInfo.roomId;
        chatPartner.value.nickname = chatPartnerInfo.nickname;
        chatPartner.value.avatar = chatPartnerInfo.avatar;

        router.push(`/b/${roomId}`);
        notificationMap.delete(notif); // 用完就清掉
    }
});

const startPolling = ref(false);

// 任務查詢（延遲啟動）
const { data: taskData } = useQuery({
    queryKey: ["translation-tasks"],
    queryFn: async () => {
        const res = await axios.get("/translation-tasks", {
            params: { user_id: uid.value },
        });
        return res.data.data.tasks;
    },
    enabled: startPolling && chat_file_translate_enable, // 初始不查詢
    refetchInterval: 10000, // 輪詢間隔 10 秒
    refetchIntervalInBackground: true, // 在背景中輪詢
    refetchOnWindowFocus: false,
});

const { mutate: markAsNotified } = useMutation({
    mutationFn: async (taskIds) => {
        await axios.post("/translation-tasks/mark-notified", {
            task_ids: taskIds,
        });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["translation-tasks", uid.value] });
    },
});

// 延遲 10 秒後啟用輪詢 不要一開始就啟用
setTimeout(() => {
    startPolling.value = true;
}, 10000);

// 任務通知邏輯 這樣寫可以確保要是使用者當次沒有點擊通知，就不會再出現通知 但下次重新整理頁面就會再出現
const notifiedTaskIds = new Set();

watchEffect(() => {
    if (!permissionGranted.value || !taskData.value || taskData.value.length === 0) return;

    const completedIds = [];

    taskData.value.forEach((task) => {
        // 若已通知過，就略過
        if (notifiedTaskIds.has(task.id)) return;

        const fileNames = task.result_files.map((f) => f.file_name).join(", ");

        let title = "翻譯完成通知";
        let body = `檔案 ${fileNames} 已完成翻譯，點我前往查看`;

        if (task.status === "failed" || task.status === "error") {
            title = "⚠️ 翻譯失敗通知";
            body = `檔案 ${fileNames} 翻譯失敗，請稍後再試或聯絡管理員`;
        } else if (task.status === "completed") {
            completedIds.push(task.id);
        }

        show({ title, body }).then((notif) => {
            if (notif) {
                notificationMap.set(notif, task.room_id);
            }
        });

        // ✅ 紀錄已通知過
        notifiedTaskIds.add(task.id);
    });

    emitter.emit("refreshMessages");
});

// SSE 設定 有要優化的話再使用
// let eventSource = null;

// watch(
//     () => uid.value,
//     (newUid) => {
//         if (!newUid) return;

//         // 確保只建立一次 SSE 連線
//         if (eventSource) return;

//         eventSource = new EventSource(`/ava/chat/translation-tasks/stream?user_id=${newUid}`);
//         eventSource.onopen = () => console.log("SSE 已建立");

//         eventSource.onmessage = (event) => {
//             console.log("event", event);
//             const task = JSON.parse(event.data);
//             const fileNames = task.result_files.map((f) => f.file_name).join(", ");

//             show({
//                 title: "翻譯完成通知",
//                 body: `檔案 ${fileNames} 已完成翻譯，點我查看`,
//             }).then((notif) => {
//                 if (notif) {
//                     notificationMap.set(notif, task.room_id);
//                 }
//             });
//         };

//         eventSource.onerror = () => {
//             console.error("SSE 連線錯誤");
//         };
//     },
//     { immediate: true }
// );

// onUnmounted(() => {
//     if (eventSource) {
//         eventSource.close();
//     }
// });

window.onload = async function () {
    // 調整 zoom
    document.body.style.zoom = chatZoom.value / 100;
    document.body.addEventListener("touchend", function (event) {
        if (event.target.tagName !== "TEXTAREA") {
            document.querySelectorAll("textarea").forEach((e) => {
                e.blur();
            });
        }
    });
    document.addEventListener("touchstart", function (event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    });
    var lastTouchEnd = 0;
    document.addEventListener(
        "touchend",
        function (event) {
            var now = new Date().getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        },
        false
    );
    document.addEventListener("gesturestart", function (event) {
        event.preventDefault();
    });
};

//iframe外傳進來的事件
async function processMessage(event) {
    switch (event.data.type) {
        case "focusInput":
            emitter.emit("iframe_focusInput");
            break;
        case "setExpert":
            emitter.emit("iframe_setExpert", event.data.value);
            break;
        case "resHtml":
            // console.log("我被 iframe 呼叫了 postMessage", event);
            emitter.emit("iframeData", event.data.value);
            break;
        case "logout":
            emitter.emit("logout");
            break;
        case "setTargetExpert": {
            // 指令專家房間 iframe 會傳遞專家 id 進來
            // 現在的設計是，使用者要是是自行切換過聊天室，則依使用者切換過的聊天室為主，就不會受到 targetExpert 影響。
            const expertId = event.data.value;

            pendingTargetRoomId.value = expertId;
            apiStatusStore.registerRequest();
            try {
                let roomResponse = await axios.post("/bot/room", { expertId });
                if (roomResponse.data.code === 0) {
                    let targetExpertRoomId = roomResponse.data.data.roomId;
                    let targetExpertName = roomResponse.data.data.expertName;
                    let targetExpertAvatar = roomResponse.data.data.expertAvatar;
                    pendingTargetRoomId.value = targetExpertRoomId;

                    chatPartner.value.roomId = targetExpertRoomId;
                    chatPartner.value.expertId = expertId;
                    chatPartner.value.nickname = targetExpertName;
                    chatPartner.value.avatar = targetExpertAvatar;
                    chatPartner.value.partner = "bot";
                    router.push(`/b/${targetExpertRoomId}`);
                }
            } catch (error) {
                console.error("Failed to set target expert:", error);
            } finally {
                apiStatusStore.markRequestComplete();
            }
            break;
        }
        case "isOpenMenu":
            isOpenMenu.value = event.data.value;
            break;
        case "setShowExpert": {
            const isIframe = window !== window.parent;
            const { showExpertIds, hideExpertIds } = event.data.value;

            // 取得 localStorage 中的 iframeChatPartnerRoomId
            const storedRoomId = localStorage.getItem("iframeChatPartnerRoomId");

            // 取得 contact list
            apiStatusStore.registerRequest();
            try {
                let rs = await axios.get("/contact/list", {
                    params: { isIframe, showExpertIds, hideExpertIds },
                });

                if (rs.data.code === 1 && rs.data.message === "目前沒有可用的專家") {
                    showExpertAccessRestricted.value = true;
                    return;
                } else {
                    showExpertAccessRestricted.value = false;
                }

                // 拿出限制後的專家列表
                contactList.value = rs.data.data;
                if (contactList.value.length === 0) return;

                // 如果 pendingTargetRoomId 有值，且 storedRoomId 沒有值，則不進行任何操作
                if (pendingTargetRoomId.value && !storedRoomId) return;
                // 檢查 contactList 中是否有 storedRoomId
                let existingRoom = contactList.value.find((contact) => contact.roomId === storedRoomId);

                let roomId;

                if (existingRoom) {
                    // 如果找到了 roomId，使用它

                    roomId = existingRoom.roomId;
                    router.push(`/b/${roomId}`);
                } else {
                    // 如果沒有找到 roomId，使用第一個專家的 roomId
                    const firstExpert = contactList.value[0];
                    roomId = firstExpert.roomId;

                    if (!roomId) {
                        // 沒有房間(roomId)的話，根據專家 id 去建立房間
                        let rs = await axios.post("/bot/room", JSON.stringify({ expertId: firstExpert.expertId }));
                        if (rs.data.data?.roomId) {
                            roomId = rs.data.data?.roomId;
                        } else {
                            console.log("聊天室建立失敗");
                            return;
                        }

                        // 因為在 push 的時候會被導向 /b/creating/ 所以要使用 interval 去檢查是否已經進入正確的聊天室
                        const intervalId = setInterval(() => {
                            if (
                                window.location.href.includes("/b/undefined/") ||
                                window.location.href.includes("/b/creating/")
                            ) {
                                if (roomId) {
                                    router.push(`/b/${roomId}`);
                                } else {
                                    clearInterval(intervalId); // 停止 setInterval
                                }
                            } else {
                                clearInterval(intervalId); // 停止 setInterval
                            }
                        }, 500);

                        chatPartner.value.roomId = roomId;
                        router.push(`/b/${roomId}`);
                    } else {
                        router.push(`/b/${roomId}`);
                    }
                }
            } catch (error) {
                console.error("Failed to get contact list:", error);
            } finally {
                apiStatusStore.markRequestComplete();
            }

            break;
        }
    }
}

// 在 onMounted 階段：
// 1. Flush 掉 index.html 緩存的訊息
// 2. 重新註冊新的 message listener 處理之後的消息
onMounted(async () => {
    // 先處理緩存中的所有訊息
    if (window.pendingMessages && window.pendingMessages.length > 0) {
        window.pendingMessages.forEach((event) => {
            processMessage(event);
        });
        window.pendingMessages = [];
    }
    // 重新註冊正式的 listener 處理後續進來的消息
    window.addEventListener("message", (event) => {
        processMessage(event);
    });

    // 其他 onMounted 初始化邏輯
    apiStatusStore.registerRequest();
    try {
        await loadCustomThemes();
    } finally {
        apiStatusStore.markRequestComplete();
    }

    checkBrowserType();
    openUrl();
});

// 檢查網址是否包含 KSG-login 是的話就關閉 splash screen
watchEffect(() => {
    if (router.currentRoute.value.path.includes("KSG-login")) {
        showBanner.value = false;
    }
});

//檢查是否在iframe內部
emitter.on("checkInsideIframe", function () {
    // 如果是在 iframe 內部，則不會有 parent 屬性，所以會直接進入 else 的流程
    // 如果是 iframe 且 static 模式下 代表是直接用 tag 嵌入的，所以跟原本一樣
    if (window.parent === window || isStatic) {
        emitter.emit("iframeData", null);
    } else {
        window.parent.postMessage({ type: "reqHtml" }, "*"); // "*"之後有需要指定來源
    }
});

//iframe內部要往外送的事件
emitter.on("iframe_message", function (msg) {
    let key = Object.keys(msg)[0];
    let value = msg[key];
    switch (key) {
        case "autofill":
            window.parent.postMessage({ type: "fillHtml", value: value }, "*"); // "*"之後有需要指定來源
            break;
    }
});

emitter.on("login_success", async function () {
    await loadCustomThemes();
});

function getBrowserInfo() {
    const userAgent = navigator.userAgent.toLowerCase();

    // 瀏覽器判斷
    if (/chrome/i.test(userAgent)) {
        return "chrome";
    } else if (/firefox/i.test(userAgent)) {
        return "firefox";
    } else if (/safari/i.test(userAgent)) {
        return "safari";
    } else if (/edge/i.test(userAgent)) {
        return "edge";
    } else if (/opera|opr/i.test(userAgent)) {
        return "opera";
    } else {
        return "unknown";
    }
}

function isMobile() {
    return /android|iphone|ipad|ipod|blackberry|windows phone|opera mini|iemobile/i.test(navigator.userAgent);
}
// 檢查目前的瀏覽器(目前只支援Chrome與Edge)
const checkBrowserType = () => {
    // 根據判斷結果進行不同的處理
    const browser = getBrowserInfo();
    const mobile = isMobile();

    if (browser === "firefox") {
        console.log("不支援的瀏覽器: ", browser);
        toast({
            title: "不支援的瀏覽器",
            description: "請使用Chrome或Edge瀏覽器",
            variant: "destructive",
        });
    }
    // 下面先留著，之後可以再改
    // if (browser === "edge") {
    //     return;
    // } else if (browser === "chrome") {
    //     return;
    // } else {
    //     console.log("不支援的瀏覽器: ", userAgent);
    //     toast({
    //         title: "不支援的瀏覽器",
    //         description: "請使用Chrome或Edge瀏覽器",
    //         variant: "destructive",
    //     });
    // }
};

// 把主題的顏色寫入到 style 標籤
const addCustomThemeStyles = (themeName, themeColors) => {
    if (themeName === "dark") themeName = "dark-ava"; // .dark 這個名稱會跟原本 shadcn 還是 tailwind 的 class 名稱衝突 所以改成 dark-ava
    // 移除現有主題樣式
    const existingStyle = document.getElementById(`theme-${themeName}`);
    if (existingStyle) {
        existingStyle.remove();
    }

    // 生成新的樣式標籤
    const style = document.createElement("style");
    style.id = `theme-${themeName}`;

    // 生成CSS變數並轉換為CSS字符串
    const cssVariables = generateCSSVariables(themeColors);
    const css = `
        .${themeName} {
            ${convertToCSSString(cssVariables)}
        }
    `;

    style.textContent = css;
    document.head.appendChild(style);
};

const loadCustomThemes = async () => {
    try {
        const response = await axios.get("/system/getChatTheme");
        if (response.data.code === 0 && response.data.data) {
            // 存儲主題到 store
            settingsStore.theme.themes = response.data.data;

            // 遍歷所有主題並創建對應的 CSS
            Object.entries(response.data.data).forEach(([themeName, themeColors]) => {
                addCustomThemeStyles(themeName, themeColors);
            });

            // 取得當前主題名稱
            const themeLocalStorageUid = uid.value ? `ava-theme-${uid.value}` : "ava-theme";
            const currentTheme = localStorage.getItem(themeLocalStorageUid) || Object.keys(response.data.data)[0];
            settingsStore.theme.system_client_theme_default = currentTheme;
            // applyTheme(currentTheme);
        }
    } catch (error) {
        console.error("Failed to load themes:", error);
    }
};

// 應用主題
const applyTheme = (themeName) => {
    document.body.className = themeName;
    localStorage.setItem("preferred-theme", themeName);
};

function openUrl(url) {
    emitter.on("openUrl", (url) => {
        // 清洗 URL
        let sanitizedUrl = sanitizeUrl(url);

        // 判斷是否是相對路徑的下載 URL
        if (!sanitizedUrl.startsWith("http://") && !sanitizedUrl.startsWith("https://")) {
            if (sanitizedUrl.startsWith("/")) {
                // 如果是相對路徑，保持原樣
                sanitizedUrl = url;
            } else {
                // 如果不是相對路徑，則添加協議
                sanitizedUrl = `http://${sanitizedUrl}`;
            }
        }

        // 檢查清洗後的 URL 是否有效，避免打開 'about:blank'
        if (sanitizedUrl !== "about:blank") {
            // 檢查 URL 是否包含下載路徑的特徵
            if (sanitizedUrl.includes("/download/")) {
                // 如果是下載 URL，直接導航到該 URL
                window.location.href = sanitizedUrl;
            } else {
                // 否則在新分頁中打開
                window.open(sanitizedUrl, "_blank");
            }
        } else {
            console.warn("Invalid or sanitized URL is 'about:blank', skipping window.open.");
        }
    });
}

const showBanner = ref(true);

const handleEnter = () => {
    showBanner.value = false;
};
</script>

<template>
    <ExpertAccessRestrictedComponent v-if="showExpertAccessRestricted" />
    <WelcomeBanner v-if="showBanner" @enter="handleEnter" />
    <PermissionPrompt v-if="chat_file_translate_enable" />
    <Toaster class="toaster" />
    <div class="app_wrap">
        <div class="scale-container">
            <router-view></router-view>
        </div>
    </div>
    <VueQueryDevtools buttonPosition="bottom-left" />
</template>
<style lang="scss">
@import "@/assets/style/style.scss";
.app_wrap {
    width: 100%;
    height: 100%;
    position: fixed;
    background-color: var(--secondary-color);
    overflow: hidden; /* 防止縮放後內容溢出 */
}

.scale-container {
    width: 100%;
    height: 100%;
    transform-origin: top left;
}

.toaster {
    z-index: 10001;
}
</style>
