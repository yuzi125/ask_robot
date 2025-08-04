<script setup>
import { ref, inject, onMounted, computed, onUnmounted } from "vue";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-vue-next";

const emitter = inject("emitter");
const isVisible = ref(false);
const isLoading = ref(false);

const buttonText = computed(() => {
    if (isLoading.value) return "正在載入訊息...";
    return "返回較新訊息";
});

onMounted(() => {
    emitter.on("updateSlideBottomStatus", (shouldShow) => {
        isVisible.value = shouldShow;
    });
    emitter.on("updateLoadingStatus", (loading) => {
        isLoading.value = loading;
    });
});

function slideBottom() {
    emitter.emit("loadNewerHistory");
}

onUnmounted(() => {
    emitter.off("updateSlideBottomStatus");
    emitter.off("updateLoadingStatus");
});
</script>

<template>
    <Transition name="fade">
        <div v-if="isVisible" class="flex justify-center mt-4 mb-4">
            <Button
                variant="secondary"
                size="sm"
                class="rounded-full shadow-md text-[color:var(--text-color)] bg-[color:var(--secondary-color)] hover:bg-[color:var(--tertiary-color)]"
                @click="slideBottom"
                :disabled="isLoading"
            >
                <ChevronDown class="w-4 h-4 mr-2" />
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
</style>
