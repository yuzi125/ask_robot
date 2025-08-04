<script setup>
import { ref, computed, onMounted, inject, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { format } from "date-fns";
import ConfirmComponents from "../components/ConfirmComponents.vue";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";
import { usePermissionChecker } from "@/composables";
import { getCrawlerSyncList } from "@/network/service";
import { getChipColor, getChipText, trainingStateOptions } from "@/utils/crawler";
// import emptyStatusNoData from "@/assets/no_data.png";

const { canPerformAction: canDownloadCrawlerLog } = usePermissionChecker("allowedToDownloadCrawlerLog");
const emitter = inject("emitter");
const axios = inject("axios");

const router = useRouter();
const route = useRoute();

const props = defineProps({
    datasets_id: { type: String, default: {} },
});

const autoSyncDialog = ref(false);
const autoSyncTime = ref("");
const currentItem = ref(null);

const syncDays = ref(null);
const syncTime = ref("");
const isSaving = ref(false);

const switchingStates = ref(new Map());
const selectedItems = ref([]);
const viewMode = ref("list");
const currentPage = ref(parseInt(route.query.page) || 1);
const itemsPerPage = ref(parseInt(route.query.perPage) || 10);
const pageInput = ref(currentPage.value);
const searchQuery = ref("");
const selectedTrainingStates = ref([]);

const isAnyItemSelected = computed(() => selectedItems.value.length > 0);
const selectedItemsCount = computed(() => selectedItems.value.length);

const {
    data: crawlerList,
    isLoading,
    isError,
    error,
    refetch,
} = useQuery({
    queryKey: ["crawlerSyncList", props.datasets_id],
    queryFn: () => getCrawlerSyncList(props.datasets_id),
    refetchInterval: 5000,
});

const filteredCrawlerList = computed(() => {
    if (!crawlerList.value) return [];
    return crawlerList.value.filter((item) => {
        const matchesSearch =
            item.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
            item.domain.toLowerCase().includes(searchQuery.value.toLowerCase());
        const matchesState =
            selectedTrainingStates.value.length === 0 || selectedTrainingStates.value.includes(item.training_state);
        return matchesSearch && matchesState;
    });
});

const hasNoData = computed(() => !isLoading.value && crawlerList.value && crawlerList.value.length === 0);
const hasNoSearchResults = computed(
    () =>
        !isLoading.value && crawlerList.value && crawlerList.value.length > 0 && filteredCrawlerList.value.length === 0
);

const paginatedCrawlerList = computed(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage.value;
    const endIndex = startIndex + itemsPerPage.value;
    return filteredCrawlerList.value.slice(startIndex, endIndex);
});

const totalPages = computed(() => Math.ceil(filteredCrawlerList.value.length / itemsPerPage.value));

const mutableCrawlerList = computed(() => {
    return paginatedCrawlerList.value.map((crawler) => ({
        ...crawler,
        isSwitching: switchingStates.value.get(crawler.id) || false,
        isSelected: selectedItems.value.includes(crawler.id),
    }));
});

function goAddSource() {
    router.push(`/datasets/${props.datasets_id}/crawlerSite`);
}

function goRouter(id) {
    router.push(`/datasets/${props.datasets_id}/syncCrawler/${id}`);
}

const confirm_com = ref(null);
const confirmOpen = function (item) {
    currentItem.value = item;
    confirm_com.value.open(item);
};

async function syncCrawler(item) {
    const crawlerIds = [item.crawlerId];
    const datasetsId = props.datasets_id;
    try {
        const rs = await axios.post(
            "/crawler/syncCrawler",
            JSON.stringify({
                crawlerIds,
                datasetsId,
            }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );

        if (rs.data.code === 0) {
            emitter.emit("openSnackbar", { message: "同步中，請稍後。", color: "success" });
        } else {
            throw new Error(rs.data.message);
        }
    } catch (error) {
        emitter.emit("openSnackbar", { message: "同步失敗: " + error.message, color: "error" });
    } finally {
        refetch();
    }
}

const confirmCrawlerStatus = ref(null);
const confirmOpenCrawlerStatus = async function (item) {
    confirmCrawlerStatus.value.open(item); // 再次調用 open 以打開對話框
};

async function toggleEnable(item) {
    const syncId = item.id;
    const crawlerId = item.crawlerId;
    const datasetsId = props.datasets_id;
    const training_state = item.training_state;

    switchingStates.value.set(item.id, true);

    try {
        const response = await axios.post("/crawler/toggleSyncCrawlerEnable", {
            syncId,
            crawlerId,
            datasetsId,
            training_state,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", {
                message: "狀態更改請求已發送，請稍後查看更新結果",
                color: "info",
            });

            const intensiveRefetch = async () => {
                for (let i = 0; i < 5; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    await refetch();
                }
                switchingStates.value.delete(item.id);
            };
            intensiveRefetch();
        } else {
            throw new Error(response.data.message);
        }
    } catch (error) {
        emitter.emit("openSnackbar", {
            message: `操作失敗: ${error.message}`,
            color: "error",
        });
        switchingStates.value.delete(item.id);
    }
}

function toggleSelection(item, event) {
    if (item.training_state === 1 || item.training_state === 2) {
        return;
    }

    if (event.target.closest(".v-btn") || event.target.closest(".v-switch")) {
        return;
    }

    const index = selectedItems.value.indexOf(item.id);
    if (index === -1) {
        selectedItems.value.push(item.id);
    } else {
        selectedItems.value.splice(index, 1);
    }
}

async function syncSelectedItems() {
    try {
        const selectedCrawlers = mutableCrawlerList.value.filter((item) => selectedItems.value.includes(item.id));
        const crawlerIds = selectedCrawlers.map((item) => item.crawlerId);

        await axios.post(
            "/crawler/syncCrawler",
            JSON.stringify({
                crawlerIds,
                datasetsId: props.datasets_id,
            }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );

        selectedItems.value = [];
        emitter.emit("openSnackbar", { message: "批量同步已啟動，請稍後查看結果。", color: "success" });
        refetch();
    } catch (error) {
        emitter.emit("openSnackbar", { message: "批量同步失敗: " + error.message, color: "error" });
    }
}
const allSelected = ref(false);

function toggleSelectAll() {
    const selectableItems = mutableCrawlerList.value.filter(isItemSelectable);
    if (allSelected.value) {
        selectedItems.value = selectedItems.value.filter((id) => !selectableItems.some((item) => item.id === id));
    } else {
        selectedItems.value = [...new Set([...selectedItems.value, ...selectableItems.map((item) => item.id)])];
    }
    allSelected.value = !allSelected.value;
}

function isItemSelectable(item) {
    return item.training_state !== 1 && item.training_state !== 2;
}

const getItemTitle = (id) => {
    const item = trainingStateOptions.find((option) => option.value === id);
    return item ? item.title : "";
};

const selectedItemsText = computed(() => {
    if (selectedTrainingStates.value.length === 0) {
        return "無選中項目";
    }

    console.log("selectedTrainingStates", selectedTrainingStates.value.map((id) => getItemTitle(id)).join(", "));
    return selectedTrainingStates.value.map((id) => getItemTitle(id)).join(", ");
});

// Update toggleItemSelection to use isItemSelectable
function toggleItemSelection(item, event) {
    if (!isItemSelectable(item)) return;

    if (event.target.closest(".v-btn") || event.target.closest(".v-switch")) {
        return;
    }

    const index = selectedItems.value.indexOf(item.id);
    if (index === -1) {
        selectedItems.value.push(item.id);
    } else {
        selectedItems.value.splice(index, 1);
    }
}

// 設定週期相關

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

async function openAutoSyncDialog(item) {
    currentItem.value = item;
    autoSyncDialog.value = true;
    await fetchSyncSettings(item.crawlerId);
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
    isSaving.value = true;
    try {
        const response = await axios.post("/crawler/syncCrawlerSchedule", {
            datasetsId: props.datasets_id,
            crawlerIds: [currentItem.value.crawlerId],
            syncDays: syncDays.value,
            syncTime: syncTime.value,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "成功更新同步時間", color: "success" });
            refetch();
        }
        autoSyncDialog.value = false;
        // 可能需要更新父組件中的數據或觸發重新加載
    } catch (error) {
        console.error("Error saving sync settings:", error);
        // 處理錯誤，可能需要顯示錯誤消息給用戶
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    } finally {
        isSaving.value = false;
    }
}

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

function closeDialog() {
    autoSyncDialog.value = false;
    syncDays.value = null;
    syncTime.value = "";
}

const formatNextSyncDate = (dateString) => {
    if (!dateString) return "未設置";
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

watch(autoSyncDialog, (newValue) => {
    if (!newValue) {
        syncDays.value = null;
        syncTime.value = "";
    }
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
    router.push({
        query: {
            ...route.query,
            page: newPage,
            perPage: newPerPage,
        },
    });
});

watch([searchQuery, selectedTrainingStates], () => {
    currentPage.value = 1;
    pageInput.value = 1;
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
</script>

<template>
    <v-container fluid>
        <div class="crawler-list">
            <v-row class="mb-4">
                <v-col cols="12" md="8">
                    <h2 class="text-h5 font-weight-bold">爬蟲 - 已同步站點</h2>
                    <p class="text-body-2 text-grey-darken-1">知識庫已同步的網站都在這裡顯示，可查詢已同步的爬蟲</p>
                </v-col>
                <v-col cols="12" md="4" class="justify-end d-flex align-center" v-if="!hasNoData">
                    <!-- <v-btn
                        prepend-icon="mdi-sync"
                        color="success"
                        class="mr-2"
                        @click="syncSelectedItems"
                        :disabled="!isAnyItemSelected"
                    >
                        批量同步({{ selectedItemsCount }})
                    </v-btn> -->
                    <v-btn prepend-icon="fa-solid fa-plus" color="primary" @click="goAddSource"> 新增爬蟲 </v-btn>
                </v-col>
            </v-row>

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
                    headline="尚未同步任何爬蟲"
                    text="目前還沒有同步任何爬蟲的資料。同步後的爬蟲資訊將會顯示在這裡，方便您查詢和管理已爬取的內容。"
                    actionText="開始同步爬蟲"
                    actionIcon="fa-solid fa-sync"
                    :actionCallback="goAddSource"
                />
            </v-row>

            <v-card class="content-card" v-else>
                <v-card-text>
                    <div class="sticky-header">
                        <div class="py-2 overflow-x-auto d-flex flex-nowrap align-center justify-space-between">
                            <div class="mr-2 d-flex flex-nowrap align-center">
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

                            <div class="d-flex flex-nowrap align-center">
                                <div class="d-flex">
                                    <v-btn
                                        prepend-icon="mdi-sync"
                                        color="success"
                                        @click="syncSelectedItems"
                                        :disabled="!isAnyItemSelected"
                                    >
                                        批量同步({{ selectedItemsCount }})
                                    </v-btn>
                                    <!-- <v-btn prepend-icon="fa-solid fa-plus" color="primary" @click="goAddSource">
                                        新增爬蟲
                                    </v-btn> -->
                                </div>

                                <!-- <v-divider vertical class="mx-1"></v-divider>

                                <v-btn-toggle v-model="viewMode" mandatory density="comfortable" class="view-toggle">
                                    <v-btn value="list"> <v-icon>mdi-format-list-bulleted</v-icon> </v-btn>
                                    <v-btn value="grid"> <v-icon>mdi-grid</v-icon> </v-btn>
                                </v-btn-toggle> -->
                            </div>
                        </div>
                    </div>

                    <!-- 列表 -->
                    <v-table show-expand v-if="viewMode === 'list'" class="elevation-1 list-table">
                        <thead>
                            <tr>
                                <th class="text-left">
                                    <v-checkbox
                                        v-model="allSelected"
                                        @click="toggleSelectAll"
                                        hide-details
                                        density="compact"
                                    ></v-checkbox>
                                </th>
                                <th class="text-left">網站名稱</th>
                                <th class="text-left">網域名稱</th>
                                <th class="text-left">狀態</th>
                                <th class="text-center">詳情</th>
                                <th class="text-left">爬蟲狀態</th>
                                <th class="text-left" v-if="canDownloadCrawlerLog">爬蟲Log</th>
                                <th class="text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="item in mutableCrawlerList"
                                :key="item.id"
                                @click="toggleItemSelection(item, $event)"
                            >
                                <td>
                                    <v-checkbox
                                        :model-value="selectedItems.includes(item.id)"
                                        @click.stop="toggleItemSelection(item, $event)"
                                        hide-details
                                        density="compact"
                                        :disabled="!isItemSelectable(item)"
                                    ></v-checkbox>
                                </td>
                                <td>
                                    {{ item.title }}
                                    <v-tooltip activator="parent" location="top">
                                        <span>下次自動同步時間: {{ formatNextSyncDate(item.next_sync_date) }}</span>
                                    </v-tooltip>
                                </td>
                                <td>
                                    {{ item.domain }}
                                    <v-tooltip activator="parent" location="top">
                                        <span>下次自動同步時間: {{ formatNextSyncDate(item.next_sync_date) }}</span>
                                    </v-tooltip>
                                </td>
                                <td>
                                    <v-chip :color="getChipColor(item.training_state)">
                                        <v-tooltip activator="parent" location="top">
                                            <span v-if="item.task_id"> (Task ID: {{ item.task_id }})</span></v-tooltip
                                        >
                                        {{ getChipText(item.training_state) }}
                                    </v-chip>
                                </td>

                                <td class="text-center">
                                    <v-btn
                                        @click.stop="goRouter(item.id)"
                                        variant="text"
                                        color="accent"
                                        class="link-text"
                                    >
                                        <v-tooltip activator="parent" location="top">查看詳細資料</v-tooltip>
                                        <v-icon start>mdi-page-next</v-icon>
                                        詳細
                                    </v-btn>
                                    <!-- <v-btn color="blue" @click.stop="goRouter(item.id)"> 查看詳情 </v-btn> -->
                                </td>
                                <td>
                                    <v-switch
                                        :model-value="item.training_state !== 4"
                                        @click.prevent="confirmOpenCrawlerStatus(item)"
                                        :label="item.training_state !== 4 ? '啟用' : '禁用'"
                                        color="primary"
                                        hide-details
                                        density="compact"
                                        :loading="item.isSwitching"
                                        :disabled="item.isSwitching"
                                    ></v-switch>
                                </td>
                                <td class="text-center" v-if="canDownloadCrawlerLog">
                                    <v-btn
                                        @click.stop="downloadCrawlerLog(item)"
                                        variant="text"
                                        color="accent"
                                        class="link-text"
                                    >
                                        <v-tooltip activator="parent" location="top">{{ item.dir }}</v-tooltip>
                                        <v-icon start>mdi-download</v-icon>
                                        下載爬蟲log
                                    </v-btn>
                                    <!-- <v-btn color="blue" @click.stop="goRouter(item.id)"> 查看詳情 </v-btn> -->
                                </td>
                                <td class="text-center">
                                    <v-menu>
                                        <template v-slot:activator="{ props }">
                                            <v-btn icon="mdi-dots-vertical" variant="text" v-bind="props"></v-btn>
                                        </template>
                                        <v-list>
                                            <v-list-item @click.stop="openAutoSyncDialog(item)">
                                                <v-list-item-title class="auto-sync">編輯排程</v-list-item-title>
                                            </v-list-item>
                                            <v-list-item
                                                @click.stop="confirmOpen(item)"
                                                :disabled="item.training_state === 1 || item.training_state === 2"
                                            >
                                                <v-list-item-title class="immediately-sync">立即同步</v-list-item-title>
                                            </v-list-item>
                                        </v-list>
                                    </v-menu>
                                </td>
                            </tr>
                        </tbody>
                    </v-table>

                    <!-- 網格 -->
                    <v-row v-else>
                        <v-col v-for="item in mutableCrawlerList" :key="item.id" cols="12" sm="6" md="6" lg="4">
                            <v-card class="crawler-card" @click="toggleSelection(item, $event)">
                                <v-card-item>
                                    <div class="mb-2 d-flex justify-space-between align-center">
                                        <div class="title-container">
                                            <v-tooltip activator="parent" location="top">{{ item.title }}</v-tooltip>
                                            <v-card-title class="text-h6 font-weight-bold text-truncate">{{
                                                item.title
                                            }}</v-card-title>
                                        </div>
                                        <v-checkbox
                                            v-model="item.isSelected"
                                            @click="toggleSelection(item, $event)"
                                            hide-details
                                            class="flex-shrink-0 mt-0 ml-2"
                                            :disabled="item.training_state === 1 || item.training_state === 2"
                                        ></v-checkbox>
                                    </div>
                                    <v-card-subtitle>
                                        <div><strong>同步站點:</strong> {{ item.domain }}</div>
                                        <div>
                                            <strong>最後同步:</strong>
                                            {{ format(new Date(item.last_time), "yyyy-MM-dd HH:mm:ss") }}
                                        </div>
                                    </v-card-subtitle>
                                </v-card-item>

                                <v-divider></v-divider>

                                <v-card-text class="crawler-status">
                                    <div class="d-flex justify-space-between align-center">
                                        <span class="font-weight-medium">狀態</span>
                                        <v-chip :color="getChipColor(item.training_state)">
                                            {{ getChipText(item.training_state) }}
                                        </v-chip>
                                    </div>
                                </v-card-text>

                                <v-divider></v-divider>

                                <v-card-text class="crawler-status">
                                    <div class="d-flex justify-space-between align-center">
                                        <span class="font-weight-medium">爬蟲狀態</span>
                                        <v-switch
                                            :model-value="item.training_state !== 4"
                                            @update:model-value="toggleEnable(item)"
                                            :label="item.training_state !== 4 ? '啟用' : '禁用'"
                                            color="primary"
                                            hide-details
                                            density="compact"
                                            :loading="item.isSwitching"
                                            :disabled="item.isSwitching"
                                        ></v-switch>
                                    </div>
                                </v-card-text>

                                <v-divider></v-divider>

                                <v-card-actions>
                                    <v-row no-gutters>
                                        <v-col cols="6" class="pa-1">
                                            <v-btn
                                                color="primary"
                                                variant="tonal"
                                                block
                                                @click.stop="openAutoSyncDialog(item)"
                                            >
                                                <v-icon start>mdi-cog-sync</v-icon>自動同步
                                            </v-btn>
                                        </v-col>
                                        <v-col cols="6" class="pa-1">
                                            <v-btn
                                                color="success"
                                                variant="tonal"
                                                block
                                                @click.stop="confirmOpen(item)"
                                                :disabled="item.training_state === 1 || item.training_state === 2"
                                            >
                                                <template v-if="item.training_state === 1 || item.training_state === 2">
                                                    <v-icon class="mr-2 spin">mdi-loading</v-icon>同步中
                                                </template>
                                                <template v-else> <v-icon start>mdi-sync</v-icon>立即同步 </template>
                                            </v-btn>
                                        </v-col>

                                        <v-col cols="12" class="pa-1">
                                            <v-btn
                                                color="secondary"
                                                variant="tonal"
                                                block
                                                @click.stop="goRouter(item.id)"
                                            >
                                                <v-icon start>mdi-eye</v-icon>查看詳情
                                            </v-btn>
                                        </v-col>
                                    </v-row>
                                </v-card-actions>
                            </v-card>
                        </v-col>
                    </v-row>
                    <EmptyStateSearch v-if="hasNoSearchResults" />
                    <!-- 分頁控制 -->
                    <div class="pagination-wrapper">
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

            <!-- 自動同步對話框 -->
            <v-dialog v-model="autoSyncDialog" max-width="500px">
                <v-card>
                    <v-card-title>設置自動同步</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-col cols="6">
                                <v-tooltip bottom>
                                    <template v-slot:activator="{ on, attrs }">
                                        <v-text-field
                                            v-model="syncDays"
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
                                            v-model="syncTime"
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
                                <v-alert v-else-if="syncDays" type="warning" outlined dense>
                                    請選擇同步時間以完成設定。
                                </v-alert>
                                <v-alert v-else type="warning" outlined dense>
                                    請設定同步天數和時間以查看預計同步日期。
                                </v-alert>
                            </v-col>
                        </v-row>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn color="grey darken-1" text @click="closeDialog">取消</v-btn>
                        <v-btn
                            color="primary"
                            @click="saveAutoSync"
                            :disabled="!isSyncSettingComplete"
                            :loading="isSaving"
                            >保存</v-btn
                        >
                    </v-card-actions>
                </v-card>
            </v-dialog>
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
</style>
