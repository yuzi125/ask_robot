<script setup>
import MessageStatsCard from "./MessageStatsCard.vue";
import MessageStatChart from "@/components/avagpt/overview/MessageStatChart.vue";

defineProps({
    statistics: {
        type: Array,
        default: () => [],
    },
    isPlaceholderData: {
        type: Boolean,
        default: false,
    },
});

defineEmits(["refresh"]);
</script>

<template>
    <div class="message-stats">
        <MessageStatsCard :statistics="statistics" :isPlaceholderData="isPlaceholderData" />
        <div class="mt-4 mb-4">
            <MessageStatChart
                :statistics="statistics"
                :isPlaceholderData="isPlaceholderData"
                @refresh="$emit('refresh')"
            />
        </div>
    </div>
</template>

<style scoped>
.message-stats {
    width: 100%;
}
</style>
