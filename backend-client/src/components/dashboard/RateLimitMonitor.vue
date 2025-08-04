<script setup>
import { ref, inject, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { UseWindowSize } from "@vueuse/components";
import { useQuery } from "@tanstack/vue-query";
import * as echarts from "echarts";
import { useLocalStorage } from "@vueuse/core";

// 最小更新間隔（毫秒）
const MIN_INTERVAL = 5000;

const axios = inject("axios");
const props = defineProps({
    isVisible: {
        type: Boolean,
        default: false,
    },
});

// 重整間隔設定
const showIntervalDialog = ref(false);
const tempInterval = ref("30");

// 使用 computed 包裝 localStorage 值
const currentStoredValue = localStorage.getItem("rate-limit-refresh-interval");
if (currentStoredValue) {
    const parsedValue = parseInt(currentStoredValue);
    if (!isNaN(parsedValue) && parsedValue < MIN_INTERVAL) {
        localStorage.setItem("rate-limit-refresh-interval", MIN_INTERVAL.toString());
    }
}

// 初始化 refreshInterval
const refreshInterval = useLocalStorage("rate-limit-refresh-interval", 30000, {
    onSet: (value) => {
        return Math.max(value, MIN_INTERVAL);
    },
});

// 查詢限流狀態
const {
    data: rateLimitStatus,
    isLoading,
    isFetching,
    error,
    refetch,
} = useQuery({
    queryKey: ["rateLimitStatus"],
    queryFn: async () => {
        const response = await axios.get("/system/getRateLimitStatus");
        return response.data.data;
    },
    refetchInterval: computed(() => Math.max(refreshInterval.value, MIN_INTERVAL)),
});

// 格式化顯示間隔時間
const formattedInterval = computed(() => {
    const seconds = refreshInterval.value / 1000;
    if (seconds >= 60) {
        return `${seconds / 60} 分鐘`;
    }
    return `${seconds} 秒`;
});

// 更新間隔設定
const updateInterval = () => {
    const newInterval = parseInt(tempInterval.value);
    if (newInterval && newInterval > 0) {
        refreshInterval.value = Math.max(newInterval * 1000, MIN_INTERVAL);
        showIntervalDialog.value = false;
    }
};

// 系統使用率數據
const systemUsageData = computed(() => {
    if (!rateLimitStatus.value) return null;

    return {
        system: {
            name: "系統整體",
            current: rateLimitStatus.value.systemWide.currentCount,
            limit: rateLimitStatus.value.systemWide.limit,
            usage: (
                (rateLimitStatus.value.systemWide.currentCount / rateLimitStatus.value.systemWide.limit) *
                100
            ).toFixed(1),
        },
        experts: {
            name: "專家整體",
            current: rateLimitStatus.value.allExperts.currentCount,
            limit: rateLimitStatus.value.allExperts.limit,
            usage: (
                (rateLimitStatus.value.allExperts.currentCount / rateLimitStatus.value.allExperts.limit) *
                100
            ).toFixed(1),
        },
    };
});

// 使用者數據處理
const userUsageData = computed(() => {
    if (!rateLimitStatus.value?.users) return [];
    return Object.entries(rateLimitStatus.value.users)
        .map(([userId, data]) => ({
            id: userId,
            name: data.name,
            authId: data.authId,
            usage: ((data.currentCount / data.limit) * 100).toFixed(1),
            current: data.currentCount,
            limit: data.limit,
            remainingTime: Math.ceil(data.remainingTime / 60000),
            isLimited: data.isLimited,
        }))
        .sort((a, b) => parseFloat(b.usage) - parseFloat(a.usage));
});

// 添加專家使用率數據處理
const expertUsageData = computed(() => {
    if (!rateLimitStatus.value?.expertSpecific) return [];

    return Object.entries(rateLimitStatus.value.expertSpecific)
        .map(([expertId, data]) => ({
            id: expertId,
            name: data.name,
            usage: ((data.currentCount / data.limit) * 100).toFixed(1),
            current: data.currentCount,
            limit: data.limit,
            remainingTime: Math.ceil(data.remainingTime / 60000),
            isLimited: data.isLimited,
        }))
        .sort((a, b) => parseFloat(b.usage) - parseFloat(a.usage));
});

// 計算使用者分布
const usageDistribution = computed(() => {
    if (!userUsageData.value) return [];
    const ranges = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"];
    const distribution = new Array(5).fill(0);

    userUsageData.value.forEach((user) => {
        const usage = parseFloat(user.usage);
        const index = Math.min(Math.floor(usage / 20), 4);
        distribution[index]++;
    });

    return ranges.map((range, index) => ({
        range,
        count: distribution[index],
    }));
});

// 圖表實例
let usageChart = null;
let distributionChart = null;

// 初始化圖表
const initCharts = async () => {
    await nextTick();

    // 只有在圖表不存在時才初始化
    if (!usageChart) {
        const usageChartEl = document.getElementById("usageChart");
        if (usageChartEl) {
            usageChart = echarts.init(usageChartEl);
        }
    }

    if (!distributionChart) {
        const distributionChartEl = document.getElementById("distributionChart");
        if (distributionChartEl) {
            distributionChart = echarts.init(distributionChartEl);
        }
    }

    // 初始化後更新數據
    updateCharts();
};

// 視窗大小調整處理
const handleResize = () => {
    if (props.isVisible) {
        usageChart?.resize();
        distributionChart?.resize();
    }
};

// 生命週期處理
onMounted(() => {
    if (refreshInterval.value < MIN_INTERVAL) {
        refreshInterval.value = MIN_INTERVAL;
    }
    window.addEventListener("resize", handleResize);
});

// 監聽可見性和數據變化
watch(
    () => [props.isVisible, rateLimitStatus.value],
    async ([isVisible, status]) => {
        if (isVisible && status) {
            await initCharts();
        }
    },
    { immediate: true }
);

// 更新圖表配置
const updateCharts = () => {
    if (!rateLimitStatus.value) return;

    const usageOption = {
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: function (params) {
                const data = params[0].data;
                return `${data.name}<br/>
                        使用量: ${data.current}/${data.limit}<br/>
                        使用率: ${data.usage}%`;
            },
        },
        grid: {
            top: "5%",
            left: "3%",
            right: "4%",
            bottom: "3%",
            containLabel: true,
        },
        xAxis: {
            type: "value",
            max: 100,
            axisLabel: {
                formatter: "{value}%",
                fontSize: 12,
            },
        },
        yAxis: {
            type: "category",
            data: userUsageData.value.slice(0, 10).map((user) => user.name || user.authId || `User ${user.id}`),
            axisLabel: {
                width: 100,
                overflow: "truncate",
                fontSize: 12,
            },
        },
        series: [
            {
                type: "bar",
                data: userUsageData.value.slice(0, 10).map((user) => ({
                    value: user.usage,
                    name: user.name || user.authId || `User ${user.id}`,
                    current: user.current,
                    limit: user.limit,
                    usage: user.usage,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                            { offset: 0, color: "#83bff6" },
                            { offset: 0.5, color: "#188df0" },
                            { offset: 1, color: parseFloat(user.usage) > 80 ? "#ff4444" : "#188df0" },
                        ]),
                    },
                })),
                label: {
                    show: true,
                    position: "right",
                    formatter: "{c}%",
                    fontSize: 12,
                },
                barWidth: "60%",
            },
        ],
    };

    const distributionOption = {
        tooltip: {
            trigger: "item",
            formatter: "{b}: {c} ({d}%)",
        },
        legend: {
            orient: "horizontal",
            bottom: 0,
            data: usageDistribution.value.map((item) => item.range),
        },
        series: [
            {
                type: "pie",
                radius: ["40%", "70%"],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: "#fff",
                    borderWidth: 2,
                },
                label: {
                    show: false,
                    position: "center",
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: "16",
                        fontWeight: "bold",
                    },
                },
                labelLine: {
                    show: false,
                },
                data: usageDistribution.value.map((item) => ({
                    name: item.range,
                    value: item.count,
                })),
            },
        ],
    };

    if (usageChart) {
        usageChart.setOption(usageOption, { notMerge: false }); // 使用 merge 模式更新
    }
    if (distributionChart) {
        distributionChart.setOption(distributionOption, { notMerge: false });
    }
};

const cleanup = () => {
    if (usageChart) {
        usageChart.dispose();
        usageChart = null;
    }
    if (distributionChart) {
        distributionChart.dispose();
        distributionChart = null;
    }
};

onUnmounted(() => {
    window.removeEventListener("resize", handleResize);
    cleanup();
});
</script>

<template>
    <div class="rate-limit-status-view">
        <v-fade-transition>
            <div v-if="isLoading" class="loading-overlay">
                <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
            </div>
        </v-fade-transition>

        <UseWindowSize v-slot="{ width }">
            <div class="d-flex flex-column">
                <!-- 標題卡片 -->
                <v-card class="mb-6" elevation="2">
                    <div class="px-6 pt-4 pb-2">
                        <div class="d-flex align-center">
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-pulse" size="32" color="primary" class="mr-3"></v-icon>
                                <div>
                                    <div class="text-h5 font-weight-bold">系統限流監控</div>
                                    <div class="mt-1 text-body-2 text-medium-emphasis">即時監控系統資源使用狀況</div>
                                </div>
                            </div>
                            <v-spacer></v-spacer>
                            <div class="d-flex align-center">
                                <v-btn
                                    prepend-icon="mdi-timer-cog-outline"
                                    color="primary"
                                    @click="showIntervalDialog = true"
                                    variant="tonal"
                                    class="mr-2"
                                >
                                    設定自動更新頻率 (目前: {{ formattedInterval }})
                                </v-btn>
                                <v-btn
                                    prepend-icon="mdi-refresh"
                                    color="primary"
                                    @click="refetch"
                                    variant="tonal"
                                    :loading="isLoading || isFetching"
                                    :disabled="isLoading || isFetching"
                                >
                                    更新資料
                                </v-btn>
                            </div>
                        </div>
                    </div>
                </v-card>

                <!-- 系統狀態卡片 -->
                <v-row v-if="systemUsageData">
                    <v-col cols="12" md="6">
                        <v-card elevation="2" class="system-card">
                            <v-card-text>
                                <div class="mb-2 d-flex align-center">
                                    <v-icon size="28" color="primary" class="mr-2">mdi-server</v-icon>
                                    <span class="text-h6">系統使用率</span>
                                </div>
                                <div class="mt-4">
                                    <div class="mb-1 d-flex justify-space-between">
                                        <span class="text-medium-emphasis">當前使用量</span>
                                        <span class="font-weight-medium"
                                            >{{ systemUsageData.system.current }}/{{
                                                systemUsageData.system.limit
                                            }}</span
                                        >
                                    </div>
                                    <v-progress-linear
                                        :model-value="parseFloat(systemUsageData.system.usage)"
                                        :color="parseFloat(systemUsageData.system.usage) > 80 ? 'error' : 'primary'"
                                        height="24"
                                        rounded
                                    >
                                        <template v-slot:default="{ value }">
                                            <span class="font-weight-medium">{{ value }}%</span>
                                        </template>
                                    </v-progress-linear>
                                </div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                    <v-col cols="12" md="6">
                        <v-card elevation="2" class="system-card">
                            <v-card-text>
                                <div class="mb-2 d-flex align-center">
                                    <v-icon size="28" color="primary" class="mr-2">mdi-account-group</v-icon>
                                    <span class="text-h6">專家使用率</span>
                                </div>
                                <div class="mt-4">
                                    <div class="mb-1 d-flex justify-space-between">
                                        <span class="text-medium-emphasis">當前使用量</span>
                                        <span class="font-weight-medium"
                                            >{{ systemUsageData.experts.current }}/{{
                                                systemUsageData.experts.limit
                                            }}</span
                                        >
                                    </div>
                                    <v-progress-linear
                                        :model-value="parseFloat(systemUsageData.experts.usage)"
                                        :color="parseFloat(systemUsageData.experts.usage) > 80 ? 'error' : 'info'"
                                        height="24"
                                        rounded
                                    >
                                        <template v-slot:default="{ value }">
                                            <span class="font-weight-medium">{{ value }}%</span>
                                        </template>
                                    </v-progress-linear>
                                </div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <!-- 圖表卡片 -->
                <v-row class="mt-4">
                    <v-col cols="12" md="6">
                        <v-card elevation="2" class="chart-card">
                            <v-card-title class="px-6 py-4 d-flex align-center">
                                <v-icon icon="mdi-chart-bar" color="primary" class="mr-2"></v-icon>
                                使用率排行
                            </v-card-title>
                            <v-card-text>
                                <div id="usageChart" style="height: 300px"></div>
                            </v-card-text>
                        </v-card>
                    </v-col>

                    <v-col cols="12" md="6">
                        <v-card elevation="2" class="chart-card">
                            <v-card-title class="px-6 py-4 d-flex align-center">
                                <v-icon icon="mdi-chart-pie" color="primary" class="mr-2"></v-icon>
                                使用率分布
                            </v-card-title>
                            <v-card-text>
                                <div id="distributionChart" style="height: 300px"></div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <!-- 詳細數據表格 -->
                <v-card class="mt-6" elevation="2">
                    <v-card-title class="px-6 py-4">
                        <v-icon icon="mdi-table" color="primary" class="mr-2"></v-icon>
                        詳細使用狀況
                    </v-card-title>
                    <v-card-text>
                        <v-data-table
                            :headers="[
                                { title: '使用者名稱', key: 'name', align: 'start' },
                                { title: '使用者編號', key: 'authId', align: 'start' },
                                { title: '當前使用量', key: 'current', align: 'start' },
                                { title: '限制數量', key: 'limit', align: 'start' },
                                { title: '使用率', key: 'usage', align: 'start' },
                                { title: '剩餘時間', key: 'remainingTime', align: 'start' },
                                { title: '狀態', key: 'status', align: 'start' },
                            ]"
                            :items="userUsageData"
                            :items-per-page="10"
                            class="elevation-0"
                        >
                            <template v-slot:item="{ item }">
                                <tr>
                                    <td>{{ item.name }}</td>
                                    <td>{{ item.authId }}</td>
                                    <td>{{ item.current }}</td>
                                    <td>{{ item.limit }}</td>
                                    <td style="min-width: 150px">
                                        <v-progress-linear
                                            :model-value="parseFloat(item.usage)"
                                            :color="parseFloat(item.usage) > 80 ? 'error' : 'primary'"
                                            height="20"
                                            rounded
                                        >
                                            <template v-slot:default="{ value }">
                                                <span class="font-weight-medium white--text">{{ value }}%</span>
                                            </template>
                                        </v-progress-linear>
                                    </td>
                                    <td>{{ item.remainingTime }}分鐘</td>
                                    <td>
                                        <v-chip
                                            :color="
                                                item.isLimited
                                                    ? 'error'
                                                    : parseFloat(item.usage) > 80
                                                    ? 'warning'
                                                    : 'success'
                                            "
                                            :text="
                                                item.isLimited
                                                    ? '已限制'
                                                    : parseFloat(item.usage) > 80
                                                    ? '接近限制'
                                                    : '正常'
                                            "
                                            size="small"
                                        ></v-chip>
                                    </td>
                                </tr>
                            </template>
                        </v-data-table>
                    </v-card-text>
                </v-card>

                <v-card class="mt-6" elevation="2">
                    <v-card-title class="px-6 py-4">
                        <v-icon icon="mdi-account-tie" color="primary" class="mr-2"></v-icon>
                        專家使用狀況
                    </v-card-title>
                    <v-card-text>
                        <v-data-table
                            :headers="[
                                { title: '專家名稱', key: 'name', align: 'start' },
                                { title: '當前使用量', key: 'current', align: 'start' },
                                { title: '限制數量', key: 'limit', align: 'start' },
                                { title: '使用率', key: 'usage', align: 'start' },
                                { title: '剩餘時間', key: 'remainingTime', align: 'start' },
                                { title: '狀態', key: 'status', align: 'start' },
                            ]"
                            :items="expertUsageData"
                            :items-per-page="10"
                            class="elevation-0"
                        >
                            <template v-slot:item="{ item }">
                                <tr>
                                    <td>{{ item.name }}</td>
                                    <td>{{ item.current }}</td>
                                    <td>{{ item.limit }}</td>
                                    <td style="min-width: 150px">
                                        <v-progress-linear
                                            :model-value="parseFloat(item.usage)"
                                            :color="parseFloat(item.usage) > 80 ? 'error' : 'info'"
                                            height="20"
                                            rounded
                                        >
                                            <template v-slot:default="{ value }">
                                                <span class="font-weight-medium white--text">{{ value }}%</span>
                                            </template>
                                        </v-progress-linear>
                                    </td>
                                    <td>{{ item.remainingTime }}分鐘</td>
                                    <td>
                                        <v-chip
                                            :color="
                                                item.isLimited
                                                    ? 'error'
                                                    : parseFloat(item.usage) > 80
                                                    ? 'warning'
                                                    : 'success'
                                            "
                                            :text="
                                                item.isLimited
                                                    ? '已限制'
                                                    : parseFloat(item.usage) > 80
                                                    ? '接近限制'
                                                    : '正常'
                                            "
                                            size="small"
                                        ></v-chip>
                                    </td>
                                </tr>
                            </template>
                        </v-data-table>
                    </v-card-text>
                </v-card>

                <!-- 更新間隔設定對話框 -->
                <v-dialog v-model="showIntervalDialog" max-width="400px">
                    <v-card>
                        <v-card-title class="text-h6 pa-4"> 設定更新間隔 </v-card-title>
                        <v-card-text class="pt-4">
                            <v-text-field
                                v-model="tempInterval"
                                label="更新間隔 (秒)"
                                type="number"
                                min="5"
                                :rules="intervalRules"
                                hide-details="auto"
                                density="comfortable"
                            ></v-text-field>
                            <div class="mt-2 text-caption text-medium-emphasis">目前設定: {{ formattedInterval }}</div>
                        </v-card-text>
                        <v-card-actions class="pa-4">
                            <v-spacer></v-spacer>
                            <v-btn color="grey-darken-1" variant="text" @click="showIntervalDialog = false">
                                取消
                            </v-btn>
                            <v-btn color="primary" variant="text" @click="updateInterval"> 儲存 </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
            </div>
        </UseWindowSize>
    </div>
</template>

<style lang="scss" scoped>
.rate-limit-status-view {
    width: 100%;
    height: 100%;
    position: relative;

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .system-card {
        height: 100%;
        transition: transform 0.2s, box-shadow 0.2s;

        &:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 25px 0 rgba(0, 0, 0, 0.1);
        }
    }

    .chart-card {
        transition: transform 0.2s, box-shadow 0.2s;

        &:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 25px 0 rgba(0, 0, 0, 0.1);
        }
    }
    :deep(.v-table) {
        thead {
            th {
                white-space: nowrap;
                background-color: rgb(var(--v-theme-surface));
                text-align: left !important;
                padding: 0 16px !important;
                vertical-align: middle;
            }
        }

        tr {
            td {
                padding: 8px 16px !important;
                height: 52px !important;
                vertical-align: middle;
            }

            &:hover {
                background-color: rgba(var(--v-theme-primary), 0.05);
            }
        }
    }
}
</style>
