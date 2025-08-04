<script setup>
import { ref, onUnmounted, watch } from "vue";

import { useRouter } from "vue-router";
const router = useRouter();

import { useSystemStore } from "../store/index";
import { storeToRefs } from "pinia";
const systemStore = useSystemStore();
const { restrictionTime } = storeToRefs(systemStore);

import axios from "../global/axios";

// 檢查限制狀態
const isRestricted = ref(true);
async function checkRestricted() {
    const response = await axios.get("/system/checkConnection");
    if (response && response.status === 200) {
        router.push("/");
    }
}
checkRestricted();

// 倒數計時器
const interval = ref(null);
const remainingTime = ref("");
function updateRemainingTime() {
    const now = new Date();
    const diff = new Date(restrictionTime.value) - now;

    if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        remainingTime.value = `${days}日 ${hours}時 ${minutes}分 ${seconds}秒`;
    } else {
        checkRestricted();
        interval.value && clearInterval(interval.value);
    }
}

onUnmounted(() => {
    interval.value && clearInterval(interval.value);
});

// 切換內容開關(點擊6次後切換) -- 目前以簡易顯示為主，詳細顯示先隱藏起來。
const isDetailContent = ref(false);
const clickCount = ref(0);
watch(clickCount, (newVal) => {
    if (newVal >= 6) {
        isDetailContent.value = !isDetailContent.value;
        clickCount.value = 0;
    }
});

watch(isDetailContent, (newVal) => {
    if (newVal && !interval.value) {
        interval.value = setInterval(updateRemainingTime, 1000);
    } else {
        interval.value && clearInterval(interval.value);
    }
});
</script>

<template>
    <div class="wrapper">
        <div class="content">
            <img class="swing" src="../../public/robot.png" alt="logo" @click="clickCount++" />
            <p v-if="!isDetailContent" class="error-code">錯誤代碼 430</p>
            <div v-else>
                <div v-if="restrictionTime" class="text-container">
                    <p class="text">暫時無法使用本服務</p>
                    <p class="text">您目前為禁用中，請待禁用時間結束後再使用本系統。</p>
                    <p v-if="isRestricted" class="text">剩餘時間：{{ remainingTime }}</p>
                    <p v-else class="text">已解除封鎖, 準備回到首頁...</p>
                </div>
                <div v-else class="text-container">
                    <p class="text">無法使用本服務</p>
                    <p class="text">您目前為禁用中，如需使用本系統，請聯絡管理員。</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.wrapper {
    background-color: gray;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    position: relative;
}

.content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background-color: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.1), inset 0 -2px 5px rgba(0, 0, 0, 0.05);
    transform: translateY(-4px) perspective(1000px) rotateX(2deg);
    transition: all 0.3s ease;
    border: 1px solid rgba(0, 0, 0, 0.1);
}

.text-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
}

.text {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--input-text-color);
}

@keyframes swing {
    0% {
        transform: rotate(-10deg);
    }
    50% {
        transform: rotate(10deg);
    }
    100% {
        transform: rotate(-10deg);
    }
}

.swing {
    width: 5rem;
    height: 5rem;
    display: inline-block;
    animation: swing 2s ease-in-out infinite;
}

.error-code {
    font-size: 2rem;
    font-weight: bold;
    color: red;
    user-select: none;
}
</style>
