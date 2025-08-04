<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { excelIconPath, echartExportExcel, getExcelFileName } from "../../utils/echart";
import * as echarts from "echarts";

const props = defineProps({
    averageMsgData: {
        type: Object,
        required: true,
        default: {},
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
let averageMsgChart = null;

function initAverageMsgChart() {
    if (chartDOM.value) {
        const chartOption = {
            tooltip: {
                trigger: "item",
                formatter: function (params) {
                    var avgMessage = params.data.averageMag || "0";
                    return `${params.name}<br/>訊息數: ${params.value}<br/>平均訊息數量: ${avgMessage}`;
                },
            },
            legend: {
                orient: "vertical",
                left: "left",
            },
            series: [
                {
                    name: "訊息數量",
                    type: "pie",
                    radius: "50%",
                    data: props.averageMsgData.map((e) => {
                        return { name: e.name || "遊客", value: e["訊息數"], averageMag: e["平均訊息數量"] };
                    }),
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: "rgba(0, 0, 0, 0.5)",
                        },
                    },
                },
            ],
            graphic: {
                type: "text",
                left: "center",
                top: "middle",
                style: {
                    text: props.averageMsgData.length === 0 ? "查無相關資料" : "",
                    fontSize: 20,
                    fill: "#999",
                },
            },
            toolbox: {
                feature: {
                    saveAsImage: {
                        title: "下載圖表",
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
                                    "平均訊息數量",
                                    props.startDate,
                                    props.endDate,
                                    props.hideNoData
                                )
                            ),
                    },
                },
            },
        };

        if (!averageMsgChart) {
            averageMsgChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.averageMsgData.length === 0) {
            averageMsgChart.dispose();
            averageMsgChart = echarts.init(chartDOM.value);
        }
        averageMsgChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.averageMsgData,
        () => {
            initAverageMsgChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (averageMsgChart) {
        averageMsgChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (averageMsgChart) {
        averageMsgChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備JSON格式(匯出成Excel)
function prepareJsonData() {
    const data = props.averageMsgData;
    const newData = data.map((item) => {
        const obj = {
            日期: `${props.startDate} ~ ${props.endDate}`,
            使用者: item.name || "遊客",
            訊息數: item["訊息數"],
            平均訊息數量: item["平均訊息數量"],
        };
        return obj;
    });
    return newData;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            平均訊息數量
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                平均每日的訊息數量
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
