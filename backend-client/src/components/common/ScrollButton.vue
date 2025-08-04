<script setup>
import { ref, computed, onUnmounted, watchEffect, watch } from "vue";

const props = defineProps(["targetDOM", "position", "scrollTopKey"]);

const scrollTop = ref(0); // 現在DOM頂端位於內容的垂直高度
const scrollHeight = ref(0); // 內容總高度
const clientHeight = ref(0); // 可視DOM高度

const isAtTop = computed(() => scrollTop.value === 0);
const isAtBottom = computed(() => {
    if (scrollHeight.value && clientHeight.value) {
        return scrollTop.value + clientHeight.value + 10 >= scrollHeight.value;
    } else {
        return false;
    }
});

// 滾動方法
function scrollToTop() {
    props.targetDOM.scrollTo({
        top: 0,
        behavior: "smooth",
    });
}

function scrollToBottom() {
    props.targetDOM.scrollTo({
        top: props.targetDOM.scrollHeight,
        behavior: "smooth",
    });
}

function handleScroll() {
    scrollTop.value = props.targetDOM.scrollTop;
    scrollHeight.value = props.targetDOM.scrollHeight;
    clientHeight.value = props.targetDOM.clientHeight;
}

// 監聽DOM的滾動事件
let isAddListener = false;
let isAddResizeObserver = false;
const resizeObserver = new ResizeObserver(() => {
    scrollTop.value = props.targetDOM.scrollTop;
    scrollHeight.value = props.targetDOM.scrollHeight;
    clientHeight.value = props.targetDOM.clientHeight;
});
watchEffect(() => {
    if (props.targetDOM && !isAddListener) {
        props.targetDOM.addEventListener("scroll", handleScroll);
        isAddListener = true;
    }
    if (props.targetDOM && !isAddResizeObserver) {
        resizeObserver.observe(props.targetDOM);
        isAddResizeObserver = true;
    }
});
onUnmounted(() => {
    // 移除監聽器
    props.targetDOM.removeEventListener("scroll", handleScroll);
    isAddListener = false;
    resizeObserver.unobserve(props.targetDOM);
    isAddResizeObserver = false;
});

// 偵測scrollTopKey是否有變動，有就會滾動到上方
watch(
    () => props.scrollTopKey,
    () => {
        scrollToTop();
    }
);
</script>

<template>
    <div class="scrollButtonsContainer" :style="props.position">
        <div class="w-50">
            <v-fab
                class="btn"
                :class="isAtTop ? '' : 'btn-show'"
                color="primary"
                icon="fa-solid fa-chevron-up"
                variant="tonal"
                @click="scrollToTop()"
            ></v-fab>
        </div>
        <div class="w-50">
            <v-fab
                class="btn"
                :class="isAtBottom ? '' : 'btn-show'"
                color="primary"
                icon="fa-solid fa-chevron-down"
                variant="tonal"
                @click="scrollToBottom()"
            ></v-fab>
        </div>
    </div>
</template>

<style setup>
.scrollButtonsContainer {
    width: 100px;
    display: flex;
    gap: 12px;
    position: absolute;
    .btn {
        transition: all 0.3s ease-in-out;
        opacity: 0;
        transform: translateY(30px);
    }
    .btn-show {
        opacity: 1;
        transform: translateY(0px);
    }
}
</style>
