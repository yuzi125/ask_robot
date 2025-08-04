<script setup>
import { ref, computed, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";

const props = defineProps({
    modelValue: String,
    modelOptions: Array,
    selectedModel: {
        type: Array,
        default: () => [],
    },
    sortField: String,
    sortOrder: String,
    modelListData: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits([
    "update:modelValue",
    "update:selectedModel",
    "update:sortField",
    "update:sortOrder",
    "filtersChanged",
]);

const localModelValue = ref(props.modelValue);
const localSelectedModels = ref(props.selectedModel);

const debouncedEmit = useDebounceFn((value) => {
    emit("update:modelValue", value);
    // emitFiltersChanged();
}, 500);

watch(
    () => props.selectedModel,
    (newValue) => {
        localSelectedModels.value = newValue;
    },
    { deep: true }
);

watch(localModelValue, (newValue) => {
    debouncedEmit(newValue);
});

const localSortField = computed({
    get: () => props.sortField,
    set: (value) => emit("update:sortField", value),
});

const localSortOrder = computed({
    get: () => props.sortOrder,
    set: (value) => emit("update:sortOrder", value),
});

const sortOptions = [
    { text: "使用次數", value: "usage_count" },
    { text: "Chunk 數", value: "related_chunk_ids" },
    { text: "建立時間", value: "create_time" },
    { text: "更新時間", value: "update_time" },
];

const sortOrderOptions = [
    { text: "升序", value: "asc" },
    { text: "降序", value: "desc" },
];

// 選擇模型相關

const handleModelSelectionChange = (newValue) => {
    if (!Array.isArray(newValue)) {
        newValue = [newValue];
    }

    // 處理 "All" 的邏輯
    if (newValue.includes("All")) {
        if (!localSelectedModels.value.includes("All")) {
            newValue = ["All"];
        }
    } else if (localSelectedModels.value.includes("All")) {
        newValue = newValue.filter((v) => v !== "All");
    }

    localSelectedModels.value = newValue;
    emit("update:selectedModel", newValue);

    // 觸發過濾器變更事件
    emit("filtersChanged", {
        selectedModel: newValue,
        searchQuery: localModelValue.value,
        sortField: props.sortField,
        sortOrder: props.sortOrder,
    });
};

// 計算選中項目的顯示文字
const selectedModelsText = computed(() => {
    if (
        !localSelectedModels.value ||
        localSelectedModels.value.length === 0 ||
        localSelectedModels.value.includes("All")
    ) {
        return "全部模型";
    }

    const selectedModels = props.modelListData
        .filter((item) => localSelectedModels.value.includes(item.value))
        .map((item, index) => `<div class="tooltip-item">${index + 1}. ${item.title}</div>`)
        .join("");

    return selectedModels;
});

const truncateText = (text, selectionCount, maxLength = 10) => {
    if (!text) return "";
    // 當只選擇一個項目時，返回完整文字
    if (selectionCount === 1) {
        return text;
    }
    // 當選擇多個項目時，進行截斷
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};
</script>

<template>
    <v-row align="center">
        <v-col cols="12" sm="4">
            <v-text-field
                v-model="localModelValue"
                label="搜尋 Q 或 A 的內容"
                prepend-inner-icon="mdi-magnify"
                outlined
                dense
                clearable
            />
        </v-col>
        <v-col cols="12" sm="4">
            <v-tooltip location="top" content-class="model-tooltip">
                <template v-slot:activator="{ props: tooltipProps }">
                    <v-select
                        :model-value="localSelectedModels"
                        @update:model-value="handleModelSelectionChange"
                        :items="modelListData"
                        label="選擇模型"
                        class="model-select"
                        multiple
                        outlined
                        dense
                        v-bind="tooltipProps"
                        clearable
                    >
                        <template v-slot:selection="{ item, index }">
                            <div class="selection-wrapper">
                                <v-chip
                                    v-if="index === 0"
                                    :class="['model-chip', { 'single-selection': localSelectedModels.length === 1 }]"
                                    :title="item.raw.title"
                                >
                                    <span class="model-name">
                                        {{ truncateText(item.raw.title, localSelectedModels.length) }}
                                    </span>
                                </v-chip>
                                <span v-if="index === 1" class="others-count">
                                    (+{{ localSelectedModels.length - 1 }} others)
                                </span>
                            </div>
                        </template>
                    </v-select>
                </template>
                <template v-slot:default>
                    <div v-dompurify-html="selectedModelsText"></div>
                </template>
            </v-tooltip>
        </v-col>
        <v-col cols="12" sm="2">
            <v-select
                v-model="localSortField"
                :items="sortOptions"
                item-title="text"
                item-value="value"
                label="排序依據"
                outlined
                dense
            />
        </v-col>
        <v-col cols="12" sm="2">
            <v-select
                v-model="localSortOrder"
                :items="sortOrderOptions"
                item-title="text"
                item-value="value"
                label="排序方式"
                outlined
                dense
            />
        </v-col>
    </v-row>
</template>

<style scoped>
.model-select {
    min-width: 200px;
    max-width: 300px;
    width: 100%;
}

@media (max-width: 1200px) {
    .model-select {
        min-width: 150px;
        max-width: 250px;
    }
}

@media (max-width: 960px) {
    .model-select {
        min-width: 150px;
        max-width: 250px;
    }
}

@media (max-width: 768px) {
    .model-select {
        min-width: 100%;
        max-width: 100%;
    }
}

.others-count {
    font-size: 0.75rem !important;
    font-weight: 400;
    line-height: 1.667;
    letter-spacing: 0.0333333333em !important;
    text-transform: none !important;
    color: #9e9e9e !important;
}
</style>
