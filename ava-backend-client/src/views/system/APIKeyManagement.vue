<script setup>
import { ref, computed } from "vue";
import APIKeyTable from "@/components/system/apiKeyManagement/APIKeyTable.vue";
import CreateUserDialog from "@/components/system/apiKeyManagement/CreateUserDialog.vue";
import SecuritySettingsDialog from "@/components/system/apiKeyManagement/SecuritySettingsDialog.vue";
import DeleteConfirmDialog from "@/components/system/apiKeyManagement/DeleteConfirmDialog.vue";
import ShowKeyDialog from "@/components/system/apiKeyManagement/ShowKeyDialog.vue";
import CommonSettingsDialog from "@/components/system/apiKeyManagement/CommonSettingsDialog.vue";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";
import ColumnSettings from "@/components/common/ColumnSettings.vue";
import { useShowTableColumns, usePagination, useAPIKeyData } from "@/composables";
import SystemHeader from "@/components/system/SystemHeader.vue";
const {
    // API Keys
    apiKeys,
    isLoading,
    isError,
    error,
    refetchAPIKeys,

    // Mutations
    createUserAPIKey,
    updateDomains,
    updatePaths,
    updateCommonSettings,
    deleteUser,
    deleteDomain,
    deletePath,
    toggleStatus,
    toggleDomainStatus,
    togglePathStatus,

    // Mutation States
    creating,
    updating,
    isAPIKeysFetching,

    selectedUser,

    // Mutation States
    deletingAPIKey,
} = useAPIKeyData();

// 搜尋和分頁
const searchQuery = ref("");
const { currentPage, itemsPerPage, paginatedItems, totalPages } = usePagination(apiKeys, searchQuery);

// 日期篩選
const startDate = ref(null);
const endDate = ref(null);

// 計算篩選後的項目
const filteredItems = computed(() => {
    return paginatedItems.value.filter((item) => {
        const createTime = new Date(item.create_time);
        const isAfterStart = startDate.value ? createTime >= new Date(startDate.value) : true;
        const isBeforeEnd = endDate.value ? createTime <= new Date(endDate.value) : true;
        return isAfterStart && isBeforeEnd;
    });
});

// 對話框控制
const createDialog = ref(false);
const securitySettingsDialog = ref(false);
const deleteDialog = ref(false);
const showKeyDialog = ref(false);
const commonSettingsDialog = ref(false);

// 選中的資料
// const selectedUser = ref(null);
const userToDelete = ref(null);
const newlyGeneratedKey = ref("");

// 方法
const openCreateDialog = () => {
    createDialog.value = true;
};

const openSecuritySettingsDialog = (user) => {
    selectedUser.value = { ...user };
    securitySettingsDialog.value = true;
};

const openCommonSettingsDialog = (user) => {
    selectedUser.value = { ...user };
    commonSettingsDialog.value = true;
};

const confirmDeleteUser = (user) => {
    userToDelete.value = user;
    deleteDialog.value = true;
};

const closeShowKeyDialog = () => {
    showKeyDialog.value = false;
    newlyGeneratedKey.value = "";
};

const headerActions = computed(() => [
    {
        id: "refresh",
        text: "更新資料",
        icon: "mdi-refresh",
        color: "info",
        loading: isAPIKeysFetching.value,
    },
]);

const handleHeaderAction = (actionId) => {
    switch (actionId) {
        case "refresh":
            refetchAPIKeys();
            break;
    }
};

const hasNoData = computed(() => !isLoading.value && apiKeys.value && apiKeys.value.length === 0);
const hasNoSearchResults = computed(
    () => !isLoading.value && apiKeys.value && apiKeys.value.length > 0 && paginatedItems.value.length === 0
);

const tableConfig = {
    columnLabels: {
        username: "使用者名稱",
        apiKey: "API Key",
        description: "說明",
        domains: "已設定網域",
        paths: "已設定路徑",
        usageCount: "使用次數",
        totalPrice: "總花費",
        status: "狀態",
    },
    allColumns: ["username", "apiKey", "description", "domains", "paths", "usageCount", "totalPrice", "status"],
    storageKey: "api-key-management-table-columns",
    requiredFields: ["username", "apiKey"], // 假設使用者名稱和 API Key 是必要欄位
};

const { columnLabels, allColumns, requiredFields, visibleColumns } = useShowTableColumns(tableConfig);
</script>

<template>
    <div class="settings-container">
        <!-- 頂部標題 -->
        <SystemHeader
            title="API Key 管理"
            subtitle="管理 API 使用者及其安全性設定"
            icon="mdi-key"
            :actions="headerActions"
            @action="handleHeaderAction"
        />

        <!-- 載入狀態 -->
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
        <v-card v-else class="content-card">
            <v-card-text>
                <!-- 搜尋和操作區 -->
                <div class="sticky-header">
                    <div class="flex-wrap py-2 d-flex align-center justify-space-between">
                        <div class="d-flex" style="gap: 1rem">
                            <v-text-field
                                v-model="searchQuery"
                                label="搜尋使用者或 API Key"
                                prepend-inner-icon="mdi-magnify"
                                placeholder="請輸入使用者或 API Key"
                                hide-details="auto"
                                class="search-field"
                                density="comfortable"
                            ></v-text-field>
                            <div class="date-filter">
                                <v-text-field
                                    v-model="startDate"
                                    label="開始日期"
                                    type="date"
                                    hide-details="auto"
                                    density="comfortable"
                                ></v-text-field>
                            </div>
                            <div class="date-filter">
                                <v-text-field
                                    v-model="endDate"
                                    label="結束日期"
                                    type="date"
                                    hide-details="auto"
                                    density="comfortable"
                                ></v-text-field>
                            </div>
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
                                <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreateDialog">
                                    新增使用者
                                </v-btn>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- API Keys 列表 -->
                <APIKeyTable
                    v-if="!hasNoData && !hasNoSearchResults"
                    :items="filteredItems"
                    :loading="isLoading"
                    :visible-columns="visibleColumns"
                    :column-labels="columnLabels"
                    @edit-security-settings="openSecuritySettingsDialog"
                    @edit-common-settings="openCommonSettingsDialog"
                    @delete-user="confirmDeleteUser"
                    @enable-user="toggleStatus"
                    @disable-user="toggleStatus"
                />

                <!-- 無資料顯示 -->
                <EmptyStateNoData v-if="hasNoData" />
                <EmptyStateSearch v-else-if="hasNoSearchResults" />

                <!-- 分頁控制 -->
                <div class="mt-4 pagination-wrapper">
                    <div class="flex-wrap d-flex align-center justify-space-between">
                        <div class="mx-2 text-center flex-grow-1 pagination-container">
                            <v-pagination v-model="currentPage" :length="totalPages" :total-visible="7"></v-pagination>
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
                    </div>
                </div>
            </v-card-text>
        </v-card>

        <!-- 對話框 -->
        <CreateUserDialog v-model="createDialog" :creating="creating" @create="createUserAPIKey" />

        <SecuritySettingsDialog
            v-model="securitySettingsDialog"
            :user="selectedUser"
            :loading="updating"
            @add-domain="updateDomains"
            @toggle-domain="toggleDomainStatus"
            @delete-domain="deleteDomain"
            @add-path="updatePaths"
            @toggle-path="togglePathStatus"
            @delete-path="deletePath"
        />

        <DeleteConfirmDialog
            v-model="deleteDialog"
            :user="userToDelete"
            :deleting="deletingAPIKey"
            @confirm="deleteUser"
        />

        <ShowKeyDialog v-model="showKeyDialog" :api-key="newlyGeneratedKey" @close="closeShowKeyDialog" />

        <CommonSettingsDialog
            v-model="commonSettingsDialog"
            :creating="creating"
            :user="selectedUser"
            @update-common-settings="updateCommonSettings"
        />
    </div>
</template>
<style scoped>
.settings-container {
    padding: 2em;
}

.content-card {
    background-color: #fafafa;
    overflow: visible !important;
}

.sticky-header {
    position: sticky;
    top: -24px;
    background-color: #fafafa;
    z-index: 9999;
    padding: 4px 8px;
}

.search-field {
    min-width: 400px;
    max-width: 500px;
    width: 100%;
}

.pagination-wrapper {
    position: sticky !important;
    bottom: -24px !important;
    background-color: #fafafa;
    padding: 10px 0;
    margin-top: 20px;
    z-index: 9999;
}

.items-per-page-select {
    width: 80px;
}

.date-filter {
    min-width: 145px;
    width: 145px;
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

.pagination-control {
    display: flex;
    align-items: center;
    white-space: nowrap;
}
</style>
