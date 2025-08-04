<script setup>
import { defineProps } from "vue";
import emptyStatusNoData from "@/assets/no_data.png";
const props = defineProps({
    image: {
        type: String,
        default: () => emptyStatusNoData, // 預設圖片
    },
    headline: {
        type: String,
        default: "暫無資料", // 預設標題
    },
    text: {
        type: String,
        default: "目前沒有資料可以顯示。", // 預設描述文字
    },
    actionText: {
        type: String,
        default: "", // 預設按鈕文字
    },
    actionIcon: {
        type: String,
        default: "", // 預設按鈕圖標
    },
    actionCallback: {
        type: Function,
        default: null, // 預設按鈕的 callback 函數
    },
    isLoading: {
        type: Boolean,
        default: false, // 預設按鈕的 callback 函數
    },
});
</script>
<template>
    <v-empty-state :image="image">
        <template v-slot:headline>
            <div class="mt-2 mb-2 text-h4">{{ headline }}</div>
        </template>

        <template v-slot:text>
            <div class="text-body-2 font-weight-medium text-medium-emphasis">
                {{ text }}
            </div>
        </template>

        <template v-slot:actions>
            <v-spacer></v-spacer>
            <v-btn
                v-if="actionText && actionIcon && actionCallback"
                @click="actionCallback"
                :prepend-icon="actionIcon"
                :loading="isLoading"
                :disabled="isLoading"
                color="primary"
                text
            >
                {{ actionText }}
            </v-btn>
            <v-spacer></v-spacer>
        </template>
    </v-empty-state>
</template>
