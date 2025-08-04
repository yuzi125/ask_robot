<script setup>
import { ref, watch, onMounted } from "vue";
import { Button } from "@/components/ui/button";
import { useStateStore, useUserStore } from "@/store";
import { storeToRefs } from "pinia";

const userStore = useUserStore();
const stateStore = useStateStore();

const { chatZoom } = storeToRefs(stateStore);
const { uid } = storeToRefs(userStore);

// 根據是否登入，設定 localStorage 的鍵名
const chatZoomLocalStorageUid = uid.value ? `chatZoom-${uid.value}` : "chatZoom";

// 定義縮放比例對應的百分比
const zoomSizes = {
    small: 90,
    medium: 100,
    large: 110,
};

// 定義縮放選項的標籤
const sizeLabels = {
    small: "小",
    medium: "中",
    large: "大",
};

// 初始化 chatZoom
if (localStorage.getItem(chatZoomLocalStorageUid)) {
    chatZoom.value = Number(localStorage.getItem(chatZoomLocalStorageUid));
}

// 根據當前的 chatZoom 值，設定預設選中的縮放選項
const selectedSize = ref(Object.entries(zoomSizes).find(([, value]) => value === chatZoom.value)?.[0] || "medium");

// 更新縮放比例的函數
const updateZoom = (size) => {
    selectedSize.value = size;
    chatZoom.value = zoomSizes[size];
    localStorage.setItem(chatZoomLocalStorageUid, chatZoom.value);
    applyZoom();
};

// 應用縮放效果的函數
const applyZoom = () => {
    const scaleContainer = document.querySelector(".scale-container");
    if (scaleContainer) {
        const scale = chatZoom.value / 100;
        scaleContainer.style.transform = `scale(${scale})`;
        scaleContainer.style.transformOrigin = "top left";
        scaleContainer.style.width = `${100 / scale}%`;
        scaleContainer.style.height = `${100 / scale}%`;
    }
};

// 監聽 chatZoom 的變化，並立即應用縮放效果
watch(
    () => chatZoom.value,
    () => {
        localStorage.setItem(chatZoomLocalStorageUid, chatZoom.value);
        applyZoom();
    },
    { immediate: true }
);

// 在元件掛載後，應用初始的縮放效果
onMounted(() => {
    applyZoom();
});
</script>

<template>
    <div>
        <h3 class="mb-2 text-sm font-medium">調整聊天室比例</h3>
        <div class="flex space-x-2">
            <Button
                v-for="size in ['small', 'medium', 'large']"
                :key="size"
                @click="updateZoom(size)"
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
