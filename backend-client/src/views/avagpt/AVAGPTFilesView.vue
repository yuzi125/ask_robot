<script setup>
import { ref, inject, computed, watch } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { useDebounceFn } from "@vueuse/core";
import FilesList from "@/components/avagpt/files/FilesList.vue";

const axios = inject("axios");

// 搜尋和分頁狀態
const searchQuery = ref("");
const debouncedSearchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);

// 創建防抖後的搜尋變數
const debouncedSearch = useDebounceFn(() => {
    currentPage.value = 1;
    debouncedSearchQuery.value = searchQuery.value;
}, 500);

// 當搜尋關鍵字變更時
watch(searchQuery, () => {
    debouncedSearch();
});

// 獲取文件列表
const {
    data: filesData,
    refetch,
    isLoading,
    isRefetching,
    isPlaceholderData,
    isSuccess,
} = useQuery({
    queryKey: ["user-files", currentPage, itemsPerPage, debouncedSearchQuery],
    queryFn: async () => {
        const { data } = await axios.get("/avaGPT/files", {
            params: {
                page: currentPage.value,
                limit: itemsPerPage.value,
                searchQuery: debouncedSearchQuery.value,
            },
        });

        if (data.code !== 200) {
            throw new Error(data.message);
        }

        return data.data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
});

// 計算屬性
const files = computed(() => filesData.value?.files || []);
const total = computed(() => filesData.value?.total || 0);
const totalPages = computed(() => filesData.value?.totalPages || 1);
const totalBytes = computed(() => filesData.value?.totalBytes || 0);

// 統計資料
const stats = computed(() => ({
    totalFiles: total.value,
    totalSize: totalBytes.value,
}));

// 方法
const handlePageChange = (newPage) => {
    currentPage.value = newPage;
};

const handleSearchChange = (newSearch) => {
    searchQuery.value = newSearch;
};

const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
</script>

<template>
    <v-container fluid class="pa-4">
        <v-row>
            <v-col cols="12">
                <!-- 頁面標題 -->
                <v-card class="mb-4 dashboard-card" elevation="1">
                    <v-card-title class="px-6 py-4 d-flex align-center">
                        <div>
                            <div class="d-flex align-center">
                                <v-icon
                                    icon="fa-solid fa-folder-open"
                                    color="primary"
                                    class="me-2"
                                    size="small"
                                ></v-icon>
                                <span class="text-h6 font-weight-medium">文件清單</span>
                            </div>
                            <div class="d-flex align-center">
                                <div class="mt-1 ga-1 d-flex align-center text-subtitle-2 text-grey-darken-1">
                                    查看使用者上傳的文件 •
                                    <div class="d-flex align-center text-body-2 text-medium-emphasis">
                                        <v-icon icon="mdi-pulse" size="small" class="mr-1" />
                                        每 30 秒自動更新
                                    </div>
                                </div>
                            </div>
                        </div>
                        <v-spacer></v-spacer>
                        <div class="d-flex align-center ga-2">
                            <v-chip color="info" variant="tonal" prepend-icon="mdi-information" size="small">
                                {{ stats.totalFiles }} 個文件 • {{ formatFileSize(stats.totalSize) }}
                            </v-chip>
                        </div>
                    </v-card-title>
                </v-card>

                <!-- 文件列表 -->
                <FilesList
                    :files="files"
                    :total="total"
                    :total-pages="totalPages"
                    :is-loading="isLoading"
                    :is-refetching="isRefetching"
                    :is-placeholder-data="isPlaceholderData"
                    :search-query="searchQuery"
                    :current-page="currentPage"
                    @refresh="refetch"
                    @page-change="handlePageChange"
                    @search-change="handleSearchChange"
                />
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
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
</style>
