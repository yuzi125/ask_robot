<script setup>
import { computed, inject, nextTick, onMounted, ref, toRefs, watch, onUnmounted, watchEffect } from "vue";
import { useThrottleFn } from "@vueuse/core";
import { useRouter, useRoute } from "vue-router";
const router = useRouter();
const route = useRoute();

import { useVirtualizer } from "@tanstack/vue-virtual";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/vue-query";
import { storeToRefs } from "pinia";
import { useUserStore, useStateStore, useSettingsStore, useApiStatusStore, useSystemStore } from "../store/index";
import VueEasyLightbox from "vue-easy-lightbox";

import { marked } from "marked";
import { Loader2Icon } from "lucide-vue-next";

import CardsComponents from "./CardsComponents.vue";
import EchartsLineComponents from "./EchartsLineComponents.vue";
import EchartsStackedComponents from "./EchartsStackedComponents.vue";
import FullImageComponents from "./FullImageComponents.vue";
import IframeComponent from "./IframeComponents.vue";
import EchartsComponents from "./EchartsComponents.vue";
import FormComponents from "./FormComponents.vue";
import ExpandableQaComponent from "./ExpandableQaComponent.vue";
import RecheckComponents from "./RecheckComponents.vue";
import HtmlJsonComponents from "./HtmlJsonComponents.vue";
import SourceChunkDrawer from "./messages/SourceChunkDrawer.vue";
import ExtraChunkComponents from "./messages/ExtraChunkComponents.vue";
import FloatingDateDisplay from "./FloatingDateDisplay.vue";
import SearchBar from "@/components/ui/SearchBar.vue";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FeedbackDialog from "@/components/ui/FeedbackDialog.vue";
import { useToast } from "@/components/ui/toast";
import FileMessageComponent from "@/components/messages/FileMessageComponent.vue";
import { useChatMarkdown } from "@/composables/useChatMarkdown";
const { toast } = useToast();

const axios = inject("axios");
const emitter = inject("emitter");
const timeFormat = inject("timeFormat");
const fetchStream = inject("fetchStream");

//全域pinia
const apiStatusStore = useApiStatusStore();
const userStore = useUserStore();
const { uid, avatar, nickname, contactList, user_no } = storeToRefs(userStore);
const stateStore = useStateStore();
const {
    chatPartner,
    isWaitRes,
    isOpenMenu,
    isOpenRecommend,
    is_tunnel,
    chatFontSize,
    bulletinHeight,
    showExpertAccessRestricted,
    isTranslationExpert,
} = storeToRefs(stateStore);
const { changePartner } = stateStore;
const settingsStore = useSettingsStore();
const {
    conversation_direction,
    welcome_word_update_frequency,
    show_source_chunk,
    show_extra_chunk,
    show_dataset_name,
    max_message_length,
} = storeToRefs(settingsStore);

const systemStore = useSystemStore();
const { isStatic } = systemStore;

//接收網址列的身分與房間號
const props = defineProps({
    identity: { type: String, default: "" },
    roomId: { type: String, default: "" },
});

const historyMessagesId = ref(0);
const abortController = new AbortController();

const { roomId, identity } = toRefs(props);

const msgGroup = ref(null);
const messages = ref([]);
const welcomeMessage = ref(null);
const isWelcomeMessageFixed = ref(false);
const welcomeInitialTime = ref(null);
const hints = ref([]);

const sourceChunkMode = ref("loading");

const inputMessageHeight = ref(0);

const allMessages = ref([]);

const single = computed(() => route.query.single == "true");

let textareaHeight;

const PAGE_SIZE = 20;
const currentPage = ref(0);
const currentRoomId = ref(null);
const isProcessingMessage = ref(false);
const queryClient = useQueryClient();
const pendingMessages = ref([]);
const tempMessages = ref([]); // 用於暫存訊息
const isAutoScrolling = ref(false);

// 用於控制是否使用本地訊息的標誌
const useLocalMessages = ref(true);

const hasPreviousPages = computed(() => currentPage.value > 0);

const queryEnabled = ref(true);

let targetType;
let targetCom = "";
let res_msg = "";
let search_type = false;
const isStreamResponding = ref(false);
const lastScrollTime = ref(0);
const MAX_RES_MSG_LENGTH = 100000; // 最大累積長度
const MAX_FAIL_PARSE = 50; // 最多錯誤片段次數
let failParseCount = 0; // 錯誤片段次數

// 查詢設置
const {
    data: pageData,
    isFetching,
    isLoading,
    isSuccess,
    isPlaceholderData,
    refetch,
} = useQuery({
    queryKey: ["messages", currentRoomId, currentPage],
    queryFn: async ({ signal }) => {
        if (!currentRoomId.value) return null;
        const response = await axios.post(
            "/bot/message",
            JSON.stringify({
                roomId: currentRoomId.value,
                pageSize: PAGE_SIZE,
                page: currentPage.value,
            }),
            { signal }
        );

        return {
            messages: response.data.data.chat || [],
            hasMore: response.data.data.hasMore,
            totalCount: response.data.data.totalCount,
        };
    },
    enabled: computed(() => !!currentRoomId.value && queryEnabled.value),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
});

function resetHistoryMessages() {
    scrollBottom("force");
    currentPage.value = 0;

    const firstPageMessages = allHistoryMessages.value.slice(-PAGE_SIZE);

    allHistoryMessages.value = firstPageMessages;

    // 不需要清理 allMessages 和 pendingMessages，保留本地訊息
    messages.value = displayMessages.value;
}

onMounted(async () => {
    //初始化是否在隧道模式
    if (getLocalTunnel(roomId.value)) {
        is_tunnel.value = true;
    }
    //取得列表
    await getContactList();
    //取得聊天對象資訊
    await getChatPartner();
    //沒有房間則建立
    await createRoom();
    //房間內容初始化
    room_init();
    //取得評分選項
    await getFeedbackOptions();

    emitter.on("loadNewerHistory", loadNewerHistory);
    //監聽其他組件傳來的推送事件(InputMessage、Cards 等等)
    emitter.on("writeChatBot", async ({ msg, userMsg }) => {
        // 先新增一個機器人的頭像讓他等待
        resetStreamState();
        addResultAvatar();
        let userMsgTime = new Date().getTime();
        isWaitRes.value = true;

        let dataArr = msg.data.split("</end>");

        dataArr.forEach(async (item) => {
            if (item !== "") {
                try {
                    // 嘗試解析 JSON 字符串
                    const jsonData = JSON.parse(item);
                    // 直接將 JSON 對象傳遞給 addResultMessage
                    addResultMessage(jsonData, false);
                } catch (e) {
                    // 如果不是有效的 JSON，按原來的方式處理
                    addResultMessage(item, false);
                }
            } else {
                await handleStreamEnd(userMsg, userMsgTime); // 記錄 user 的訊息
            }
        });
        isWaitRes.value = false;
    });

    emitter.on("writeChatUser", (msg) => {
        addUserMessage(msg);
    });

    //發送訊息時先檢查是否在iframe內
    let pushData_msg = "";
    emitter.on("pushData", async (msg) => {
        queryEnabled.value = false;

        addUserMessage(msg);
        await nextTick();

        // 使用 requestAnimationFrame 在下一幀渲染頭像
        await new Promise((resolve) => requestAnimationFrame(resolve));
        addResultAvatar();
        await nextTick();

        pushData_msg = msg;
        emitter.emit("checkInsideIframe", msg);
        emitter.emit("checkPendingAnnouncements", msg);
        emitter.emit("clearFileUploader");
    });
    //如果檢查完不在iframe內後會送回html為null，有資料則將這iframe的html一起帶過去
    emitter.on("iframeData", async (html) => {
        if (html === null) {
            await fetchApiStore(pushData_msg);
        } else {
            pushData_msg.html = html;
            await fetchApiStore(pushData_msg);
        }
        pushData_msg = "";
    });
    //監聽Echart組件傳來的事件
    emitter.on("pushEchartsData", (msg) => {
        pushEchartsData(msg);
    });
    //監聽Form組件傳來的事件
    emitter.on("pushFormData", (msg) => {
        pushFormData(msg);
    });
    emitter.on("cancelFormData", (msg) => {
        cancelFormData(msg);
    });
    emitter.on("slideBottom", async () => {
        if (msgGroup.value) {
            scrollBottom("force");
        }
    });

    emitter.on("refreshMessages", async () => {
        await forceRefreshFirstPage();
        // 檢查是否有任何 html_json 組件正在顯示 loading 狀態
        // const hasLoadingTranslation = messages.value.some((msg) =>
        //     msg.message?.some((item) => item.html_json?.some((json) => json.tag === "file_translation_loading"))
        // );

        // if (hasLoadingTranslation) {
        //     // 如果有正在加載的翻譯，進行強制刷新
        // } else {
        //     // 否則進行普通刷新
        //     await refetch();
        // }
    });

    emitter.on("clearData", async () => {
        clearLocalMessages();
        currentPage.value = 0;
        messages.value = [];
        allHistoryMessages.value = [];
        allMessages.value = [];
        pendingMessages.value = [];
        tempMessages.value = [];
        queryClient.removeQueries({ queryKey: ["messages", chatPartner.value.roomId] });
        await queryClient.invalidateQueries({ queryKey: ["messages", chatPartner.value.roomId] });
        await syncBotMsg();
    });

    emitter.on("retryGetContactList", getContactList);

    emitter.on("loadMoreHistory", loadMoreHistory);
    //監聽滾動(監聽整體視窗與使用者滑鼠滾動)
    msgGroup.value.addEventListener("scroll", handleScroll);
    msgGroup.value.addEventListener("wheel", (event) => {
        userMouseScroll(event.deltaY);
    });
    // 添加觸摸事件監聽器處理手機滑動
    let touchStartY = 0;
    const touchStartHandler = (event) => {
        touchStartY = event.touches[0].clientY;
    };

    const touchMoveHandler = (event) => {
        const touchY = event.touches[0].clientY;
        const deltaY = touchStartY - touchY; // 正值表示向上滑動，負值表示向下滑動
        userMouseScroll(deltaY);
        touchStartY = touchY; // 更新起始位置，以便處理連續滑動
    };

    msgGroup.value.addEventListener("touchstart", touchStartHandler);
    msgGroup.value.addEventListener("touchmove", touchMoveHandler);

    await initializeVirtualizer();
    await nextTick();
    setTimeout(() => {
        scrollBottom("force");
    }, 100);

    document.addEventListener("click", (e) => {
        // 檢查點擊的元素是否為具有 data-lightbox-src 屬性的圖片
        if (e.target.hasAttribute("data-lightbox-src")) {
            const src = e.target.getAttribute("data-lightbox-src");
            const alt = e.target.getAttribute("data-lightbox-alt") || "Image";
            window.openLightbox(src, alt);
            e.preventDefault();
        }
    });

    await bindMarkedHtmlButtonEvents(mkdRef);
    document.addEventListener("click", (e) => {
        // 檢查點擊的元素是否為具有 data-lightbox-src 屬性的圖片
        if (e.target.hasAttribute("data-lightbox-src")) {
            const src = e.target.getAttribute("data-lightbox-src");
            const alt = e.target.getAttribute("data-lightbox-alt") || "Image";
            window.openLightbox(src, alt);
            e.preventDefault();
        }
    });    
});

onUnmounted(() => {
    emitter.off("loadNewerHistory");
    emitter.emit("updateSlideTopStatus", false);
    emitter.emit("updateSlideBottomStatus", false);
    emitter.emit("updateLoadingStatus", false);
    abortController.abort();

    // 移除所有資料來源中圈圈按鈕的綁定事件
    boundButtons.forEach((button) => {
        const handler = button.onclick;
        if (handler) {
            button.removeEventListener("click", handler);
        }
    });
    boundButtons.clear();
});

const allHistoryMessages = ref([]);
// 1. 修改 displayMessages
const displayMessages = computed(() => {
    let result = [];

    if (pageData.value?.messages) {
        const newMessages = JSON.parse(JSON.stringify(MsgConvertRender(pageData.value.messages)));
        const historyMsgsCopy = JSON.parse(JSON.stringify(allHistoryMessages.value));

        // 合併
        if (currentPage.value > 0) {
            result = [...newMessages, ...historyMsgsCopy];
        } else {
            result = [...historyMsgsCopy, ...newMessages];
        }

        // 處理本地消息和待處理消息
        let localMsgsCopy = [];
        if (tempMessages.value.length > 0) {
            localMsgsCopy = JSON.parse(JSON.stringify(tempMessages.value));
        } else {
            localMsgsCopy = JSON.parse(JSON.stringify(allMessages.value));
        }

        const pendingMsgsCopy = JSON.parse(JSON.stringify(pendingMessages.value));

        // 將所有消息合併到一個陣列中
        result = [...result, ...localMsgsCopy, ...pendingMsgsCopy];

        // 去重 - 使用 Map 以時間戳為主鍵
        const messageMap = new Map();
        result.forEach((msg) => {
            // 使用時間戳作為唯一鍵
            const key = msg.time || 0;
            // 如果已存在相同時間戳的消息，保留更新的版本
            if (!messageMap.has(key) || (messageMap.get(key).updateTime || 0) < (msg.updateTime || 0)) {
                messageMap.set(key, msg);
            }
        });

        // 將 Map 轉回陣列
        result = Array.from(messageMap.values());

        // 移除歡迎詞
        result = result.filter((msg) => !msg.isWelcome);

        // 嚴格按時間戳排序
        result.sort((a, b) => (a.time || 0) - (b.time || 0));

        // 處理歡迎詞
        if (welcomeMessage.value && welcomeInitialTime.value) {
            const welcomeMsgCopy = JSON.parse(JSON.stringify(welcomeMessage.value));
            const insertIndex = result.findIndex((msg) => (msg.time || 0) > welcomeInitialTime.value);
            if (insertIndex !== -1) {
                result.splice(insertIndex, 0, welcomeMsgCopy);
            } else {
                result.push(welcomeMsgCopy);
            }
        }

        // 最終檢查：如果全域 tunnel 狀態為 false，移除所有訊息的 tunnel 標記
        if (!is_tunnel.value) {
            result = result.map((msg) => {
                if (msg.is_tunnel) {
                    const { is_tunnel, ...msgWithoutTunnel } = msg;
                    return msgWithoutTunnel;
                }
                return msg;
            });
        }
    }

    return result;
});
// 計算總訊息數和是否還有更多訊息
const totalMessageCount = computed(() => {
    const serverCount = pageData.value?.totalCount || 0;
    const localCount = currentPage.value === 0 ? allMessages.value.length : 0;
    return serverCount + localCount;
});

const hasMore = computed(() => {
    if (pageData.value?.hasMore) return true;
    return totalMessageCount.value > (currentPage.value + 1) * PAGE_SIZE;
});

const checkScrollPosition = () => {
    const container = msgGroup.value;
    if (!container) return { isNearTop: false, isNearBottom: false };

    const { scrollTop, scrollHeight, clientHeight } = container;
    const topThreshold = 200; // 增加阈值

    return {
        isNearTop: scrollTop < topThreshold,
        isNearBottom: Math.abs(scrollHeight - scrollTop - clientHeight) < 50,
    };
};

const loadMoreLock = ref(false);

const throttledLoadMore = useThrottleFn(async () => {
    if (isFetching.value || !hasMore.value || loadMoreLock.value) return;
    loadMoreLock.value = true;

    try {
        const container = msgGroup.value;
        if (!container) return;

        // 保存參考點以維持滾動位置
        const virtualItems = rowVirtualizer.value?.value.getVirtualItems() || [];
        if (!virtualItems.length) return;

        // 保存參考點
        const referencePoints = virtualItems.slice(0, 3).map((item) => ({
            time: messages.value[item.index].time,
            index: item.index,
            start: item.start,
        }));

        // 保存當前頁面的訊息，用於後續合併
        const currentPageMessages = [...allMessages.value];
        const currentPendingMessages = [...pendingMessages.value];

        // 增加頁碼觸發加載
        const previousPage = currentPage.value;
        currentPage.value++;

        // 等待伺服器數據加載完成
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 300));

        // 檢查pageData是否已更新
        const pageDataUpdated =
            queryClient.getQueryState(["messages", currentRoomId.value, currentPage.value])?.status === "success";

        if (!pageDataUpdated) {
            // 如果數據還沒有加載完成，恢復原始頁碼
            currentPage.value = previousPage;
            loadMoreLock.value = false;
            return;
        }

        // 根據 currentPage 重新計算 allHistoryMessages
        // 此時 allHistoryMessages 已包含新頁面數據

        // 關鍵修改: 保留當前頁的訊息與最新的對話
        // 確保保留所有 pendingMessages
        pendingMessages.value = currentPendingMessages;

        // 處理滾動位置
        const targetPoint = referencePoints.find((point) => messages.value.some((msg) => msg.time === point.time));

        if (targetPoint) {
            const newVirtualItems = rowVirtualizer.value.value.getVirtualItems();
            const targetVirtualItem = newVirtualItems.find(
                (item) => messages.value[item.index]?.time === targetPoint.time
            );

            if (targetVirtualItem) {
                rowVirtualizer.value.value.scrollToOffset(targetVirtualItem.start, {
                    align: "start",
                    behavior: "auto",
                });
            }
        }
    } catch (error) {
        console.error("Load more error:", error);
    } finally {
        setTimeout(() => {
            loadMoreLock.value = false;
        }, 500);
    }
}, 300);

// 載入更多歷史訊息
async function loadMoreHistory() {
    if (isFetching.value || !hasMore.value) return;
    isProcessingMessage.value = false;
    currentPage.value++;
}
// 加載較新的訊息
// 修改 loadNewerHistory 函數（點擊按鈕時呼叫的函數）
const loadNewerHistory = async () => {
    if (isFetching.value || currentPage.value <= 0) return;

    // 設置禁用滾動檢測
    // disableScrollCheck.value = true;

    try {
        currentPage.value--;
        await nextTick();

        // 設置適當的滾動位置
        if (msgGroup.value) {
            msgGroup.value.scrollTop = 50;
        }

        // 延遲一段時間後才重新啟用滾動檢測
    } catch (error) {
        console.error("Error loading newer messages:", error);
        disableScrollCheck.value = false;
    }
};

// 清理本地訊息的輔助函數
function clearLocalMessages() {
    useLocalMessages.value = false;
    allMessages.value = [];
    pendingMessages.value = [];
}

// 停止置底的變數
const isUserScrolling = ref(false);
const scrollType = ref(0); // 0:滾動到Question置頂；1:不滾動。
let userScrollTimeout = null;

function userMouseScroll(scrollY) {
    if (isAutoScrolling.value) return; // 如果正在自動滾動，不處理使用者滾動

    const container = msgGroup.value;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;

    // 清除之前的計時器
    if (userScrollTimeout) {
        clearTimeout(userScrollTimeout);
    }

    if (scrollY < 0) {
        scrollType.value = 1;
        isUserScrolling.value = true;
    } else if (isAtBottom) {
        scrollType.value = 0;
        isUserScrolling.value = false;
    } else {
        scrollType.value = 1;
        isUserScrolling.value = true;
    }

    // 設置一個較長的計時器，保持用戶滾動狀態
    // 只有在指定時間內沒有新的滾動事件時，才會重置isUserScrolling
    userScrollTimeout = setTimeout(() => {
        // 檢查是否滾動到底部
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;

        if (isAtBottom) {
            scrollType.value = 0;
            isUserScrolling.value = false;
        }
    }, 3000); // 3秒鐘沒有滾動操作才重置
}

async function scrollBottom(behavior, scrollPosition) {
    await nextTick();
    if (!rowVirtualizer.value || !msgGroup.value) return;

    // 如果正在滾動且不是強制滾動，就不執行
    if (isUserScrolling.value && behavior !== "force" && scrollType.value === 1) return;

    isAutoScrolling.value = true;
    try {
        if (scrollPosition !== null && scrollPosition !== undefined) {
            rowVirtualizer.value.value.scrollToOffset(scrollPosition, {
                align: "start",
                behavior: behavior === "smooth" ? "smooth" : "auto",
            });
        } else {
            const lastIndex = messages.value.length - 1;

            if (lastIndex >= 0) {
                // 先滾動到最後一條訊息
                rowVirtualizer.value.value.scrollToIndex(lastIndex, {
                    align: "end",
                    behavior: behavior === "smooth" ? "smooth" : "auto",
                });

                // 等待滾動完成，增加等待時間
                await new Promise((resolve) => setTimeout(resolve, behavior === "smooth" ? 150 : 100));

                // 檢查是否真的到達底部，並進行多次嘗試
                const ensureScrollToBottom = async () => {
                    const container = msgGroup.value;
                    if (!container) return;

                    const { scrollTop, scrollHeight, clientHeight } = container;
                    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 1;

                    if (!isAtBottom) {
                        // 強制滾動到底部
                        container.scrollTop = scrollHeight;

                        // 再次確認是否到達底部
                        await new Promise((resolve) => setTimeout(resolve, 50));
                        const newScrollTop = container.scrollTop;
                        const newScrollHeight = container.scrollHeight;

                        // 如果還是沒有到底部，再試一次
                        if (Math.abs(newScrollHeight - newScrollTop - clientHeight) >= 1) {
                            container.scrollTop = newScrollHeight;
                        }
                    }
                };

                // 執行確保滾動到底部的函數
                await ensureScrollToBottom();
            }
        }
    } finally {
        // 延長等待時間，確保滾動完全完成
        setTimeout(() => {
            isAutoScrolling.value = false;
        }, 200);
    }
}

// 2. 合併所有房間切換的邏輯到一個地方
// 在切換房間時重置狀態
watch(
    () => chatPartner.value?.roomId,
    async (newRoomId) => {
        if (newRoomId) {
            // 更新基本狀態
            clearLocalMessages();
            welcomeMessage.value = null;
            welcomeInitialTime.value = null;
            isWelcomeMessageFixed.value = false;
            scrollType.value = 0;
            currentRoomId.value = newRoomId;
            currentPage.value = 0;
            messages.value = [];
            allHistoryMessages.value = [];
            allMessages.value = [];
            pendingMessages.value = [];
            tempMessages.value = [];
            isProcessingMessage.value = false;
            historyMessagesId.value = 0;
            // UI 狀態重置
            sourceChunkMode.value = "loading";
            if (getLocalTunnel(newRoomId)) {
                is_tunnel.value = true;
            } else {
                is_tunnel.value = false;
            }
            await getExpertSettings();
            textareaHeight = document.querySelector(".inputMsg")?.offsetHeight;
            inputMessageHeight.value = textareaHeight + "px";

            // 重置分頁狀態
            emitter.emit("updateSlideTopStatus", false);
            emitter.emit("updateSlideBottomStatus", false);
            emitter.emit("updateLoadingStatus", false);
            emitter.emit("openScrollBottom", true);
            emitter.emit("clearFileUploader");

            // 清除查詢緩存並重新獲取數據
            // await queryClient.resetQueries(["messages"]);
            room_init();
            refetch();
            // await createRoom();

            scrollBottom("force");
        }
    },
    { immediate: true }
);
// 在切換房間時重置
// watch(() => chatPartner.value?.roomId, resetChat, { immediate: true });

// 監聽 pageData 變化，更新 SlideTop 狀態
watch(hasMore, (newHasMore) => {
    if (newHasMore !== undefined) {
        emitter.emit("updateSlideTopStatus", newHasMore);
    }
});

watch(hasPreviousPages, (hasPrevious) => {
    emitter.emit("updateSlideBottomStatus", hasPrevious);
});

// 載入狀態同步
watch(isFetching, (loading) => {
    emitter.emit("updateLoadingStatus", loading);
});

watch(isSuccess, async (success) => {
    await syncBotMsg();
    await nextTick();
    loadMoreLock.value = false;
});

// 監聽訊息變化
watch(
    () => pageData.value?.messages,
    async (newMessages) => {
        if (!newMessages) return;

        const convertedMessages = MsgConvertRender(newMessages);

        const firstVisibleItem = rowVirtualizer.value?.value.getVirtualItems()[0];
        const referenceMessage = firstVisibleItem ? messages.value[firstVisibleItem.index] : null;

        if (currentPage.value > 0) {
            allHistoryMessages.value = [...convertedMessages, ...allHistoryMessages.value];
        } else {
            allHistoryMessages.value = [...allHistoryMessages.value, ...convertedMessages];
        }

        messages.value = displayMessages.value;

        await nextTick();

        if (referenceMessage) {
            const newIndex = messages.value.findIndex((msg) => msg.time === referenceMessage.time);
            if (newIndex > -1) {
                rowVirtualizer.value?.value.scrollToIndex(newIndex, {
                    align: "start",
                    behavior: "auto",
                });
            }
        }
    }
);

//監聽如果有提示詞，整頁padding-bottom提示詞+input的高度
watch(hints, async (newValue) => {
    await nextTick();
    if (newValue?.length) {
        inputMessageHeight.value = document.querySelector(".inputMsg").offsetHeight + "px";
    } else {
        inputMessageHeight.value = textareaHeight + "px";
    }
    // scrollBottom("smooth");
});
//監聽如果打開推薦詞
watch(isOpenRecommend, async (newV) => {
    if (!newV) {
        inputMessageHeight.value = textareaHeight + "px";
        return;
    }
    await nextTick();
    inputMessageHeight.value = document.querySelector(".inputMsg").offsetHeight + "px";
});
//監聽聊天對象變動，若從機器人跳到非機器人 提示詞清空
watch(chatPartner, (newValue, oldValue) => {
    // 為了 iframe 重新整理不要跑到其他聊天室所設定
    document.title = newValue.nickname;
    localStorage.setItem("iframeChatPartnerRoomId", newValue.roomId);
    if (oldValue.partner == "bot") {
        hints.value = [];
        isOpenRecommend.value = false;
    }
});

function handleEnter(el) {
    el.style.transition = "transform 0.4s ease, opacity 0.4s ease";
    el.style.opacity = 0;
    el.style.transform = "translateY(-20px)";
    requestAnimationFrame(() => {
        el.style.opacity = 0.4;
        el.style.transform = "translateY(0)";
    });
}

function handleLeave(el, done) {
    el.style.transition = "transform 0.4s ease, opacity 0.4s ease";
    el.style.opacity = 0.4;
    el.style.transform = "translateY(0)";
    requestAnimationFrame(() => {
        el.style.opacity = 0;
        el.style.transform = "translateY(-20px)";
        setTimeout(done, 500);
    });
}

const showFloatingDate = ref(false);
let scrollTimeout = null;

function handleScroll() {
    if (isFetching.value) return;

    requestAnimationFrame(() => {
        const { isNearTop, isNearBottom } = checkScrollPosition();

        if (isNearTop && hasMore.value && !loadMoreLock.value) {
            // 延迟加载，避免频繁触发
            setTimeout(() => {
                throttledLoadMore();
            }, 100);
        }

        requestAnimationFrame(() => {
            if (!isNearBottom) {
                emitter.emit("openScrollBottom", false);
            } else {
                emitter.emit("openScrollBottom", true);
            }

            showFloatingDate.value = true;
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                showFloatingDate.value = false;
            }, 1250);
        });
    });
}

const feedbackOptions = ref([]);
async function getFeedbackOptions() {
    apiStatusStore.registerRequest();
    try {
        let rs = await axios.get("/feedback/options");
        if (rs.data.code === 0) {
            feedbackOptions.value = rs.data.data;
        } else {
            console.error("取得評分選項失敗", rs.data);
        }
    } catch (error) {
        console.error(error.message);
    } finally {
        apiStatusStore.markRequestComplete();
    }
}
async function getExpertSettings() {
    apiStatusStore.registerRequest();
    try {
        let rs = await axios.get(`/expert/expert?expertId=${chatPartner.value.expertId}`, {
            signal: abortController.signal,
        });
        if (rs.data.code === 0) {
            const exportSourceChunkMode = rs.data.data[0].source_chunk_mode;
            show_dataset_name.value = rs.data.data[0].show_dataset_name;
            isTranslationExpert.value = rs.data.data[0].translation_expert;
            if (exportSourceChunkMode === "full" || exportSourceChunkMode === "simple") {
                sourceChunkMode.value = exportSourceChunkMode;
            } else {
                sourceChunkMode.value = "full";
            }

            if (is_tunnel.value) {
                return;
            }

            // 保存歡迎詞到 ref
            if (rs.data.data[0].welcomeMessage) {
                // 記錄歡迎詞的初始時間戳
                welcomeInitialTime.value = Date.now();
                welcomeMessage.value = {
                    ...rs.data.data[0].welcomeMessage,
                    isWelcome: true,
                    time: welcomeInitialTime.value,
                };

                // 過濾掉舊的 welcomeMessage，再加入新的 welcomeMessage
                messages.value = [
                    // 過濾掉 messages 中 isWelcome 為 true 的訊息
                    ...messages.value.filter((message) => !message.isWelcome),
                    welcomeMessage.value,
                ];

                nextTick(() => {
                    scrollBottom("smooth");
                });
            }
        } else {
            console.error("取得專家 source_chunk_mode 失敗", rs.data);
        }
    } catch (error) {
        console.error(error.message);
    } finally {
        apiStatusStore.markRequestComplete();
    }
}

/* --------------------------------輪巡需要(改socket可刪除)-------------------------------- */
let interval; //輪巡需要
/* --------------------------------輪巡需要(改socket可刪除)-------------------------------- */

function room_init() {
    textareaHeight = document.querySelector(".inputMsg").offsetHeight;
    inputMessageHeight.value = textareaHeight + "px";
}

//取得聊天對象資訊 如果是直接輸入網址走這
async function getChatPartner() {
    // 沒有房間就創
    let item = contactList.value.find((f) => f.roomId == roomId.value);

    if (!item) return;
    // isOpenMenu.value = false;
    changePartner(item);
}

//取得聯絡列表
const isIframe = window !== window.parent;
async function getContactList() {
    // isStatic 直接用 tag 嵌入 iframe 就照舊 因為不會帶參數讓後端去要過濾哪些專家
    if (!isIframe || isStatic) {
        let rs = await axios.get("/contact/list");

        if (rs.data.code === 1 && rs.data.message === "目前沒有可用的專家") {
            showExpertAccessRestricted.value = true;
            return;
        } else {
            showExpertAccessRestricted.value = false;
        }

        if (rs.data.data) {
            rs.data.data.forEach((item) => {
                if (item.sex === "1") {
                    item.avatar = item.avatar || "user_man.png";
                } else if (item.sex === "2") {
                    item.avatar = item.avatar || "user_woman.png";
                }
            });
            rs = rs.data.data;
            const verify_no = ["IT0193", "I30412", "admin", "I30420", "I20496", "I14249", "IT0178"];
            if (!verify_no.includes(user_no.value)) {
                rs = rs.filter((f) => f.expertId !== "bdc3588b-dbfb-4b73-98fc-7614770112f3");
            }
            if (user_no.value === "KHTEST") {
                rs = rs.filter((f) => f.expertId === "2cc5b5af-92b4-4d6c-b069-4abb08b43f79");
            }
            contactList.value = rs;
        }
    }
}

//以\n切陣列格式化
function SymbolConvert(text) {
    if (typeof text === "string") {
        return text.split("\n");
    }
    return [text]; // 如果不是字符串，直接返回一個包含該輸入的數組
}

//格式化成專門渲染的資料
function MsgConvertRender(msgs) {
    msgs = JSON.parse(JSON.stringify(msgs || []));
    if (!msgs.length) return msgs;
    msgs.forEach((item) => {
        if (item.sender === uid.value) {
            item.avatar = avatar.value;
            item.nickname = nickname.value;

            if (item.message.type !== "document_qa_tunnel" && Array.isArray(item.message.data)) {
                item.message.data = item.message.data.join("");
            }
        } else if (item.sender === "bot") {
            item.avatar = chatPartner.value.avatar;
        } else if (item.sender === chatPartner.value.uid) {
            item.avatar = chatPartner.value.avatar;
            item.nickname = chatPartner.value.nickname;

            if (item.message.type !== "document_qa_tunnel" && Array.isArray(item.message.data)) {
                item.message.data = item.message.data.join("");
            }
        }

        // 如果全域 tunnel 狀態為 false，移除個別訊息的 tunnel 標記
        if (!is_tunnel.value && item.is_tunnel) {
            delete item.is_tunnel;
        }
    });

    return msgs;
}
//若聊天列表點擊機器人時沒有房間號就創一個
async function createRoom() {
    if (identity.value == "b") {
        await createBotRoom();
    } else if (identity.value == "u") {
        await createUserRoom();
    }
}
async function createBotRoom() {
    //沒有房間時創一個
    if (!chatPartner.value.roomId) {
        if (roomId.value == "creating") {
            let rs = await axios.post("/bot/room", JSON.stringify({ expertId: chatPartner.value.expertId }));
            chatPartner.value.roomId = rs.data.data?.roomId;
            // contactList.value.find((f) => f.expertId == chatPartner.value.expertId).roomId = rs.data.data?.roomId;
            // console.log(chatPartner.value.expertId);
            if (!chatPartner.value.roomId) return;
            let contact = contactList.value.find((f) => f.expertId == chatPartner.value.expertId);
            if (contact) {
                contact.roomId = rs.data.data.roomId;
            }
        }

        if (single.value) {
            router.replace("/b/" + chatPartner.value.roomId + "?single=true");
        } else {
            router.replace("/b/" + chatPartner.value.roomId);
        }
    } else {
        //有房間但是是剛進來是creating

        if (roomId.value == "creating" || roomId.value == "undefined" || roomId.value == "null") {
            if (single.value) {
                router.replace("/b/" + chatPartner.value.roomId + "?single=true");
            } else {
                router.replace("/b/" + chatPartner.value.roomId);
            }
        }
    }
}
async function createUserRoom() {
    //沒有房間建立一個
    if (roomId.value == "creating") {
        let rs = await axios.post("/contact/room", JSON.stringify({ user2Uid: chatPartner.value.uid }));
        contactList.value.find((f) => f.uid == chatPartner.value.uid).roomId = rs.data.data.roomId;
        router.replace("/u/" + rs.data.data.roomId + "/");
    }
}
//取得本地指定房間聊天
function getLocalMsg(roomId) {
    return JSON.parse(localStorage.getItem("msg_" + roomId)) || [];
}

//取得本地房間機器人context
function getLocalContext(roomId) {
    return JSON.parse(localStorage.getItem("context_" + roomId)) || [];
}
//設定本地房間機器人context
function setLocalContext(roomId, msg) {
    localStorage.setItem("context_" + roomId, JSON.stringify(msg || []));
}
//設定本地隧道模式
function setLocalTunnel(roomId, msg) {
    localStorage.setItem("tunnel_" + roomId, JSON.stringify(msg || false));
}
//取得本地隧道模式
function getLocalTunnel(roomId) {
    return JSON.parse(localStorage.getItem("tunnel_" + roomId)) || false;
}

// 清除第一頁以外的所有訊息
async function resetToFirstPage() {
    try {
        const firstPageData = await queryClient.fetchQuery({
            queryKey: ["messages", currentRoomId.value, 0],
            queryFn: async () => {
                const response = await axios.post(
                    "/bot/message",
                    JSON.stringify({
                        roomId: currentRoomId.value,
                        pageSize: PAGE_SIZE,
                        page: 0,
                    })
                );
                return {
                    messages: response.data.data.chat || [],
                    hasMore: response.data.data.hasMore,
                    totalCount: response.data.data.totalCount,
                };
            },
            staleTime: 0,
        });

        if (firstPageData) {
            const serverMessages = MsgConvertRender(firstPageData.messages);

            // 清空所有暫存的訊息
            allHistoryMessages.value = serverMessages;
            allMessages.value = [];
            pendingMessages.value = [];
            tempMessages.value = [];

            currentPage.value = 0;

            messages.value = displayMessages.value;
        }
    } catch (error) {
        console.error("Error resetting to first page:", error);
    }
}

async function handleFeedback(feedbackData) {
    try {
        feedbackData["expert_id"] = chatPartner.value.expertId;
        feedbackData["user_id"] = uid.value;
        feedbackData["user_type"] = "user";

        const response = await axios.post("/feedback", JSON.stringify(feedbackData));
        const { feedback, feedbackOptionsWithNames, feedbackProcess } = response.data.data;
        const { id, history_messages_id, feedback_type } = feedback;

        let targetMessage;
        let targetMessageIndex = -1;

        targetMessageIndex = messages.value.findIndex((msg) => msg.history_message_id == history_messages_id);

        if (targetMessageIndex !== -1) {
            targetMessage = messages.value[targetMessageIndex];

            targetMessage.feedback_id = id;
            targetMessage.feedback_type = feedback_type;

            const optionsNames = feedbackOptionsWithNames.map((option) => option.name).join("\n- ");
            let responseMessage =
                feedback_type === "user_positive"
                    ? `謝謝您的正面回饋！很高興聽到您對我們的回答感到滿意。以下是您給出的回饋選項：\n- ${optionsNames}\n\n您也提供了以下評論：\n${feedbackProcess.comment}\n\n如果您有更多問題或需要進一步的幫助，請隨時聯繫我們。`
                    : `感謝您的回饋。我們很遺憾聽到您對我們的回答不滿意。我們會根據您的意見進行改進。以下是您給出的回饋選項：\n- ${optionsNames}\n\n您也提供了以下評論：\n${feedbackProcess.comment}\n\n如果您有具體的建議或需要更多幫助，請告訴我們。我們會盡力改進。`;

            const newFeedbackMessage = {
                time: targetMessage.time + 10,
                feedback_time: Date.now(),
                sender: "bot",
                message: [{ data: responseMessage }],
                isPending: true,
                isFeedback: true,
            };

            toast({
                title: "新增成功",
                description: "評論已成功新增。謝謝您寶貴的意見！",
                variant: "success",
            });

            await axios.put(
                "/bot/saveMessage",
                JSON.stringify({
                    roomId: chatPartner.value.roomId,
                    historyMessagesId: history_messages_id,
                    newFeedbackMessage,
                    updatedMessage: targetMessage,
                })
            );

            await new Promise((resolve) => setTimeout(resolve, 500));

            try {
                await resetToFirstPage();
                await nextTick();
                scrollBottom("force");
            } catch (error) {
                console.error("Error fetching updated messages:", error);
                toast({
                    title: "錯誤",
                    description: "更新訊息時發生錯誤，請重新整理頁面。",
                    variant: "destructive",
                });
            }
        } else {
            console.error("Target message not found");
            toast({
                title: "錯誤",
                description: "找不到目標訊息，請重新整理頁面後再試。",
                variant: "destructive",
            });
        }
    } catch (error) {
        console.error("Feedback submit failed:", error);
        toast({
            title: "錯誤",
            description: "新增評論時發生錯誤，請稍後再試。",
            variant: "destructive",
        });
    }
}
//同步最新聊天
async function syncBotMsg() {
    //取local
    // let msg = pageData?.value?.messages || [];
    let newestData = queryClient.getQueryData(["messages", currentRoomId.value, 0]);
    let msg = newestData?.messages || [];

    // 檢查 LocalStorage 中的 tunnel 狀態
    const localTunnelState = getLocalTunnel(roomId.value);
    
    // 判斷最後一筆對話是否是隧道模式
    if (msg.length > 0 && msg[msg.length - 1]) {
        // 如果 LocalStorage 中沒有 tunnel 資料，強制設為 false
        if (!localTunnelState) {
            is_tunnel.value = false;
        } else {
            is_tunnel.value = msg[msg.length - 1].is_tunnel ? true : false;
        }
    }

    // 判斷是不是應該要再顯示一次歡迎詞
    // let shouldShowWelcome = !msg || !msg.length || new Date() - new Date(msg[msg.length - 1].time) > 60000;
    // let shouldShowWelcome = false;

    // //取得訊息最後一筆的時間
    // let lastMessageDate = new Date(msg[msg.length - 1]?.time);
    // //取得當前時間
    // let currentDate = new Date();

    // // 轉換成日期格式 yyyy-mm-dd 才可以判斷是不是已經超過一天
    // let lastMessageDay = new Date(lastMessageDate.getFullYear(), lastMessageDate.getMonth(), lastMessageDate.getDate());
    // let currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

    // // 當前日期扣掉最後一筆訊息的日期
    // let daysDifference = Math.floor((currentDay - lastMessageDay) / (1000 * 60 * 60 * 24));

    // // 要是 welcome_word_update_frequency 天就顯示歡迎詞
    // // -1永不重複顯示歡迎詞
    // if (welcome_word_update_frequency.value == -1) {
    //     shouldShowWelcome = false;
    // } else if (daysDifference >= welcome_word_update_frequency.value) {
    //     shouldShowWelcome = true;
    // }

    // if (shouldShowWelcome && msg.length !== 0 && !isFetching.value) {
    //     try {
    //         await axios.put(
    //             "/bot/updateChatJson",
    //             JSON.stringify({
    //                 roomId: currentRoomId.value,
    //                 expertId: chatPartner.value.expertId,
    //                 type: "expiredDateNeedInsertWelcome",
    //             })
    //         );

    //         refetch();
    //     } catch (error) {
    //         console.error("更新 chat json 失敗", error);
    //     }
    // } else if (msg.length === 0 && !isFetching.value) {
    //     await axios.put(
    //         "/bot/updateChatJson",
    //         JSON.stringify({ roomId: currentRoomId.value, expertId: chatPartner.value.expertId })
    //     );

    //     refetch();
    // }
}

const mkdRef = ref([]);
const boundButtons = new WeakSet();
async function bindMarkedHtmlButtonEvents(containerRefs) {
    await nextTick(); // 等 DOMPurify 處理完
    await new Promise((resolve) => setTimeout(resolve, 500));

    containerRefs?.value?.forEach((container) => {
        if (!container || typeof container.querySelectorAll !== "function") return;

        const buttons = container.querySelectorAll(".mdk-link-btn");

        buttons.forEach((button) => {
            // 使用WeakSet來追蹤已經綁定過事件的按鈕
            if (boundButtons.has(button)) return;

            const clickHandler = async (event) => {
                const button = event.currentTarget;
                const url = button.dataset.url;
                const shouldOpen = await shouldOpenInNewTab(url);

                if (shouldOpen) {
                    window.open(url, "_blank");
                }
            };
            button.addEventListener("click", clickHandler);
            boundButtons.add(button);
        });
    });
}
// 給資料來源中的圈圈按鈕，決定是否開啟新分頁
async function shouldOpenInNewTab(url) {
    // 後台的檔案走這條
    if (url.includes("/ava/backend/download/")) {
        try {
            const response = await axios.post(
                "/chatroom/download",
                {
                    url: url,
                },
                { responseType: "blob" }
            );

            const contentType = response.headers["content-type"];
            if (contentType && contentType.includes("application/json")) {
                const text = await response.data.text(); // Blob 轉文字
                const rs = JSON.parse(text);
                if (rs?.code === 1) {
                    const isMobile =
                        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        (navigator.maxTouchPoints > 0 && /Mobile/i.test(navigator.userAgent));
                    const isSmallScreen = window.innerWidth <= 1000;
                    let toastStyle = {
                        left: (!isMobile || !isSmallScreen) && !isOpenMenu.value ? "8.5rem" : "0",
                        width: !isMobile || !isSmallScreen ? "100%" : "70%",
                        maxWidth: !isMobile || !isSmallScreen ? "400px" : "260px",
                    };
                    toast({
                        title: "提示",
                        description: rs?.message,
                        variant: "bottomOnly",
                        duration: 3000,
                        style: {
                            padding: "1rem",
                            backgroundColor: "#FFD306",
                            top: "-4.6rem",
                            right: "0",
                            margin: "0 auto",
                            ...toastStyle,
                        },
                    });
                }
                return false;
            } else {
                // 確保在接收到下載請求的回應後，能夠正確地觸發下載
                const contentDisposition = response.headers["content-disposition"];
                const filename = contentDisposition.match(/filename\*=UTF-8''(.+)/)[1];
                const blob = new Blob([response.data], { type: response.headers["content-type"] });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", decodeURIComponent(filename));
                document.body.appendChild(link);
                link.click();
                link.parentNode.removeChild(link);
                return false; // 已經處理下載，不需要再開新分頁
            }
        } catch (error) {
            console.error("Error downloading file:", error);
            return false;
        }
    }
    // 其他連結走這條
    return true;
}

const lightboxVisible = ref(false);
const lightboxIndex = ref(0);
const lightboxImages = ref([]);
function markedHTML(html) {
    if (!html) return html;

    try {
        // 建立自訂 renderer，避免解析刪除線
        const renderer = new marked.Renderer();
        renderer.del = (text) => `~~${text}~~`;

        renderer.image = (href, title, text) => {
            return `<img data-src="${href}" src="${href}" alt="${text}" title="${title || ""}" class="lazy-load" />`;
        };

        // 使用自訂 renderer 進行 Markdown 解析
        html = marked.parse(html, { renderer });

        // 處理連結
        html = html.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (fullMatch, p1, p2) => {
            // 清理內容，移除額外的空格
            try {
                let cleanUrl = extractUrl(p1);
                if (!cleanUrl) cleanUrl = p1;

                const cleanedText = p2.trim();

                // 檢查是否為數字或短文本
                const numMatch = cleanedText.match(/\[(\d+)\]/);
                const isNumber = numMatch || /^\d+$/.test(cleanedText);

                // 主要是處理從"文件"來的連結
                if (cleanUrl.includes("/ava/avaClient/")) {
                    if (isNumber) {
                        const displayNum = numMatch ? numMatch[1] : cleanedText;
                        return `<span class="link-btn number-btn" title="資料來源 ${displayNum}">${displayNum}</span>`;
                    } else {
                        let extractedP2Url = extractUrl(p2);
                        return `<span class="link-btn">${extractedP2Url}</span>`;
                    }
                }

                // 處理其他連結，點擊事件是靠下面的watch virtualRows.value
                if (isNumber) {
                    // 如果是數字格式，使用圓形設計
                    const displayNum = numMatch ? numMatch[1] : cleanedText;
                    return `<button class="link-btn number-btn mdk-link-btn" title="${cleanUrl}" data-url="${cleanUrl}">${displayNum}</button>`;
                } else {
                    // 如果是文字，使用適合文字長度的設計
                    let extractedP2Url = extractUrl(p2);
                    if (extractedP2Url) p2 = extractedP2Url;
                    return `<button class="link-btn long-link-btn mdk-link-btn" title="${cleanUrl}" data-url="${cleanUrl}">
                                ${p2}
                                <i class="ml-1 fa-solid fa-arrow-up-right-from-square" style="font-size: 0.75rem;margin-top:3.5px;"></i>
                            </button>`;
                }
            } catch (error) {
                console.error(`處理連結時發生錯誤: ${error}`);
                return fullMatch;
            }
        });

        html = html.replace(
            /<p[^>]*>\s*(圖片來源[：:][\s\S]*?)<\/p>/gi,
            (match, content) => `<li>${content}</li>`
        );
        html = html.replace(
            /^\s*(圖片來源[：:][\s\S]*?)\s*$/gmi,
            (match, content) => `<li>${content}</li>`
        );

		html = html.replace(/(<li[^>]*>圖片來源[：:])([\s\S]*?)(<\/li>)/gi, (fullMatch, start, content, end) => {
            // 檢查是否包含圖片標籤
            if (content.includes("<img")) {
                // 解析出所有的<img>標籤
                const imgRegex = /<img[^>]*>/gi;
                const imgTags = [];
                let imgMatch;

                while ((imgMatch = imgRegex.exec(content)) !== null) {
                    imgTags.push(imgMatch[0]);
                }

                // 如果找到圖片標籤，則創建一個新的結構
                if (imgTags.length > 0) {
                    // 創建圖片容器 - 使用改進的樣式，最小化內部間距
                    let newContent =
                        `
                    <li>
                        圖片來源：<br>
                        <div class="relative mt-2">
                            <div class="absolute top-0 right-0 bottom-0 z-10 w-20 bg-gradient-to-l from-gray-50 to-transparent opacity-0 transition-opacity pointer-events-none hover:opacity-100"></div>

                            <div class="flex overflow-x-auto gap-2 items-center px-2 py-1 bg-gray-50 rounded-md scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">`;

                    // 處理每個圖片標籤
                    for (const imgTag of imgTags) {
                        // 從原始標籤中提取src和alt
                        const srcMatch = imgTag.match(/src="([^"]*)"/i);
                        const altMatch = imgTag.match(/alt="([^"]*)"/i);

                        if (srcMatch) {
                            const src = srcMatch[1];
                            const alt = altMatch ? altMatch[1] : "Image";
                            const shortName = alt.split(".")[0].substring(0, 8);

                            // 創建新的圖片標籤，垂直置中並最小化高度
                            newContent += `
                                <div class="relative flex-shrink-0 !mb-[1px] !w-20 !h-20 overflow-hidden transition-all duration-200 bg-white border border-gray-200 rounded-md sm:h-14 sm:w-14 hover:shadow-md group">
                                    <img
                                        src="${src}"
                                        alt="${alt}"
                                        data-lightbox-src="${src}"
                                        data-lightbox-alt="${alt}"
                                        class="object-cover w-full !h-[70px] transition-transform duration-300 cursor-pointer group-hover:scale-105">

                                    <!-- shortname覆蓋在圖片底部 -->
                                    <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] leading-tight py-[1px] text-center truncate pointer-events-none">
                                        ${shortName}
                                    </div>
                                </div>`;
                        }
                    }

                    newContent +=
                        `
                                </div>
                            </div>
                        </li>`;

                    return newContent;
                }
            }

            // 如果不包含圖片標籤或處理失敗，則返回原始匹配
            return fullMatch;
        });
        return html;
    } catch (error) {
        // 解析失敗，返回原始 HTML
        console.error("Markdown 解析錯誤:", error);
        return html;
    }
}

window.openLightbox = (src, alt) => {
    lightboxImages.value = [{ src, alt }];
    lightboxIndex.value = 0;
    lightboxVisible.value = true;
};

// 關閉燈箱
const closeLightbox = () => {
    lightboxVisible.value = false;
};

//修改舊的聊天 把從 localStorage 拿資料的相關程式碼移除
// 原本的問題：updateOldData 只更新了 messages.value 但沒有同步更新 allMessages.value
// 解決方法：在 updateOldData 中同時更新 allMessages.value 安捏丟後阿
let search_type_old = false;
async function updateOldData(msg, time, type, is_steaming) {
    if (!msg) return;

    if (isValidJSON(msg)) {
        search_type_old = true;
        msg = isValidJSON(msg) || msg;
        res_msg = "";
    } else if (search_type_old) {
        msg = isValidJSON(msg) || msg;
    } else {
        res_msg += msg;
        search_type_old = false;
        return;
    }

    // 兩個都沒有 代表不是從組件觸發
    if (!time && !type) {
        let reverseMsg = messages.value.slice().reverse();
        let botLastMsg = reverseMsg.find((f) => f.sender == "bot");

        if (!botLastMsg) {
            console.error("找不到機器人訊息");
            return;
        }

        botLastMsg.message.push(msg);

        // 更新資料庫
        let rs = await axios.post("/bot/updateMessage", {
            message: botLastMsg,
            roomId: roomId.value,
        });

        // 同時更新 allMessages.value 中對應的訊息
        const allMessagesIndex = allMessages.value.findIndex(
            (msg) => msg.sender === botLastMsg.sender && msg.time === botLastMsg.time
        );
        if (allMessagesIndex !== -1) {
            allMessages.value[allMessagesIndex] = { ...botLastMsg };
        }

        // 強制更新 displayMessages 以確保變更立即反映
        await nextTick();
    } else {
        // 根據是否有 time 參數來決定如何取得訊息
        let message;
        if (time) {
            // 如果有 time，查找特定時間的訊息
            message = messages.value.find((f) => f.sender == "bot" && f.time == time);
        } else {
            // 如果沒有 time，取最後一個機器人訊息
            let reverseMsg = messages.value.slice().reverse();
            message = reverseMsg.find((f) => f.sender == "bot");
        }

        // 檢查 message 是否存在
        if (!message) {
            console.error("找不到對應的機器人訊息, time:", time);
            return;
        }

        if (msg.type) {
            let obj = {};
            obj[msg.type] = "";
            targetType = msg.type;
            targetCom = "";

            switch (msg.type) {
                case "charts":
                    let item = message.message.find((f) => f[type]);
                    if (item) {
                        item.charts.option = msg;
                    }
                    break;

                case "card":
                    message.message.push(obj);
                    break;

                case "html_json":
                    // 參考 addResultMessage 的邏輯
                    if (!message.message) {
                        message.message = [];
                    }

                    if (msg.data && Array.isArray(msg.data)) {
                        // 直接使用傳入的數據
                        const htmlJsonObj = { html_json: msg.data };
                        message.message.push(htmlJsonObj);
                    } else {
                        // 創建一個空的 html_json 陣列
                        const htmlJsonObj = { html_json: [] };
                        message.message.push(htmlJsonObj);
                    }
                    break;

                default:
                    message.message.push(obj);
            }
        } else {
            // 取得訊息的最後一個組件
            let messageLastElement = message.message[message.message.length - 1];

            if (targetType === "data") {
                if (messageLastElement) {
                    messageLastElement[targetType] += msg;
                }
                if (!is_steaming) {
                    search_type_old = false;
                    res_msg = "";
                }
            } else if (targetType === "html_json") {
                // 特別處理 html_json 數據流
                if (!targetCom) targetCom = "";

                if (typeof msg === "object") {
                    try {
                        targetCom += JSON.stringify(msg);
                    } catch (e) {
                        console.error("無法將對象轉換為 JSON:", e);
                    }
                } else {
                    targetCom += msg;
                }

                if (isValidJSON(targetCom)) {
                    const htmlJsonData = isValidJSON(targetCom);

                    // 確保 messageLastElement 存在且有 html_json 屬性
                    if (messageLastElement && !messageLastElement.html_json) {
                        messageLastElement.html_json = [];
                    }

                    // 如果解析的數據是陣列，就合併；如果是單個對象，就添加到陣列
                    if (Array.isArray(htmlJsonData)) {
                        messageLastElement.html_json = [...messageLastElement.html_json, ...htmlJsonData];
                    } else {
                        messageLastElement.html_json.push(htmlJsonData);
                    }

                    targetCom = "";
                }
            } else {
                // targetType為其他類型
                if (typeof msg === "object") {
                    targetCom += JSON.stringify(msg);
                } else {
                    targetCom += msg;
                }

                if (isValidJSON(targetCom)) {
                    targetCom = isValidJSON(targetCom);

                    switch (targetType) {
                        case "tunnel":
                            updateTunnel(targetCom);
                            break;
                        default:
                            if (messageLastElement) {
                                messageLastElement[targetType] = targetCom;
                            }
                            break;
                    }

                    targetCom = "";
                }
            }

            // 更新資料庫
            let rs = await axios.post("/bot/updateMessage", {
                message: message,
                roomId: roomId.value,
            });

            // 同時更新 allMessages.value 中對應的訊息
            const allMessagesIndex = allMessages.value.findIndex(
                (msg) => msg.sender === message.sender && msg.time === message.time
            );
            if (allMessagesIndex !== -1) {
                allMessages.value[allMessagesIndex] = { ...message };
            }

            // 強制更新 displayMessages 以確保變更立即反映
            await nextTick();
        }
    }
}

async function cancelFormData(msg) {}
async function pushFormData(msg) {
    // console.log({ data: msg.data, type: "form" });
    // console.log("pushFormData msg: ", msg);

    isWaitRes.value = true;
    const formData = new FormData();
    formData.append("message", JSON.stringify({ data: msg.data, type: "form" }));
    formData.append("expert_id", chatPartner.value.expertId);

    fetchStream(formData, (data, is_steaming) => {
        if (data === true) {
            isWaitRes.value = false;
            return;
        }
        updateOldData(data, msg.time, msg.type, is_steaming);
    });
}

async function pushEchartsData(msg) {
    isWaitRes.value = true;
    const formData = new FormData();
    formData.append("message", JSON.stringify({ data: msg.data, type: msg.type }));
    formData.append("expert_id", chatPartner.value.expertId);
    fetchStream(formData, (data) => {
        if (data === true) {
            isWaitRes.value = false;

            return;
        }
        updateOldData(data, msg.time, msg.type);
    });
}
//如果是隧道模式則加入
function chkTunnel() {
    if (is_tunnel.value) {
        messages.value[messages.value.length - 1].is_tunnel = true;
        messages.value[messages.value.length - 2].is_tunnel = true;
    }
}
//在組件用的資料內插入時間當為一  但有可能這筆資料有兩個charts 兩個charts組件時間一樣
function addMsgTime(botMsg, botMsgTime) {
    // console.log(botMsg);
    botMsg.forEach((item) => {
        if (Object.keys(item)[0] === "data") return;
        if (!item[Object.keys(item)[0]]) return;
        item[Object.keys(item)[0]].time = botMsgTime;
    });
}

async function fetchApiStore(msg) {
    try {
        // 等待滾動到最底部
        await new Promise(async (resolve, reject) => {
            // 直接強制滾動到最底部
            await scrollBottom("force");

            await nextTick();

            // 設置超時，避免永遠等待
            const timeout = setTimeout(() => {
                reject(new Error("Scroll timeout"));
            }, 5000);

            // 檢查是否到達底部
            const checkBottom = async () => {
                const container = msgGroup.value;
                if (!container) {
                    clearTimeout(timeout);
                    reject(new Error("No container"));
                    return;
                }

                const { scrollTop, scrollHeight, clientHeight } = container;
                const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 2;

                if (isAtBottom) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    // 如果還沒到底部，繼續檢查
                    await new Promise((r) => setTimeout(r, 100));
                    await scrollBottom("force");
                    checkBottom();
                }
            };

            checkBottom();
        });

        // 到達底部後 才執行 API
        isWaitRes.value = true;
        const formData = new FormData();

        prepareFormData(formData, msg);
        let userMsgTime = new Date().getTime();

        chkTunnel();
        resetStreamState();
        fetchStream(formData, async (data, is_streaming) => {
            if (data === true) {
                await handleStreamEnd(msg, userMsgTime);
                return;
            }
            addResultMessage(data, is_streaming);
        });
    } catch (error) {
        console.error("Error in fetchApiStore:", error);
        // 可以添加错误提示
        toast?.({
            title: "錯誤",
            description: "發送訊息時發生錯誤，請稍後再試。",
            variant: "destructive",
        });
    }
}

function prepareFormData(formData, msg) {
    if (is_tunnel.value) {
        let formMsg = getLocalTunnel(roomId.value);
        // 檢查 formMsg 是否為物件且不為 null
        if (formMsg && typeof formMsg === "object") {
            formMsg.type = formMsg.state === "QA" ? "document_qa_tunnel" : "tunnel";
            formMsg.state = formMsg.state === "start" ? "filling" : formMsg.state;
            formMsg.input_message = msg.data;
            formMsg.current_form = JSON.stringify(formMsg.current_form);
            formMsg.fields_format = JSON.stringify(formMsg.fields_format);
            formData.append("message", JSON.stringify(formMsg));
        } else {
            // 重置隧道狀態，因為數據不一致
            is_tunnel.value = false;
        }
    } else {
        // scope_datasets = message.get("scope_datasets",None)
        // formData.append("history_message_id", historyMessagesId.value);
        // TODO: 之後要多一個 scope_datasets 的欄位 來限制搜尋的知識庫 格式會是 ["知識庫id","知識庫id"]
        formData.append(
            "message",
            JSON.stringify({
                data: msg.data,
                type: msg.type,
                ...(msg.text ? { text: msg.text } : {}), // 有內容才加 text 這是給 file 用的
            })
        );
    }

    formData.append("roomId", roomId.value);
    formData.append("uid", uid.value);
    formData.append("context", JSON.stringify(getLocalContext(roomId.value)));
    formData.append("expert_id", chatPartner.value.expertId);
}

// 處理訊息流結束
async function handleStreamEnd(msg, userMsgTime) {
    userMsgTime = userMsgTime || Date.now();
    // 確保機器人回應的時間晚於用戶消息
    const botMsgTime = userMsgTime + 1;
    const userMsg = { data: msg.data, type: msg.type, ...(msg.text ? { text: msg.text } : {}) };
    const botMsg = messages.value[messages.value.length - 1].message;
    // 確保時間戳不同且有適當間隔，更可靠的做法

    // 保存當前可見的項目索引，用於後續恢復滾動位置
    const visibleItems = rowVirtualizer.value?.value.getVirtualItems() || [];
    const visibleIndexes = visibleItems.map((item) => item.index);
    const wasAtBottom = checkIfScrolledToBottom();

    addMsgTime(botMsg, botMsgTime);
    updateMessageTimes(userMsgTime, botMsgTime);

    // 將完成的對話添加到本地訊息列表
    const completedUserMessage = {
        sender: uid.value,
        avatar: avatar.value,
        message: userMsg,
        nickname: nickname.value,
        time: userMsgTime,
        isPending: false,
        messageId: `user_${userMsgTime}`,
        is_tunnel: is_tunnel.value,
    };

    const completedBotMessage = {
        sender: "bot",
        avatar: chatPartner.value.avatar,
        message: botMsg,
        nickname: "Bot",
        time: botMsgTime,
        isPending: false,
        history_message_id: historyMessagesId.value,
        messageId: `bot_${botMsgTime}`,
        is_tunnel: is_tunnel.value,
    };

    // 使用單一批量更新來處理訊息
    let updatedMessages = [...allMessages.value];

    if (!is_tunnel.value) {
        // 處理非隧道模式：移除所有訊息的隧道標記
        updatedMessages = updatedMessages.map((msg) => {
            const { is_tunnel, ...msgWithoutTunnel } = msg;
            return msgWithoutTunnel;
        });

        // 清除新訊息的 is_tunnel 標記
        const { is_tunnel: userTunnel, ...userMessageWithoutTunnel } = completedUserMessage;
        const { is_tunnel: botTunnel, ...botMessageWithoutTunnel } = completedBotMessage;

        // 添加新訊息
        updatedMessages.push(userMessageWithoutTunnel, botMessageWithoutTunnel);

        // 處理歡迎詞
        const welcomeMsg = welcomeMessage.value;
        if (welcomeMsg && isWelcomeMessageFixed.value) {
            const welcomeMsgIndex = updatedMessages.findIndex((msg) => msg.time && msg.time > welcomeMsg.time);
            if (welcomeMsgIndex !== -1) {
                updatedMessages.splice(welcomeMsgIndex, 0, welcomeMsg);
            } else {
                updatedMessages.push(welcomeMsg);
            }
        }

        // 處理隧道結束操作 (替代原來的 handleTunnelEnd 調用)
        updatedMessages = handleTunnelEndCleanly(updatedMessages);
    } else {
        // 處理隧道模式：直接添加新訊息
        updatedMessages.push(completedUserMessage, completedBotMessage);
    }

    // 清空待處理訊息
    pendingMessages.value = [];

    // 更新本地訊息列表（一次性批量更新）
    allMessages.value = updatedMessages;

    // 儲存訊息到資料庫
    if (+max_message_length.value >= userMsg.data.length) {
        await updateDBMessage(userMsg, userMsgTime, botMsg, botMsgTime, is_tunnel.value);
    }

    isWaitRes.value = false;

    // 更新顯示的訊息
    messages.value = displayMessages.value;
    // 在 DOM 更新後恢復滾動位置
    await nextTick();

    // 只有當使用者沒有自己滾動時才進行自動滾動
    if (!isUserScrolling.value) {
        if (scrollType.value === 0) {
            // 滾動到用戶提問位置（最後一條用戶訊息）
            // scrollToQATop();
            scrollToUserQuestionAfterComplete();
        } else if (wasAtBottom) {
            // 如果之前在底部，則滾動到底部
            smoothScrollToBottom();
        } else if (visibleIndexes.length > 0) {
            // 否則嘗試恢復到先前可見的位置
            const targetIndex = Math.min(visibleIndexes[0], messages.value.length - 1);
            smoothScrollToIndex(targetIndex);
        }
    }
}

// 檢查是否滾動到底部的輔助函數
function checkIfScrolledToBottom() {
    if (!msgGroup.value) return true;

    const { scrollTop, scrollHeight, clientHeight } = msgGroup.value;
    return Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
}

// 平滑滾動到底部的輔助函數
function smoothScrollToBottom() {
    if (!rowVirtualizer.value || !msgGroup.value) return;

    const lastIndex = messages.value.length - 1;
    if (lastIndex >= 0) {
        rowVirtualizer.value.value.scrollToIndex(lastIndex, {
            align: "end",
            behavior: "auto",
        });
    }
}

// 平滑滾動到指定索引的輔助函數
function smoothScrollToIndex(index) {
    if (!rowVirtualizer.value || !msgGroup.value) return;

    rowVirtualizer.value.value.scrollToIndex(index, {
        align: "start",
        behavior: "auto",
    });
}

// 乾淨地處理隧道結束，不修改原始訊息數組
function handleTunnelEndCleanly(messagesArray) {
    // 找出隧道訊息的範圍
    const firstTunnelIndex = messagesArray.findIndex((msg) => msg.is_tunnel);
    if (firstTunnelIndex === -1) return messagesArray;

    // 複製訊息數組以避免修改原始數組
    const result = [...messagesArray];

    // 找出所有隧道訊息
    const tunnelMessages = result.filter((msg) => msg.is_tunnel);
    if (tunnelMessages.length === 0) return result;

    // 只保留第一條和最後一條隧道訊息
    const firstTunnelMsg = { ...tunnelMessages[0] };
    const lastTunnelMsg = { ...tunnelMessages[tunnelMessages.length - 1] };

    // 移除隧道標記
    delete firstTunnelMsg.is_tunnel;
    delete lastTunnelMsg.is_tunnel;

    // 從結果中移除所有隧道訊息
    const filteredMessages = result.filter((msg) => !msg.is_tunnel);

    // 加入處理過的首尾隧道訊息
    if (tunnelMessages.length > 0) {
        // 找到適當的位置插入訊息，確保時間順序
        let insertIndex = filteredMessages.findIndex((msg) => msg.time && msg.time > firstTunnelMsg.time);

        if (insertIndex === -1) {
            // 如果沒找到合適位置，添加到末尾
            filteredMessages.push(firstTunnelMsg);
            filteredMessages.push(lastTunnelMsg);
        } else {
            // 按時間順序插入
            filteredMessages.splice(insertIndex, 0, firstTunnelMsg);

            // 為最後一條訊息找位置
            insertIndex = filteredMessages.findIndex((msg) => msg.time && msg.time > lastTunnelMsg.time);

            if (insertIndex === -1) {
                filteredMessages.push(lastTunnelMsg);
            } else {
                filteredMessages.splice(insertIndex, 0, lastTunnelMsg);
            }
        }
    }

    return filteredMessages;
}

// 滾動到QA置頂
async function scrollToQATop() {
    try {
        const lastIndex = messages.value.length - 2;
        if (lastIndex >= 0) {
            // 使用更可靠的滾動方法
            rowVirtualizer.value.value.scrollToIndex(lastIndex, {
                align: "start",
                behavior: "smooth",
            });

            // 等待滾動完成
            await new Promise((resolve) => setTimeout(resolve, 50));

            // 確認滾動位置正確
            const currentItems = rowVirtualizer.value.value.getVirtualItems();
            const isTargetVisible = currentItems.some((item) => item.index === lastIndex);
            if (!isTargetVisible) {
                // 如果目標項不可見，再嘗試一次
                rowVirtualizer.value.value.scrollToIndex(lastIndex, {
                    align: "start",
                    behavior: "auto",
                });
            }
        }
    } catch (error) {
        console.error("Error in scrollToQATop:", error);
    }
}

// 專門用於 handleStreamEnd 的滾動函數
async function scrollToUserQuestionAfterComplete() {
    try {
        // 找到最後的用戶問題
        const lastUserMsgIndex = [...messages.value]
            .reverse()
            .findIndex((msg) => msg.sender === uid.value || msg.sender === chatPartner.value.uid);

        if (lastUserMsgIndex >= 0) {
            // 計算實際索引
            const targetIndex = messages.value.length - 1 - lastUserMsgIndex;
            console.log("After complete: Scrolling to user question at index:", targetIndex);

            // 確保先完成測量
            rowVirtualizer.value?.value.measure();
            await nextTick();

            // 使用絕對定位滾動
            rowVirtualizer.value.value.scrollToIndex(targetIndex, {
                align: "start",
                behavior: "auto", // 使用即時滾動而非平滑滾動
            });
        }
    } catch (error) {
        console.error("Error in scrollToUserQuestionAfterComplete:", error);
    }
}
function updateMessageTimes(userMsgTime, botMsgTime) {
    let reverseMsg = messages.value.slice().reverse();

    let userMsg = reverseMsg.find((f) => f.sender == uid.value);
    if (userMsg) {
        userMsg.time = userMsgTime;
    }
    let botMsg = reverseMsg.find((f) => f.sender == "bot");
    if (botMsg) {
        botMsg.time = botMsgTime;
    }
}

// 更新資料庫中的訊息
async function updateDBMessage(userMsg, userMsgTime, botMsg, botMsgTime, is_tunnel) {
    // 因為是在發送訊息後更新 historyMessagesId，所以這裡拿到的都會是一樣的。
    let saveMsg = {
        roomId: chatPartner.value.roomId,
        userMsg,
        userMsgTime,
        botMsg,
        botMsgTime,
        is_tunnel,
    };

    if (!is_tunnel) {
        saveMsg.history_message_id = historyMessagesId.value;
    }
    axios.post("/bot/saveMessage", JSON.stringify(saveMsg));
    queryEnabled.value = true;
}

function handleTunnelEnd() {
    // 找到第一個隧道訊息的索引
    let firstIndex = messages.value.findIndex((f) => f.is_tunnel);
    if (firstIndex === -1) return;

    // 獲取所有隧道訊息
    let tunnelMsg = messages.value.splice(firstIndex, messages.value.length);

    // 僅保留首尾訊息並移除隧道標記
    let firstMessage = { ...tunnelMsg[0] };
    let lastMessage = { ...tunnelMsg[tunnelMsg.length - 1] };
    delete firstMessage.is_tunnel;
    delete lastMessage.is_tunnel;
    // 更新 pendingMessages，移除所有隧道訊息
    pendingMessages.value = pendingMessages.value.filter((msg) => !msg.is_tunnel);

    // 將首尾訊息添加到 pendingMessages
    if (currentPage.value === 0) {
        pendingMessages.value = [...pendingMessages.value, firstMessage];
    }

    // 更新顯示的訊息
    messages.value = displayMessages.value;
}

function addUserMessage(msg) {
    if (chatPartner.value.partner === "bot") {
        isWelcomeMessageFixed.value = true;

        scrollType.value = 0;
        isUserScrolling.value = false;

        hints.value = [];
        emitter.emit("pushHints", hints.value);

        if (isWaitRes.value) return;

        isProcessingMessage.value = true;
        const currentTime = Date.now();
        const newMessage = {
            sender: uid.value,
            avatar: avatar.value,
            message: {
                data: SymbolConvert(msg.data),
                type: msg.type,
                ...(msg.text ? { text: msg.text } : {}), // 有內容才加 text 這是給 file 用的
            },

            nickname: nickname.value,
            time: currentTime,
            isPending: true,
            messageId: `pending_${currentTime}`,
        };

        if (currentPage.value !== 0) {
            resetHistoryMessages();
        }
        // if (currentPage.value !== 0) {
        //     currentPage.value = 0;
        // }

        pendingMessages.value = [newMessage];
        messages.value = displayMessages.value;
    }
}

async function addHints(msg) {
    hints.value = msg || [];
    emitter.emit("pushHints", hints.value);
}
async function addResultAvatar() {
    messages.value.push({
        sender: "bot",
        avatar: chatPartner.value.avatar,
        message: [],
    });
}

//檢查是否為json字串
function isValidJSON(JsonStr) {
    try {
        const obj = JSON.parse(JsonStr);
        if (typeof obj === "object" && obj) {
            return obj;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

async function updateTunnel(tunnel) {
    // console.log(tunnel);
    // console.log(`tunnel.state: ${tunnel.state}`);
    setLocalTunnel(roomId.value, tunnel);
    switch (tunnel.state) {
        case "start":
        case "QA":
            is_tunnel.value = true;
            break;
        case "filling":
            break;
        case "recheck":
            let lastMsg = messages.value[messages.value.length - 1];
            lastMsg.message.push({ recheck: tunnel.current_form });
            break;
        case "error":
        case "success":
        case "aborted":
            setLocalTunnel(roomId.value, "");
            emitter.emit("clearUploadedFiles");
            is_tunnel.value = false;
            break;
    }
}

async function updateContext(context) {
    setLocalContext(roomId.value, context);
    await axios.put("/bot/context", { roomId: roomId.value, context: JSON.stringify(context) });
}
async function openForm(data) {
    emitter.emit("pushForm", data);
}

const llm_qa_response = ref("");
function resetStreamState() {
    res_msg = "";
    failParseCount = 0;
    search_type = false;
}

async function addResultMessage(msg, is_steaming) {
    if (!msg) return;

    if (messages.value[messages.value.length - 1].sender !== "bot") {
        const newBotMsg = {
            sender: "bot",
            avatar: chatPartner.value.avatar,
            message: [],
            history_message_id: historyMessagesId.value,
        };
        messages.value.push(newBotMsg);
    }

    // 特殊處理: 如果傳入的是已解析好的 JSON 對象
    if (typeof msg === "object" && msg.type === "html_json") {
        // 獲取最後一條機器人訊息
        let lastMsg = messages.value[messages.value.length - 1];

        // 創建並添加 html_json 對象
        const htmlJsonObj = { html_json: msg.data };
        lastMsg.message.push(htmlJsonObj);

        // 直接返回，不需要進一步處理
        return;
    }

    if (Array.isArray(msg) && msg[0].action === "skill") {
        // 獲取最後一條機器人訊息
        let lastMsg = messages.value[messages.value.length - 1];

        // // 創建並添加 html_json 對象
        const htmlJsonObj = { data: msg[0].text };
        lastMsg.message.push(htmlJsonObj);
        return;
    }

    // 現在可以安全地獲取最後一條訊息
    let lastMsg = messages.value[messages.value.length - 1];
    let lastMessage = lastMsg.message[lastMsg.message.length - 1];

    msg = res_msg + msg;

    // 嘗試解析 JSON
    if (isValidJSON(msg)) {
        search_type = true;
        msg = isValidJSON(msg) || msg;
        res_msg = "";
        failParseCount = 0;
        search_type = true;
    } else if (search_type) {
        msg = isValidJSON(msg) || msg;
    } else {
        console.log("can't msg ", msg);

        // ✅ 若是新的 JSON 起頭但有殘留，則清除殘留
        if (res_msg && msg.trim().startsWith("{")) {
            console.warn("偵測到新訊息起頭但有舊資料殘留，清空 res_msg");
            res_msg = "";
            failParseCount = 0;
        }

        // ✅ 若太長則清空以防炸掉
        if (res_msg.length + msg.length > MAX_RES_MSG_LENGTH) {
            console.warn("res_msg 過長，自動清空避免爆炸");
            res_msg = "";
            failParseCount = 0;
            search_type = false;
            return;
        }

        // ✅ 若錯誤次數過多則清空
        failParseCount++;
        if (failParseCount > MAX_FAIL_PARSE) {
            console.warn("已累積超過 50 次無法解析，自動清空 res_msg");
            res_msg = "";
            failParseCount = 0;
            search_type = false;
            return;
        }

        res_msg += msg;
        search_type = false;
        return;
    }

    if (msg.type) {
        let obj = {};
        obj[msg.type] = "";
        targetType = msg.type;
        targetCom = "";

        switch (msg.type) {
            case "data":
            case "card":
            case "more_component":
                console.log("msg.type: ", msg);
                lastMsg.message.push(obj);
                lastMessage = lastMsg.message[lastMsg.message.length - 1];
                break;
            case "html_json": // 處理新的 html_json 類型
                if (msg.data && Array.isArray(msg.data)) {
                    // 直接使用傳入的數據
                    const htmlJsonObj = { html_json: msg.data };
                    lastMsg.message.push(htmlJsonObj);
                    lastMessage = lastMsg.message[lastMsg.message.length - 1];
                } else {
                    // 創建一個空的 html_json 陣列
                    const htmlJsonObj = { html_json: [] };
                    lastMsg.message.push(htmlJsonObj);
                    lastMessage = lastMsg.message[lastMsg.message.length - 1];
                }
                break;
            case "source_chunk":
                if (show_source_chunk.value == 1) {
                    lastMsg.message.push(obj);
                    lastMessage = lastMsg.message[lastMsg.message.length - 1];
                }
                break;
            case "extra_chunk":
                if (show_extra_chunk.value == 1) {
                    lastMsg.message.push(obj);
                    lastMessage = lastMsg.message[lastMsg.message.length - 1];
                }
                break;
            case "image":
            case "charts_line":
            case "charts_stacked":
            case "iframe":
            case "charts":
                lastMsg.message.push(obj);
                lastMessage = lastMsg.message[lastMsg.message.length - 1];
                lastMessage[msg.type] = msg.data;
                break;
            case "form":
                openForm(msg.data);
                break;
            case "hint":
                addHints(msg.data);
                break;
            case "tunnel":
            case "llm_qa_response":
                //需要分兩次傳 不須渲染
                break;
            case "html_iframe":
                break;
            case "context":
                updateContext(msg.data);
                break;
        }
    } else {
        if (targetType === "data") {
            lastMessage[targetType] += msg;

            if (!is_steaming) {
                search_type = false;
                res_msg = "";
                failParseCount = 0;
            }
        } else if (targetType === "hmi") {
            if (msg === "-1") {
                historyMessagesId.value = undefined;
            } else {
                historyMessagesId.value = msg;
            }
        } else if (targetType === "llm_qa_response") {
            console.log("llm_qa_response: ", msg);
            llm_qa_response.value = msg;
        } else if (targetType === "html_json") {
            // 處理 html_json 數據

            // 如果 targetCom 尚未初始化為字符串，先初始化它
            if (!targetCom) targetCom = "";

            if (typeof msg === "object") {
                try {
                    // 確保對象被正確轉換為 JSON 字符串
                    targetCom += JSON.stringify(msg);
                } catch (e) {
                    console.error("無法將對象轉換為 JSON:", e);
                    // 可能需要處理錯誤情況
                }
            } else {
                targetCom += msg;
            }

            if (isValidJSON(targetCom)) {
                const htmlJsonData = isValidJSON(targetCom);

                // 確保 lastMessage.html_json 是陣列
                if (!lastMessage.html_json) {
                    lastMessage.html_json = [];
                }

                // 如果解析的數據是陣列，就合併；如果是單個對象，就添加到陣列
                if (Array.isArray(htmlJsonData)) {
                    lastMessage.html_json = [...lastMessage.html_json, ...htmlJsonData];
                } else {
                    lastMessage.html_json.push(htmlJsonData);
                }

                // 重置 targetCom
                targetCom = "";
            }
        } else {
            if (typeof msg === "object") {
                targetCom += JSON.stringify(msg);
            } else {
                targetCom += msg;
            }

            if (isValidJSON(targetCom)) {
                targetCom = isValidJSON(targetCom);

                switch (targetType) {
                    case "tunnel":
                        updateTunnel(targetCom);
                        break;
                    case "html_iframe":
                        emitter.emit("iframe_message", { autofill: targetCom });
                        break;
                    default:
                        if (lastMessage !== undefined) {
                            if (targetType !== "source_chunk" || lastMessage.source_chunk !== undefined) {
                                lastMessage[targetType] = targetCom;
                            }
                        }
                        break;
                }

                lastMsg["history_message_id"] = historyMessagesId.value;
                targetCom = "";
            }
        }

        if (!isUserScrolling.value || scrollType.value === 2) {
            const now = Date.now();
            if (now - lastScrollTime.value > 100) {
                scrollToQATop();
                lastScrollTime.value = now;
            }
        }
    }
}

//複製功能
// 引入 Markdown 處理功能
const {
    containsMarkdown,
    copyText,
    copyMarkdown,
    batchDetectMarkdown,
    clearMarkdownCache,
    copyIndex,
    markdownCopyIndex,
} = useChatMarkdown();

async function retryText(event, index) {
    if (messages.value[index - 1].message.type === "text") {
        emitter.emit("pushData", { data: messages.value[index - 1].message.data, type: "text" });
    } else {
        emitter.emit("openSnackbar", {
            message: "發生錯誤，請重新輸入並發送訊息",
            type: "error",
        });
    }
}

// 計算公告的高度
const calculatedPadding = computed(() => {
    return `calc(1em + ${bulletinHeight.value}px)`;
});

async function fetchExistingFeedback(feedbackId, callback) {
    const expertId = chatPartner.value.expertId;
    const userId = uid.value;
    const userType = "user";
    try {
        const response = await axios.get(`/feedback/${feedbackId}`, { params: { expertId, userId, userType } });

        callback({
            feedbackOptionsIds: response.data.data.feedbackOptionsIds,
            comment: response.data.data.comment,
            feedbackType: response.data.data.feedbackType,
        });
    } catch (error) {
        console.error("Error fetching feedback:", error);
        return null;
    }
}

const rowVirtualizer = ref(null);
const isVirtualizerEnabled = ref(true);

function initializeVirtualizer() {
    rowVirtualizer.value = useVirtualizer({
        count: messages.value.length,
        getScrollElement: () => msgGroup.value,
        estimateSize: () => 100,
        overscan: 7,
        paddingStart: 8,
        paddingEnd: 8,
        enabled: isVirtualizerEnabled.value,
        scrollBehavior: "auto",

        measureElement: (el) => {
            if (!el) return 100;
            return el.offsetHeight;
        },
    });
}

const virtualRows = computed(() => {
    if (!rowVirtualizer.value || !messages.value.length) return [];
    return rowVirtualizer.value.value.getVirtualItems().filter((row) => row.index < messages.value.length);
});

const totalSize = computed(() => {
    if (!rowVirtualizer.value || !messages.value.length) return 0;
    return rowVirtualizer.value.value.getTotalSize();
});

watch([() => messages.value.length], async ([newLength], [oldLength]) => {
    if (!rowVirtualizer.value) return;

    const { isNearBottom } = checkScrollPosition();

    isVirtualizerEnabled.value = false;
    // 保留所有原始選項並只更新 count
    rowVirtualizer.value.value.setOptions({
        ...rowVirtualizer.value.value.options, // 保留所有原始選項
        count: newLength,
    });
    // rowVirtualizer.value.value.measure();
    // console.log("rowVirtualizer.value: ", rowVirtualizer.value.value);
    // rowVirtualizer.value.
    // rowVirtualizer.value = useVirtualizer({
    //     count: newLength,
    //     getScrollElement: () => msgGroup.value,
    //     estimateSize: () => 100,
    //     overscan: 7,
    //     paddingStart: 8,
    //     paddingEnd: 8,
    //     enabled: true,

    //     measureElement: (el) => {
    //         if (!el) return 100;
    //         return el.offsetHeight;
    //     },
    // });

    isVirtualizerEnabled.value = true;

    if (isNearBottom && newLength > oldLength) {
        await nextTick();
        scrollBottom("auto");
    }
});

const forceRefreshFirstPage = async () => {
    try {
        // 保存當前頁面和滾動位置

        const currentScrollTop = msgGroup.value?.scrollTop || 0;

        // 重置為第0頁
        currentPage.value = 0;

        // 清除當前頁面的查詢緩存
        await queryClient.invalidateQueries({
            queryKey: ["messages", currentRoomId.value, 0],
        });

        // 直接獲取第0頁數據
        const response = await axios.post(
            "/bot/message",
            JSON.stringify({
                roomId: currentRoomId.value,
                pageSize: PAGE_SIZE,
                page: 0,
            })
        );

        // 手動處理返回的數據
        const newPageData = {
            messages: response.data.data.chat || [],
            hasMore: response.data.data.hasMore,
            totalCount: response.data.data.totalCount,
        };

        // 更新 queryClient 的緩存
        queryClient.setQueryData(["messages", currentRoomId.value, 0], newPageData);

        // 轉換訊息格式
        const convertedMessages = MsgConvertRender(newPageData.messages);

        // 替換訊息列表
        allHistoryMessages.value = convertedMessages;
        messages.value = displayMessages.value;

        // 等待 DOM 更新後
        await nextTick();

        // 更新虛擬列表
        if (rowVirtualizer.value) {
            rowVirtualizer.value.value.measure();
        }

        // 恢復原始頁面和滾動位置
        if (currentPage > 0) {
            currentPage.value = currentPage;

            // 等待頁面切換完成
            await nextTick();

            // 恢復滾動位置
            if (msgGroup.value) {
                msgGroup.value.scrollTop = currentScrollTop;
            }
        }
    } catch (error) {
        console.error("強制刷新頁面失敗:", error);
    }
};

function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s，。！？、：""''「」【】（）\[\]{}]*)/g;
    const matches = text.match(urlRegex);
    if (!matches || matches.length === 0) return null;

    let url = matches[0];

    try {
        const parsedUrl = new URL(url);

        // 解碼 URL，避免中文字變成 %E6%AA%A2%E8%88%89
        let decodedPath = decodeURIComponent(parsedUrl.pathname);

        // 找到第一個中文字並移除後面的部分
        const chineseCharRegex = /[\u4e00-\u9fa5]/;
        const chineseIndex = decodedPath.search(chineseCharRegex);
        if (chineseIndex !== -1) {
            decodedPath = decodedPath.substring(0, chineseIndex);
        }

        // 重新編碼，確保不影響原本的 URL
        const finalPath = encodeURI(decodedPath);

        return `${parsedUrl.origin}${finalPath}${parsedUrl.search}${parsedUrl.hash}`;
    } catch (error) {
        return url;
    }
}

// 監聽虛擬列表的變化，重新綁定資料來源中圈圈按鈕的事件
watch(
    () => virtualRows.value,
    async () => {
        await bindMarkedHtmlButtonEvents(mkdRef);
    },
    { deep: true }
);
</script>

<template>
    <div class="msgGroupBox" :style="{ paddingBottom: inputMessageHeight }">
        <transition name="floating-date" @leave="handleLeave" @enter="handleEnter">
            <FloatingDateDisplay
                v-if="showFloatingDate"
                :messages="messages"
                :virtualRows="virtualRows"
            ></FloatingDateDisplay>
        </transition>
        <Teleport to="body">
            <vue-easy-lightbox
                :visible="lightboxVisible"
                :imgs="lightboxImages"
                :index="lightboxIndex"
                @hide="closeLightbox"
            ></vue-easy-lightbox>
        </Teleport>

        <div class="bot_form">
            <FormComponents></FormComponents>
        </div>

        <!-- <SearchBar :messages="messages" :virtualizer="rowVirtualizer" /> -->

        <div
            class="msgGroup min-h-[300px]"
            ref="msgGroup"
            :style="{
                fontSize: chatFontSize + 'px',
                paddingTop: calculatedPadding,
                willChange: 'transform',
            }"
        >
            <Loader2Icon class="mx-auto mb-2 w-8 h-8 animate-spin" v-if="isPlaceholderData || isLoading" />

            <div
                :style="{
                    height: `${totalSize}px`,
                    width: '100%',
                    position: 'relative',
                }"
            >
                <div
                    v-for="virtualRow in virtualRows"
                    :key="virtualRow.key"
                    :data-index="virtualRow.index"
                    :ref="(el) => rowVirtualizer.value?.measureElement(el)"
                    :style="{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                    }"
                    :class="{ 'active-pointer': virtualRow.index >= messages.length - 2 }"
                >
                    <div
                        class="msgBox"
                        :class="{
                            tunnel_layer: messages[virtualRow.index].is_tunnel,
                            'flex justify-end flex-row-reverse':
                                messages[virtualRow.index].sender !== 'bot' && conversation_direction === 'right',
                        }"
                    >
                        <div class="flex items-center mr-4 ml-4" v-if="isLoading">
                            <Skeleton class="h-12 w-12 rounded-full bg-[var(--chatbox-user-bg-color)]" />
                        </div>
                        <div class="userInfo" v-else>
                            <img :src="messages[virtualRow.index].avatar" alt="avatar" />
                        </div>

                        <div
                            class="msg"
                            :class="
                                messages[virtualRow.index].sender !== 'bot' && conversation_direction === 'right'
                                    ? 'flex flex-col items-end'
                                    : ''
                            "
                        >
                            <!-- User Messages -->
                            <template v-if="messages[virtualRow.index].sender !== 'bot'">
                                <template v-if="isLoading">
                                    <div class="flex items-center space-x-4">
                                        <div class="space-y-2">
                                            <Skeleton class="h-4 w-[250px] bg-[var(--chatbox-user-bg-color)]" />
                                            <Skeleton class="h-4 w-[200px] bg-[var(--chatbox-user-bg-color)]" />
                                        </div>
                                    </div>
                                </template>

                                <template v-else>
                                    <div class="msgUserInfo">
                                        <p class="userName">{{ messages[virtualRow.index].nickname }}</p>
                                        <p v-if="messages[virtualRow.index].time" class="time">
                                            {{ timeFormat(messages[virtualRow.index].time) }}
                                        </p>
                                    </div>
                                    <div
                                        class="text user text-[var(--chatbox-user-text-color)] bg-[var(--chatbox-user-bg-color)] max-w-[80%] inline-block px-4 py-2 rounded-2xl break-words"
                                        v-if="messages[virtualRow.index].message.type == 'text'"
                                    >
                                        <template
                                            v-for="(part, index) in messages[virtualRow.index].message.data"
                                            :key="index"
                                        >
                                            <p class="part" v-if="part">{{ part }}</p>
                                        </template>
                                    </div>
                                    <div
                                        v-if="messages[virtualRow.index].message.type == 'document_qa_tunnel'"
                                        class="flex flex-col"
                                        :class="conversation_direction == 'right' ? 'items-end' : 'items-start'"
                                    >
                                        <FileMessageComponent :files="messages[virtualRow.index].message.data" />
                                        <div
                                            v-if="messages[virtualRow.index].message.text"
                                            class="text user text-[var(--chatbox-user-text-color)] bg-[var(--chatbox-user-bg-color)] max-w-[100%] inline-block px-4 py-2 rounded-2xl break-words"
                                        >
                                            <template
                                                v-for="(part, index) in messages[virtualRow.index].message.text"
                                                :key="index"
                                            >
                                                <p class="part" v-if="part">{{ part }}</p>
                                            </template>
                                        </div>
                                    </div>
                                </template>
                            </template>

                            <!-- Bot Messages -->
                            <div v-else>
                                <div
                                    v-if="virtualRow.index === messages.length - 1 && isWaitRes"
                                    class="wait_res"
                                ></div>
                                <div class="flex items-center space-x-4" v-if="isLoading">
                                    <div class="space-y-2">
                                        <Skeleton class="h-4 w-[250px] bg-[var(--chatbox-user-bg-color)]" />
                                        <Skeleton class="h-4 w-[200px] bg-[var(--chatbox-user-bg-color)]" />
                                    </div>
                                </div>
                                <div
                                    v-for="item1 in messages[virtualRow.index].message"
                                    :key="item1"
                                    :class="`messages-item-${virtualRow.index}`"
                                    v-else
                                >
                                    <div
                                        class="text bot text-[var(--chatbox-robot-text-color)] bg-[var(--chatbox-robot-bg-color)] max-w-[80%] inline-block px-4 py-2 rounded-2xl break-words"
                                        v-if="item1.data"
                                    >
                                        <div ref="mkdRef" class="mkd" v-dompurify-html="markedHTML(item1.data)"></div>
                                        <div class="relative">
                                            <div
                                                class="flex space-x-2 copy"
                                                v-if="
                                                    chatPartner.partner == 'bot' &&
                                                    messages[virtualRow.index].sender === 'bot' &&
                                                    !isWaitRes
                                                "
                                            >
                                                <FeedbackDialog
                                                    :item="messages[virtualRow.index]"
                                                    :feedbackOptions="feedbackOptions"
                                                    @feedbackSubmitted="handleFeedback"
                                                    @fetchFeedback="fetchExistingFeedback"
                                                />

                                                <TooltipProvider
                                                    :delayDuration="100"
                                                    v-if="containsMarkdown(item1.data)"
                                                >
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <p v-if="virtualRow.index == markdownCopyIndex">
                                                                <i class="fa-solid fa-check icon-size"></i>
                                                            </p>
                                                            <p
                                                                v-else-if="containsMarkdown(item1.data)"
                                                                @click="
                                                                    copyMarkdown($event, virtualRow.index, messages)
                                                                "
                                                                :data-markdown-content="item1.data"
                                                                class="text-gray-500 hover:text-yellow-500"
                                                            >
                                                                <i class="fa-brands fa-markdown"></i>
                                                            </p>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>複製 Markdown 格式</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>

                                                <TooltipProvider :delayDuration="100">
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <p v-if="virtualRow.index == copyIndex">
                                                                <i class="fa-solid fa-check icon-size"></i>
                                                            </p>
                                                            <p
                                                                v-else
                                                                @click="copyText($event, virtualRow.index)"
                                                                class="text-gray-500 hover:text-yellow-500"
                                                            >
                                                                <i class="fa-regular fa-clone fa-rotate-180"></i>
                                                            </p>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>複製回覆內容</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <TooltipProvider :delayDuration="100">
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <p
                                                                v-if="
                                                                    messages[virtualRow.index].history_message_id &&
                                                                    !messages[virtualRow.index].feedback_id
                                                                "
                                                                @click="retryText($event, virtualRow.index)"
                                                                class="text-gray-500 hover:text-yellow-500"
                                                            >
                                                                <i class="fa-solid fa-sync"></i>
                                                            </p>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>再試一次</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <div
                                                v-if="messages[virtualRow.index].time"
                                                :style="{
                                                    position: 'absolute',
                                                    bottom: '-0.8rem',
                                                    right:
                                                        timeFormat(messages[virtualRow.index].time).length > 15
                                                            ? '-5.35rem'
                                                            : timeFormat(messages[virtualRow.index].time).length > 5
                                                            ? '-4rem'
                                                            : '-2.5rem',
                                                    fontSize: '0.5rem',
                                                    color: '#aaaaaa',
                                                }"
                                            >
                                                {{ timeFormat(messages[virtualRow.index].time) }}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- 其他訊息類型元件 -->
                                    <div
                                        v-else-if="item1.card"
                                        class="bot_card last-use"
                                        :class="{ wait_use: isWaitRes }"
                                    >
                                        <div class="mkd">
                                            <p
                                                style="margin-bottom: 5px"
                                                v-if="item1.card.return_message"
                                                :class="item1.card.return_message.color"
                                            >
                                                {{ item1.card.return_message.text }}
                                            </p>
                                        </div>
                                        <CardsComponents :data="item1.card"></CardsComponents>
                                    </div>

                                    <div v-else-if="item1.image" class="bot_img last-use">
                                        <img
                                            :src="item1.image.src"
                                            :alt="item1.image.alt"
                                            :title="item1.image.title"
                                            loading="lazy"
                                        />
                                    </div>

                                    <div
                                        v-else-if="item1.charts_line"
                                        class="bot_charts last-use"
                                        :class="{ wait_use: isWaitRes }"
                                    >
                                        <EchartsLineComponents :data="item1.charts_line"></EchartsLineComponents>
                                    </div>

                                    <div
                                        v-else-if="item1.charts_stacked"
                                        class="bot_charts last-use"
                                        :class="{ wait_use: isWaitRes }"
                                    >
                                        <EchartsStackedComponents
                                            :data="item1.charts_stacked"
                                        ></EchartsStackedComponents>
                                    </div>

                                    <div
                                        v-else-if="item1.iframe"
                                        class="bot_charts last-use"
                                        :class="{ wait_use: isWaitRes }"
                                    >
                                        <IframeComponent :data="item1.iframe"></IframeComponent>
                                    </div>

                                    <div
                                        v-else-if="item1.charts"
                                        class="bot_charts last-use"
                                        :class="{ wait_use: isWaitRes }"
                                    >
                                        <EchartsComponents :data="item1.charts"></EchartsComponents>
                                    </div>

                                    <div
                                        v-else-if="item1.more_component"
                                        class="last_show"
                                        style="margin: 1rem 0"
                                        :class="{ wait_use: isWaitRes }"
                                    >
                                        <ExpandableQaComponent :data="item1.more_component"></ExpandableQaComponent>
                                    </div>

                                    <div v-else-if="item1.recheck">
                                        <RecheckComponents :data="item1.recheck"></RecheckComponents>
                                    </div>

                                    <div v-else-if="item1.html_json" class="last-use">
                                        <HtmlJsonComponents :data="item1.html_json"></HtmlJsonComponents>
                                    </div>

                                    <div
                                        v-else-if="
                                            item1.source_chunk &&
                                            item1.source_chunk.length !== 0 &&
                                            show_source_chunk == 1
                                        "
                                    >
                                        <SourceChunkDrawer
                                            :data="item1.source_chunk"
                                            :sourceChunkMode="sourceChunkMode"
                                            :isMember="true"
                                        ></SourceChunkDrawer>
                                    </div>

                                    <div
                                        v-else-if="
                                            item1.extra_chunk && item1.extra_chunk.length !== 0 && show_extra_chunk == 1
                                        "
                                    >
                                        <ExtraChunkComponents :data="item1.extra_chunk"></ExtraChunkComponents>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.msgGroupBox {
    height: 100%;
    padding-top: 3rem;

    .last-use {
        pointer-events: none;

        :deep(.file-translation-upload) {
            opacity: 0.7;
            filter: grayscale(60%);
            position: relative;
        }

        :deep(.translation-success) {
            pointer-events: auto;
        }

        :deep(.tip) {
            pointer-events: auto;
        }
    }

    .active-pointer .msgBox .msg .last-use {
        pointer-events: auto !important;

        :deep(.file-translation-upload) {
            opacity: 1;
            filter: grayscale(0%);
            position: relative;
        }
    }

    .msgGroup {
        width: 100%;
        padding-top: 2rem;
        height: 100%;
        overflow-y: scroll;

        overflow-x: hidden;
        overscroll-behavior: contain;

        transition: 0.3s;
        contain: strict;
        -webkit-overflow-scrolling: touch;

        .msgBox {
            padding-bottom: 1rem;
            display: flex;
            align-items: flex-start;
            margin: 0 auto;
            max-width: 768px;
            contain: content;
            backface-visibility: hidden;
            .userInfo {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 0.8rem;
                padding-top: 0.1rem;

                img {
                    width: 2rem;
                    height: 2rem;
                    border-radius: 50%;
                    object-fit: cover;
                    background-color: white;
                }
            }

            .msg {
                color: var(--chat-text-color);
                line-height: 1.2rem;
                width: calc(100% - 3.6rem);
                padding-right: 1rem;

                .msgUserInfo {
                    display: flex;

                    .userName {
                        margin-right: 0.3rem;
                        font-size: 0.7rem;
                        font-weight: bold;
                        color: var(--chat-text-color);
                    }

                    .time {
                        font-size: 0.5rem;
                        color: #aaaaaa;

                        img {
                            width: 0.5rem;
                            height: 0.5rem;
                        }
                    }
                }

                .bot {
                    // margin-bottom: 1.5rem;
                }

                .text {
                    /* word-break: break-all; */
                    overflow-wrap: break-word;
                    margin-bottom: 2rem;

                    .part {
                        display: inline;
                    }
                }

                .copy {
                    min-width: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: end;
                    margin: 0.3rem 0;
                    color: gray;
                    pointer-events: auto;
                    position: absolute;
                    right: -10px;
                    top: 5px;
                    p {
                        cursor: pointer;
                        right: 0;
                        top: 0;
                        display: flex;
                        justify-content: center;
                    }
                }

                .bot_card {
                    margin-bottom: 1.5rem;
                }

                .bot_img {
                    width: 100%;
                    border-radius: 0.5rem;
                    overflow: hidden;
                    margin-bottom: 1.5rem;

                    img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        display: block;
                    }
                }

                .bot_charts {
                    margin-bottom: 1.5rem;
                }

                .last_show {
                    // max-height: 0;
                    // overflow-y: hidden;
                    // transition: 1s;
                    // display: none;
                }
            }

            .wait_res {
                background: url("../assets/dots.gif") no-repeat center;
                background-size: 80% auto;
                background-color: white;
                width: 2rem;
                height: 1.2rem;
                border-radius: 1rem;
                overflow: hidden;
                margin-top: 0.5rem;
                margin-bottom: 0.5rem;
            }

            &:last-child {
                .wait_use {
                    pointer-events: none;
                }
            }
        }

        .tunnel_layer {
            background-color: var(--theme-color-20);
            margin-top: 1px;
        }
    }
}

:deep(.mkd a.link-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(0, 0, 0, 0.1);
    text-decoration: underline;
    &:hover {
        opacity: 0.8;
    }
}

:deep(.mkd button.link-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(0, 0, 0, 0.1);
    text-decoration: underline;
    &:hover {
        opacity: 0.8;
    }
}

:deep(.mkd span.link-btn) {
    border: 1px solid rgba(0, 0, 0, 0.1);
    user-select: none;
}

:deep(.link-btn.number-btn) {
    color: var(--chatbox-robot-btn-text-color);
    background-color: var(--chatbox-robot-btn-bg-color);

    display: inline-flex;
    vertical-align: middle;
    width: 20px;
    height: 20px;
    justify-content: center;
    align-items: center;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    margin: 0 2px;
}

:deep(.link-btn.long-link-btn) {
    color: var(--chatbox-robot-long-btn-text-color);
    background-color: var(--chatbox-robot-long-btn-bg-color);

    display: inline-flex;
    vertical-align: middle;
    padding: 2px 8px;
    border-radius: 6px !important;
    font-size: 0.75rem;
    font-weight: 500;
    margin: 0 2px;
}
.icon-size {
    width: 16px;
    height: 16px;
}
</style>
