<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import * as echarts from "echarts";
import { getDarkThemeLokiChart, getLightThemeLokiChart } from "@/utils/echart";
import { useStorage } from "@vueuse/core";
const props = defineProps({
    logs: {
        type: Object,
        required: true,
    },
    loading: {
        type: Boolean,
        default: false,
    },
});

const chartContainer = ref(null);
let chart = null;
const selectedLevels = ref(new Set(["debug", "error", "info", "warning"]));
const isExpanded = ref(true);
const isDarkTheme = useStorage("loki-logs-volume-chart-theme", false); // 預設為 true (深色主題)

// 深色主題顏色
const darkThemeColors = {
    debug: "#2373B9",
    error: "#F03E3E",
    info: "#67C23A",
    warning: "#E6A23C",
};

// 淺色主題顏色
const lightThemeColors = {
    debug: "#64B5F6",
    error: "#EF5350",
    info: "#81C784",
    warning: "#FFB74D",
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

// 計算所有日誌級別的總數
const logTotals = computed(() => {
    if (!props.logs?.data) return null;

    const totals = {
        debug: 0,
        error: 0,
        info: 0,
        warning: 0,
    };

    props.logs.data.forEach((group) => {
        group.entries.forEach((entry) => {
            const logData = parseLogMessage(entry.log);
            const level = logData.level === "warn" ? "warning" : logData.level;
            // 因為 python 的 level 會是大寫 所以統一轉換成小寫
            if (totals.hasOwnProperty(level?.toLowerCase())) {
                totals[level?.toLowerCase()]++;
            }
        });
    });

    return totals;
});

// 解析日誌內容
const parseLogMessage = (logStr) => {
    try {
        const logObj = JSON.parse(logStr);
        return {
            level: logObj.level,
            message: logObj.message,
            timestamp: logObj.timestamp,
            extra: logObj.extra,
        };
    } catch (e) {
        return { message: logStr };
    }
};

// 處理數據
const processData = (entries) => {
    const timeMap = new Map();

    // 如果沒有數據，創建一個默認的5分鐘時間範圍
    if (!entries || entries.length === 0) {
        const now = new Date();
        now.setMinutes(Math.floor(now.getMinutes() / 5) * 5);
        now.setSeconds(0);
        now.setMilliseconds(0);

        // 創建至少30分鐘的時間範圍
        for (let i = 0; i < 30; i++) {
            const time = now.getTime() - i * 60 * 1000;
            timeMap.set(time, {
                timestamp: time,
                debug: 0,
                error: 0,
                info: 0,
                warn: 0,
            });
        }
    } else {
        // 計算時間範圍
        const timestamps = entries.map((entry) => new Date(entry.timestamp).getTime());
        const startTime = Math.min(...timestamps);
        const endTime = Math.max(...timestamps);
        const daysDiff = (endTime - startTime) / (1000 * 60 * 60 * 24);

        // 決定時間間隔
        const interval = daysDiff > 1 ? 60 * 60 * 1000 : 60 * 1000; // 跨天用小時，否則用分鐘

        entries.forEach((entry) => {
            const date = new Date(entry.timestamp);
            // 根據間隔對齊時間
            if (daysDiff > 1) {
                date.setMinutes(0);
                date.setSeconds(0);
            } else {
                date.setSeconds(0);
            }
            date.setMilliseconds(0);
            const timeKey = date.getTime();

            if (!timeMap.has(timeKey)) {
                timeMap.set(timeKey, {
                    timestamp: timeKey,
                    debug: 0,
                    error: 0,
                    info: 0,
                    warn: 0,
                });
            }

            const logData = parseLogMessage(entry.log);
            const data = timeMap.get(timeKey);
            if (logData.level === "warn") {
                data.warn++;
            } else {
                // 因為 python 的 level 會是大寫 所以統一轉換成小寫
                data[logData.level?.toLowerCase()]++;
            }
        });

        // 填充空缺的時間點
        const keys = Array.from(timeMap.keys());
        const min = Math.min(...keys);
        const max = Math.max(...keys);

        for (let t = min; t <= max; t += interval) {
            if (!timeMap.has(t)) {
                timeMap.set(t, {
                    timestamp: t,
                    debug: 0,
                    error: 0,
                    info: 0,
                    warn: 0,
                });
            }
        }
    }

    return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
};

// 切換選中狀態
const toggleLevel = (level) => {
    const newSet = new Set(selectedLevels.value);

    if (newSet.size === 1 && newSet.has(level)) {
        selectedLevels.value = new Set(["debug", "error", "info", "warning"]);
    } else if (newSet.size > 1 || !newSet.has(level)) {
        if (newSet.has(level)) {
            newSet.delete(level);
        } else {
            newSet.clear();
            newSet.add(level);
        }
        selectedLevels.value = newSet;
    }

    updateChart();
};

const updateChart = () => {
    if (!chart) return;
    const sortedData = processData(props.logs?.data?.flatMap((group) => group.entries) || []);

    // 檢查數據是否跨天
    const timestamps = sortedData.map((item) => item.timestamp);
    const startDate = new Date(Math.min(...timestamps));
    const endDate = new Date(Math.max(...timestamps));
    const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    // 根據跨越的天數決定時間格式和間隔
    const timeFormat =
        daysDiff > 1
            ? (value) => {
                  const date = new Date(value);
                  return date.toLocaleString("zh-TW", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                  });
              }
            : (value) => {
                  return new Date(value).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                  });
              };

    const option = isDarkTheme.value
        ? getDarkThemeLokiChart(sortedData, selectedLevels, daysDiff)
        : getLightThemeLokiChart(sortedData, selectedLevels, daysDiff);

    chart.setOption(option);
};

const toggleTheme = () => {
    isDarkTheme.value = !isDarkTheme.value;
    updateChart();
};

// 監聽數據變化
watch(
    () => props.logs,
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
});

onUnmounted(() => {
    window.removeEventListener("resize", handleResize);
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
                Logs volume
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
            <span class="text-caption" :class="isDarkTheme ? 'text-grey' : 'text-grey-darken-1'"> loki </span>
        </v-card-title>

        <v-expand-transition>
            <div v-show="isExpanded">
                <v-card-text class="pa-0">
                    <div ref="chartContainer" style="width: 100%; height: 200px" />

                    <div
                        class="px-4 py-2 d-flex align-center stat-container"
                        :style="{
                            borderTop: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #e0e0e0',
                            backgroundColor: isDarkTheme ? 'transparent' : '#f5f5f5',
                        }"
                    >
                        <div v-if="logTotals" class="d-flex align-center">
                            <div
                                v-for="(color, level) in isDarkTheme ? darkThemeColors : lightThemeColors"
                                :key="level"
                                class="mr-4 d-flex align-center"
                                @click="toggleLevel(level)"
                                style="cursor: pointer"
                            >
                                <span
                                    class="mr-1 color-dot"
                                    :style="{
                                        backgroundColor: color,
                                        opacity: selectedLevels.has(level) ? 1 : 0.3,
                                    }"
                                />
                                <span
                                    class="text-caption"
                                    :class="[
                                        isDarkTheme ? 'text-grey' : 'text-grey-darken-2',
                                        { 'text-grey-darken-2': !selectedLevels.has(level) && !isDarkTheme },
                                        { 'text-grey-darken-4': selectedLevels.has(level) && !isDarkTheme },
                                    ]"
                                >
                                    {{ level }} Total: {{ logTotals[level] }}
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
</style>
