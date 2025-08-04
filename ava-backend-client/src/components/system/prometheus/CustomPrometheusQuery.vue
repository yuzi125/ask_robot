<script setup>
import { ref, inject, computed, onMounted } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLocalStorage } from "@vueuse/core";

const axios = inject("axios");
const lastQuery = useLocalStorage("last-prometheus-query", "");
const lastQueryType = useLocalStorage("last-prometheus-query-type", "instant");
const { selectedPrometheusUrl } = inject("filterConfig");

const query = ref(lastQuery.value);
const queryType = ref(lastQueryType.value);
const shouldExecute = ref(false);

// 改用日期和時間選擇器
const startDate = ref(new Date().toISOString().substr(0, 10));
const startTime = ref("00:00");
const endDate = ref(new Date().toISOString().substr(0, 10));
const endTime = ref("23:59");

// 計算時間戳
const startTimestamp = computed(() => {
    if (!startDate.value || !startTime.value) return "";
    const [hours, minutes] = startTime.value.split(":");
    const date = new Date(startDate.value);
    date.setHours(hours, minutes, 0);
    return Math.floor(date.getTime() / 1000);
});

const endTimestamp = computed(() => {
    if (!endDate.value || !endTime.value) return "";
    const [hours, minutes] = endTime.value.split(":");
    const date = new Date(endDate.value);
    date.setHours(hours, minutes, 59);
    return Math.floor(date.getTime() / 1000);
});

const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["customFullQuery", query, queryType, startTimestamp, endTimestamp, selectedPrometheusUrl],
    queryFn: async () => {
        if (!query.value) return null;
        const params = {
            query: query.value,
            queryType: queryType.value,
            prometheusUrl: selectedPrometheusUrl.value,
        };

        if (queryType.value === "range") {
            params.start = startTimestamp.value;
            params.end = endTimestamp.value;
        }

        const response = await axios.post("/nodeExporter/customFullQuery", params);
        return response.data;
    },
    enabled: shouldExecute.value && !!query.value,
});

const executeQuery = () => {
    if (query.value) {
        lastQuery.value = query.value;
        lastQueryType.value = queryType.value;
        shouldExecute.value = true;
        refetch();
    }
};

// 設置預設的時間範圍（例如：最近24小時）
const setDefaultTimeRange = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    endDate.value = now.toISOString().substr(0, 10);
    endTime.value = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");

    startDate.value = yesterday.toISOString().substr(0, 10);
    startTime.value = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
};

// 快速時間範圍選擇
const timeRanges = [
    { title: "Last 1 hour", value: "1h" },
    { title: "Last 3 hours", value: "3h" },
    { title: "Last 6 hours", value: "6h" },
    { title: "Last 12 hours", value: "12h" },
    { title: "Last 24 hours", value: "24h" },
    { title: "Last 7 days", value: "7d" },
];

const setQuickTimeRange = (range) => {
    const now = new Date();
    const end = now;
    let start;

    const [value, unit] = [parseInt(range), range.slice(-1)];
    if (unit === "h") {
        start = new Date(now.getTime() - value * 60 * 60 * 1000);
    } else if (unit === "d") {
        start = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    }

    startDate.value = start.toISOString().substr(0, 10);
    startTime.value =
        start.getHours().toString().padStart(2, "0") + ":" + start.getMinutes().toString().padStart(2, "0");

    endDate.value = end.toISOString().substr(0, 10);
    endTime.value = end.getHours().toString().padStart(2, "0") + ":" + end.getMinutes().toString().padStart(2, "0");
};

// 組件掛載時設置預設時間範圍
onMounted(() => {
    setDefaultTimeRange();
});
</script>

<template>
    <div class="custom-query-container">
        <div class="mb-4 query-controls">
            <v-card class="pa-4">
                <v-row>
                    <v-col cols="12">
                        <v-textarea
                            v-model="query"
                            label="PromQL Query"
                            rows="3"
                            placeholder="Enter your PromQL query here"
                            hide-details
                            class="mb-2"
                        />
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" md="4">
                        <v-select
                            v-model="queryType"
                            :items="[
                                { title: 'Instant Query', value: 'instant' },
                                { title: 'Range Query', value: 'range' },
                            ]"
                            label="Query Type"
                        />
                    </v-col>

                    <template v-if="queryType === 'range'">
                        <v-col cols="12">
                            <v-card class="pa-2">
                                <div class="flex-wrap gap-2 d-flex">
                                    <v-btn
                                        v-for="range in timeRanges"
                                        :key="range.value"
                                        variant="outlined"
                                        size="small"
                                        @click="setQuickTimeRange(range.value)"
                                    >
                                        {{ range.title }}
                                    </v-btn>
                                </div>
                            </v-card>
                        </v-col>

                        <v-col cols="12" md="6">
                            <v-card class="pa-2">
                                <div class="mb-2 text-subtitle-2">Start Time</div>
                                <div class="gap-2 d-flex">
                                    <v-text-field
                                        v-model="startDate"
                                        type="date"
                                        label="Start Date"
                                        class="flex-grow-1"
                                    />
                                    <v-text-field
                                        v-model="startTime"
                                        type="time"
                                        label="Start Time"
                                        class="flex-grow-1"
                                    />
                                </div>
                            </v-card>
                        </v-col>

                        <v-col cols="12" md="6">
                            <v-card class="pa-2">
                                <div class="mb-2 text-subtitle-2">End Time</div>
                                <div class="gap-2 d-flex">
                                    <v-text-field v-model="endDate" type="date" label="End Date" class="flex-grow-1" />
                                    <v-text-field v-model="endTime" type="time" label="End Time" class="flex-grow-1" />
                                </div>
                            </v-card>
                        </v-col>
                    </template>

                    <v-col cols="12" class="d-flex align-center">
                        <v-btn
                            color="primary"
                            @click="executeQuery"
                            :loading="isFetching"
                            :disabled="!query || (queryType === 'range' && (!startTimestamp || !endTimestamp))"
                        >
                            Execute Query
                        </v-btn>
                    </v-col>
                </v-row>
            </v-card>
        </div>

        <v-card v-if="isError" class="mb-4">
            <v-card-text class="error--text">
                {{ error?.message || "An error occurred while executing the query" }}
            </v-card-text>
        </v-card>

        <v-card v-if="data" class="response-container">
            <v-card-text>
                <pre class="response-json">{{ JSON.stringify(data, null, 2) }}</pre>
            </v-card-text>
        </v-card>
    </div>
</template>

<style lang="scss" scoped>
.custom-query-container {
    padding: 16px;
}

.response-json {
    background-color: #f8f9fa;
    padding: 16px;
    border-radius: 4px;
    overflow-x: auto;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-all;
}

.gap-2 {
    gap: 8px;
}
</style>
