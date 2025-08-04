<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import ScrollButton from "@/components/common/ScrollButton.vue";
import { useDebounceFn } from "@vueuse/core";

const props = defineProps({
    selectedUser: Object,
    selectedExpert: Object,
    chatData: Object,
    datesData: Object,
    isLoading: Boolean,
    isDatesLoading: Boolean,
    searchExpanded: Boolean,
    userListExpanded: Boolean,
    isPlaceholderData: Boolean,
    isPlaceholderDates: Boolean,
    selectedDate: String,
    onSearch: Function,
});

const emit = defineEmits(["update:current-page", "update:selected-date", "search"]);

const selectedDate = ref(null);
const showSearchBar = ref(false);
const chatSearchQuery = ref("");
const currentPage = ref(1);

// 建立 debounced 搜尋函數
const debouncedSearch = useDebounceFn((value) => {
    emit("search", value);
}, 1000); // 1000ms 延遲

// 訊息視窗DOM，用來傳遞給scroll按鈕元件用
const msgDOM = ref(null);

const filteredChatHistory = computed(() => {
    return props.chatData?.chatHistory || [];
});

const filterChatByDate = (date) => {
    currentPage.value = 1;
    emit("update:selected-date", date);
};

const chatDates = computed(() => {
    if (!props.datesData) {
        return [];
    }
    return props.datesData.map((item) => [item.date, item.count]).sort((a, b) => new Date(b[0]) - new Date(a[0]));
});

const totalPages = computed(() => {
    if (!props.chatData?.total) return 0;
    return Math.ceil(props.chatData.total / props.chatData.pageSize);
});

// 清除搜尋時也要立即觸發
const toggleSearchBar = () => {
    showSearchBar.value = !showSearchBar.value;
    if (!showSearchBar.value) {
        chatSearchQuery.value = "";
        // 清除搜尋時立即觸發，不需要 debounce
        emit("search", "");
    }
};

const handlePageChange = (newPage) => {
    emit("update:current-page", newPage);
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
};

const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
        2,
        "0"
    )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const highlightText = (text) => {
    if (!chatSearchQuery.value) return text;
    const regex = new RegExp(`(${chatSearchQuery.value})`, "gi");
    return text.replace(regex, '<mark class="highlight">$1</mark>');
};

watch(
    () => props.selectedExpert,
    () => {
        selectedDate.value = null;
        emit("update:current-page", 1);
    }
);

// 當搜尋內容改變時觸發 debounced 搜尋
watch(chatSearchQuery, (newValue) => {
    debouncedSearch(newValue);
});
// 如果顯示內容有變動，要讓scroll回到頂端
const scrollTopKey = ref(0);
watch(
    () => filteredChatHistory.value,
    () => {
        scrollTopKey.value++;
    }
);
</script>

<template>
    <div class="chat-section" :class="{ expanded: !searchExpanded && !userListExpanded }">
        <v-card flat height="100%" v-if="selectedUser && selectedExpert" class="d-flex flex-column">
            <!-- Header -->
            <v-card-title class="px-4 py-2 d-flex justify-space-between align-center">
                <span>
                    {{ selectedExpert.expert_name }} -
                    {{ selectedUser.name !== null ? selectedUser.name : "遊客" }}
                </span>
                <v-btn icon @click="toggleSearchBar">
                    <v-icon>{{ showSearchBar ? "mdi-close" : "mdi-magnify" }}</v-icon>
                </v-btn>
            </v-card-title>

            <!-- Date filters -->
            <v-card-subtitle>
                <v-skeleton-loader type="button" v-if="isPlaceholderDates" class="mb-2"></v-skeleton-loader>
                <v-chip-group v-else v-model="selectedDate" active-class="primary--text" selected-class="text-primary" show-arrows>
                    <v-chip :key="'all'" :value="null" :label="true" @click="filterChatByDate(null)"> 全部 </v-chip>
                    <v-chip
                        v-for="[date, count] in chatDates"
                        :key="date"
                        :value="date"
                        :label="true"
                        @click="filterChatByDate(date)"
                    >
                        {{ formatDate(date) }} ({{ count }})
                    </v-chip>
                </v-chip-group>
            </v-card-subtitle>

            <!-- Search bar -->
            <v-slide-y-transition class="chat-search-bar">
                <v-text-field
                    v-if="showSearchBar"
                    v-model="chatSearchQuery"
                    label="搜尋聊天內容"
                    append-inner-icon="mdi-magnify"
                    clearable
                    dense
                    outlined
                    hide-details
                    class="mx-4 mb-2"
                ></v-text-field>
            </v-slide-y-transition>

            <!-- Chat content -->
            <v-card-text class="chat-content-wrapper">
                <div class="chat-content-container">
                    <!-- Loading overlay -->
                    <div v-if="isPlaceholderData" class="table-overlay">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    </div>

                    <!-- Chat messages -->
                    <div ref="msgDOM" class="chat-messages-container">
                        <div v-for="(chat, index) in filteredChatHistory" :key="index" class="mb-4">
                            <div class="justify-end message user-message d-flex align-end ga-1">
                                <div class="text-right message-time text-caption">
                                    {{ formatDateTime(chat.message_create_time) }}
                                </div>
                                <span class="text-caption text-grey-lighten-1">({{ chat.history_message_id }})</span>
                                <div class="message-content" v-dompurify-html="highlightText(chat.input)"></div>
                            </div>
                            <div class="message bot-message">
                                <div class="message-content" v-dompurify-html="highlightText(chat.output)"></div>
                                <span class="text-caption text-grey-lighten-1">({{ chat.history_message_id }})</span>
                            </div>
                            <v-divider :thickness="3"></v-divider>
                        </div>
                    </div>
                </div>
            </v-card-text>

            <!-- Pagination -->
            <div class="pagination-container">
                <v-pagination
                    v-model="currentPage"
                    :length="totalPages"
                    :total-visible="5"
                    dense
                    class="custom-pagination"
                    @update:model-value="handlePageChange"
                ></v-pagination>
            </div>

            <ScrollButton
                v-if="filteredChatHistory.length > 0"
                :targetDOM="msgDOM"
                :position="{ right: '50px', bottom: '100px' }"
                :scrollTopKey="scrollTopKey"
            />
        </v-card>
        <v-card flat height="100%" v-else class="justify-center d-flex align-center">
            <v-card-text>請選擇一個使用者和專家來查看對話歷史</v-card-text>
        </v-card>
    </div>
</template>

<style scoped>
.chat-section {
    height: calc(100vh - 68px);
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    flex: 1;
    will-change: margin-left;
}

.chat-content-wrapper {
    position: relative;
    height: 100%;
    overflow: hidden;
    padding: 0;
    display: flex;
    flex-direction: column;
    flex: 1;
}

.chat-content-container {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: visible;
}

.chat-messages-container {
    height: 100%;
    overflow-y: auto;
    padding: 16px;
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

.pagination-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: white;
    padding: 4px 0;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.message {
    margin-bottom: 3em;
    position: relative;
}

.user-message {
    text-align: right;
}

.bot-message {
    text-align: left;
}

.message-content {
    display: inline-block;
    max-width: 80%;
    padding: 8px 12px;
    border-radius: 18px;
    overflow-wrap: anywhere;
}

.user-message .message-content {
    background-color: #e3f2fd;
}

.bot-message .message-content {
    background-color: #f5f5f5;
}

.message-time {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
}

.chat-search-bar {
    flex: 0;
}

.custom-pagination {
    justify-content: center;
}

.custom-pagination :deep(.v-pagination__item) {
    height: 28px;
    min-width: 28px;
    width: 28px;
    font-size: 0.875rem;
}

.custom-pagination :deep(.v-pagination__navigation) {
    height: 28px;
    width: 28px;
}

.custom-pagination :deep(.v-pagination__navigation .v-icon) {
    font-size: 1rem;
}

mark {
    all: unset;
}

.highlight {
    background-color: yellow;
    font-weight: bold;
}

.v-slide-y-transition-enter-active,
.v-slide-y-transition-leave-active {
    transition: all 0.3s ease;
}

:deep(.v-skeleton-loader__button) {
    margin: 0;
}

::v-deep(.mdi-chevron-left),
::v-deep(.mdi-chevron-right) {
    font-size: 32px !important;
}
</style>
