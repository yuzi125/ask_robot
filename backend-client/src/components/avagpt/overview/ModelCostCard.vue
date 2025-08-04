<script setup>
import { defineProps, computed } from "vue";

// 接收父組件傳入的數據
const props = defineProps({
    stats: {
        type: Array,
        default: () => [],
    },
    isPlaceholderData: {
        type: Boolean,
        default: false,
    },
});

// 計算摘要統計數據
const summaryStats = computed(() => {
    if (!props.stats || props.stats.length === 0) {
        return {
            totalCost: 0,
            totalTokens: 0,
            avgDailyCost: 0,
            peakCost: { value: 0, date: "" },
            topModels: [],
        };
    }

    // 計算總費用和總token數
    const totalCost = props.stats.reduce((sum, day) => sum + day.totalCost, 0);
    const totalTokens = props.stats.reduce((sum, day) => sum + day.totalTokens, 0);

    // 計算非零日期數量
    const nonZeroDays = props.stats.filter((day) => day.totalCost > 0).length || 1;

    // 計算平均每日費用
    const avgDailyCost = totalCost / nonZeroDays;

    // 尋找峰值費用日期
    const peakDay = props.stats.reduce(
        (max, day) => (day.totalCost > max.cost ? { cost: day.totalCost, date: day.date } : max),
        { cost: 0, date: "" }
    );

    // 統計每個模型的總使用量
    const modelStats = {};
    props.stats.forEach((day) => {
        if (day.models && Array.isArray(day.models)) {
            day.models.forEach((model) => {
                if (!modelStats[model.model]) {
                    modelStats[model.model] = {
                        cost: 0,
                        tokens: 0,
                        count: 0,
                    };
                }
                modelStats[model.model].cost += model.cost;
                modelStats[model.model].tokens += model.tokens;
                modelStats[model.model].count += model.count;
            });
        }
    });

    // 將模型統計轉換為數組並排序
    const topModels = Object.entries(modelStats)
        .map(([model, stats]) => ({
            model,
            cost: stats.cost,
            tokens: stats.tokens,
            count: stats.count,
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

    return {
        totalCost,
        totalTokens,
        avgDailyCost,
        peakCost: { value: peakDay.cost, date: peakDay.date },
        topModels,
    };
});

// 取得模型百分比（用於進度條）
const getModelPercentage = (cost) => {
    const totalCost = summaryStats.value.topModels.reduce((sum, model) => sum + model.cost, 0);
    return totalCost > 0 ? (cost / totalCost) * 100 : 0;
};

// 取得模型顏色 - 根據百分比使用漸進式藍色系
const getModelColor = (cost) => {
    const percent = getModelPercentage(cost);
    if (percent >= 50) return "indigo";
    if (percent >= 30) return "blue";
    if (percent >= 15) return "light-blue";
    if (percent >= 5) return "cyan";
    return "teal";
};

// 格式化大數字
const formatNumber = (num) => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + "M";
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + "K";
    }
    return num.toString();
};
</script>

<template>
    <div>
        <v-row>
            <v-col cols="12" sm="6" md="3">
                <v-card
                    variant="flat"
                    class="stat-card bg-blue-lighten-5"
                    :loading="isPlaceholderData"
                    :disabled="isPlaceholderData"
                    height="100%"
                >
                    <v-card-item>
                        <div class="d-flex flex-column h-100">
                            <div class="mb-1 text-subtitle-2 text-grey-darken-1 font-weight-regular">總費用 (USD)</div>
                            <div class="text-h4 font-weight-bold">${{ summaryStats.totalCost.toFixed(3) }}</div>
                            <div class="mt-1 d-flex align-center">
                                <v-icon size="small" color="grey-darken-1" class="mr-1">mdi-counter</v-icon>
                                <span class="text-grey-darken-1 text-caption">
                                    總Token: {{ formatNumber(summaryStats.totalTokens) }}
                                </span>
                            </div>
                        </div>
                    </v-card-item>
                    <template v-if="isPlaceholderData" v-slot:loader="{ isActive }">
                        <v-progress-linear :active="isActive" color="cyan" indeterminate height="4"></v-progress-linear>
                    </template>
                </v-card>
            </v-col>

            <v-col cols="12" sm="6" md="3">
                <v-card
                    variant="flat"
                    class="stat-card bg-amber-lighten-5"
                    :loading="isPlaceholderData"
                    :disabled="isPlaceholderData"
                    height="100%"
                >
                    <v-card-item>
                        <div class="d-flex flex-column h-100">
                            <div class="mb-1 text-subtitle-2 text-grey-darken-1 font-weight-regular">
                                平均每日費用 (USD)
                            </div>
                            <div class="text-h4 font-weight-bold">${{ summaryStats.avgDailyCost.toFixed(3) }}</div>
                        </div>
                    </v-card-item>
                </v-card>
            </v-col>

            <v-col cols="12" sm="6" md="3">
                <v-card
                    variant="flat"
                    class="stat-card bg-green-lighten-5"
                    :loading="isPlaceholderData"
                    :disabled="isPlaceholderData"
                    height="100%"
                >
                    <v-card-item>
                        <div class="d-flex flex-column h-100">
                            <div class="mb-1 text-subtitle-2 text-grey-darken-1 font-weight-regular">
                                峰值費用 (USD)
                            </div>
                            <div class="text-h4 font-weight-bold">${{ summaryStats.peakCost.value.toFixed(3) }}</div>
                            <div v-if="summaryStats.peakCost.date" class="mt-1 d-flex align-center">
                                <v-icon size="small" color="primary" class="mr-1">mdi-chart-bell-curve</v-icon>
                                <span class="text-grey-darken-1 text-caption">
                                    日期:
                                    <span class="font-weight-medium text-primary">{{
                                        summaryStats.peakCost.date
                                    }}</span>
                                </span>
                            </div>
                        </div>
                    </v-card-item>
                </v-card>
            </v-col>

            <v-col cols="12" sm="6" md="3">
                <v-card
                    variant="flat"
                    class="stat-card bg-purple-lighten-5"
                    :loading="isPlaceholderData"
                    :disabled="isPlaceholderData"
                    height="100%"
                >
                    <v-card-item>
                        <div class="d-flex flex-column h-100">
                            <div class="mb-1 text-subtitle-2 text-grey-darken-1 font-weight-regular">模型費用分佈</div>
                            <div class="model-distribution">
                                <div
                                    v-for="(model, index) in summaryStats.topModels.slice(0, 2)"
                                    :key="index"
                                    class="model-bar-item"
                                >
                                    <div class="model-bar-label">
                                        <v-tooltip location="top">
                                            <template #activator="{ props }">
                                                <span class="model-name text-truncate" v-bind="props">
                                                    {{ model.model || "Unknown" }}
                                                </span>
                                            </template>
                                            <span>{{ model.model || "Unknown" }}</span>
                                        </v-tooltip>

                                        <span class="model-cost"
                                            >${{ model.cost.toFixed(3) }} /
                                            {{ getModelPercentage(model.cost).toFixed(1) }}%</span
                                        >
                                    </div>
                                    <v-progress-linear
                                        :model-value="getModelPercentage(model.cost)"
                                        height="8"
                                        rounded
                                        :color="getModelColor(model.cost)"
                                    ></v-progress-linear>
                                </div>
                            </div>
                        </div>
                    </v-card-item>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
/* 統計卡片樣式 */
.stat-card {
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    height: 100%;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
}

.h-100 {
    height: 100%;
}

.v-card-item {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
}

:deep(.v-card-item__content) {
    width: 100%;
}

.model-distribution {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.model-bar-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.model-bar-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
}

.model-name {
    color: rgba(0, 0, 0, 0.6);
    max-width: 50%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.model-cost {
    color: #1976d2;
    font-weight: 500;
}

.bg-blue-lighten-5 {
    background-color: #e3f2fd !important;
    border-left: 4px solid #1e88e5;
}

.bg-amber-lighten-5 {
    background-color: #fff8e1 !important;
    border-left: 4px solid #ffb300;
}

.bg-green-lighten-5 {
    background-color: #e8f5e9 !important;
    border-left: 4px solid #43a047;
}

.bg-purple-lighten-5 {
    background-color: #f3e5f5 !important;
    border-left: 4px solid #8e24aa;
}

.text-primary {
    color: #1976d2 !important;
}

.text-success {
    color: #2e7d32 !important;
}

.text-h4 {
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
}
</style>
