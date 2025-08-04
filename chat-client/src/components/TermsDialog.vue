<script setup>
import { ref, computed, onMounted, inject, watch } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import DOMPurify from "dompurify";
import { AlertCircleIcon, Loader2 } from "lucide-vue-next";
import { marked } from "marked";
import { storeToRefs } from "pinia";
import { useApiStatusStore, useTermsStore, useSettingsStore, useSystemStore, useStateStore } from "@/store/index";
import { Teleport } from "vue";
const apiStatusStore = useApiStatusStore();
const termsStore = useTermsStore();
const settingsStore = useSettingsStore();
const systemStore = useSystemStore();
const stateStore = useStateStore();
const { showExpertAccessRestricted } = storeToRefs(stateStore);
const { isIframe, isKaohsiungEnv } = systemStore;
const axios = inject("axios");
const emitter = inject("emitter");

// Props
const props = defineProps({
    onComplete: {
        type: Function,
        default: () => {},
    },
});

// 狀態管理
const isOpen = ref(false);
const agreed = ref(false);
const currentIndex = ref(0);
const announcements = ref([]);
const isLoading = ref(false);
const bulkConfirm = ref(false);
const acknowledgedTerms = ref(new Set()); // 追蹤已經確認過的條款ID，僅用於高雄環境
const isTermsAcknowledged = ref(false); // 標記條款是否已確認過，僅用於高雄環境

// 計算屬性
const filteredAnnouncements = computed(() => {
    const terms = announcements.value.filter((a) => a.type === "TERMS");
    if (terms.length === 0) {
        return announcements.value.filter((a) => a.type !== "TERMS");
    }
    return terms;
});

const currentAnnouncement = computed(() => filteredAnnouncements.value[currentIndex.value] || null);

const shouldShowBulkConfirm = computed(() => {
    return filteredAnnouncements.value.length > 1 && !filteredAnnouncements.value.some((a) => a.type === "TERMS");
});

// 方法
const getAnnouncementTypeText = (type) => {
    const types = {
        TERMS: "使用說明",
        NOTICE: "公告訊息",
        MAINTENANCE: "維護通知",
    };
    return types[type] || "公告訊息";
};

const handleAction = async () => {
    // 對於高雄環境的已確認條款，點擊"我知道了"直接關閉對話框
    if (
        isKaohsiungEnv &&
        currentAnnouncement.value &&
        currentAnnouncement.value.type === "TERMS" &&
        isTermsAcknowledged.value
    ) {
        isOpen.value = false;
        props.onComplete?.();
        return;
    }

    if (bulkConfirm.value) {
        await handleBulkConfirm();
    } else {
        await handleConfirm();
    }
};

function showMsg(msg) {
    const html = `<div class='error' style='color:red'>${msg}</div>`;
    return `{ "type": "data" }</end>${html}</end>`;
}

const handleCancel = () => {
    if (isKaohsiungEnv) {
        // 對於高雄環境，顯示重定向彈窗
        showRedirectModel.value = true;
    } else {
        // 非高雄環境，關閉對話框並顯示提示訊息
        isOpen.value = false;
        emitter.emit("writeChatBot", {
            msg: { data: showMsg(marked(settingsStore.agreement_alert)) },
        });
    }
};

const handleConfirm = async () => {
    try {
        isLoading.value = true;

        const acknowledgeResponse = await axios.post(`/system/acknowledgeAnnouncement/${currentAnnouncement.value.id}`);

        // 在高雄環境中處理條款確認
        if (isKaohsiungEnv) {
            if (currentAnnouncement.value.type === "TERMS") {
                // 更新狀態
                acknowledgedTerms.value.add(currentAnnouncement.value.id);
                isTermsAcknowledged.value = true;
                agreed.value = true;

                // 檢查是否有下一則條款
                if (
                    filteredAnnouncements.value.length > 1 &&
                    currentIndex.value < filteredAnnouncements.value.length - 1
                ) {
                    // 如果有下一則條款，切換到下一則
                    currentIndex.value += 1;
                    // 重置確認狀態為初始狀態
                    isTermsAcknowledged.value = false;
                    agreed.value = false;

                    // 檢查下一則條款是否已確認過
                    const nextAnnouncementId = filteredAnnouncements.value[currentIndex.value].id;
                    if (acknowledgedTerms.value.has(nextAnnouncementId)) {
                        isTermsAcknowledged.value = true;
                        agreed.value = true;
                    }
                    return;
                }
            } else if (currentAnnouncement.value.type === "NOTICE") {
                // 處理公告類型，確認後直接關閉對話框或顯示下一則
                if (
                    filteredAnnouncements.value.length > 1 &&
                    currentIndex.value < filteredAnnouncements.value.length - 1
                ) {
                    // 有下一則公告，切換到下一則
                    currentIndex.value += 1;
                    return;
                }
            }

            // 如果沒有下一則或已經是最後一則，重新獲取待確認公告
            const response = await axios.get("/system/checkPendingAnnouncements");
            if (response.data.code === 0) {
                currentIndex.value = 0;
                announcements.value = response.data.data.announcements || [];
                agreed.value = false;

                if (!announcements.value.length) {
                    isOpen.value = false;
                    props.onComplete?.();
                }
            }
        } else {
            // 非高雄環境，執行標準確認流程
            if (!acknowledgeResponse.data.data.hasPending) {
                // 如果沒有未確認的條款，就送出對話訊息
                if (termsStore.pendingMessage) {
                    emitter.emit("pushData", { data: termsStore.pendingMessage, type: "text" });
                }
            }

            const response = await axios.get("/system/checkPendingAnnouncements");
            if (response.data.code === 0) {
                currentIndex.value = 0;
                announcements.value = response.data.data.announcements || [];
                agreed.value = false;

                if (!announcements.value.length) {
                    isOpen.value = false;
                    props.onComplete?.();
                }
            }
        }
    } catch (error) {
        console.error("確認公告失敗:", error);
    } finally {
        isLoading.value = false;

        // 只在非高雄環境時執行這個邏輯
        if (!isKaohsiungEnv && !announcements.value.length) {
            // 如果沒有需要確認的公告了
            isOpen.value = false;
            props.onComplete?.();

            // 更新狀態
            termsStore.setTermsAccepted(true);

            if (termsStore.pendingMessage) {
                emitter.emit("pushDataAfterTerms", termsStore.pendingMessage);
                termsStore.clearPendingMessage();
            }
        }
    }
};

const handleBulkConfirm = async () => {
    try {
        isLoading.value = true;
        const announcementIds = filteredAnnouncements.value.map((a) => a.id);

        await axios.post("/system/acknowledgeAnnouncements", {
            announcementIds,
        });

        const response = await axios.get("/system/checkPendingAnnouncements");
        if (response.data.code === 0) {
            announcements.value = response.data.data.announcements || [];
            currentIndex.value = 0;
            bulkConfirm.value = false;

            if (!announcements.value.length) {
                isOpen.value = false;
                props.onComplete?.();
            }
        }
    } catch (error) {
        console.error("批量確認公告失敗:", error);
    } finally {
        isLoading.value = false;
        if (!announcements.value.length) {
            // 如果沒有需要確認的公告了
            isOpen.value = false;
            props.onComplete?.();

            // 更新狀態
            termsStore.setTermsAccepted(true);

            if (termsStore.pendingMessage) {
                emitter.emit("pushDataAfterTerms", termsStore.pendingMessage);
                termsStore.clearPendingMessage();
            }
        }
    }
};

const checkPendingAnnouncements = async ({ isSendMsg = false } = {}) => {
    try {
        // 高雄環境下的特殊處理：獲取所有公告
        if (isKaohsiungEnv && !isSendMsg) {
            try {
                // 先獲取所有可能的公告
                const pendingResponse = await axios.get("/system/checkPendingAnnouncements");
                const allAnnouncements = pendingResponse.data.data.announcements || [];
                // 再獲取已確認狀態
                const termsResponse = await axios.get("/system/announcements");
                const allTerms = termsResponse.data.data.terms || [];

                // 查找條款類型的公告
                const termsAnnouncements = allAnnouncements.filter((a) => a.type === "TERMS");

                // 查找非條款公告（如一般公告）
                const otherAnnouncements = allAnnouncements.filter((a) => a.type !== "TERMS");

                // 記錄已確認的條款ID
                acknowledgedTerms.value.clear();
                for (const term of allTerms) {
                    if (term.agreed) {
                        acknowledgedTerms.value.add(term.id);
                    }
                }

                // 如果在過濾後的公告中沒有找到條款，但在 terms API 中找到了
                if (termsAnnouncements.length === 0 && allTerms.length > 0) {
                    // 構建條款公告對象列表
                    const fakeTermAnnouncements = allTerms.map((term) => ({
                        id: term.id,
                        title: term.title,
                        content: term.content,
                        type: "TERMS",
                        use_markdown: term.use_markdown,
                        require_agreement: true,
                    }));

                    // 強制顯示所有條款
                    announcements.value = fakeTermAnnouncements;

                    // 檢查第一個條款是否已確認
                    if (
                        fakeTermAnnouncements[0] &&
                        allTerms.some((t) => t.id === fakeTermAnnouncements[0].id && t.agreed)
                    ) {
                        isTermsAcknowledged.value = true;
                        agreed.value = true;
                    } else {
                        isTermsAcknowledged.value = false;
                        agreed.value = false;
                    }

                    currentIndex.value = 0;
                    isOpen.value = true;
                    return true;
                } else if (termsAnnouncements.length > 0) {
                    // 有條款，檢查其確認狀態
                    currentIndex.value = 0;

                    // 檢查第一個條款是否已確認
                    if (termsAnnouncements[0] && allTerms.some((t) => t.id === termsAnnouncements[0].id && t.agreed)) {
                        isTermsAcknowledged.value = true;
                        agreed.value = true;
                    } else {
                        isTermsAcknowledged.value = false;
                        agreed.value = false;
                    }

                    // 強制顯示條款
                    announcements.value = termsAnnouncements;
                    isOpen.value = true;
                    return true;
                } else if (otherAnnouncements.length > 0) {
                    // 有非條款的公告，直接顯示所有公告
                    // 這個改動是關鍵：直接使用 checkPendingAnnouncements API 返回的公告
                    // 如果後端認為這些公告應該顯示給使用者，我們就直接顯示
                    // 而不再根據 allNotices 中的 read 狀態過濾
                    announcements.value = otherAnnouncements;
                    isOpen.value = true;
                    return true;
                } else {
                    // 沒有條款也沒有公告
                    announcements.value = [];
                    isOpen.value = false;
                    return false;
                }
            } catch (error) {
                console.error("檢查條款確認狀態失敗", error);
                return false;
            }
        } else {
            // 非高雄環境使用原有邏輯
            const response = await axios.get("/system/checkPendingAnnouncements");

            if (response.data.code === 0 && response.data.data.announcements?.length > 0) {
                // 發送訊息的時候的檢查
                if (isSendMsg) {
                    // 只過濾出需要同意的條款類型公告
                    const requiredTerms = response.data.data.announcements.filter(
                        (a) => a.type === "TERMS" && a.require_agreement === true
                    );

                    // 如果有需要同意的條款，顯示對話框
                    if (requiredTerms.length > 0) {
                        // 這裡只設置必須同意的條款
                        announcements.value = requiredTerms;
                        isOpen.value = true;
                        return true;
                    } else {
                        // 沒有需要同意的條款，視為已同意
                        announcements.value = [];
                        isOpen.value = false;
                        termsStore.setTermsAccepted(true);
                        return false;
                    }
                } else {
                    // 正常初始化調用，顯示所有公告
                    announcements.value = response.data.data.announcements;
                    isOpen.value = true;
                    return true;
                }
            } else {
                // 沒有任何公告
                announcements.value = [];
                isOpen.value = false;
                termsStore.setTermsAccepted(true);
                return false;
            }
        }
    } catch (error) {
        console.error("檢查待確認公告失敗:", error);
        announcements.value = [];
        isOpen.value = false;
        return false;
    }
};

const markedTitle = computed(() => {
    if (!currentAnnouncement.value?.use_markdown) return "";
    return DOMPurify.sanitize(marked(currentAnnouncement.value.title));
});

const markedContent = computed(() => {
    if (!currentAnnouncement.value?.use_markdown) return "";
    return DOMPurify.sanitize(marked(currentAnnouncement.value.content));
});

// 生命週期
onMounted(() => {
    apiStatusStore.registerRequest();
    try {
        checkPendingAnnouncements();
    } catch (error) {
        console.log("onMounted error", error);
    } finally {
        apiStatusStore.markRequestComplete();
    }

    emitter.on("checkPendingAnnouncements", async (msg) => {
        termsStore.setPendingMessage(msg.data);
        if (termsStore.termsAccepted) {
            return false;
        }

        await checkPendingAnnouncements({ isSendMsg: true });
    });
});

// 高市府客製化提示框
const showRedirectModel = ref(false);

const handleRedirectCancel = () => {
    if (isIframe) {
        showRedirectModel.value = false;
        window.parent.postMessage({ type: "closeIframe" }, "*");
    } else {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = "https://soweb.kcg.gov.tw/";
        }
    }
};
const handleRedirectConfirm = () => {
    if (isIframe) {
        window.parent.postMessage({ type: "redirectTo1999" }, "*");
    } else {
        window.location.href = "https://soweb.kcg.gov.tw/";
    }
};

// 移除測試用的直接關閉方法
const forceClose = async () => {
    // 對於高雄環境的多則條款，檢查是否有下一則
    if (
        isKaohsiungEnv &&
        filteredAnnouncements.value.length > 1 &&
        currentIndex.value < filteredAnnouncements.value.length - 1
    ) {
        // 還有下一則條款，切換到下一則
        currentIndex.value += 1;

        // 重置確認狀態
        agreed.value = false;

        // 檢查下一則條款是否已確認過
        const nextAnnouncementId = filteredAnnouncements.value[currentIndex.value].id;
        if (acknowledgedTerms.value.has(nextAnnouncementId)) {
            isTermsAcknowledged.value = true;
            agreed.value = true;
        } else {
            isTermsAcknowledged.value = false;
        }
    } else {
        // 檢查是否為公告類型(NOTICE) 檢查是否有還未閱讀的公告
        const response = await axios.get("/system/checkPendingAnnouncements");
        if (response.data.code === 0) {
            currentIndex.value = 0;
            announcements.value = response.data.data.announcements || [];
            agreed.value = false;

            if (!announcements.value.length) {
                isOpen.value = false;
                props.onComplete?.();
            }
        }
    }
};
</script>

<template>
    <div>
        <Dialog v-if="!isKaohsiungEnv && !showExpertAccessRestricted" v-model:open="isOpen">
            <DialogContent class="sm:max-w-[600px] w-11/12 p-0">
                <div v-if="currentAnnouncement" class="max-h-[80vh] flex flex-col">
                    <!-- 標題區域 -->
                    <DialogHeader class="flex-shrink-0 px-6 pt-6 pb-2">
                        <DialogTitle class="mb-1 text-xl font-bold text-center">
                            <div
                                v-if="currentAnnouncement.use_markdown"
                                class="mkd"
                                v-dompurify-html="markedTitle"
                            ></div>
                            <div v-else>{{ currentAnnouncement.title }}</div>
                        </DialogTitle>
                        <DialogDescription class="text-sm text-center text-gray-500">
                            {{ getAnnouncementTypeText(currentAnnouncement.type) }}
                            <template v-if="filteredAnnouncements.length > 1">
                                (第 {{ currentIndex + 1 }} 則，共 {{ filteredAnnouncements.length }} 則)
                            </template>
                        </DialogDescription>
                    </DialogHeader>

                    <!-- 內容區域 -->
                    <div class="flex-1 px-6 py-4 overflow-auto">
                        <div class="prose-sm prose max-w-none">
                            <div
                                v-if="currentAnnouncement.use_markdown"
                                v-dompurify-html="markedContent"
                                class="mkd"
                            ></div>
                            <div v-else class="whitespace-pre-wrap">{{ currentAnnouncement.content }}</div>
                        </div>
                    </div>

                    <!-- 分頁導航 -->
                    <div v-if="filteredAnnouncements.length > 1" class="flex justify-center gap-2 py-2">
                        <button
                            v-for="index in filteredAnnouncements.length"
                            :key="index"
                            @click="currentIndex = index - 1"
                            class="w-2.5 h-2.5 rounded-full transition-all duration-300"
                            :class="[currentIndex === index - 1 ? 'bg-primary w-4' : 'bg-gray-300']"
                        />
                    </div>

                    <!-- 操作區域 -->
                    <div class="p-6 space-y-4 border-t bg-gray-50">
                        <!-- 同意選項 - 只在條款類型時顯示 -->
                        <div v-if="currentAnnouncement.type === 'TERMS'" class="flex items-start space-x-2">
                            <Checkbox id="agreement" v-model:checked="agreed" class="mt-1" :disabled="isLoading" />
                            <div class="space-y-1">
                                <label for="agreement" class="text-sm font-medium leading-none cursor-pointer">
                                    我已閱讀並同意上述條款內容
                                </label>
                                <p class="text-xs text-gray-500">點選此框代表您同意遵守我們的使用說明並了解其內容</p>
                            </div>
                        </div>

                        <!-- 全部已讀選項 -->
                        <div v-if="shouldShowBulkConfirm" class="flex items-start space-x-2">
                            <Checkbox
                                id="bulk-confirm"
                                v-model:checked="bulkConfirm"
                                class="mt-1"
                                :disabled="isLoading"
                            />
                            <div class="space-y-1">
                                <label for="bulk-confirm" class="text-sm font-medium leading-none cursor-pointer">
                                    全部標示為已讀
                                </label>
                                <p class="text-xs text-gray-500">勾選此項後，系統將不再顯示目前的所有公告。</p>
                            </div>
                        </div>

                        <!-- 按鈕區域 -->
                        <div class="flex space-x-3">
                            <Button
                                v-if="currentAnnouncement.type === 'TERMS'"
                                variant="outline"
                                class="flex-1"
                                @click="handleCancel"
                                :disabled="isLoading"
                            >
                                不同意
                            </Button>

                            <!-- 第一次確認按鈕（條款類型） -->
                            <Button
                                v-if="!isTermsAcknowledged && currentAnnouncement.type === 'TERMS'"
                                class="flex-1"
                                :disabled="(currentAnnouncement.type === 'TERMS' && !agreed) || isLoading"
                                @click="handleAction"
                            >
                                <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
                                確認同意
                            </Button>

                            <!-- 公告類型按鈕 -->
                            <Button
                                v-if="currentAnnouncement.type === 'NOTICE'"
                                class="flex-1"
                                :disabled="isLoading"
                                @click="handleAction"
                            >
                                <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
                                我已閱讀
                            </Button>

                            <!-- 已確認的"我知道了"按鈕 -->
                            <Button v-if="isTermsAcknowledged" class="flex-1" @click="forceClose">
                                {{
                                    filteredAnnouncements.length > 1 && currentIndex < filteredAnnouncements.length - 1
                                        ? "下一則"
                                        : "我知道了"
                                }}
                            </Button>
                        </div>

                        <!-- 提示訊息 -->
                        <div
                            v-if="currentAnnouncement.type === 'TERMS' && !agreed"
                            class="flex items-center text-sm text-amber-600"
                        >
                            <AlertCircleIcon class="w-4 h-4 mr-1" />
                            請閱讀並同意條款後繼續
                        </div>
                    </div>
                </div>
                <!-- Loading 狀態 -->
                <div v-else class="p-6 text-center text-gray-500">
                    <Loader2 class="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p>讀取中...</p>
                </div>
            </DialogContent>
        </Dialog>

        <!-- 高市府客製化條款畫面 -->
        <Teleport to="body" v-if="isKaohsiungEnv && currentAnnouncement && isOpen">
            <div class="kaohsiung-dialog-overlay">
                <div
                    class="kaohsiung-dialog-content"
                    :style="{ height: currentAnnouncement.type === 'TERMS' && isTermsAcknowledged ? 'auto' : '99%' }"
                >
                    <!-- 標題 -->
                    <div class="px-6 pt-6 pb-2">
                        <div class="mb-1 text-xl font-bold text-center">
                            <div
                                v-if="currentAnnouncement.use_markdown"
                                class="mkd"
                                v-dompurify-html="markedTitle"
                            ></div>
                            <div v-else>{{ currentAnnouncement.title }}</div>
                        </div>
                        <p class="text-sm text-center text-gray-500">
                            {{ getAnnouncementTypeText(currentAnnouncement.type) }}
                            <template v-if="filteredAnnouncements.length > 1">
                                (第 {{ currentIndex + 1 }} 則，共 {{ filteredAnnouncements.length }} 則)
                            </template>
                        </p>
                    </div>

                    <!-- 內容區域 -->
                    <div class="flex-1 px-6 py-4 overflow-auto">
                        <div class="prose-sm prose max-w-none">
                            <div v-if="currentAnnouncement.type === 'TERMS' && isTermsAcknowledged" class="mkd">
                                <h1 style="color: #009999; border: 3px solid #009999; padding: 16px; line-height: 2">
                                    目前智能客服的資料來源僅限於本府各機關的網站內容，超出資料範圍的問題即無法回答！
                                </h1>
                            </div>
                            <div
                                v-else-if="currentAnnouncement.use_markdown"
                                v-dompurify-html="markedContent"
                                class="mkd"
                            ></div>
                            <div v-else class="whitespace-pre-wrap">{{ currentAnnouncement.content }}</div>
                        </div>
                    </div>

                    <!-- 分頁導航 -->
                    <div v-if="filteredAnnouncements.length > 1" class="flex justify-center gap-2 py-2">
                        <button
                            v-for="index in filteredAnnouncements.length"
                            :key="index"
                            @click="currentIndex = index - 1"
                            class="w-2.5 h-2.5 rounded-full transition-all duration-300"
                            :class="[currentIndex === index - 1 ? 'bg-primary w-4' : 'bg-gray-300']"
                        />
                    </div>

                    <!-- 操作區域 -->
                    <div class="p-6 space-y-4 border-t bg-gray-50 rounded-[15px]">
                        <!-- 同意選項 - 只在條款類型且未確認時顯示 -->
                        <div
                            v-if="currentAnnouncement.type === 'TERMS' && !isTermsAcknowledged"
                            class="flex items-start space-x-2"
                        >
                            <Checkbox id="agreement" v-model:checked="agreed" class="mt-1" :disabled="isLoading" />
                            <div class="space-y-1">
                                <label for="agreement" class="text-sm font-medium leading-none cursor-pointer">
                                    我已閱讀並同意上述條款內容
                                </label>
                                <p class="text-xs text-gray-500">點選此框代表您同意遵守我們的使用說明並了解其內容</p>
                            </div>
                        </div>

                        <!-- 已同意過的條款提示 - 只在高雄環境並且條款已確認時顯示 -->
                        <div
                            v-if="currentAnnouncement.type === 'TERMS' && isTermsAcknowledged"
                            class="flex items-start space-x-2"
                        >
                            <div class="w-full space-y-1">
                                <p class="text-sm font-medium leading-none text-center text-green-600">
                                    您已同意此條款，請點擊「{{
                                        filteredAnnouncements.length > 1 &&
                                        currentIndex < filteredAnnouncements.length - 1
                                            ? "下一則"
                                            : "我知道了"
                                    }}」按鈕繼續
                                </p>
                            </div>
                        </div>

                        <!-- 全部已讀選項 -->
                        <div v-if="shouldShowBulkConfirm" class="flex items-start space-x-2">
                            <Checkbox
                                id="bulk-confirm"
                                v-model:checked="bulkConfirm"
                                class="mt-1"
                                :disabled="isLoading"
                            />
                            <div class="space-y-1">
                                <label for="bulk-confirm" class="text-sm font-medium leading-none cursor-pointer">
                                    全部標示為已讀
                                </label>
                                <p class="text-xs text-gray-500">勾選此項後，系統將不再顯示目前的所有公告。</p>
                            </div>
                        </div>

                        <!-- 顯示多則條款信息，不影響原樣式 -->
                        <div v-if="filteredAnnouncements.length > 1" class="mb-2 text-sm text-center text-gray-600">
                            第 {{ currentIndex + 1 }} 則條款，共 {{ filteredAnnouncements.length }} 則
                        </div>

                        <!-- 按鈕區域 -->
                        <div class="flex space-x-3">
                            <Button
                                v-if="currentAnnouncement.type === 'TERMS'"
                                variant="outline"
                                class="flex-1"
                                @click="handleCancel"
                                :disabled="isLoading"
                            >
                                不同意
                            </Button>

                            <!-- 第一次確認按鈕（條款類型） -->
                            <Button
                                v-if="!isTermsAcknowledged && currentAnnouncement.type === 'TERMS'"
                                class="flex-1"
                                :disabled="(currentAnnouncement.type === 'TERMS' && !agreed) || isLoading"
                                @click="handleAction"
                            >
                                <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
                                確認同意
                            </Button>

                            <!-- 公告類型按鈕 -->
                            <Button
                                v-if="currentAnnouncement.type === 'NOTICE'"
                                class="flex-1"
                                :disabled="isLoading"
                                @click="handleAction"
                            >
                                <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
                                我已閱讀
                            </Button>

                            <!-- 已確認的"我知道了"按鈕 -->
                            <Button
                                v-if="isTermsAcknowledged && currentAnnouncement.type === 'TERMS'"
                                class="flex-1"
                                @click="forceClose"
                            >
                                {{
                                    filteredAnnouncements.length > 1 && currentIndex < filteredAnnouncements.length - 1
                                        ? "下一則"
                                        : "我知道了"
                                }}
                            </Button>
                        </div>

                        <!-- 提示訊息 - 只在條款類型且未確認且未勾選同意時顯示 -->
                        <div
                            v-if="currentAnnouncement.type === 'TERMS' && !agreed && !isTermsAcknowledged"
                            class="flex items-center text-sm text-amber-600"
                        >
                            <AlertCircleIcon class="w-4 h-4 mr-1" />
                            請閱讀並同意條款後繼續
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- 重定向彈窗 - 使用 Teleport 確保始終顯示在最上層 -->
        <Teleport to="body">
            <div v-if="showRedirectModel" class="redirect-model">
                <div class="redirect-model-content">
                    <div class="text-center">
                        <p class="font-bold leading-relaxed">
                            謝謝您！我們需要您同意
                            <span class="underline">智能客服使用說明</span>
                            來繼續提供服務，或者提供您連結至
                            <span class="underline">1999線上即時服務系統</span>
                            獲得協助。
                        </p>
                        <div class="flex justify-center mt-4 space-x-3">
                            <Button class="flex-1 text-white bg-gray-400" @click="handleRedirectCancel">
                                <i class="w-4 h-4 mr-2 fa-regular fa-circle-xmark"></i>
                                關閉智能客服
                            </Button>
                            <Button class="flex-1 text-white bg-blue-500" @click="handleRedirectConfirm">
                                <i class="w-4 h-4 mr-2 fa-solid fa-arrow-up-right-from-square"></i>
                                前往1999
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped lang="scss">
.prose {
    max-width: none;
}

:deep(.dialog-content) {
    margin: 20px;
}

.kaohsiung-dialog-overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    z-index: 999999;
    background-color: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    .kaohsiung-dialog-content {
        width: 100%;
        max-width: 540px;
        height: 99%;
        border: 2px solid grey;
        border-radius: 15px;
        display: flex;
        flex-direction: column;
    }
}

.redirect-model {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999999; /* 確保高於其他元素 */
    .redirect-model-content {
        width: 90%;
        max-width: 400px;
        padding: 30px;
        background-color: white;
        border-radius: 15px;
        animation: bounceIn 0.5s ease-in-out;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    @keyframes bounceIn {
        0% {
            transform: scale(0.5);
            opacity: 0;
        }
        70% {
            transform: scale(1.1);
            opacity: 1;
        }
        100% {
            transform: scale(1);
        }
    }
}
</style>
