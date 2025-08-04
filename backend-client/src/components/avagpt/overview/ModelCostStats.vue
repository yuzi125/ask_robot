<script setup>
import { ref, inject } from "vue";

import ModelCostCard from "./ModelCostCard.vue";
import ModelCostChart from "./ModelCostChart.vue";
import ModelStatsTable from "./ModelStatsTable.vue";

// 接收父元件傳入的統計數據和加載狀態
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

// 定義 emit 事件，用於觸發刷新
defineEmits(["refresh"]);

// 圖表類型
const chartType = ref("line"); // 'line' 或 'bar'

// 更新圖表類型
const updateChartType = (type) => {
    chartType.value = type;
};
</script>

<template>
    <div class="token-stats">
        <ModelCostCard :stats="statistics" :isPlaceholderData="isPlaceholderData" />
        <div class="mt-4 mb-4">
            <ModelCostChart
                :chartData="statistics"
                :chartType="chartType"
                :isPlaceholderData="isPlaceholderData"
                @update-chart-type="updateChartType"
                @refresh="$emit('refresh')"
            />
        </div>
        <div class="mt-4 mb-4">
            <ModelStatsTable :tableData="statistics" />
        </div>
    </div>
</template>

<style scoped>
.token-stats {
    width: 100%;
}
</style>
