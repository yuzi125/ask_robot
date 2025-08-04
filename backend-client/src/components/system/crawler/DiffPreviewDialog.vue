<script setup>
import { computed } from "vue";

const props = defineProps({
    modelValue: Boolean,
    diffHtml: String,
    pendingOperation: String,
    pendingOperationData: Object,
    currentSite: Object,
});

const emit = defineEmits(["update:modelValue", "confirm", "cancel"]);

// 計算屬性判斷是否有變更
const hasChanges = computed(() => {
    return !props.diffHtml.includes("沒有檢測到任何變更");
});

// 取消操作
const cancelOperation = () => {
    emit("cancel");
    emit("update:modelValue", false);
};

// 確認變更
const confirmOperation = () => {
    emit("confirm");
};
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="900px"
        persistent
    >
        <v-card class="dialog-card">
            <v-card-title class="py-4 text-white headline bg-info d-flex justify-space-between align-center">
                <div>
                    <v-icon class="mr-2" color="white">mdi-compare</v-icon>
                    預覽變更
                </div>
                <v-btn icon variant="text" color="white" @click="cancelOperation">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pt-4 pb-0">
                <v-alert v-if="!hasChanges" type="info" variant="tonal" class="mb-4">
                    沒有檢測到任何變更，無需保存。
                </v-alert>

                <template v-else>
                    <v-alert type="info" variant="tonal" class="mb-4">
                        <p><strong>變更說明：</strong></p>
                        <ul>
                            <li v-if="pendingOperation === 'edit'">
                                您正在編輯 {{ currentSite?.site_name }}({{ currentSite?.site_id }}) 站點。
                            </li>
                            <li v-else-if="pendingOperation === 'delete'">
                                您正在刪除 {{ pendingOperationData?.site_name }}({{ pendingOperationData?.site_id }})
                                的站點。
                            </li>
                            <li v-else-if="pendingOperation === 'add'">您正在新增一個站點。</li>
                            <li v-else-if="pendingOperation === 'update'">您進行了多項變更，請檢查以下差異。</li>
                        </ul>
                    </v-alert>

                    <div class="mb-2 font-weight-bold">變更內容：</div>
                    <!-- 使用 v-html 顯示 JSON 差異 -->
                    <div class="json-diff-wrapper">
                        <div v-html="diffHtml"></div>
                    </div>
                </template>
            </v-card-text>

            <v-divider class="mt-4"></v-divider>

            <v-card-actions class="px-6 py-3">
                <v-btn color="grey" variant="text" @click="cancelOperation"> 取消 </v-btn>
                <v-spacer></v-spacer>
                <v-btn color="primary" variant="text" @click="confirmOperation" :disabled="!hasChanges">
                    確認變更
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
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

.dialog-card {
    border-radius: 8px;
    overflow: hidden;
}

:deep(.v-card-title) {
    letter-spacing: 0.5px;
}

:deep(.v-text-field .v-input__details) {
    padding-left: 4px;
}

:deep(.v-text-field--disabled .v-field__input) {
    opacity: 0.8;
}

:deep(.json-diff-wrapper) {
    max-height: 500px;
    overflow-y: auto;
    background-color: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-family: monospace;
    padding: 8px;
}

:deep(.json-diff-container) {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

:deep(.diff-line) {
    padding: 12px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.diff-line:hover) {
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

:deep(.diff-added) {
    background-color: #e6ffed;
    border-left: 4px solid #22863a;
}

:deep(.diff-removed) {
    background-color: #ffeef0;
    border-left: 4px solid #cb2431;
}

:deep(.diff-changed) {
    background-color: #f1f8ff;
    border-left: 4px solid #0366d6;
}

:deep(.diff-moved) {
    background-color: #f8f4ff;
    border-left: 4px solid #6f42c1;
}

:deep(.diff-path) {
    font-weight: 600;
    color: #24292e;
    padding: 4px 0;
    word-break: break-all;
}

:deep(.path-dot) {
    color: #6a737d;
    margin: 0 2px;
}

:deep(.diff-operation) {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

:deep(.diff-info-label) {
    font-weight: 600;
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.85em;
    margin-right: 8px;
}

:deep(.diff-added .diff-info-label) {
    background-color: #22863a20;
    color: #22863a;
}

:deep(.diff-removed .diff-info-label) {
    background-color: #cb243120;
    color: #cb2431;
}

:deep(.diff-changed .diff-info-label) {
    background-color: #0366d620;
    color: #0366d6;
}

:deep(.diff-moved .diff-info-label) {
    background-color: #6f42c120;
    color: #6f42c1;
}

:deep(.diff-comparison) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
}

@media (min-width: 768px) {
    :deep(.diff-comparison) {
        flex-direction: row;
        align-items: center;
    }
}

:deep(.diff-old-container),
:deep(.diff-new-container) {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

:deep(.diff-label) {
    font-size: 0.85em;
    font-weight: 600;
    background-color: #f1f1f1;
    padding: 2px 6px;
    border-radius: 3px;
    display: inline-block;
    margin-bottom: 4px;
}

:deep(.diff-old-container .diff-label) {
    color: #cb2431;
    background-color: #ffeef0;
}

:deep(.diff-new-container .diff-label) {
    color: #22863a;
    background-color: #e6ffed;
}

:deep(.diff-value-container) {
    padding: 8px;
    background-color: white;
    border-radius: 4px;
    border: 1px solid #e1e4e8;
    overflow: auto;
    max-height: 200px;
}

:deep(.diff-arrow) {
    font-weight: bold;
    color: #0366d6;
    font-size: 1.5em;
    margin: 0 12px;
    align-self: center;
}

:deep(.diff-info) {
    color: #586069;
    font-style: italic;
}

:deep(.diff-code) {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
}

:deep(.diff-no-changes) {
    padding: 16px;
    color: #586069;
    font-style: italic;
    text-align: center;
    background-color: #f8f9fa;
    border-radius: 6px;
    border: 1px dashed #d1d5db;
}

/* 語法高亮 */
:deep(.diff-string) {
    color: #032f62;
}

:deep(.diff-number) {
    color: #005cc5;
}

:deep(.diff-boolean) {
    color: #e36209;
}

:deep(.diff-null),
:deep(.diff-undefined) {
    color: #6a737d;
    font-style: italic;
}

.action-sticky {
    flex: 0 0 auto;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    position: sticky;
    bottom: 0;
    background: white;
    z-index: 2;
    padding: 12px 24px;
}
</style>
