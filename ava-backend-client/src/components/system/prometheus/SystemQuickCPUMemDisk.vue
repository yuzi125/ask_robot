<script setup>
import { inject, ref, onMounted, onUnmounted, watch, nextTick, computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import * as echarts from "echarts";
import { VTooltip } from "vuetify/components";

const axios = inject("axios");
const emitter = inject("emitter");
const filterConfig = inject("filterConfig");
const isExpanded = ref(true);
const { selectedInstance, selectedJob, activeTab, selectedPrometheusUrl } = filterConfig;
// 使用一個物件來管理所有圖表引用
const chartRefs = {
    cpu: ref(null),
    sysLoad: ref(null),
    ram: ref(null),
    swap: ref(null),
    rootFS: ref(null),
};

const charts = ref({
    cpu: null,
    sysLoad: null,
    ram: null,
    swap: null,
    rootFS: null,
});
const mainChartRefs = {
    cpu: ref(null),
    sysLoad: ref(null),
    ram: ref(null),
    swap: ref(null),
    rootFS: ref(null),
};
const tooltips = {
    cpu: "CPU使用率顯示了處理器正在處理任務的百分比",
    sysLoad: "系統負載表示系統處理任務的繁忙程度",
    ram: "記憶體使用率顯示了目前使用中的RAM容量百分比",
    swap: "交換空間使用率顯示了目前使用中的交換空間容量百分比",
    rootFS: "根目錄使用率顯示了目前使用中的根目錄容量百分比",
};

const shouldRefetch = computed(() => {
    return activeTab.value == 0 && isExpanded.value ? 5000 : false;
});

// 查詢配置
const { data: quickCPUMemDisk, refetch: refetchQuickCPUMemDisk } = useQuery({
    queryKey: ["getQuickCPUMemDisk", selectedInstance, selectedJob, activeTab, selectedPrometheusUrl],
    queryFn: async () => {
        const params = {
            instance: selectedInstance.value,
            job: selectedJob.value,
            prometheusUrl: selectedPrometheusUrl.value,
        };
        const response = await axios.get("/nodeExporter/getQuickCPUMemDisk", { params });
        return response.data;
    },
    refetchInterval: shouldRefetch,
    enabled: activeTab.value == 0,
});

defineExpose({
    refetchQuickCPUMemDisk,
});

// 優化顏色計算函數
const getColors = (value) => {
    if (value >= 90) return ["#dc2626", "#f87171"];
    if (value >= 80) return ["#fb923c", "#fec78c"];
    return ["#059669", "#34d399"];
};

// 計算屬性
const getCPUCores = computed(() => {
    return quickCPUMemDisk.value?.data?.cpuCores?.[0]?.value || 0;
});

const getRootFSTotal = computed(() => {
    return quickCPUMemDisk.value?.data?.rootFSTotal?.[0]?.value || 0;
});

const getRAMTotal = computed(() => {
    return quickCPUMemDisk.value?.data?.ramTotal?.[0]?.value || 0;
});

const getSWAPTotal = computed(() => {
    return quickCPUMemDisk.value?.data?.swapTotal?.[0]?.value || 0;
});

const getUptime = computed(() => {
    const uptimeSeconds = quickCPUMemDisk.value?.data?.uptime?.[0]?.value || 0;
    return formatUptime(uptimeSeconds);
});

// 工具函數
const formatGiB = (bytes) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1);
};

const formatUptime = (seconds) => {
    // 轉換為週數
    const weeks = seconds / (7 * 24 * 60 * 60);

    if (weeks >= 1) {
        return `${weeks.toFixed(1)} weeks`;
    }

    // 如果小於一週，轉換為天數
    const days = seconds / (24 * 60 * 60);
    if (days >= 1) {
        return `${days.toFixed(1)} days`;
    }

    // 如果小於一天，轉換為小時
    const hours = seconds / (60 * 60);
    if (hours >= 1) {
        return `${hours.toFixed(1)} hours`;
    }

    // 如果小於一小時，轉換為分鐘
    const minutes = seconds / 60;
    if (minutes >= 1) {
        return `${minutes.toFixed(1)} minutes`;
    }

    // 如果小於一分鐘，顯示秒數
    return `${seconds.toFixed(1)} seconds`;
};

const getMetricTitle = (key) => {
    const titles = {
        cpu: "CPU Busy",
        sysLoad: "Sys Load",
        ram: "RAM Used",
        swap: "SWAP Used",
        rootFS: "Root FS Used",
    };
    return titles[key] || key.toUpperCase();
};

// 緩存 gauge option 配置
const cachedGaugeOption = (() => {
    const baseOption = {
        series: [
            {
                type: "gauge",
                startAngle: 180,
                endAngle: 0,
                min: 0,
                max: 100,
                splitNumber: 8,
                radius: "120%",
                center: ["50%", "95%"],
                progress: { show: true, width: 12 },
                pointer: { show: false },
                axisLine: {
                    lineStyle: {
                        width: 12,
                        color: [[1, "rgba(0, 0, 0, 0.05)"]],
                    },
                },
                axisTick: {
                    distance: -26,
                    splitNumber: 5,
                    lineStyle: { width: 2, color: "#666" },
                },
                splitLine: {
                    distance: -35,
                    length: 14,
                    lineStyle: { width: 3, color: "#666" },
                },
                axisLabel: {
                    distance: -25,
                    color: "#666",
                    fontSize: 12,
                },
                title: { show: false },
                detail: {
                    rich: {
                        value: {
                            fontSize: 24,
                            fontWeight: 500,
                            color: "#111827",
                            padding: [0, 0, 0, 0],
                        },
                    },
                    formatter: (value) => `{value|${value.toFixed(1)}%}`,
                    offsetCenter: [0, 0],
                },
            },
            {
                type: "gauge",
                startAngle: 180,
                endAngle: 0,
                min: 0,
                max: 100,
                splitNumber: 8,
                radius: "120%",
                center: ["50%", "95%"],
                progress: { show: true, width: 3 },
                pointer: { show: false },
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                detail: { show: false },
            },
        ],
    };

    return (value) => {
        const [color1, color2] = getColors(value);
        const option = { ...baseOption };
        option.series[0].itemStyle = {
            color: color1,
            shadowColor: "rgba(0,0,0,0.1)",
            shadowBlur: 8,
            shadowOffsetY: 3,
        };
        option.series[1].itemStyle = {
            color: color2,
            shadowColor: "rgba(0,0,0,0.1)",
            shadowBlur: 8,
            shadowOffsetY: 3,
        };
        option.series[0].data = [{ value }];
        option.series[1].data = [{ value }];
        return option;
    };
})();

// 初始化圖表
const initCharts = () => {
    Object.entries(chartRefs).forEach(([key, ref]) => {
        if (ref.value && !charts.value[key]) {
            charts.value[key] = echarts.init(ref.value);
        }
    });
};

// 更新圖表
const updateCharts = () => {
    if (!quickCPUMemDisk.value?.data) return;

    const data = {
        cpu: quickCPUMemDisk.value.data.cpuUsage[0]?.value || 0,
        sysLoad: quickCPUMemDisk.value.data.sysLoad[0]?.value || 0,
        ram: quickCPUMemDisk.value.data.ramUsed[0]?.value || 0,
        swap: quickCPUMemDisk.value.data.swapUsed[0]?.value || 0,
        rootFS: quickCPUMemDisk.value.data.rootFSUsed[0]?.value || 0,
    };

    Object.entries(charts.value).forEach(([key, chart]) => {
        if (chart) {
            chart.setOption(cachedGaugeOption(data[key]));
        }
    });
};

// 處理視窗大小變化
const handleResize = () => {
    Object.values(charts.value).forEach((chart) => chart?.resize());
};

// 切換展開/收起狀態
const toggleExpand = () => {
    isExpanded.value = !isExpanded.value;
};

// 監聽數據變化
watch(
    () => quickCPUMemDisk.value,
    () => {
        if (isExpanded.value) {
            nextTick(updateCharts);
        }
    },
    { deep: true }
);

onMounted(() => {
    initCharts();
    window.addEventListener("resize", handleResize);

    // 使用 ResizeObserver 監聽容器大小變化
    const resizeObserver = new ResizeObserver(() => {
        if (isExpanded.value) {
            handleResize();
        }
    });

    // 監聽每個圖表容器
    Object.values(chartRefs).forEach((ref) => {
        if (ref.value) {
            resizeObserver.observe(ref.value);
        }
    });

    // 清理
    onUnmounted(() => {
        resizeObserver.disconnect();
        Object.values(charts.value).forEach((chart) => chart?.dispose());
        window.removeEventListener("resize", handleResize);
    });
});

onUnmounted(() => {
    Object.values(charts.value).forEach((chart) => chart?.dispose());
    window.removeEventListener("resize", handleResize);
});
</script>

<template>
    <div class="metrics-dashboard">
        <div class="dashboard-header" @click="toggleExpand">
            <div class="header-content">
                <v-icon :class="{ 'rotate-icon': !isExpanded }">mdi-chevron-down</v-icon>
                <span class="header-title">Quick CPU / Mem / Disk</span>
            </div>
        </div>

        <div class="dashboard-content" :class="{ 'content-hidden': !isExpanded }">
            <!-- 新的網格布局 -->
            <div class="metrics-grid">
                <!-- 主要指標 -->
                <div class="main-metrics">
                    <div v-for="(chartRef, key) in mainChartRefs" :key="key" class="metric-card">
                        <v-card class="gauge-card" elevation="1">
                            <div class="gauge-header">
                                <span>{{ getMetricTitle(key) }}</span>
                                <v-tooltip location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-icon v-bind="props" size="small" color="grey-darken-1">
                                            mdi-information
                                        </v-icon>
                                    </template>
                                    {{ tooltips[key] }}
                                </v-tooltip>
                            </div>
                            <div :ref="(el) => (chartRefs[key].value = el)" class="chart-container"></div>
                        </v-card>
                    </div>
                </div>

                <!-- 次要指標 -->
                <div class="secondary-metrics">
                    <div class="metric-info-card" v-if="quickCPUMemDisk?.data">
                        <v-card class="info-card" elevation="1">
                            <div class="info-grid">
                                <!-- CPU 相關資訊 -->
                                <div class="info-item">
                                    <div class="info-label">CPU Core</div>
                                    <div class="info-value">{{ getCPUCores }}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Uptime</div>
                                    <div class="info-value">{{ getUptime }}</div>
                                </div>

                                <!-- 容量資訊 -->
                                <div class="info-item">
                                    <div class="info-label">Root FS Total</div>
                                    <div class="info-value">{{ formatGiB(getRootFSTotal) }} GiB</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">RAM Total</div>
                                    <div class="info-value">{{ formatGiB(getRAMTotal) }} GiB</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">SWAP Total</div>
                                    <div class="info-value">{{ formatGiB(getSWAPTotal) }} GiB</div>
                                </div>
                            </div>
                        </v-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.metrics-dashboard {
    background-color: #ffffff;
    border-radius: 4px;
    margin: 8px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
}

.dashboard-header {
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid #e5e7eb;
    background-color: #f9fafb;
    position: sticky;
    top: 0;
    z-index: 10;

    &:hover {
        background-color: #f3f4f6;
    }
}

.header-content {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #374151;
}

.header-title {
    font-size: 14px;
    font-weight: 500;
}

.dashboard-content {
    max-height: 800px;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    background-color: #ffffff;

    &.content-hidden {
        max-height: 0;
    }
}

.metrics-container {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    padding: 8px;
    overflow-x: auto;
    scroll-behavior: smooth;

    &::-webkit-scrollbar {
        height: 8px;
    }

    &::-webkit-scrollbar-track {
        background: #f3f4f6;
    }

    &::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 4px;

        &:hover {
            background: #9ca3af;
        }
    }
}

.metric-card {
    flex: 0 0 280px;
    min-width: 280px;
}

.gauge-card {
    background-color: #ffffff !important;
    border: 1px solid #e5e7eb;
    padding: 16px;
    height: 100%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.2s ease;

    &:hover {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
}

.gauge-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: #374151;
    font-size: 14px;
    font-weight: 500;
}

.chart-container {
    width: 100%;
    height: 160px;
    will-change: transform;
    transform: translateZ(0);
}

.rotate-icon {
    transform: rotate(-90deg);
    transition: transform 0.3s ease;
}

.metrics-grid {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.main-metrics {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 8px;

    &::-webkit-scrollbar {
        height: 8px;
    }

    &::-webkit-scrollbar-track {
        background: #f3f4f6;
    }

    &::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 4px;
    }
}

.secondary-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 8px;
}

.info-card {
    background-color: #ffffff !important;
    border: 1px solid #e5e7eb;
    padding: 16px;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
}

.info-item {
    .info-label {
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 4px;
    }

    .info-value {
        font-size: 16px;
        font-weight: 500;
        color: #111827;
    }
}

@media (max-width: 768px) {
    .metric-card {
        flex: 0 0 240px;
        min-width: 240px;
    }

    .chart-container {
        height: 140px;
    }
}
</style>
