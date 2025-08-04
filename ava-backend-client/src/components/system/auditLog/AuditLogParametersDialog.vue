<script setup>
import JsonViewer from "@/components/system/crawler/JsonViewer.vue";

// 定義組件屬性
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },
    parameters: {
        type: Object,
        default: null,
    },
    itemName: {
        type: String,
        default: "",
    },
});

// 定義事件
const emit = defineEmits(["update:modelValue"]);

// 處理對話框關閉
function closeDialog() {
    emit("update:modelValue", false);
}
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="800px">
        <v-card>
            <v-card-title class="headline">{{ itemName }} 參數詳情</v-card-title>
            <v-card-text>
                <v-sheet class="rounded pa-4" color="grey-lighten-4">
                    <JsonViewer :data="parameters" />
                </v-sheet>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="grey darken-1" @click="closeDialog">關閉</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
