<script setup>
import { ref, onMounted, onUnmounted, watch, computed, inject } from "vue";
import * as echarts from "echarts";
import { useStorage } from "@vueuse/core";
import { excelIconPath, echartExportExcel, refreshIconPath } from "@/utils/echart";

const props = defineProps({
    chartData: {
        type: Object,
        required: true,
        default: () => ({
            labels: [],
            datasets: [],
        }),
    },
    chartType: {
        type: String,
        default: "line",
    },
    isPlaceholderData: {
        type: Boolean,
        default: false,
    },
});

const emitter = inject("emitter");
const chartContainer = ref(null);
let chart = null;
const isExpanded = ref(true);
const isDarkTheme = useStorage("token-cost-chart-theme", false);

const emit = defineEmits(["update-chart-type", "refresh"]);

// 深色主題顏色
const darkThemeColors = {
    cost: "#00BCD4", // 青色系
    tokens: "#9C27B0", // 紫色系
};

// 淺色主題顏色
const lightThemeColors = {
    cost: "#26C6DA", // 淺青色系
    tokens: "#BA68C8", // 淺紫色系
};

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
    if (chart) {
        updateChart();
    }
};

// 為圖表準備數據
const prepareChartData = computed(() => {
    if (!props.chartData || props.chartData.length === 0) {
        return {
            labels: [],
            datasets: [
                { name: "每日費用 (USD)", data: [] },
                { name: "每日Token數", data: [] },
            ],
        };
    }

    // 提取日期標籤和費用數據
    const labels = props.chartData.map((day) => day.date);
    const costData = props.chartData.map((day) => day.totalCost);
    const tokenCountData = props.chartData.map((day) => day.totalTokens);

    return {
        labels,
        datasets: [
            { name: "每日費用 (USD)", data: costData },
            { name: "每日Token數", data: tokenCountData },
        ],
    };
});

// 準備Excel導出數據
function prepareJsonData() {
    const data = props.chartData || [];
    const result = [];

    data.forEach((day) => {
        const { date, models, totalCost, totalTokens } = day;

        models.forEach((model, index) => {
            const row = {
                日期: date,
                模型: model.model,
                "費用(USD)": `$${model.cost.toFixed(6)}`,
                使用次數: model.count,
            };

            // 只在第一筆模型加入總花費與總Token數，避免重複
            if (index === 0) {
                row["總花費"] = `$${totalCost.toFixed(6)}`;
                row["總Token數"] = totalTokens;
            } else {
                row["總花費"] = "";
                row["總Token數"] = "";
            }

            result.push(row);
        });
    });

    return result;
}

// 更新圖表
const updateChart = () => {
    if (!chart || !chartContainer.value) return;

    // 獲取數據
    const { labels, datasets } = prepareChartData.value;
    if (!labels || labels.length === 0 || !datasets || datasets.length === 0) {
        return;
    }

    // 格式化數據
    const option = {
        backgroundColor: isDarkTheme.value ? "#1c1c1c" : "transparent",
        grid: {
            left: "3%",
            right: "8%",
            bottom: "3%",
            top: "80px",
            width: "95%",
            containLabel: true,
        },
        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: "cross",
                label: {
                    backgroundColor: "#6a7985",
                },
            },
            formatter: function (params) {
                let result = `${params[0].axisValue}<br/>`;
                params.forEach((param) => {
                    const value = param.value;
                    let formattedValue = value;

                    if (param.seriesName.includes("費用")) {
                        formattedValue = "$" + value.toFixed(3);
                    } else if (param.seriesName.includes("Token")) {
                        if (value >= 1000000) {
                            formattedValue = (value / 1000000).toFixed(2) + "M";
                        } else if (value >= 1000) {
                            formattedValue = (value / 1000).toFixed(2) + "K";
                        }
                    }

                    result += `${param.marker} ${param.seriesName}: ${formattedValue}<br/>`;
                });
                return result;
            },
        },
        toolbox: {
            itemGap: 10,
            // right: 65,
            // top: 5,
            feature: {
                myRefresh: {
                    show: true,
                    title: "刷新資料",
                    icon: refreshIconPath(),
                    onclick: () => emit("refresh"),
                },
                magicType: {
                    type: ["line", "bar"],
                    title: "切換圖表類型",
                },
                myExcel: {
                    show: true,
                    title: "匯出成Excel",
                    icon: excelIconPath(),
                    onclick: () => echartExportExcel(prepareJsonData(), "AVA-GPT Token費用統計資料"),
                },
            },
        },
        legend: {
            data: ["每日費用 (USD)", "每日Token數"],
            textStyle: {
                color: isDarkTheme.value ? "#ddd" : "#333",
            },
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: labels,
            axisLabel: {
                color: isDarkTheme.value ? "#ddd" : "#333",
                formatter: function (value) {
                    return value.slice(5); // 只顯示月和日 (MM-DD)
                },
            },
            axisLine: {
                lineStyle: {
                    color: isDarkTheme.value ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.1)",
                },
            },
        },
        yAxis: [
            {
                type: "value",
                name: "費用 (USD)",
                position: "left",
                axisLabel: {
                    formatter: function (value) {
                        return "$" + value.toFixed(3);
                    },
                    color: isDarkTheme.value ? "#ddd" : "#333",
                },
                nameTextStyle: {
                    color: isDarkTheme.value ? "#ddd" : "#333",
                },
                splitLine: {
                    lineStyle: {
                        color: isDarkTheme.value ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
                    },
                },
            },
            {
                type: "value",
                name: "Token數",
                position: "right",
                axisLabel: {
                    formatter: function (value) {
                        if (value >= 1000000) {
                            return (value / 1000000).toFixed(1) + "M";
                        } else if (value >= 1000) {
                            return (value / 1000).toFixed(1) + "K";
                        }
                        return value;
                    },
                    color: isDarkTheme.value ? "#ddd" : "#333",
                },
                nameTextStyle: {
                    color: isDarkTheme.value ? "#ddd" : "#333",
                },
                splitLine: {
                    show: false,
                },
            },
        ],
        series: [
            {
                name: "每日費用 (USD)",
                type: props.chartType,
                yAxisIndex: 0,
                data: datasets[0].data,
                smooth: true,
                showSymbol: false,
                lineStyle: {
                    width: 2,
                    color: isDarkTheme.value ? darkThemeColors.cost : lightThemeColors.cost,
                },
                itemStyle: {
                    color: isDarkTheme.value ? darkThemeColors.cost : lightThemeColors.cost,
                },
                areaStyle: {
                    opacity: 0.3,
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        {
                            offset: 0,
                            color: isDarkTheme.value ? darkThemeColors.cost : lightThemeColors.cost,
                        },
                        {
                            offset: 1,
                            color: isDarkTheme.value ? "rgba(0, 188, 212, 0.2)" : "rgba(38, 198, 218, 0.1)",
                        },
                    ]),
                },
                emphasis: {
                    focus: "series",
                },
                z: 10,
            },
            {
                name: "每日Token數",
                type: props.chartType,
                yAxisIndex: 1,
                data: datasets[1].data,
                smooth: true,
                showSymbol: false,
                lineStyle: {
                    width: 2,
                    color: isDarkTheme.value ? darkThemeColors.tokens : lightThemeColors.tokens,
                },
                itemStyle: {
                    color: isDarkTheme.value ? darkThemeColors.tokens : lightThemeColors.tokens,
                },
                areaStyle: {
                    opacity: 0.3,
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        {
                            offset: 0,
                            color: isDarkTheme.value ? darkThemeColors.tokens : lightThemeColors.tokens,
                        },
                        {
                            offset: 1,
                            color: isDarkTheme.value ? "rgba(156, 39, 176, 0.2)" : "rgba(186, 104, 200, 0.1)",
                        },
                    ]),
                },
                emphasis: {
                    focus: "series",
                },
                z: 5,
            },
        ],
    };

    chart.setOption(option, true);
};

// 初始化圖表
const initChart = () => {
    if (chart) {
        chart.dispose();
    }

    chart = echarts.init(chartContainer.value);
    window.addEventListener("resize", handleResize);
    updateChart();
};

// 處理窗口大小變化
const handleResize = () => {
    chart?.resize();
};

// 監聽數據變化
watch(
    () => props.chartData,
    () => {
        if (chart) {
            updateChart();
        }
    },
    { deep: true }
);

// 監聽圖表類型變化
watch(
    () => props.chartType,
    () => {
        if (chart) {
            updateChart();
        }
    }
);

// 監聽主題變化
watch(
    () => isDarkTheme.value,
    () => {
        if (chart) {
            updateChart();
        }
    }
);

// 元件掛載時初始化圖表
onMounted(() => {
    if (chartContainer.value) {
        initChart();
    }
    emitter.on("resize", handleResize);
});

// 元件卸載時銷毀圖表
onUnmounted(() => {
    window.removeEventListener("resize", handleResize);
    if (chart) {
        chart.dispose();
        chart = null;
    }
});
</script>

<template>
    <v-card class="chart-card" :color="isDarkTheme ? '#1c1c1c' : 'white'" elevation="0">
        <v-card-title class="px-4 py-2 d-flex align-center" :class="{ 'text-white': isDarkTheme }">
            <div class="d-flex align-center" @click="toggleExpand" style="cursor: pointer">
                <v-icon
                    :icon="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                    size="small"
                    class="mr-2"
                    color="grey"
                    :class="{ 'rotate-icon': isExpanded }"
                />
                Token 費用統計
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
                    <div v-if="isPlaceholderData" class="chart-loading">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    </div>
                    <div ref="chartContainer" style="width: 100%; height: 350px" />

                    <div
                        class="px-4 py-2 d-flex align-center stat-container"
                        :style="{
                            borderTop: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #e0e0e0',
                            backgroundColor: isDarkTheme ? 'transparent' : '#f5f5f5',
                        }"
                    >
                        <div class="flex-wrap d-flex align-center">
                            <div class="mb-2 mr-4 d-flex align-center">
                                <span
                                    class="mr-1 color-dot"
                                    :style="{
                                        backgroundColor: isDarkTheme ? darkThemeColors.cost : lightThemeColors.cost,
                                    }"
                                />
                                <span class="text-caption" :class="isDarkTheme ? 'text-grey' : 'text-grey-darken-2'">
                                    每日費用 (USD)
                                </span>
                            </div>
                            <div class="mb-2 mr-4 d-flex align-center">
                                <span
                                    class="mr-1 color-dot"
                                    :style="{
                                        backgroundColor: isDarkTheme ? darkThemeColors.tokens : lightThemeColors.tokens,
                                    }"
                                />
                                <span class="text-caption" :class="isDarkTheme ? 'text-grey' : 'text-grey-darken-2'">
                                    每日Token數
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
    border-radius: 8px;
    overflow: hidden;
    transition: box-shadow 0.2s;
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
    height: 350px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 1;
}
</style>
