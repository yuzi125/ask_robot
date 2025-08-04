<script setup>
import { ref, computed, watch, inject, nextTick, onMounted } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useDebounceFn } from "@vueuse/core";
import { getFileIcon, getFileIconColor } from "@/utils/common";
const axios = inject("axios");
const emitter = inject("emitter");

const props = defineProps({
    open: {
        type: Boolean,
        default: false,
    },
    siteId: {
        type: [String, Number],
        default: null,
    },
    siteName: {
        type: String,
        default: "",
    },
    selectedAttachments: {
        type: Array,
        default: () => [],
    },
    isPending: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["update:open", "update:selectedAttachments", "save"]);

// 本地狀態
const localDialogOpen = ref(false);
const searchTitle = ref("");
const searchText = ref("");
// 創建用於 query 的防抖變數
const debouncedSearchTitle = ref("");
const debouncedSearchText = ref("");

const localSelectedAttachments = ref([]);
const currentPage = ref(1);
const pageSize = ref(10);
const isSaving = ref(false);
const attachmentData = ref(null);
const siteIdRef = ref(props.siteId);
const downloadFilter = ref("all");
const downloadFilterOptions = [
    { title: "全部附件", value: "all" },
    { title: "已選取附件", value: "true" },
    { title: "未選取附件", value: "false" },
];

const dialogOpenCount = ref(0);

// 使用 useDebounceFn 來創建防抖函數處理搜索並更新頁碼
const debouncedSearch = useDebounceFn(() => {
    // 重置頁碼
    currentPage.value = 1;
    // 更新防抖後的搜索值，這些值會被用於 queryKey
    debouncedSearchTitle.value = searchTitle.value;
    debouncedSearchText.value = searchText.value;
}, 500);

// 當對話框打開狀態變化時
watch(
    () => props.open,
    (newVal) => {
        localDialogOpen.value = newVal;
        if (newVal) {
            // 增加對話框開啟計數器
            dialogOpenCount.value++;

            // 重置狀態
            currentPage.value = 1;
            searchTitle.value = "";
            searchText.value = "";
            debouncedSearchTitle.value = "";
            debouncedSearchText.value = "";
            downloadFilter.value = "all"; // 重置過濾條件
            siteIdRef.value = props.siteId; // 更新siteId引用

            localSelectedAttachments.value = [];

            // 如果已有附件數據，則立即處理need_download項目
            // 這確保即使數據沒有變化，也會在每次打開對話框時處理選中狀態
            if (attachmentData.value?.items?.length) {
                nextTick(() => {
                    processNeedDownloadItems();
                });
            }
        }
    },
    { immediate: true }
);

// 監聽site id變化
watch(
    () => props.siteId,
    (newVal) => {
        // 只有在當前對話框開啟時更新siteId
        if (localDialogOpen.value) {
            siteIdRef.value = newVal;
            // 清空選中狀態，等待API獲取新站點數據
            localSelectedAttachments.value = [];
        }
    }
);

// 監聽對話框本地狀態變化
watch(
    () => localDialogOpen.value,
    (newVal) => {
        emit("update:open", newVal);

        // 如果對話框關閉，重置狀態
        if (!newVal) {
            searchTitle.value = "";
            searchText.value = "";
            debouncedSearchTitle.value = "";
            debouncedSearchText.value = "";
            currentPage.value = 1;
            downloadFilter.value = "all";

            // 發送最終的選中狀態到父組件
            emit("update:selectedAttachments", localSelectedAttachments.value);
        }
    }
);

// 監聽搜尋欄位變化，使用防抖功能重置頁面並觸發查詢
watch([searchTitle, searchText], () => {
    debouncedSearch();
});

watch(
    () => props.isLoading,
    (newVal) => {
        console.log("props.isLoading", newVal);
    }
);

// 監聽本地選中狀態變化，同步到父組件
watch(
    localSelectedAttachments,
    (newVal) => {
        // 僅當對話框開啟時才更新父組件狀態，避免對話框關閉時也更新
        if (localDialogOpen.value) {
            emit("update:selectedAttachments", newVal);
        }
    },
    { deep: true }
);

// 獲取附件數據的函數
const fetchAttachments = async () => {
    const currentSiteId = siteIdRef.value;
    if (!currentSiteId) return null;

    try {
        const params = {
            page: currentPage.value,
            page_size: pageSize.value,
            title: debouncedSearchTitle.value,
            text: debouncedSearchText.value,
        };

        if (downloadFilter.value !== "all") {
            params.need_download = downloadFilter.value;
        }

        const response = await axios.get(`/crawler/attachments/${currentSiteId}`, {
            params,
        });

        if (response.data.code === 0) {
            return response.data.data;
        } else {
            throw new Error(response.data.message || "獲取附件列表失敗");
        }
    } catch (error) {
        console.error("載入附件失敗:", error);
        throw error;
    }
};

// 使用 vue-query 獲取附件數據（解構方式）
const {
    data: attachmentsData,
    error,
    isLoading,
    isFetching,
    isSuccess,
    refetch,
} = useQuery({
    queryKey: [
        "attachments",
        siteIdRef,
        currentPage,
        pageSize,
        downloadFilter,
        debouncedSearchTitle,
        debouncedSearchText,
        dialogOpenCount,
    ],
    queryFn: fetchAttachments,
    enabled: computed(() => localDialogOpen.value && !!siteIdRef.value),
    keepPreviousData: true,
});

// 當從useQuery獲取到數據後，更新本地attachmentData
watch(
    attachmentsData,
    (newData) => {
        if (newData) {
            attachmentData.value = newData;

            // 處理need_download為true的項目
            nextTick(() => {
                processNeedDownloadItems();
            });
        }
    },
    { immediate: true }
);

// 處理need_download為true的項目
function processNeedDownloadItems() {
    if (!attachmentData.value?.items?.length) return;

    const needDownloadItems = attachmentData.value.items.filter((item) => item.need_download);

    if (needDownloadItems.length) {
        // 將need_download為true的項目添加到已選中列表
        const currentHrefs = localSelectedAttachments.value.map((item) => item.href);

        needDownloadItems.forEach((item) => {
            if (!currentHrefs.includes(item.href)) {
                localSelectedAttachments.value.push(item);
            }
        });
    }
}

// 判斷項目是否被選中
function isItemSelected(item) {
    return localSelectedAttachments.value.some((selected) => selected.href === item.href);
}

// 切換項目選中狀態
function toggleItemSelection(item, selected) {
    // 如果是選中操作
    if (selected) {
        if (!isItemSelected(item)) {
            localSelectedAttachments.value.push(item);
        }
    }
    // 如果是取消選中操作
    else {
        const index = localSelectedAttachments.value.findIndex((selected) => selected.href === item.href);
        if (index !== -1) {
            localSelectedAttachments.value.splice(index, 1);
        }
    }
}

// 處理標頭全選功能
function handleSelectAll(val) {
    if (val) {
        // 全選當前頁面
        selectAllAttachments();
    } else {
        // 取消全選當前頁面
        clearAllAttachments();
    }
}

// 處理分頁變化
function handlePageChange(options) {
    if (options.page !== currentPage.value) {
        currentPage.value = options.page;
    }
    if (options.itemsPerPage !== pageSize.value) {
        pageSize.value = options.itemsPerPage;
        currentPage.value = 1;
    }
}

// 計算總頁數
const totalPages = computed(() => {
    if (!attachmentData.value?.total_count) return 0;
    return Math.ceil(attachmentData.value.total_count / pageSize.value);
});

// 全選附件
function selectAllAttachments() {
    if (attachmentData.value?.items?.length > 0) {
        // 將當前頁面的所有項目添加到已選中列表
        const currentPageItems = [...attachmentData.value.items];

        // 先移除當前頁所有項目，避免重複
        const currentPageHrefs = currentPageItems.map((item) => item.href);
        localSelectedAttachments.value = localSelectedAttachments.value.filter(
            (item) => !currentPageHrefs.includes(item.href)
        );

        // 然後添加當前頁所有項目
        localSelectedAttachments.value = [...localSelectedAttachments.value, ...currentPageItems];
    }
}

// 取消全選
function clearAllAttachments() {
    // 只移除當前頁面的選中項目
    if (attachmentData.value?.items?.length > 0) {
        const currentPageHrefs = attachmentData.value.items.map((item) => item.href);
        localSelectedAttachments.value = localSelectedAttachments.value.filter(
            (item) => !currentPageHrefs.includes(item.href)
        );
    }
}

// 關閉對話框
function close() {
    localDialogOpen.value = false;
}

// 保存設定
async function save() {
    isSaving.value = true;

    try {
        // 獲取所有當前頁面和已加載頁面的附件
        let allLoadedAttachments = [];
        if (attachmentData.value?.items) {
            allLoadedAttachments = [...attachmentData.value.items];
        }

        // 將選中的附件設為 need_download: true
        const selectedHrefs = localSelectedAttachments.value.map((item) => item.href);

        // 創建格式化的附件數組
        // 1. 選中的項目設為 need_download: true
        const selectedAttachments = localSelectedAttachments.value.map((item) => ({
            site_id: siteIdRef.value,
            href: item.href,
            need_download: true,
        }));

        // 2. 查找已加載但未選中且原本是need_download: true的項目，將其設為need_download: false
        const unselectedAttachments = allLoadedAttachments
            .filter((item) => item.need_download && !selectedHrefs.includes(item.href))
            .map((item) => ({
                site_id: siteIdRef.value,
                href: item.href,
                need_download: false,
            }));

        // 合併兩種類型的項目
        const formattedAttachments = [...selectedAttachments, ...unselectedAttachments];

        // 通知父元件保存設定
        emit("save", {
            siteId: siteIdRef.value,
            attachments: formattedAttachments,
        });

        // 更新父元件的選中狀態
        emit("update:selectedAttachments", localSelectedAttachments.value);

        refetch();

        // 關閉對話框
        // close();
    } catch (error) {
        console.error("保存附件設定失敗:", error);
    } finally {
        refetch();
        isSaving.value = false;
    }
}

// 輔助方法: 格式化標題 (移除 [另開新視窗] 文字)
function formatTitle(title) {
    if (!title) return "無標題";
    return title.replace(/\[另開新視窗\]$/, "");
}

// 輔助方法: 格式化日期
function formatDate(dateString) {
    if (!dateString) return "";
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    } catch (e) {
        return dateString;
    }
}

// 開啟外部連結
const openExternalLink = (url) => {
    emitter.emit("openUrl", url);
};

// 附件表頭定義
const attachmentHeaders = [
    { title: "附件連結標題", key: "title", sortable: true, align: "start" },
    { title: "附件連結文字", key: "text", sortable: false, align: "start" },
    { title: "頁面連結", key: "page", sortable: false, align: "start" },
    { title: "更新日期", key: "updated_at", sortable: true, align: "start" },
];

const handleFilterChange = () => {
    currentPage.value = 1;
};
</script>

<template>
    <v-dialog v-model="localDialogOpen" max-width="1200px" persistent>
        <v-card class="d-flex flex-column" style="max-height: 90vh">
            <v-card-title class="d-flex justify-space-between align-center dialog-title">
                <span>設定「{{ siteName }}」的爬蟲附件</span>
                <v-btn icon @click="close" variant="text" :disabled="isLoading">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="overflow-auto flex-grow-1 pa-4">
                <div class="mb-4 d-flex ga-2 align-center">
                    <v-text-field
                        v-model="searchTitle"
                        prepend-inner-icon="mdi-magnify"
                        label="搜尋附件連結標題"
                        hide-details
                        class="flex-grow-1"
                        clearable
                        :disabled="isLoading"
                    ></v-text-field>
                    <v-text-field
                        v-model="searchText"
                        prepend-inner-icon="mdi-magnify"
                        label="搜尋附件連結文字"
                        hide-details
                        class="flex-grow-1"
                        clearable
                        :disabled="isLoading"
                    ></v-text-field>

                    <v-select
                        v-model="downloadFilter"
                        :items="downloadFilterOptions"
                        label="顯示附件"
                        hide-details
                        :disabled="isLoading"
                        @update:model-value="handleFilterChange"
                    ></v-select>
                </div>

                <div
                    v-if="isLoading && !attachmentData?.items?.length"
                    class="justify-center my-8 d-flex flex-column align-center"
                >
                    <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
                    <span class="mt-4 text-body-1">正在載入附件資料...</span>
                </div>

                <template v-else>
                    <!-- 資料表格 -->
                    <v-data-table
                        v-model="localSelectedAttachments"
                        :headers="attachmentHeaders"
                        :items="attachmentData?.items || []"
                        :items-per-page="pageSize"
                        :page="currentPage"
                        :loading="isLoading"
                        :items-length="attachmentData?.total_count || 0"
                        show-select
                        class="elevation-1 attachment-table"
                        item-value="href"
                        @update:options="handlePageChange"
                        select-strategy="page"
                    >
                        <!-- 自定義表頭選擇框 -->
                        <template v-slot:header.data-table-select="{ allSelected, selectAll, someSelected }">
                            <v-checkbox-btn
                                :indeterminate="someSelected && !allSelected"
                                :model-value="allSelected"
                                color="primary"
                                @update:model-value="handleSelectAll"
                            ></v-checkbox-btn>
                        </template>

                        <!-- 自定義行選擇框 -->
                        <template v-slot:item.data-table-select="{ item, isSelected, toggleSelect }">
                            <v-checkbox-btn
                                :model-value="isItemSelected(item)"
                                color="primary"
                                @update:model-value="(val) => toggleItemSelection(item, val)"
                            ></v-checkbox-btn>
                        </template>

                        <!-- 自訂表格欄位顯示 -->
                        <template v-slot:item.title="{ item }">
                            <div class="d-flex align-center">
                                <v-icon size="small" :color="getFileIconColor(item.href)" class="mr-2">
                                    {{ getFileIcon(item.href) }}
                                </v-icon>
                                <a :href="item.href" target="_blank" class="attachment-name" :title="item.title">
                                    {{ formatTitle(item.title) }}
                                </a>
                            </div>
                        </template>

                        <template v-slot:item.text="{ item }">
                            <span :title="item.text">{{ item.text }}</span>
                        </template>

                        <!-- 要顯示原頁面的連結 -->
                        <template v-slot:item.page="{ item }">
                            <v-btn
                                @click.stop="openExternalLink(item.page)"
                                variant="text"
                                class="link-text"
                                color="info"
                            >
                                <v-tooltip activator="parent" location="top">查看原始頁面</v-tooltip>
                                <v-icon start>mdi-open-in-new</v-icon>
                                原始頁面
                            </v-btn>
                        </template>

                        <template v-slot:item.updated_at="{ item }">
                            {{ formatDate(item.updated_at) }}
                        </template>

                        <template v-slot:bottom>
                            <div class="mt-4 pagination-wrapper">
                                <div class="d-flex align-center">
                                    <div class="pagination-container">
                                        <v-pagination
                                            v-model="currentPage"
                                            :length="totalPages"
                                            :total-visible="7"
                                        ></v-pagination>
                                    </div>
                                    <div class="pagination-control shrink-on-small">
                                        <span class="mr-1 text-body-2 hide-on-xsmall">每頁顯示</span>
                                        <v-select
                                            v-model="pageSize"
                                            :items="[10, 20, 50, 100]"
                                            hide-details
                                            density="compact"
                                            class="items-per-page-select"
                                        ></v-select>
                                        <span class="ml-1 text-body-2 hide-on-small">個</span>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </v-data-table>
                </template>
            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions class="pa-4">
                <div class="d-flex justify-space-between w-100">
                    <div>
                        <v-btn class="mr-2" @click="selectAllAttachments" color="success" :disabled="isPending"
                            >全選當前頁面</v-btn
                        >
                        <v-btn @click="clearAllAttachments" color="error" :disabled="isPending">取消全選</v-btn>
                    </div>
                    <div>
                        <v-btn class="mr-2" @click="close" :disabled="isLoading">取消</v-btn>
                        <v-btn color="primary" @click="save" :loading="isPending" :disabled="isPending">儲存</v-btn>
                    </div>
                </div>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<style scoped>
.dialog-title {
    font-size: 1.25rem;
    font-weight: 500;
    padding: 16px;
    background-color: #f5f5f5;
}

.search-box {
    margin-bottom: 16px;
}

.attachment-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
}

/* 修正數據表格中的複選框對齊問題 */
:deep(.v-data-table .v-selection-control) {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}

:deep(.v-data-table tbody tr td) {
    vertical-align: middle;
}

:deep(.v-data-table th.v-data-table__th) {
    vertical-align: middle;
    text-transform: none;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 500;
}

/* 確保表格在loading時不會塌陷 */
.attachment-table {
    min-height: 400px;
}

.link-text {
    padding-left: 5px;
    padding-right: 5px;
    text-decoration: none;
}

.attachment-name {
    color: #2196f3;
}

/* 分頁置中與方形樣式 */
.pagination-container {
    flex: 1;
    display: flex;
    justify-content: center;
}

.pagination-control {
    display: flex;
    align-items: center;
    white-space: nowrap;
}

.shrink-on-small {
    flex-shrink: 1;
}

.hide-on-xsmall {
    display: inline;
}

.hide-on-small {
    display: inline;
}

.pagination-wrapper {
    position: sticky;
    bottom: -16px;
    background-color: #fafafa;
    padding: 10px 0;
    z-index: 20;
}

@media (max-width: 960px) {
    .shrink-on-small {
        flex-shrink: 1;
    }
    .hide-on-small {
        display: none;
    }
}

@media (max-width: 600px) {
    .hide-on-xsmall {
        display: none;
    }
}

:deep(.v-pagination .v-btn) {
    border-radius: 4px !important;
}
</style>
