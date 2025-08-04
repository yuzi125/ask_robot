<script setup>
import { ref, watch } from "vue";
import { formatNumber } from "@/utils/common";

const props = defineProps({
    style: {
        type: Object,
        default: () => ({}),
    },
    number: {
        required: true,
    },
});

const displayNumber = ref(0);
const animationStartTime = ref(0);
const startValue = ref(0);

function animateNumber(newValue) {
    startValue.value = displayNumber.value;
    animationStartTime.value = Date.now();

    function animate() {
        const currentTime = Date.now();
        const progress = Math.min((currentTime - animationStartTime.value) / 1500, 1);

        // 使用 easeOutQuad 緩動函數
        const easeProgress = 1 - (1 - progress) * (1 - progress);

        displayNumber.value = Math.round(startValue.value + (newValue - startValue.value) * easeProgress);
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            displayNumber.value = newValue;
        }
    }

    animate();
}

watch(
    () => props.number,
    (newValue, oldValue) => {
        if (newValue && newValue !== oldValue) {
            animateNumber(newValue);
        } else {
            displayNumber.value = newValue;
        }
    },
    { immediate: true }
);

if (props.number) {
    animateNumber(props.number); // 初始化時也執行動畫
}

function invalidNumber(number) {
    return isNaN(number) || number === null || number === undefined;
}
</script>

<template>
    <v-tooltip :text="invalidNumber(props.number) ? '--' : props.number.toString()">
        <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" :style="style">
                {{ invalidNumber(displayNumber) ? "--" : formatNumber(displayNumber) }}
            </span>
        </template>
    </v-tooltip>
</template>
