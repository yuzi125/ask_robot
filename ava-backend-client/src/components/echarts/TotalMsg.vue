<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { dataSourceTable } from "../../utils/echart";
import * as echarts from "echarts";
import { echartExportExcel, excelIconPath, getExcelFileName } from "../../utils/echart";

const props = defineProps({
    totalMsgData: {
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
let msgChart = null;

function initTotalMessageChart() {
    if (chartDOM.value) {
        const chartOption = {
            tooltip: {
                trigger: "axis",
            },
            xAxis: {
                type: "category",
                data: props.totalMsgData.map((e) => e.date),
            },
            yAxis: {
                type: "value",
            },
            series: [
                {
                    name: "訊息數",
                    type: "line",
                    data: props.totalMsgData.map((e) => e["訊息數"]),
                },
            ],
            graphic: {
                type: "text",
                left: "center",
                top: "middle",
                style: {
                    text: props.totalMsgData.length === 0 ? "查無相關資料" : "",
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
                                    "訊息總數統計",
                                    props.startDate,
                                    props.endDate,
                                    props.hideNoData
                                )
                            ),
                    },
                },
            },
        };

        if (!msgChart) {
            msgChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.totalMsgData.length === 0) {
            msgChart.dispose();
            msgChart = echarts.init(chartDOM.value);
        }
        msgChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.totalMsgData,
        () => {
            initTotalMessageChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (msgChart) {
        msgChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (msgChart) {
        msgChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備匯出成Excel的資料
function prepareJsonData() {
    const data = props.totalMsgData.map((item) => {
        return {
            日期: item.date,
            訊息數: item["訊息數"],
        };
    });
    return data;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            全部訊息數
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                統計時間內的訊息數量(與AVA互動的總次數)。
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
