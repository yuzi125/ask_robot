<script setup>
import { ref, inject, computed, watch, onMounted, onUnmounted } from "vue";
import { useQuery, useMutation } from "@tanstack/vue-query";
import SystemHeader from "@/components/system/SystemHeader.vue";
import ColorPicker from "@/components/system/theme/ColorPicker.vue";
import useSaveShortcut from "@/composables/useSaveShortcut";

const axios = inject("axios");
const emitter = inject("emitter");

const editableItems = ref([]);
const colorPickerState = ref({});
const isSaving = ref(false);

// 調色盤顏色設定
const swatches = [
    ["#FF0000", "#AA0000", "#550000"],
    ["#FFFF00", "#AAAA00", "#555500"],
    ["#00FF00", "#00AA00", "#005500"],
    ["#00FFFF", "#00AAAA", "#005555"],
    ["#0000FF", "#0000AA", "#000055"],
];

// 數據轉換函數
const transformBulletinData = (rawData) => {
    if (!rawData) return [];

    return Object.entries(rawData)
        .map(([id, value]) => {
            const baseObj = {
                id,
                text: value,
                originalText: value,
                hasChanged: false,
                defaultValue: value,
            };

            switch (id) {
                case "system_bulletin":
                    return {
                        ...baseObj,
                        title: "公告訊息",
                        description: "設定顯示在系統上方的公告內容",
                        multiline: true,
                    };
                case "system_bulletin_color":
                    return {
                        ...baseObj,
                        title: "文字顏色",
                        isColor: true,
                    };
                case "system_bulletin_color_back":
                    return {
                        ...baseObj,
                        title: "背景顏色",
                        isColor: true,
                    };
                default:
                    return baseObj;
            }
        })
        .sort((a, b) => {
            const order = ["system_bulletin", "system_bulletin_color", "system_bulletin_color_back"];
            return order.indexOf(a.id) - order.indexOf(b.id);
        });
};

const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["bulletinSettings"],
    queryFn: async () => {
        const response = await axios.get("/clientsets/bulletin");
        if (response.data.code !== 0) {
            throw new Error("Failed to fetch bulletin settings");
        }
        return response.data.data;
    },
});

// 監聽數據變化並更新 editableItems
watch(
    () => data.value,
    (newData) => {
        if (newData) {
            editableItems.value = transformBulletinData(newData);
            editableItems.value.forEach((item) => {
                if (item.isColor) {
                    colorPickerState.value[item.id] = false;
                }
            });
        }
    },
    { immediate: true }
);

const hasChanges = computed(() => {
    return editableItems.value.some((item) => item.hasChanged);
});

const updateMutation = useMutation({
    mutationFn: async (items) => {
        isSaving.value = true;
        try {
            const promises = items.map((item) => axios.put("/clientsets/bulletin", { id: item.id, text: item.text }));
            const responses = await Promise.all(promises);

            if (responses.every((response) => response.data.code === 0)) {
                emitter.emit("openSnackbar", { message: "儲存成功", color: "success" });
            }
            return responses;
        } catch (error) {
            emitter.emit("openSnackbar", {
                message: error.message || "儲存失敗",
                color: "error",
            });
            throw error;
        } finally {
            isSaving.value = false;
        }
    },
    onSuccess: () => {
        editableItems.value.forEach((item) => {
            item.originalText = item.text;
            item.hasChanged = false;
        });
        refetch();
    },
});

const handleTextChange = (item) => {
    item.hasChanged = item.text !== item.originalText;
};

const save = () => {
    const changedItems = editableItems.value.filter((item) => item.hasChanged);
    if (changedItems.length > 0) {
        updateMutation.mutate(changedItems);
    }
};

const handleHeaderAction = (actionId) => {
    switch (actionId) {
        case "save":
            save();
            break;
        case "refresh":
            refetch();
            break;
    }
};

const resetToDefault = (item) => {
    item.text = item.defaultValue;
    item.hasChanged = item.text !== item.originalText;
};

const getMessageItem = computed(() => editableItems.value.find((item) => !item.isColor));
const getColorItems = computed(() => editableItems.value.filter((item) => item.isColor));

// 設定 ctrl+s 快捷鍵
useSaveShortcut(save);
</script>

<template>
    <div class="settings-container">
        <!-- 系統 Header -->
        <SystemHeader
            title="公告設定"
            subtitle="設定聊天室公告內容與樣式（按下 Ctrl+S 可以直接儲存）"
            icon="mdi-bullhorn"
            :actions="[
                {
                    id: 'refresh',
                    text: '更新資料',
                    icon: 'mdi-refresh',
                    color: 'info',
                    loading: isLoading || isFetching,
                },
                {
                    id: 'save',
                    text: '儲存設定',
                    icon: 'mdi-content-save',
                    color: 'primary',
                    loading: isSaving,
                    disabled: !hasChanges,
                },
            ]"
            @action="handleHeaderAction"
        />
        <v-row v-if="isLoading">
            <v-col cols="12" md="6">
                <v-skeleton-loader class="mx-auto" elevation="2" type="paragraph, paragraph" />
            </v-col>
            <v-col cols="12" md="6">
                <v-skeleton-loader class="mx-auto" elevation="2" type="paragraph, paragraph" />
            </v-col>
        </v-row>
        <v-row v-else>
            <!-- 公告訊息卡片 -->
            <v-col cols="12" md="6" v-if="getMessageItem">
                <v-card elevation="2" class="h-100">
                    <v-card-item>
                        <div class="mb-4 d-flex align-center justify-space-between">
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-text" color="primary" size="24" class="mr-2" />
                                <div>
                                    <div class="text-h6">公告內容設定</div>
                                    <div class="text-subtitle-2 text-grey">設定顯示在聊天室上方的公告內容</div>
                                </div>
                            </div>
                            <v-tooltip location="top">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon="mdi-restore"
                                        variant="text"
                                        color="primary"
                                        density="comfortable"
                                        @click="resetToDefault(getMessageItem)"
                                    >
                                    </v-btn>
                                </template>
                                還原
                            </v-tooltip>
                        </div>

                        <v-textarea
                            v-model="getMessageItem.text"
                            rows="4"
                            variant="outlined"
                            density="comfortable"
                            hide-details
                            placeholder="請輸入公告內容..."
                            @update:model-value="handleTextChange(getMessageItem)"
                            :class="{ modified: getMessageItem.hasChanged }"
                            no-resize
                        ></v-textarea>
                    </v-card-item>
                </v-card>
            </v-col>

            <!-- 顏色設定卡片 -->
            <v-col cols="12" md="6" v-if="getColorItems.length">
                <v-card elevation="2" class="h-100">
                    <v-card-item>
                        <div class="mb-4 d-flex align-center justify-space-between">
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-palette" color="primary" size="24" class="mr-2" />
                                <div>
                                    <div class="text-h6">外觀設定</div>
                                    <div class="text-subtitle-2 text-grey">設定公告的顯示樣式</div>
                                </div>
                            </div>
                            <v-tooltip location="top">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon="mdi-restore"
                                        variant="text"
                                        color="primary"
                                        density="comfortable"
                                        @click="() => getColorItems.forEach(resetToDefault)"
                                    >
                                    </v-btn>
                                </template>
                                還原
                            </v-tooltip>
                        </div>

                        <div class="color-settings">
                            <ColorPicker
                                v-for="item in getColorItems"
                                :key="item.id"
                                :label="item.title"
                                :color-value="item.text"
                                v-model:color-picker-value="colorPickerState[item.id]"
                                :swatches="swatches"
                                @update:color="
                                    (color) => {
                                        item.text = color;
                                        handleTextChange(item);
                                    }
                                "
                                class="mb-4"
                            />
                        </div>
                    </v-card-item>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
.settings-container {
    padding: 2em;
}

.modified {
    border-color: rgb(var(--v-theme-primary)) !important;
}

:deep(.v-text-field) {
    width: 100% !important;
}

/* 調整顏色設定區域的間距 */
.color-settings {
    padding-top: 1rem;
}

@media (max-width: 960px) {
    .settings-container {
        padding: 1em;
    }
}
</style>
