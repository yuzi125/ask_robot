<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject } from "vue";
import * as echarts from "echarts";
import { useStorage } from "@vueuse/core";
import { excelIconPath, echartExportExcel, refreshIconPath } from "@/utils/echart";

const props = defineProps({
    statistics: {
        type: Array,
        default: () => [],
    },
    isPlaceholderData: {
        type: Boolean,
        default: false,
    },
    sortBy: {
        type: String,
        default: "messages",
    },
});

const emit = defineEmits(["refresh"]);
const emitter = inject("emitter");

const chartContainer = ref(null);
let chart = null;
const isExpanded = ref(true);
const isDarkTheme = useStorage("top-users-chart-theme", false);
const chartType = ref("horizontal"); // horizontal 或 vertical

const totalUsers = computed(() => {
    return props.statistics ? props.statistics.length : 0;
});

const toggleExpand = () => {
    isExpanded.value = !isExpanded.value;
    if (isExpanded.value) {
        setTimeout(() => {
            chart?.resize();
        }, 300);
    }
};

const toggleTheme = () => {
    isDarkTheme.value = !isDarkTheme.value;
    updateChart();
};

const toggleChartType = () => {
    chartType.value = chartType.value === "horizontal" ? "vertical" : "horizontal";
    updateChart();
};

// 準備 Excel 導出數據
function prepareJsonData() {
    if (!props.statistics || props.statistics.length === 0) return [];

    return props.statistics.map((user, index) => ({
        排名: user.rank,
        使用者名稱: user.userName,
        郵箱: user.userEmail,
        總訊息數: user.totalMessages,
        使用者訊息: user.userMessages,
        機器人回覆: user.botMessages,
        總花費USD: user.totalCostUSD,
        總Token數: user.totalTokens,
        排序方式: props.sortBy === "cost" ? "按花費排序" : "按訊息數排序",
    }));
}

// 處理數據
const processData = (statistics) => {
    if (!statistics || statistics.length === 0) {
        return { names: [], values: [], colors: [] };
    }

    // 反轉數據順序，讓 rank 1 在最上面/最左邊
    const reversedStatistics = [...statistics].reverse();

    const names = reversedStatistics.map((user) => user.userName);
    const values = reversedStatistics.map((user) => (props.sortBy === "cost" ? user.totalCostUSD : user.userMessages));

    // 為前三名設置特殊顏色（注意這裡的索引需要調整）
    const colors = reversedStatistics.map((user) => {
        switch (user.rank) {
            case 1:
                return "#FFD700"; // 金色
            case 2:
                return "#C0C0C0"; // 銀色
            case 3:
                return "#CD7F32"; // 銅色
            default:
                return "#2196F3"; // 藍色
        }
    });

    return { names, values, colors };
};

const updateChart = () => {
    if (!chart) return;

    const { names, values, colors } = processData(props.statistics);
    const isHorizontal = chartType.value === "horizontal";

    const option = {
        backgroundColor: isDarkTheme.value ? "#1c1c1c" : "transparent",
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: "30px",
            containLabel: true,
            width: "90%",
        },
        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: "shadow",
            },
            formatter: function (params) {
                const data = params[0];
                // 由於數據已經反轉，需要重新計算原始索引
                const reversedIndex = props.statistics.length - 1 - data.dataIndex;
                const user = props.statistics[reversedIndex];

                // 格式化費用
                const formatCost = (cost) => {
                    if (cost >= 1) {
                        return cost.toFixed(2);
                    } else if (cost >= 0.01) {
                        return cost.toFixed(4);
                    } else if (cost > 0) {
                        return cost.toFixed(6);
                    }
                    return "0.00";
                };

                const primaryValue =
                    props.sortBy === "cost"
                        ? `總花費: $${formatCost(user.totalCostUSD)}`
                        : `使用者訊息: ${user.userMessages}`;

                return `
                    <div style="font-weight: bold; margin-bottom: 4px;">#${user.rank} ${user.userName}</div>
                    <div style="color: #2196F3; font-weight: bold;">${primaryValue}</div>
                    <div>總訊息數: ${user.totalMessages}</div>
                    <div>使用者訊息: ${user.userMessages}</div>
                    <div>機器人回覆: ${user.botMessages}</div>
                    <div style="color: #4CAF50; font-weight: bold;">總花費: $${formatCost(user.totalCostUSD)}</div>
                    <div>總Token數: ${user.totalTokens?.toLocaleString() || 0}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">${user.userEmail}</div>
                `;
            },
        },
        toolbox: {
            itemGap: 10,
            right: 10,
            feature: {
                myRefresh: {
                    show: true,
                    title: "刷新資料",
                    icon: refreshIconPath(),
                    onclick: () => emit("refresh"),
                },
                // magicType: {
                //     type: ["bar"],
                //     title: "切換圖表類型",
                // },
                myExcel: {
                    show: true,
                    title: "匯出成Excel",
                    icon: excelIconPath(),
                    onclick: () =>
                        echartExportExcel(
                            prepareJsonData(),
                            `Top 10 使用者統計資料_${props.sortBy === "cost" ? "按花費排序" : "按訊息數排序"}`
                        ),
                },
            },
        },
        xAxis: {
            type: isHorizontal ? "value" : "category",
            data: isHorizontal ? null : names,
            axisLabel: {
                color: isDarkTheme.value ? "#ddd" : "#333",
                interval: 0,
                rotate: isHorizontal ? 0 : 45,
            },
            axisLine: {
                lineStyle: {
                    color: isDarkTheme.value ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.1)",
                },
            },
        },
        yAxis: {
            type: isHorizontal ? "category" : "value",
            data: isHorizontal ? names : null,
            axisLabel: {
                color: isDarkTheme.value ? "#ddd" : "#333",
            },
            splitLine: {
                lineStyle: {
                    color: isDarkTheme.value ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
                },
            },
        },
        series: [
            {
                name: props.sortBy === "cost" ? "花費 (USD)" : "訊息數",
                type: "bar",
                data: values.map((value, index) => ({
                    value,
                    itemStyle: {
                        color: colors[index],
                    },
                })),
                barWidth: "60%",
                emphasis: {
                    focus: "series",
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: "rgba(0, 0, 0, 0.5)",
                    },
                },
            },
        ],
    };

    chart.setOption(option);
};

// 監聽數據變化
watch(
    () => props.statistics,
    () => {
        if (chart) {
            updateChart();
        }
    },
    { deep: true }
);

// 初始化圖表
const initChart = () => {
    if (chartContainer.value) {
        chart = echarts.init(chartContainer.value);
        updateChart();
    }
};

// 監聽視窗大小變化
const handleResize = () => {
    chart?.resize();
};

onMounted(() => {
    initChart();
    window.addEventListener("resize", handleResize);
    emitter.on("resize", handleResize);
});

onUnmounted(() => {
    window.removeEventListener("resize", handleResize);
    emitter.off("resize", handleResize);
    chart?.dispose();
});
</script>

<template>
    <v-card class="chart-card" :color="isDarkTheme ? '#1c1c1c' : 'white'">
        <v-card-title class="px-4 py-2 d-flex align-center" :class="{ 'text-white': isDarkTheme }">
            <div class="d-flex align-center" @click="toggleExpand" style="cursor: pointer">
                <v-icon
                    :icon="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                    size="small"
                    class="mr-2"
                    color="grey"
                    :class="{ 'rotate-icon': isExpanded }"
                />
                Top 10 使用者{{ sortBy === "cost" ? "花費" : "活躍度" }}
            </div>
            <v-spacer />
            <!-- 圖表類型切換按鈕 -->
            <!-- <v-btn
                icon
                size="small"
                variant="text"
                :color="isDarkTheme ? 'grey-lighten-1' : 'grey'"
                class="mr-2"
                @click="toggleChartType"
            >
                <v-icon>
                    {{ chartType === "bar" ? "mdi-chart-bar-stacked" : "mdi-chart-bar" }}
                </v-icon>
            </v-btn> -->
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
                    <div ref="chartContainer" style="width: 100%; height: 400px" />

                    <!-- Loading overlay -->
                    <div v-if="isPlaceholderData" class="chart-loading">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                        <span class="ml-2 text-caption">載入中...</span>
                    </div>

                    <!-- No data message -->
                    <div
                        v-if="!isPlaceholderData && (!statistics || statistics.length === 0)"
                        class="justify-center d-flex align-center pa-8"
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 400px; background: white"
                    >
                        <v-alert
                            type="info"
                            variant="tonal"
                            border="start"
                            text="此時間範圍內無使用者對話記錄"
                        ></v-alert>
                    </div>

                    <div
                        v-if="statistics && statistics.length > 0"
                        class="px-4 py-2 d-flex align-center stat-container"
                        :style="{
                            borderTop: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #e0e0e0',
                            backgroundColor: isDarkTheme ? 'transparent' : '#f5f5f5',
                        }"
                    >
                        <div class="flex-wrap d-flex align-center">
                            <div class="mb-2 mr-4 d-flex align-center">
                                <span class="mr-1 color-dot" :style="{ backgroundColor: '#FFD700' }" />
                                <span class="text-caption" :class="isDarkTheme ? 'text-grey' : 'text-grey-darken-2'">
                                    前三名使用特殊顏色標識
                                </span>
                            </div>
                            <div class="mb-2 mr-4 d-flex align-center">
                                <span class="mr-1 color-dot" :style="{ backgroundColor: '#2196F3' }" />
                                <span class="text-caption" :class="isDarkTheme ? 'text-grey' : 'text-grey-darken-2'">
                                    總計: {{ totalUsers }} 位使用者
                                </span>
                            </div>
                        </div>
                    </div>
                </v-card-text>
            </div>
        </v-expand-transition>
    </v-card>
</template>

<style scoped>
.chart-card {
    border-radius: 4px;
    overflow: hidden;
    border: v-bind('isDarkTheme ? "none" : "1px solid #e0e0e0"');
}

.color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    transition: opacity 0.3s ease;
}

.rotate-icon {
    transition: transform 0.3s ease;
}

.chart-loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 1;
}
</style>
