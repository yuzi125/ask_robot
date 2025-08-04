<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { dataSourceTable } from "../../utils/echart";
import * as echarts from "echarts";
import { echartExportExcel, excelIconPath, getExcelFileName } from "../../utils/echart";

const props = defineProps({
    noAnswerData: {
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
    },
});

const chartDOM = ref(null);
let noAnswerChart = null;

function initNoAnswerChart() {
    if (chartDOM.value) {
        const chartOption = {
            tooltip: {
                trigger: "axis",
                axisPointer: {
                    type: "shadow",
                },
            },
            legend: {
                data: ["錯誤", "無答案"],
            },
            xAxis: {
                type: "category",
                data: props.noAnswerData.map((e) => e.date),
            },
            yAxis: {
                type: "value",
            },
            series: [
                {
                    name: "錯誤",
                    type: "bar",
                    stack: "total",
                    emphasis: {
                        focus: "series",
                    },
                    data: props.noAnswerData.map((e) => e["錯誤"]),
                    barMaxWidth: 40,
                },
                {
                    name: "無答案",
                    type: "bar",
                    stack: "total",
                    emphasis: {
                        focus: "series",
                    },
                    data: props.noAnswerData.map((e) => e["無答案"]),
                    barMaxWidth: 40,
                },
            ],
            graphic: {
                type: "text",
                left: "center",
                top: "middle",
                style: {
                    text: props.noAnswerData.length === 0 ? "查無相關資料" : "",
                    fontSize: 20,
                    fill: "#999",
                },
            },
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
                    myExcel: {
                        show: true,
                        title: "匯出成Excel",
                        icon: excelIconPath(),
                        onclick: () =>
                            echartExportExcel(
                                prepareJsonData(),
                                getExcelFileName(
                                    props.expert.name,
                                    "問不到問題數量",
                                    props.startDate,
                                    props.endDate,
                                    props.hideNoData
                                )
                            ),
                    },
                },
            },
        };

        if (!noAnswerChart) {
            noAnswerChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.noAnswerData.length === 0) {
            noAnswerChart.dispose();
            noAnswerChart = echarts.init(chartDOM.value);
        }
        noAnswerChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.noAnswerData,
        () => {
            initNoAnswerChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (noAnswerChart) {
        noAnswerChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (noAnswerChart) {
        noAnswerChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備匯出成Excel的資料
function prepareJsonData() {
    const data = props.noAnswerData.map((item) => {
        return {
            日期: item.date,
            錯誤: item["錯誤"],
            無答案: item["無答案"],
        };
    });
    return data;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            問不到問題數量
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                每天有多少提問AVA沒有給出答案
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
