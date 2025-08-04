<script setup>
import { ref, computed, onMounted, watch, inject } from "vue";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { marked } from "marked";
import { Loader2Icon, CheckCircle, AlertCircle, DownloadIcon } from "lucide-vue-next";
import { useQuery } from "@tanstack/vue-query";
import { getFileIconByFileName, getIconBgColorByFileName } from "@/utils/files";
import { storeToRefs } from "pinia";
import { useSystemStore, useSettingsStore } from "@/store/index";

const systemStore = useSystemStore();
const { isMobile } = systemStore;

const settingsStore = useSettingsStore();
const { chat_file_translate_enable } = storeToRefs(settingsStore);

const axios = inject("axios");
const emitter = inject("emitter");

// Props & Emits
const props = defineProps({
    modelValue: {
        type: Boolean,
        required: true,
    },
});

const emit = defineEmits(["update:modelValue"]);

// State
const isLoading = ref(false);
const notifications = ref({
    terms: [],
    announcements: [],
});

// Computed
const terms = computed(() => notifications.value.terms || []);
const announcements = computed(() => notifications.value.announcements || []);
const unreadTermsCount = computed(() => terms.value.filter((t) => !t.agreed).length);
const unreadAnnouncementsCount = computed(() => announcements.value.filter((a) => !a.read).length);

// 格式化建立時間
const formatDate = (dateString) => {
    try {
        const date = new Date(dateString);
        return date.toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch (error) {
        return dateString;
    }
};

// 獲取狀態標籤顏色
const getStatusColor = (status) => {
    switch (status) {
        case "completed":
            return "success";
        case "processing":
            return "primary";
        case "pending":
            return "warning"; // 或其他適合的顏色，例如 "secondary"
        case "failed":
        case "error":
            return "destructive";
        default:
            return "secondary";
    }
};

// 獲取狀態顯示文字
const getStatusText = (status) => {
    switch (status) {
        case "completed":
            return "已完成";
        case "processing":
            return "處理中";
        case "pending":
            return "等待中";
        case "failed":
        case "error":
            return "失敗";
        default:
            return status;
    }
};

// Methods
const fetchNotifications = async () => {
    try {
        isLoading.value = true;
        const response = await axios.get("/system/announcements");
        if (response.data.code === 0) {
            notifications.value = response.data.data;
        }
    } catch (error) {
        console.error("獲取通知失敗:", error);
    } finally {
        isLoading.value = false;
    }
};

const fetchTranslationTasks = async () => {
    if (!chat_file_translate_enable.value) return [];
    const response = await axios.get("/notification/translation-tasks");
    if (response.data.code === 0) {
        return response.data.data.translation_tasks || [];
    }
    throw new Error("獲取翻譯任務失敗");
};

const {
    data: translationTasks,
    isLoading: isLoadingTasks,
    refetch: refetchTasks,
} = useQuery({
    queryKey: ["translationTasks"],
    queryFn: fetchTranslationTasks,
    enabled: computed(() => props.modelValue),
    refetchInterval: 30000, // 每30秒自動刷新一次
    initialData: [],
});

const pendingTasksCount = computed(
    () => (translationTasks.value || []).filter((t) => t.status === "processing" || t.status === "pending").length
);

const handleAgreeTerms = async (termId) => {
    try {
        const response = await axios.post(`/system/acknowledgeAnnouncement/${termId}`);
        if (response.data.code === 0) {
            await fetchNotifications();
        }
    } catch (error) {
        console.error("同意條款失敗:", error);
    }
};

// 新增已讀追蹤
const handleAnnouncementOpen = async (value) => {
    if (!value) return;

    try {
        await axios.post(`/system/acknowledgeAnnouncement/${value}`);

        // 本地更新公告的已讀狀態，而不是重新獲取
        const announcementToUpdate = announcements.value.find((a) => String(a.id) === value);
        if (announcementToUpdate) {
            console.log("announcementToUpdate", announcementToUpdate);
            announcementToUpdate.read = true;
        }
    } catch (error) {
        console.error("標記已讀失敗:", error);
    }
};

// 開啟檔案連結
const openFileLink = (fileUrl) => {
    window.open(fileUrl, "_blank");
};

// Watchers
watch(
    () => props.modelValue,
    (newValue) => {
        if (newValue) {
            fetchNotifications();
            refetchTasks();
        } else {
            emitter.emit("unreadNotification");
        }
    }
);

const handleTabChange = (value) => {
    if (value === "translations") {
        refetchTasks();
    }
};

onMounted(() => {
    if (props.modelValue) {
        fetchNotifications();
    }
});
</script>
<template>
    <Drawer :open="modelValue" @update:open="$emit('update:modelValue', $event)">
        <DrawerContent
            class="w-[90vw] max-w-[500px] mx-auto md:mx-auto md:mr-0 sm:mx-auto"
            :class="isMobile ? 'h-[90vh]' : 'h-full'"
        >
            <DrawerHeader class="px-6 py-4 border-b">
                <DrawerTitle class="text-xl font-bold">訊息中心</DrawerTitle>
            </DrawerHeader>

            <!-- 內容區 -->
            <div class="drawer-content">
                <Tabs defaultValue="announcements" class="tabs-container" @update:model-value="handleTabChange">
                    <TabsList class="flex gap-2 px-6 mt-2">
                        <TabsTrigger value="terms" class="relative flex-1 py-3" :class="unreadTermsCount ? 'pr-8' : ''">
                            使用說明
                            <span
                                v-if="unreadTermsCount"
                                class="absolute top-1 right-1 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center px-1"
                            >
                                {{ unreadTermsCount }}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="announcements"
                            class="relative flex-1 py-3"
                            :class="unreadAnnouncementsCount ? 'pr-8' : ''"
                        >
                            公告訊息
                            <span
                                v-if="unreadAnnouncementsCount"
                                class="absolute top-1 right-1 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center px-1"
                            >
                                {{ unreadAnnouncementsCount }}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="translations"
                            class="relative flex-1 py-3"
                            :class="pendingTasksCount ? 'pr-8' : ''"
                            v-if="chat_file_translate_enable"
                        >
                            檔案翻譯
                            <span
                                v-if="pendingTasksCount"
                                class="absolute top-1 right-1 min-w-[20px] h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center px-1"
                            >
                                {{ pendingTasksCount }}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    <div class="tabs-content">
                        <TabsContent value="terms">
                            <div class="content-container">
                                <div v-if="isLoading" class="py-8 text-center text-gray-500">
                                    <Loader2Icon class="w-8 h-8 mx-auto mb-2 animate-spin" />
                                    <p>載入中...</p>
                                </div>
                                <div
                                    v-else-if="terms.length === 0"
                                    class="flex flex-col items-center justify-center h-full text-gray-500"
                                >
                                    <CheckCircle class="w-12 h-12 mb-2 text-green-500" />
                                    <p>您已同意所有使用說明</p>
                                </div>
                                <Accordion v-else type="single" collapsible class="space-y-4">
                                    <AccordionItem
                                        v-for="term in terms"
                                        :key="term.id"
                                        :value="String(term.id)"
                                        class="overflow-hidden border rounded-lg"
                                        :class="term.agreed ? 'bg-green-50' : 'bg-red-50'"
                                    >
                                        <AccordionTrigger class="px-4 py-3 hover:no-underline">
                                            <div class="flex items-center justify-between flex-1 pr-4">
                                                <div class="flex items-center gap-3">
                                                    <div
                                                        class="w-2 h-2 rounded-full"
                                                        :class="term.agreed ? 'bg-green-500' : 'bg-red-500'"
                                                    />
                                                    <span class="font-medium">{{ term.title }}</span>
                                                </div>
                                                <Badge :variant="term.agreed ? 'success' : 'destructive'">
                                                    {{ term.agreed ? "已同意" : "未同意" }}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div class="px-4 py-3 border-t bg-white/50">
                                                <div
                                                    v-if="term.use_markdown"
                                                    class="mb-4 mkd"
                                                    v-dompurify-html="marked(term.content)"
                                                />
                                                <div v-else class="mb-4 text-sm text-gray-600 whitespace-pre-wrap">
                                                    {{ term.content }}
                                                </div>

                                                <div
                                                    v-if="!term.agreed"
                                                    class="flex items-center justify-between pt-4 mt-4 border-t"
                                                >
                                                    <p class="text-sm text-gray-500">
                                                        <AlertCircle class="inline-block w-4 h-4 mr-1" />
                                                        請仔細閱讀並同意此條款
                                                    </p>
                                                    <Button size="sm" @click="handleAgreeTerms(term.id)">
                                                        我同意此條款
                                                    </Button>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>
                        </TabsContent>

                        <TabsContent value="announcements">
                            <div class="content-container">
                                <div v-if="isLoading" class="py-8 text-center text-gray-500">
                                    <Loader2Icon class="w-8 h-8 mx-auto mb-2 animate-spin" />
                                    <p>載入中...</p>
                                </div>
                                <div
                                    v-else-if="announcements.length === 0"
                                    class="flex flex-col items-center justify-center h-full text-gray-500"
                                >
                                    <CheckCircle class="w-12 h-12 mb-2 text-green-500" />
                                    <p>目前沒有任何公告</p>
                                </div>
                                <Accordion
                                    v-else
                                    type="single"
                                    collapsible
                                    class="space-y-4"
                                    @update:model-value="handleAnnouncementOpen"
                                >
                                    <AccordionItem
                                        v-for="announcement in announcements"
                                        :key="announcement.id"
                                        :value="String(announcement.id)"
                                        class="overflow-hidden border rounded-lg"
                                        :class="announcement.read ? 'bg-gray-50' : 'bg-blue-50'"
                                    >
                                        <AccordionTrigger class="px-4 py-3 hover:no-underline">
                                            <div class="flex items-center justify-between flex-1 pr-4">
                                                <div class="flex items-center gap-3">
                                                    <div
                                                        class="w-2 h-2 rounded-full"
                                                        :class="announcement.read ? 'bg-gray-400' : 'bg-blue-500'"
                                                    />
                                                    <span class="font-medium">{{ announcement.title }}</span>
                                                </div>
                                                <Badge :variant="announcement.read ? 'secondary' : 'primary'">
                                                    {{ announcement.read ? "已讀" : "未讀" }}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div class="px-4 py-3 border-t bg-white/50">
                                                <div
                                                    v-if="announcement.use_markdown"
                                                    class="mb-4 mkd"
                                                    v-dompurify-html="marked(announcement.content)"
                                                />
                                                <div v-else class="text-sm text-gray-600 whitespace-pre-wrap">
                                                    {{ announcement.content }}
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>
                        </TabsContent>

                        <!-- 檔案翻譯標籤頁 -->
                        <TabsContent value="translations" v-if="chat_file_translate_enable">
                            <div class="content-container">
                                <div v-if="isLoadingTasks" class="py-8 text-center text-gray-500">
                                    <Loader2Icon class="w-8 h-8 mx-auto mb-2 animate-spin" />
                                    <p>載入中...</p>
                                </div>
                                <div
                                    v-else-if="!translationTasks || translationTasks.length === 0"
                                    class="flex flex-col items-center justify-center h-full text-gray-500"
                                >
                                    <CheckCircle class="w-12 h-12 mb-2 text-green-500" />
                                    <p>目前沒有翻譯任務</p>
                                </div>
                                <Accordion v-else type="single" collapsible class="space-y-4">
                                    <AccordionItem
                                        v-for="task in translationTasks"
                                        :key="task.id"
                                        :value="task.id"
                                        class="overflow-hidden border rounded-lg"
                                        :class="{
                                            'bg-green-50': task.status === 'completed',
                                            'bg-blue-50': task.status === 'processing',
                                            'bg-yellow-50': task.status === 'pending',
                                            'bg-red-50': task.status === 'failed' || task.status === 'error',
                                        }"
                                    >
                                        <AccordionTrigger class="px-4 py-3 hover:no-underline">
                                            <div class="flex items-center justify-between flex-1 pr-4">
                                                <div class="flex items-center gap-3">
                                                    <div
                                                        class="w-2 h-2 rounded-full"
                                                        :class="{
                                                            'bg-green-500': task.status === 'completed',
                                                            'bg-blue-500': task.status === 'processing',
                                                            'bg-red-500':
                                                                task.status === 'failed' || task.status === 'error',
                                                        }"
                                                    />
                                                    <span class="font-medium"
                                                        >翻譯任務 {{ formatDate(task.create_time) }}</span
                                                    >
                                                </div>
                                                <Badge :variant="getStatusColor(task.status)">
                                                    {{ getStatusText(task.status) }}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div class="px-4 py-3 border-t bg-white/50">
                                                <div class="mb-4 text-sm text-gray-600">
                                                    <p class="mb-2">
                                                        <span class="font-medium">任務訊息：</span>
                                                        {{ task.message || "無訊息" }}
                                                    </p>
                                                    <p class="mb-2">
                                                        <span class="font-medium">建立時間：</span>
                                                        {{ formatDate(task.create_time) }}
                                                    </p>
                                                    <p>
                                                        <span class="font-medium">更新時間：</span>
                                                        {{ formatDate(task.update_time) }}
                                                    </p>
                                                </div>

                                                <!-- 檔案列表 -->
                                                <div
                                                    v-if="task.status === 'completed' && task.result_files"
                                                    class="pt-4 mt-4 border-t"
                                                >
                                                    <p class="mb-2 font-medium">翻譯結果檔案：</p>
                                                    <div class="space-y-2">
                                                        <div
                                                            v-for="(file, index) in task.result_files"
                                                            :key="index"
                                                            class="flex items-center justify-between p-2 transition rounded-md bg-gray-50 hover:bg-gray-100"
                                                        >
                                                            <div class="flex items-center gap-2">
                                                                <div
                                                                    class="flex items-center justify-center w-8 h-8 rounded-md"
                                                                    :style="{
                                                                        backgroundColor: getIconBgColorByFileName(
                                                                            file.file_name
                                                                        ),
                                                                    }"
                                                                >
                                                                    <i
                                                                        :class="getFileIconByFileName(file.file_name)"
                                                                        class="text-sm text-white"
                                                                    ></i>
                                                                </div>
                                                                <span class="text-sm truncate max-w-[250px]">{{
                                                                    file.file_name
                                                                }}</span>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                class="ml-2"
                                                                @click="openFileLink(file.file_url)"
                                                            >
                                                                <DownloadIcon class="w-4 h-4 mr-1" />
                                                                下載
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <!-- 錯誤狀態訊息 -->
                                                <div
                                                    v-if="task.status === 'failed' || task.status === 'error'"
                                                    class="pt-4 mt-4 border-t"
                                                >
                                                    <div class="p-3 border border-red-200 rounded-md bg-red-50">
                                                        <p class="flex items-center text-sm text-red-700">
                                                            <AlertCircle class="w-4 h-4 mr-2" />
                                                            翻譯處理過程中發生錯誤
                                                        </p>
                                                    </div>
                                                </div>

                                                <!-- 處理中狀態 -->
                                                <div v-if="task.status === 'processing'" class="pt-4 mt-4 border-t">
                                                    <div class="p-3 border border-blue-200 rounded-md bg-blue-50">
                                                        <p class="flex items-center text-sm text-blue-700">
                                                            <Loader2Icon class="w-4 h-4 mr-2 animate-spin" />
                                                            正在處理翻譯任務，請稍候...
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>

                                <!-- 自動刷新提示 -->
                                <div
                                    v-if="translationTasks && translationTasks.some((t) => t.status === 'processing')"
                                    class="mt-4 text-xs text-center text-gray-500"
                                >
                                    <p>處理中的翻譯任務將每 30 秒自動刷新</p>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
            <!-- 關閉按鈕 -->
            <Button
                v-if="isMobile"
                class="absolute text-gray-500 bg-transparent top-2 right-2"
                @click="$emit('update:modelValue', false)"
            >
                <i class="fa-solid fa-xmark fa-xl"></i>
            </Button>
        </DrawerContent>
    </Drawer>
</template>

<style scoped>
/* 抽屜內容區域 */
.drawer-content {
    height: calc(100% - 73px); /* 扣除標題高度 */
    display: flex;
    flex-direction: column;
}

/* Tabs 容器 */
.tabs-container {
    height: 100%;
    display: flex;
    flex-direction: column;
}

/* Tabs 內容區域 */
.tabs-content {
    flex: 1;
    margin-top: 1rem;
    overflow-y: auto;
    height: calc(100% - 60px); /* 扣除 tabs 標籤高度 */
}

/* 實際內容容器 */
.content-container {
    padding: 1rem 1.5rem;
}

/* Markdown 內容樣式 */
:deep(.prose) {
    max-width: none;
}

/* 確保 Accordion 內容可以完整展示 */
:deep(.accordion-content) {
    max-height: none !important;
}

/* 移除 TabsContent 的預設 margin */
:deep([role="tabpanel"]) {
    margin: 0;
}

/* 添加滑動動畫 */
@keyframes slide-in {
    from {
        transform: translateX(100%);
    }
    to {
        transform: translateX(0);
    }
}

@keyframes slide-out {
    from {
        transform: translateX(0);
    }
    to {
        transform: translateX(100%);
    }
}

.animate-slide-in {
    animation: slide-in 0.3s ease-out forwards;
}

.animate-slide-out {
    animation: slide-out 0.3s ease-out forwards;
}
</style>
