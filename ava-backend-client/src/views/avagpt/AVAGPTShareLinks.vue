<script setup>
import { ref, computed, inject, watch } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { useDebounceFn, useWindowSize } from "@vueuse/core";
import { zhTW } from "date-fns/locale";

const axios = inject("axios");
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);
const { width: windowWidth } = useWindowSize();
// 創建防抖後的搜尋變數
const debouncedSearchQuery = ref("");

// 日期範圍設定
const dateRanges = [
    {
        icon: "mdi-calendar-today",
        title: "今天",
        start: startOfDay(new Date()),
        end: endOfDay(new Date()),
    },
    {
        icon: "mdi-calendar-week",
        title: "最近 7 天",
        start: subDays(startOfDay(new Date()), 7),
        end: endOfDay(new Date()),
    },
    {
        icon: "mdi-calendar-month",
        title: "最近 30 天",
        start: subDays(startOfDay(new Date()), 30),
        end: endOfDay(new Date()),
    },
    {
        icon: "mdi-calendar-arrow-right",
        title: "最近 90 天",
        start: subDays(startOfDay(new Date()), 90),
        end: endOfDay(new Date()),
    },
];

const selectedDateRange = ref({
    title: "最近 30 天",
    start: subDays(startOfDay(new Date()), 30),
    end: endOfDay(new Date()),
    isCustom: false,
});

// 關閉菜單
const closeMenu = () => {
    menuModel.value = false;
};

// 自定義日期範圍
const customStartDate = ref(format(selectedDateRange.value.start, "yyyy-MM-dd'T'HH:mm"));
const customEndDate = ref(format(selectedDateRange.value.end, "yyyy-MM-dd'T'HH:mm"));

const dateRangeDisplay = computed(() => {
    if (selectedDateRange.value.isCustom) {
        return `${format(selectedDateRange.value.start, "MM/dd")} - ${format(selectedDateRange.value.end, "MM/dd")}`;
    }
    return selectedDateRange.value.title;
});

// 檢查是否為當前選中的日期範圍
const isSelectedDateRange = (range) => {
    if (selectedDateRange.value.isCustom) return false;
    return selectedDateRange.value.title === range.title;
};

// 套用自定義日期範圍
const applyCustomDateRange = () => {
    const start = parseISO(customStartDate.value);
    const end = parseISO(customEndDate.value);

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

// 使用 v-menu 的 v-model
const menuModel = ref(false);

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

// 複製分享連結
const copyShareLink = (url) => {
    navigator.clipboard
        .writeText(url)
        .then(() => {
            alert("連結已複製到剪貼簿");
        })
        .catch((err) => {
            console.error("無法複製連結: ", err);
        });
};

// 格式化日期
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return format(date, "yyyy/MM/dd HH:mm", { locale: zhTW });
};

// 打開共享連結
const openShareLink = (url) => {
    window.open(url, "_blank");
};

const fetchShareLinks = async () => {
    const startDate = format(selectedDateRange.value.start, "yyyy-MM-dd'T'HH:mm:ss");
    const endDate = format(selectedDateRange.value.end, "yyyy-MM-dd'T'HH:mm:ss");

    const { data } = await axios.get(`/avaGPT/share/links`, {
        params: {
            startDate,
            endDate,
            page: currentPage.value,
            limit: itemsPerPage.value,
            searchQuery: debouncedSearchQuery.value,
        },
    });

    if (data.code !== 200) {
        throw new Error(data.message);
    }

    return data.data;
};

const {
    data: shareLinksData,
    refetch,
    isLoading,
    isPlaceholderData,
    isRefetching,
} = useQuery({
    queryKey: ["shareLinks", selectedDateRange, currentPage, itemsPerPage, debouncedSearchQuery],
    queryFn: fetchShareLinks,
    placeholderData: keepPreviousData,
});

// 計算總頁數
const totalPages = computed(() => {
    return shareLinksData.value?.totalPages || 1;
});

// 共享連結列表
const shareLinks = computed(() => {
    return shareLinksData.value?.shares || [];
});

// 監聽日期範圍變化
watch(
    selectedDateRange,
    () => {
        customStartDate.value = format(selectedDateRange.value.start, "yyyy-MM-dd'T'HH:mm");
        customEndDate.value = format(selectedDateRange.value.end, "yyyy-MM-dd'T'HH:mm");
        currentPage.value = 1;
        refetch();
    },
    { immediate: true }
);

// 處理頁碼變更
const handlePageChange = (newPage) => {
    currentPage.value = newPage;
    refetch();
};

const selectDateRange = (range) => {
    selectedDateRange.value = {
        ...range,
        isCustom: false,
    };
    closeMenu();
};
</script>

<template>
    <v-container fluid class="pa-4">
        <v-row>
            <v-col cols="12">
                <!-- 日期範圍選擇區塊 -->
                <v-card class="mb-4 dashboard-card" elevation="1">
                    <v-card-title class="px-6 py-4 d-flex align-center">
                        <div>
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-calendar-range" color="primary" class="me-2"></v-icon>
                                <span class="text-h6 font-weight-medium">共享連結時間範圍</span>
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

                <v-card elevation="2" class="rounded-lg">
                    <v-card-title class="px-4 py-3 d-flex align-center bg-surface-variant">
                        <div class="d-flex align-center text-truncate">
                            <v-icon icon="mdi-share-variant" class="flex-none me-2" />
                            <span class="text-truncate">AVAGPT 共享連結管理</span>
                        </div>
                    </v-card-title>

                    <v-card-text>
                        <v-row align="center">
                            <v-col cols="12" md="8">
                                <v-text-field
                                    v-model="searchQuery"
                                    density="compact"
                                    variant="solo-filled"
                                    label="搜尋標題"
                                    prepend-inner-icon="mdi-magnify"
                                    clearable
                                    hide-details
                                    class="my-4"
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" md="4" class="justify-end d-flex ga-2">
                                <v-btn
                                    color="success"
                                    variant="outlined"
                                    prepend-icon="mdi-refresh"
                                    @click="refetch"
                                    :loading="isRefetching"
                                >
                                    重新整理
                                </v-btn>
                            </v-col>
                        </v-row>

                        <div class="position-relative">
                            <!-- Loading overlay -->
                            <div v-if="isLoading || isPlaceholderData" class="table-overlay">
                                <v-progress-circular indeterminate color="primary"></v-progress-circular>
                            </div>

                            <div v-if="shareLinks.length > 0" class="data-container">
                                <v-table class="share-links-table list-table">
                                    <thead>
                                        <tr>
                                            <th class="text-left">標題</th>
                                            <th class="text-left">建立者</th>
                                            <th class="text-center">訊息數量</th>
                                            <th class="text-center">建立時間</th>
                                            <th class="text-left">連結</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="link in shareLinks"
                                            :key="link._id"
                                            @click="openShareLink(link.shareUrl)"
                                            class="link-row"
                                        >
                                            <td class="text-left text-break">{{ link.title }}</td>
                                            <td class="text-left">{{ link.userName }}</td>
                                            <td class="text-center">{{ link.messagesCount }}</td>
                                            <td class="text-center">{{ formatDate(link.createdAt) }}</td>
                                            <td class="text-left text-truncate link-cell">
                                                <a :href="link.shareUrl" target="_blank" class="link-text" @click.stop>
                                                    {{ link.shareUrl }}
                                                </a>
                                            </td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </div>

                            <div v-else class="justify-center d-flex align-center pa-8">
                                <v-alert
                                    type="info"
                                    variant="tonal"
                                    border="start"
                                    class="ma-2"
                                    text="此時間範圍內無共享連結記錄"
                                ></v-alert>
                            </div>

                            <div class="mt-4 pagination-wrapper">
                                <v-pagination
                                    v-if="totalPages > 1"
                                    v-model="currentPage"
                                    :length="totalPages"
                                    :total-visible="windowWidth > 1100 ? 7 : 5"
                                    @update:model-value="handlePageChange"
                                    density="compact"
                                    rounded="circle"
                                ></v-pagination>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.flex-none {
    flex: none;
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

.data-container {
    overflow-x: auto;
}

.share-links-table {
    width: 100%;
    border-collapse: collapse;
}

.share-links-table th {
    font-weight: 600;
    white-space: nowrap;
}

.share-links-table td {
    vertical-align: middle;
    padding: 10px 16px;
}

.link-row {
    cursor: pointer;
    transition: background-color 0.2s;
}

.link-row:hover {
    background-color: rgba(var(--v-theme-primary), 0.05);
}

.link-cell {
    max-width: 250px;
}

.text-break {
    word-break: break-word;
}

.text-truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pagination-wrapper {
    display: flex;
    justify-content: center;
    padding: 8px 0;
}

.link-text {
    color: rgb(var(--v-theme-primary));
    text-decoration: none;
}

.link-text:hover {
    text-decoration: underline;
}

.list-table {
    table-layout: fixed;
    width: 100%;
}

.list-table td {
    padding: 12px 16px;
    vertical-align: middle;
}

.list-table .text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.list-table tr:hover {
    background-color: #f5f5f5;
}

.list-table th,
.list-table td {
    padding: 0 8px;
    vertical-align: middle;
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

@media (max-width: 600px) {
    .share-links-table th,
    .share-links-table td {
        padding: 8px;
    }
}
</style>
