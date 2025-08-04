<script setup>
import { ref, computed, inject, onMounted } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";
import SystemHeader from "@/components/system/SystemHeader.vue";
import { useRoute, useRouter } from "vue-router";
import AuditLogFilter from "@/components/system/auditLog/AuditLogFilter.vue";
import AuditLogTable from "@/components/system/auditLog/AuditLogTable.vue";
import AuditLogParametersDialog from "@/components/system/auditLog/AuditLogParametersDialog.vue";
import { useShowTableColumns } from "@/composables/useShowTableColumns";

const axios = inject("axios");
const emitter = inject("emitter");
const route = useRoute();
const router = useRouter();

// 參數詳情對話框
const parametersDialog = ref(false);
const currentParameters = ref(null);
const currentItemName = ref("");

// 分頁相關狀態
const currentPage = ref(parseInt(route.query.page) || 1);
const itemsPerPage = ref(parseInt(route.query.perPage) || 10);

// 搜尋相關狀態
const searchQuery = ref(route.query.search || "");
const selectedActionTypes = ref([]);
const selectedEntityTypes = ref([]);
const selectedTargetCategory = ref(route.query.targetCategory || "");
const selectedTargetId = ref(route.query.targetId || "");
const startDate = ref(route.query.startDate || "");
const endDate = ref(route.query.endDate || "");

// 過濾選項數據
const filterOptions = ref({
    actionTypes: [],
    entityTypes: [],
    targetCategories: [],
});

// 修改排序狀態管理
const sortBy = ref(route.query.sortBy || "create_time");
const sortDesc = ref(route.query.sortDesc === "true");

// 獲取過濾選項
const fetchFilterOptions = async () => {
    try {
        const { data } = await axios.get("/system/getAuditLogFilterOptions");
        if (data.code === 0) {
            filterOptions.value = data.data;

            // 如果URL有指定 actionTypeIds, 需要找出對應的物件
            if (route.query.actionTypeIds) {
                const actionTypeIds = route.query.actionTypeIds.split(",").map((id) => parseInt(id));
                selectedActionTypes.value = filterOptions.value.actionTypes.filter((type) =>
                    actionTypeIds.includes(type.id)
                );
            }

            // 如果URL有指定 entityTypeIds, 需要找出對應的物件
            if (route.query.entityTypeIds) {
                const entityTypeIds = route.query.entityTypeIds.split(",").map((id) => parseInt(id));
                selectedEntityTypes.value = filterOptions.value.entityTypes.filter((type) =>
                    entityTypeIds.includes(type.id)
                );
            }
        }
    } catch (error) {
        console.error("Failed to fetch filter options:", error);
        emitter.emit("openSnackbar", { message: "無法獲取過濾選項", color: "error" });
    }
};

// 查詢函數
const getAuditLogs = async () => {
    const params = {
        page: currentPage.value,
        perPage: itemsPerPage.value,
        search: searchQuery.value,
        actionTypeIds: selectedActionTypes.value.map((item) => item.id).join(","),
        entityTypeIds: selectedEntityTypes.value.map((item) => item.id).join(","),
        targetCategory: selectedTargetCategory.value,
        targetId: selectedTargetId.value,
        startDate: startDate.value,
        endDate: endDate.value,
        sortBy: sortBy.value,
        sortDesc: sortDesc.value,
    };

    const { data } = await axios.get("/system/getAuditLog", { params });
    if (data.code === 0) {
        return data.data;
    }
    throw new Error("Failed to fetch audit logs");
};

// 使用 Vue Query
const {
    data: auditLogData,
    isSuccess,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
} = useQuery({
    queryKey: [
        "systemAuditLogs",
        currentPage,
        itemsPerPage,
        searchQuery,
        selectedActionTypes,
        selectedEntityTypes,
        selectedTargetCategory,
        selectedTargetId,
        startDate,
        endDate,
        sortBy,
        sortDesc,
    ],
    queryFn: getAuditLogs,
    placeholderData: keepPreviousData,
});

// 計算空數據顯示
const hasNoData = computed(
    () =>
        isSuccess.value &&
        auditLogData.value &&
        auditLogData.value.logs.length === 0 &&
        !searchQuery.value &&
        selectedActionTypes.value.length === 0 &&
        selectedEntityTypes.value.length === 0 &&
        !selectedTargetCategory.value &&
        !startDate.value &&
        !endDate.value
);

const hasNoSearchResults = computed(
    () =>
        isSuccess.value &&
        auditLogData.value &&
        auditLogData.value.logs.length === 0 &&
        (searchQuery.value ||
            selectedActionTypes.value.length > 0 ||
            selectedEntityTypes.value.length > 0 ||
            selectedTargetCategory.value ||
            startDate.value ||
            endDate.value)
);

// 表格欄位設定
const tableConfig = {
    columnLabels: {
        username: "使用者名稱",
        action_type_name: "動作",
        entity_type_name: "操作項目",
        target_name: "操作目標",
        target_category: "目標類別",
        ip_address: "IP 位址",
        create_time: "操作時間",
    },
    allColumns: [
        "username",
        "action_type_name",
        "entity_type_name",
        "target_name",
        "target_category",
        "ip_address",
        "create_time",
    ],
    storageKey: "system-audit-log-table-columns",
    requiredFields: ["username", "action_type_name", "entity_type_name"],
};

const { columnLabels, allColumns, requiredFields, visibleColumns } = useShowTableColumns(tableConfig);

// 事件處理函數
const handleFilterChange = (filters) => {
    if (filters.searchQuery !== undefined) searchQuery.value = filters.searchQuery;
    if (filters.selectedActionTypes !== undefined) selectedActionTypes.value = filters.selectedActionTypes;
    if (filters.selectedEntityTypes !== undefined) selectedEntityTypes.value = filters.selectedEntityTypes;
    if (filters.selectedTargetCategory !== undefined) selectedTargetCategory.value = filters.selectedTargetCategory;
    if (filters.selectedTargetId !== undefined) selectedTargetId.value = filters.selectedTargetId;
    if (filters.startDate !== undefined) startDate.value = filters.startDate;
    if (filters.endDate !== undefined) endDate.value = filters.endDate;

    // 重置為第一頁
    currentPage.value = 1;
};

const handleSortChange = (newSort) => {
    sortBy.value = newSort.sortBy;
    sortDesc.value = newSort.sortDesc;
};

const handlePageChange = (newPage) => {
    currentPage.value = newPage;
};

const handleItemsPerPageChange = (newItemsPerPage) => {
    itemsPerPage.value = newItemsPerPage;
    currentPage.value = 1;
};

// 處理參數顯示
const handleShowParameters = (item) => {
    try {
        if (typeof item.parameters === "string") {
            currentParameters.value = JSON.parse(item.parameters);
        } else {
            currentParameters.value = item.parameters;
        }
        currentItemName.value = `${item.action_type_name} ${item.entity_type_name}`;
        parametersDialog.value = true;
    } catch (e) {
        console.error("Failed to parse parameters", e);
        emitter.emit("openSnackbar", { message: "無法解析參數資料", color: "error" });
    }
};

// 初始化獲取過濾器選項
onMounted(() => {
    fetchFilterOptions();
});
</script>

<template>
    <div class="settings-container">
        <SystemHeader
            title="審計日誌"
            subtitle="記錄系統中重要操作的執行情況，包括操作者、操作類型、操作時間等資訊。"
            icon="mdi-clipboard-text-clock"
            :actions="[
                {
                    id: 'refresh',
                    text: '更新資料',
                    icon: 'mdi-refresh',
                    color: 'info',
                    loading: isLoading || isFetching,
                },
            ]"
            @action="refetch"
        />

        <!-- 載入的時候顯示 skeleton -->
        <v-row v-if="isLoading && !auditLogData">
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
                headline="尚無操作日誌"
                text="系統目前沒有記錄任何操作日誌。當用戶執行重要操作時，例如新增知識庫、新增專家、修改系統設定等，系統會自動記錄相關信息。"
            />
        </v-row>

        <v-card class="content-card" v-else>
            <v-card-text>
                <!-- 過濾和搜尋元件 -->
                <AuditLogFilter
                    :action-types="filterOptions.actionTypes"
                    :entity-types="filterOptions.entityTypes"
                    :search-query="searchQuery"
                    :selected-action-types="selectedActionTypes"
                    :selected-entity-types="selectedEntityTypes"
                    :start-date="startDate"
                    :end-date="endDate"
                    @filter-change="handleFilterChange"
                />

                <div class="mt-4">
                    <!-- 表格元件 -->
                    <AuditLogTable
                        :logs="auditLogData?.logs || []"
                        :is-loading="isLoading"
                        :has-no-search-results="hasNoSearchResults"
                        :sort-by="sortBy"
                        :sort-desc="sortDesc"
                        :total-pages="auditLogData?.totalPages || 1"
                        :current-page="currentPage"
                        :items-per-page="itemsPerPage"
                        :total-count="auditLogData?.totalCount || 0"
                        :visible-columns="visibleColumns"
                        :column-labels="columnLabels"
                        @sort-change="handleSortChange"
                        @page-change="handlePageChange"
                        @items-per-page-change="handleItemsPerPageChange"
                        @show-parameters="handleShowParameters"
                    />
                </div>
            </v-card-text>
        </v-card>

        <!-- 參數詳情對話框元件 -->
        <AuditLogParametersDialog
            v-model="parametersDialog"
            :parameters="currentParameters"
            :item-name="currentItemName"
        />
    </div>
</template>

<style scoped>
.settings-container {
    padding: 2em;
}

.content-card {
    background-color: #fafafa;
    overflow: visible !important; /* 確保 sticky 元素可以 "溢出" */
}
</style>
