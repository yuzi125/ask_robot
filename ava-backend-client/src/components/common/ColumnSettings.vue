<script setup>
import { ref, watch, computed } from "vue";
import { useLocalStorage } from "@vueuse/core";

const props = defineProps({
    // 支援兩種格式的 headers
    headers: {
        type: Array,
        required: true,
        // 1. [{ title: "文件名", sort: { field: "originalname" } }]
        // 2. ['name', 'title', 'sync_time']
    },
    // 用於第二種格式的標籤映射
    headerLabels: {
        type: Object,
        default: () => ({}),
    },
    // 必要欄位
    requiredFields: {
        type: Array,
        default: () => [],
    },
    // localStorage 的 key
    storageKey: {
        type: String,
        default: "showDatasetTableColumn",
    },
    modelValue: {
        type: Array,
        required: true,
    },
    style: {
        type: Object,
        default: () => ({}),
    },
});

const emit = defineEmits(["update:modelValue", "change"]);

// 處理 headers 格式統一化
const processedHeaders = computed(() => {
    return props.headers.map((header, index) => {
        if (typeof header === "string") {
            return {
                field: header,
                title: props.headerLabels[header] || header,
                index,
            };
        }
        return {
            ...header,
            index,
        };
    });
});

// 使用 VueUse 的 localStorage
const savedColumns = useLocalStorage(props.storageKey, props.modelValue);

// 選中的欄位
const selectedColumns = ref([]);

// 預設值（用於重置）
const defaultColumns = computed(() => processedHeaders.value.map((_, index) => index));

// 檢查是否為必要欄位
const isRequiredColumn = (index, header) => {
    if (typeof props.headers[index] === "string") {
        return props.requiredFields.includes(props.headers[index]);
    }
    // 對於第一種格式，預設文件名和狀態為必要
    return index === 0 || header.title === "狀態";
};

// 初始化時從 localStorage 讀取
watch(
    () => props.modelValue,
    (newVal) => {
        selectedColumns.value = [...(savedColumns.value || defaultColumns.value)];
    },
    { immediate: true }
);

// 處理欄位變更
const handleColumnChange = () => {
    // 如果是字串陣列模式，轉換成索引
    const finalColumns = selectedColumns.value
        .map((val) => (typeof val === "string" ? props.headers.indexOf(val) : val))
        .filter((index) => index !== -1);

    finalColumns.sort((a, b) => a - b);

    savedColumns.value = finalColumns;
    emit("update:modelValue", finalColumns);
    emit("change", finalColumns);
};
// 重置為預設值
const resetToDefault = () => {
    selectedColumns.value = [...defaultColumns.value];
    handleColumnChange();
};
</script>

<template>
    <div class="column-settings">
        <v-menu location="bottom end" :close-on-content-click="false">
            <template v-slot:activator="{ props }">
                <v-btn
                    v-bind="props"
                    variant="tonal"
                    density="comfortable"
                    class="column-settings-trigger"
                    prepend-icon="mdi-view-column-outline"
                    size="default"
                    elevation="0"
                    :style="style"
                >
                    自訂顯示欄位
                </v-btn>
            </template>

            <v-card min-width="300" max-width="400" class="column-settings-menu">
                <v-card-title class="px-4 py-3 d-flex align-center">
                    <v-icon icon="mdi-view-column-outline" class="mr-2" />
                    自訂顯示欄位
                </v-card-title>

                <v-divider />

                <v-card-text class="pa-4">
                    <div class="columns-list">
                        <v-checkbox
                            v-for="header in processedHeaders"
                            :key="header.index"
                            v-model="selectedColumns"
                            :value="header.index"
                            :label="header.title"
                            :disabled="isRequiredColumn(header.index, header)"
                            density="comfortable"
                            color="primary"
                            hide-details
                            @change="handleColumnChange"
                        >
                            <template v-slot:label>
                                <div class="d-flex align-center">
                                    <span class="text-body-2">{{ header.title }}</span>
                                    <v-chip
                                        v-if="isRequiredColumn(header.index, header)"
                                        size="x-small"
                                        color="primary"
                                        variant="flat"
                                        class="ml-2"
                                    >
                                        必要
                                    </v-chip>
                                </div>
                            </template>
                        </v-checkbox>
                    </div>
                </v-card-text>

                <v-divider />

                <v-card-actions class="pa-4">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        color="primary"
                        @click="resetToDefault"
                        prepend-icon="mdi-restore"
                        size="small"
                    >
                        重設
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-menu>
    </div>
</template>

<style lang="scss" scoped>
.column-settings {
    .setting-btn {
        text-transform: none;
        letter-spacing: 0;
    }

    .column-settings-menu {
        border-radius: 8px;

        :deep(.v-card-title) {
            font-size: 1rem;
            font-weight: 500;
        }

        .columns-list {
            max-height: 400px;
            overflow-y: auto;

            // 美化滾動條
            &::-webkit-scrollbar {
                width: 6px;
            }

            &::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }

            &::-webkit-scrollbar-thumb {
                background: #ccc;
                border-radius: 3px;

                &:hover {
                    background: #999;
                }
            }

            :deep(.v-checkbox) {
                margin-bottom: 8px;

                &:last-child {
                    margin-bottom: 0;
                }
            }
        }
    }
}

.column-settings-trigger {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    height: 100%;
    margin-top: auto;
    padding: 0px 12px; // 調整內間距
    background-color: #f3f4f6;
    color: #374151;

    :deep(.v-btn__prepend) {
        margin-right: 6px;
    }
}
</style>
