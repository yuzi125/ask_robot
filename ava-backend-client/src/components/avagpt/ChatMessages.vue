<script setup>
import { computed, inject, ref, watch, nextTick } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { format } from "date-fns";
import { useDebounceFn } from "@vueuse/core";
import ScrollButton from "@/components/common/ScrollButton.vue";
import { getFileIcon, getFileIconColor } from "@/utils/common";

const axios = inject("axios");

const props = defineProps({
    userId: {
        type: String,
        required: false,
    },
    conversation: {
        type: Object,
        required: false,
    },
    dateRange: {
        type: Object,
        required: true,
        default: () => ({
            start: null,
            end: null,
        }),
    },
});

const searchQuery = ref("");
const chatContainerRef = ref(null);
const messageRefs = ref([]);
const currentSearchIndex = ref(0);
const searchResults = ref([]);
const currentPage = ref(1);
const itemsPerPage = ref(15);

// 創建防抖後的搜尋變數
const debouncedSearchQuery = ref("");

// 使用 debounce 處理搜尋，避免頻繁請求
const debouncedSearch = useDebounceFn(() => {
    currentPage.value = 1; // 重置為第一頁
    // 更新防抖後的搜尋值，這會觸發 query 重新執行
    debouncedSearchQuery.value = searchQuery.value;
}, 500);

// 當搜尋關鍵字變更時
watch(searchQuery, () => {
    debouncedSearch();
});

const fetchMessages = async () => {
    if (!props.userId || !props.conversation) return null;

    const { data } = await axios.get(`/avaGPT/chat/messages`, {
        params: {
            userId: props.userId,
            conversationId: props.conversation.conversationId,
            page: currentPage.value,
            limit: itemsPerPage.value,
            searchQuery: debouncedSearchQuery.value,
            startDate: props.dateRange.start ? format(props.dateRange.start, "yyyy-MM-dd'T'HH:mm:ss") : undefined,
            endDate: props.dateRange.end ? format(props.dateRange.end, "yyyy-MM-dd'T'HH:mm:ss") : undefined,
        },
    });

    if (data.code !== 200) {
        throw new Error(data.message);
    }

    return data.data;
};

const {
    data: messagesData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    isPlaceholderData,
} = useQuery({
    queryKey: [
        "messages",
        props.userId,
        props.conversation?.conversationId,
        currentPage,
        itemsPerPage,
        debouncedSearchQuery,
        props.dateRange,
    ],
    queryFn: fetchMessages,
    enabled: computed(() => !!(props.userId && props.conversation)),
    placeholderData: keepPreviousData,
});

// 訊息列表
const messages = computed(() => {
    return messagesData.value?.messages || [];
});

// 總頁數
const totalPages = computed(() => {
    return messagesData.value?.totalPages || 1;
});

// 設置訊息元素引用，用於搜尋滾動
const setMessageRef = (el, index) => {
    if (el) {
        messageRefs.value[index] = el;
    }
};

// 處理頁碼變更
const handlePageChange = (newPage) => {
    currentPage.value = newPage;
    scrollTopKey.value++; // 觸發 ScrollButton 更新
    nextTick(() => {
        if (chatContainerRef.value) {
            chatContainerRef.value.scrollTop = 0;
        }
    });
    refetch();
};

// 格式化日期時間
const formatDate = (date) => {
    return format(new Date(date), "yyyy/MM/dd HH:mm:ss");
};

// 獲取模型顯示名稱
const getModelName = (model) => {
    if (!model) return "未知";

    if (model.includes("claude")) {
        return model.includes("3.5") ? "Claude 3.5" : "Claude";
    } else if (model.includes("gpt")) {
        if (model.includes("4")) {
            return "GPT-4";
        } else if (model.includes("3.5")) {
            return "GPT-3.5";
        }
        return "GPT";
    }

    return model.split("-")[0];
};

// 獲取模型顏色
const getModelColor = (model) => {
    if (!model) return "grey";

    if (model.includes("claude")) {
        return "purple";
    } else if (model.includes("gpt")) {
        return "green";
    }

    return "primary";
};

// 處理訊息文字，高亮搜尋結果
const renderMessageText = (text, content) => {
    if (!text) {
        if (!content) return "";
        text = content.filter((item) => item.text && item.text != "")[0].text;
    }
    if (!searchQuery.value) return escapeHtml(text);

    const regex = new RegExp(`(${searchQuery.value})`, "gi");
    const escapedText = escapeHtml(text);
    return escapedText.replace(regex, '<span class="highlight-text">$1</span>');
};

// 檢查是否為當前選中的搜尋結果
const isSearchMatch = (messageIndex) => {
    if (searchResults.value.length === 0 || currentSearchIndex.value < 0) return false;
    return searchResults.value[currentSearchIndex.value].messageIndex === messageIndex;
};

// 搜尋導航：上一個/下一個結果
const navigateSearch = (direction) => {
    const newIndex = currentSearchIndex.value + direction;
    if (newIndex >= 0 && newIndex < searchResults.value.length) {
        currentSearchIndex.value = newIndex;
        if (chatContainerRef.value) {
            chatContainerRef.value.scrollTop = 0;
        }
    }
};

// HTML 轉義，避免 XSS，但保留換行符
const escapeHtml = (html) => {
    if (!html) return "";
    return String(html)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");
};

// 監聽對話變化，強制重新獲取數據
watch(
    () => props.conversation?.conversationId,
    (newId, oldId) => {
        if (newId && newId !== oldId) {
            // 重置搜尋和分頁狀態
            searchQuery.value = "";
            currentPage.value = 1;
            searchResults.value = [];
            currentSearchIndex.value = 0;
            messageRefs.value = [];
            refetch();
        }
    }
);

// 另外監聽完整對話物件的變化，確保其他對話屬性變化時也重置
watch(
    () => props.conversation,
    () => {
        // 重置搜尋狀態
        searchQuery.value = "";
        currentPage.value = 1;
        searchResults.value = [];
        currentSearchIndex.value = 0;
        messageRefs.value = [];
    }
);

const scrollTopKey = ref(0);

// 檢查搜尋結果並滾動到頂部
watch(messages, () => {
    if (searchQuery.value && messages.value?.length > 0) {
        findSearchMatches();
        // 搜尋後自動滾動到頂部
        nextTick(() => {
            if (chatContainerRef.value) {
                chatContainerRef.value.scrollTop = 0;
                scrollTopKey.value++; // 觸發 ScrollButton 更新
            }
        });
    } else {
        searchResults.value = [];
        currentSearchIndex.value = 0;
    }
});

// 在當前頁面查找搜尋結果
const findSearchMatches = () => {
    searchResults.value = [];
    currentSearchIndex.value = 0;

    if (!searchQuery.value || !messages.value?.length) return;

    const query = searchQuery.value.toLowerCase();

    messages.value.forEach((message, messageIndex) => {
        if (!message.text) return;

        const text = message.text.toLowerCase();
        if (text.includes(query)) {
            searchResults.value.push({
                messageIndex,
                matchIndex: text.indexOf(query),
            });
        }
    });
};

const hasFiles = (message) => {
    return message.files && Array.isArray(message.files) && message.files.length > 0;
};
</script>

<template>
    <v-card elevation="2" class="rounded-lg chat-card">
        <!-- 固定標題 -->
        <v-card-title class="px-4 py-2 d-flex align-center bg-surface-variant chat-header">
            <v-icon icon="mdi-message-text" class="me-2" />
            對話內容
            <v-spacer></v-spacer>
            <div v-if="conversation" class="d-flex align-center">
                <v-chip size="small" :color="getModelColor(conversation.model)" variant="flat" label class="mr-2">
                    {{ getModelName(conversation.model) }}
                </v-chip>
                <span class="text-body-2 conversation-title">{{ conversation.title || "未命名對話" }}</span>
            </div>
        </v-card-title>

        <!-- 固定搜尋欄 -->
        <div v-if="conversation" class="px-2 pt-2 search-container">
            <v-text-field
                v-model="searchQuery"
                density="compact"
                variant="solo-filled"
                label="搜尋訊息內容"
                prepend-inner-icon="mdi-magnify"
                clearable
                hide-details
                class="search-field"
                style="max-height: 40px"
            >
                <template v-slot:append>
                    <v-btn
                        v-if="searchResults.length > 0"
                        icon="mdi-chevron-up"
                        variant="text"
                        size="small"
                        :disabled="currentSearchIndex <= 0"
                        @click="navigateSearch(-1)"
                    ></v-btn>
                    <v-btn
                        v-if="searchResults.length > 0"
                        icon="mdi-chevron-down"
                        variant="text"
                        size="small"
                        :disabled="currentSearchIndex >= searchResults.length - 1"
                        @click="navigateSearch(1)"
                    ></v-btn>
                    <span v-if="searchResults.length > 0" class="mx-2 text-caption">
                        {{ currentSearchIndex + 1 }}/{{ searchResults.length }}
                    </span>
                </template>
            </v-text-field>
        </div>

        <!-- 可滾動的內容區域 -->
        <div class="chat-scroll-container">
            <div class="chat-content position-relativ" ref="chatContainerRef">
                <div v-if="isPlaceholderData" class="table-overlay">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                </div>

                <template v-if="conversation && messages && messages.length > 0">
                    <div
                        v-for="(message, index) in messages"
                        :key="message.messageId"
                        :class="['message', message.isCreatedByUser ? 'user' : 'ai']"
                        :ref="(el) => setMessageRef(el, index)"
                    >
                        <div class="message-content" :class="{ 'search-match': isSearchMatch(index) }">
                            <div class="message-header">
                                <div class="message-sender">
                                    <v-icon
                                        :icon="message.isCreatedByUser ? 'mdi-account' : 'mdi-robot'"
                                        size="small"
                                        class="mr-1"
                                    ></v-icon>
                                    <span class="mr-2">{{
                                        message.isCreatedByUser ? "使用者" : message.sender || "AI"
                                    }}</span>
                                    <template v-if="!message.isCreatedByUser">
                                        <div class="mr-2 ga-2 d-flex">
                                            <v-chip v-if="message.endpoint" size="small" color="primary" variant="flat">
                                                {{ message.endpoint }}
                                            </v-chip>
                                            <v-chip v-if="message.tokenCount" size="small" color="info" variant="flat">
                                                {{ message.tokenCount }} tokens
                                            </v-chip>
                                        </div>
                                    </template>
                                </div>
                                <div class="message-time">
                                    {{ formatDate(message.createdAt) }}
                                </div>
                            </div>
                            <div class="message-text">
                                <div v-html="renderMessageText(message.text, message.content)"></div>
                            </div>

                            <!-- 文件顯示區域 -->
                            <div v-if="message.isCreatedByUser && hasFiles(message)" class="file-attachments">
                                <div class="file-attachments-header">
                                    <v-icon icon="fa-solid fa-paperclip" size="small" class="mr-1"></v-icon>
                                    <span>附加檔案</span>
                                </div>
                                <div class="file-list">
                                    <div v-for="file in message.files" :key="file.file_id" class="file-item">
                                        <v-icon size="small" :color="getFileIconColor(file.filename)" class="mr-2">
                                            {{ getFileIcon(file.filename) }}
                                        </v-icon>
                                        <span class="file-name">{{ file.filename }}</span>
                                        <v-tooltip activator="parent" location="top">{{ file.filename }}</v-tooltip>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>

                <div v-else-if="isLoading || isFetching" class="justify-center d-flex align-center">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                </div>

                <div v-else-if="isError" class="justify-center d-flex align-center">
                    <v-alert
                        type="error"
                        variant="tonal"
                        :text="error?.message || '載入對話訊息時發生錯誤'"
                        width="80%"
                    ></v-alert>
                </div>

                <div v-else-if="conversation" class="justify-center d-flex align-center">
                    <v-alert
                        type="info"
                        variant="tonal"
                        border="start"
                        class="ma-2"
                        text="此對話尚無訊息記錄"
                    ></v-alert>
                </div>

                <div v-else class="justify-center d-flex align-center">
                    <v-alert type="info" variant="tonal" border="start" width="80%" text="請先選擇對話"></v-alert>
                </div>
            </div>

            <!-- Move ScrollButton outside of chat-content but inside chat-scroll-container -->
            <ScrollButton
                v-if="messages && messages.length > 0"
                :targetDOM="chatContainerRef"
                :position="{ right: '24px', bottom: '80px' }"
                :scrollTopKey="scrollTopKey"
                class="chat-scroll-button"
            />
        </div>

        <!-- 分頁 -->
        <div v-if="conversation && messages && messages.length > 0" class="pagination-wrapper">
            <v-pagination
                v-if="totalPages > 1"
                v-model="currentPage"
                :length="totalPages"
                :total-visible="5"
                @update:model-value="handlePageChange"
                density="compact"
                rounded="circle"
            ></v-pagination>
        </div>
    </v-card>
</template>

<style scoped>
.chat-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.chat-header {
    flex: 0 0 auto;
    z-index: 1;
}

.search-container {
    flex: 0 0 auto;
    z-index: 1;
    background-color: rgb(var(--v-theme-surface));
}

.chat-scroll-container {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
}

.chat-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow-y: auto;
    padding: 16px;
}

.message {
    margin-bottom: 16px;
    display: flex;
}

.message.user {
    justify-content: flex-end;
}

.message-content {
    max-width: 75%;
    padding: 12px;
    border-radius: 12px;
    background-color: #f5f5f5;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    color: rgba(0, 0, 0, 0.87);
    word-break: break-word;
    overflow-wrap: break-word;
}

.message.ai .message-content {
    background-color: #f0f7ff;
}

.message.user .message-content {
    background-color: #e8f5e9;
}

.message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    flex-wrap: wrap;
}

.message-sender {
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
}

.message-time {
    font-size: 0.75rem;
    opacity: 0.7;
}

.message-text {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
}

.search-match {
    border: 2px solid rgb(var(--v-theme-warning));
    animation: pulse 2s infinite;
}

.conversation-title {
    margin-top: 2.5px;
}

:deep(.highlight-text) {
    background-color: rgba(255, 193, 7, 0.3);
    font-weight: bold;
    border-radius: 2px;
    padding: 0 2px;
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7);
    }
    70% {
        box-shadow: 0 0 0 6px rgba(255, 193, 7, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(255, 193, 7, 0);
    }
}

.pagination-wrapper {
    display: flex;
    justify-content: center;
    padding: 8px 0;
    background-color: white;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    flex: 0 0 auto;
}

/* Update ScrollButton positioning */
:deep(.chat-scroll-button) {
    position: absolute !important;
    z-index: 100;
}

.table-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* File attachments styles */
.file-attachments {
    margin-top: 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    padding-top: 8px;
}

.file-attachments-header {
    display: flex;
    align-items: center;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 6px;
    color: rgba(0, 0, 0, 0.6);
}

.file-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.file-item {
    display: flex;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.04);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: background-color 0.2s;
}

.file-item:hover {
    background-color: rgba(0, 0, 0, 0.08);
}

.file-name {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    padding-top: 2px;
}
</style>
