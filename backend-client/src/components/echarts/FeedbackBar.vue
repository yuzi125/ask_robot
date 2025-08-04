<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { dataSourceTable, excelIconPath, echartExportExcel, getExcelFileName } from "../../utils/echart";
import * as echarts from "echarts";

const props = defineProps({
    feedbackData: {
        type: Array,
        required: true,
        default: [],
    },
    subtitle: {
        type: String,
    },
    height: {
        type: String,
        default: "400px",
    },
    startDate: {
        type: String,
    },
    endDate: {
        type: String,
    },
    hideNoData: {
        type: Boolean,
        default: false,
    },
    expert: {
        type: Object,
        default: {
            name: null,
        },
    },
});

const chartDOM = ref(null);
let feedbackBarChart = null;

const dailyFeedbackBarTitle = ["好評", "負評", "未評論"];
const dailyFeedbackBarColor = ["rgb(0, 227, 150)", "rgb(255, 69, 96)", "gray"];

function initFeedbackBarChart() {
    if (chartDOM.value) {
        const chartOption = {
            tooltip: {
                trigger: "axis",
                axisPointer: {
                    type: "shadow",
                },
            },
            legend: {
                data: dailyFeedbackBarTitle.value,
                bottom: "bottom",
            },
            xAxis: {
                type: "category",
                data: props.feedbackData.map((e) => e.date),
                name: "日期",
            },
            yAxis: {
                type: "value",
                name: "數量",
            },
            series: [
                {
                    name: dailyFeedbackBarTitle[0],
                    type: "bar",
                    stack: "總量",
                    data: props.feedbackData.map((e) => e.userPositive),
                    itemStyle: {
                        color: dailyFeedbackBarColor[0],
                    },
                    barMaxWidth: 40,
                },
                {
                    name: dailyFeedbackBarTitle[1],
                    type: "bar",
                    stack: "總量",
                    data: props.feedbackData.map((e) => e.userNegative),
                    itemStyle: {
                        color: dailyFeedbackBarColor[1],
                    },
                    barMaxWidth: 40,
                },
                {
                    name: dailyFeedbackBarTitle[2],
                    type: "bar",
                    stack: "總量",
                    data: props.feedbackData.map((e) => e.noFeedbackNum),
                    itemStyle: {
                        color: dailyFeedbackBarColor[2],
                    },
                    barMaxWidth: 40,
                },
            ],
            toolbox: {
                feature: {
                    saveAsImage: {
                        title: "下載圖表",
                    },
                    dataView: {
                        readOnly: false,
                        title: "顯示原始資料",
                        lang: ["原始資料", "關閉", "刷新"],
                        optionToContent: function (opt) {
                            return dataSourceTable(opt);
                        },
                    },
                    magicType: {
                        type: ["line", "bar"],
                        title: "切換圖表類型",
                    },
                    myExcel: {
                        show: true,
                        title: "匯出成Excel",
                        icon: excelIconPath(),
                        onclick: () =>
                            echartExportExcel(
                                prepareJsonData(),
                                getExcelFileName(
                                    props.expert.name,
                                    "每日評論統計",
                                    props.startDate,
                                    props.endDate,
                                    props.hideNoData
                                )
                            ),
                    },
                },
            },
            graphic: {
                type: "text",
                left: "center",
                top: "middle",
                style: {
                    text: props.feedbackData.find((e) => e.noFeedbackNum || e.userPositive || e.userNegative)
                        ? ""
                        : `${props.subtitle}無相關資訊`,
                    fontSize: 20,
                    fill: "#999",
                },
            },
        };

        if (!feedbackBarChart) {
            feedbackBarChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.feedbackData.length === 0) {
            feedbackBarChart.dispose();
            feedbackBarChart = echarts.init(chartDOM.value);
        }
        feedbackBarChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.feedbackData,
        () => {
            initFeedbackBarChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (feedbackBarChart) {
        feedbackBarChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (feedbackBarChart) {
        feedbackBarChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備匯出成Excel的資料
function prepareJsonData() {
    const data = props.feedbackData.map((item) => {
        return {
            日期: item.date,
            好評: item.userPositive,
            負評: item.userNegative,
            未評論: item.noFeedbackNum,
        };
    });
    return data;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            每日評論統計
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                顯示每日的評論與未評論數量
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
