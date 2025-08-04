<script setup>
import { ref, inject, onMounted, computed, onUnmounted } from "vue";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-vue-next";
import { useStateStore } from "@/store/index";
import { storeToRefs } from "pinia";

const stateStore = useStateStore();
const emitter = inject("emitter");
const isVisible = ref(false);
const isLoading = ref(false);

const buttonText = computed(() => {
    if (isLoading.value) return "正在載入訊息...";
    return `查看歷史訊息`;
});

onMounted(() => {
    emitter.on("updateSlideTopStatus", (shouldShow) => {
        isVisible.value = shouldShow;
    });
    emitter.on("updateLoadingStatus", (loading) => {
        isLoading.value = loading;
    });
});

function slideTop() {
    emitter.emit("loadMoreHistory");
}

// 清理事件監聽器
onUnmounted(() => {
    emitter.off("updateSlideTopStatus");
    emitter.off("updateLoadingStatus");
});
</script>

<template>
    <Transition name="fade">
        <div v-if="isVisible" class="slide-top">
            <Button
                variant="secondary"
                size="sm"
                class="rounded-full shadow-md text-[color:var(--text-color)] bg-[color:var(--secondary-color)] hover:bg-[color:var(--tertiary-color)]"
                @click="slideTop"
                :disabled="isLoading"
            >
                <ChevronUp class="w-4 h-4 mr-2" />
                <span>{{ buttonText }}</span>
            </Button>
        </div>
    </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 1s all;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0.2;
}

.slide-top {
    display: flex;
    justify-content: center;
    margin: 2rem 0;
}
</style>
