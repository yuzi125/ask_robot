<script setup>
import { ref, watch, computed } from "vue";
import { useDebounceFn } from "@vueuse/core";
import ColumnSettings from "@/components/common/ColumnSettings.vue";
import { useShowTableColumns } from "@/composables";
import AuditLogAdvancedSearch from "@/components/system/auditLog/AuditLogAdvancedSearch.vue";

const props = defineProps({
    actionTypes: {
        type: Array,
        default: () => [],
    },
    entityTypes: {
        type: Array,
        default: () => [],
    },
    searchQuery: {
        type: String,
        default: "",
    },
    selectedActionTypes: {
        type: Array,
        default: () => [],
    },
    selectedEntityTypes: {
        type: Array,
        default: () => [],
    },
    startDate: {
        type: String,
        default: "",
    },
    endDate: {
        type: String,
        default: "",
    },
});

// 定義事件
const emit = defineEmits(["filter-change"]);

// 內部狀態
const rawSearchQuery = ref(props.searchQuery);
const localSelectedActionTypes = ref(props.selectedActionTypes || []);
const localSelectedEntityTypes = ref(props.selectedEntityTypes || []);
const localStartDate = ref(props.startDate);
const localEndDate = ref(props.endDate);
const showAdvancedSearch = ref(false);

// 計算顯示過濾器摘要
const hasFilters = computed(() => {
    return (
        localSelectedActionTypes.value.length > 0 ||
        localSelectedEntityTypes.value.length > 0 ||
        localStartDate.value ||
        localEndDate.value
    );
});

const actionTypesLabel = computed(() => {
    if (localSelectedActionTypes.value.length === 1) {
        return `操作類型: ${localSelectedActionTypes.value[0].name}`;
    }
    return `操作類型: ${localSelectedActionTypes.value.length} 個已選擇`;
});

const entityTypesLabel = computed(() => {
    if (localSelectedEntityTypes.value.length === 1) {
        return `操作項目: ${localSelectedEntityTypes.value[0].name}`;
    }
    return `操作項目: ${localSelectedEntityTypes.value.length} 個已選擇`;
});

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
    requiredFields: ["username", "action_type_name"],
};

const { visibleColumns } = useShowTableColumns(tableConfig);

// 為了讓 ColumnSettings 正常工作，正確導出 columnLabels
const columnLabels = tableConfig.columnLabels;
const allColumns = tableConfig.allColumns;
const requiredFields = tableConfig.requiredFields;

// 使用 debounce 處理搜尋輸入
const debouncedSearch = useDebounceFn((value) => {
    emitFilterChange({ searchQuery: value });
}, 500);

// 監聽原始搜尋輸入變化
watch(rawSearchQuery, (newValue) => {
    debouncedSearch(newValue);
});

// 監聽屬性變化，更新內部狀態
watch(
    () => props.searchQuery,
    (newVal) => {
        rawSearchQuery.value = newVal;
    }
);

watch(
    () => props.selectedActionTypes,
    (newVal) => {
        localSelectedActionTypes.value = newVal || [];
    }
);

watch(
    () => props.selectedEntityTypes,
    (newVal) => {
        localSelectedEntityTypes.value = newVal || [];
    }
);

watch(
    () => props.startDate,
    (newVal) => {
        localStartDate.value = newVal;
    }
);

watch(
    () => props.endDate,
    (newVal) => {
        localEndDate.value = newVal;
    }
);

// 動作類型和實體類型變化處理
watch([localSelectedActionTypes, localSelectedEntityTypes], () => {
    emitFilterChange({
        selectedActionTypes: localSelectedActionTypes.value,
        selectedEntityTypes: localSelectedEntityTypes.value,
    });
});

// 處理過濾條件變化
function emitFilterChange(changes) {
    emit("filter-change", {
        searchQuery: changes.searchQuery !== undefined ? changes.searchQuery : props.searchQuery,
        selectedActionTypes:
            changes.selectedActionTypes !== undefined ? changes.selectedActionTypes : props.selectedActionTypes,
        selectedEntityTypes:
            changes.selectedEntityTypes !== undefined ? changes.selectedEntityTypes : props.selectedEntityTypes,
        selectedTargetCategory: changes.selectedTargetCategory || "",
        selectedTargetId: changes.selectedTargetId || "",
        startDate: changes.startDate !== undefined ? changes.startDate : props.startDate,
        endDate: changes.endDate !== undefined ? changes.endDate : props.endDate,
    });
}

// 更新過濾條件（從進階搜尋）
function updateFilters(filters) {
    emitFilterChange(filters);
}

// 清除操作類型過濾
function clearActionTypes() {
    localSelectedActionTypes.value = [];
    emitFilterChange({ selectedActionTypes: [] });
}

// 清除實體類型過濾
function clearEntityTypes() {
    localSelectedEntityTypes.value = [];
    emitFilterChange({ selectedEntityTypes: [] });
}

// 格式化日期時間顯示
function formatDateTimeDisplay(dateStr) {
    if (!dateStr) return "";

    try {
        // 如果是帶T的ISO格式，顯示為可讀格式
        if (dateStr.includes("T")) {
            const date = new Date(dateStr);
            return date.toLocaleString("zh-TW", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        }

        // 其他格式直接返回
        return dateStr;
    } catch (e) {
        console.error("Date format error:", e);
        return dateStr;
    }
}

// 日期範圍摘要顯示計算屬性
const startDateDisplay = computed(() => formatDateTimeDisplay(localStartDate.value));
const endDateDisplay = computed(() => formatDateTimeDisplay(localEndDate.value));
</script>

<template>
    <div class="filter-container">
        <div class="d-flex align-center mb-2 flex-wrap">
            <v-text-field
                v-model="rawSearchQuery"
                label="搜尋使用者名稱或操作目標"
                prepend-inner-icon="mdi-magnify"
                hide-details
                clearable
                class="search-field mr-2"
                density="comfortable"
            ></v-text-field>

            <v-spacer></v-spacer>

            <div class="d-flex">
                <v-btn
                    color="primary"
                    @click="showAdvancedSearch = true"
                    class="mx-1"
                    prepend-icon="mdi-filter-variant"
                >
                    進階搜尋
                </v-btn>

                <ColumnSettings
                    v-model="visibleColumns"
                    :headers="allColumns"
                    :header-labels="columnLabels"
                    :required-fields="requiredFields"
                    :storage-key="tableConfig.storageKey"
                    class="column-settings-trigger"
                />
            </div>
        </div>

        <!-- 顯示已選擇的過濾條件摘要 -->
        <div v-if="hasFilters" class="mt-2 filter-summary">
            <v-chip
                v-if="localSelectedActionTypes.length > 0"
                class="mr-1 mb-1"
                size="small"
                closable
                @click:close="clearActionTypes"
            >
                {{ actionTypesLabel }}
            </v-chip>
            <v-chip
                v-if="localSelectedEntityTypes.length > 0"
                class="mr-1 mb-1"
                size="small"
                closable
                @click:close="clearEntityTypes"
            >
                {{ entityTypesLabel }}
            </v-chip>
            <v-chip
                v-if="localStartDate && localEndDate"
                class="mr-1 mb-1"
                size="small"
                closable
                @click:close="emitFilterChange({ startDate: '', endDate: '' })"
            >
                日期: {{ startDateDisplay }} - {{ endDateDisplay }}
            </v-chip>
            <v-chip
                v-else-if="localStartDate"
                class="mr-1 mb-1"
                size="small"
                closable
                @click:close="emitFilterChange({ startDate: '' })"
            >
                日期 >= {{ startDateDisplay }}
            </v-chip>
            <v-chip
                v-else-if="localEndDate"
                class="mr-1 mb-1"
                size="small"
                closable
                @click:close="emitFilterChange({ endDate: '' })"
            >
                日期 <= {{ endDateDisplay }}
            </v-chip>
        </div>

        <!-- 進階搜尋對話框 -->
        <AuditLogAdvancedSearch
            v-model="showAdvancedSearch"
            :action-types="props.actionTypes"
            :entity-types="props.entityTypes"
            :selected-action-types="localSelectedActionTypes"
            :selected-entity-types="localSelectedEntityTypes"
            :start-date="localStartDate"
            :end-date="localEndDate"
            @update:filters="updateFilters"
        />
    </div>
</template>

<style scoped>
.filter-container {
    margin-bottom: 16px;
}

.sticky-header {
    position: sticky;
    top: -24px;
    background-color: #fafafa;
    z-index: 9999;
    padding: 4px 8px;
}

.search-field {
    min-width: 250px;
    max-width: 400px;
    width: 100%;
}

.filter-summary {
    display: flex;
    flex-wrap: wrap;
}

:deep(.column-settings-trigger) {
    height: 36px;
}

@media (max-width: 1200px) {
    .search-field {
        min-width: 200px;
        max-width: 300px;
    }
}

@media (max-width: 960px) {
    .search-field {
        min-width: 150px;
        max-width: 250px;
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
}
</style>
