<script setup>
import { ref, onMounted, onUnmounted, watch, computed, inject } from "vue";
import * as echarts from "echarts";
import { useStorage } from "@vueuse/core";
import { excelIconPath, echartExportExcel, refreshIconPath } from "@/utils/echart";

const props = defineProps({
    statistics: {
        type: Array,
        required: true,
    },
    loading: {
        type: Boolean,
        default: false,
    },
});

const emitter = inject("emitter");
const chartContainer = ref(null);
let chart = null;
const selectedTypes = ref(new Set(["total", "user", "bot"]));
const isExpanded = ref(true);
const isDarkTheme = useStorage("message-stats-chart-theme", false);

const emit = defineEmits(["refresh"]);

// 深色主題顏色
const darkThemeColors = {
    total: "#667EEA",
    user: "#F97316",
    bot: "#10B981",
};

// 淺色主題顏色
const lightThemeColors = {
    total: "#818CF8",
    user: "#FB923C",
    bot: "#34D399",
};

const toggleExpand = () => {
    isExpanded.value = !isExpanded.value;
    // 給圖表一點時間進行動畫後再重新調整大小
    if (isExpanded.value) {
        setTimeout(() => {
            chart?.resize();
        }, 300);
    }
};

// 計算所有訊息類型的總數
const messageTotals = computed(() => {
    if (!props.statistics || props.statistics.length === 0) return null;

    const totals = {
        total: 0,
        user: 0,
        bot: 0,
    };

    props.statistics.forEach((day) => {
        totals.total += day.count;
        totals.user += day.userMessageCount;
        totals.bot += day.botMessageCount;
    });

    return totals;
});

// 處理數據
const processData = (statistics) => {
    if (!statistics || statistics.length === 0) {
        return [];
    }
    return statistics.map((day) => ({
        date: day.date,
        total: day.count,
        user: day.userMessageCount,
        bot: day.botMessageCount,
    }));
};

// 切換選中狀態
const toggleType = (type) => {
    const newSet = new Set(selectedTypes.value);

    if (newSet.size === 1 && newSet.has(type)) {
        selectedTypes.value = new Set(["total", "user", "bot"]);
    } else if (newSet.size > 1 || !newSet.has(type)) {
        if (newSet.has(type)) {
            newSet.delete(type);
        } else {
            newSet.clear();
            newSet.add(type);
        }
        selectedTypes.value = newSet;
    }

    updateChart();
};

// 获取显示名称
const getDisplayName = (type) => {
    switch (type) {
        case "total":
            return "全部訊息";
        case "user":
            return "使用者訊息";
        case "bot":
            return "機器人訊息";
        default:
            return type;
    }
};

function prepareJsonData() {
    const data = props.statistics;
    const newData = data.map((item) => {
        const obj = {
            日期: `${item.date}`,
            總訊息數: item.count,
            使用者訊息: item.userMessageCount,
            機器人訊息: item.botMessageCount,
        };
        return obj;
    });
    return newData;
}

const updateChart = () => {
    if (!chart) return;
    const chartData = processData(props.statistics);

    // 建立 series mapping
    const seriesMap = {
        全部訊息: {
            name: "全部訊息",
            type: "line",
            areaStyle: {
                opacity: 0.3,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                        offset: 0,
                        color: isDarkTheme.value ? darkThemeColors.total : lightThemeColors.total,
                    },
                    {
                        offset: 1,
                        color: isDarkTheme.value ? "rgba(102, 126, 234, 0.2)" : "rgba(129, 140, 248, 0.1)",
                    },
                ]),
            },
            emphasis: {
                focus: "series",
            },
            lineStyle: {
                width: 2,
            },
            symbolSize: 8,
            itemStyle: {
                color: isDarkTheme.value ? darkThemeColors.total : lightThemeColors.total,
            },
            showSymbol: false,
            smooth: true,
            data: chartData.map((item) => item.total),
            z: 3, // 確保 total 在最上層
        },
        使用者訊息: {
            name: "使用者訊息",
            type: "line",
            areaStyle: {
                opacity: 0.3,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                        offset: 0,
                        color: isDarkTheme.value ? darkThemeColors.user : lightThemeColors.user,
                    },
                    {
                        offset: 1,
                        color: isDarkTheme.value ? "rgba(249, 115, 22, 0.2)" : "rgba(251, 146, 60, 0.1)",
                    },
                ]),
            },
            emphasis: {
                focus: "series",
            },
            lineStyle: {
                width: 2,
            },
            symbolSize: 8,
            itemStyle: {
                color: isDarkTheme.value ? darkThemeColors.user : lightThemeColors.user,
            },
            showSymbol: false,
            smooth: true,
            data: chartData.map((item) => item.user),
            z: 2, // 使用者訊息在中間
        },
        機器人訊息: {
            name: "機器人訊息",
            type: "line",
            areaStyle: {
                opacity: 0.3,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                        offset: 0,
                        color: isDarkTheme.value ? darkThemeColors.bot : lightThemeColors.bot,
                    },
                    {
                        offset: 1,
                        color: isDarkTheme.value ? "rgba(16, 185, 129, 0.2)" : "rgba(52, 211, 153, 0.1)",
                    },
                ]),
            },
            emphasis: {
                focus: "series",
            },
            lineStyle: {
                width: 2,
            },
            symbolSize: 8,
            itemStyle: {
                color: isDarkTheme.value ? darkThemeColors.bot : lightThemeColors.bot,
            },
            showSymbol: false,
            smooth: true,
            data: chartData.map((item) => item.bot),
            z: 1, // 機器人訊息在最下
        },
    };

    // 類型 mapping
    const typeToDisplayName = {
        total: "全部訊息",
        user: "使用者訊息",
        bot: "機器人訊息",
    };

    // 過濾選中類型
    const filteredSeries = Array.from(selectedTypes.value)
        .map((type) => seriesMap[typeToDisplayName[type]])
        .filter(Boolean);

    const option = {
        backgroundColor: isDarkTheme.value ? "#1c1c1c" : "transparent",
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: "30px",
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
                    result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
                });
                return result;
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
                magicType: {
                    type: ["line", "bar"],
                    title: "切換圖表類型",
                },

                myExcel: {
                    show: true,
                    title: "匯出成Excel",
                    icon: excelIconPath(),
                    onclick: () => echartExportExcel(prepareJsonData(), "AVA-GPT 訊息統計資料"),
                },
            },
        },
        legend: {
            data: Array.from(selectedTypes.value).map((type) => typeToDisplayName[type]),
            textStyle: {
                color: isDarkTheme.value ? "#ddd" : "#333",
            },
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: chartData.map((item) => item.date),
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
        yAxis: {
            type: "value",
            axisLabel: {
                color: isDarkTheme.value ? "#ddd" : "#333",
            },
            splitLine: {
                lineStyle: {
                    color: isDarkTheme.value ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
                },
            },
        },
        series: filteredSeries,
    };

    chart.setOption(option);
};

const toggleTheme = () => {
    isDarkTheme.value = !isDarkTheme.value;
    updateChart();
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
                訊息統計
            </div>
            <v-spacer />
            <!-- 添加主題切換按鈕 -->
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
                    <div v-if="loading" class="chart-loading">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    </div>
                    <div ref="chartContainer" style="width: 100%; height: 300px" />

                    <div
                        class="px-4 py-2 d-flex align-center stat-container"
                        :style="{
                            borderTop: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #e0e0e0',
                            backgroundColor: isDarkTheme ? 'transparent' : '#f5f5f5',
                        }"
                    >
                        <div v-if="messageTotals" class="flex-wrap d-flex align-center">
                            <div
                                v-for="(color, type) in isDarkTheme ? darkThemeColors : lightThemeColors"
                                :key="type"
                                class="mb-2 mr-4 d-flex align-center"
                                @click="toggleType(type)"
                                style="cursor: pointer"
                            >
                                <span
                                    class="mr-1 color-dot"
                                    :style="{
                                        backgroundColor: color,
                                        opacity: selectedTypes.has(type) ? 1 : 0.3,
                                    }"
                                />
                                <span
                                    class="text-caption"
                                    :class="[
                                        isDarkTheme ? 'text-grey' : 'text-grey-darken-2',
                                        { 'text-grey-darken-2': !selectedTypes.has(type) && !isDarkTheme },
                                        { 'text-grey-darken-4': selectedTypes.has(type) && !isDarkTheme },
                                    ]"
                                >
                                    {{ getDisplayName(type) }} 總計: {{ messageTotals[type] }}
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
    height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 1;
}
</style>
