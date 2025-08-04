<script setup>
import { useStateStore, useUserStore } from "@/store";
import { storeToRefs } from "pinia";
import { Button } from "@/components/ui/button";
import { watch, ref } from "vue";

const userStore = useUserStore();
const stateStore = useStateStore();

const { uid } = storeToRefs(userStore);
const { chatFontSize } = storeToRefs(stateStore);

const chatFontSizeLocalStorageUid = uid.value ? `chatFontSize-${uid.value}` : "chatFontSize";

const fontSizes = {
    small: 14,
    medium: 16,
    large: 20,
};

const sizeLabels = {
    small: "小",
    medium: "中",
    large: "大",
};

const updateFontSize = (size) => {
    selectedSize.value = size;
    chatFontSize.value = fontSizes[size];
    localStorage.setItem(chatFontSizeLocalStorageUid, chatFontSize.value);
};

const selectedSize = ref(
    Object.entries(fontSizes).find(([, value]) => value == localStorage.getItem(chatFontSizeLocalStorageUid))?.[0] ||
        "medium"
);

watch(
    () => chatFontSize.value,
    (newVal) => {
        localStorage.setItem(chatFontSizeLocalStorageUid, newVal);
    }
);
</script>

<template>
    <div>
        <h3 class="mb-2 text-sm font-medium">調整聊天室文字大小</h3>
        <div class="flex space-x-2">
            <Button
                v-for="size in ['small', 'medium', 'large']"
                :key="size"
                @click="updateFontSize(size)"
                :class="[
                    'transition-colors duration-200',
                    selectedSize === size
                        ? 'border-[color:var(--text-color)] border-2 bg-[color:var(--primary-color)] text-[color:var(--text-color)] hover:bg-[color:var(--primary-color)]'
                        : 'bg-[color:var(--tertiary-color)] text-[color:var(--text-color)] hover:bg-[color:var(--primary-color)]',
                ]"
            >
                {{ sizeLabels[size] }}
            </Button>
        </div>
    </div>
</template>
