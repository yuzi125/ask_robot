<script setup>
import { inject, ref, onMounted, onUnmounted, watch, nextTick, computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { getDiskIOChartOption, getTCPConnectionsChartOption, getFileSystemSpaceChartOption } from "@/utils/echart";
import * as echarts from "echarts";

const axios = inject("axios");
const isExpanded = ref(true);
const tcpConnectionsChartRef = ref(null);
const filesystemChartRef = ref(null);
const diskIOChartRef = ref(null);
const filterConfig = inject("filterConfig");
const { selectedInstance, selectedJob, activeTab, selectedPrometheusUrl } = filterConfig;
let tcpConnectionsChart = null;
let filesystemChart = null;
let diskIOChart = null;
const tooltips = {
    tcp: "顯示當前 TCP 連接數量",
    filesystem: "顯示各檔案系統的可用空間",
};

const shouldRefetch = computed(() => {
    return activeTab.value == 0 && isExpanded.value ? 30000 : false;
});

const { data: diskIOStats, refetch: refetchDiskIO } = useQuery({
    queryKey: ["getDiskIO", selectedInstance, selectedJob, selectedPrometheusUrl],
    queryFn: async () => {
        const params = {
            instance: selectedInstance.value,
            job: selectedJob.value,
            prometheusUrl: selectedPrometheusUrl.value,
        };
        const response = await axios.get("/nodeExporter/getDiskIO", { params });
        return response.data;
    },
    refetchInterval: shouldRefetch,
    enabled: activeTab.value == 0,
});

// 使用 enabled 選項來控制查詢的執行時機
const { data: stats, refetch: refetchNetworkStats } = useQuery({
    queryKey: ["getNetworkStat", selectedInstance, selectedJob, selectedPrometheusUrl],
    queryFn: async () => {
        const params = {
            instance: selectedInstance.value,
            job: selectedJob.value,
            prometheusUrl: selectedPrometheusUrl.value,
        };
        const response = await axios.get("/nodeExporter/getPerformanceMetrics", { params });
        return response.data;
    },
    refetchInterval: shouldRefetch,
    enabled: activeTab.value == 0, // 改為默認啟用
});

defineExpose({
    refetchNetworkStats,
    refetchDiskIO,
});

const createDiskIOChartOption = (data) => {
    if (!data) return {};

    return getDiskIOChartOption(data);
};

const createTCPConnectionsChartOption = (data) => {
    if (!data?.tcpConnections?.[0]?.data) return {};

    return getTCPConnectionsChartOption(data);
};

const createFilesystemSpaceChartOption = (data) => {
    if (!data?.fileSystem) return {};

    return getFileSystemSpaceChartOption(data);
};

// 初始化圖表
const initCharts = () => {
    if (tcpConnectionsChartRef.value && !tcpConnectionsChart) {
        tcpConnectionsChart = echarts.init(tcpConnectionsChartRef.value);
    }
    if (filesystemChartRef.value && !filesystemChart) {
        filesystemChart = echarts.init(filesystemChartRef.value);
    }

    if (diskIOChartRef.value && !diskIOChart) {
        diskIOChart = echarts.init(diskIOChartRef.value);
    }
};

// 更新圖表
const updateCharts = () => {
    // 處理 TCP Connections 圖表
    if (tcpConnectionsChart) {
        if (!stats.value?.data?.tcpConnections?.length) {
            // 如果沒有數據，設置空的選項
            tcpConnectionsChart.setOption(
                {
                    series: [],
                    xAxis: { data: [] },
                    yAxis: {},
                },
                true
            ); // true 表示清空之前的配置
        } else {
            tcpConnectionsChart.setOption(createTCPConnectionsChartOption(stats.value.data));
        }
    }

    // 處理 Filesystem 圖表
    if (filesystemChart) {
        if (!stats.value?.data?.fileSystem?.length) {
            filesystemChart.setOption(
                {
                    series: [],
                    xAxis: { data: [] },
                    yAxis: {},
                },
                true
            );
        } else {
            filesystemChart.setOption(createFilesystemSpaceChartOption(stats.value.data));
        }
    }

    // 處理 DiskIO 圖表
    if (diskIOChart) {
        if (!diskIOStats.value?.data?.length) {
            diskIOChart.setOption(
                {
                    series: [],
                    xAxis: { data: [] },
                    yAxis: {},
                },
                true
            );
        } else {
            diskIOChart.setOption(createDiskIOChartOption(diskIOStats.value.data));
        }
    }
};

// 處理視窗大小變化
const handleResize = () => {
    tcpConnectionsChart?.resize();
    filesystemChart?.resize();
    diskIOChart?.resize();
};
// 切換展開/收起狀態
const toggleExpand = () => {
    isExpanded.value = !isExpanded.value;

    if (isExpanded.value) {
        nextTick(() => {
            initCharts();
            refetchNetworkStats();
            refetchDiskIO();
        });
    } else {
        tcpConnectionsChart?.dispose();
        tcpConnectionsChart = null;
        filesystemChart?.dispose();
        filesystemChart = null;
        diskIOChart?.dispose();
        diskIOChart = null;
    }
};

// 監聽數據變化
watch(
    () => stats.value,
    () => {
        nextTick(updateCharts);
    },
    { deep: true }
);

watch(
    () => diskIOStats.value,
    () => {
        if (isExpanded.value) {
            nextTick(updateCharts);
        }
    },
    { deep: true }
);

// 組件掛載
onMounted(() => {
    if (isExpanded.value) {
        nextTick(() => {
            initCharts();
            refetchNetworkStats();
        });
    }
    window.addEventListener("resize", handleResize);
});

// 組件卸載
onUnmounted(() => {
    tcpConnectionsChart?.dispose();
    filesystemChart?.dispose();
    diskIOChart?.dispose();
    window.removeEventListener("resize", handleResize);
});
</script>

<template>
    <div class="dashboard-section">
        <div class="dashboard-header" @click="toggleExpand">
            <div class="header-content">
                <v-icon :class="{ 'rotate-icon': !isExpanded }">mdi-chevron-down</v-icon>
                <span class="header-title">System Monitoring</span>
                <v-tooltip location="top">
                    <template v-slot:activator="{ props }">
                        <v-icon v-bind="props" size="small" color="grey-darken-1">mdi-information</v-icon>
                    </template>
                    System monitoring dashboard
                </v-tooltip>
            </div>
        </div>

        <div class="dashboard-content" :class="{ 'content-hidden': !isExpanded }">
            <div class="charts-grid">
                <v-card class="chart-card">
                    <div ref="tcpConnectionsChartRef" class="chart"></div>
                </v-card>
                <v-card class="chart-card">
                    <div ref="filesystemChartRef" class="chart"></div>
                </v-card>
                <v-card class="chart-card">
                    <div ref="diskIOChartRef" class="chart"></div>
                </v-card>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.dashboard-section {
    background-color: #ffffff;
    border-radius: 8px;
    margin: 8px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
    max-height: 100%;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;

    &.content-hidden {
        max-height: 0;
    }
}

.charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    padding: 16px;

    @media (max-width: 1024px) {
        grid-template-columns: 1fr;
    }
}

.chart-card {
    background-color: #ffffff !important;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
}

.chart {
    width: 100%;
    height: 400px;

    @media (max-width: 1024px) {
        height: 300px;
    }
}

.rotate-icon {
    transform: rotate(-90deg);
    transition: transform 0.3s ease;
}
</style>
