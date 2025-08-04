<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import {
    dataSourceTable,
    priceTotalTitle,
    excelIconPath,
    echartExportExcel,
    getExcelFileName,
} from "../../utils/echart";
import * as echarts from "echarts";

const props = defineProps({
    costData: {
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
let costChart = null;

function initCostChart() {
    if (chartDOM.value) {
        let legendList = [];
        if (props.costData.data && props.costData.data.length > 0) {
            legendList = ["輸入token數", "輸出token數"];
            Object.keys(props.costData.totalSpend.totalSpend).forEach((currency) =>
                legendList.push(`花費金額(${currency})`)
            );
        }

        let seriesList = [];
        legendList.forEach((legend) => {
            if (legend.match("token")) {
                seriesList.push({
                    name: legend,
                    type: "line",
                    yAxisIndex: 1,
                    data: props.costData.data.map((data) => data[legend]),
                });
            } else {
                seriesList.push({
                    name: legend,
                    type: "bar",
                    data: props.costData.data.map((data) => data["花費金額"][legend.match(/\(([^)]+)\)/)[1]]),
                    barMaxWidth: 40,
                });
            }
        });

        const chartOption = {
            title: {
                text: `總花費 : ${priceTotalTitle(props.costData.totalSpend.totalSpend)}`,
                left: "center",
            },
            tooltip: {
                trigger: "axis",
                axisPointer: {
                    type: "cross",
                },
            },
            legend: {
                data: legendList,
                bottom: "bottom",
            },
            xAxis: [
                {
                    type: "category",
                    data: props.costData.data.map((e) => e.date),
                },
            ],
            yAxis: [
                {
                    type: "value",
                    name: "花費金額",
                    position: "left",
                    axisLine: {
                        lineStyle: {
                            color: "#5470C6",
                        },
                    },
                    axisLabel: {
                        formatter: "{value}",
                    },
                },
                {
                    type: "value",
                    name: "Token數",
                    position: "right",
                    axisLine: {
                        lineStyle: {
                            color: "black",
                        },
                    },
                    axisLabel: {
                        formatter: "{value}",
                    },
                },
            ],
            series: seriesList,
            graphic: {
                type: "text",
                left: "center",
                top: "middle",
                style: {
                    text: props.costData.data.length === 0 ? "查無相關資料" : "",
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
                                    "Token花費統計",
                                    props.startDate,
                                    props.endDate,
                                    props.hideNoData
                                )
                            ),
                    },
                },
            },
        };

        if (!costChart) {
            costChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.costData.data.length === 0) {
            costChart.dispose();
            costChart = echarts.init(chartDOM.value);
        }
        costChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.costData,
        () => {
            initCostChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (costChart) {
        costChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (costChart) {
        costChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備JSON格式(匯出成Excel)
function prepareJsonData() {
    const data = props.costData.data;
    const currency = Object.keys(props.costData.totalSpend.totalSpend);
    const newData = data.map((item) => {
        const obj = {
            日期: item.date,
            輸入token數: item["輸入token數"],
            輸出token數: item["輸出token數"],
        };
        currency.forEach((key) => {
            obj[`${key}花費金額`] = item["花費金額"][key] || 0;
        });
        return obj;
    });
    return newData;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            Token 統計
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                統計時間內的Token數量與所產生的費用。
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
