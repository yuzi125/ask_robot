<script setup>
import { useIntersectionObserver } from "@vueuse/core";
import { ref, watch, defineProps, nextTick } from "vue";

// 使用 defineProps 接收從父元件傳遞的 messages 和 virtualRows
const props = defineProps({
    messages: {
        type: Array,
        required: true
    },
    virtualRows: {
        type: Array,
        required: true
    }
});

const visibleMessageIndex = ref(-1);

const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diff = todayStart - dateStart;
    
    const daysOfWeek = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const dayOfWeek = daysOfWeek[date.getDay()];

    if (diff === 0) {
        return { label: '今天', isShort: true };
    } else if (diff === 86400000) { // 1天的毫秒數
        return { label: '昨天', isShort: true };
    }
    
    return { label: `${date.getMonth() + 1}月${date.getDate()}日 ${dayOfWeek}`, isShort: false };
};

const setupIntersectionObservers = () => {
    const container = document.querySelectorAll('.msgBox');

    if (container.length === 0) {
        // console.error('No .msgBox elements found');
        return;
    }

    container.forEach((msgBox, index) => {
        useIntersectionObserver(
            msgBox,
            ([{ isIntersecting, boundingClientRect }]) => {
                if (isIntersecting && boundingClientRect.top > 20 ) {
                    visibleMessageIndex.value = index;
                }
            },
            { threshold: 0.68 }
        );
    });
};

watch(() => props.messages, async () => {
    await nextTick();
    setupIntersectionObservers();
}, { immediate: true });
</script>

<template>
    <div 
        v-if="visibleMessageIndex !== -1 && props.messages?.[props.virtualRows?.[visibleMessageIndex]?.index]?.time" 
        class="fixed-date-label"
        :style="{ maxWidth: formatDate(props.messages[props.virtualRows[visibleMessageIndex].index]?.time).isShort ? '3.4rem' : '7.9rem' }"
    >
        {{ formatDate(props.messages[props.virtualRows[visibleMessageIndex].index]?.time).label }}
    </div>
</template>

<style lang="scss" scoped>
.fixed-date-label {
    position: absolute;
    user-select: none;
    top: 4.3rem;
    right: 0;
    left: 0;
    margin: 0 auto;
    text-align: center;
    padding: 0.4rem 0.3rem;
    max-width: 3.4rem;
    font-weight: bold;


    background-color: black;
    color:white;
    // background-color: var(--navbar-bg-color);
    // color: var(--navbar-text-color);
    box-shadow: 0px 0.5px 1px 1px rgba(255, 255, 255, 0.25);
    border-radius: 1rem;
    z-index: 10000;
}
</style>
