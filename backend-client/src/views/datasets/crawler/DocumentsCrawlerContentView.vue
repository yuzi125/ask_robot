<script setup>
import { ref, computed, watch, inject, onMounted, onUnmounted, nextTick } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { marked } from "marked";
import { debounce } from "lodash-es";
import { useRoute, useRouter } from "vue-router";
import { fetchCrawlerDocumentContent, fetchCrawlerSyncTrainingState, fetchCrawlerSyncInfo } from "@/network/service";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";
import CompletionDialog from "@/components/crawler/CompletionDialog.vue";
import ColumnSettings from "@/components/common/ColumnSettings.vue";
import { getChipColor, getChipText, trainingStateOptions } from "@/utils/crawler";
import { useShowTableColumns } from "@/composables";
const axios = inject("axios");
const emitter = inject("emitter");

const props = defineProps({
    datasets_id: { type: String, default: "" },
    synchronize_id: { type: String, default: "" },
});

const route = useRoute();
const router = useRouter();

const initialLoad = ref(true);

const viewMode = ref("list");
const currentPage = ref(parseInt(route.query.page) || 1);
const itemsPerPage = ref(parseInt(route.query.perPage) || 10);
const crawlerSyncLog = ref(route.query.crawlerSyncLog || false);
const selectedItem = ref(null);
const showDialog = ref(false);
const showMarkdown = ref(true);
const searchInput = ref("");
const debouncedSearchTerm = ref("");
const selectedTrainingStates = ref([]);

// 創建一個 debounced 函數 先給 500ms
const debouncedSearch = debounce((val) => {
    debouncedSearchTerm.value = val;
}, 500);

const tableConfig = {
    columnLabels: {
        title: "標題",
        content: "內容",
        status: "狀態",
        details: "詳情",
        completion: "問法",
        link: "連結文字",
    },
    allColumns: ["title", "content", "status", "details", "completion", "link"],
    storageKey: "crawler-content-table-columns",
    requiredFields: ["title", "status"], // 確保核心欄位始終顯示
};

// 使用 composable
const { columnLabels, allColumns, requiredFields, visibleColumns } = useShowTableColumns(tableConfig);

const {
    data: syncCrawlerDocumentContent,
    isPlaceholderData,
    error,
    refetch,
    isSuccess,
    isLoading,
} = useQuery({
    queryKey: [
        "crawlerData",
        props.datasets_id,
        props.synchronize_id,
        currentPage,
        itemsPerPage,
        debouncedSearchTerm,
        selectedTrainingStates,
    ],
    queryFn: () =>
        fetchCrawlerDocumentContent(
            props.datasets_id,
            props.synchronize_id,
            currentPage.value,
            itemsPerPage.value,
            debouncedSearchTerm.value,
            selectedTrainingStates.value,
            crawlerSyncLog.value
        ),
    placeholderData: keepPreviousData,
    refetchInterval: 3000,
    // keepPreviousData: true,
});

const { data: syncCrawlerInfo } = useQuery({
    queryKey: ["syncCrawlerInfo", props.datasets_id, props.synchronize_id],
    queryFn: () => fetchCrawlerSyncInfo(props.datasets_id, props.synchronize_id),
});

// 取得 training_state 的狀態
const { data: crawlerSyncTrainingStateData } = useQuery({
    queryKey: ["crawlerSyncTrainingState", props.synchronize_id],
    queryFn: () => fetchCrawlerSyncTrainingState(props.synchronize_id),
});
const pageInput = ref("");
// 新增一個 ref 來存儲總項目數
const totalItemsCount = ref(0);

// 同步的 document content
const documentContentResponseData = computed(() => syncCrawlerDocumentContent.value?.data || {});
const crawlerContent = computed(() => documentContentResponseData.value.crawler_content_list || []);

// 完全沒有資料的話要顯示的 目前用不到 某天可能用的到
const hasNoData = computed(() => {
    return isSuccess.value && documentContentResponseData.value.total_items === "0";
});

const hasNoSearchResults = computed(() => {
    return (
        isSuccess.value &&
        documentContentResponseData.value.total_items === "0" &&
        (debouncedSearchTerm.value !== "" || selectedTrainingStates.value.length > 0)
    );
});

// 外層的 training_state
const crawlerSyncTrainingState = computed(() => crawlerSyncTrainingStateData.value?.training_state || 0);

const canActiveNumber = computed(() => {
    let count = 0;
    selectedItems.value.forEach((itemId) => {
        const item = crawlerContent.value.find((item) => item.id === itemId);
        if (item && (item.training_state == 4 || item.training_state == 6)) {
            count++;
        }
    });
    return count;
});

const canActivePages = computed(() => {
    if (selectedItems.value.length === 0) {
        return false;
    }
    const hasInvalidStatus = selectedItems.value.some((itemId) => {
        const item = crawlerContent.value.find((item) => item.id === itemId);
        if (item) {
            return [2, 3, 7].includes(item.training_state);
        } else {
            return false;
        }
    });
    return !hasInvalidStatus;
});

const canInactiveNumber = computed(() => {
    let count = 0;
    selectedItems.value.forEach((itemId) => {
        const item = crawlerContent.value.find((item) => item.id === itemId);
        if (item && item.training_state == 3) {
            count++;
        }
    });
    return count;
});
const canInactivePages = computed(() => {
    if (selectedItems.value.length === 0) {
        return false;
    }
    const hasInvalidStatus = selectedItems.value.some((itemId) => {
        const item = crawlerContent.value.find((item) => item.id === itemId);
        if (item) {
            return [2, 4, 6, 7].includes(item.training_state);
        } else {
            return false;
        }
    });
    return !hasInvalidStatus;
});

const crawlerInfoResponseData = computed(() => syncCrawlerInfo.value?.data || {});
const crawlerInfo = computed(() => crawlerInfoResponseData.value.crawler_info || {});
const totalPages = computed(() => Math.max(1, Math.ceil(totalItemsCount.value / itemsPerPage.value)));

const formattedDate = computed(() => {
    if (crawlerInfo.value.update_time) {
        return new Date(crawlerInfo.value.update_time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
    }
    return "";
});

const documentExpireDate = (update_time) => {
    if (!update_time) return "";

    // 取得更新時間
    const updateDate = new Date(update_time);
    // 計算過期時間（更新時間 + 30天）
    const expireDate = new Date(updateDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    // 取得現在時間
    const now = new Date();

    // 計算剩餘天數
    const remainingDays = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));

    // 格式化更新時間
    const formattedUpdateTime = updateDate.toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
    });

    return `剩餘 ${remainingDays} 天（更新時間：${formattedUpdateTime}）`;
};

const isItemSelected = computed(() => {
    return selectedItems.value.includes(selectedItem.value.id);
});

const stripMarkdownAndHtml = (text) => {
    let plainText = marked(text);

    let strippedText = plainText.replace(/<[^>]+>/g, "");

    strippedText = strippedText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line)
        .join("\n")
        .replace(/[ \t]+/g, " ");

    return strippedText;
};

function truncateText(text, length) {
    if (text.length <= length) return text;
    return text.slice(0, length) + "...";
}

function openDialog(item) {
    selectedItem.value = item;
    showDialog.value = true;
}

function renderMarkdown(content) {
    return marked(content);
}

function refetchData() {
    currentPage.value = 1; // 重置到第一頁
    refetch();
}

// 監聽 searchInput 的變化
watch(searchInput, (newVal) => {
    debouncedSearch(newVal);
});

// 當 debouncedSearchTerm 改變時，重置頁碼並重新獲取數據
watch(debouncedSearchTerm, () => {
    currentPage.value = 1;
    refetch();
});

// 使用 watch 來替代 onSuccess 計算總項目數
watch(
    syncCrawlerDocumentContent,
    (newData) => {
        if (newData?.data) {
            totalItemsCount.value = newData.data.total_items || 0;
        }
    },
    { immediate: true }
);

// 啟用禁用

const selectedItems = ref([]);
const selectableItems = computed(() => crawlerContent.value.filter((item) => item.training_state !== 6));

const allSelected = computed({
    get: () => {
        const selectableCount = selectableItems.value.length;
        return selectableCount > 0 && selectedItems.value.length === selectableCount;
    },
    set: (value) => {
        selectedItems.value = value ? selectableItems.value.map((item) => item.id) : [];
    },
});

function toggleSelectAll() {
    allSelected.value = !allSelected.value;
}

function toggleItemSelection(itemId) {
    const item = crawlerContent.value.find((item) => item.id === itemId);
    if (item) {
        const index = selectedItems.value.indexOf(itemId);
        if (index === -1) {
            selectedItems.value.push(itemId);
        } else {
            selectedItems.value.splice(index, 1);
        }
    }
}
async function bulkToggleStatus(enable) {
    try {
        let enableStatus = enable ? 1 : 0;

        const response = await axios.post("/crawler/toggleSyncCrawlerContentEnable", {
            enableStatus,
            documentContentIds: selectedItems.value,
            datasetsId: props.datasets_id,
            crawlerSyncTrainingState: crawlerSyncTrainingState.value,
            synchronizeId: props.synchronize_id,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", {
                message: enable ? "啟用內容成功" : "禁用內容成功",
                color: "success",
            });

            refetch();
        } else {
            throw new Error(response.data.message);
        }

        selectedItems.value = []; // 清空選擇
    } catch (error) {}
}

// 開啟外部連結
const openExternalLink = (url) => {
    emitter.emit("openUrl", url);
};

const getItemTitle = (id) => {
    const item = trainingStateOptions.find((option) => option.value === id);
    return item ? item.title : "";
};

const selectedItemsText = computed(() => {
    if (selectedTrainingStates.value.length === 0) {
        return "無選中項目";
    }

    return selectedTrainingStates.value.map((id) => getItemTitle(id)).join(", ");
});

// 讓表格可以左右滾動

// todo: 跳轉頁面後，可能 scrollLeft 的算法會有問題，需要再檢查
const tableRef = ref(null);
const scrollAmount = ref(300);
const isScrolledToEnd = ref(false);
const isScrolledToStart = ref(true);
const animationDuration = 150;

const getScrollContainer = () => {
    if (tableRef.value && tableRef.value.$el) {
        return tableRef.value.$el.querySelector(".v-table__wrapper");
    }
    return null;
};

const scrollTo = (container, targetScrollLeft) => {
    const start = container.scrollLeft;
    const change = targetScrollLeft - start;
    const startTime = performance.now();

    const animateScroll = (currentTime) => {
        const elapsedTime = currentTime - startTime;
        if (elapsedTime < animationDuration) {
            const progress = elapsedTime / animationDuration;
            container.scrollLeft = start + change * easeInOutQuad(progress);
            requestAnimationFrame(animateScroll);
        } else {
            container.scrollLeft = targetScrollLeft;
            checkScrollPosition();
        }
    };

    requestAnimationFrame(animateScroll);
};

// 神奇小魔法
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

const scrollRight = () => {
    const container = getScrollContainer();
    if (container) {
        const targetScrollLeft = container.scrollLeft + scrollAmount.value;
        scrollTo(container, targetScrollLeft);
    }
};

const scrollLeft = () => {
    const container = getScrollContainer();
    if (container) {
        const targetScrollLeft = container.scrollLeft - scrollAmount.value;
        scrollTo(container, targetScrollLeft);
    }
};

const checkScrollPosition = () => {
    const container = getScrollContainer();
    if (container) {
        const { scrollLeft, scrollWidth, clientWidth } = container;
        isScrolledToEnd.value = scrollLeft + clientWidth >= scrollWidth - 1;
        isScrolledToStart.value = scrollLeft <= 1;
    }
};

const updateScrollState = () => {
    nextTick(() => {
        checkScrollPosition();
    });
};

watch(isSuccess, (newValue) => {
    if (newValue) {
        updateScrollState();
    }
});

// 接收 url params 相關

function jumpToPage() {
    const pageNumber = parseInt(pageInput.value);
    if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages.value) {
        currentPage.value = pageNumber;
        router.push({
            query: {
                ...route.query,
                page: pageNumber,
            },
        });
    }
}

watch([currentPage, itemsPerPage], ([newPage, newPerPage]) => {
    updateScrollState();
    if (route.query.page !== newPage.toString() || route.query.perPage !== newPerPage.toString()) {
        router.push({
            query: {
                ...route.query,
                page: route.query.perPage !== newPerPage.toString() ? 1 : newPage,
                perPage: newPerPage,
            },
        });
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
            nextTick(() => {
                refetch();
            });
        }
    },
    { immediate: true }
);
onMounted(() => {
    nextTick(() => {
        const container = getScrollContainer();
        if (container) {
            container.addEventListener("scroll", checkScrollPosition);
            checkScrollPosition();
            updateScrollState();
        }
    });

    // 如果是初次載入且 URL 中沒有分頁參數，需要新增一個歷史記錄，ㄅ然記錄會被吃掉
    if (initialLoad.value && !route.query.page && !route.query.perPage) {
        router.replace({
            query: {
                ...route.query,
                page: currentPage.value,
                perPage: itemsPerPage.value,
            },
        });
    }
    initialLoad.value = false;

    // 上一頁下一頁的監聽
    window.addEventListener("popstate", () => {
        const newPage = parseInt(route.query.page) || 1;
        const newPerPage = parseInt(route.query.perPage) || 10;
        if (currentPage.value !== newPage || itemsPerPage.value !== newPerPage) {
            currentPage.value = newPage;
            itemsPerPage.value = newPerPage;
            nextTick(() => {
                refetch();
            });
        }
    });
});

onUnmounted(() => {
    const container = getScrollContainer();
    if (container) {
        container.removeEventListener("scroll", checkScrollPosition);
    }
});

// 補全對話框相關的狀態
const showCompletionDialog = ref(false);
const currentDocument = ref(null);

// 打開補全對話框
const openCompletionDialog = (item) => {
    currentDocument.value = item;

    showCompletionDialog.value = true;
};
</script>

<template>
    <v-container class="crawler-display">
        <v-alert v-if="error" type="error" class="mb-4"> 載入數據時發生錯誤：{{ error.message }} </v-alert>
        <v-card class="mb-6 crawler-info elevation-1">
            <v-skeleton-loader v-if="!isSuccess" type="article" :loading="!isSuccess"> </v-skeleton-loader>

            <template v-else>
                <v-alert
                    v-if="crawlerSyncTrainingState === 4"
                    type="error"
                    class="pa-3 ma-2"
                    border="left"
                    elevation="2"
                    icon="mdi-alert-circle"
                >
                    爬蟲已禁用，當前修改的狀態不會有任何異動，將於下次啟用爬蟲後生效。
                </v-alert>
                <v-card-title class="text-h4 font-weight-bold white--text pa-4">
                    {{ crawlerInfo.title }}
                </v-card-title>
                <v-card-text>
                    <v-chip class="mr-2" color="info" label>
                        <v-btn variant="text" color="info" @click.stop="openExternalLink(crawlerInfo.url)">
                            <v-icon start>mdi-open-in-new</v-icon>
                            來源網站
                        </v-btn>
                    </v-chip>
                    <v-chip color="secondary" label>
                        <v-icon start icon="mdi-clock-outline"></v-icon>
                        最後更新: {{ formattedDate }}
                    </v-chip>
                </v-card-text>
            </template>
        </v-card>

        <v-card class="content-card">
            <v-card-text>
                <div class="sticky-header">
                    <div class="py-2 overflow-x-auto d-flex flex-nowrap align-center justify-space-between">
                        <div class="mr-2 d-flex flex-nowrap align-center ga-2">
                            <v-text-field
                                v-model="searchInput"
                                @input="debouncedSearch($event.target.value)"
                                label="標題及內容搜尋"
                                prepend-inner-icon="mdi-magnify"
                                hide-details
                                class="mr-2 search-field"
                            >
                            </v-text-field>

                            <v-tooltip :text="selectedItemsText" location="top">
                                <template v-slot:activator="{ props }">
                                    <v-select
                                        v-model="selectedTrainingStates"
                                        :items="trainingStateOptions"
                                        label="狀態搜索"
                                        multiple
                                        hide-details
                                        @update:model-value="refetchData"
                                        class="state-select"
                                        v-bind="props"
                                    >
                                        <template v-slot:selection="{ item, index }">
                                            <v-chip v-if="index < 1">
                                                <span>{{ item.title }}</span>
                                            </v-chip>
                                            <span v-if="index === 1" class="text-grey text-caption align-self-center">
                                                (+{{ selectedTrainingStates.length - 1 }} others)
                                            </span>
                                        </template>
                                    </v-select>
                                </template>
                            </v-tooltip>
                        </div>

                        <div class="d-flex flex-nowrap align-center">
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
                                    :color="canActivePages ? 'success' : ''"
                                    :disabled="!canActivePages"
                                    @click="bulkToggleStatus(true)"
                                    class="mr-1 batch-btn"
                                >
                                    批量啟用 <span>({{ canActiveNumber }})</span>
                                </v-btn>
                                <v-btn
                                    :color="canInactivePages ? 'error' : ''"
                                    :disabled="!canInactivePages"
                                    @click="bulkToggleStatus(false)"
                                    class="batch-btn"
                                >
                                    批量禁用 <span>({{ canInactiveNumber }})</span>
                                </v-btn>
                            </div>

                            <!-- <v-divider vertical class="mx-1"></v-divider>

                            <v-btn-toggle v-model="viewMode" mandatory density="comfortable" class="view-toggle">
                                <v-btn value="list"> <v-icon>mdi-format-list-bulleted</v-icon> </v-btn>
                                <v-btn value="grid"> <v-icon>mdi-grid</v-icon> </v-btn>
                            </v-btn-toggle> -->
                        </div>
                    </div>
                </div>

                <!-- <div class="mb-4 d-flex justify-space-between align-center">
                    <div>
                        <v-btn
                            color="success"
                            @click="bulkToggleStatus(true)"
                            class="mr-2"
                            :disabled="selectedItems.length === 0"
                            >啟用所選</v-btn
                        >
                        <v-btn color="error" @click="bulkToggleStatus(false)" :disabled="selectedItems.length === 0"
                            >禁用所選</v-btn
                        >
                    </div>
                    <div>已選擇 {{ selectedItems.length }} 項</div>
                </div> -->
                <div class="position-relative content-container">
                    <div v-if="isPlaceholderData" class="justify-center table-overlay d-flex align-center">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    </div>

                    <!-- 列表模式 -->
                    <div class="scrollable-table-container" v-if="viewMode === 'list'">
                        <v-table
                            v-if="viewMode === 'list'"
                            class="elevation-1 list-table scrollable-table"
                            ref="tableRef"
                        >
                            <thead>
                                <tr>
                                    <!-- 複選框欄位 -->
                                    <th class="checkbox-column" v-if="isSuccess">
                                        <v-checkbox
                                            v-model="allSelected"
                                            @click="toggleSelectAll"
                                            hide-details
                                            density="compact"
                                            :indeterminate="selectedItems.length > 0 && !allSelected"
                                        />
                                    </th>

                                    <!-- 動態欄位 -->
                                    <template
                                        v-for="column in visibleColumns.filter((col) => col !== 'select')"
                                        :key="column"
                                    >
                                        <th :class="`text-left ${column}-column`">
                                            {{ columnLabels[column] }}
                                        </th>
                                    </template>
                                </tr>
                            </thead>

                            <tbody>
                                <!-- 載入中狀態 -->
                                <template v-if="!isSuccess">
                                    <tr v-for="n in 5" :key="n">
                                        <td v-for="m in visibleColumns.length" :key="m">
                                            <v-skeleton-loader type="text" />
                                        </td>
                                    </tr>
                                </template>

                                <!-- 資料列表 -->
                                <template v-else>
                                    <tr
                                        v-for="item in crawlerContent"
                                        :key="item.id"
                                        @click="toggleItemSelection(item.id)"
                                        :class="{ 'disabled-row': item.training_state === 6 }"
                                    >
                                        <!-- 複選框 -->
                                        <td class="checkbox-column" @click.stop v-if="isSuccess">
                                            <v-checkbox
                                                v-model="selectedItems"
                                                :value="item.id"
                                                hide-details
                                                density="compact"
                                            />
                                        </td>

                                        <!-- 動態內容欄位 -->
                                        <template
                                            v-for="column in visibleColumns.filter((col) => col !== 'select')"
                                            :key="column"
                                        >
                                            <!-- 標題欄位 -->
                                            <td v-if="column === 'title'" class="text-truncate title-column">
                                                {{ truncateText(item.title, 15) }}
                                            </td>

                                            <!-- 內容欄位 -->
                                            <td v-else-if="column === 'content'" class="text-truncate content-column">
                                                {{ stripMarkdownAndHtml(truncateText(item.content, 40)) }}
                                            </td>

                                            <!-- 狀態欄位 -->
                                            <td v-else-if="column === 'status'" class="status-column">
                                                <v-chip :color="getChipColor(item.training_state)">
                                                    <v-tooltip
                                                        activator="parent"
                                                        location="top"
                                                        v-if="item.training_state === 6"
                                                    >
                                                        此資料已標記為移除，將於{{
                                                            documentExpireDate(item.update_time)
                                                        }}後永久刪除。
                                                    </v-tooltip>
                                                    <v-tooltip
                                                        activator="parent"
                                                        location="top"
                                                        v-else-if="item.delete_attempts > 0"
                                                    >
                                                        此資料已被刪除 {{ item.delete_attempts }} 次，當達到 3
                                                        次後將被暫時移除。
                                                    </v-tooltip>
                                                    {{ getChipText(item.training_state) }}
                                                </v-chip>
                                            </td>

                                            <!-- 詳情欄位 -->
                                            <td v-else-if="column === 'details'" class="text-center details-column">
                                                <v-btn
                                                    @click.stop="openDialog(item)"
                                                    variant="text"
                                                    color="accent"
                                                    class="link-text"
                                                >
                                                    <v-tooltip activator="parent" location="top"
                                                        >查看詳細資料</v-tooltip
                                                    >
                                                    <v-icon start>mdi-window-restore</v-icon>
                                                    詳細
                                                </v-btn>
                                            </td>

                                            <!-- 問法欄位 -->
                                            <td
                                                v-else-if="column === 'completion'"
                                                class="text-center completion-column"
                                            >
                                                <v-btn
                                                    :disabled="item.training_state !== 3"
                                                    variant="text"
                                                    @click.stop="openCompletionDialog(item)"
                                                    class="link-text"
                                                    :color="item.extra_count > 0 ? 'orange' : undefined"
                                                >
                                                    <v-tooltip activator="parent" location="top">補充問法</v-tooltip>
                                                    <v-icon start>mdi-puzzle-outline</v-icon>
                                                    補充
                                                    <template v-if="item.extra_count > 0"
                                                        >({{ item.extra_count }})</template
                                                    >
                                                </v-btn>
                                            </td>

                                            <!-- 連結欄位 -->
                                            <td v-else-if="column === 'link'" class="text-truncate link-column">
                                                <v-btn
                                                    variant="text"
                                                    class="link-text"
                                                    color="info"
                                                    @click.stop="openExternalLink(item.url)"
                                                >
                                                    <v-icon start>mdi-open-in-new</v-icon>
                                                    {{ truncateText(item.text, 30) }}
                                                </v-btn>
                                            </td>
                                        </template>
                                    </tr>
                                </template>
                            </tbody>
                        </v-table>
                        <transition name="fade">
                            <div v-if="!isScrolledToStart" class="scroll-button scroll-left" @click="scrollLeft">
                                <v-icon>mdi-chevron-left</v-icon>
                            </div>
                        </transition>
                        <transition name="fade">
                            <div v-if="!isScrolledToEnd" class="scroll-button scroll-right" @click="scrollRight">
                                <v-icon>mdi-chevron-right</v-icon>
                            </div>
                        </transition>
                    </div>
                    <!-- 網格模式 -->
                    <!-- <v-row v-else>
                        <v-col v-for="item in crawlerContent" :key="item.id" cols="12" sm="6" md="4">
                            <v-card
                                height="100%"
                                class="elevation-2"
                                @click="openDialog(item)"
                                :class="{ 'disabled-card': item.training_state === 6 }"
                            >
                                <v-card-title class="d-flex justify-space-between align-center v-card-title-list">
                                    <span class="text-truncate">{{ truncateText(item.title, 30) }}</span>
                                </v-card-title>
                                <v-card-text>
                                    <div class="mb-2 content-text" style="cursor: pointer">
                                        {{ stripMarkdownAndHtml(truncateText(item.content, 100)) }}
                                    </div>

                                    <v-divider class="my-2"></v-divider>
                                    <div class="mb-2 d-flex justify-space-between align-center">
                                        <span>狀態</span>
                                        <div>
                                            <v-chip :color="getChipColor(item.training_state)">
                                                <v-tooltip
                                                    activator="parent"
                                                    location="top"
                                                    v-if="item.training_state === 6"
                                                    >此資料已標記為移除，30 天後將永久刪除。</v-tooltip
                                                >
                                                {{ getChipText(item.training_state) }}
                                            </v-chip>
                                        </div>
                                    </div>
                                    <v-divider class="my-2"></v-divider>
                                    <div class="d-flex justify-space-between align-center">
                                        <v-checkbox
                                            v-model="selectedItems"
                                            :value="item.id"
                                            hide-details
                                            density="compact"
                                            :disabled="item.training_state === 6"
                                            @click.stop
                                        ></v-checkbox>
                                        <v-btn
                                            variant="text"
                                            color="info"
                                            class="link-text"
                                            @click.stop="openExternalLink(item.url)"
                                            small
                                        >
                                            <v-icon start>mdi-open-in-new</v-icon>
                                            來源連結
                                        </v-btn>
                                    </div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                    </v-row> -->
                </div>

                <EmptyStateSearch v-if="hasNoSearchResults" />
                <EmptyStateNoData
                    v-else-if="hasNoData"
                    headline="暫無爬蟲數據"
                    actionText="更新頁面數據"
                    actionIcon="fa-solid fa-rotate-right"
                    text="未能獲取到爬蟲數據，請嘗試再次同步爬蟲。"
                    :actionCallback="refetch"
                />

                <div class="pagination-wrapper">
                    <div class="d-flex align-center justify-space-between flex-nowrap">
                        <div class="mx-2 text-center flex-grow-1 pagination-container">
                            <v-pagination v-model="currentPage" :length="totalPages"></v-pagination>
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
            </v-card-text>
        </v-card>

        <v-dialog v-model="showDialog" max-width="800px">
            <v-card v-if="selectedItem" class="dialog-card">
                <v-card-title class="d-flex justify-space-between align-center">
                    <div class="text-h6 font-weight-bold text-truncate title-text" :title="selectedItem.title">
                        <v-tooltip activator="parent" location="top">{{ selectedItem.title }}</v-tooltip>
                        {{ selectedItem.title }}
                    </div>
                    <v-switch
                        v-model="showMarkdown"
                        :label="showMarkdown ? '預覽' : '純文字'"
                        hide-details
                        dense
                    ></v-switch>
                </v-card-title>
                <v-card-text class="dialog-content">
                    <v-chip color="info" label class="mb-4">
                        <v-btn
                            variant="text"
                            color="info"
                            class="link-text"
                            @click.stop="openExternalLink(selectedItem.url)"
                        >
                            <v-icon start>mdi-open-in-new</v-icon>
                            {{ selectedItem.text }}
                        </v-btn>
                    </v-chip>
                    <div class="mt-4">
                        <div
                            v-if="showMarkdown"
                            v-dompurify-html="renderMarkdown(selectedItem.content)"
                            class="mkd"
                        ></div>
                        <p v-else class="text-body-1">{{ selectedItem.content }}</p>
                    </div>
                </v-card-text>
                <v-card-actions class="dialog-actions">
                    <v-spacer></v-spacer>
                    <v-btn :color="isItemSelected ? 'error' : 'success'" @click="toggleItemSelection(selectedItem.id)">
                        {{ isItemSelected ? "取消選擇" : "選擇" }}
                    </v-btn>
                    <v-btn color="primary" @click="showDialog = false">關閉</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 補全對話框 -->
        <CompletionDialog
            v-model="showCompletionDialog"
            :current-document="currentDocument"
            :datasets_id="datasets_id"
        />
    </v-container>
</template>

<style scoped>
.crawler-display {
    max-width: 1800px;
    margin: 0 auto;
}

.crawler-info {
    background-color: #ffffff;
    border: 1px solid #e0e0e0;
}

.details-column {
    width: 80px;
}

.completion-column {
    width: 80px;
}

.status-column {
    min-width: 200px;
}

.content-card {
    background-color: #fafafa;
    overflow: visible !important; /* 確保 sticky 元素可以 "溢出" 一要加這行哦 */
}

.v-btn-toggle {
    margin-top: 0;
    margin-bottom: 0;
}

.v-card-title {
    font-size: 1.2rem;
    font-weight: 500;
    margin-top: 5px;
}

.content-text {
    flex-grow: 1;
    max-height: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
}

.content-container {
    position: relative;
}

.pagination-wrapper {
    position: sticky !important;
    bottom: -20px !important;
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

.dialog-card .v-card-title {
    word-break: break-word;
}

.title-text {
    max-width: calc(100% - 120px); /* Adjust based on the width of your switch */
}

@media (max-width: 960px) {
    .shrink-on-small {
        flex-shrink: 1;
    }

    .hide-on-small {
        display: none;
    }

    .page-input {
        width: 60px;
    }
}

@media (max-width: 600px) {
    .pagination-wrapper .d-flex {
        flex-direction: column;
        align-items: center;
    }

    .pagination-container,
    .pagination-controls {
        margin: 10px 0;
        width: 100%;
    }

    .pagination-controls {
        flex-direction: column;
    }

    .pagination-control {
        margin: 5px 0;
    }

    .hide-on-xsmall {
        display: none;
    }

    .items-per-page-select,
    .page-input {
        width: 50px;
    }

    .pagination-container {
        flex-grow: 0;
    }
    .flex-grow-1 {
        flex-grow: 0 !important;
        width: 100%;
        margin-bottom: 10px;
    }
}

.v-table {
    background-color: #ffffff;
}

.v-table th {
    font-weight: bold;
    background-color: #f5f5f5;
}

.v-table td {
    padding: 12px 16px;
}

.v-table tr:hover {
    background-color: #f5f5f5;
}

.text-red {
    color: red !important;
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
    z-index: 10;
}

th {
    font-weight: bold;
    background-color: #f5f5f5;
    padding: 12px 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.link-text {
    padding-left: 5px;
    padding-right: 5px;
    text-decoration: none;
}

.dialog-card {
    display: flex;
    flex-direction: column;
    height: 80vh;
}

.dialog-content {
    flex-grow: 1;
    overflow-y: auto;
}

.dialog-actions {
    position: sticky;
    bottom: 0;
    background-color: white;
    padding: 8px;
    /* box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1); */
}

.btn_toggle {
    width: 100%;
    justify-content: end;
    margin-bottom: 16px;
}

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

.v-card .v-checkbox,
.v-card .v-btn {
    z-index: 1;
}

.v-switch {
    margin-top: 0;
    margin-bottom: 0;
}

.crawler-item {
    cursor: pointer;
}

.sticky-header {
    position: sticky;
    top: -16px;
    background-color: #fafafa;
    z-index: 9999;
    padding: 4px 8px;
}

.v-divider {
    margin: 8px 0;
}

.details-btn {
    opacity: 0.6;
    transition: opacity 0.3s;
    align-self: flex-end;
}

.details-btn:hover {
    opacity: 1;
}

.disabled-row {
    background-color: #f5f5f5 !important; /* 淡灰色 */
    opacity: 0.7;
}

.disabled-card {
    background-color: #f5f5f5 !important; /* 淡灰色 */
    opacity: 0.7;
}

/* 確保禁用行的懸停效果不會改變背景色 */
.v-table .disabled-row:hover {
    background-color: #f5f5f5 !important;
}

/* 為了確保文字顏色在灰色背景上仍然清晰可見 */
.disabled-row td,
.disabled-card {
    color: rgba(0, 0, 0, 0.6) !important;
}

.search-field {
    /* min-width: 250px; */
    min-width: 450px;
    max-width: 700px;
    width: 100%;
}

.state-select {
    min-width: 200px;
    max-width: 300px;
    width: 100%;
}

.batch-btn {
    white-space: nowrap;
}

.view-toggle {
    flex-shrink: 0;
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

    .view-toggle .v-btn {
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

    .view-toggle .v-btn {
        padding: 0 4px;
        min-width: auto;
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

.scrollable-table-container {
    position: relative;
    overflow: hidden;
}

.scrollable-table {
    width: 100%;
}

.scroll-button {
    position: absolute;
    top: 55px;
    bottom: 0;
    width: 40px;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.1);
    transition: background-color 0.3s;
    cursor: pointer;
}

.scroll-button:hover {
    background-color: rgba(0, 0, 0, 0.2);
}

.scroll-right {
    right: 0;
}

.scroll-left {
    left: 0;
}

.content-container {
    overflow: visible !important;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.scroll-button .v-icon {
    font-size: 24px;
}
</style>
