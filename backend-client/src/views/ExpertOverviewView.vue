<script setup>
import { ref, inject, onMounted, onUnmounted, computed, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
const route = useRoute();

import { useExpertStore } from "@/store";
const expertStore = useExpertStore();
const expert = computed(() => expertStore.expertList.find((e) => e.id === route.params.expert_id));

import TotalCost from "@/components/echarts/TotalCost.vue";
import TotalMsg from "@/components/echarts/TotalMsg.vue";
import ActiveUser from "@/components/echarts/ActiveUser.vue";
import NoAnswer from "@/components/echarts/NoAnswer.vue";
import ModelCost from "@/components/echarts/ModelCost.vue";
import AverageMsg from "@/components/echarts/AverageMsg.vue";

const axios = inject("axios");
import { getDateFromPeriod } from "@/utils/echart";

// 自動更新狀態
const isAutoSync = ref(false);
let autoSyncInterval = null;
function toggleAutoSync() {
    if (isAutoSync.value) {
        autoSyncInterval = setInterval(() => getOverview(selectOption.value), 3000);
    } else {
        clearInterval(autoSyncInterval);
    }
}

onUnmounted(() => {
    clearInterval(autoSyncInterval);
});

// 日期選項
const dateOptions = ref([
    { title: "今天", value: "0 day" },
    { title: "過去7天", value: "7 days" },
    { title: "過去4週", value: "28 days" },
    { title: "過去3個月", value: "3 mons" },
    { title: "過去12個月", value: "12 mons" },
]);
const selectOption = ref(dateOptions.value[1]);
async function handleChange(item) {
    if (selectOption.value !== item) {
        selectOption.value = item;
        await getOverview(item);
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

// 取得圖表種類
const charts = ref(null);
async function initData() {
    let rs = await axios.get("/expert/chartsSubject");
    if (rs.data.code === 0) {
        charts.value = rs.data.data;
    }
    await getOverview(selectOption.value);
}

// 畫面渲染完成後，再取值並渲染
onMounted(async () => {
    await initData();
});

// 取得圖表資料
const getOverview = async (item) => {
    const period = item.value;
    const expert_id = route.params.expert_id;

    const requests = charts.value.map((chart) => {
        const { subject } = chart;
        return axios.get(`/expert/overview?expert_id=${expert_id}&period=${period}&subject=${subject}`);
    });

    try {
        const responses = await Promise.all(requests);

        responses.forEach((rs, index) => {
            const subject = charts.value[index].subject;

            if (rs.data.code === 0) {
                switch (subject) {
                    case "token_price":
                        tokenPriceData.value = rs.data;
                        break;
                    case "total_message":
                        totalMessageData.value = rs.data;
                        break;
                    case "active_user":
                        activeUserData.value = rs.data;
                        break;
                    case "no_answer":
                        noAnswerData.value = rs.data;
                        break;
                    case "model_status":
                        modelStatusData.value = rs.data;
                        break;
                    case "average_message":
                        const newData = [];
                        rs.data.data.forEach((e) => {
                            const target = newData.find((f) => f.name === e.name);
                            if (target) {
                                target["平均訊息數量"] += e["平均訊息數量"];
                            } else {
                                newData.push(e);
                            }
                        });
                        averageMessageData.value = newData;
                        break;
                }
            }
        });
    } catch (error) {
        console.error("API 請求失敗", error);
    }
};

// 各個Echarts設定
const tokenPriceData = ref({});
const displayTokenPriceData = computed(() => {
    if (hideNoData.value) {
        const tempObj = JSON.parse(JSON.stringify(tokenPriceData.value));
        tempObj.data = tokenPriceData.value.data.filter((e) => e["輸入token數"]);
        return tempObj;
    } else {
        return tokenPriceData.value;
    }
});

const totalMessageData = ref({});
const displayTotalMessageData = computed(() => {
    if (hideNoData.value) {
        const tempObj = JSON.parse(JSON.stringify(totalMessageData.value));
        tempObj.data = totalMessageData.value.data.filter((e) => parseInt(e["訊息數"]));
        return tempObj;
    } else {
        return totalMessageData.value;
    }
});

const activeUserData = ref({});
const displayActiveUserData = computed(() => {
    if (hideNoData.value) {
        const tempObj = JSON.parse(JSON.stringify(activeUserData.value));
        tempObj.data = activeUserData.value.data.filter((e) => parseInt(e["用戶數"]));
        return tempObj;
    } else {
        return activeUserData.value;
    }
});

const noAnswerData = ref({});
const displayNoAnswerData = computed(() => {
    if (hideNoData.value) {
        const tempObj = JSON.parse(JSON.stringify(noAnswerData.value));
        tempObj.data = noAnswerData.value.data.filter((e) => parseInt(e["錯誤"]) || parseInt(e["無答案"]));
        return tempObj;
    } else {
        return noAnswerData.value;
    }
});

const modelStatusData = ref({});
const displayModelStatusData = computed(() => {
    if (hideNoData.value) {
        const tempObj = JSON.parse(JSON.stringify(modelStatusData.value));
        tempObj.data = modelStatusData.value.data.filter((e) => e["模組名稱"]);
        return tempObj;
    } else {
        return modelStatusData.value;
    }
});

const averageMessageData = ref({});
</script>

<template>
    <v-container fluid class="pt-0">
        <v-row class="sticky-top">
            <v-col cols="auto">
                <p class="text-h6">週期</p>
            </v-col>
            <v-col cols="auto">
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
            </v-col>
            <v-col cols="auto">
                <v-switch v-model="isAutoSync" hide-details color="primary" @change="toggleAutoSync">
                    <template v-slot:label>
                        <span>自動更新狀態</span>
                        <v-tooltip activator="parent" location="top"> 開啟後，每三秒會自動更新檔案狀態 </v-tooltip>
                    </template>
                </v-switch>
            </v-col>
            <v-col cols="auto">
                <v-tooltip text="只顯示有資料的日期">
                    <template v-slot:activator="{ props }">
                        <v-checkbox v-model="hideNoData" v-bind="props" label="隱藏無資料日" hide-details></v-checkbox>
                    </template>
                </v-tooltip>
            </v-col>
        </v-row>

        <v-row>
            <!-- Token 統計 -->
            <v-col cols="12">
                <TotalCost
                    :costData="displayTokenPriceData"
                    :subtitle="selectOption.title"
                    :startDate="startDate"
                    :endDate="endDate"
                    :hideNoData="hideNoData"
                    :expert="expert"
                />
            </v-col>
            <!-- 全部訊息數 -->
            <v-col cols="12">
                <TotalMsg
                    :totalMsgData="displayTotalMessageData.data"
                    :subtitle="selectOption.title"
                    :startDate="startDate"
                    :endDate="endDate"
                    :hideNoData="hideNoData"
                    :expert="expert"
                />
            </v-col>
            <!-- 活躍用戶數 -->
            <v-col cols="12">
                <ActiveUser
                    :activeUserData="displayActiveUserData.data"
                    :subtitle="selectOption.title"
                    :startDate="startDate"
                    :endDate="endDate"
                    :hideNoData="hideNoData"
                    :expert="expert"
                />
            </v-col>
            <!-- 問不到問題的數量 -->
            <v-col cols="12">
                <NoAnswer
                    :noAnswerData="displayNoAnswerData.data"
                    :subtitle="selectOption.title"
                    :startDate="startDate"
                    :endDate="endDate"
                    :hideNoData="hideNoData"
                    :expert="expert"
                />
            </v-col>
            <!-- 模組使用狀況 -->
            <v-col cols="12">
                <ModelCost
                    :modelCostData="displayModelStatusData"
                    :subtitle="selectOption.title"
                    :startDate="startDate"
                    :endDate="endDate"
                    :hideNoData="hideNoData"
                    :expert="expert"
                />
            </v-col>
            <!-- 平均訊息數量 -->
            <v-col cols="12">
                <AverageMsg
                    :averageMsgData="averageMessageData"
                    :subtitle="selectOption.title"
                    :startDate="startDate"
                    :endDate="endDate"
                    :expert="expert"
                />
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.chart-container {
    margin-bottom: 20px;
}

.date-selection {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
}

.date-input {
    padding: 5px;
    margin-right: 10px;
}

.search-btn {
    padding: 5px 10px;
    background-color: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.search-btn:hover {
    background-color: #1565c0;
}

.sticky-top {
    position: sticky;
    top: 0px;
    z-index: 1;
    background-color: white;
    align-items: center;
}
</style>
