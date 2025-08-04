<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { dataSourceTable, priceTotalTitle } from "../../utils/echart";
import * as echarts from "echarts";
import { echartExportExcel, excelIconPath, getExcelFileName } from "../../utils/echart";

const props = defineProps({
    modelCostData: {
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
    },
});

const chartDOM = ref(null);
let modelCostChart = null;

// 預設的一些基礎色系
const mainColorList = [
    "rgba(255, 0, 0, 1)",
    "rgba(60, 179, 113, 1)",
    "rgba(255, 165, 0, 1)",
    "rgba(238, 130, 238, 1)",
    "rgba(255, 99, 71, 1)",
    "rgba(106, 90, 205, 1)",
    "rgba(255, 0, 0, 1)",
    "rgba(60, 179, 113, 1)",
    "rgba(255, 165, 0, 1)",
    "rgba(255, 51, 153, 1)",
];
function initModelCostChart() {
    if (chartDOM.value) {
        let legendList = [];
        let modifyData = [];
        if (props.modelCostData.data?.length > 0) {
            const currencyList = Object.keys(props.modelCostData.totalSpend?.totalSpend) || [];
            props.modelCostData.data.forEach((data) => {
                if (!modifyData[data.date]) {
                    modifyData[data.date] = {
                        date: data.date,
                    };
                }
                if (data["模組名稱"] === null) return;

                const modelName = data["模組名稱"];
                const inputTokenName = `${modelName},輸入token數`;
                const outputTokenName = `${modelName},輸出token數`;

                if (!legendList.includes(inputTokenName)) {
                    legendList.push(inputTokenName);
                }
                if (!legendList.includes(outputTokenName)) {
                    legendList.push(outputTokenName);
                }

                modifyData[data.date][inputTokenName] = data["輸入token數"];
                modifyData[data.date][outputTokenName] = data["輸出token數"];

                currencyList.forEach((currency) => {
                    const modelCostName = `${modelName},${currency}`;

                    if (!legendList.includes(modelCostName)) {
                        legendList.push(modelCostName);
                    }
                    modifyData[data.date][modelCostName] = data["花費金額"][currency]
                        ? Number(data["花費金額"][currency])
                        : 0;
                });
            });
        }

        let seriesList = [];
        let currentColorIndex = 0;
        let currentModel = "";

        legendList.forEach((legend) => {
            if (currentModel !== legend.split(",")[0]) {
                currentColorIndex++;
                currentModel = legend.split(",")[0];
            }

            if (legend.match("token")) {
                seriesList.push({
                    name: legend,
                    type: "line",
                    yAxisIndex: 1,
                    data: Object.values(modifyData).map((data) => data[legend]),
                    itemStyle: {
                        color: mainColorList[currentColorIndex] || "gray",
                    },
                });
            } else {
                seriesList.push({
                    name: legend,
                    type: "bar",
                    data: Object.values(modifyData).map((data) => data[legend]),
                    barMaxWidth: 40,
                    itemStyle: {
                        color: mainColorList[currentColorIndex] || "gray",
                    },
                });
            }
        });

        const chartOption = {
            title: {
                text: `總花費 : ${priceTotalTitle(props.modelCostData.totalSpend.totalSpend)}`,
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
                type: "scroll",
                orient: "horizontal",
                pageButtonItemGap: 5,
                pageButtonGap: 10,
                pageButtonPosition: "end",
                pageIconColor: "#aaa",
                pageIconInactiveColor: "#2f4554",
                pageIconSize: 15,
                pageTextStyle: {
                    color: "#333",
                },
            },
            xAxis: [
                {
                    type: "category",
                    data: Object.keys(modifyData),
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
                    text: props.modelCostData.data.length === 0 ? "查無相關資料" : "",
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
                                    "模組使用狀況",
                                    props.startDate,
                                    props.endDate,
                                    props.hideNoData
                                )
                            ),
                    },
                },
            },
        };

        if (!modelCostChart) {
            modelCostChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.modelCostData.data.length === 0) {
            modelCostChart.dispose();
            modelCostChart = echarts.init(chartDOM.value);
        }
        modelCostChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.modelCostData,
        () => {
            initModelCostChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (modelCostChart) {
        modelCostChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (modelCostChart) {
        modelCostChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備匯出成Excel的資料
function prepareJsonData() {
    const data = props.modelCostData.data;
    const currency = Object.keys(props.modelCostData.totalSpend.totalSpend);
    const newData = data.map((item) => {
        const obj = {
            日期: item.date,
            模組名稱: item["模組名稱"] || "-",
            輸入token數: item["輸入token數"] || 0,
            輸出token數: item["輸出token數"] || 0,
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
            模組使用狀況
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                各個模組所使用的token以及費用。
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
