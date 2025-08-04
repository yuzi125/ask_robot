<script setup>
import { ref, computed, inject, onMounted, watch } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";

const axios = inject("axios");
const emitter = inject("emitter");
const queryClient = useQueryClient();

// 選中的站點 ID 和對象
const selectedIds = ref([]);
const selectedItems = ref([]);

// 搜尋和過濾相關
const searchTerm = ref("");

// 分頁相關
const page = ref(1);
const itemsPerPage = ref(10);
const pageCount = ref(1);
const disablePagination = ref(false);

// 使用 useQuery 獲取站點資料
const fetchCrawlerSites = async () => {
    const response = await axios.get("/crawlerFastAPI/getCrawlerSite");
    if (response.data.code !== 0) {
        throw new Error(response.data.message || "獲取站點資料失敗");
    }
    return response.data.data;
};

const {
    data: sitesData,
    isLoading,
    error,
    refetch,
} = useQuery({
    queryKey: ["crawlerSites"],
    queryFn: fetchCrawlerSites,
});

// 使用 useMutation 進行批量更新
const { mutate: updateAttachmentMutation, isPending: isUpdating } = useMutation({
    mutationFn: async ({ ids, download_attachment }) => {
        const response = await axios.post("/crawlerFastAPI/toggleCrawlerAttachment", {
            ids,
            download_attachment,
        });

        if (response.data.code !== 0) {
            throw new Error(response.data.message || "更新站點附件設定失敗");
        }

        return response.data;
    },
    onSuccess: (data, variables) => {
        // 更新查詢緩存中的數據
        queryClient.setQueryData(["crawlerSites"], (oldData) => {
            if (!oldData) return oldData;

            return oldData.map((site) => {
                if (variables.ids.includes(site.id)) {
                    return {
                        ...site,
                        download_attachment: variables.download_attachment,
                    };
                }
                return site;
            });
        });

        // 清空選擇
        selectedIds.value = [];

        // 顯示成功通知
        emitter.emit("openSnackbar", {
            message: `成功${variables.download_attachment === 1 ? "開啟" : "關閉"} ${
                data.data?.count || variables.ids.length
            } 個站點的附件下載功能`,
            color: "success",
        });
    },
    onError: (error) => {
        emitter.emit("openSnackbar", {
            message: error.message || "更新站點附件設定失敗",
            color: "error",
        });
    },
});

// 過濾後的站點列表
const filteredSites = computed(() => {
    if (!sitesData.value || !sitesData.value.length) return [];

    return sitesData.value.filter((site) => {
        // 搜尋詞條件 (ID、站點名稱、網域)
        return (
            searchTerm.value === "" ||
            site.id.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
            site.title.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
            (site.domain && site.domain.toLowerCase().includes(searchTerm.value.toLowerCase()))
        );
    });
});

// 當前頁的站點
const currentPageItems = computed(() => {
    const start = (page.value - 1) * itemsPerPage.value;
    const end = disablePagination.value ? filteredSites.value.length : start + itemsPerPage.value;
    return filteredSites.value.slice(start, end);
});

// 監聽 selectedIds 變化，更新 selectedItems
watch(
    selectedIds,
    (newIds) => {
        if (sitesData.value) {
            selectedItems.value = sitesData.value.filter((site) => newIds.includes(site.id));
        }
    },
    { deep: true }
);

// 批量更新下載附件狀態
const batchUpdateDownloadAttachment = async (newStatus) => {
    if (!selectedIds.value.length) {
        emitter.emit("openSnackbar", {
            message: "請先選擇要操作的站點",
            color: "warning",
        });
        return;
    }

    updateAttachmentMutation({
        ids: selectedIds.value,
        download_attachment: newStatus,
    });
};

// 清除搜尋條件
const clearFilters = () => {
    searchTerm.value = "";
};

// 重新載入資料
const reloadData = () => {
    selectedIds.value = [];
    refetch();
};

// 全選/取消全選（僅當前頁）
const toggleSelectAll = () => {
    if (isAllSelected.value) {
        // 如果已全選，則取消全選
        selectedIds.value = selectedIds.value.filter((id) => !currentPageItems.value.some((item) => item.id === id));
    } else {
        // 否則全選當前頁
        const currentPageIds = currentPageItems.value.map((item) => item.id);
        // 合併當前選擇和當前頁的所有 ID，並去重
        selectedIds.value = [...new Set([...selectedIds.value, ...currentPageIds])];
    }
};

// 是否全選當前頁的狀態
const isAllSelected = computed(() => {
    return (
        currentPageItems.value.length > 0 && currentPageItems.value.every((item) => selectedIds.value.includes(item.id))
    );
});

// 是否部分選擇當前頁的狀態
const isIndeterminate = computed(() => {
    return !isAllSelected.value && currentPageItems.value.some((item) => selectedIds.value.includes(item.id));
});

// 是否有開啟下載附件功能的站點被選中
const hasEnabledSitesSelected = computed(() => {
    return selectedItems.value.some((site) => site.download_attachment === 1);
});

// 是否有關閉下載附件功能的站點被選中
const hasDisabledSitesSelected = computed(() => {
    return selectedItems.value.some((site) => site.download_attachment === 0);
});
</script>

<template>
    <div class="attachment-settings pa-4">
        <v-container fluid>
            <!-- 操作按鈕 -->
            <v-row>
                <v-col cols="12" md="6" class="d-flex align-center">
                    <v-btn
                        color="success"
                        :disabled="!hasDisabledSitesSelected || isUpdating"
                        @click="batchUpdateDownloadAttachment(1)"
                        class="mr-2 text-caption text-md-subtitle-2"
                    >
                        <v-icon class="mr-1">mdi-download</v-icon>
                        批量開啟下載
                    </v-btn>
                    <v-btn
                        color="error"
                        :disabled="!hasEnabledSitesSelected || isUpdating"
                        @click="batchUpdateDownloadAttachment(0)"
                        class="mr-2 text-caption text-md-subtitle-2"
                    >
                        <v-icon class="mr-1">mdi-close</v-icon>
                        批量關閉下載
                    </v-btn>
                    <v-chip class="ml-2" color="primary" v-if="selectedIds.length > 0">
                        已選擇 {{ selectedIds.length }} 個站點
                    </v-chip>
                </v-col>
                <v-col cols="12" md="6" class="justify-end d-flex">
                    <v-btn
                        color="primary"
                        variant="tonal"
                        @click="reloadData"
                        :loading="isUpdating"
                        class="mr-2 text-caption text-md-subtitle-2"
                    >
                        <v-icon class="mr-1">mdi-refresh</v-icon>
                        重新載入
                    </v-btn>
                </v-col>
            </v-row>

            <!-- 搜尋 -->
            <v-card class="mt-4 elevation-1 pa-3">
                <v-row align="center">
                    <v-col cols="12" sm="6" md="8">
                        <v-text-field
                            v-model="searchTerm"
                            label="搜尋站點 ID、名稱或網域"
                            hide-details
                            outlined
                            dense
                            clearable
                            prepend-inner-icon="mdi-magnify"
                        ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6" md="4" class="text-center">
                        <v-btn color="grey" variant="outlined" @click="clearFilters" class="mt-2" block>
                            <v-icon class="mr-1">mdi-filter-remove</v-icon>
                            清除過濾
                        </v-btn>
                    </v-col>
                </v-row>
            </v-card>

            <!-- 站點列表 -->
            <v-card class="mt-4 elevation-2">
                <v-data-table
                    v-model="selectedIds"
                    :headers="[
                        { title: 'ID', key: 'id', sortable: true, align: 'center' },
                        { title: '站點名稱', key: 'title', sortable: true, align: 'center' },
                        { title: '網域', key: 'domain', sortable: true, align: 'center' },
                        { title: '站點 ID', key: 'site_id', sortable: true, align: 'center' },
                        { title: '附件下載', key: 'download_attachment', sortable: true, align: 'center' },
                    ]"
                    :items="filteredSites"
                    :loading="isUpdating"
                    class="site-data-table"
                    :no-data-text="isUpdating ? '載入中...' : '沒有符合條件的站點'"
                    item-value="id"
                    show-select
                    :items-per-page="itemsPerPage"
                    v-model:page="page"
                    :page-count="Math.ceil(filteredSites.length / itemsPerPage)"
                    :footer-props="{
                        'items-per-page-options': [10, 20, 50, 100, -1],
                        'items-per-page-text': '每頁顯示',
                        'show-current-page': true,
                        'show-first-last-page': true,
                    }"
                    @update:items-per-page="
                        (newValue) => {
                            itemsPerPage = newValue;
                            if (newValue === -1) {
                                disablePagination = true;
                            } else {
                                disablePagination = false;
                            }
                        }
                    "
                >
                    <template v-slot:header.data-table-select>
                        <v-checkbox
                            :model-value="isAllSelected"
                            :indeterminate="isIndeterminate"
                            @click="toggleSelectAll"
                            hide-details
                        ></v-checkbox>
                    </template>

                    <!-- 自定義列格式 -->
                    <template v-slot:item.id="{ item }">
                        <div class="text-center">{{ item.id }}</div>
                    </template>

                    <template v-slot:item.title="{ item }">
                        <div class="text-center">{{ item.title }}</div>
                    </template>

                    <template v-slot:item.domain="{ item }">
                        <div class="text-center">{{ item.domain || "無" }}</div>
                    </template>

                    <template v-slot:item.site_id="{ item }">
                        <div class="text-center">{{ item.site_id }}</div>
                    </template>

                    <template v-slot:item.download_attachment="{ item }">
                        <div class="text-center">
                            <v-chip
                                :color="item.download_attachment === 1 ? 'success' : 'error'"
                                text-color="white"
                                size="small"
                                class="font-weight-medium"
                            >
                                {{ item.download_attachment === 1 ? "開啟" : "關閉" }}
                            </v-chip>
                        </div>
                    </template>
                </v-data-table>
            </v-card>
        </v-container>
    </div>
</template>

<style scoped>
.attachment-settings {
    min-height: 70vh;
}

/* 表格垂直居中對齊 */
:deep(.site-data-table th) {
    font-size: 14px !important;
    font-weight: bold !important;
    color: rgba(0, 0, 0, 0.8) !important;
    text-align: center !important;
    vertical-align: middle !important;
}

:deep(.site-data-table td) {
    text-align: center !important;
    vertical-align: middle !important;
}

.v-btn {
    letter-spacing: 0.5px;
}

:deep(.v-card-title) {
    letter-spacing: 0.5px;
}

:deep(.v-text-field .v-input__details) {
    padding-left: 4px;
}
</style>
