<script setup>
import { ref, onMounted, onUnmounted, watch, computed, inject } from "vue";
import * as echarts from "echarts";
import { useStorage } from "@vueuse/core";

const props = defineProps({
    tableData: {
        type: Array,
        default: () => [],
    },
});

let chart = null;
const isExpanded = ref(true);
const isDarkTheme = useStorage("token-cost-percent-theme", false);

const search = ref("");
const headers = [
    {
        align: "start",
        key: "modelName",
        sortable: false,
        title: "模型名稱",
    },
    { key: "count", title: "使用次數" },
    { key: "tokens", title: "Tokens" },
    { key: "cost", title: "費用" },
    { key: "percent", title: "百分比" },
];

// 切換展開狀態
const toggleExpand = () => {
    isExpanded.value = !isExpanded.value;
    // 給圖表一點時間進行動畫後再重新調整大小
    if (isExpanded.value) {
        setTimeout(() => {
            chart?.resize();
        }, 300);
    }
};

// 切換主題
const toggleTheme = () => {
    isDarkTheme.value = !isDarkTheme.value;
};

// 計算摘要統計數據
const summaryStats = computed(() => {
    if (!props.tableData || props.tableData.length === 0) {
        return {
            topModels: [],
        };
    }

    // 統計每個模型的總使用量
    const modelStats = {};
    props.tableData.forEach((day) => {
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
    const models = Object.entries(modelStats)
        .map(([model, stats]) => ({
            modelName: model,
            cost: stats.cost,
            tokens: stats.tokens,
            count: stats.count,
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

    // 計算總費用
    const totalCost = models.reduce((sum, model) => sum + model.cost, 0);
    const topModels = models.map((model) => ({
        modelName: model.modelName,
        cost: model.cost,
        tokens: model.tokens,
        count: model.count,
        percent: totalCost > 0 ? (model.cost / totalCost) * 100 : 0,
    }));

    console.log("models", models);
    console.log("topModels", topModels);

    return {
        topModels,
    };
});

// 千分位
const formatNumber = (num) => {
    if (typeof num !== "number") return num;
    return num.toLocaleString("en-US");
};

// 取得模型顏色 - 使用漸進式藍色系
const getModelColor = (percent) => {
    if (percent >= 50) return "indigo";
    if (percent >= 30) return "blue";
    if (percent >= 15) return "light-blue";
    if (percent >= 5) return "cyan";
    return "teal";
};

// 只讓 model 欄位能被搜尋
// :custom-key-filter="{ modelName: modelKeyFilter }"
// const modelKeyFilter = (value, search) => {
//     console.log("filter", value, search);
//     if (!search) return true;
//     if (value === undefined || value === null) return false;
//     return String(value).toLowerCase().includes(search.toLowerCase());
// };

// 監聽數據變化
watch(
    () => summaryStats.value,
    () => {
        console.log("watch summaryStats.value", summaryStats.value);
    },
    { immediate: true }
);

// 元件掛載時
onMounted(() => {});
</script>

<template>
    <v-card class="percent-card" :class="{ 'bg-black': isDarkTheme }" elevation="0">
        <v-card-title class="px-4 py-2 d-flex align-center" :class="{ 'text-white': isDarkTheme }">
            <div class="d-flex align-center" @click="toggleExpand" style="cursor: pointer">
                <v-icon
                    :icon="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                    size="small"
                    class="mr-2"
                    color="grey"
                    :class="{ 'rotate-icon': isExpanded }"
                />
                模型費用分佈
            </div>
            <v-spacer />

            <!-- 主題切換按鈕 -->
            <v-btn
                icon
                size="small"
                variant="text"
                :color="isDarkTheme ? 'grey-lighten-1' : 'grey'"
                class="mr-2"
                @click="toggleTheme"
            >
                <v-icon>
                    {{ isDarkTheme ? "mdi-white-balance-sunny" : "mdi-moon-waning-crescent" }}
                </v-icon>
            </v-btn>
            <span class="text-caption" :class="isDarkTheme ? 'text-grey' : 'text-grey-darken-1'"> AVA-GPT </span>
        </v-card-title>

        <v-expand-transition>
            <div v-show="isExpanded">
                <v-card-text class="pa-0">
                    <!-- table - Data and Display -->
                    <v-card flat :class="{ 'bg-black text-white': isDarkTheme }">
                        <template v-slot:text>
                            <v-text-field
                                v-model="search"
                                label="搜尋模型名稱"
                                prepend-inner-icon="mdi-magnify"
                                variant="outlined"
                                hide-details
                            ></v-text-field>
                        </template>

                        <v-data-table
                            :class="{ 'bg-black text-white': isDarkTheme }"
                            :headers="headers"
                            :items="summaryStats.topModels"
                            :search="search"
                        >
                            <template v-slot:item.count="{ item }">
                                <span>{{ formatNumber(item.count) }}</span>
                            </template>

                            <template v-slot:item.tokens="{ item }">
                                <span>{{ formatNumber(item.tokens) }}</span>
                            </template>

                            <template v-slot:item.cost="{ item }">
                                <span>{{ `$${formatNumber(Number(item.cost.toFixed(3)))}` }}</span>
                            </template>

                            <template v-slot:item.percent="{ item }">
                                <v-tooltip location="top">
                                    <template #activator="{ props }">
                                        <v-progress-linear
                                            v-bind="props"
                                            :model-value="item.percent"
                                            height="8"
                                            rounded
                                            :color="getModelColor(item.percent)"
                                        ></v-progress-linear>
                                    </template>
                                    <span> {{ item.percent.toFixed(1) }}% </span>
                                </v-tooltip>
                            </template>
                        </v-data-table>
                    </v-card>
                </v-card-text>
            </div>
        </v-expand-transition>
    </v-card>
</template>

<style scoped>
.percent-card {
    border-radius: 8px;
    overflow: hidden;
    transition: box-shadow 0.2s;
    border: v-bind('isDarkTheme ? "none" : "1px solid #e0e0e0"');
}

.rotate-icon {
    transition: transform 0.3s ease;
}

:deep(.v-table) {
    thead {
        th {
            vertical-align: middle;
        }
    }

    tr {
        td {
            vertical-align: middle;
        }
    }
}

:deep(.v-data-table thead tr:hover),
:deep(.v-table thead tr:hover),
:deep(.v-data-table thead th:hover),
:deep(.v-table thead th:hover) {
    background-color: inherit !important;
    color: inherit !important;
}
</style>
