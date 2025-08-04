<script setup>
import { ref, inject, computed, watchEffect } from "vue";

const axios = inject("axios");
const emitter = inject("emitter");
import dayjs from "dayjs";
import { getDateFromPeriod } from "@/utils/echart";
import { responseNumberFormat } from "@/utils/common";
import { fetchFeedbackChart } from "@/network/service";

import AnimatedNumber from "@/components/common/AnimatedNumber.vue";
import TotalMsg from "@/components/echarts/TotalMsg.vue";
import TotalCost from "@/components/echarts/TotalCost.vue";
import FeedbackBar from "@/components/echarts/FeedbackBar.vue";
import FeedbackRate from "@/components/echarts/FeedbackRate.vue";
import UnResolveFeedback from "@/components/echarts/UnResolveFeedback.vue";
import RateLimitMonitor from "@/components/dashboard/RateLimitMonitor.vue";

const activeTab = ref("dashboard");

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
        getTotalMsg();
        getTotalCost();
        getChartData({
            title: "過去7天",
            value: "7",
        });
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

// 取得頂端列的數量資料
const topRowData = ref([
    {
        text: "使用者",
        num: 0,
        bgColor: "rgb(0, 186, 209)",
        textColor: "white",
    },
    {
        text: "專家",
        num: 0,
        bgColor: "rgb(40, 199, 111)",
        textColor: "white",
    },
    {
        text: "知識庫",
        num: 0,
        bgColor: "rgb(47, 43, 61)",
        textColor: "white",
    },
    {
        text: "技能",
        num: 0,
        bgColor: "rgb(255, 76, 81)",
        textColor: "white",
    },
    {
        text: "表單",
        num: 0,
        bgColor: "rgb(255, 159, 67)",
        textColor: "white",
    },
]);
async function getNumberData() {
    const rs = await axios.get(`/dashboardData`);
    if (rs && rs.data && rs.data.code === 0) {
        topRowData.value[0].num = responseNumberFormat(rs.data.data.users);
        topRowData.value[1].num = responseNumberFormat(rs.data.data.experts);
        topRowData.value[2].num = responseNumberFormat(rs.data.data.datasets);
        topRowData.value[3].num = responseNumberFormat(rs.data.data.skills);
        topRowData.value[4].num = responseNumberFormat(rs.data.data.forms);
    }
}
getNumberData();

// 取得全部訊息
const totalMsgData = ref([]);
async function getTotalMsg() {
    const period = selectOption.value.value;
    const rs = await axios.get(`/expert/overview?expert_id=all&period=${period}&subject=total_message`);
    if (rs && rs.data && rs.data.code === 0) {
        totalMsgData.value = rs.data.data;
    }
}
getTotalMsg();

function getFontSize(num) {
    const width = window.innerWidth;
    const isLongNumber = num > 9999 && num < 1000000;
    if (width < 520) {
        return isLongNumber ? "36px" : "48px";
    } else if (width < 768) {
        return isLongNumber ? "18px" : "24px";
    } else if (width < 1024) {
        return isLongNumber ? "24px" : "32px";
    } else {
        return isLongNumber ? "28px" : "32px";
    }
}

// 取得全部花費
const totalCostData = ref([]);
async function getTotalCost() {
    const period = selectOption.value.value;
    const rs = await axios.get(`/expert/overview?expert_id=all&period=${period}&subject=token_price`);
    if (rs && rs.data && rs.data.code === 0) {
        totalCostData.value = rs.data;
    }
}
getTotalCost();

// 取得評論資料
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
    return statisticalData.value.dailyData;
});
// 圖表資料 - 用戶評論比率
const percentageChartData = computed(() => {
    return statisticalData.value.feedbackRatio;
});
// 圖表資料 - 未處理評論統計
const unresolvedChartData = computed(() => {
    return statisticalData.value.dailyData;
});
const getChartData = async () => {
    const today = dayjs();
    const [rangeValue, rangeUnit] = selectOption.value.value.split(" ");
    let formatUnit = "";
    if (rangeUnit === "mons") {
        formatUnit = "month";
    } else {
        formatUnit = "day";
    }

    const startTime =
        rangeValue === "0"
            ? today // 如果是 "今天"，起始時間和結束時間都設為今天
            : today.subtract(parseInt(rangeValue), formatUnit);

    const reqBody = {
        expertId: "all",
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
getChartData();
</script>

<template>
    <v-container>
        <!-- Tab 切換 -->
        <v-card class="mb-6">
            <v-tabs v-model="activeTab" color="primary" align-tabs="start">
                <v-tab value="dashboard">
                    <v-icon start>mdi-view-dashboard</v-icon>
                    總覽儀表板
                </v-tab>
                <v-tab value="rate-limit">
                    <v-icon start>mdi-pulse</v-icon>
                    限流監控
                </v-tab>
            </v-tabs>
        </v-card>

        <!-- Tab 內容 -->
        <v-window v-model="activeTab">
            <!-- 原始儀表板內容 -->
            <v-window-item value="dashboard">
                <!-- 頂端列 -->
                <div class="top-cards-container">
                    <div class="dashboard-card" v-for="(item, index) in topRowData" :key="'top-data-' + index">
                        <div class="card-text" :style="{ color: item.textColor, background: item.bgColor }">
                            {{ item.text }}
                        </div>
                        <div class="card-number" :style="{ fontSize: getFontSize(item.num) }">
                            <AnimatedNumber :number="item.num" />
                        </div>
                    </div>
                </div>
                <!-- 週期選項 -->
                <v-row>
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
                                <v-list-item
                                    v-for="(item, index) in dateOptions"
                                    :key="index"
                                    @click="handleChange(item)"
                                >
                                    <v-list-item-title>{{ item.title }}</v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </v-col>
                </v-row>
                <!-- 第一排統計圖表 -->
                <v-row>
                    <v-col sm="12" md="6">
                        <TotalMsg
                            :height="'300px'"
                            :totalMsgData="totalMsgData"
                            :subtitle="selectOption.title"
                            :startDate="startDate"
                            :endDate="endDate"
                        />
                    </v-col>
                    <v-col sm="12" md="6">
                        <TotalCost
                            :height="'300px'"
                            :costData="totalCostData"
                            :subtitle="selectOption.title"
                            :startDate="startDate"
                            :endDate="endDate"
                        />
                    </v-col>
                </v-row>
                <!-- 第二排統計圖表 -->
                <v-row>
                    <v-col sm="12" md="4">
                        <FeedbackBar
                            :feedbackData="feedbackBarChartData"
                            :subtitle="selectOption.title"
                            :height="'280px'"
                            :startDate="startDate"
                            :endDate="endDate"
                        />
                    </v-col>
                    <v-col sm="12" md="4">
                        <FeedbackRate
                            :rateData="percentageChartData"
                            :subtitle="selectOption.title"
                            :height="'280px'"
                            :startDate="startDate"
                            :endDate="endDate"
                        />
                    </v-col>
                    <v-col sm="12" md="4">
                        <UnResolveFeedback
                            :unResolvedData="unresolvedChartData"
                            :subtitle="selectOption.title"
                            :height="'280px'"
                            :startDate="startDate"
                            :endDate="endDate"
                        />
                    </v-col>
                </v-row>
            </v-window-item>

            <!-- 限流監控內容 -->
            <v-window-item value="rate-limit">
                <RateLimitMonitor :is-visible="activeTab === 'rate-limit'" />
            </v-window-item>
        </v-window>
    </v-container>
</template>

<style scoped lang="scss">
.top-cards-container {
    margin-bottom: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    @media (min-width: 1280px) {
        justify-content: space-between;
    }
    .dashboard-card {
        background-color: white;
        border-radius: 5px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        width: 100%;
        aspect-ratio: 5 / 1;
        display: flex;
        @media (min-width: 520px) {
            width: 48%;
        }
        @media (min-width: 768px) {
            width: 30%;
        }
        @media (min-width: 1280px) {
            width: 18%;
        }
        .card-text {
            width: 49%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.5rem;
            font-weight: bold;
        }
        .card-number {
            width: 49%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-weight: bold;
        }
    }
}
</style>
