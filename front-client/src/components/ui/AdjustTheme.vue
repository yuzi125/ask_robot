<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore, useUserStore } from "@/store/index";
import { storeToRefs } from "pinia";

const settingsStore = useSettingsStore();
const userStore = useUserStore();
const { uid } = storeToRefs(userStore);
const { theme } = storeToRefs(settingsStore);

const themeLocalStorageUid = uid.value ? `ava-theme-${uid.value}` : "ava-theme";

// 從 store 獲取主題選項
const themeOptions = computed(() => settingsStore.themeOptions);

// 計算當前選中主題的顯示文字
const currentThemeLabel = computed(() => {
    const currentTheme = theme.value?.system_client_theme_default;
    const option = themeOptions.value.find((t) => t.value === currentTheme);
    console.log("currentTheme", currentTheme, option);
    return option?.label || "選擇主題";
});

const handleThemeChange = (event) => {
    const value = event;

    // 更新 localStorage
    localStorage.setItem(themeLocalStorageUid, value);
    // 更新 store
    theme.value.system_client_theme_default = value;
    // 更新 body class
    document.body.className = value;
};

// 監聽 theme 的變化
watch(
    () => theme.value.system_client_theme_default,
    (newTheme) => {
        if (newTheme && !theme.value.lockTheme) {
            localStorage.setItem(themeLocalStorageUid, newTheme);
            document.body.className = newTheme;
        }
    }
);

onMounted(() => {
    const savedTheme = localStorage.getItem(themeLocalStorageUid);
    if (savedTheme && !theme.value.lockTheme) {
        theme.value.system_client_theme_default = savedTheme;
        document.body.className = savedTheme;
    }
});
</script>

<template>
    <div v-if="!theme.lockTheme">
        <Label class="mb-2 text-sm font-medium">聊天室主題</Label>
        <Select :model-value="theme.system_client_theme_default" @update:model-value="handleThemeChange">
            <SelectTrigger class="w-[180px] mt-2">
                <SelectValue :placeholder="currentThemeLabel" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem v-for="option in themeOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                </SelectItem>
            </SelectContent>
        </Select>
    </div>
</template>
