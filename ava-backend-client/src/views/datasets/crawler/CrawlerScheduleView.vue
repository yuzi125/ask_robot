<script setup>
import { ref, computed, onMounted, toRefs, inject, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";
import CrawlerSyncDialog from "@/components/common/crawler/CrawlerSyncDialog.vue";
import ColumnSettings from "@/components/common/ColumnSettings.vue";
import SystemHeader from "@/components/system/SystemHeader.vue";
import { useShowTableColumns } from "@/composables";
import { useRoute, useRouter } from "vue-router";
import { usePermissionChecker } from "@/composables";

const axios = inject("axios");
const emitter = inject("emitter");
const props = defineProps({
    datasets_id: { type: String, default: {} },
});

const { datasets_id } = toRefs(props);
const filterOption = ref("all");
const autoSyncDialog = ref(false);
const deleteAutoSyncDialog = ref(false);
const currentItem = ref(null);

const syncDays = ref(null);
const syncTime = ref("");
const isSaving = ref(false);
const isDeleting = ref(false);

const route = useRoute();
const router = useRouter();

const { canPerformAction: canOperateCrawler } = usePermissionChecker("allowedToCreateAndCancelCrawler");

// 顯示模式
const viewMode = ref("list"); // 'list' 或 'grid'

// 分頁相關狀態
const currentPage = ref(parseInt(route.query.page) || 1);
const itemsPerPage = ref(parseInt(route.query.perPage) || 10);
const pageInput = ref(currentPage.value);

// 搜尋相關狀態
const searchQuery = ref("");

// 修改排序狀態管理
const sortBy = ref(null);
const sortDesc = ref(false);
const hoveredColumn = ref(null);

// 修改排序函數
function sort(column) {
    if (sortBy.value === column) {
        sortDesc.value = !sortDesc.value;
    } else {
        sortBy.value = column;
        sortDesc.value = false;
    }
}

// 新增 hover 處理函數
function handleHover(column) {
    hoveredColumn.value = column;
}

function handleHoverLeave() {
    hoveredColumn.value = null;
}

// 新增獲取排序圖標的函數
function getSortIcon(column) {
    if (sortBy.value === column) {
        return sortDesc.value ? "mdi-arrow-down" : "mdi-arrow-up";
    }
    return hoveredColumn.value === column ? "mdi-arrow-up" : "mdi-blank";
}
const paginatedItems = computed(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage.value;
    const endIndex = startIndex + itemsPerPage.value;
    return sortedItems.value.slice(startIndex, endIndex);
});

const totalPages = computed(() => Math.ceil(filteredItems.value.length / itemsPerPage.value));
const totalVisible = computed(() => (window.innerWidth < 600 ? 3 : 7));

const getCrawlerScheduleList = async () => {
    const { data } = await axios.get(`/crawler/getCrawlerScheduleList/${datasets_id.value}`);
    if (data.code === 0) {
        return data.data;
    }
    throw new Error("Failed to fetch crawler list");
};

const {
    data: crawlerScheduleList,
    isSuccess,
    isLoading,
    isError,
    error,
    refetch,
} = useQuery({
    queryKey: ["crawlerScheduleList", datasets_id],
    queryFn: getCrawlerScheduleList,
});

const filteredItems = computed(() => {
    if (!crawlerScheduleList.value) return [];
    let allItems = crawlerScheduleList.value;

    // 搜尋過濾
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        console.log(allItems);
        allItems = allItems.filter((item) => item.title.toLowerCase().includes(query));
    }
    return allItems;
});

const sortedItems = computed(() => {
    return [...filteredItems.value].sort((a, b) => {
        let aValue = a[sortBy.value];
        let bValue = b[sortBy.value];

        // 特殊處理 next_sync_date
        if (sortBy.value === "next_sync_date") {
            aValue = new Date(aValue || 0).getTime();
            bValue = new Date(bValue || 0).getTime();
        }

        if (aValue < bValue) return sortDesc.value ? 1 : -1;
        if (aValue > bValue) return sortDesc.value ? -1 : 1;
        return 0;
    });
});

function getColumnLabel(column) {
    const labels = {
        title: "網站名稱",
        sync_days: "同步天數",
        sync_time: "同步時間",
        next_sync_date: "下次同步時間",
    };
    return labels[column] || column;
}

const hasNoData = computed(
    () => !isLoading.value && crawlerScheduleList.value && crawlerScheduleList.value.length === 0
);
const hasNoSearchResults = computed(
    () =>
        !isLoading.value &&
        crawlerScheduleList.value &&
        crawlerScheduleList.value.length > 0 &&
        filteredItems.value.length === 0
);

// 選取相關狀態
const selectedItems = ref([]);

// 判斷項目是否可被選擇
const isItemSelectable = computed(() => {
    return () => true;
});
// 更新：檢查當前頁面是否全選

const isCurrentPageAllSelected = computed(() => {
    const selectableItems = paginatedItems.value;
    return selectableItems.length > 0 && selectableItems.every((item) => selectedItems.value.includes(item.id));
});

// 更新：控制批量加入按鈕的禁用狀態
const isBatchAddDisabled = computed(() => {
    return !selectedItems.value.some((id) => {
        const item = crawlerScheduleList.value.find((i) => i.id === id);
        return item && item.training_state !== 1 && item.training_state !== 2 && item.training_state !== 3;
    });
});

// 更新：可加入的項目數量
const addableItemsCount = computed(() => {
    return selectedItems.value.filter((id) => {
        const item = crawlerScheduleList.value.find((i) => i.id === id);
        return item && item.training_state !== 1 && item.training_state !== 2 && item.training_state !== 3;
    }).length;
});

function toggleItemSelection(itemId) {
    if (!canOperateCrawler.value) return;

    const index = selectedItems.value.indexOf(itemId);
    if (index > -1) {
        selectedItems.value.splice(index, 1);
    } else {
        selectedItems.value.push(itemId);
    }
}

function toggleSelectAll() {
    if (isCurrentPageAllSelected.value) {
        // 取消選擇所有項目
        selectedItems.value = selectedItems.value.filter((id) => !paginatedItems.value.some((item) => item.id === id));
    } else {
        // 選擇所有項目
        paginatedItems.value.forEach((item) => {
            if (!selectedItems.value.includes(item.id)) {
                selectedItems.value.push(item.id);
            }
        });
    }
}

function selectRow(item, event) {
    // 如果點擊的是按鈕或複選框，不進行行選擇
    if (event.target.tagName === "BUTTON" || event.target.type === "checkbox") {
        return;
    }
    toggleItemSelection(item.id);
}

// 輔助函數
function getAddableIds() {
    return selectedItems.value.filter((id) => {
        const item = crawlerScheduleList.value.find((i) => i.id === id);
        return item && item.training_state !== 1 && item.training_state !== 2 && item.training_state !== 3;
    });
}

watch(itemsPerPage, () => {
    currentPage.value = 1;
    pageInput.value = 1;
});

watch(
    () => route.query,
    (newQuery) => {
        const newPage = parseInt(newQuery.page) || 1;
        const newPerPage = parseInt(newQuery.perPage) || 10;

        if (currentPage.value !== newPage || itemsPerPage.value !== newPerPage) {
            currentPage.value = newPage;
            itemsPerPage.value = newPerPage;
            pageInput.value = newPage;
            refetch();
        }
    },
    { immediate: true }
);

// 更新 URL 當頁面或每頁項目數變化時
watch([currentPage, itemsPerPage], ([newPage, newPerPage]) => {
    if (route.query.page !== newPage.toString() || route.query.perPage !== newPerPage.toString()) {
        router.push({
            query: {
                ...route.query,
                page: newPage,
                perPage: newPerPage,
            },
        });
    }
});

// 更新 jumpToPage 函數
function jumpToPage() {
    const page = parseInt(pageInput.value);
    if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
        router.push({
            query: {
                ...route.query,
                page: page,
            },
        });
    }
    pageInput.value = currentPage.value;
}

// 更新監聽器
watch(itemsPerPage, (newPerPage) => {
    currentPage.value = 1;
    pageInput.value = 1;
    router.push({
        query: {
            ...route.query,
            page: 1,
            perPage: newPerPage,
        },
    });
});

// 監聽搜尋查詢和過濾選項的變化
// todo: 現在好像會因為 router.push 的關係 導致 tanstack 以為 query 改變了，然後重新 fetch 需要調整
// watch([searchQuery, filterOption], () => {
//     currentPage.value = 1;
//     pageInput.value = 1;
//     router.push({
//         query: {
//             ...route.query,
//             page: 1,
//             search: searchQuery.value,
//             filter: filterOption.value,
//         },
//     });
// });

// 在組件掛載時初始化
onMounted(() => {
    // 如果是初次載入且 URL 中沒有分頁參數，需要新增一個歷史記錄，ㄅ然記錄會被吃掉
    if (!route.query.page && !route.query.perPage) {
        router.replace({
            query: {
                ...route.query,
                page: currentPage.value,
                perPage: itemsPerPage.value,
            },
        });
    }

    // 處理瀏覽器後退/前進
    window.addEventListener("popstate", () => {
        const newPage = parseInt(route.query.page) || 1;
        const newPerPage = parseInt(route.query.perPage) || 10;
        if (currentPage.value !== newPage || itemsPerPage.value !== newPerPage) {
            currentPage.value = newPage;
            itemsPerPage.value = newPerPage;
            pageInput.value = newPage;
            refetch();
        }
    });
});

// 同步週期相關

async function openAutoSyncBatchDialog(crawlerSyncDialog) {
    const selectedIds = getAddableIds();
    currentItem.value = crawlerScheduleList.value.filter((item) => selectedIds.includes(item.id));
    crawlerSyncDialog.openSyncDialog(currentItem.value, 0);
}

async function openDeleteAutoSyncBatchDialog() {
    const selectedIds = getAddableIds();
    currentItem.value = crawlerScheduleList.value.filter((item) => selectedIds.includes(item.id));
    deleteAutoSyncDialog.value = true;
}

async function openAutoSyncDialog(item) {
    currentItem.value = item;
    autoSyncDialog.value = true;
    await fetchSyncSettings(item.crawler_id);
}

async function openDeleteAutoSyncDialog(item) {
    currentItem.value = item;
    deleteAutoSyncDialog.value = true;
}

const formatNextSyncDate = (dateString) => {
    if (!dateString) return "尚未設定";
    const date = new Date(dateString);
    return date.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

const isSyncDaysValid = computed(() => {
    return syncDays.value !== null && syncDays.value !== "" && Number(syncDays.value) > 0;
});

const isSyncSettingComplete = computed(() => {
    return isSyncDaysValid.value && syncTime.value !== "" && syncTime.value !== null;
});

const syncSettingMessage = computed(() => {
    if (!isSyncSettingComplete.value) return "";
    const syncDate = calculateSyncDate();
    return `今天是 ${formatDate(new Date())}，設定 ${syncDays.value} 天 ${
        syncTime.value
    }，則會在 ${syncDate} 左右執行同步。`;
});

const formatDate = (date) => {
    return date.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
};
const calculateSyncDate = () => {
    if (!isSyncSettingComplete.value) return "";

    if (syncTime.value?.split(":")) {
        const today = new Date();
        const syncDate = new Date(today.setDate(today.getDate() + Number(syncDays.value)));
        const [hours, minutes] = syncTime.value.split(":");
        syncDate.setHours(Number(hours), Number(minutes), 0, 0);
        return formatDate(syncDate) + " " + syncTime.value;
    }
};

const validateSyncDays = () => {
    const days = Number(syncDays.value);
    if (isNaN(days) || days <= 0) {
        syncDays.value = null;
        syncTime.value = "";
    }
};

function closeAutoSyncDialog() {
    autoSyncDialog.value = false;
    syncDays.value = null;
    syncTime.value = "";
}

function closeDeleteAutoSyncDialog() {
    deleteAutoSyncDialog.value = false;
}

async function fetchSyncSettings(crawlerId) {
    try {
        const response = await axios.get(`/crawler/getCrawlerSiteSyncSettings`, {
            params: {
                datasetsId: props.datasets_id,
                crawlerId: crawlerId,
            },
        });

        if (response.data.code === 0) {
            const data = response.data.data;
            syncDays.value = data.sync_days;
            syncTime.value = data.sync_time.slice(0, 5); // 取 HH:MM 部分
        }
    } catch (error) {
        console.error("Error fetching sync settings:", error);
        // 處理錯誤，可能需要顯示錯誤消息給用戶
    }
}

async function saveAutoSync() {
    let crawlerIds;

    // 判斷是不是陣列
    if (!Array.isArray(currentItem.value)) {
        crawlerIds = [currentItem.value.crawler_id];
    } else {
        crawlerIds = currentItem.value.map((item) => item.crawler_id);
    }
    isSaving.value = true;
    try {
        const response = await axios.post("/crawler/syncCrawlerSchedule", {
            datasetsId: props.datasets_id,
            crawlerIds: crawlerIds,
            syncDays: syncDays.value,
            syncTime: syncTime.value,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "成功更新同步時間", color: "success" });
            refetch();
        }
        autoSyncDialog.value = false;
    } catch (error) {
        console.error("Error saving sync settings:", error);
        // 處理錯誤，可能需要顯示錯誤消息給用戶
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    } finally {
        isSaving.value = false;
    }
}

async function deleteAutoSync() {
    let crawlerIds;

    // 判斷是不是陣列
    if (!Array.isArray(currentItem.value)) {
        crawlerIds = [currentItem.value.crawler_id];
    } else {
        crawlerIds = currentItem.value.map((item) => item.crawler_id);
    }
    isDeleting.value = true;
    try {
        const response = await axios.delete("/crawler/deleteCrawlerSchedule", {
            data: { datasetsId: props.datasets_id, crawlerIds: crawlerIds },
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "成功刪除自動同步設置", color: "success" });
            refetch();
            closeDeleteAutoSyncDialog();
        }
    } catch (error) {
        console.error("Error deleting auto sync:", error);
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    } finally {
        isDeleting.value = false;
    }
}

const tableConfig = {
    columnLabels: {
        title: "網站名稱",
        sync_days: "同步天數",
        sync_time: "同步時間",
        next_sync_date: "下次同步日期",
    },
    allColumns: ["title", "sync_days", "sync_time", "next_sync_date"],
    storageKey: "crawler-sync-table-columns",
    requiredFields: ["title"], // 假設網站名稱是必要欄位
};

const { columnLabels, allColumns, requiredFields, visibleColumns } = useShowTableColumns(tableConfig);

const delayHours = ref(0);
const delayMinutes = ref(0);
const delaySyncDialog = ref(false);

const openDelaySyncDialog = (item) => {
    currentItem.value = item;
    delaySyncDialog.value = true;
    delayHours.value = 0;
    delayMinutes.value = 0;
};

const closeDelaySyncDialog = () => {
    delaySyncDialog.value = false;
    delayHours.value = 0;
    delayMinutes.value = 0;
};

// Add function to save delay
const saveDelay = async () => {
    let syncItems;

    if (!Array.isArray(currentItem.value)) {
        syncItems = [{ crawlerId: currentItem.value.crawler_id, datasetId: currentItem.value.dataset_id }];
    } else {
        syncItems = currentItem.value.map((item) => ({
            crawlerId: item.crawler_id,
            datasetId: item.dataset_id,
        }));
    }

    isSaving.value = true;
    try {
        const response = await axios.post("/system/delayCrawlerSchedule", {
            syncItems,
            delayHours: delayHours.value,
            delayMinutes: delayMinutes.value,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "成功延遲同步時間", color: "success" });
            refetch();
            delaySyncDialog.value = false;
        }
    } catch (error) {
        console.error("Error saving delay settings:", error);
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    } finally {
        isSaving.value = false;
    }
};

const crawlerSyncDialog = ref(null);
</script>

<template>
    <v-container fluid>
        <div>
            <SystemHeader
                title="爬蟲 - 排程"
                subtitle="設定爬蟲的同步排程，讓爬蟲在指定時間自動同步網站內容。"
                icon="fa-solid fa-clock"
            />

            <!-- 載入的時候顯示 skeleton -->
            <v-row v-if="isLoading">
                <v-col>
                    <v-skeleton-loader type="table" :loading="true"></v-skeleton-loader>
                </v-col>
            </v-row>

            <!-- 錯誤顯示 -->
            <v-row v-else-if="isError" class="justify-center fill-height align-center">
                <v-col cols="12" class="text-center">
                    <p class="text-error">載入失敗: {{ error.message }}</p>
                </v-col>
            </v-row>

            <!-- 無數據顯示 EmptyState -->
            <v-row v-else-if="hasNoData" class="justify-center fill-height align-center">
                <EmptyStateNoData
                    headline="尚未設定任何爬蟲排程"
                    text="目前還沒有設定任何爬蟲的自動同步排程。設定排程後，爬蟲將會按照指定的時間自動執行同步，方便您管理網站內容的更新。"
                />
            </v-row>

            <v-card class="content-card" v-else>
                <v-card-text>
                    <div class="sticky-header">
                        <div class="overflow-x-auto flex-nowrap py-2 d-flex align-center justify-space-between">
                            <v-text-field
                                v-model="searchQuery"
                                label="搜尋網站名稱"
                                prepend-inner-icon="mdi-magnify"
                                hide-details
                                class="mr-2 search-field"
                            ></v-text-field>

                            <div class="flex-nowrap d-flex align-center">
                                <div class="d-flex">
                                    <ColumnSettings
                                        v-model="visibleColumns"
                                        :headers="allColumns"
                                        :header-labels="columnLabels"
                                        :required-fields="requiredFields"
                                        :storage-key="tableConfig.storageKey"
                                        class="mr-1"
                                    />
                                    <v-btn
                                        :disabled="isBatchAddDisabled"
                                        :color="addableItemsCount > 0 ? 'blue' : ''"
                                        class="mr-1 batch-btn"
                                        @click="openAutoSyncBatchDialog($refs.crawlerSyncDialog)"
                                        v-if="canOperateCrawler"
                                    >
                                        批量設定({{ addableItemsCount }})
                                    </v-btn>
                                    <v-btn
                                        :disabled="isBatchAddDisabled"
                                        :color="addableItemsCount > 0 ? 'red-darken-3' : ''"
                                        class="batch-btn"
                                        @click="openDeleteAutoSyncBatchDialog()"
                                        v-if="canOperateCrawler"
                                    >
                                        批量刪除({{ addableItemsCount }})
                                    </v-btn>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 syncWeb">
                        <!-- 列表模式 -->
                        <v-table class="elevation-1 list-table">
                            <thead>
                                <tr>
                                    <!-- 複選框欄位 -->
                                    <th class="text-center checkbox-column" v-if="canOperateCrawler">
                                        <v-checkbox
                                            :model-value="isCurrentPageAllSelected"
                                            @click="toggleSelectAll"
                                            :disabled="
                                                paginatedItems.length === 0 ||
                                                !paginatedItems.some((item) => isItemSelectable(item))
                                            "
                                            hide-details
                                            density="compact"
                                        />
                                    </th>

                                    <!-- 動態欄位 -->
                                    <th
                                        v-for="column in visibleColumns"
                                        :key="column"
                                        class="text-left sortable-header"
                                        :class="column + '-column'"
                                        @click="sort(column)"
                                        @mouseover="handleHover(column)"
                                        @mouseleave="handleHoverLeave"
                                    >
                                        <div class="header-content">
                                            <span>{{ columnLabels[column] }}</span>
                                            <v-icon small class="sort-icon" :class="{ visible: getSortIcon(column) }">
                                                {{ getSortIcon(column) || "mdi-blank" }}
                                            </v-icon>
                                        </div>
                                    </th>

                                    <!-- 操作欄位 -->
                                    <th class="text-center action-column">操作</th>
                                </tr>
                            </thead>

                            <tbody>
                                <!-- 載入中狀態 -->
                                <template v-if="!isSuccess">
                                    <tr v-for="n in 5" :key="n">
                                        <td v-for="m in 3" :key="m">
                                            <v-skeleton-loader type="text" />
                                        </td>
                                    </tr>
                                </template>

                                <!-- 資料列表 -->
                                <template v-else>
                                    <tr
                                        v-for="item in paginatedItems"
                                        :key="item.id"
                                        @click="selectRow(item, $event)"
                                        :class="{
                                            'selected-row': selectedItems.includes(item.id),
                                            'hoverable-row': true,
                                        }"
                                    >
                                        <!-- 複選框 -->
                                        <td class="text-center checkbox-column" @click.stop v-if="canOperateCrawler">
                                            <v-checkbox
                                                :model-value="selectedItems.includes(item.id)"
                                                hide-details
                                                density="compact"
                                                @click.stop="toggleItemSelection(item.id)"
                                            />
                                        </td>

                                        <!-- 動態內容欄位 -->
                                        <td
                                            v-for="column in visibleColumns"
                                            :key="column"
                                            :class="`text-left ${column}-column`"
                                        >
                                            <template v-if="column === 'sync_days'">
                                                {{ item.sync_days ? item.sync_days + " 天" : "尚未設定" }}
                                            </template>
                                            <template v-else-if="column === 'sync_time'">
                                                {{ item.sync_time ? item.sync_time : "尚未設定" }}
                                            </template>
                                            <template v-else-if="column === 'next_sync_date'">
                                                {{ formatNextSyncDate(item.next_sync_date) }}
                                            </template>
                                            <template v-else>
                                                {{ item[column] }}
                                            </template>
                                        </td>

                                        <!-- 操作欄位 -->
                                        <td class="text-center">
                                            <v-menu>
                                                <template v-slot:activator="{ props }">
                                                    <v-btn icon="mdi-dots-vertical" variant="text" v-bind="props" />
                                                </template>
                                                <v-list>
                                                    <v-list-item
                                                        @click.stop="$refs.crawlerSyncDialog.openSyncDialog(item, 0)"
                                                    >
                                                        <v-list-item-title class="edit-schedule">
                                                            編輯排程
                                                        </v-list-item-title>
                                                    </v-list-item>
                                                    <v-list-item
                                                        @click.stop="$refs.crawlerSyncDialog.openSyncDialog(item, 1)"
                                                    >
                                                        <v-list-item-title class="delay-schedule">
                                                            延遲執行
                                                        </v-list-item-title>
                                                    </v-list-item>
                                                    <v-list-item @click.stop="openDeleteAutoSyncDialog(item)">
                                                        <v-list-item-title class="delete-schedule">
                                                            刪除排程
                                                        </v-list-item-title>
                                                    </v-list-item>
                                                </v-list>
                                            </v-menu>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </v-table>
                        <EmptyStateSearch v-if="hasNoSearchResults" />

                        <!-- 分頁控制 -->
                        <div class="mt-4 pagination-wrapper">
                            <div class="flex-wrap d-flex align-center justify-space-between">
                                <div class="mx-2 text-center flex-grow-1 pagination-container">
                                    <v-pagination
                                        v-model="currentPage"
                                        :length="totalPages"
                                        :total-visible="totalVisible"
                                    ></v-pagination>
                                </div>

                                <div class="mr-2 pagination-control shrink-on-small">
                                    <span class="mr-1 text-body-2 hide-on-xsmall">每頁顯示</span>
                                    <v-select
                                        v-model="itemsPerPage"
                                        :items="[10, 20, 50, 100, 200, 500]"
                                        hide-details
                                        density="compact"
                                    ></v-select>
                                    <span class="ml-1 text-body-2 hide-on-small">個</span>
                                </div>

                                <div class="ml-2 pagination-control shrink-on-small">
                                    <span class="mr-1 text-body-2 hide-on-xsmall">跳至</span>
                                    <v-text-field
                                        v-model="pageInput"
                                        type="number"
                                        min="1"
                                        :max="totalPages"
                                        hide-details
                                        class="page-input"
                                        @change="jumpToPage"
                                        @keyup.enter="jumpToPage"
                                        density="compact"
                                    ></v-text-field>
                                    <span class="ml-1 text-body-2 hide-on-small">頁</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </v-card-text>
            </v-card>

            <!-- 同步時間和延遲設定的 dialog -->
            <CrawlerSyncDialog ref="crawlerSyncDialog" @refetch="refetch" />

            <!-- 刪除自動同步對話框 -->
            <v-dialog v-model="deleteAutoSyncDialog" max-width="500px">
                <v-card>
                    <v-card-title>刪除自動同步設置</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-col cols="12">
                                <p class="text-body-1">
                                    確定要刪除
                                    <template v-if="Array.isArray(currentItem)">
                                        <strong>{{ currentItem.length }} 個站點</strong>
                                        <v-tooltip bottom>
                                            <template v-slot:activator="{ props }">
                                                <v-icon small v-bind="props">mdi-information-outline</v-icon>
                                            </template>
                                            <span>
                                                <ul class="pa-0 ma-0">
                                                    <li v-for="item in currentItem" :key="item.id">{{ item.title }}</li>
                                                </ul>
                                            </span>
                                        </v-tooltip>
                                    </template>
                                    <template v-else>
                                        <strong>{{ currentItem.title }}</strong>
                                    </template>
                                    的自動同步設置嗎？
                                </p>
                            </v-col>
                            <v-col cols="12">
                                <v-alert type="error" outlined dense>
                                    此操作將會刪除所選站點的自動同步設置，無法恢復。
                                </v-alert>
                            </v-col>
                        </v-row>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn color="grey darken-1" text @click="closeDeleteAutoSyncDialog">取消</v-btn>
                        <v-btn color="error" @click="deleteAutoSync" :loading="isDeleting">刪除</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </div>
    </v-container>
</template>

<style scoped>
.spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

/* 表格樣式 */

.checkbox-column {
    width: 5% !important;
}
.checkbox-column,
.action-column {
    z-index: 1;
}

.title-column {
    width: 30%;
}

.time-column {
    width: 20%;
}

.action-column {
    width: 10%;
}

.sticky-header {
    position: sticky;
    top: -24px;
    background-color: #fafafa;
    z-index: 9999;
    padding: 4px 8px;
}

.edit-schedule {
    color: #1976d2;
}

.delay-schedule {
    color: #4ea2f5;
}

.delete-schedule {
    color: #dc143c;
}

th {
    font-weight: bold;
    background-color: #f5f5f5;
    padding: 12px 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

/* 卡片樣式 */
.grid-card {
    display: flex;
    flex-direction: column;
    transition: box-shadow 0.3s ease-in-out;
    cursor: pointer;
}

.grid-card:hover {
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.grid-card .v-card-title {
    font-size: 1rem;
    font-weight: bold;
    line-height: 1.2;
    max-height: 2.4em;
    overflow: hidden;
}

.grid-card .v-card-subtitle {
    font-size: 0.85rem;
    color: rgba(0, 0, 0, 0.6);
}

.grid-card .v-card-text {
    padding-top: 8px;
}

/* 分頁樣式 */

.content-card {
    background-color: #fafafa;
    overflow: visible !important; /* 確保 sticky 元素可以 "溢出" 一定要加這行哦 */
}

.pagination-wrapper {
    position: sticky !important;
    bottom: -24px !important;
    background-color: #fafafa;
    padding: 10px 0;
    margin-top: 20px;
    z-index: 9999;
}

.pagination-controls {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    border-radius: 4px;
}

.pagination-control {
    display: flex;
    align-items: center;
    white-space: nowrap;
}

.page-input {
    width: 50px;
}

.page-input :deep(.v-field__input) {
    text-align: center;
    padding: 0;
}

.search-field {
    min-width: 450px;
    max-width: 700px;
    width: 100%;
}

.batch-btn {
    white-space: nowrap;
}

.view-toggle,
.filter-toggle {
    flex-shrink: 0;
}

@media (max-width: 1200px) {
    .search-field {
        min-width: 400px;
        max-width: 500px;
    }

    .batch-btn {
        padding: 0 8px;
    }

    .view-toggle .v-btn,
    .filter-toggle .v-btn {
        padding: 0 8px;
    }
}

@media (max-width: 960px) {
    .search-field {
        min-width: 300px;
        max-width: 400px;
    }

    .batch-btn {
        padding: 0 4px;
        font-size: 0.8rem;
    }

    .view-toggle .v-btn,
    .filter-toggle .v-btn {
        padding: 0 4px;
        min-width: auto;
    }

    .filter-toggle .v-btn {
        font-size: 0.8rem;
    }
}

/* 允許在非常小的螢幕上水平滾動 */
@media (max-width: 768px) {
    .search-field {
        min-width: 100%;
        max-width: 100%;
    }

    .sticky-header > div {
        padding-bottom: 8px;
    }

    .sticky-header > div::-webkit-scrollbar {
        height: 4px;
    }

    .sticky-header > div::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 2px;
    }
}

@media (max-width: 600px) {
    .sticky-header > div > div:last-child {
        flex-direction: column;
        align-items: stretch;
    }

    .sticky-header > div > div:last-child > * {
        margin-bottom: 8px;
    }

    .shrink-on-small {
        flex-shrink: 1;
    }
    .hide-on-small {
        display: none;
    }
}

/* 其他 */

/* 選中項目樣式 */
.selected-row {
    background-color: #e0e0e0;
}

.selected-card {
    background-color: #e0e0e0;
}

.sortable-header {
    cursor: pointer;
}

.header-content {
    display: flex;
    align-items: center;
    gap: 4px; /* 添加這行來控制文字和圖標之間的間距 */
}

.sort-icon {
    opacity: 0;
    transition: opacity 0.2s ease;
    width: 24px; /* 保持固定寬度 */
    flex-shrink: 0; /* 防止圖標被壓縮 */
}

.sort-icon.visible {
    opacity: 1;
}
</style>
