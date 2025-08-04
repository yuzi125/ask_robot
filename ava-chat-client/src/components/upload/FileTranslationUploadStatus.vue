<script setup>
import { FileUp, Loader, Check, FileCheck, AlertTriangle } from "lucide-vue-next";
import { Card, CardContent } from "@/components/ui/card";

// 可自訂的屬性
const props = defineProps({
    message: {
        type: String,
        default: "檔案上傳成功，完成後將會通知您！",
    },
    isCompleted: {
        type: Boolean,
        default: false,
    },
    isFailed: {
        type: Boolean,
        default: false,
    },
    completedMessage: {
        type: String,
        default: "翻譯已完成，您可以查看結果了！",
    },
    failedMessage: {
        type: String,
        default: "檔案處理失敗，請檢查文件格式或稍後再試。",
    },
});
</script>

<template>
    <Card class="translation-card text-[var(--chatbox-robot-text-color)] bg-[var(--chatbox-robot-bg-color)]">
        <CardContent class="card-inner">
            <div class="content-wrapper">
                <!-- 圖標容器 -->
                <div class="icon-container">
                    <div
                        class="icon-background"
                        :class="{
                            completed: isCompleted && !isFailed,
                            failed: isFailed,
                        }"
                    >
                        <FileUp v-if="!isCompleted && !isFailed" class="upload-icon" />
                        <FileCheck v-else-if="isCompleted && !isFailed" class="upload-icon" />
                        <AlertTriangle v-else-if="isFailed" class="upload-icon" />
                    </div>
                </div>

                <div class="info-container">
                    <!-- 根據狀態顯示不同訊息 -->
                    <div class="message-text" :class="{ 'text-error': isFailed }">
                        <template v-if="isFailed">{{ failedMessage }}</template>
                        <template v-else>{{ isCompleted ? completedMessage : props.message }}</template>
                    </div>

                    <!-- 進行中顯示進度指示器 -->
                    <div v-if="!isCompleted && !isFailed" class="progress-container">
                        <div class="progress-track">
                            <div class="progress-indicator"></div>
                        </div>

                        <div class="status-text">
                            <Loader class="loading-spinner" />
                            <span>正在處理中</span>
                        </div>
                    </div>

                    <!-- 完成狀態 -->
                    <div v-else-if="isCompleted && !isFailed" class="completion-container">
                        <div class="success-indicator">
                            <Check class="check-icon" />
                            <span>處理完成</span>
                        </div>
                    </div>

                    <!-- 失敗狀態 -->
                    <div v-else-if="isFailed" class="failed-container">
                        <div class="failed-indicator">
                            <AlertTriangle class="failed-icon" />
                            <span>處理失敗</span>
                        </div>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</template>

<style scoped>
.translation-card {
    width: 100%;
    max-width: 28rem;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    overflow: hidden;
}

.card-inner {
    padding: 1rem;
}

.content-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
}

.icon-container {
    flex-shrink: 0;
}

.icon-background {
    width: 2.75rem;
    height: 2.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: linear-gradient(135deg, hsl(var(--primary) / 0.8), hsl(var(--primary) / 0.6));
    box-shadow: 0 2px 10px hsl(var(--primary) / 0.2);
    transition: all 0.3s ease;
}

.icon-background.completed {
    background: linear-gradient(135deg, hsl(142, 72%, 29%), hsl(142, 76%, 36%));
}

.icon-background.failed {
    background: linear-gradient(135deg, hsl(0, 72%, 51%), hsl(0, 76%, 40%));
}

.upload-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: white;
}

.info-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.message-text {
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.4;
}

.text-error {
    color: hsl(var(--destructive));
}

/* 進行中狀態樣式 */
.progress-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.progress-track {
    width: 100%;
    height: 0.3rem;
    background-color: hsl(var(--primary) / 0.1);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
}

.progress-indicator {
    position: absolute;
    height: 100%;
    width: 30%;
    border-radius: 999px;
    background: linear-gradient(90deg, hsl(var(--primary) / 0.7), hsl(var(--primary) / 0.9));
    animation: loading 1.5s infinite;
    background-size: 200% 100%;
}

.status-text {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: hsl(var(--muted-foreground));
}

.loading-spinner {
    width: 0.9rem;
    height: 0.9rem;
    color: hsl(var(--primary));
    animation: spin 1.2s linear infinite;
}

/* 完成狀態樣式 */
.completion-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.success-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: hsl(142, 72%, 29%);
    font-weight: 500;
}

.check-icon {
    width: 0.9rem;
    height: 0.9rem;
}

/* 失敗狀態樣式 */
.failed-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.failed-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: hsl(var(--destructive));
    font-weight: 500;
}

.failed-icon {
    width: 0.9rem;
    height: 0.9rem;
}

@keyframes loading {
    0% {
        left: -30%;
    }
    100% {
        left: 100%;
    }
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}
</style>
