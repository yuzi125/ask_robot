<script setup>
import { ref, computed, watch } from "vue";
import { useMutation } from "@tanstack/vue-query";
import { inject } from "vue";

const axios = inject("axios");
const emitter = inject("emitter");

const props = defineProps({
    modelValue: Boolean,
    themes: {
        type: Object,
        required: true,
    },
    onRefetch: {
        type: Function,
        required: true,
    },
});

const emit = defineEmits(["update:modelValue"]);

// 本地狀態
const themeNames = ref({});
const themeRemarks = ref({});
const savingThemeChanges = ref(false);
const deletingTheme = ref(false);
const themeToDelete = ref("");
const showDeleteConfirmDialog = ref(false);

// 判斷是否為系統主題
const isSystemTheme = (themeName) => {
    return props.themes?.[themeName]?.is_system;
};

// 確認是否要刪除主題
const confirmDeleteTheme = (themeName) => {
    themeToDelete.value = themeName;
    showDeleteConfirmDialog.value = true;
};

// 刪除主題的 mutation
const deleteThemeMutation = useMutation({
    mutationFn: async (themeName) => {
        const response = await axios.delete(`/system/theme/${themeName}`);
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    },
    onSuccess: () => {
        props.onRefetch();
        emitter.emit("openSnackbar", {
            message: `已刪除主題「${themeToDelete.value}」`,
            color: "success",
        });
        showDeleteConfirmDialog.value = false;
    },
});

// 刪除主題
const deleteTheme = async () => {
    try {
        deletingTheme.value = true;
        await deleteThemeMutation.mutateAsync(themeToDelete.value);
    } catch (error) {
        console.error("刪除主題失敗:", error);
        emitter.emit("openSnackbar", {
            message: "刪除主題失敗，請稍後再試",
            color: "error",
        });
    } finally {
        deletingTheme.value = false;
    }
};

// 更新主題的 mutation
const updateThemesMutation = useMutation({
    mutationFn: async (data) => {
        const response = await axios.put("/system/themes", data);
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    },
    onSuccess: () => {
        props.onRefetch();
        emit("update:modelValue", false);
        emitter.emit("openSnackbar", {
            message: "主題更新成功",
            color: "success",
        });
    },
});

// 驗證主題名稱是否有效
const isThemeChangesValid = computed(() => {
    return Object.values(themeNames.value).every((name) => /^[a-zA-Z_-]+$/.test(name));
});

// 保存主題修改
const saveThemeChanges = async () => {
    try {
        savingThemeChanges.value = true;
        const updates = Object.keys(props.themes).map((originalName) => ({
            originalName,
            newName: themeNames.value[originalName],
            remark: themeRemarks.value[originalName],
        }));

        await updateThemesMutation.mutateAsync(updates);
    } catch (error) {
        console.error("更新主題失敗:", error);
        emitter.emit("openSnackbar", {
            message: "更新主題失敗，請稍後再試",
            color: "error",
        });
    } finally {
        savingThemeChanges.value = false;
    }
};

// 監聽 dialog 開啟，初始化資料
watch(
    () => props.modelValue,
    (newValue) => {
        if (newValue) {
            themeNames.value = Object.keys(props.themes || {}).reduce((acc, themeName) => {
                acc[themeName] = themeName;
                return acc;
            }, {});

            themeRemarks.value = Object.keys(props.themes || {}).reduce((acc, themeName) => {
                acc[themeName] = props.themes[themeName].remark || "";
                return acc;
            }, {});
        }
    }
);
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" width="1000">
        <!-- 這裡放原本的 dialog 內容 -->
        <v-card class="theme-management-dialog">
            <v-card-title class="d-flex flex-column pa-6">
                <div class="mb-2 d-flex align-center">
                    <v-icon icon="mdi-pencil" color="primary" class="mr-2"></v-icon>
                    <span class="text-h5">管理主題</span>
                </div>
                <v-chip color="info" size="small" variant="flat" prepend-icon="mdi-information">
                    系統主題無法編輯或刪除
                </v-chip>
            </v-card-title>

            <v-divider></v-divider>

            <!-- 使用固定高度的內容區域，並添加滾動 -->
            <v-card-text class="pa-6 theme-content">
                <v-row>
                    <v-col v-for="themeName in Object.keys(themes || {})" :key="themeName" cols="12" sm="6">
                        <v-card
                            variant="outlined"
                            :color="isSystemTheme(themeName) ? 'grey-lighten-3' : undefined"
                            class="theme-card"
                            :class="{ 'system-theme': isSystemTheme(themeName) }"
                        >
                            <v-card-item>
                                <!-- 主題標題與類型標籤 -->
                                <div class="mb-4 d-flex align-center justify-space-between">
                                    <div class="d-flex align-center">
                                        <v-icon
                                            :icon="isSystemTheme(themeName) ? 'mdi-shield-lock' : 'mdi-palette'"
                                            :color="isSystemTheme(themeName) ? 'grey' : 'primary'"
                                            class="mr-2"
                                            size="24"
                                        ></v-icon>
                                        <span class="text-h6 font-weight-medium">
                                            {{ isSystemTheme(themeName) ? "系統主題" : "自訂主題" }}
                                        </span>
                                    </div>
                                    <v-chip v-if="isSystemTheme(themeName)" color="grey" size="small" variant="flat">
                                        系統預設
                                    </v-chip>
                                </div>

                                <!-- 輸入欄位群組 -->
                                <div class="theme-fields pa-2">
                                    <div class="mb-4">
                                        <label class="mb-2 text-subtitle-2 text-medium-emphasis d-block"
                                            >主題名稱</label
                                        >
                                        <v-text-field
                                            v-model="themeNames[themeName]"
                                            :rules="[(v) => /^[a-zA-Z_-]+$/.test(v) || '請輸入英文字母、- 或 _ 符號']"
                                            variant="outlined"
                                            density="comfortable"
                                            hide-details
                                            :disabled="isSystemTheme(themeName)"
                                            :placeholder="isSystemTheme(themeName) ? '系統預設值' : '輸入主題名稱'"
                                            bg-color="white"
                                        ></v-text-field>
                                    </div>

                                    <div>
                                        <label class="mb-2 text-subtitle-2 text-medium-emphasis d-block"
                                            >備註說明</label
                                        >
                                        <v-text-field
                                            v-model="themeRemarks[themeName]"
                                            variant="outlined"
                                            density="comfortable"
                                            hide-details
                                            :disabled="isSystemTheme(themeName)"
                                            :placeholder="isSystemTheme(themeName) ? '系統預設說明' : '輸入備註說明'"
                                            bg-color="white"
                                        ></v-text-field>
                                    </div>
                                </div>
                            </v-card-item>

                            <!-- 操作按鈕 -->
                            <v-card-actions v-if="!isSystemTheme(themeName)" class="pt-0 pa-4">
                                <v-spacer></v-spacer>
                                <v-btn
                                    color="error"
                                    variant="text"
                                    density="comfortable"
                                    @click="confirmDeleteTheme(themeName)"
                                    prepend-icon="mdi-delete"
                                >
                                    刪除主題
                                </v-btn>
                            </v-card-actions>
                        </v-card>
                    </v-col>
                </v-row>
            </v-card-text>

            <!-- 固定在底部的按鈕 -->
            <div class="dialog-footer">
                <v-divider></v-divider>
                <v-card-actions class="pa-6">
                    <v-spacer></v-spacer>
                    <v-btn color="grey darken-1" @click="$emit('update:modelValue', false)" class="mr-2"> 關閉 </v-btn>
                    <v-btn
                        color="primary"
                        @click="saveThemeChanges"
                        :loading="savingThemeChanges"
                        :disabled="!isThemeChangesValid"
                    >
                        儲存
                    </v-btn>
                </v-card-actions>
            </div>
        </v-card>
    </v-dialog>

    <!-- 確認刪除的 dialog -->
    <v-dialog v-model="showDeleteConfirmDialog" width="400">
        <!-- ... 原本的確認刪除 dialog 內容 ... -->
        <v-card>
            <v-card-title class="text-h6 pa-4"> 確認刪除主題 </v-card-title>
            <v-card-text class="pa-4"> 確定要刪除主題「{{ themeToDelete }}」嗎？此操作無法復原。 </v-card-text>
            <v-card-actions class="pa-4">
                <v-spacer></v-spacer>
                <v-btn color="grey" variant="text" @click="showDeleteConfirmDialog = false"> 取消 </v-btn>
                <v-btn color="error" @click="deleteTheme" :loading="deletingTheme"> 確認刪除 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style lang="scss" scoped>
.theme-management-dialog {
    display: flex;
    flex-direction: column;
    height: 80vh; // 設定 dialog 的最大高度

    .theme-content {
        flex-grow: 1;
        overflow-y: auto;
        padding-bottom: 100px !important; // 為固定底部按鈕預留空間
    }

    .dialog-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        z-index: 1;
    }

    .theme-card {
        transition: all 0.3s ease;
        border: 1px solid rgba(0, 0, 0, 0.12);

        &:not(.system-theme):hover {
            border-color: var(--v-primary-base);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        &.system-theme {
            background-color: rgb(250, 250, 250);
        }

        .theme-fields {
            background-color: rgb(252, 252, 252);
            border-radius: 8px;
        }

        :deep(.v-field) {
            background-color: white !important;
        }
    }
}
</style>
