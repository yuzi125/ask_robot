<!-- components/system/theme/ThemeHeader.vue -->
<script setup>
const props = defineProps({
    title: {
        type: String,
        default: "主題設定",
    },
    subtitle: {
        type: String,
        default: "自訂與管理聊天室主題配色（按下 Ctrl+S 可以直接儲存）",
    },
    isLocked: {
        type: Boolean,
        required: true,
    },
    toggleLockThemeLoading: {
        type: Boolean,
        required: false,
    },
});

defineEmits(["toggle-lock"]);
</script>

<template>
    <div class="px-6 pt-6 pb-4">
        <div class="d-flex align-center">
            <div class="d-flex align-center">
                <v-icon icon="mdi-palette" size="large" color="primary" class="mr-3"></v-icon>
                <div>
                    <div class="text-h5 font-weight-bold">{{ title }}</div>
                    <div class="mt-1 text-subtitle-2 text-medium-emphasis">
                        {{ subtitle }}
                    </div>
                </div>
            </div>
            <div class="ml-auto">
                <v-btn
                    :prepend-icon="isLocked ? 'mdi-lock-open' : 'mdi-lock'"
                    :color="isLocked ? 'warning' : 'info'"
                    @click="$emit('toggle-lock')"
                    variant="tonal"
                    :loading="toggleLockThemeLoading"
                >
                    {{ isLocked ? "解除鎖定主題" : "鎖定主題" }}
                </v-btn>
            </div>
        </div>
        <v-alert :color="isLocked ? 'warning' : 'info'" variant="tonal" class="mt-4" density="comfortable">
            <div class="d-flex align-center">
                <v-icon :icon="isLocked ? 'mdi-lock' : 'mdi-lock-open'" class="mr-2"></v-icon>
                <span
                    >目前主題狀態：{{
                        isLocked ? "已鎖定 (使用者將使用系統預設主題，無法切換主題)" : "未鎖定 (使用者可自由切換主題)"
                    }}</span
                >
            </div>
        </v-alert>
    </div>
</template>
