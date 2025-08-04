<script setup>
import { ref, provide, inject, watch, computed } from "vue";
import SystemQuickCPUMemDisk from "@/components/system/prometheus/SystemQuickCPUMemDisk.vue";
import SystemPerformanceMetrics from "@/components/system/prometheus/SystemPerformanceMetrics.vue";
import CustomPrometheusQuery from "@/components/system/prometheus/CustomPrometheusQuery.vue";
import { useLocalStorage } from "@vueuse/core";
import { useQuery } from "@tanstack/vue-query";

const axios = inject("axios");
const activeTab = useLocalStorage("prometheus-active-tab", 0);

const prometheusUrl = ref([]);
const selectedPrometheusUrl = ref("");
const quickCPUMemDiskRefetch = ref(null);
const performanceMetricsRefetch = ref(null);

// 先獲取 prometheusUrl 的查詢
const { data: prometheusUrlData } = useQuery({
    queryKey: ["prometheusUrl"],
    queryFn: async () => {
        const response = await axios.get("/nodeExporter/getPrometheusUrl");
        const urls = response.data.data;
        prometheusUrl.value = urls;
        if (urls.length > 0 && !selectedPrometheusUrl.value) {
            selectedPrometheusUrl.value = urls[0].url;
        }
        return urls;
    },
});

// 獲取 instances 和 jobs 的查詢
const { data: instancesAndJobsData } = useQuery({
    queryKey: ["instancesAndJobs", selectedPrometheusUrl],
    queryFn: async () => {
        if (!selectedPrometheusUrl.value) return { instances: [], jobs: [] };

        const response = await axios.get("/nodeExporter/getInstancesAndJobs", {
            params: {
                prometheusUrl: selectedPrometheusUrl.value,
            },
        });
        return response.data.data;
    },
});

// 使用 ref 來存儲選中的值
const selectedInstanceRef = ref("");
const selectedJobRef = ref("");

// 計算屬性
const instances = computed(() => {
    return Array.isArray(instancesAndJobsData?.value) ? instancesAndJobsData.value.map((item) => item.instance) : [];
});

const jobs = computed(() => {
    return Array.isArray(instancesAndJobsData?.value) ? instancesAndJobsData.value.map((item) => item.job) : [];
});

const selectedInstance = computed({
    get: () => selectedInstanceRef.value,
    set: (value) => {
        selectedInstanceRef.value = value;
    },
});

const selectedJob = computed({
    get: () => selectedJobRef.value,
    set: (value) => {
        selectedJobRef.value = value;
    },
});

const refreshData = () => {
    quickCPUMemDiskRefetch.value?.refetchQuickCPUMemDisk();
    performanceMetricsRefetch.value?.refetchNetworkStats();
    performanceMetricsRefetch.value?.refetchDiskIO();
};

// 監聽 instancesAndJobsData 變化，設置默認值
watch(
    instancesAndJobsData,
    (newData) => {
        if (newData?.length > 0) {
            // 如果沒有選中值或當前選中值不在新數據中，設置默認值
            if (!selectedInstanceRef.value || !instances.value.includes(selectedInstanceRef.value)) {
                selectedInstanceRef.value = instances.value[0];
            }
            if (!selectedJobRef.value || !jobs.value.includes(selectedJobRef.value)) {
                selectedJobRef.value = jobs.value[0];
            }
        }
    },
    { immediate: true }
);

watch(activeTab, (newValue, oldValue) => {
    console.log("activeTab", newValue, oldValue);
});

provide("filterConfig", {
    selectedInstance,
    selectedJob,
    instances,
    jobs,
    activeTab,
    prometheusUrl,
    selectedPrometheusUrl,
});
</script>

<template>
    <div class="prometheus-view">
        <div class="filter-section">
            <v-card class="pa-4">
                <div class="flex-wrap ga-4 d-flex">
                    <template v-if="activeTab == 0">
                        <v-select
                            v-model="selectedPrometheusUrl"
                            :items="prometheusUrl"
                            :item-title="(item) => `${item.url} - (${item.name})`"
                            :item-value="(item) => item.url"
                            label="Prometheus URL"
                            class="filter-select"
                            persistent-hint="false"
                            hide-details
                        />
                        <v-select
                            v-model="selectedInstance"
                            :items="instances"
                            label="Instance"
                            class="filter-select"
                            hide-details
                        />
                        <v-select v-model="selectedJob" :items="jobs" label="Job" class="filter-select" />
                    </template>
                    <template v-else>
                        <v-select
                            v-model="selectedPrometheusUrl"
                            :items="prometheusUrl"
                            label="Prometheus URL"
                            class="filter-select"
                            hide-details
                        />
                    </template>
                    <!-- 重新刷新按鈕 -->
                    <div class="flex-grow-1"></div>
                    <!-- 推動按鈕到右邊 -->
                    <div class="d-flex align-center">
                        <v-btn
                            prepend-icon="mdi-refresh"
                            color="primary"
                            variant="tonal"
                            :class="{ 'ml-2': true }"
                            @click="refreshData"
                        >
                            刷新資料
                        </v-btn>
                    </div>
                </div>
            </v-card>
        </div>
        <div class="prometheus-content">
            <v-card>
                <v-tabs v-model="activeTab">
                    <v-tab value="0">Dashboard</v-tab>
                    <v-tab value="1">Custom Query</v-tab>
                </v-tabs>
                <v-window v-model="activeTab">
                    <v-window-item value="0">
                        <div class="pa-4">
                            <SystemQuickCPUMemDisk ref="quickCPUMemDiskRefetch" />
                            <SystemPerformanceMetrics ref="performanceMetricsRefetch" />
                        </div>
                    </v-window-item>
                    <v-window-item value="1">
                        <div class="pa-4">
                            <CustomPrometheusQuery />
                        </div>
                    </v-window-item>
                </v-window>
            </v-card>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.prometheus-view {
    position: fixed;
    left: 0;
    top: 68.5px;
    width: 100%;
    height: calc(100% - 68.5px);
    background-color: #f5f5f5;
    overflow: hidden;
}

.filter-section {
    position: relative;
    z-index: 11;
    padding: 0 1.5rem;
}

.filter-select {
    min-width: 200px;
    flex: 1;
    max-width: 300px;
}

.prometheus-content {
    height: calc(100% - 100px);
    overflow-y: auto;
    padding: 20px;
    scroll-behavior: smooth;

    &::-webkit-scrollbar {
        width: 8px;
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
</style>
