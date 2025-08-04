<script setup>
import { ref, computed, watch } from "vue";
import { useQuery, useMutation } from "@tanstack/vue-query";
import { inject } from "vue";

const axios = inject("axios");
const emitter = inject("emitter");

const props = defineProps({
    modelValue: Boolean,
    currentDocument: {
        type: Object,
        required: true,
    },
    datasets_id: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue"]);

// 本地狀態
const localExtras = ref([]); // 用於編輯現有的補全內容
const newExtras = ref([]); // 用於新增的補全內容
const isLoading = ref(false);
const validationErrors = ref(new Map()); // 儲存每個輸入框的驗證錯誤
const disallowedPatterns = {
    script: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    html: /<[^>]*>/g,
    dangerous: /javascript:|data:|vbscript:|onload=|onerror=|onclick=/gi,
    specialChars: /[<>{}]/g,
};

function validateInput(text, index, isNew = false) {
    const errors = [];
    const mapKey = `${isNew ? "new" : "local"}-${index}`;

    // 檢查是否為空
    if (!text || text.trim() === "") {
        errors.push("內容不能為空");
    }

    // 檢查各種不允許的模式
    if (disallowedPatterns.script.test(text)) {
        errors.push("不允許包含 script 標籤");
    }
    if (disallowedPatterns.html.test(text)) {
        errors.push("不允許包含 HTML 標籤");
    }
    if (disallowedPatterns.dangerous.test(text)) {
        errors.push("包含潛在危險的程式碼");
    }
    if (disallowedPatterns.specialChars.test(text)) {
        errors.push("不允許使用特殊字符 < > { }");
    }

    // 更新錯誤狀態
    if (errors.length > 0) {
        validationErrors.value.set(mapKey, errors);
    } else {
        validationErrors.value.delete(mapKey);
    }

    return errors.length === 0;
}

const hasChanges = computed(() => {
    return newExtras.value.length > 0 || localExtras.value.some((extra) => extra.isModified);
});

// 清理輸入文本
const sanitizeInput = (text) => {
    return text
        .replace(disallowedPatterns.script, "")
        .replace(disallowedPatterns.html, "")
        .replace(disallowedPatterns.dangerous, "")
        .replace(disallowedPatterns.specialChars, "");
};

// 修改現有的文本變更處理
const markAsModified = (index) => {
    const text = localExtras.value[index].extra_text;
    validateInput(text, index, false);
    localExtras.value[index].isModified = true;
};

// 處理新增文本的變更
const handleNewExtraChange = (index) => {
    const text = newExtras.value[index].extra_text;
    validateInput(text, index, true);
};

// 獲取補全內容的 query
const {
    data: documentExtras,
    refetch: refetchExtras,
    isFetching,
} = useQuery({
    queryKey: ["documentExtras", props.currentDocument?.crawler_documents_id],
    queryFn: async () => {
        if (!props.currentDocument?.crawler_documents_id) return null;
        const response = await axios.get(`/crawler/documents/extra/${props.currentDocument.crawler_documents_id}`);
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    },
});

// 更新補全內容的 mutation
const updateExtraMutation = useMutation({
    mutationFn: async (extras) => {
        const response = await axios.post("/crawler/documents/extra", {
            extras,
            datasets_id: props.datasets_id,
            crawler_documents_id: props.currentDocument?.crawler_documents_id,
        });
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    },
    onSuccess: () => {
        refetchExtras();
        newExtras.value = [];
        emitter.emit("openSnackbar", { message: "儲存成功", color: "success" });
    },
});

// 監聽 documentExtras 的變化，同步到本地狀態
watch(
    () => documentExtras.value,
    (newValue) => {
        if (newValue) {
            localExtras.value = newValue.map((extra) => ({
                ...extra,
                is_included_in_large_chunk: extra.is_included_in_large_chunk === 1,
                isModified: false,
            }));
        }
    },
    { immediate: true }
);

// 監聽 props.currentDocument 變化
watch(
    () => props.currentDocument,
    () => {
        refetchExtras();
    },
    { immediate: true }
);

// 添加新的補全文本輸入框
const addNewExtra = () => {
    newExtras.value.push({
        crawler_documents_id: props.currentDocument.crawler_documents_id,
        extra_text: "",
        is_included_in_large_chunk: false,
    });
};

// 移除新增的補全文本
const removeNewExtra = (index) => {
    newExtras.value.splice(index, 1);
};

// 關閉對話框
const closeDialog = () => {
    if (hasChanges.value) {
        if (confirm("您有未儲存的變更，確定要關閉嗎？")) {
            emit("update:modelValue", false);
        }
    } else {
        emit("update:modelValue", false);
    }
};
// 儲存前驗證所有內容
const validateAllContent = () => {
    let isValid = true;

    // 驗證現有內容
    localExtras.value.forEach((extra, index) => {
        if (!validateInput(extra.extra_text, index, false)) {
            isValid = false;
        }
    });

    // 驗證新增內容
    newExtras.value.forEach((extra, index) => {
        if (!validateInput(extra.extra_text, index, true)) {
            isValid = false;
        }
    });

    return isValid;
};

// 儲存所有變更
const saveAllChanges = async () => {
    if (!validateAllContent()) {
        emitter.emit("openSnackbar", {
            message: "請修正輸入內容中的錯誤",
            color: "error",
        });
        return;
    }

    const updatedExtras = [
        // 所有現有的補全內容
        ...localExtras.value.map((extra) => ({
            ...extra,
            extra_text: sanitizeInput(extra.extra_text),
            is_included_in_large_chunk: extra.is_included_in_large_chunk ? 1 : 0,
            is_enable: extra.isDeleted ? 0 : 1, // 根據刪除標記設置 is_enable
        })),
        // 新增的補全內容
        ...newExtras.value.map((extra) => ({
            ...extra,
            extra_text: sanitizeInput(extra.extra_text),
            is_included_in_large_chunk: extra.is_included_in_large_chunk ? 1 : 0,
            is_enable: 1,
        })),
    ];

    if (updatedExtras.length > 0) {
        isLoading.value = true;
        try {
            await updateExtraMutation.mutateAsync(updatedExtras);
            emit("update:modelValue", false);
        } catch (error) {
            emitter.emit("openSnackbar", {
                message: "儲存失敗：" + error.message,
                color: "error",
            });
        } finally {
            isLoading.value = false;
        }
    }
};

// 修改刪除函數為切換函數
const toggleDelete = (index) => {
    localExtras.value[index].isDeleted = !localExtras.value[index].isDeleted;
    localExtras.value[index].isModified = true;
    localExtras.value[index].is_enable = localExtras.value[index].isDeleted ? 0 : 1;
};
</script>
<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="900">
        <v-card class="completion-dialog">
            <v-card-title class="pt-6 px-6 pb-2">
                <div class="d-flex align-center mb-2">
                    <v-icon icon="mdi-puzzle" color="primary" size="28" class="mr-3" />
                    <span class="text-h5 font-weight-bold">增加問法</span>
                </div>

                <div class="description-section mt-2">
                    <div class="text-body-1 text-medium-emphasis mb-1">文件：{{ currentDocument?.title }}</div>
                    <div class="d-flex align-center help-text">
                        <v-icon icon="mdi-information" color="info" size="18" class="mr-2" />
                        <span class="text-caption text-info">
                            增加問法可以提高語意搜尋，搜尋到此問題的分數，可提高類似問題的搜尋效果。
                        </span>
                        <!-- <v-tooltip location="bottom end" class="ml-1">
                            <template v-slot:activator="{ props }">
                                <v-icon v-bind="props" icon="mdi-help-circle-outline" color="info" size="16" />
                            </template>
                            <div class="pa-2">
                                <p class="text-caption mb-0">添加多種問法可以：</p>
                                <ul class="text-caption pl-4 mb-0">
                                    <li>提升搜尋準確度</li>
                                    <li>增加問題被找到的機會</li>
                                    <li>幫助系統理解相似問題</li>
                                </ul>
                            </div>
                        </v-tooltip> -->
                    </div>
                </div>
            </v-card-title>

            <v-divider></v-divider>

            <v-card-text class="pa-6 content-container">
                <!-- 現有的問法列表 -->
                <div v-if="documentExtras?.length || isFetching" class="mb-6">
                    <div class="d-flex align-center justify-space-between mb-4">
                        <div class="d-flex align-center">
                            <v-icon icon="mdi-text-box-check" color="primary" size="24" class="mr-3" />
                            <span class="text-h6 font-weight-medium">已新增的問法</span>
                        </div>
                        <span class="text-caption text-medium-emphasis">共 {{ localExtras.length }} 個問法</span>
                    </div>

                    <v-skeleton-loader v-if="isFetching" type="list-item-two-line" loading="true" />

                    <div v-else class="questions-grid">
                        <v-hover v-for="(extra, index) in localExtras" :key="index" v-slot="{ isHovering }">
                            <div class="question-card-wrapper">
                                <!-- 刪除標記容器 -->
                                <div v-if="extra.isDeleted" class="delete-badge">即將刪除</div>

                                <v-card
                                    class="question-card"
                                    :class="{
                                        'marked-for-deletion': extra.isDeleted,
                                        'has-error': validationErrors.get(`local-${index}`),
                                        'elevation-2': isHovering && !extra.isDeleted,
                                        'elevation-1': !isHovering && !extra.isDeleted,
                                    }"
                                >
                                    <!-- 卡片內容 -->
                                    <v-text-field
                                        v-model="extra.extra_text"
                                        variant="outlined"
                                        density="comfortable"
                                        :error="!!validationErrors.get(`local-${index}`)"
                                        :error-messages="validationErrors.get(`local-${index}`)"
                                        :disabled="extra.isDeleted"
                                        hide-details="auto"
                                        class="question-input"
                                        bg-color="white"
                                        @input="markAsModified(index)"
                                    />

                                    <div class="card-actions">
                                        <v-checkbox
                                            v-model="extra.is_included_in_large_chunk"
                                            label="加入文本"
                                            hide-details
                                            density="compact"
                                            @change="markAsModified(index)"
                                            :disabled="extra.isDeleted"
                                            class="checkbox-label"
                                        />

                                        <v-btn
                                            :icon="extra.isDeleted ? 'mdi-restore' : 'mdi-delete'"
                                            variant="text"
                                            :color="extra.isDeleted ? 'success' : 'error'"
                                            density="comfortable"
                                            size="small"
                                            @click="toggleDelete(index)"
                                            :class="{ 'visible-on-hover': !isHovering && !extra.isDeleted }"
                                        />
                                    </div>
                                </v-card>
                            </div>
                        </v-hover>
                    </div>
                </div>

                <!-- 新增的問法 -->
                <div v-if="newExtras.length > 0" class="mb-6">
                    <div class="d-flex align-center justify-space-between mb-4">
                        <div class="d-flex align-center">
                            <v-icon icon="mdi-text-box-plus" color="success" size="24" class="mr-3" />
                            <span class="text-h6 font-weight-medium">新增的問法</span>
                        </div>
                        <span class="text-caption text-medium-emphasis">共 {{ newExtras.length }} 個新問法</span>
                    </div>

                    <div class="questions-grid">
                        <v-hover v-for="(extra, index) in newExtras" :key="index" v-slot="{ isHovering }">
                            <v-card
                                class="question-card"
                                :class="{
                                    'has-error': validationErrors.get(`new-${index}`),
                                    'elevation-2': isHovering,
                                    'elevation-1': !isHovering,
                                }"
                            >
                                <v-text-field
                                    v-model="extra.extra_text"
                                    variant="outlined"
                                    density="comfortable"
                                    :error="!!validationErrors.get(`new-${index}`)"
                                    :error-messages="validationErrors.get(`new-${index}`)"
                                    placeholder="請輸入問法"
                                    hide-details="auto"
                                    class="question-input"
                                    bg-color="white"
                                    @input="handleNewExtraChange(index)"
                                />

                                <div class="card-actions">
                                    <v-checkbox
                                        v-model="extra.is_included_in_large_chunk"
                                        label="加入文本"
                                        hide-details
                                        density="compact"
                                        class="checkbox-label"
                                    />

                                    <v-btn
                                        icon="mdi-delete"
                                        variant="text"
                                        color="error"
                                        density="comfortable"
                                        size="small"
                                        @click="removeNewExtra(index)"
                                        :class="{ 'visible-on-hover': !isHovering }"
                                    />
                                </div>
                            </v-card>
                        </v-hover>
                    </div>
                </div>

                <!-- 新增按鈕 -->
                <v-btn
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-plus"
                    class="mb-6"
                    elevation="0"
                    @click="addNewExtra"
                >
                    新增問法
                </v-btn>
            </v-card-text>

            <div class="dialog-footer">
                <v-divider></v-divider>
                <v-card-actions class="pa-4">
                    <v-spacer></v-spacer>
                    <v-btn color="grey" variant="text" class="px-3" @click="closeDialog"> 取消 </v-btn>
                    <v-btn color="primary" :loading="isLoading" class="px-3" elevation="0" @click="saveAllChanges">
                        儲存變更
                    </v-btn>
                </v-card-actions>
            </div>
        </v-card>
    </v-dialog>
</template>

<style lang="scss" scoped>
.completion-dialog {
    .content-container {
        flex-grow: 1;
        overflow-y: auto;
        padding-bottom: 80px !important; // 為固定底部按鈕預留空間
    }

    .dialog-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        z-index: 1;
    }
}

.questions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
}

.question-card-wrapper {
    position: relative;
}

.delete-badge {
    position: absolute;
    top: -12px;
    right: -10px;
    background-color: #ef5350;
    color: white;
    padding: 4px 6px;
    border-radius: 5px;
    font-size: 0.9rem;
    z-index: 2;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.question-card {
    width: 100%;
    padding: 16px;
    transition: all 0.3s ease;

    &.marked-for-deletion {
        background-color: #fff5f5;
        border: 1px dashed #ef5350;
        opacity: 0.8;

        &::before {
            content: "";
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            opacity: 0.5;
            z-index: 1;
        }
    }

    .question-input {
        margin-bottom: 12px;
    }

    .card-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .checkbox-label {
        :deep(.v-label) {
            opacity: 0.8;
            font-size: 0.875rem;
        }
    }

    .visible-on-hover {
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    &:hover {
        .visible-on-hover {
            opacity: 1;
        }
    }
}
</style>
