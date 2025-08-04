<!-- src/components/system/apiKeyManagement/ShowKeyDialog.vue -->
<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="600"
        persistent
    >
        <v-card>
            <v-card-title> API Key 已生成 </v-card-title>
            <v-card-text>
                <v-alert type="warning" variant="tonal" class="mb-4">
                    請立即複製並保存此 API Key，關閉此視窗後將無法再次查看完整的金鑰。
                </v-alert>

                <v-text-field :value="apiKey" label="API Key" readonly class="font-monospace">
                    <template v-slot:append>
                        <v-btn icon="mdi-content-copy" variant="text" @click="copyKey" :loading="copying">
                            <v-tooltip activator="parent" location="top"> 複製金鑰 </v-tooltip>
                        </v-btn>
                    </template>
                </v-text-field>

                <div class="mt-4 text-subtitle-2">
                    <v-icon icon="mdi-information" color="info" class="mr-2"></v-icon>
                    重要提醒：
                </div>
                <ul class="mt-2 text-body-2">
                    <li>此 API Key 具有完整的訪問權限，請妥善保管。</li>
                    <li>建議在正式環境中使用環境變數或安全的金鑰管理系統儲存。</li>
                    <li>如果金鑰洩露，請立即重新生成或停用此金鑰。</li>
                </ul>

                <v-expand-transition>
                    <div v-if="copied" class="mt-4">
                        <v-alert type="success" variant="tonal" class="mb-0"> 金鑰已複製到剪貼簿！ </v-alert>
                    </div>
                </v-expand-transition>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="primary" @click="closeDialog" :disabled="!copied"> 我已複製金鑰 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
    modelValue: {
        type: Boolean,
        required: true,
    },
    apiKey: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(["update:modelValue", "close"]);

// 複製狀態
const copying = ref(false);
const copied = ref(false);

// 複製金鑰
const copyKey = async () => {
    copying.value = true;
    try {
        await navigator.clipboard.writeText(props.apiKey);
        copied.value = true;
    } catch (error) {
        console.error("複製失敗:", error);
        // 可以加入錯誤提示
    } finally {
        copying.value = false;
    }
};

// 關閉對話框
const closeDialog = () => {
    emit("update:modelValue", false);
    copied.value = false;
    emit("close");
};
</script>

<style scoped>
.font-monospace {
    font-family: "Fira Code", monospace !important;
    letter-spacing: -0.5px;
}

.mr-2 {
    margin-right: 8px;
}
</style>
