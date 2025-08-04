<script setup>
import { ref, onMounted, onUnmounted, inject, computed, watchEffect } from "vue";
import { useRoute } from "vue-router";
const route = useRoute();
import { useExpertStore } from "@/store";
const expertStore = useExpertStore();
const expert = computed(() => expertStore.expertList.find((e) => e.id === route.params.expert_id));

import FeedbackBar from "@/components/echarts/FeedbackBar.vue";
import FeedbackRate from "@/components/echarts/FeedbackRate.vue";
import UnResolveFeedback from "@/components/echarts/UnResolveFeedback.vue";

import dayjs from "dayjs";

import { getDateFromPeriod } from "@/utils/echart";
import { fetchFeedbackChart } from "@/network/service";
const emitter = inject("emitter");

// 日期區間選項
const dateOptions = ref([
    { title: "今天", value: "1" },
    { title: "過去7天", value: "7" },
    { title: "過去4週", value: "28" },
    { title: "過去3個月", value: "92" },
    { title: "過去12個月", value: "365" },
]);
const selectOption = ref(dateOptions.value[1]);
async function handleDateChange(item) {
    if (selectOption.value !== item) {
        selectOption.value = item;
        getChartData(item);
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

// 總-統計資料
const statisticalData = ref({
    dailyData: [],
    feedbackRatio: {
        ratio: 0,
        totalFeedbackNum: 0,
        totalMsgNum: 0,
    },
});
// 圖表資料 - 每日評論統計
const feedbackBarChartData = computed(() => {
    if (hideNoData.value) {
        const tempObj = JSON.parse(JSON.stringify(statisticalData.value.dailyData));
        return tempObj.filter((e) => e.noFeedbackNum || e.userPositive || e.userNegative);
    } else {
        return statisticalData.value.dailyData;
    }
});
// 圖表資料 - 用戶評論比率
const percentageChartData = computed(() => {
    return statisticalData.value.feedbackRatio;
});
// 圖表資料 - 未處理評論統計
const unresolvedChartData = computed(() => {
    if (hideNoData.value) {
        const tempObj = JSON.parse(JSON.stringify(statisticalData.value.dailyData));
        return tempObj.filter((e) => e.notDoneFeedbacks);
    } else {
        return statisticalData.value.dailyData;
    }
});

const getChartData = async (dayRange) => {
    const today = dayjs();
    const startTime = today.subtract(dayRange.value - 1, "day");

    const reqBody = {
        expertId: route.params.expert_id,
        startTime: `${startTime.format("YYYY-MM-DD")}T00:00:00Z`,
        endTime: `${today.format("YYYY-MM-DD")}T23:59:59Z`,
    };

    const rs = await fetchFeedbackChart(reqBody);
    if (rs) {
        if (rs.data && rs.data.data) {
            statisticalData.value = rs.data.data;
        }
    } else {
        console.error("取得評論-統計資料時發生問題。");
        emitter.emit("openSnackbar", {
            message: "統計資料有誤，請聯繫維護單位。",
            color: "error",
        });
        return;
    }
};

// 自動更新狀態
const isAutoSync = ref(false);
let autoSyncInterval = null;
function toggleAutoSync() {
    if (isAutoSync.value) {
        autoSyncInterval = setInterval(() => getChartData(selectOption.value), 3000);
    } else {
        clearInterval(autoSyncInterval);
    }
}

onMounted(() => {
    getChartData(selectOption.value);
});

onUnmounted(() => {
    clearInterval(autoSyncInterval);
});
</script>

<template>
    <div class="d-flex flex-column">
        <div class="align-center d-flex ga-3">
            <p class="text-h6">週期</p>
            <v-menu>
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props">
                        {{ selectOption.title }}
                        <v-icon right>mdi-menu-down</v-icon>
                    </v-btn>
                </template>
                <v-list>
                    <v-list-item v-for="(item, index) in dateOptions" :key="index" @click="handleDateChange(item)">
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
        <div class="overflow-y-auto flex-1-1 pa-3">
            <v-row>
                <v-col>
                    <FeedbackBar
                        :feedbackData="feedbackBarChartData"
                        :subtitle="selectOption.title"
                        :startDate="startDate"
                        :endDate="endDate"
                        :hideNoData="hideNoData"
                        :expert="expert"
                    />
                </v-col>
            </v-row>
            <v-row class="d-flex justify-space-between">
                <v-col cols="12" md="6">
                    <FeedbackRate
                        :rateData="percentageChartData"
                        :subtitle="selectOption.title"
                        :startDate="startDate"
                        :endDate="endDate"
                        :hideNoData="hideNoData"
                        :expert="expert"
                    />
                </v-col>

                <v-col cols="12" md="6">
                    <UnResolveFeedback
                        :unResolvedData="unresolvedChartData"
                        :subtitle="selectOption.title"
                        :startDate="startDate"
                        :endDate="endDate"
                        :hideNoData="hideNoData"
                        :expert="expert"
                    />
                </v-col>
            </v-row>
        </div>
    </div>
</template>

<style scoped>
.title {
    color: black;
    font-weight: bold;
    display: flex;
    align-items: center;
}
</style>
