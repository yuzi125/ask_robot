<script setup>
import { ref, computed, onMounted, toRefs, inject, watch } from "vue";
import { useQuery, useMutation } from "@tanstack/vue-query";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";
import SystemHeader from "@/components/system/SystemHeader.vue";
import AttachmentDialog from "@/components/datasets/crawler/AttachmentDialog.vue";
import { getFileIcon, getFileIconColor } from "@/utils/common";
import { useRoute, useRouter } from "vue-router";
import { usePermissionChecker } from "@/composables";
import { fetchCrawlerAttachmentSiteList } from "@/network/service";

const axios = inject("axios");
const emitter = inject("emitter");
const props = defineProps({
    datasets_id: { type: String, default: {} },
});
const { datasets_id } = toRefs(props);

// 新增：擴展行和附件設定對話框相關狀態
const expandedRows = ref([]);
const attachmentDialogOpen = ref(false);
const selectedAttachments = ref([]);
const currentSiteId = ref(null);
const currentSiteName = ref("");

const filterOption = ref("all");
const dialogVisible = ref(false);
const confirmDialogVisible = ref(false);
const dialogData = ref({
    syncDays: null,
    syncTime: "",
    folder: null,
    selectedIds: [],
    isBatchOperation: false,
    operation: "", // 'add' or 'cancel'
});

const route = useRoute();
const router = useRouter();

const { canPerformAction: canOperateCrawler } = usePermissionChecker("allowedToCreateAndCancelCrawler");
const cancelCrawlerList = ref([]);
const isConfirming = ref(false);
const relatedSites = ref([]);
const dialogLoading = ref(false);

// 分頁相關狀態
const currentPage = ref(parseInt(route.query.page) || 1);
const itemsPerPage = ref(parseInt(route.query.perPage) || 10);
const pageInput = ref(currentPage.value);

// 搜尋相關狀態
const searchQuery = ref("");

// // 新增：模擬附件數據生成器
// const generateAttachments = (count, siteId) => {
//     const types = [
//         { ext: ".pdf", prefix: "施政計畫" },
//         { ext: ".docx", prefix: "會議記錄" },
//         { ext: ".xlsx", prefix: "預算報告" },
//         { ext: ".jpg", prefix: "活動照片" },
//         { ext: ".zip", prefix: "資料壓縮檔" },
//     ];

//     const attachments = [];
//     for (let i = 0; i < count; i++) {
//         const typeIndex = Math.floor(Math.random() * types.length);
//         const type = types[typeIndex];
//         const year = 100 + Math.floor(Math.random() * 12);
//         const fileSize = (Math.random() * 5 + 0.5).toFixed(1);
//         const fileUnit = Math.random() > 0.7 ? "MB" : "KB";

//         attachments.push({
//             id: `${siteId}-${i}`,
//             name: `${year}年${type.prefix}_${Math.floor(Math.random() * 1000)}${type.ext}`,
//             size: `${fileSize} ${fileUnit}`,
//             date: `2023-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(
//                 Math.floor(Math.random() * 28) + 1
//             ).padStart(2, "0")}`,
//             selected: Math.random() > 0.7, // 隨機選擇一些附件
//         });
//     }

//     return attachments;
// };

// const getCrawlerList = async () => {
//     const { data } = await axios.get(`/crawler/attachment/list?datasetsId=${datasets_id.value}`);
//     if (data.code === 0) {
//         // 為每個項目添加模擬的附件數據
//         return data.data.map((item) => {
//             // 隨機生成0-100個附件
//             const attachmentsCount = Math.floor(Math.random() * 1000);
//             // 隨機選擇幾個附件作為已選擇
//             const selectedCount = Math.min(Math.floor(Math.random() * 10) + 1, attachmentsCount);

//             const attachments = generateAttachments(attachmentsCount, item.id);
//             const selectedAttachments = attachments.filter((a) => a.selected).slice(0, selectedCount);

//             return {
//                 ...item,
//                 attachments,
//                 selected_attachments: selectedAttachments,
//                 attachments_count: attachmentsCount,
//                 selected_count: selectedCount,
//             };
//         });
//     }
//     throw new Error("Failed to fetch crawler list");
// };

const {
    data: crawlerList,
    isSuccess,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
} = useQuery({
    queryKey: ["crawlerAttachmentList", datasets_id],
    queryFn: () => fetchCrawlerAttachmentSiteList(datasets_id.value),
    refetchInterval: 30000,
});

const { mutateAsync: selectNeedDownloadAttachment, isPending: selectNeedDownloadAttachmentPending } = useMutation({
    mutationFn: (data) => axios.post("/crawler/selectNeedDownloadAttachment", data),
    onSuccess: () => {
        refetch();
        emitter.emit("openSnackbar", { message: "成功更新附件設定", color: "success" });
    },
});

const paginatedItems = computed(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage.value;
    const endIndex = startIndex + itemsPerPage.value;
    return filteredItems.value.slice(startIndex, endIndex);
});

const totalPages = computed(() => Math.ceil(filteredItems.value.length / itemsPerPage.value));
const totalVisible = computed(() => (window.innerWidth < 600 ? 3 : 7));

const filteredItems = computed(() => {
    if (!crawlerList.value) return [];
    let allItems = crawlerList.value;

    // 搜尋過濾
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        allItems = allItems.filter(
            (item) => item.title.toLowerCase().includes(query) || item.domain.toLowerCase().includes(query)
        );
    }

    // 狀態過濾
    switch (filterOption.value) {
        case "enabled":
            return allItems.filter(
                (item) => item.training_state === undefined || [1, 2, 3].includes(item.training_state)
            );
        case "disabled":
            return allItems.filter(
                (item) => item.training_state === null || [4, 5, 97, 98, 99].includes(item.training_state)
            );
        default:
            return allItems;
    }
});

const hasNoData = computed(() => {
    return isSuccess.value && crawlerList.value?.length == 0;
});

const hasNoSearchResults = computed(
    () => !isLoading.value && crawlerList.value && crawlerList.value.length > 0 && filteredItems.value.length === 0
);

// 選取相關狀態
const selectedItems = ref([]);
const crawlerLoadingState = ref(false);

// 判斷項目是否可被選擇
const isItemSelectable = computed(() => {
    return () => true;
});

// 檢查當前頁面是否全選
const isCurrentPageAllSelected = computed(() => {
    const selectableItems = paginatedItems.value;
    return selectableItems.length > 0 && selectableItems.every((item) => selectedItems.value.includes(item.id));
});

// 控制批量加入按鈕的禁用狀態
const isBatchAddDisabled = computed(() => {
    return !selectedItems.value.some((id) => {
        const item = crawlerList.value.find((i) => i.id === id);
        return item && item.training_state !== 1 && item.training_state !== 2 && item.training_state !== 3;
    });
});
// 控制批量取消按鈕的禁用狀態
const isBatchCancelDisabled = computed(() => {
    return !selectedItems.value.some((id) => {
        const item = crawlerList.value.find((i) => i.id === id);
        return item && (item.training_state === 1 || item.training_state === 2 || item.training_state === 3);
    });
});

// 可加入的項目數量
const addableItemsCount = computed(() => {
    return selectedItems.value.filter((id) => {
        const item = crawlerList.value.find((i) => i.id === id);
        return item && item.training_state !== 1 && item.training_state !== 2 && item.training_state !== 3;
    }).length;
});

// 可取消的項目數量
const cancellableItemsCount = computed(() => {
    return selectedItems.value.filter((id) => {
        const item = crawlerList.value.find((i) => i.id === id);
        return item && (item.training_state === 1 || item.training_state === 2 || item.training_state === 3);
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

// 只全選當前頁面的項目
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

// 新增：切換行展開狀態的方法
function toggleRowExpand(itemId, event) {
    // 防止事件冒泡
    if (event) {
        event.stopPropagation();
    }

    const index = expandedRows.value.indexOf(itemId);
    if (index === -1) {
        expandedRows.value.push(itemId);
    } else {
        expandedRows.value.splice(index, 1);
    }
}

// 新增：打開附件設定對話框的方法
function openAttachmentDialog(siteId, siteName) {
    console.log("openAttachmentDialog", siteId, siteName);
    currentSiteId.value = siteId;
    currentSiteName.value = siteName;
    selectedAttachments.value = []; // 重置選擇狀態
    attachmentDialogOpen.value = true;
}

async function handleSaveAttachments({ siteId, attachments }) {
    try {
        await selectNeedDownloadAttachment(attachments);
    } catch (error) {
        console.error("Error selecting need download attachment:", error);
    }
}

async function openDialog(item) {
    if (item.training_state === 1 || item.training_state === 2) {
        // 爬蟲執行中或同步中，不執行任何操作
        return;
    }
    if (item.training_state === 3) {
        dialogLoading.value = true;
        dialogData.value = {
            ...dialogData.value,
            selectedIds: [item.id],
            isBatchOperation: false,
            operation: "cancel",
        };
        confirmDialogVisible.value = true;
        try {
            const response = await axios.post("/crawler/getDeleteCrawlerSiteList", {
                crawler_ids: [item.id],
                datasets_id: datasets_id.value,
            });

            if (response.data.code === 0) {
                cancelCrawlerList.value = response.data.data.syncCrawlerList;
                relatedSites.value = response.data.data.relateSite;
            } else {
                console.error("獲取取消爬蟲列表失敗:", response.data.message);
            }
        } catch (error) {
            console.error("請求失敗:", error);
        } finally {
            dialogLoading.value = false;
        }
    } else {
        dialogData.value = {
            syncDays: null,
            syncTime: "",
            folder: null,
            selectedIds: [item.id],
            isBatchOperation: false,
            operation: "add",
        };
        dialogVisible.value = true;
    }
}

async function openBatchDialog(operation, test) {
    const selectedIds = operation === "cancel" ? getCancellableIds() : getAddableIds();
    dialogData.value = {
        ...dialogData.value,
        selectedIds,
        isBatchOperation: true,
        operation: operation,
        test,
    };

    if (operation === "cancel") {
        // 立即打開對話框，並設置加載狀態
        confirmDialogVisible.value = true;
        dialogLoading.value = true;

        try {
            const response = await axios.post("/crawler/getDeleteCrawlerSiteList", {
                crawler_ids: selectedIds,
                datasets_id: datasets_id.value,
            });

            if (response.data.code === 0) {
                cancelCrawlerList.value = response.data.data.syncCrawlerList;
                relatedSites.value = response.data.data.relateSite;
            } else {
                console.error("獲取取消爬蟲列表失敗:", response.data.message);
            }
        } catch (error) {
            console.error("請求失敗:", error);
        } finally {
            dialogLoading.value = false;
        }
    } else {
        dialogData.value.syncDays = null;
        dialogData.value.syncTime = "";
        dialogData.value.folder = null;
        dialogVisible.value = true;
    }
}

function closeDialog() {
    dialogVisible.value = false;
    confirmDialogVisible.value = false;
    cancelCrawlerList.value = [];
    dialogData.value = {
        syncDays: null,
        syncTime: "",
        folder: null,
        selectedIds: [],
        isBatchOperation: false,
        operation: "",
    };

    dialogLoading.value = false;
    relatedSites.value = [];
}

async function confirmCancel() {
    const selectedIds = dialogData.value.isBatchOperation ? getCancellableIds() : dialogData.value.selectedIds;

    try {
        isConfirming.value = true;
        await axios.delete("/crawler/deleteCrawlerAttachment", {
            data: {
                crawler_ids: selectedIds,
                datasets_id: datasets_id.value,
                mode: "delete",
                cancelCrawlerList: cancelCrawlerList.value,
            },
        });
        isConfirming.value = false;
    } catch (error) {
        console.error("Error cancelling addition:", error);
    }

    selectedItems.value = [];
    closeDialog();
    refetch();
}

async function submitDialog() {
    const { folder, isBatchOperation, operation, test, syncDays, syncTime } = dialogData.value;
    const selectedIds = isBatchOperation ? getAddableIds() : dialogData.value.selectedIds;
    crawlerLoadingState.value = true;
    try {
        await axios.post(
            "/crawler/syncCrawlerSchedule",
            JSON.stringify({
                crawlerIds: selectedIds,
                datasetsId: datasets_id.value,
                syncDays,
                syncTime,
                type: "attachment",
            }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    }

    try {
        await axios.post(
            "/crawler/syncCrawlerAttachment",
            JSON.stringify({
                crawlerIds: selectedIds,
                datasetsId: datasets_id.value,
                folder,
                test,
            }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );

        emitter.emit("openSnackbar", { message: "同步中，請稍後。", color: "success" });
    } catch (error) {
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    }

    crawlerLoadingState.value = false;
    selectedItems.value = [];
    refetch();
    closeDialog();
}

// 輔助函數
function getAddableIds() {
    return selectedItems.value.filter((id) => {
        const item = crawlerList.value.find((i) => i.id === id);
        return item && item.training_state !== 1 && item.training_state !== 2 && item.training_state !== 3;
    });
}

function getCancellableIds() {
    return selectedItems.value.filter((id) => {
        const item = crawlerList.value.find((i) => i.id === id);
        return item && (item.training_state === 1 || item.training_state === 2 || item.training_state === 3);
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
watch([searchQuery, filterOption], () => {
    currentPage.value = 1;
    pageInput.value = 1;
    router.push({
        query: {
            ...route.query,
            page: 1,
            search: searchQuery.value,
            filter: filterOption.value,
        },
    });
});

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

// 設定週期相關
const isSyncDaysValid = computed(() => {
    return (
        dialogData.value.syncDays !== null && dialogData.value.syncDays !== "" && Number(dialogData.value.syncDays) > 0
    );
});

const isSyncSettingComplete = computed(() => {
    return isSyncDaysValid.value && dialogData.value.syncTime !== "" && dialogData.value.syncTime !== "";
});

const syncSettingMessage = computed(() => {
    if (!isSyncSettingComplete.value) return "";
    const syncDate = calculateSyncDate();
    return `今天是 ${formatDate(new Date())}，設定 ${dialogData.value.syncDays} 天 ${
        dialogData.value.syncTime
    }，則會在 ${syncDate} 左右執行同步。`;
});

const formatDate = (date) => {
    return date.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
};

const calculateSyncDate = () => {
    if (!isSyncSettingComplete.value) return "";

    if (dialogData.value.syncTime?.split(":")) {
        const today = new Date();
        const syncDate = new Date(today.setDate(today.getDate() + Number(dialogData.value.syncDays)));
        const [hours, minutes] = dialogData.value.syncTime.split(":");
        syncDate.setHours(Number(hours), Number(minutes), 0, 0);
        return formatDate(syncDate) + " " + dialogData.value.syncTime;
    }
};

const validateSyncDays = () => {
    const days = Number(dialogData.value.syncDays);
    if (isNaN(days) || days <= 0) {
        dialogData.value.syncDays = null;
        dialogData.value.syncTime = "";
    }
};

const handleHeaderAction = (actionId) => {
    switch (actionId) {
        case "refresh":
            refetch();
            break;
    }
};
</script>

<template>
    <v-container fluid>
        <div>
            <SystemHeader
                title="爬蟲附件 - 站點清單"
                subtitle="此頁面僅顯示已開放下載附件功能的網站，您可以從清單中選取需要的站點進行資料同步，每 30 秒會自動更新一次狀態。"
                icon="fa-solid fa-list"
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
                    headline="尚未有站點開放附件功能"
                    text="目前還沒有站點開放附件功能，請先開放附件功能，才能進行同步。"
                />
            </v-row>

            <!-- 錯誤顯示 -->
            <v-row v-else-if="isError" class="justify-center fill-height align-center">
                <v-col cols="12" class="text-center">
                    <p class="text-error">載入失敗: {{ error.message }}</p>
                </v-col>
            </v-row>
            <v-card class="content-card" v-else>
                <v-card-text>
                    <div class="sticky-header">
                        <div class="py-2 overflow-x-auto flex-nowrap d-flex align-center justify-space-between">
                            <v-text-field
                                v-model="searchQuery"
                                label="搜尋網站名稱或網域"
                                prepend-inner-icon="mdi-magnify"
                                hide-details
                                class="mr-2 search-field"
                            ></v-text-field>

                            <div class="flex-nowrap d-flex align-center">
                                <div class="d-flex">
                                    <v-btn
                                        :disabled="isBatchAddDisabled"
                                        :color="addableItemsCount > 0 ? 'blue' : ''"
                                        class="mr-1 batch-btn"
                                        @click="openBatchDialog('add')"
                                        v-if="canOperateCrawler"
                                    >
                                        批量加入({{ addableItemsCount }})
                                    </v-btn>
                                    <v-btn
                                        :disabled="isBatchCancelDisabled"
                                        :color="cancellableItemsCount > 0 ? 'red-darken-3' : ''"
                                        class="batch-btn"
                                        @click="openBatchDialog('cancel')"
                                        v-if="canOperateCrawler"
                                    >
                                        批量取消({{ cancellableItemsCount }})
                                    </v-btn>
                                    <v-btn
                                        :color="selectedItems.length > 0 ? 'success' : ''"
                                        :disabled="isBatchAddDisabled"
                                        @click="openBatchDialog('add', 'test')"
                                        class="ml-2"
                                        v-if="canOperateCrawler"
                                    >
                                        測試加入
                                        <span v-if="selectedItems.length > 0">({{ selectedItems.length }})</span>
                                    </v-btn>
                                </div>

                                <v-divider vertical class="mx-1" v-if="canOperateCrawler"></v-divider>

                                <v-btn-toggle
                                    v-model="filterOption"
                                    density="comfortable"
                                    mandatory
                                    class="filter-toggle"
                                >
                                    <v-btn value="all">全部</v-btn>
                                    <v-btn value="enabled">已啟用</v-btn>
                                    <v-btn value="disabled">未啟用</v-btn>
                                </v-btn-toggle>

                                <!-- <v-divider vertical class="mx-1"></v-divider>
                                <v-btn-toggle
                                    v-model="viewMode"
                                    mandatory
                                    density="comfortable"
                                    class="mr-2 view-toggle"
                                >
                                    <v-btn value="list"> <v-icon>mdi-format-list-bulleted</v-icon> </v-btn>
                                    <v-btn value="grid"> <v-icon>mdi-grid</v-icon> </v-btn>
                                </v-btn-toggle> -->
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 syncWeb">
                        <!-- 列表模式 -->
                        <v-table class="elevation-1 list-table">
                            <thead>
                                <tr>
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
                                        ></v-checkbox>
                                    </th>
                                    <th class="text-left title-column">網站名稱</th>
                                    <th class="text-left domain-column">網域名稱</th>
                                    <th class="text-left attachment-column">附件數量</th>
                                    <th class="text-center action-column" v-if="canOperateCrawler">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                <template v-if="!isSuccess">
                                    <tr v-for="n in 5" :key="n">
                                        <td v-for="m in 4" :key="m">
                                            <v-skeleton-loader type="text" />
                                        </td>
                                    </tr>
                                </template>
                                <template v-else>
                                    <template v-for="(item, index) in paginatedItems" :key="item.id">
                                        <!-- 主行 -->
                                        <tr
                                            @click="selectRow(item, $event)"
                                            :class="{
                                                'selected-row': selectedItems.includes(item.id),
                                                'hoverable-row': true,
                                                'expanded-row': expandedRows.includes(item.id),
                                            }"
                                        >
                                            <td
                                                class="text-center checkbox-column"
                                                @click.stop
                                                v-if="canOperateCrawler"
                                            >
                                                <v-checkbox
                                                    :model-value="selectedItems.includes(item.id)"
                                                    hide-details
                                                    density="compact"
                                                    @click.stop="toggleItemSelection(item.id)"
                                                ></v-checkbox>
                                            </td>
                                            <td class="text-left title-column">
                                                <div class="d-flex align-center">
                                                    <v-btn
                                                        density="compact"
                                                        variant="text"
                                                        icon
                                                        :class="expandedRows.includes(item.id) ? 'rotate-icon' : ''"
                                                        @click.stop="toggleRowExpand(item.id)"
                                                        v-if="item.attachments && item?.attachments_select_count > 0"
                                                    >
                                                        <v-icon>mdi-chevron-right</v-icon>
                                                    </v-btn>
                                                    <span class="ml-2">{{ item.title }}</span>
                                                </div>
                                            </td>
                                            <td class="text-left domain-column">{{ item.domain }}</td>
                                            <td class="text-left attachment-column">
                                                <div
                                                    v-if="item.attachments && item.attachments.length > 0"
                                                    class="d-flex align-center"
                                                >
                                                    <span class="mr-2">{{ item.attachments_count }} 個附件</span>

                                                    <v-chip
                                                        color="primary"
                                                        size="small"
                                                        @click.stop="openAttachmentDialog(item.site_id, item.title)"
                                                    >
                                                        已選擇 {{ item.attachments_select_count }} 個
                                                    </v-chip>
                                                </div>

                                                <span v-else>無附件</span>
                                            </td>

                                            <td class="text-center action-column" v-if="canOperateCrawler">
                                                <div class="justify-center gap-2 d-flex">
                                                    <v-btn
                                                        @click.stop="openDialog(item)"
                                                        :disabled="
                                                            item.training_state === 1 || item.training_state === 2
                                                        "
                                                        :color="
                                                            item.training_state === 99 ||
                                                            (item.training_state === 3 && item.last_time)
                                                                ? 'red-darken-3'
                                                                : 'blue'
                                                        "
                                                    >
                                                        <template
                                                            v-if="
                                                                item.training_state === 1 || item.training_state === 2
                                                            "
                                                        >
                                                            <v-icon class="mr-2 spin">mdi-loading</v-icon>
                                                            {{ item.training_state === 1 ? "爬蟲執行中" : "同步中" }}
                                                        </template>
                                                        <template v-else>
                                                            <span>
                                                                {{
                                                                    item.training_state === 99
                                                                        ? "同步失敗"
                                                                        : item.training_state === 3 && item.last_time
                                                                        ? "取消加入"
                                                                        : "加入"
                                                                }}
                                                            </span>
                                                        </template>
                                                    </v-btn>
                                                </div>
                                            </td>
                                        </tr>

                                        <!-- 展開的附件預覽行 -->
                                        <tr
                                            v-if="
                                                expandedRows.includes(item.id) &&
                                                item.attachments &&
                                                item.attachments.length > 0
                                            "
                                        >
                                            <td :colspan="canOperateCrawler ? 5 : 4" class="pa-0">
                                                <div class="attachment-preview pa-4 bg-grey-lighten-5">
                                                    <div class="mb-2 d-flex justify-space-between align-center">
                                                        <h3 class="text-subtitle-1">已選取附件預覽</h3>
                                                    </div>
                                                    <div class="attachment-list">
                                                        <div
                                                            v-for="(attachment, idx) in item.attachments.slice(
                                                                0,
                                                                item.attachments_select_count
                                                            )"
                                                            :key="idx"
                                                            class="attachment-item pa-2"
                                                        >
                                                            <div class="d-flex align-center">
                                                                <v-icon
                                                                    size="small"
                                                                    :color="getFileIconColor(attachment.href)"
                                                                >
                                                                    {{ getFileIcon(attachment.href) }}
                                                                </v-icon>
                                                                <span class="ml-2">{{ attachment.name }}</span>
                                                            </div>
                                                        </div>
                                                        <div class="mt-2 d-flex align-center">
                                                            <div
                                                                v-if="item.attachments_select_count > 3"
                                                                class="more-text"
                                                            >
                                                                還有 {{ item.attachments_select_count - 3 }} 個附件...
                                                                <span
                                                                    class="ml-1 view-attachment-text"
                                                                    @click.stop="
                                                                        openAttachmentDialog(item.site_id, item.title)
                                                                    "
                                                                    >查看全部</span
                                                                >
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </template>
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

            <!-- 對話框 -->
            <v-dialog v-model="dialogVisible" max-width="500px">
                <v-card>
                    <v-card-title>{{ dialogData.isBatchOperation ? "批量加入爬蟲" : "加入爬蟲" }}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-col cols="6">
                                <v-tooltip bottom>
                                    <template v-slot:activator="{ on, attrs }">
                                        <v-text-field
                                            v-model="dialogData.syncDays"
                                            label="同步天數"
                                            type="number"
                                            suffix="天"
                                            v-bind="attrs"
                                            @input="validateSyncDays"
                                            clearable
                                        ></v-text-field>
                                    </template>
                                    <span>設定多少天後執行同步</span>
                                </v-tooltip>
                            </v-col>
                            <v-col cols="6">
                                <v-tooltip bottom>
                                    <template v-slot:activator="{ on, attrs }">
                                        <v-text-field
                                            v-model="dialogData.syncTime"
                                            label="同步時間"
                                            type="time"
                                            v-bind="attrs"
                                            :disabled="!isSyncDaysValid"
                                            clearable
                                        ></v-text-field>
                                    </template>
                                    <span>設定在指定天數後的哪個時間點執行同步</span>
                                </v-tooltip>
                            </v-col>
                            <v-col cols="12">
                                <v-alert v-if="isSyncSettingComplete" type="info" outlined dense>
                                    {{ syncSettingMessage }}
                                </v-alert>
                                <v-alert v-else-if="dialogData.syncDays" type="warning" outlined dense>
                                    請選擇同步時間以完成設定。
                                </v-alert>
                                <v-alert v-else type="warning" outlined dense>
                                    請設定同步天數和時間以查看預計同步日期。
                                </v-alert>
                            </v-col>
                            <!-- 其他欄位保持不變 -->
                        </v-row>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn color="grey darken-1" text @click="closeDialog">取消</v-btn>
                        <v-btn color="blue-darken-1" text @click="submitDialog" :loading="crawlerLoadingState"
                            >加入</v-btn
                        >
                    </v-card-actions>
                </v-card>
            </v-dialog>
            <!-- 確認取消對話框 -->
            <v-dialog v-model="confirmDialogVisible" max-width="600px">
                <v-card class="d-flex flex-column" style="max-height: 90vh">
                    <v-card-title class="headline primary white--text">確認取消爬蟲</v-card-title>

                    <v-card-text class="overflow-y-auto flex-grow-1">
                        <template v-if="dialogLoading">
                            <v-container class="text-center">
                                <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
                                <p class="mt-4">正在取得需要取消的爬蟲...</p>
                            </v-container>
                        </template>
                        <template v-else>
                            <v-alert type="warning" dense text class="mb-4" v-if="relatedSites.length > 0">
                                取消該爬蟲後，相關站點的爬蟲也將一同終止。
                            </v-alert>

                            <p class="mb-4 text-h6">
                                您確定要{{ dialogData.isBatchOperation ? "批量取消" : "取消" }}以下
                                {{ cancelCrawlerList?.length }} 個爬蟲嗎？
                            </p>
                            <v-row>
                                <v-col cols="12" md="6">
                                    <v-card outlined>
                                        <v-card-title class="subtitle-1">選取的爬蟲：</v-card-title>
                                        <v-list dense class="overflow-y-auto" style="max-height: 300px">
                                            <v-list-item v-for="crawler in cancelCrawlerList" :key="crawler.crawler_id">
                                                <div>
                                                    <v-list-item-title>{{ crawler.title }}</v-list-item-title>
                                                    <v-list-item-subtitle class="text--secondary">
                                                        {{ crawler.domain }}
                                                    </v-list-item-subtitle>
                                                </div>
                                            </v-list-item>
                                        </v-list>
                                    </v-card>
                                </v-col>

                                <v-col cols="12" md="6" v-if="relatedSites.length > 0">
                                    <v-card outlined>
                                        <v-card-title class="subtitle-1">會影響到的站點：</v-card-title>
                                        <v-list dense class="overflow-y-auto" style="max-height: 300px">
                                            <v-list-item v-for="site in relatedSites" :key="site.site_id">
                                                <div>
                                                    <v-list-item-title>{{ site.title }}</v-list-item-title>
                                                    <v-list-item-subtitle class="text--secondary">{{
                                                        site.site_id
                                                    }}</v-list-item-subtitle>
                                                </div>
                                            </v-list-item>
                                        </v-list>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </template>
                    </v-card-text>

                    <v-divider></v-divider>

                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn color="grey darken-1" text @click="closeDialog" :disabled="dialogLoading">取消</v-btn>
                        <v-btn
                            color="red darken-1"
                            text
                            @click="confirmCancel"
                            :loading="isConfirming"
                            :disabled="dialogLoading"
                            >確定取消</v-btn
                        >
                    </v-card-actions>
                </v-card>
            </v-dialog>
            <AttachmentDialog
                v-model:open="attachmentDialogOpen"
                v-model:selectedAttachments="selectedAttachments"
                :site-id="currentSiteId"
                :site-name="currentSiteName"
                :is-pending="selectNeedDownloadAttachmentPending"
                @save="handleSaveAttachments"
            />
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
    width: 30%;
}

.domain-column {
    width: 20%;
}

.attachment-column {
    width: 20%;
}

.action-column {
    width: 20%;
}

.sticky-header {
    position: sticky;
    top: -24px;
    background-color: #fafafa;
    z-index: 9999;
    padding: 4px 8px;
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

@media (max-width: 400px) {
    .hide-on-xsmall {
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

.attachments-row {
    background-color: #f9fafb;
    transition: all 0.3s ease;
}

.attachments-container {
    padding: 8px 16px;
    border-top: 1px dashed rgba(0, 0, 0, 0.12);
    border-bottom: 1px dashed rgba(0, 0, 0, 0.12);
}

.attachment-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.attachment-item {
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.attachment-item:hover {
    background-color: rgba(0, 0, 0, 0.04);
}

.attachment-label {
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    border-radius: 16px;
    height: 24px;
    font-size: 0.75rem;
    background-color: rgba(25, 118, 210, 0.12);
    color: #1976d2;
}

.attachment-badge {
    background-color: #e3f2fd;
    color: #1976d2;
    font-size: 0.75rem;
    padding: 0 8px;
    border-radius: 12px;
    margin-left: 8px;
}

.rotate-icon {
    transition: transform 0.2s ease;
}

.rotate-icon.expanded {
    transform: rotate(90deg);
}

.attachment-dialog-actions {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 16px;
}

.selected-badge {
    background-color: #e8f5e9;
    color: #388e3c;
}

/* 滑鼠懸停效果 */
.v-btn.attachment-btn:hover {
    background-color: rgba(25, 118, 210, 0.04);
}

.v-btn.attachment-settings-btn {
    color: #1976d2;
    border: 1px solid #1976d2;
}

.v-btn.attachment-settings-btn:hover {
    background-color: rgba(25, 118, 210, 0.04);
}

.view-all-btn {
    font-size: 0.75rem;
}

/* 附件項目行數限制 */
.attachment-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
}

.view-attachment-text {
    cursor: pointer;
    color: #097ef3;
}

.view-attachment-text:hover {
    text-decoration: underline;
}

.more-text {
    color: #7b848b;
}

.fill-height {
    height: 70vh !important;
}
</style>
