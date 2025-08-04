<script setup>
import { defineProps, inject } from "vue";
import { Lock, ShieldAlert, AlertCircle, RefreshCw } from "lucide-vue-next";

const emitter = inject("emitter");

const props = defineProps({
    message: {
        type: String,
        default: "目前沒有可用的專家",
    },
    showButton: {
        type: Boolean,
        default: true,
    },
    iconType: {
        type: String,
        default: "lock", // 'lock', 'shield', 'alert'
    },
});

const isKH = import.meta.env.VITE_APP_TYPE === "kh";
const title = isKH ? "權限不足" : "權限不足"; // 看到時候需不需要換
// const subtitle = isKH ? "高市府智能客服" : "AVA 智能助理";

const handleRetry = () => {
    emitter.emit("retryGetContactList");
};

// 根據 props 選擇要顯示的圖標
const getIcon = () => {
    switch (props.iconType) {
        case "shield":
            return ShieldAlert;
        case "alert":
            return AlertCircle;
        case "lock":
        default:
            return Lock;
    }
};

const IconComponent = getIcon();

const isIframe = window !== window.parent;
</script>

<template>
    <Teleport to="body">
        <div class="fullscreen-banner">
            <div class="container">
                <!-- 圖標容器 -->
                <div class="icon-wrapper">
                    <div class="icon-container">
                        <component :is="IconComponent" class="icon" />
                    </div>
                </div>

                <!-- 文字內容 -->
                <div class="content-container">
                    <!-- 標題 -->
                    <h2 class="title">{{ title }}</h2>

                    <!-- 訊息 -->
                    <div class="message-box">
                        <p class="message">{{ props.message }}</p>
                    </div>
                </div>

                <!-- 重試按鈕 -->
                <button v-if="props.showButton && !isIframe" @click="handleRetry" class="retry-button">
                    <RefreshCw size="18" class="mr-2" />
                    重新嘗試
                </button>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.fullscreen-banner {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #ffffff;
    z-index: 100000;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
}

.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    max-width: 480px;
    padding: 2rem;
    text-align: center;
}

.icon-wrapper {
    margin-bottom: 2.5rem;
    position: relative;
}

.icon-wrapper::after {
    content: "";
    position: absolute;
    width: 140px;
    height: 140px;
    background: rgba(239, 68, 68, 0.05);
    border-radius: 50%;
    z-index: -1;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.icon-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background-color: rgba(239, 68, 68, 0.1);
    animation: pulse 2.5s infinite ease-in-out;
    box-shadow: 0 0 0 15px rgba(239, 68, 68, 0.05);
}

.icon {
    width: 45px;
    height: 45px;
    color: #ef4444;
}

.content-container {
    margin-bottom: 2rem;
    width: 100%;
}

.title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 1.5rem;
}

.message-box {
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    width: 100%;
}

.message {
    color: #4b5563;
    font-size: 1rem;
    line-height: 1.5;
}

.retry-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #ef4444;
    color: white;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
}

.retry-button:hover {
    background-color: #dc2626;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(239, 68, 68, 0.25);
}

.retry-button:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(239, 68, 68, 0.2);
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3);
    }
    70% {
        box-shadow: 0 0 0 15px rgba(239, 68, 68, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
    }
}

@media (max-width: 640px) {
    .container {
        padding: 1.5rem;
    }

    .icon-container {
        width: 90px;
        height: 90px;
    }

    .icon {
        width: 35px;
        height: 35px;
    }

    .title {
        font-size: 1.5rem;
    }

    .subtitle {
        font-size: 1rem;
    }
}
</style>
