<script setup>
import { ref, onUnmounted } from "vue";
import { useRouter } from "vue-router";

const props = defineProps({
    height: {
        type: String,
        default: "3px",
    },
    color: {
        type: String,
        default: "#3498db",
    },
});

const progress = ref(0);
const show = ref(false);
const timer = ref(null);

const start = () => {
    show.value = true;
    progress.value = 0;

    timer.value = setInterval(() => {
        if (progress.value < 90) {
            progress.value += (100 - progress.value) * 0.2;
        }
    }, 200);
};

const finish = () => {
    progress.value = 100;
    setTimeout(() => {
        show.value = false;
        progress.value = 0;
        if (timer.value) {
            clearInterval(timer.value);
            timer.value = null;
        }
    }, 300);
};

const router = useRouter();

router.beforeEach((to, from, next) => {
    // 啟動進度條
    start();
    next();
});

router.afterEach(() => {
    // 完成進度條
    finish();
});

onUnmounted(() => {
    if (timer.value) {
        clearInterval(timer.value);
    }
});
</script>

<template>
    <div v-show="show" class="progress-bar-container" :style="{ height: props.height }">
        <div
            class="progress-bar"
            :style="{
                width: `${progress}%`,
                height: props.height,
                backgroundColor: props.color,
            }"
        ></div>
    </div>
</template>

<style scoped>
.progress-bar-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background-color: transparent;
    z-index: 9999;
}

.progress-bar {
    transition: width 0.2s ease, opacity 0.6s ease;
}
</style>
