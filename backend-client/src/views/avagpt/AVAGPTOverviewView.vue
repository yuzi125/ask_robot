<script setup>
import { ref, computed, inject, watch } from "vue";
import { format, parseISO } from "date-fns";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import MessageStats from "@/components/avagpt/overview/MessageStats.vue";
import ModelCostStats from "@/components/avagpt/overview/ModelCostStats.vue";
import TopUsersStats from "@/components/avagpt/overview/TopUsersStats.vue";

const axios = inject("axios");

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
            date.setDate(date.getDate() - 6); // 今天+前6天=7天
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
            date.setDate(date.getDate() - 29); // 今天+前29天=30天
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
            date.setDate(date.getDate() - 89); // 今天+前89天=90天
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
        // 日期無效，使用默認值
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

// 取得訊息統計數據
const fetchMessageStatistics = async () => {
    const startDate = format(selectedDateRange.value.start, "yyyy-MM-dd'T'HH:mm:ss");
    const endDate = format(selectedDateRange.value.end, "yyyy-MM-dd'T'HH:mm:ss");

    const { data } = await axios.get(`/avaGPT/chat/statistics`, {
        params: {
            startDate,
            endDate,
        },
    });

    if (data.code !== 200) {
        throw new Error(data.message);
    }

    return data.data;
};

// 取得 token 費用統計數據
const fetchTokenData = async () => {
    const startDate = format(selectedDateRange.value.start, "yyyy-MM-dd'T'HH:mm:ss");
    const endDate = format(selectedDateRange.value.end, "yyyy-MM-dd'T'HH:mm:ss");

    const { data } = await axios.get(`/avaGPT/chat/token`, {
        params: {
            startDate,
            endDate,
        },
    });

    if (data.code !== 200) {
        throw new Error(data.message);
    }

    return data.data;
};

const refetchInterval = 30000;

// 獲取訊息統計
const {
    data: messageStatistics,
    refetch: refetchMessages,
    isPlaceholderData: isMessagesPlaceholderData,
} = useQuery({
    queryKey: ["message-statistics", selectedDateRange],
    queryFn: fetchMessageStatistics,
    placeholderData: keepPreviousData,
    refetchInterval,
});

// 獲取 token 費用統計
const {
    data: tokenStatistics,
    refetch: refetchTokens,
    isPlaceholderData: isTokensPlaceholderData,
} = useQuery({
    queryKey: ["token-cost-statistics", selectedDateRange],
    queryFn: fetchTokenData,
    placeholderData: keepPreviousData,
    refetchInterval,
});

// 監聽日期範圍變化
watch(
    selectedDateRange,
    () => {
        // 使用帶時間的格式更新自定義日期欄位
        const startDate = new Date(selectedDateRange.value.start);
        customStartDate.value = format(startDate, "yyyy-MM-dd'T'HH:mm");

        const endDate = new Date(selectedDateRange.value.end);
        customEndDate.value = format(endDate, "yyyy-MM-dd'T'HH:mm");

        refetchMessages();
        refetchTokens();
    },
    { immediate: true }
);
</script>

<template>
    <div class="overview-container">
        <v-row>
            <v-col cols="12">
                <v-card class="dashboard-card" elevation="1">
                    <v-card-title class="px-6 py-4 d-flex align-center">
                        <div>
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-calendar-range" color="primary" class="me-2"></v-icon>
                                <span class="text-h6 font-weight-medium">統計數據時間範圍</span>
                            </div>
                            <div class="d-flex align-center">
                                <div class="mt-1 ga-1 d-flex align-center text-subtitle-2 text-grey-darken-1">
                                    {{ dateRangeDisplay }} •
                                    <div class="d-flex align-center text-body-2 text-medium-emphasis">
                                        <v-icon icon="mdi-pulse" size="small" class="mr-1" />
                                        每 30 秒自動更新
                                    </div>
                                </div>
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
                                        <v-btn
                                            color="primary"
                                            block
                                            size="small"
                                            @click="applyCustomDateRange"
                                            class="mt-2"
                                        >
                                            套用自訂範圍
                                        </v-btn>
                                    </div>
                                </v-card-text>
                            </v-card>
                        </v-menu>
                    </v-card-title>
                </v-card>

                <!-- 訊息統計元件 -->
                <div class="gap-8 d-flex flex-column">
                    <!-- 訊息統計區塊 -->
                    <v-card class="dashboard-card" elevation="1">
                        <v-card-title class="px-6 py-4 d-flex align-center bg-primary-lighten-5">
                            <v-icon icon="mdi-message-text" color="primary" size="large" class="me-3" />
                            <div>
                                <h2 class="mb-0 text-h5 font-weight-bold">訊息統計</h2>
                                <p class="mt-1 mb-0 text-body-2 text-grey-darken-1">
                                    顯示 AVA-GPT 對話訊息相關數據 • {{ dateRangeDisplay }}
                                </p>
                            </div>
                        </v-card-title>
                        <v-card-text class="px-6 py-4">
                            <MessageStats
                                :statistics="messageStatistics"
                                :isPlaceholderData="isMessagesPlaceholderData"
                                @refresh="refetchMessages"
                            />
                        </v-card-text>
                    </v-card>

                    <!-- Token費用統計區塊 -->
                    <v-card class="dashboard-card" elevation="1">
                        <v-card-title class="px-6 py-4 d-flex align-center bg-success-lighten-5">
                            <v-icon icon="mdi-cash-multiple" color="success" size="large" class="me-3" />
                            <div>
                                <h2 class="mb-0 text-h5 font-weight-bold">Token 費用統計</h2>
                                <p class="mt-1 mb-0 text-body-2 text-grey-darken-1">
                                    顯示 API 使用成本相關數據與模型費用分佈 • {{ dateRangeDisplay }}
                                </p>
                            </div>
                        </v-card-title>
                        <v-card-text class="px-6 py-4">
                            <ModelCostStats
                                :statistics="tokenStatistics"
                                :isPlaceholderData="isTokensPlaceholderData"
                                @refresh="refetchTokens"
                            />
                        </v-card-text>
                    </v-card>

                    <!-- Top 10 使用者統計區塊 -->
                    <v-card class="dashboard-card" elevation="1">
                        <v-card-title class="px-6 py-4 d-flex align-center bg-info-lighten-5">
                            <v-icon icon="mdi-account-group" color="info" size="large" class="me-3" />
                            <div>
                                <h2 class="mb-0 text-h5 font-weight-bold">Top 10 使用者統計</h2>
                                <p class="mt-1 mb-0 text-body-2 text-grey-darken-1">
                                    顯示使用者對話次數 • {{ dateRangeDisplay }}
                                </p>
                            </div>
                        </v-card-title>
                        <v-card-text class="px-6 py-4">
                            <TopUsersStats :dateRange="selectedDateRange" @refresh="refetchMessages" />
                        </v-card-text>
                    </v-card>

                    <!-- 這裡可以添加其他類型的圖表和統計信息 -->
                </div>
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
.overview-container {
    padding: 8px 16px;
    /* background-color: #f5f7fa; */
    min-height: calc(100vh - 70px);
}

.dashboard-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05) !important;
    background-color: white;
    transition: transform 0.2s, box-shadow 0.2s;
    margin-block: 10px;
}

.dashboard-card:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
}

.bg-primary-lighten-5 {
    background-color: rgba(var(--v-theme-primary), 0.05) !important;
}

.bg-success-lighten-5 {
    background-color: rgba(var(--v-theme-success), 0.05) !important;
}

.bg-info-lighten-5 {
    background-color: rgba(var(--v-theme-info), 0.05) !important;
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

/* .sticky-top {
    position: sticky;
    top: 0px;
    padding: 10px;
    background-color: white;
    border-bottom: 2px solid rgba(128, 128, 128, 0.3);
    z-index: 1000;
} */
</style>
