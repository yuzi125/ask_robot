<script setup>
import { ref, watch, onMounted } from "vue";
import { useApiStatusStore } from "@/store/index"; // 引入 Pinia store
import kh from "@/assets/kh.png";
import robot from "@/assets/robot.png"; // 新增引入 ava_logo

// 根據環境變數決定要使用的圖片，預設使用 ava
const isKH = import.meta.env.VITE_APP_TYPE === 'kh';
const logoImage = isKH ? kh : robot;
const logoAlt = isKH ? '高雄市政府' : 'AVA Logo';
const title = isKH ? '高市府智能客服' : 'AVA 智能助理';
const footer = isKH ? 'from 高雄市政府' : '';

const isVisible = ref(true);
const emit = defineEmits(["enter"]);

const apiStatusStore = useApiStatusStore();

// 監聽所有 API 是否完成
watch(
    () => apiStatusStore.allRequestsCompleted,
    (newVal) => {
        if (newVal) {
            isVisible.value = false;
            // 等待淡出動畫結束後再觸發 enter 事件
            setTimeout(() => {
                emit("enter");
            }, 500); // 與淡出動畫時間一致
        }
    }
);

onMounted(() => {
    const titleElement = document.querySelector('title');
    if (titleElement) {
        titleElement.textContent = '智能客服';
    }    
    // 10 秒後強制完成
    setTimeout(() => {
        if (!apiStatusStore.allRequestsCompleted) {
            apiStatusStore.forceComplete();
        }
    }, 10000); // 10 秒時間限制
});
</script>

<template>
    <transition name="fade">
        <div v-if="isVisible" class="banner-container">
            <div class="absolute inset-0 flex items-center justify-center">
                <div class="flex flex-col items-center justify-center relative">
                    <div class="skeleton-image-container">
                        <img :src="logoImage" :alt="logoAlt" class="skeleton-image" />
                    </div>

                    <!-- 標題 -->
                    <h2 class="text-3xl font-bold text-black mt-6">{{ title }}</h2>

                    <!-- Footer -->
                    <p class="text-sm text-gray-500 mt-4">{{ footer }}</p>
                </div>
            </div>
        </div>
    </transition>
</template>

<style scoped>
.banner-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: white;
    z-index: 99999;
    display: flex;
    justify-content: center;
    align-items: center;
}

.skeleton-image-container {
    position: relative;
    width: 100px; /* 與圖片寬度一致 */
    height: 119px; /* 與圖片高度一致 */
    overflow: hidden;
}

/* 發光效果圖片 */
.skeleton-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: shimmer 2s infinite; /* 時間延長至 4 秒 */
}

/* 發光效果動畫 */
@keyframes shimmer {
    0% {
        filter: brightness(0.9);
    }
    20% {
        filter: brightness(1);
    }
    50% {
        filter: brightness(1.1);
    }
    80% {
        filter: brightness(1);
    }
    100% {
        filter: brightness(0.9);
    }
}

/* 淡入淡出過渡效果 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
