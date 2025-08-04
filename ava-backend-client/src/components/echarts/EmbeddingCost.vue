<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as echarts from "echarts";
import { dataSourceTable, getExcelFileName, echartExportExcel, excelIconPath } from "@/utils/echart";

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
    datasetName: {
        type: String,
    },
});

const chartDOM = ref(null);
let costChart = null;

function initCostChart() {
    if (chartDOM.value && props.costData && props.costData.dailyCostData) {
        let legendList = [];
        if (props.costData && props.costData.dailyCostData.length > 0) {
            legendList = ["Token數", ...Object.keys(props.costData.totalCost)];
        }

        let seriesList = [];
        legendList.forEach((legend) => {
            if (legend === "Token數") {
                seriesList.push({
                    name: legend,
                    type: "line",
                    yAxisIndex: 1,
                    data: props.costData.dailyCostData.map((item) => item.token),
                });
            } else {
                seriesList.push({
                    name: legend,
                    type: "bar",
                    data: props.costData.dailyCostData.map((item) => item.cost[legend]),
                    barMaxWidth: 40,
                });
            }
        });

        const chartOption = {
            title: {
                text: `總花費 ${totalCostDisplay(props.costData.totalCost)}`,
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
                    data: props.costData.dailyCostData.map((e) => e.date),
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
                    text: props.costData.dailyCostData.length === 0 ? "查無相關資料" : "",
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
                                    props.datasetName,
                                    "Embedding 花費統計",
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
        } else if (props.costData.dailyCostData.length === 0) {
            costChart.dispose();
            costChart = echarts.init(chartDOM.value);
        }
        costChart.setOption(chartOption);
    }
}

watch(
    () => props.costData,
    () => {
        initCostChart();
    }
);

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

function totalCostDisplay(data) {
    return Object.keys(data)
        .map((currency) => `${currency} : ${data[currency].toFixed(7)}`)
        .join(", ");
}

// 準備JSON格式(匯出成Excel)
function prepareJsonData() {
    const data = props.costData.dailyCostData;
    const currency = Object.keys(props.costData.totalCost);
    const newData = data.map((item) => {
        const obj = {
            日期: item.date,
            Token數: item.token,
        };
        currency.forEach((key) => {
            obj[`${key}花費金額`] = item.cost[key] || 0;
        });
        return obj;
    });
    return newData;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title class="d-flex align-center">
            Embedding 花費統計
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" size="x-small" class="ml-2">mdi-information</v-icon>
                </template>
                統計一段時間內的Embedding 花費。
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
