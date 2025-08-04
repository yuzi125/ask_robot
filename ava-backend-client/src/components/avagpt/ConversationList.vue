<script setup>
import { ref, watch, computed, inject, nextTick } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { format } from "date-fns";
import { useDebounceFn } from "@vueuse/core";

const axios = inject("axios");

const props = defineProps({
    userId: {
        type: String,
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
    elementWidth: {
        type: Number,
        required: false,
    },
});

const emit = defineEmits(["select-conversation"]);

const selectedConversationId = ref(null);
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);

// 創建防抖後的搜尋變數
const debouncedSearchQuery = ref("");

// 使用 debounce 處理搜尋
const debouncedSearch = useDebounceFn(() => {
    currentPage.value = 1; // 重置到第一頁
    // 更新防抖後的搜尋值，這會觸發 query 重新執行
    debouncedSearchQuery.value = searchQuery.value;
}, 500);

// 當搜尋關鍵字變更時
watch(searchQuery, () => {
    debouncedSearch();
});

// Add computed userId
const computedUserId = computed(() => props.userId);

const computedDateRange = computed(() => {
    return {
        start: props.dateRange.start ? format(props.dateRange.start, "yyyy-MM-dd'T'HH:mm:ss") : undefined,
        end: props.dateRange.end ? format(props.dateRange.end, "yyyy-MM-dd'T'HH:mm:ss") : undefined,
    };
});

const fetchConversations = async () => {
    if (!props.userId) return null;

    const { data } = await axios.get(`/avaGPT/chat/conversations`, {
        params: {
            userId: props.userId,
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
    data: conversationData,
    refetch,
    isPlaceholderData,
} = useQuery({
    queryKey: ["conversations", computedUserId, currentPage, itemsPerPage, debouncedSearchQuery, computedDateRange],
    queryFn: fetchConversations,
    enabled: computed(() => !!props.userId),
    placeholderData: keepPreviousData,
});

// 對話列表
const conversations = computed(() => {
    return conversationData.value?.conversations || [];
});

// 使用者資訊
const userInfo = computed(() => {
    return conversationData.value?.userInfo || null;
});

// 總頁數
const totalPages = computed(() => {
    return conversationData.value?.totalPages || 1;
});

// 處理頁碼變更
const handlePageChange = (newPage) => {
    currentPage.value = newPage;
    refetch();
};

// 格式化日期
const formatDate = (date) => {
    return format(new Date(date), "yyyy/MM/dd HH:mm");
};

// 高亮搜尋文字
const highlightText = (text) => {
    if (!searchQuery.value || !text) return text;

    const query = searchQuery.value.toLowerCase();
    const textLower = text.toLowerCase();

    if (!textLower.includes(query)) return text;

    const index = textLower.indexOf(query);
    const beforeMatch = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const afterMatch = text.substring(index + query.length);

    return `${beforeMatch}<span class="highlight-text">${match}</span>${afterMatch}`;
};

// 獲取對話圖標
const getConversationIcon = (conversation) => {
    if (conversation.model && conversation.model.includes("claude")) {
        return "mdi-robot";
    } else if (conversation.model && conversation.model.includes("gpt")) {
        return "mdi-brain";
    }
    return "mdi-chat";
};

const selectConversation = (conversation) => {
    selectedConversationId.value = conversation.conversationId;
    emit("select-conversation", conversation);
};

// 當 userId 改變時，重置選中的對話
watch(
    () => props.userId,
    () => {
        selectedConversationId.value = null;
        searchQuery.value = "";
        currentPage.value = 1;
    }
);

// 監聽日期範圍變化
watch(
    () => props.dateRange,
    () => {
        if (props.userId) {
            currentPage.value = 1;
            searchQuery.value = "";
            selectedConversationId.value = null;
            refetch();
        }
    },
    { deep: true }
);
</script>

<template>
    <v-card elevation="2" class="rounded-lg h-100 d-flex flex-column">
        <v-card-title class="flex-none px-4 py-2 d-flex align-center bg-surface-variant">
            <div class="d-flex align-center text-truncate">
                <v-icon icon="mdi-chat-outline" class="flex-none me-2" />
                <span class="text-truncate">對話列表</span>
            </div>
            <v-spacer></v-spacer>
            <div v-if="userInfo" class="d-flex align-center">
                <span class="text-body-2 text-truncate user-name" style="max-width: 120px">{{ userInfo.name }}</span>
            </div>
        </v-card-title>

        <div class="overflow-hidden d-flex flex-column flex-grow-1">
            <v-text-field
                v-if="conversations"
                v-model="searchQuery"
                density="compact"
                variant="solo-filled"
                label="搜尋對話"
                prepend-inner-icon="mdi-magnify"
                clearable
                hide-details
                class="flex-none mx-2 mt-2 search-field"
                style="max-height: 40px"
            ></v-text-field>

            <div class="conversation-container flex-grow-1 position-relative">
                <!-- Loading overlay -->
                <div v-if="isPlaceholderData" class="table-overlay">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                </div>

                <div v-if="conversations.length > 0" class="h-100">
                    <v-list class="overflow-y-auto pa-0 h-100" ref="conversationListRef">
                        <v-list-item
                            v-for="conversation in conversations"
                            :key="conversation.conversationId"
                            :active="selectedConversationId === conversation.conversationId"
                            @click="selectConversation(conversation)"
                            class="py-2"
                            rounded="0"
                        >
                            <template v-slot:prepend>
                                <v-icon
                                    :icon="getConversationIcon(conversation)"
                                    :color="selectedConversationId === conversation.conversationId ? 'primary' : 'grey'"
                                    class="me-2"
                                ></v-icon>
                            </template>

                            <v-list-item-title
                                class="convo-list-title"
                                v-html="highlightText(conversation.title || '未命名對話')"
                            >
                            </v-list-item-title>
                            <v-list-item-subtitle class="d-flex align-center convo-list-subtitle">
                                <v-icon icon="mdi-clock-outline" size="x-small" class="me-1"></v-icon>
                                {{ formatDate(conversation.updatedAt) }}
                            </v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </div>

                <div v-else-if="userId && searchQuery" class="justify-center d-flex align-center">
                    <v-alert
                        type="info"
                        variant="tonal"
                        border="start"
                        class="ma-2"
                        text="沒有找到匹配的對話"
                    ></v-alert>
                </div>

                <div v-else-if="userId" class="justify-center d-flex align-center">
                    <v-alert
                        type="info"
                        variant="tonal"
                        border="start"
                        class="ma-2"
                        text="使用者尚無對話記錄"
                    ></v-alert>
                </div>

                <div v-else class="justify-center d-flex align-center">
                    <v-alert type="info" variant="tonal" border="start" class="ma-2" text="請先選擇使用者"></v-alert>
                </div>

                <div class="pagination-wrapper">
                    <v-pagination
                        v-if="totalPages > 1"
                        v-model="currentPage"
                        :length="totalPages"
                        :total-visible="elementWidth > 1100 ? 5 : 3"
                        @update:model-value="handlePageChange"
                        density="compact"
                        rounded="circle"
                    ></v-pagination>
                </div>
            </div>
        </div>
    </v-card>
</template>

<style scoped>
.h-100 {
    height: 100%;
}

.flex-none {
    flex: none;
}

.conversation-container {
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.search-field {
    margin-bottom: 8px !important;
}

.v-list-item--active {
    background-color: rgba(var(--v-theme-primary), 0.15);
}

.v-list-item--active .convo-list-subtitle {
    color: rgba(0, 0, 0, 0.6) !important;
}

.convo-list-title,
.convo-list-subtitle {
    color: inherit !important;
}

.v-list-item--active .convo-list-title {
    color: rgb(var(--v-theme-primary)) !important;
    font-weight: 600;
}

:deep(.highlight-text) {
    background-color: rgba(var(--v-theme-warning), 0.3);
    font-weight: bold;
    border-radius: 2px;
    padding: 0 2px;
}

.pagination-wrapper {
    display: flex;
    justify-content: center;
    padding: 8px 0;
    background-color: white;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
}

.position-relative {
    position: relative;
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

.text-truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.user-name {
    margin-top: 2px;
}

@media (max-width: 400px) {
    .v-card-title {
        padding-left: 8px !important;
        padding-right: 8px !important;
    }

    .user-name {
        max-width: 80px !important;
    }
}
</style>
