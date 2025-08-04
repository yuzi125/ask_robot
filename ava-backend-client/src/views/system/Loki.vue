<script setup>
import { ref, inject, computed, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import LogVolumeChart from "@/components/system/loki/LogVolumeChart.vue";
import TimeRangePicker from "@/components/system/loki/TimeRangePicker.vue";
const axios = inject("axios");
const emitter = inject("emitter");

// 添加這些 ref
const queryInput = ref('{application="backend-server"} |= ``');
const limitInput = ref(100);
const query = ref('{application="backend-server"} |= ``');
const limit = ref(100);

// 時間相關的狀態
const dateRange = ref({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 預設昨天
    end: new Date().toISOString().slice(0, 10), // 預設今天
});

const timeRange = ref({
    start: "00:00",
    end: "23:59",
});

// 標籤相關的狀態
const availableLabels = ref([]);
const selectedLabel = ref("application");
const labelValues = ref([]);
const selectedLabelValue = ref("backend-server");

// 日誌級別選項
const logLevels = [
    { title: "All", value: "all" },
    { title: "Info", value: "info" },
    { title: "Warn", value: "warn" },
    { title: "Error", value: "error" },
    { title: "Debug", value: "debug" },
];
const selectedLogLevel = ref("all");

// 將時間轉換為納秒時間戳
const getTimestampNano = (date, time) => {
    const datetime = new Date(`${date}T${time}`);
    return datetime.getTime() * 1e6; // 轉換為納秒
};

const buildQuery = () => {
    const startTime = getTimestampNano(dateRange.value.start, timeRange.value.start);
    const endTime = getTimestampNano(dateRange.value.end, timeRange.value.end);

    return {
        query: query.value,
        start: startTime,
        end: endTime,
        limit: parseInt(limit.value),
    };
};

const fetchLogs = async () => {
    const params = buildQuery();
    const response = await axios.get("/log/lokiQuery", { params });
    return response.data;
};

// 獲取所有可用標籤
const fetchLabels = async () => {
    const response = await axios.get("/log/lokiLabels");
    return response.data.data;
};

// 獲取特定標籤的所有可能值
const fetchLabelValues = async (labelName) => {
    const response = await axios.get(`/log/lokiLabelValues/${labelName}`);
    return response.data.data;
};

// 使用 useQuery 獲取標籤
const { data: labels } = useQuery({
    queryKey: ["lokiLabels"],
    queryFn: fetchLabels,
});

const {
    data: logs,
    isLoading,
    error,
    refetch,
} = useQuery({
    queryKey: ["logs", query],
    queryFn: fetchLogs,
});

// 搜尋按鈕點擊時的處理函數
const handleSearch = () => {
    // 直接使用輸入框的完整內容作為查詢條件
    query.value = queryInput.value;

    // 處理 limit
    const limitNum = parseInt(limit.value);
    if (limitNum > 2000) {
        limit.value = 2000;
    } else if (limitNum < 1) {
        limit.value = 1;
    }

    // 執行查詢
    refetch();
};

// 解析日誌內容
const parseLogMessage = (logStr, timestamp, application) => {
    try {
        const logObj = JSON.parse(logStr);
        if (application === "api-server") {
            return { ...logObj, timestamp: timestamp, application: "api-server" };
        }
        return {
            level: logObj.level,
            message: logObj.message,
            timestamp: timestamp,
            extra: logObj.extra,
        };
    } catch (e) {
        return { message: logStr };
    }
};

const flattenedLogs = computed(() => {
    if (!logs.value?.data) return [];
    return logs.value.data.flatMap((group) => {
        const application = group.labels.application;
        if (application === "api-server") {
            return group.entries.map((entry) => ({
                timestamp: entry.timestamp,
                ...parseLogMessage(entry.log, entry.timestamp, application),
            }));
        }
        return group.entries.map((entry) => ({
            timestamp: entry.timestamp,
            ...parseLogMessage(entry.log, entry.timestamp, application),
        }));
    });
});

const formatDateTime = (timestamp) => {
    return new Date(timestamp)
        .toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        })
        .replace(/\//g, "-");
};

// 複製功能
const copyMessage = async (message) => {
    try {
        await navigator.clipboard.writeText(JSON.stringify(message));
        emitter.emit("openSnackbar", { message: "複製成功", color: "success" });
    } catch (err) {
        console.error("Failed to copy:", err);
    }
};

// 根據日誌級別獲取顏色
const getLevelColor = (level) => {
    const colors = {
        error: "#EF5350",
        warn: "#FFB74D",
        info: "#81C784",
        debug: "#64B5F6",
    };
    return colors[level] || "grey";
};

watch(labels, (newLabels) => {
    availableLabels.value = newLabels;
});

// 監聽標籤變化，只獲取對應的值，不觸發查詢
watch(
    selectedLabel,
    async (newLabel) => {
        if (newLabel) {
            try {
                const values = await fetchLabelValues(newLabel);
                labelValues.value = values;
                if (values.length > 0) {
                    selectedLabelValue.value = values[0];
                }
            } catch (error) {
                console.error("Error fetching label values:", error);
            }
        }
    },
    { immediate: true }
);

watch([selectedLabelValue, selectedLogLevel], () => {
    if (selectedLabelValue.value && selectedLabel.value) {
        let queryStr = `{${selectedLabel.value}="${selectedLabelValue.value}"`;
        if (selectedLogLevel.value !== "all") {
            queryStr += `, level="${selectedLogLevel.value}"`;
        }
        queryStr += "} |= ``";
        queryInput.value = queryStr; // 只更新輸入框的值，不直接觸發查詢
        console.log(queryInput.value);
    }
});
</script>

<template>
    <div class="loki-view">
        <v-container fluid>
            <v-card>
                <v-card-title class="d-flex align-center pa-4 title-section">
                    <div class="d-flex align-center flex-grow-1">
                        <div class="d-flex align-center title-container">
                            <v-icon icon="mdi-text-search" color="primary" class="mr-3" size="28" />
                            <div>
                                <h2 class="mb-1 text-h6 font-weight-medium primary--text">Loki Log Viewer</h2>
                                <span class="text-caption text-medium-emphasis"> 搜尋和查看系統日誌 </span>
                            </div>
                        </div>
                    </div>
                </v-card-title>

                <v-card-text class="pa-6">
                    <v-sheet class="mb-4 rounded pa-4" color="grey-lighten-5">
                        <!-- 標籤和日誌級別選擇 -->
                        <div class="mb-4 d-flex align-center">
                            <TimeRangePicker
                                v-model:startDate="dateRange.start"
                                v-model:startTime="timeRange.start"
                                v-model:endDate="dateRange.end"
                                v-model:endTime="timeRange.end"
                            />
                        </div>
                        <v-row>
                            <v-col cols="12" md="4">
                                <v-select
                                    v-model="selectedLabel"
                                    :items="availableLabels"
                                    label="選擇標籤"
                                    clearable
                                    hide-details
                                    variant="outlined"
                                    density="comfortable"
                                />
                            </v-col>

                            <v-col cols="12" md="4">
                                <v-select
                                    v-model="selectedLabelValue"
                                    :items="labelValues"
                                    label="選擇值"
                                    clearable
                                    :disabled="!selectedLabel"
                                    hide-details
                                    variant="outlined"
                                    density="comfortable"
                                />
                            </v-col>

                            <v-col cols="12" md="4">
                                <v-select
                                    v-model="selectedLogLevel"
                                    :items="logLevels"
                                    label="Log Level"
                                    item-title="title"
                                    item-value="value"
                                    hide-details
                                    variant="outlined"
                                    density="comfortable"
                                />
                            </v-col>
                        </v-row>

                        <!-- 時間範圍選擇 -->
                        <!-- <v-row class="mt-4">
                        <v-col cols="12" md="6">
                            <div class="d-flex align-center">
                                <v-text-field
                                    v-model="dateRange.start"
                                    label="開始日期"
                                    type="date"
                                    class="mr-2"
                                    hide-details
                                    variant="outlined"
                                    density="comfortable"
                                />
                                <v-text-field
                                    v-model="timeRange.start"
                                    label="開始時間"
                                    type="time"
                                    hide-details
                                    variant="outlined"
                                    density="comfortable"
                                />
                            </div>
                        </v-col>

                        <v-col cols="12" md="6">
                            <div class="d-flex align-center">
                                <v-text-field
                                    v-model="dateRange.end"
                                    label="結束日期"
                                    type="date"
                                    class="mr-2"
                                    hide-details
                                    variant="outlined"
                                    density="comfortable"
                                />
                                <v-text-field
                                    v-model="timeRange.end"
                                    label="結束時間"
                                    type="time"
                                    hide-details
                                    variant="outlined"
                                    density="comfortable"
                                />
                            </div>
                        </v-col>
                    </v-row> -->

                        <!-- 查詢條件和限制筆數 -->
                        <v-row class="mt-4">
                            <v-col cols="12" md="9">
                                <v-text-field
                                    v-model="queryInput"
                                    label="查詢條件"
                                    placeholder="Example: {application='backend-server'} |= `處理`"
                                    clearable
                                    hint="Example: {application='backend-server'} |= `處理`"
                                    persistent-hint
                                    variant="outlined"
                                    density="comfortable"
                                />
                            </v-col>

                            <v-col cols="12" md="3">
                                <v-text-field
                                    v-model="limit"
                                    label="限制筆數"
                                    type="number"
                                    :min="1"
                                    :max="2000"
                                    hide-details
                                    variant="outlined"
                                    density="comfortable"
                                    @input="
                                        (e) => {
                                            const value = e.target.value;
                                            if (value > 2000) e.target.value = 2000;
                                            if (value < 1) e.target.value = 1;
                                        }
                                    "
                                />
                            </v-col>
                        </v-row>

                        <!-- 搜尋按鈕 -->
                        <v-row class="mt-4">
                            <v-col cols="12" class="justify-end d-flex">
                                <v-btn
                                    color="primary"
                                    size="large"
                                    :loading="isLoading"
                                    @click="handleSearch"
                                    prepend-icon="mdi-magnify"
                                >
                                    搜尋日誌
                                </v-btn>
                            </v-col>
                        </v-row>
                    </v-sheet>

                    <!-- 錯誤提示 -->
                    <v-alert v-if="error" type="error" class="mb-4">
                        {{ error.message }}
                    </v-alert>

                    <!-- 圖表 -->
                    <LogVolumeChart :logs="logs" :loading="isLoading" />

                    <!-- 日誌顯示區域 -->
                    <v-card v-if="logs?.data" class="log-table">
                        <v-data-table
                            :headers="[
                                { title: '時間戳記', key: 'timestamp', width: '200px' },
                                { title: '級別', key: 'level', width: '100px' },
                                { title: '訊息', key: 'message' },
                            ]"
                            :items="flattenedLogs"
                            hover
                            density="comfortable"
                        >
                            <template v-slot:item.timestamp="{ item }">
                                <span class="text-caption">{{ formatDateTime(item.timestamp) }}</span>
                            </template>

                            <template v-slot:item.level="{ item }">
                                <v-chip
                                    :color="getLevelColor(item.level?.toLowerCase())"
                                    size="small"
                                    class="text-caption"
                                    label
                                >
                                    {{ item.level?.toLowerCase() }}
                                </v-chip>
                            </template>

                            <template v-slot:item.message="{ item }">
                                <v-tooltip location="top" text="點擊複製">
                                    <template v-slot:activator="{ props }">
                                        <span
                                            class="text-body-2"
                                            v-bind="props"
                                            @click="copyMessage(item)"
                                            style="cursor: pointer"
                                        >
                                            <!-- {{ item.message }} -->
                                            {{ item?.application === "api-server" ? item : item.message }}
                                        </span>
                                    </template>
                                </v-tooltip>
                            </template>
                        </v-data-table>
                    </v-card>

                    <!-- Loading 狀態 -->
                    <div v-if="isLoading" class="justify-center mt-4 d-flex">
                        <v-progress-circular indeterminate color="primary" />
                    </div>
                </v-card-text>
            </v-card>
        </v-container>
    </div>
</template>

<style lang="scss" scoped>
.loki-view {
    position: fixed;
    left: 0;
    top: 68.5px;
    width: 100%;
    height: calc(100% - 68.5px);
    background-color: #f5f5f5;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 20px;
}

.log-table {
    margin-top: 15px;
    :deep(.v-data-table) {
        .v-data-table__tr {
            &:hover {
                background-color: rgb(var(--v-theme-primary-lighten-5));
            }
        }

        .v-data-table__td {
            padding: 8px 16px;
            white-space: pre-wrap;
            word-break: break-word;
        }
    }
}

.title-section {
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    background-color: rgba(var(--v-theme-on-surface-variant), 0.02);
}

.title-container {
    position: relative;

    &::after {
        content: "";
        position: absolute;
        left: -16px;
        top: 50%;
        transform: translateY(-50%);
        width: 4px;
        height: 70%;
        background-color: rgb(var(--v-theme-primary));
        border-radius: 0 4px 4px 0;
    }
}
</style>
