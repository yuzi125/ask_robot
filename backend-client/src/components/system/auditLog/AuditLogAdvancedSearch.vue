<script setup>
import { ref, watch, computed, inject } from "vue";
import { useQuery } from "@tanstack/vue-query";

const axios = inject("axios");

// 定義屬性
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },
    actionTypes: {
        type: Array,
        default: () => [],
    },
    entityTypes: {
        type: Array,
        default: () => [],
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
const emit = defineEmits(["update:modelValue", "update:filters"]);

// 內部計算屬性：對話框可見性
const dialogVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value),
});

// 本地狀態
const localSelectedActionTypes = ref([...props.selectedActionTypes]);
const localSelectedEntityTypes = ref([...props.selectedEntityTypes]);
const selectedTargetCategory = ref("");
const selectedTargetId = ref("");

// 處理日期時間格式
const formatToLocalDateTime = (dateStr) => {
    if (!dateStr) return "";

    try {
        // 如果是帶T的ISO格式
        if (dateStr.includes("T")) {
            // 取出年月日T時分（移除秒和毫秒部分）
            return dateStr.substring(0, 16);
        }

        // 如果只是日期格式，添加時間部分
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            if (dateStr === props.startDate) {
                return `${dateStr}T00:00`; // 開始日期設為當天開始
            } else {
                return `${dateStr}T23:59`; // 結束日期設為當天結束
            }
        }

        // 如果是其他格式，嘗試轉換
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().substring(0, 16);
        }
    } catch (e) {
        console.error("Date format error:", e);
    }

    return "";
};

const localStartDate = ref(formatToLocalDateTime(props.startDate));
const localEndDate = ref(formatToLocalDateTime(props.endDate));

// 查詢參數
const actionTypeIds = computed(() => localSelectedActionTypes.value.map((item) => item.id).join(","));

const entityTypeIds = computed(() => localSelectedEntityTypes.value.map((item) => item.id).join(","));

// 依賴下拉選單狀態
const filterOptions = ref({
    actionTypes: props.actionTypes,
    entityTypes: props.entityTypes,
    targetCategories: [],
});

// 目標項目（基於目標類別選擇）
const targetItems = ref([]);

// 是否有可選目標類別
const hasTargetCategories = computed(
    () => filterOptions.value.targetCategories && filterOptions.value.targetCategories.length > 0
);

// 是否已選擇了操作類型或實體類型
const hasTypeSelection = computed(
    () => localSelectedActionTypes.value.length > 0 || localSelectedEntityTypes.value.length > 0
);

// 添加一個計算屬性來檢查是否選擇了任何過濾條件
const hasFilters = computed(() => {
    return (
        localSelectedActionTypes.value.length > 0 ||
        localSelectedEntityTypes.value.length > 0 ||
        selectedTargetCategory.value ||
        selectedTargetId.value ||
        localStartDate.value ||
        localEndDate.value
    );
});

// 使用 Vue Query 獲取 Filter Options
const getFilterOptions = async () => {
    const params = {};

    if (actionTypeIds.value) {
        params.actionTypeIds = actionTypeIds.value;
    }

    if (entityTypeIds.value) {
        params.entityTypeIds = entityTypeIds.value;
    }

    const { data } = await axios.get("/system/getAuditLogFilterOptions", { params });

    if (data.code === 0) {
        return data.data;
    }

    throw new Error("Failed to fetch filter options");
};

// 使用 Vue Query 獲取過濾選項
const {
    data: filterData,
    isLoading,
    isFetching,
    refetch: refetchOptions,
} = useQuery({
    queryKey: ["auditLogFilterOptions", actionTypeIds, entityTypeIds],
    queryFn: getFilterOptions,
    enabled: dialogVisible,
    staleTime: 5 * 60 * 1000, // 5分鐘內不重新獲取
    refetchOnWindowFocus: false,
});

// 當查詢參數變化或對話框打開時，更新數據
watch([() => filterData.value, dialogVisible], ([data, isOpen]) => {
    if (data && isOpen) {
        // 只有當對話框打開時才更新選項
        // 更新實體類型選項
        if (data.entityTypes) {
            filterOptions.value.entityTypes = data.entityTypes;

            // 確保已選實體類型仍然在新選項中存在
            localSelectedEntityTypes.value = localSelectedEntityTypes.value.filter((selected) =>
                data.entityTypes.some((option) => option.id === selected.id)
            );
        }

        // 更新目標類別選項
        if (data.targetCategories) {
            filterOptions.value.targetCategories = data.targetCategories;

            // 如果目標類別不再有效，重置選擇
            if (
                selectedTargetCategory.value &&
                !data.targetCategories.some((cat) => cat.value === selectedTargetCategory.value)
            ) {
                selectedTargetCategory.value = "";
                selectedTargetId.value = "";
            } else if (selectedTargetCategory.value) {
                // 如果目標類別仍然有效，則更新目標項目
                updateTargetItems(selectedTargetCategory.value);
            }
        }
    }
});

// 監聽屬性變化
watch(
    () => props.actionTypes,
    (val) => {
        filterOptions.value.actionTypes = val;
    },
    { immediate: true }
);

watch(
    () => props.entityTypes,
    (val) => {
        filterOptions.value.entityTypes = val;
    },
    { immediate: true }
);

watch(
    () => props.selectedActionTypes,
    (val) => {
        localSelectedActionTypes.value = [...val];
    },
    { immediate: true }
);

watch(
    () => props.selectedEntityTypes,
    (val) => {
        localSelectedEntityTypes.value = [...val];
    },
    { immediate: true }
);

watch(
    () => props.startDate,
    (val) => {
        localStartDate.value = formatToLocalDateTime(val);
    },
    { immediate: true }
);

watch(
    () => props.endDate,
    (val) => {
        localEndDate.value = formatToLocalDateTime(val);
    },
    { immediate: true }
);

// 依賴式下拉選單：目標類別變化時，更新目標項目
watch(selectedTargetCategory, (newValue) => {
    updateTargetItems(newValue);
});

// 更新目標項目
function updateTargetItems(category) {
    if (!category) {
        targetItems.value = [];
        selectedTargetId.value = "";
        return;
    }

    const categoryData = filterOptions.value.targetCategories.find((cat) => cat.value === category);
    if (categoryData && categoryData.items) {
        targetItems.value = categoryData.items;

        // 如果之前選擇的目標不再有效，重置選擇
        if (selectedTargetId.value && !targetItems.value.some((item) => item.id === selectedTargetId.value)) {
            selectedTargetId.value = "";
        }
    } else {
        targetItems.value = [];
        selectedTargetId.value = "";
    }
}

// 套用過濾條件
function applyFilters() {
    emit("update:filters", {
        selectedActionTypes: localSelectedActionTypes.value,
        selectedEntityTypes: localSelectedEntityTypes.value,
        selectedTargetCategory: selectedTargetCategory.value,
        selectedTargetId: selectedTargetId.value,
        startDate: localStartDate.value,
        endDate: localEndDate.value,
    });

    dialogVisible.value = false;
}

// 清除所有過濾條件
function clearAllFilters() {
    localSelectedActionTypes.value = [];
    localSelectedEntityTypes.value = [];
    selectedTargetCategory.value = "";
    selectedTargetId.value = "";
    localStartDate.value = "";
    localEndDate.value = "";
}

// 關閉對話框
function closeDialog() {
    // 重置為原始值
    localSelectedActionTypes.value = [...props.selectedActionTypes];
    localSelectedEntityTypes.value = [...props.selectedEntityTypes];
    selectedTargetCategory.value = "";
    selectedTargetId.value = "";
    localStartDate.value = formatToLocalDateTime(props.startDate);
    localEndDate.value = formatToLocalDateTime(props.endDate);

    dialogVisible.value = false;
}
</script>

<template>
    <v-dialog v-model="dialogVisible" max-width="800px">
        <v-card class="dialog-card">
            <v-card-title class="d-flex justify-space-between align-center dialog-title">
                <span>進階搜尋</span>
                <v-btn icon @click="closeDialog" variant="text">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-progress-linear v-if="isLoading || isFetching" indeterminate color="primary"></v-progress-linear>

            <v-card-text class="pt-4 dialog-content">
                <v-container>
                    <!-- 操作類型過濾區塊 -->
                    <v-row>
                        <v-col cols="12">
                            <h3 class="text-subtitle-1 font-weight-bold">根據操作類型過濾</h3>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="localSelectedActionTypes"
                                :items="filterOptions.actionTypes"
                                item-title="name"
                                item-value="id"
                                label="操作類型"
                                multiple
                                return-object
                                chips
                                closable-chips
                                hint="選擇操作類型以過濾結果"
                                persistent-hint
                                :loading="isLoading || isFetching"
                            ></v-select>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="localSelectedEntityTypes"
                                :items="filterOptions.entityTypes"
                                item-title="name"
                                item-value="id"
                                label="操作項目"
                                multiple
                                return-object
                                chips
                                closable-chips
                                hint="選擇操作項目以過濾結果"
                                persistent-hint
                                :loading="isLoading || isFetching"
                            ></v-select>
                        </v-col>
                    </v-row>

                    <v-divider class="my-4"></v-divider>

                    <!-- 目標過濾區塊 - 總是顯示但根據狀態禁用 -->
                    <v-row>
                        <v-col cols="12">
                            <h3 class="text-subtitle-1 font-weight-bold">根據目標過濾</h3>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="selectedTargetCategory"
                                :items="filterOptions.targetCategories"
                                item-title="label"
                                item-value="value"
                                label="目標類別"
                                :disabled="!hasTargetCategories"
                                hint="選擇要過濾的目標類別"
                                persistent-hint
                                clearable
                                :loading="isLoading || isFetching"
                            ></v-select>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="selectedTargetId"
                                :items="targetItems"
                                item-title="name"
                                item-value="id"
                                label="目標項目"
                                :disabled="!selectedTargetCategory || targetItems.length === 0"
                                hint="選擇特定目標項目"
                                persistent-hint
                                clearable
                                :loading="isLoading || isFetching"
                            ></v-select>
                        </v-col>
                    </v-row>

                    <v-divider class="my-4"></v-divider>

                    <!-- 日期範圍區塊 - 使用文字輸入框含時間選擇 -->
                    <v-row>
                        <v-col cols="12">
                            <h3 class="text-subtitle-1 font-weight-bold">日期時間範圍</h3>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="localStartDate"
                                label="開始日期時間"
                                type="datetime-local"
                                clearable
                                hint="選擇開始日期和時間 (格式：YYYY-MM-DD HH:MM)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="localEndDate"
                                label="結束日期時間"
                                type="datetime-local"
                                clearable
                                hint="選擇結束日期和時間 (格式：YYYY-MM-DD HH:MM)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions class="pa-4 dialog-footer">
                <v-btn color="grey" variant="text" @click="clearAllFilters">
                    <v-icon start>mdi-delete-sweep</v-icon>
                    清除全部
                </v-btn>
                <v-spacer></v-spacer>
                <v-btn color="grey-darken-1" variant="text" @click="closeDialog">取消</v-btn>
                <v-btn
                    color="primary"
                    @click="applyFilters"
                    :loading="isLoading || isFetching"
                    :disabled="isLoading || isFetching || !hasFilters"
                >
                    套用過濾
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.dialog-card {
    display: flex;
    flex-direction: column;
    max-height: 90vh;
}

.dialog-title {
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    padding: 16px;
    flex-shrink: 0;
}

.dialog-content {
    overflow-y: auto;
}

.dialog-footer {
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    flex-shrink: 0;
}
</style>
