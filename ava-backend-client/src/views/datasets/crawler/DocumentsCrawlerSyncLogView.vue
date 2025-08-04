<script setup>
import { ref, computed, onMounted, inject, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";

import ConfirmComponents from "../../../components/ConfirmComponents.vue";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";
import SystemHeader from "@/components/system/SystemHeader.vue";
import { usePermissionChecker, useShowTableColumns } from "@/composables";
import { getSyncCrawlerListByDatasetCrawlerId, fetchCrawlerSyncInfoByCrawlerId } from "@/network/service";
import { getChipColor, getChipText, trainingStateOptions } from "@/utils/crawler";
import ColumnSettings from "@/components/common/ColumnSettings.vue";

const { canPerformAction: canDownloadCrawlerLog } = usePermissionChecker("allowedToDownloadCrawlerLog");
const emitter = inject("emitter");
const axios = inject("axios");

const router = useRouter();
const route = useRoute();

const props = defineProps({
    datasets_id: {
        type: String,
        required: true,
    },
    crawler_id: {
        type: String,
        default: null,
    },
});

const switchingStates = ref(new Map());
const selectedItems = ref([]);
const viewMode = ref("list");
const currentPage = ref(parseInt(route.query.page) || 1);
const itemsPerPage = ref(parseInt(route.query.perPage) || 10);
const pageInput = ref(currentPage.value);
const searchQuery = ref(route.query.search || "");
const selectedTrainingStates = ref(route.query.states ? route.query.states.split(",").map(Number) : []);
const totalItems = ref(0);

// Computed property to track query parameters for fetching data
const queryParams = computed(() => ({
    page: currentPage.value,
    perPage: itemsPerPage.value,
    search: searchQuery.value,
    states: selectedTrainingStates.value,
}));

// Updated useQuery to use the queryParams
const {
    data: crawlerData,
    isLoading,
    isError,
    error,
    refetch,
    isPlaceholderData,
    isSuccess,
} = useQuery({
    queryKey: ["crawlerSyncLogList", props.datasets_id, props.crawler_id, queryParams],
    queryFn: () =>
        getSyncCrawlerListByDatasetCrawlerId(props.datasets_id, props.crawler_id, {
            page: currentPage.value,
            perPage: itemsPerPage.value,
            search: searchQuery.value,
            states: selectedTrainingStates.value,
        }),
    // refetchInterval: 5000,
    placeholderData: keepPreviousData,
});

const { data: syncCrawlerInfo } = useQuery({
    queryKey: ["syncCrawlerInfo", props.datasets_id, props.crawler_id],
    queryFn: () => fetchCrawlerSyncInfoByCrawlerId(props.datasets_id, props.crawler_id),
});

const crawlerInfoResponseData = computed(() => syncCrawlerInfo.value?.data || {});
const crawlerInfo = computed(() => crawlerInfoResponseData.value.crawler_info || {});

// Computed property to access the items array safely
const crawlerList = computed(() => crawlerData.value?.items || []);

// Update totalItems when data is loaded
watch(
    crawlerData,
    (newData) => {
        if (newData) {
            totalItems.value = newData.total;
        }
    },
    { immediate: true }
);

const tableConfig = {
    columnLabels: {
        title: "網站名稱",
        domain: "網域名稱",
        status: "狀態",
        addedFilesCount: "新增文件數",
        deletedFilesCount: "刪除文件數",
        pendingDeleteFilesCount: "預計刪除文件數",
        details: "詳情",
        syncTime: "同步時間",
        crawlerLog: "爬蟲Log",
    },
    allColumns: [
        "title",
        "domain",
        "status",
        "addedFilesCount",
        "deletedFilesCount",
        "pendingDeleteFilesCount",
        "details",
        "crawlerLog",
        "syncTime",
    ],
    storageKey: "crawler-site-sync-log-table-columns",
    requiredFields: ["title", "status"], // 確保某些關鍵欄位始終顯示
};

// 使用 composable
const { columnLabels, allColumns, requiredFields, visibleColumns } = useShowTableColumns(tableConfig);

// No need for filteredCrawlerList since filtering is now done on the server
const hasNoData = computed(
    () =>
        !isLoading.value &&
        crawlerList.value.length === 0 &&
        !searchQuery.value &&
        selectedTrainingStates.value.length === 0
);
const hasNoSearchResults = computed(
    () =>
        !isLoading.value &&
        crawlerList.value.length === 0 &&
        (searchQuery.value || selectedTrainingStates.value.length > 0)
);

// We now use crawlerList directly as it's already paginated
const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage.value));

// Helper for multiple selected states display
const selectedItemsText = computed(() => {
    if (selectedTrainingStates.value.length <= 1) return "";

    const selectedLabels = selectedTrainingStates.value.map((state) => {
        const option = trainingStateOptions.find((opt) => opt.value === state);
        return option ? option.title : state;
    });

    return `已選擇: ${selectedLabels.join(", ")}`;
});

const mutableCrawlerList = computed(() => {
    return crawlerList.value.map((crawler) => ({
        ...crawler,
        sync_time: new Date(crawler.last_time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
        isSwitching: switchingStates.value.get(crawler.id) || false,
        isSelected: selectedItems.value.includes(crawler.id),
    }));
});

function goCrawlerDocumentDetail(syncId) {
    router.push(`/datasets/${props.datasets_id}/syncCrawler/${syncId}?crawlerSyncLog=true`);
}

function goAddSource() {
    // Navigation function to add source page
    router.push(`/datasets/${props.datasets_id}/crawler`);
}

function handleHeaderAction(action) {
    if (action.id === "refresh") {
        refetch();
    }
}

const confirm_com = ref(null);
const confirmCrawlerStatus = ref(null);

async function downloadCrawlerLog(item) {
    try {
        const dir = item.dir;
        const crawlerId = item.crawlerId;
        const response = await axios.post(
            `/log/downloadCrawlerLog`,
            {
                dir,
                crawlerId,
            },
            {
                responseType: "blob", // 確保接收的是文件數據
            }
        );
        let filename = `spider-${dir}`;
        if (crawlerId.includes(".1")) {
            filename = "WebCrawler";
        }

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${filename}.log`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        console.error("Error downloading crawler log:", error);
        emitter.emit("openSnackbar", { message: "下載爬蟲log失敗: " + error.message, color: "error" });
    }
}

function toggleItemSelection(item, event) {
    // Preventing opening when clicking on buttons
    if (event.target.closest("button") || event.target.closest("v-btn")) {
        return;
    }

    const index = selectedItems.value.indexOf(item.id);
    if (index === -1) {
        selectedItems.value.push(item.id);
    } else {
        selectedItems.value.splice(index, 1);
    }
}

const copyMessage = async (message) => {
    try {
        await navigator.clipboard.writeText(message);
        emitter.emit("openSnackbar", { message: "複製成功", color: "success" });
    } catch (err) {
        console.error("Failed to copy:", err);
    }
};

// Watch route changes to update local state
watch(
    () => route.query,
    (newQuery) => {
        const newPage = parseInt(newQuery.page) || 1;
        const newPerPage = parseInt(newQuery.perPage) || 10;
        const newSearch = newQuery.search || "";
        const newStates = newQuery.states ? newQuery.states.split(",").map(Number) : [];

        // Update local state if values have changed
        if (currentPage.value !== newPage) {
            currentPage.value = newPage;
            pageInput.value = newPage;
        }

        if (itemsPerPage.value !== newPerPage) {
            itemsPerPage.value = newPerPage;
        }

        if (searchQuery.value !== newSearch) {
            searchQuery.value = newSearch;
        }

        if (JSON.stringify(selectedTrainingStates.value) !== JSON.stringify(newStates)) {
            selectedTrainingStates.value = newStates;
        }
    },
    { immediate: true }
);

// Debounce search input changes to avoid too many requests
let searchTimeout;
watch(searchQuery, (newValue) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        updateRouteWithCurrentFilters();
    }, 500); // 500ms debounce
});

// Watch training state filter changes
watch(selectedTrainingStates, () => {
    updateRouteWithCurrentFilters();
});

// Watch pagination changes
watch([currentPage, itemsPerPage], () => {
    updateRouteWithCurrentFilters();
});

// Function to update route with all current filters
function updateRouteWithCurrentFilters() {
    const query = { ...route.query };

    // Update pagination
    query.page = currentPage.value.toString();
    query.perPage = itemsPerPage.value.toString();

    // Update search and filters
    if (searchQuery.value) {
        query.search = searchQuery.value;
    } else {
        delete query.search;
    }

    if (selectedTrainingStates.value.length > 0) {
        query.states = selectedTrainingStates.value.join(",");
    } else {
        delete query.states;
    }

    // Update route if anything changed
    if (JSON.stringify(query) !== JSON.stringify(route.query)) {
        router.replace({ query });
    }
}

// Function to jump to a specific page
function jumpToPage() {
    const page = parseInt(pageInput.value);
    if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
        updateRouteWithCurrentFilters();
    } else {
        // Reset to current page if input is invalid
        pageInput.value = currentPage.value;
    }
}

// Handle popstate event to ensure proper state on browser navigation
onMounted(() => {
    // Initialize route if needed
    if (!route.query.page && !route.query.perPage) {
        updateRouteWithCurrentFilters();
    }

    // Listen for browser back/forward navigation
    window.addEventListener("popstate", () => {
        const newPage = parseInt(route.query.page) || 1;
        const newPerPage = parseInt(route.query.perPage) || 10;
        const newSearch = route.query.search || "";
        const newStates = route.query.states ? route.query.states.split(",").map(Number) : [];

        // Update local state without triggering the route watcher
        currentPage.value = newPage;
        itemsPerPage.value = newPerPage;
        pageInput.value = newPage;
        searchQuery.value = newSearch;
        selectedTrainingStates.value = newStates;
    });
});
</script>

<template>
    <v-container fluid>
        <div class="crawler-list">
            <v-skeleton-loader v-if="!isSuccess" type="article" :loading="!isSuccess"> </v-skeleton-loader>

            <!-- 載入的時候顯示 skeleton -->

            <!-- 錯誤顯示 -->
            <v-row v-else-if="isError" class="justify-center fill-height align-center">
                <v-col cols="12" class="text-center">
                    <p class="text-error">載入失敗: {{ error.message }}</p>
                </v-col>
            </v-row>

            <!-- 無數據顯示 EmptyState -->
            <v-row v-else-if="hasNoData" class="justify-center fill-height align-center">
                <EmptyStateNoData
                    headline="尚未同步任何爬蟲"
                    text="目前還沒有同步任何爬蟲的資料。同步後的爬蟲資訊將會顯示在這裡，方便您查詢和管理已爬取的內容。"
                    actionText="開始同步爬蟲"
                    actionIcon="fa-solid fa-sync"
                    :actionCallback="goAddSource"
                />
            </v-row>

            <SystemHeader
                v-else
                :title="crawlerInfo.title + ' - 同步記錄'"
                :subtitle="crawlerInfo.url"
                icon="fa-solid fa-sync"
                :actions="[
                    {
                        id: 'refresh',
                        text: '更新資料',
                        icon: 'mdi-refresh',
                        color: 'info',
                        loading: isLoading || isFetching,
                    },
                ]"
                @action="handleHeaderAction"
            />

            <v-card class="content-card">
                <v-card-text>
                    <div class="sticky-header">
                        <div class="py-2 overflow-x-auto flex-nowrap d-flex align-center justify-space-between">
                            <div class="mr-2 flex-nowrap d-flex align-center">
                                <v-text-field
                                    v-model="searchQuery"
                                    label="搜尋網站名稱或網域"
                                    prepend-inner-icon="mdi-magnify"
                                    hide-details
                                    class="mr-2 search-field"
                                ></v-text-field>
                                <v-tooltip :text="selectedItemsText" location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-select
                                            v-model="selectedTrainingStates"
                                            :items="trainingStateOptions"
                                            label="狀態搜索"
                                            multiple
                                            hide-details
                                            class="state-select"
                                            v-bind="props"
                                        >
                                            <template v-slot:selection="{ item, index }">
                                                <v-chip v-if="index < 1">
                                                    <span>{{ item.title }}</span>
                                                </v-chip>
                                                <span
                                                    v-if="index === 1"
                                                    class="text-grey text-caption align-self-center"
                                                >
                                                    (+{{ selectedTrainingStates.length - 1 }} others)
                                                </span>
                                            </template>
                                        </v-select>
                                    </template>
                                </v-tooltip>
                            </div>

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
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="position-relative content-container">
                        <div v-if="isPlaceholderData" class="justify-center table-overlay d-flex align-center">
                            <v-progress-circular indeterminate color="primary"></v-progress-circular>
                        </div>
                        <!-- 列表 -->
                        <div class="scrollable-table-container" v-if="viewMode === 'list'">
                            <v-table v-if="viewMode === 'list'" class="elevation-1 list-table">
                                <thead>
                                    <tr>
                                        <!-- 動態欄位 -->
                                        <template
                                            v-for="column in visibleColumns.filter((col) => col !== 'select')"
                                            :key="column"
                                        >
                                            <th
                                                :class="[
                                                    'text-left',
                                                    {
                                                        'text-center': [
                                                            'details',
                                                            'crawlerLog',
                                                            'documentAdded',
                                                            'documentDeleted',
                                                        ].includes(column),
                                                    },
                                                ]"
                                                v-if="column !== 'crawlerLog' || canDownloadCrawlerLog"
                                            >
                                                {{ columnLabels[column] }}
                                            </th>
                                        </template>
                                    </tr>
                                </thead>

                                <tbody>
                                    <template v-if="!isSuccess">
                                        <tr v-for="n in 5" :key="n">
                                            <td v-for="m in visibleColumns.length" :key="m">
                                                <v-skeleton-loader type="text" />
                                            </td>
                                        </tr>
                                    </template>
                                    <template v-else>
                                        <tr
                                            v-for="item in mutableCrawlerList"
                                            :key="item.id"
                                            @click="toggleItemSelection(item, $event)"
                                        >
                                            <!-- 動態內容欄位 -->
                                            <template
                                                v-for="column in visibleColumns.filter((col) => col !== 'select')"
                                                :key="column"
                                            >
                                                <!-- 網站名稱 -->
                                                <td v-if="column === 'title'">
                                                    {{ item.title }}
                                                </td>

                                                <!-- 網域名稱 -->
                                                <td v-else-if="column === 'domain'">
                                                    {{ item.domain }}
                                                </td>

                                                <!-- 狀態 -->
                                                <td v-else-if="column === 'status'">
                                                    <v-chip
                                                        :color="getChipColor(item.training_state)"
                                                        @click="copyMessage(item.task_id)"
                                                    >
                                                        <v-tooltip activator="parent" location="top">
                                                            <span v-if="item.task_id"
                                                                >(Task ID: {{ item.task_id }})</span
                                                            >
                                                        </v-tooltip>
                                                        {{ getChipText(item.training_state) }}
                                                    </v-chip>
                                                </td>

                                                <!-- 新增文件數 -->
                                                <td class="text-center" v-if="column === 'addedFilesCount'">
                                                    {{ item.added_files_count }}
                                                </td>

                                                <!-- 刪除文件數 -->
                                                <td class="text-center" v-if="column === 'deletedFilesCount'">
                                                    {{ item.deleted_files_count }}
                                                </td>

                                                <!-- 預計刪除文件數 -->
                                                <td class="text-center" v-if="column === 'pendingDeleteFilesCount'">
                                                    {{ item.pending_delete_files_count }}
                                                </td>

                                                <!-- 詳情 -->
                                                <td v-else-if="column === 'details'" class="text-center">
                                                    <v-btn
                                                        @click.stop="goCrawlerDocumentDetail(item.id)"
                                                        variant="text"
                                                        color="accent"
                                                        class="link-text"
                                                        :disabled="item.added_files_count === 0"
                                                    >
                                                        <v-tooltip activator="parent" location="top"
                                                            >查看詳細資料</v-tooltip
                                                        >
                                                        <v-icon start>mdi-page-next</v-icon>
                                                        詳細
                                                    </v-btn>
                                                </td>

                                                <!-- 爬蟲Log -->
                                                <td
                                                    v-else-if="column === 'crawlerLog' && canDownloadCrawlerLog"
                                                    class="text-center"
                                                >
                                                    <v-btn
                                                        @click.stop="downloadCrawlerLog(item)"
                                                        variant="text"
                                                        color="accent"
                                                        class="link-text"
                                                    >
                                                        <v-tooltip activator="parent" location="top">{{
                                                            item.dir
                                                        }}</v-tooltip>
                                                        <v-icon start>mdi-download</v-icon>
                                                        下載爬蟲log
                                                    </v-btn>
                                                </td>
                                                <!-- 同步時間 -->
                                                <td v-else-if="column === 'syncTime'">
                                                    {{ item.sync_time }}
                                                </td>
                                            </template>
                                        </tr>
                                    </template>
                                </tbody>
                            </v-table>
                        </div>
                    </div>

                    <EmptyStateSearch v-if="hasNoSearchResults" />
                    <!-- 分頁控制 -->
                    <div class="pagination-wrapper" v-if="!hasNoData && !hasNoSearchResults">
                        <div class="flex-wrap d-flex align-center justify-space-between pagination-controls">
                            <div class="mx-2 text-center flex-grow-1">
                                <v-pagination
                                    v-model="currentPage"
                                    :length="totalPages"
                                    :total-visible="7"
                                ></v-pagination>
                            </div>

                            <div class="mr-2 pagination-control">
                                <span class="mr-1 text-body-2">每頁顯示</span>
                                <v-select
                                    v-model="itemsPerPage"
                                    :items="[10, 20, 50, 100, 200, 500]"
                                    hide-details
                                    density="compact"
                                ></v-select>
                                <span class="ml-1 text-body-2">個</span>
                            </div>

                            <div class="ml-2 pagination-control">
                                <span class="mr-1 text-body-2">跳至</span>
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
                                <span class="ml-1 text-body-2">頁</span>
                            </div>
                        </div>
                    </div>
                </v-card-text>
            </v-card>

            <!-- 確認對話框 -->
            <ConfirmComponents
                ref="confirm_com"
                type="info"
                message="確認要同步爬蟲嗎?"
                :confirmBtn="true"
                @confirm="syncCrawler"
                saveBtnName="確認"
                closeBtnName="關閉"
            ></ConfirmComponents>

            <ConfirmComponents
                ref="confirmCrawlerStatus"
                type="warning"
                message="確認要更改爬蟲狀態嗎?"
                @confirm="toggleEnable"
                saveBtnName="確認"
                closeBtnName="關閉"
            ></ConfirmComponents>
        </div>
    </v-container>
</template>
<style lang="scss" scoped>
.crawler-list {
    .checkbox-column .v-checkbox {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    .checkbox-column,
    .action-column {
        z-index: 1;
    }

    .title-column {
        width: 40%;
    }

    .domain-column {
        width: 40%;
    }

    .action-column {
        width: 20%;
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

    .table-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.7);
        z-index: 10;
    }

    .content-card {
        background-color: #fafafa;
        overflow: visible !important;
    }

    .sticky-header {
        position: sticky;
        top: -16px;
        background-color: #fafafa;
        z-index: 9999;
        padding: 4px 8px;
    }

    .search-field {
        min-width: 450px;
        max-width: 700px;
        width: 100%;
    }

    .state-select {
        min-width: 200px;
        max-width: 300px;
        width: 100%;
    }

    .pagination-wrapper {
        position: sticky !important;
        bottom: -17px !important;
        background-color: #fafafa;
        padding: 10px 0;
        margin-top: 10px;
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

    .crawler-card {
        transition: all 0.3s ease;

        &:hover {
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
        }

        .title-container {
            flex: 1;
            min-width: 0;
        }

        .text-truncate {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .v-chip {
            font-weight: 500;
        }

        .v-switch {
            margin-top: 0;
        }
    }

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

    .crawler-status {
        padding: 0.6rem 1rem !important;
    }

    @media (max-width: 1200px) {
        .search-field {
            min-width: 400px;
            max-width: 500px;
        }
        .state-select {
            min-width: 150px;
            max-width: 250px;
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
        .state-select {
            min-width: 150px;
            max-width: 250px;
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
        .state-select {
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

    @media (max-width: 400px) {
        .hide-on-xsmall {
            display: none;
        }
    }
}

.auto-sync {
    color: #1976d2;
}

.immediately-sync {
    color: #4caf50;
}

:deep(.column-settings-trigger) {
    margin-top: -7px;
    height: 40px;
}

.content-container {
    position: relative;
}

.scrollable-table-container {
    position: relative;
    overflow: hidden;
}
</style>
