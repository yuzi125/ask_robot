<script setup>
import { ref, computed, watch } from "vue";

import AnnouncementsCheckRecordTable from "@/components/system/announcementsCheckRecord/AnnouncementsCheckRecordTable.vue";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";
import ColumnSettings from "@/components/common/ColumnSettings.vue";
import { useShowTableColumns } from "@/composables";
import SystemHeader from "@/components/system/SystemHeader.vue";

import { useQuery } from "@tanstack/vue-query";
import axios from "@/global/axios";
import { useDebounceFn } from "@vueuse/core";

const {
    data: announcementsCheckRecord,
    isLoading,
    isError,
    error,
    refetch: refetchAnnouncementsRecord,
    isFetching: isFetchingAnnouncementsRecord,
} = useQuery({
    queryKey: ["announcementsCheckRecord"],
    queryFn: async () => {
        const body = {
            page: currentPage.value,
            itemsPerPage: itemsPerPage.value,
            searchQuery: searchQuery.value,
            announcementType: selectedAnnouncementType.value,
        };
        const response = await axios.get("/system/announcementsRecord", { params: body });
        return response.data.data;
    },
});

// 分頁
const currentPage = ref(1);
const itemsPerPage = ref(10);
const totalPages = computed(() => {
    return Math.ceil(announcementsCheckRecord.value.totalRecord / itemsPerPage.value) || 1;
});

const handlePageChange = () => {
    refetchAnnouncementsRecord();
};

const handleItemsPerPageChange = () => {
    currentPage.value = 1;
    refetchAnnouncementsRecord();
};

// 文字搜尋
const searchQuery = ref("");
const debouncedSearchQuery = useDebounceFn(() => {
    currentPage.value = 1;
    refetchAnnouncementsRecord();
}, 500);
watch(searchQuery, () => {
    debouncedSearchQuery();
});

const headerActions = computed(() => [
    {
        id: "refresh",
        text: "更新資料",
        icon: "mdi-refresh",
        color: "info",
        loading: isFetchingAnnouncementsRecord.value,
    },
]);

const handleHeaderAction = (actionId) => {
    switch (actionId) {
        case "refresh":
            refetchAnnouncementsRecord();
            break;
    }
};

const hasNoData = computed(
    () => !isLoading.value && searchQuery.value === "" && announcementsCheckRecord.value.dataList.length === 0
);
const hasNoSearchResults = computed(
    () => !isLoading.value && searchQuery.value !== "" && announcementsCheckRecord.value.dataList.length === 0
);

const announcementTypeOptions = [
    { title: "公告訊息", value: "NOTICE" },
    { title: "使用說明", value: "TERMS" },
];
const selectedAnnouncementType = ref(["TERMS"]);

const handleAnnouncementTypeChange = () => {
    currentPage.value = 1;
    refetchAnnouncementsRecord();
};

const tableConfig = {
    columnLabels: {
        userName: "使用者名稱",
        announcementTitle: "公告標題",
        announcementType: "公告種類",
        action: "動作",
        ipAddress: "IP 位址",
        userAgent: "使用者代理",
        createTime: "建立時間",
    },
    allColumns: ["userName", "announcementTitle", "announcementType", "action", "ipAddress", "userAgent", "createTime"],
    storageKey: "announcements-check-record-table-columns",
    requiredFields: ["userName", "announcementTitle"],
};

const { columnLabels, allColumns, requiredFields, visibleColumns } = useShowTableColumns(tableConfig);
</script>

<template>
    <div class="container">
        <!-- 頂部標題 -->
        <div class="title-card">
            <SystemHeader
                title="使用說明確認紀錄"
                subtitle="顯示使用者確認本系統使用說明的相關資訊"
                icon="mdi-file-document-outline"
                :actions="headerActions"
                @action="handleHeaderAction"
            />
        </div>

        <div class="content-card">
            <v-row v-if="isLoading">
                <v-col>
                    <v-skeleton-loader type="table"></v-skeleton-loader>
                </v-col>
            </v-row>

            <!-- 錯誤顯示 -->
            <v-row v-else-if="isError" class="justify-center fill-height align-center">
                <v-col cols="12" class="text-center">
                    <p class="text-error">載入失敗: {{ error?.message }}</p>
                </v-col>
            </v-row>

            <!-- 主要內容 -->
            <v-card class="table-card" v-else>
                <div class="table-card-content">
                    <!-- 搜尋和操作區 -->
                    <div class="table-header">
                        <div class="flex-wrap py-2 d-flex align-center justify-space-between">
                            <div class="d-flex align-center ga-2">
                                <v-text-field
                                    v-model="searchQuery"
                                    label="搜尋使用者或使用說明"
                                    prepend-inner-icon="mdi-magnify"
                                    placeholder="請輸入使用者或使用說明"
                                    hide-details="auto"
                                    class="search-field"
                                    density="comfortable"
                                ></v-text-field>
                                <v-select
                                    v-model="selectedAnnouncementType"
                                    :items="announcementTypeOptions"
                                    label="公告種類選擇"
                                    multiple
                                    hide-details
                                    width="350px"
                                    density="comfortable"
                                    @update:modelValue="handleAnnouncementTypeChange"
                                >
                                    >
                                    <template v-slot:selection="{ item, index }">
                                        <v-chip v-if="index < 1">
                                            <span>{{ item.title }}</span>
                                        </v-chip>
                                        <span v-if="index === 1" class="text-grey text-caption align-self-center">
                                            (+{{ selectedAnnouncementType.length - 1 }} others)
                                        </span>
                                    </template>
                                </v-select>
                            </div>
                            <div class="d-flex">
                                <ColumnSettings
                                    v-model="visibleColumns"
                                    :headers="allColumns"
                                    :header-labels="columnLabels"
                                    :required-fields="requiredFields"
                                    :storage-key="tableConfig.storageKey"
                                    :style="{ height: '35px' }"
                                    class="mr-1"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="table-content">
                        <!-- 使用說明確認紀錄列表 -->
                        <AnnouncementsCheckRecordTable
                            v-if="!hasNoData && !hasNoSearchResults"
                            :items="announcementsCheckRecord.dataList"
                            :loading="isLoading"
                            :visible-columns="visibleColumns"
                            :column-labels="columnLabels"
                        />

                        <!-- 無資料顯示 -->
                        <EmptyStateNoData v-if="hasNoData" />
                        <EmptyStateSearch v-else-if="hasNoSearchResults" />
                    </div>

                    <!-- 分頁控制 -->
                    <div class="pagination-wrapper">
                        <div class="flex-wrap gap-4 d-flex align-center justify-space-between">
                            <v-pagination
                                v-model="currentPage"
                                :length="totalPages"
                                :total-visible="7"
                                @update:modelValue="handlePageChange"
                            ></v-pagination>

                            <div class="d-flex align-center">
                                <span class="mr-2">每頁顯示</span>
                                <v-select
                                    v-model="itemsPerPage"
                                    :items="[10, 20, 50, 100]"
                                    density="comfortable"
                                    hide-details
                                    class="items-per-page-select"
                                    width="100px"
                                    @update:modelValue="handleItemsPerPageChange"
                                ></v-select>
                            </div>
                        </div>
                    </div>
                </div>
            </v-card>
        </div>
    </div>
</template>
<style scoped>
.container {
    height: 100%;
    padding: 1em 2em;
    overflow-y: hidden;
    display: flex;
    flex-direction: column;
}

.content-card {
    background-color: #fafafa;
    flex: 1;
    overflow-y: hidden;
}

.table-card {
    height: 100%;
}

.table-card-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: hidden;
}

.table-header {
    padding: 4px 8px;
}

.search-field {
    min-width: 300px;
    max-width: 500px;
    width: 100%;
}

.table-content {
    flex: 1;
    overflow-y: hidden;
}

.pagination-wrapper {
    background-color: #fafafa;
    padding: 3px 0;
}

.items-per-page-select {
    width: 80px;
}

@media (max-width: 960px) {
    .settings-container {
        padding: 1em;
    }

    .search-field {
        width: 100%;
        max-width: none;
    }

    .sticky-header > div {
        flex-direction: column;
        gap: 12px;
    }
}
</style>
