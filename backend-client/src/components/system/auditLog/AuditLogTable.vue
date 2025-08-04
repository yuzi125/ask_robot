<script setup>
import { ref, computed } from "vue";
import { useShowTableColumns } from "@/composables";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import AuditLogChip from "@/components/system/auditLog/AuditLogChip.vue";

const props = defineProps({
    logs: {
        type: Array,
        default: () => [],
    },
    isLoading: {
        type: Boolean,
        default: false,
    },
    hasNoSearchResults: {
        type: Boolean,
        default: false,
    },
    sortBy: {
        type: String,
        default: "create_time",
    },
    sortDesc: {
        type: Boolean,
        default: true,
    },
    totalPages: {
        type: Number,
        default: 1,
    },
    currentPage: {
        type: Number,
        default: 1,
    },
    itemsPerPage: {
        type: Number,
        default: 10,
    },
    totalCount: {
        type: Number,
        default: 0,
    },
    visibleColumns: {
        type: Array,
        default: () => [
            "username",
            "action_type_name",
            "entity_type_name",
            "target_name",
            "target_category",
            "ip_address",
            "create_time",
        ],
    },
    columnLabels: {
        type: Object,
        default: () => ({
            username: "使用者名稱",
            action_type_name: "動作",
            entity_type_name: "操作項目",
            target_name: "操作目標",
            target_category: "目標類別",
            ip_address: "IP 位址",
            create_time: "操作時間",
        }),
    },
});

// 定義事件
const emit = defineEmits(["sort-change", "page-change", "items-per-page-change", "show-parameters"]);

// 內部狀態
const hoveredColumn = ref(null);
const pageInput = ref(props.currentPage);

// 計算屬性
const totalVisible = computed(() => (window.innerWidth < 600 ? 3 : 7));

// 方法
// 修改排序函數
function sort(column) {
    let sortByValue = column;

    // 處理特殊欄位
    if (column === "action_type_name") {
        sortByValue = "action_type";
    } else if (column === "entity_type_name") {
        sortByValue = "entity_type";
    }

    if (props.sortBy === sortByValue) {
        emit("sort-change", { sortBy: sortByValue, sortDesc: !props.sortDesc });
    } else {
        emit("sort-change", { sortBy: sortByValue, sortDesc: false });
    }
}

// 獲取排序圖標
function getSortIcon(column) {
    let actualColumn = column;

    // 轉換特殊欄位名稱
    if (column === "action_type_name") {
        actualColumn = "action_type";
    } else if (column === "entity_type_name") {
        actualColumn = "entity_type";
    }

    if (props.sortBy === actualColumn) {
        return props.sortDesc ? "mdi-arrow-down" : "mdi-arrow-up";
    }
    return hoveredColumn.value === column ? "mdi-arrow-up" : "mdi-blank";
}

// 格式化日期時間
function formatDateTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

// 格式化 IP 地址（去除IPv6前綴）
function formatIpAddress(ip) {
    return ip ? ip.replace("::ffff:", "") : "";
}

// 顯示參數詳情
function showParameters(item) {
    emit("show-parameters", item);
}

// 分頁控制
function handlePageChange(page) {
    emit("page-change", page);
    pageInput.value = page;
}

function handleItemsPerPageChange(perPage) {
    emit("items-per-page-change", perPage);
}

// 跳轉到指定頁碼
function jumpToPage() {
    const page = parseInt(pageInput.value);
    if (page >= 1 && page <= props.totalPages) {
        emit("page-change", page);
    } else {
        pageInput.value = props.currentPage;
    }
}

// 獲取目標類別名稱
function getTargetCategoryName(category) {
    const categoryMap = {
        expert: "專家",
        dataset: "知識庫",
        skill: "技能",
        form: "表單",
    };
    return categoryMap[category] || category;
}

// 獲取目標類別顏色
function getCategoryColor(category) {
    const colorMap = {
        expert: "indigo",
        dataset: "teal",
        skill: "deep-purple",
        form: "blue-grey",
    };
    return colorMap[category] || "grey";
}
</script>

<template>
    <div>
        <!-- 表格 -->
        <v-table class="elevation-1 list-table">
            <thead>
                <tr>
                    <!-- 動態欄位 -->
                    <th
                        v-for="column in visibleColumns"
                        :key="column"
                        class="text-left sortable-header"
                        :class="column + '-column'"
                        @click="sort(column)"
                        @mouseover="hoveredColumn = column"
                        @mouseleave="hoveredColumn = null"
                    >
                        <div class="header-content">
                            <span>{{ columnLabels[column] }}</span>
                            <v-icon
                                small
                                class="sort-icon"
                                :class="{ visible: sortBy === column || hoveredColumn === column }"
                            >
                                {{ getSortIcon(column) }}
                            </v-icon>
                        </div>
                    </th>

                    <!-- 操作欄位 -->
                    <th class="text-center action-column">操作</th>
                </tr>
            </thead>

            <tbody>
                <!-- 載入中狀態 -->
                <template v-if="isLoading">
                    <tr v-for="n in 5" :key="n">
                        <td v-for="m in visibleColumns.length + 1" :key="m">
                            <v-skeleton-loader type="text" />
                        </td>
                    </tr>
                </template>

                <!-- 資料列表 -->
                <template v-else-if="logs.length > 0">
                    <tr v-for="item in logs" :key="item.id" class="hoverable-row">
                        <!-- 動態欄位內容 -->
                        <td v-for="column in visibleColumns" :key="column" :class="`text-left ${column}-column`">
                            <!-- 使用 Chip 元件顯示操作類型 -->
                            <template v-if="column === 'action_type_name'">
                                <AuditLogChip
                                    :type="item.action_type"
                                    :label="item.action_type_name"
                                    category="action"
                                />
                            </template>
                            <!-- 使用 Chip 元件顯示實體類型 -->
                            <template v-else-if="column === 'entity_type_name'">
                                <AuditLogChip
                                    :type="item.entity_type"
                                    :label="item.entity_type_name"
                                    category="entity"
                                />
                            </template>
                            <template v-else-if="column === 'create_time'">
                                {{ formatDateTime(item.create_time) }}
                            </template>
                            <template v-else-if="column === 'ip_address'">
                                {{ formatIpAddress(item.ip_address) }}
                            </template>
                            <template v-else-if="column === 'target_name'">
                                <template v-if="item.target_name">
                                    {{ item.target_name }}
                                </template>
                                <template v-else-if="item.target_id">
                                    {{ item.target_id }}
                                </template>
                                <template v-else> - </template>
                            </template>
                            <template v-else-if="column === 'target_category'">
                                <template v-if="item.target_category">
                                    <v-chip
                                        size="small"
                                        :color="getCategoryColor(item.target_category)"
                                        class="text-white"
                                    >
                                        {{ getTargetCategoryName(item.target_category) }}
                                    </v-chip>
                                </template>
                                <template v-else> - </template>
                            </template>
                            <template v-else>
                                {{ item[column] }}
                            </template>
                        </td>

                        <!-- 操作欄位 -->
                        <td class="text-center">
                            <v-btn
                                size="small"
                                variant="text"
                                color="primary"
                                @click="showParameters(item)"
                                :disabled="!item.parameters"
                            >
                                查看參數
                            </v-btn>
                        </td>
                    </tr>
                </template>

                <!-- 無搜尋結果 -->
                <template v-else-if="hasNoSearchResults">
                    <tr>
                        <td :colspan="visibleColumns.length + 1" class="py-4 text-center">
                            <EmptyStateSearch />
                        </td>
                    </tr>
                </template>
            </tbody>
        </v-table>

        <!-- 分頁控制 -->
        <div class="mt-4 pagination-wrapper" v-if="totalCount > 0">
            <div class="flex-wrap d-flex align-center justify-space-between">
                <div class="mx-2 text-center flex-grow-1 pagination-container">
                    <v-pagination
                        :model-value="currentPage"
                        :length="totalPages"
                        :total-visible="totalVisible"
                        @update:model-value="handlePageChange"
                    ></v-pagination>
                </div>

                <div class="mr-2 pagination-control shrink-on-small">
                    <span class="mr-1 text-body-2 hide-on-xsmall">每頁顯示</span>
                    <v-select
                        :model-value="itemsPerPage"
                        :items="[10, 20, 50, 100, 200, 500]"
                        hide-details
                        density="compact"
                        @update:model-value="handleItemsPerPageChange"
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
</template>

<style scoped>
/* 表格樣式 */
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

th {
    font-weight: bold;
    background-color: #f5f5f5;
    padding: 12px 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.list-table th,
.list-table td {
    padding: 0 8px;
    vertical-align: middle;
}

.hoverable-row:hover {
    background-color: #f5f5f5;
}

.sortable-header {
    cursor: pointer;
}

.header-content {
    display: flex;
    align-items: center;
    gap: 4px;
}

.sort-icon {
    opacity: 0;
    transition: opacity 0.2s ease;
    width: 24px;
    flex-shrink: 0;
}

.sort-icon.visible {
    opacity: 1;
}

/* 分頁樣式 */
.pagination-wrapper {
    position: sticky !important;
    bottom: -24px !important;
    background-color: #fafafa;
    padding: 10px 0;
    margin-top: 20px;
    z-index: 9999;
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

@media (max-width: 600px) {
    .shrink-on-small {
        flex-shrink: 1;
    }
    .hide-on-small {
        display: none;
    }
    .hide-on-xsmall {
        display: none;
    }
}
</style>
