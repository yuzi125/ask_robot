<script setup>
import { ref, watchEffect, onUnmounted, computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useRoute } from "vue-router";
const route = useRoute();
const datasets_id = route.params.datasets_id;

import { useStateStore } from "@/store/index";
const stateStore = useStateStore();

import { getDateFromPeriod } from "@/utils/echart";
import { fetchDatasetsOverview, fetchDatasetsChunks, fetchDatasetChartData } from "@/network/service";

import EmbeddingCost from "@/components/echarts/EmbeddingCost.vue";
import TopCard from "@/components/datasets/TopCard.vue";

const props = defineProps({
    datasets_id: {
        type: String,
        default: "",
    },
});

// 日期選項
const dateOptions = ref([
    { title: "今天", value: "1 days" },
    { title: "過去7天", value: "7 days" },
    { title: "過去4週", value: "28 days" },
    { title: "過去3個月", value: "3 mons" },
    { title: "過去12個月", value: "12 mons" },
]);
const selectOption = ref(dateOptions.value[1]); // 預設選擇過去7天
async function handleChange(item) {
    if (selectOption.value !== item) {
        selectOption.value = item;
        getChartsData();
    }
}

// 計算起訖日期(傳入圖表，產製檔案名稱用)
const startDate = ref("");
const endDate = ref("");
watchEffect(() => {
    if (selectOption.value) {
        const data = getDateFromPeriod(selectOption.value.value);
        startDate.value = data.startDate;
        endDate.value = data.endDate;
    } else {
        startDate.value = "";
        endDate.value = "";
    }
});

// 隱藏沒有資料的日期
const hideNoData = ref(false);

// 計數器資料
const counterData = ref({
    cost: {
        icon: {
            code: "mdi mdi-currency-usd",
            size: "48px",
        },
        title: "花費",
        data: {
            tokens: {
                value: 0,
                unit: "Tokens",
            },
            // 其他貨幣單位
        },
    },
    upload: {
        icon: {
            code: "mdi mdi-upload",
            size: "44px",
        },
        title: "上傳",
        data: {
            files: {
                value: 0,
                unit: "份文件",
            },
            images: {
                value: 0,
                unit: "張圖片",
            },
        },
    },
    crawler: {
        icon: {
            code: "mdi mdi-spider",
            size: "56px",
        },
        title: "爬蟲",
        data: {
            sites: {
                value: 0,
                unit: "個站點",
            },
            files: {
                value: 0,
                unit: "份文件",
            },
        },
    },
    chunks: {
        icon: {
            code: "mdi mdi-file-document-outline",
            size: "56px",
        },
        title: "Chunks",
        data: {
            chunks: {
                value: 0,
                unit: "個",
            },
        },
    },
});

// 自動更新查詢key - 更新查詢key，讓vue-query重新查詢
const autoSyncKey = ref(0);

// 計數器資料(花費、上傳、爬蟲)
const {
    data: overviewData,
    isLoading: overviewLoading,
    status: overviewStatus,
} = useQuery({
    queryKey: computed(() => ["datasets_overview", props.datasets_id]),
    queryFn: () => fetchDatasetsOverview(props.datasets_id),
});

watchEffect(() => {
    if (overviewStatus.value !== "success") return;
    // 如果沒有資料，則顯示則設定為 null
    if (!overviewData.value) {
        counterData.value.cost.data.USD = { value: null, unit: "USD" };
        counterData.value.cost.data.tokens = { value: null, unit: "Tokens" };
        counterData.value.upload.data.files = { value: null, unit: "份文件" };
        counterData.value.upload.data.images = { value: null, unit: "張圖片" };
        counterData.value.crawler.data.sites = { value: null, unit: "個站點" };
        counterData.value.crawler.data.files = { value: null, unit: "份文件" };
        return;
    }
    // 如果資料存在，則設定資料(根據查詢到的幣值新增幣值資料)
    let currencyList = Object.keys(overviewData.value.cost).filter((key) => key !== "tokens");
    currencyList.forEach((currency) => {
        counterData.value.cost.data[currency] = {
            value: overviewData.value.cost[currency],
            unit: currency,
        };
    });
    counterData.value.cost.data.tokens.value = overviewData.value.cost.tokens;
    counterData.value.upload.data.files.value = overviewData.value.upload.files;
    counterData.value.upload.data.images.value = overviewData.value.upload.images;
    counterData.value.crawler.data.sites.value = overviewData.value.crawler.sites;
    counterData.value.crawler.data.files.value = overviewData.value.crawler.files;
});

// 計數器資料(Chunks)
const {
    data: chunksNumber,
    isLoading: chunksLoading,
    status: chunksStatus,
} = useQuery({
    queryKey: computed(() => ["datasets_chunks", props.datasets_id]),
    queryFn: () => fetchDatasetsChunks(props.datasets_id),
});

watchEffect(() => {
    if (chunksStatus.value !== "success") return;
    if (!chunksNumber.value) {
        counterData.value.chunks.data.chunks.value = null;
        return;
    }
    counterData.value.chunks.data.chunks.value = chunksNumber.value.chunks;
});

// 圖表 : embedding 花費資料
const {
    data: embeddingCostData,
    isLoading: embeddingCostLoading,
    status: embeddingCostStatus,
} = useQuery({
    queryKey: computed(() => ["embedding_cost_data", props.datasets_id, selectOption.value.value, autoSyncKey.value]),
    queryFn: () => fetchDatasetChartData(props.datasets_id, selectOption.value.value, "embedding_cost"),
    select: (response) => response.data,
});

const displayEmbeddingCostData = computed(() => {
    if (hideNoData.value) {
        return {
            dailyCostData: embeddingCostData.value.dailyCostData?.filter((item) => item.token !== 0),
            totalCost: embeddingCostData.value.totalCost,
        };
    }
    return embeddingCostData.value;
});

// 自動更新狀態
const isAutoSync = ref(false);
let autoSyncInterval = null;
function toggleAutoSync() {
    if (isAutoSync.value) {
        autoSyncInterval = setInterval(() => {
            autoSyncKey.value++; // 更新查詢key，讓vue-query重新查詢
        }, 3000);
    } else {
        clearInterval(autoSyncInterval);
    }
}

onUnmounted(() => {
    clearInterval(autoSyncInterval);
});
</script>

<template>
    <v-container fluid>
        <div style="max-width: 1600px; margin: 0 auto">
            <!-- 動態數字卡片 -->
            <p class="text-h6 font-weight-bold d-flex align-center">
                知識庫總覽
                <v-tooltip location="top">
                    <template v-slot:activator="{ props }">
                        <v-icon v-bind="props" size="x-small" class="ml-2">mdi-information</v-icon>
                    </template>
                    顯示此知識庫目前有效的文件、爬蟲、chunk數量以及至今的流量與花費總量。
                </v-tooltip>
            </p>
            <v-row class="mb-6">
                <v-col cols="12" sm="12" md="6" lg="3" xl="3">
                    <TopCard
                        :iconData="counterData.cost.icon"
                        :title="counterData.cost.title"
                        :mainData="counterData.cost.data.tokens"
                        :subData="Object.values(counterData.cost.data)[1]"
                        :loading="overviewLoading"
                    />
                </v-col>

                <v-col cols="12" sm="12" md="6" lg="3" xl="3">
                    <TopCard
                        :iconData="counterData.upload.icon"
                        :title="counterData.upload.title"
                        :mainData="counterData.upload.data.files"
                        :subData="counterData.upload.data.images"
                        :loading="overviewLoading"
                    />
                </v-col>

                <v-col cols="12" sm="12" md="6" lg="3" xl="3">
                    <TopCard
                        :iconData="counterData.crawler.icon"
                        :title="counterData.crawler.title"
                        :mainData="counterData.crawler.data.sites"
                        :subData="counterData.crawler.data.files"
                        :loading="overviewLoading"
                    />
                </v-col>

                <v-col cols="12" sm="12" md="6" lg="3" xl="3">
                    <TopCard
                        :iconData="counterData.chunks.icon"
                        :title="counterData.chunks.title"
                        :mainData="counterData.chunks.data.chunks"
                        :loading="chunksLoading"
                    />
                </v-col>
            </v-row>
            <!-- 功能列 -->
            <p class="text-h6 font-weight-bold d-flex align-center">
                統計資料查詢
                <v-tooltip location="top">
                    <template v-slot:activator="{ props }">
                        <v-icon v-bind="props" size="x-small" class="ml-2">mdi-information</v-icon>
                    </template>
                    根據選擇的週期搜尋統計資料。
                </v-tooltip>
            </p>
            <div class="d-flex align-center ga-4">
                <p class="text-h6">週期</p>
                <v-menu>
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props">
                            {{ selectOption.title }}
                            <v-icon right>mdi-menu-down</v-icon>
                        </v-btn>
                    </template>
                    <v-list>
                        <v-list-item v-for="(item, index) in dateOptions" :key="index" @click="handleChange(item)">
                            <v-list-item-title>{{ item.title }}</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
                <v-switch v-model="isAutoSync" hide-details color="primary" @change="toggleAutoSync">
                    <template v-slot:label>
                        <span>自動更新狀態</span>
                        <v-tooltip activator="parent" location="top"> 開啟後，每三秒會自動更新檔案狀態 </v-tooltip>
                    </template>
                </v-switch>
                <v-tooltip text="只顯示有資料的日期">
                    <template v-slot:activator="{ props }">
                        <v-checkbox v-model="hideNoData" v-bind="props" label="隱藏無資料日" hide-details></v-checkbox>
                    </template>
                </v-tooltip>
            </div>
            <!-- 嵌入成本 -->
            <v-row>
                <v-col sm="12" md="12">
                    <EmbeddingCost
                        :costData="displayEmbeddingCostData"
                        :subtitle="selectOption.title"
                        :height="'300px'"
                        :startDate="startDate"
                        :endDate="endDate"
                        :datasetName="stateStore.datasetsName"
                    />
                </v-col>
            </v-row>
        </div>
    </v-container>
</template>

<style scoped>
.card {
    display: flex;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 4 px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    max-width: 380px;
    width: 25%;
    min-width: 300px;
    aspect-ratio: 4/1;
    margin-bottom: 16px;
    margin-right: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.card-title {
    width: 30%;
    background-color: rgb(0, 186, 209);
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.5rem;
    font-weight: bold;
    flex-shrink: 0;
    text-align: center;
}

.card-content {
    width: 70%;
    padding: 0px 12px;
    overflow-y: auto;
}

.card-text {
    display: flex;
    justify-content: end;
    align-items: baseline;
    gap: 4px;
    cursor: pointer;
    padding: 4px 0;
    border-bottom: 2px dashed #ccc;
}

.number {
    font-size: 2rem;
    font-weight: bold;
    flex: 1 1 auto;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.unit {
    font-size: 16px;
    color: #888;
    width: 60px;
    display: inline-block;
    text-align: right;
    flex-shrink: 0;
    @media screen and (max-width: 1024px) {
        font-size: 12px;
    }
    @media screen and (max-width: 768px) {
        font-size: 10px;
    }
}
</style>
