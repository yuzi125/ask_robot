<script setup>
import { computed } from "vue";
const props = defineProps({
    currentTheme: {
        type: String,
        required: true,
    },
    themes: {
        type: Object,
        required: true,
    },
    updateCurrentThemeLoading: {
        type: Boolean,
        default: false,
    },
    updateThemeColorsLoading: {
        type: Boolean,
        default: false,
    },
    generatingTheme: {
        type: Boolean,
        default: false,
    },
});

// 計算主題列表項目
const themeItems = computed(() => {
    return Object.entries(props.themes || {}).map(([name, theme]) => ({
        name,
        display: theme.remark ? `${name} (${theme.remark})` : name,
    }));
});

const emit = defineEmits([
    "update:currentTheme",
    "save-theme",
    "update-theme-colors",
    "edit-themes",
    "generate-theme",
    "import-theme",
    "export-theme",
]);

const handleThemeSelect = (value) => {
    emit("update:currentTheme", value);
};
</script>

<template>
    <div class="flex-wrap d-flex ga-4">
        <div class="themeActionContainer">
            <!-- 第一列：所有按鈕 -->
            <div class="button-row">
                <div class="action-buttons">
                    <v-btn
                        prepend-icon="mdi-plus-circle"
                        color="success"
                        @click="$emit('save-theme')"
                        variant="tonal"
                        class="action-btn"
                    >
                        建立新主題
                    </v-btn>
                    <v-btn
                        prepend-icon="mdi-robot"
                        color="primary"
                        @click="$emit('generate-theme')"
                        variant="tonal"
                        :loading="generatingTheme"
                        class="action-btn"
                    >
                        AI生成主題
                    </v-btn>
                    <v-btn
                        prepend-icon="mdi-pencil"
                        color="info"
                        @click="$emit('edit-themes')"
                        variant="tonal"
                        class="action-btn"
                    >
                        管理主題
                    </v-btn>
                    <v-btn
                        prepend-icon="mdi-import"
                        color="info"
                        @click="$emit('import-theme')"
                        variant="tonal"
                        class="action-btn"
                    >
                        匯入主題
                    </v-btn>
                    <v-btn
                        prepend-icon="mdi-export"
                        color="info"
                        variant="tonal"
                        @click="$emit('export-theme')"
                        class="action-btn"
                    >
                        匯出主題
                    </v-btn>
                </div>
                <v-btn
                    prepend-icon="mdi-content-save"
                    color="primary"
                    :loading="updateThemeColorsLoading"
                    @click="$emit('update-theme-colors')"
                    variant="tonal"
                    class="save-btn"
                >
                    保存顏色修改
                </v-btn>
            </div>

            <!-- 第二列：主題選擇器 -->
            <v-select
                :model-value="currentTheme"
                :items="themeItems"
                label="選擇主題"
                variant="outlined"
                density="comfortable"
                hide-details
                class="theme-select"
                prepend-inner-icon="mdi-palette-swatch"
                @update:model-value="handleThemeSelect"
                :loading="updateCurrentThemeLoading"
                :disabled="updateCurrentThemeLoading"
                item-title="display"
                item-value="name"
            ></v-select>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.theme-select {
    max-width: 300px;
    width: 100%;
    margin-top: 16px;
}

.themeActionContainer {
    width: 100%;
    display: flex;
    flex-direction: column;
}

.button-row {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
}

.action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex: 1;
}

.action-btn {
    margin-right: 8px;
    margin-bottom: 8px;
}

.save-btn {
    margin-left: auto;
    margin-bottom: 8px;
}

/* 中小螢幕處理 */
@media (max-width: 1200px) {
    .button-row {
        flex-direction: column;
        align-items: flex-start;
    }

    .action-buttons {
        width: 100%;
        margin-bottom: 8px;
    }

    .save-btn {
        margin-left: 0;
        order: 99; /* 放在最後面 */
        margin-bottom: 16px;
    }
}

@media (max-width: 576px) {
    .action-buttons {
        flex-direction: column;
    }

    .action-btn {
        width: 100%;
        margin-right: 0;
    }
}
</style>
