<script setup>
import { ref, watch, computed } from "vue";

const props = defineProps({
    modelValue: Boolean,
    cacheDeleteFrequency: Number,
    cacheExpirationTime: Number,
    expertConfigJsonData: Object,
});

const confirmDialog = ref(false);
const emit = defineEmits(["update:modelValue", "save", "clearCache"]);

const localCacheDeleteFrequency = ref(props.expertConfigJsonData.cache_delete_frequency);

// 驗證輸入值是否有效
const isValidInput = computed(() => {
    const value = Number(localCacheDeleteFrequency.value);
    return !isNaN(value) && value >= 1;
});

// 處理輸入值變化
const handleInput = (value) => {
    // 先移除非數字字符

    let numValue = value.target.value.replace(/[^0-9-]/g, "");
    // 轉換為數字
    numValue = parseInt(numValue);

    // 如果是無效值或小於1，設為1
    if (isNaN(numValue) || numValue < 1) {
        localCacheDeleteFrequency.value = 1;
    } else if (isNaN(numValue) || numValue > 365) {
        localCacheDeleteFrequency.value = 365;
    } else {
        localCacheDeleteFrequency.value = numValue;
    }
};

// 重設為默認值
const resetFrequency = () => {
    emit("save", {
        cache_delete_frequency: "",
    });
};

watch(
    () => props.expertConfigJsonData,
    (newValue) => {
        localCacheDeleteFrequency.value = newValue.cache_delete_frequency;
    },
    { deep: true }
);

const saveSettings = () => {
    // 最後一次確保值的有效性
    // handleInput(localCacheDeleteFrequency.value);

    emit("save", {
        cache_delete_frequency: localCacheDeleteFrequency.value,
    });
    emit("update:modelValue", false);
};

const confirmDeleteAllCache = () => {
    confirmDialog.value = false;
    emit("clearCache");
};
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500px">
        <v-card>
            <v-card-title class="text-h6 bg-grey-lighten-4 pa-4"> 快取設置 </v-card-title>

            <v-card-text class="pt-4">
                <v-row>
                    <v-col cols="12">
                        <v-text-field
                            v-model="localCacheDeleteFrequency"
                            label="快取清理頻率 (天)"
                            type="number"
                            min="1"
                            hint="請輸入1-365之間的數字"
                            @input="handleInput"
                            persistent-hint
                            max="365"
                            hide-details="auto"
                            density="comfortable"
                        >
                            <template v-slot:append>
                                <v-tooltip text="重設清理頻率" location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon="mdi-restore"
                                            variant="text"
                                            density="comfortable"
                                            @click="resetFrequency"
                                        ></v-btn>
                                    </template>
                                </v-tooltip>
                            </template>
                        </v-text-field>
                    </v-col>
                </v-row>

                <v-divider class="my-4"></v-divider>

                <v-row>
                    <v-col cols="12">
                        <v-btn
                            color="error"
                            variant="outlined"
                            prepend-icon="mdi-delete-sweep"
                            @click="confirmDialog = true"
                            class="mr-2"
                        >
                            清除全部快取
                        </v-btn>
                    </v-col>
                </v-row>
            </v-card-text>

            <v-card-actions class="bg-grey-lighten-4 pa-4">
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="$emit('update:modelValue', false)"> 取消 </v-btn>
                <v-btn color="primary" @click="saveSettings" :disabled="!isValidInput"> 儲存設定 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- 確認對話框 -->
    <v-dialog v-model="confirmDialog" max-width="400" persistent>
        <v-card>
            <v-card-title class="text-h6 bg-error-lighten-5 pa-4">
                <v-icon start color="error">mdi-alert-circle</v-icon>
                確認清除全部快取
            </v-card-title>

            <v-card-text class="pt-4"> 注意：此操作將清除該專家的所有快取資料，操作後無法復原。 </v-card-text>

            <v-card-actions class="pa-4">
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="confirmDialog = false"> 取消 </v-btn>
                <v-btn color="error" @click="confirmDeleteAllCache"> 確認清除 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
