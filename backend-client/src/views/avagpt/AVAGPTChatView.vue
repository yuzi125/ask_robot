<script setup>
import { ref, computed, watch } from "vue";
import { format, parseISO } from "date-fns";
import UserList from "@/components/avagpt/UserList.vue";
import ConversationList from "@/components/avagpt/ConversationList.vue";
import ChatMessages from "@/components/avagpt/ChatMessages.vue";
import { useElementSize } from "@vueuse/core";

const AVAGPTChatViewRef = ref(null);

const { width } = useElementSize(AVAGPTChatViewRef);

const selectedUserId = ref(null);
const selectedConversation = ref(null);

// 日期範圍設定
const dateRanges = [
    {
        icon: "mdi-calendar-today",
        title: "今天",
        start: () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today;
        },
        end: () => {
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            return today;
        },
    },
    {
        icon: "mdi-calendar-week",
        title: "最近 7 天",
        start: () => {
            const date = new Date();
            date.setDate(date.getDate() - 6);
            date.setHours(0, 0, 0, 0);
            return date;
        },
        end: () => {
            const date = new Date();
            date.setHours(23, 59, 59, 999);
            return date;
        },
    },
    {
        icon: "mdi-calendar-month",
        title: "最近 30 天",
        start: () => {
            const date = new Date();
            date.setDate(date.getDate() - 29);
            date.setHours(0, 0, 0, 0);
            return date;
        },
        end: () => {
            const date = new Date();
            date.setHours(23, 59, 59, 999);
            return date;
        },
    },
    {
        icon: "mdi-calendar-arrow-right",
        title: "最近 90 天",
        start: () => {
            const date = new Date();
            date.setDate(date.getDate() - 89);
            date.setHours(0, 0, 0, 0);
            return date;
        },
        end: () => {
            const date = new Date();
            date.setHours(23, 59, 59, 999);
            return date;
        },
    },
];

const selectedDateRange = ref({
    title: "最近 7 天",
    start: dateRanges[1].start(),
    end: dateRanges[1].end(),
    isCustom: false,
});

// 日期顯示
const dateRangeDisplay = computed(() => {
    if (selectedDateRange.value.isCustom) {
        return `${format(selectedDateRange.value.start, "MM/dd")} - ${format(selectedDateRange.value.end, "MM/dd")}`;
    }
    return selectedDateRange.value.title;
});

// 自定義日期範圍
const customStartDate = ref(format(selectedDateRange.value.start, "yyyy-MM-dd'T'HH:mm"));
const customEndDate = ref(format(selectedDateRange.value.end, "yyyy-MM-dd'T'HH:mm"));

// 使用 v-menu 的 v-model
const menuModel = ref(false);

// 檢查是否為當前選中的日期範圍
const isSelectedDateRange = (range) => {
    if (selectedDateRange.value.isCustom) return false;
    return selectedDateRange.value.title === range.title;
};

// 選擇日期範圍
const selectDateRange = (range) => {
    selectedDateRange.value = {
        ...range,
        start: range.start(),
        end: range.end(),
        isCustom: false,
    };
    closeMenu();
};

// 關閉菜單
const closeMenu = () => {
    menuModel.value = false;
};

// 套用自定義日期範圍
const applyCustomDateRange = () => {
    const start = parseISO(customStartDate.value);
    start.setHours(0, 0, 0, 0);

    const end = parseISO(customEndDate.value);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return;
    }

    selectedDateRange.value = {
        title: "自訂範圍",
        start,
        end,
        isCustom: true,
    };

    closeMenu();
};

const handleUserSelect = (user) => {
    selectedUserId.value = user.userId;
    selectedConversation.value = null;
};

const handleConversationSelect = (conversation) => {
    selectedConversation.value = conversation;
};

// 監聽日期範圍變化，更新自定義日期欄位
watch(
    selectedDateRange,
    () => {
        const startDate = new Date(selectedDateRange.value.start);
        customStartDate.value = format(startDate, "yyyy-MM-dd'T'HH:mm");

        const endDate = new Date(selectedDateRange.value.end);
        customEndDate.value = format(endDate, "yyyy-MM-dd'T'HH:mm");
    },
    { immediate: true }
);
</script>

<template>
    <v-container fluid class="chat-container pa-2" ref="AVAGPTChatViewRef">
        <!-- 日期範圍選擇區塊 -->
        <v-card class="mb-4 dashboard-card" elevation="1">
            <v-card-title class="px-6 py-4 d-flex align-center">
                <div>
                    <div class="d-flex align-center">
                        <v-icon icon="mdi-calendar-range" color="primary" class="me-2"></v-icon>
                        <span class="text-h6 font-weight-medium">對話時間範圍</span>
                    </div>
                    <div class="mt-1 text-subtitle-2 text-grey-darken-1">
                        {{ dateRangeDisplay }}
                    </div>
                </div>
                <v-spacer></v-spacer>
                <v-menu v-model="menuModel" :close-on-content-click="false" location="bottom end">
                    <template v-slot:activator="{ props }">
                        <v-btn
                            variant="outlined"
                            color="primary"
                            v-bind="props"
                            class="date-range-btn d-flex align-center"
                        >
                            <v-icon class="me-2">mdi-calendar-edit</v-icon>
                            <span>變更日期範圍</span>
                        </v-btn>
                    </template>

                    <v-card min-width="300" class="date-range-menu">
                        <v-card-title class="px-4 py-2 d-flex align-center bg-surface-variant">
                            <v-icon icon="mdi-calendar-range" class="me-2" />
                            選擇日期範圍
                            <v-spacer></v-spacer>
                            <v-btn icon="mdi-close" variant="text" size="small" @click="closeMenu"></v-btn>
                        </v-card-title>

                        <v-card-text class="px-2 py-2">
                            <v-list density="compact" nav class="mb-2 date-range-list">
                                <v-list-item
                                    v-for="(range, index) in dateRanges"
                                    :key="index"
                                    @click="selectDateRange(range)"
                                    :active="isSelectedDateRange(range)"
                                    :title="range.title"
                                    :prepend-icon="range.icon"
                                    rounded="lg"
                                    class="mb-1"
                                ></v-list-item>
                            </v-list>

                            <v-divider class="mb-3"></v-divider>

                            <div class="custom-range">
                                <div class="mb-2 text-subtitle-2 font-weight-medium">自訂範圍</div>
                                <v-row dense>
                                    <v-col cols="12">
                                        <v-text-field
                                            v-model="customStartDate"
                                            type="datetime-local"
                                            label="開始時間"
                                            variant="outlined"
                                            density="compact"
                                            bg-color="white"
                                            hide-details
                                            class="mb-2"
                                        ></v-text-field>
                                    </v-col>
                                    <v-col cols="12">
                                        <v-text-field
                                            v-model="customEndDate"
                                            type="datetime-local"
                                            label="結束時間"
                                            variant="outlined"
                                            density="compact"
                                            bg-color="white"
                                            hide-details
                                            class="mb-2"
                                        ></v-text-field>
                                    </v-col>
                                </v-row>
                                <v-btn color="primary" block size="small" @click="applyCustomDateRange" class="mt-2">
                                    套用自訂範圍
                                </v-btn>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-menu>
            </v-card-title>
        </v-card>

        <v-row class="fill-height g-0">
            <!-- 使用者列表 -->
            <v-col cols="12" sm="5" md="4" lg="3" class="pr-md-1">
                <UserList @select-user="handleUserSelect" :date-range="selectedDateRange" :elementWidth="width" />
            </v-col>

            <!-- 對話列表 -->
            <v-col cols="12" sm="6" md="3" lg="3" class="px-md-1">
                <ConversationList
                    :userId="selectedUserId"
                    :date-range="selectedDateRange"
                    @select-conversation="handleConversationSelect"
                    :elementWidth="width"
                />
            </v-col>

            <!-- 對話內容 -->
            <v-col cols="12" md="5" lg="6" class="pl-md-1">
                <ChatMessages
                    :userId="selectedUserId"
                    :conversation="selectedConversation"
                    :date-range="selectedDateRange"
                />
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.chat-container {
    height: calc(100vh - 70px);
    max-height: calc(100vh - 70px);
    overflow-x: hidden !important;
    padding: 16px !important;
}

.fill-height {
    height: 100%;
    min-height: 0;
}

.v-col {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.g-0 {
    --v-gutter-x: 4px !important;
    --v-gutter-y: 4px !important;
}

.dashboard-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05) !important;
    background-color: white;
    transition: transform 0.2s, box-shadow 0.2s;
}

.dashboard-card:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
}

.date-range-btn {
    height: 40px;
}

.date-range-menu {
    border-radius: 8px;
    overflow: hidden;
}

.date-range-list {
    border-radius: 8px;
    overflow: hidden;
}

.date-range-list :deep(.v-list-item--active) {
    background-color: rgb(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}

.date-range-list :deep(.v-list-item) {
    min-height: 40px;
}

.custom-range {
    border-radius: 8px;
    padding: 16px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    background-color: white;
}
</style>
