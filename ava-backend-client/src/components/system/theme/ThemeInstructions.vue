<script setup>
// 如果需要自定義提示訊息，可以通過 props 傳遞
const props = defineProps({
    instructions: {
        type: Array,
        default: () => [
            "從下拉選單選擇主題後將自動套用",
            "調整顏色後，請記得點擊「保存顏色修改」來更新目前主題",
            "如要建立新主題，請點擊「建立新主題」並輸入名稱",
            "鎖定主題後，前台聊天室使用者將無法自行切換主題色",
        ],
    },
});
</script>

<template>
    <v-alert variant="tonal" class="mt-4 mb-0" density="comfortable">
        <div class="d-flex flex-column">
            <div
                v-for="(instruction, index) in instructions"
                :key="index"
                class="d-flex align-center"
                :class="{ 'mb-1': index !== instructions.length - 1 }"
            >
                <v-icon icon="mdi-cog" size="small" class="mr-2"></v-icon>
                <span>{{ instruction }}</span>
            </div>
        </div>
    </v-alert>
</template>
