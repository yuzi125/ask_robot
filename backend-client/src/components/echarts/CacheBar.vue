<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { dataSourceTable, excelIconPath, echartExportExcel, getExcelFileName } from "../../utils/echart";
import * as echarts from "echarts";

const props = defineProps({
    cacheData: {
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
let cacheBarChart = null;

const cacheBarTitle = ["非快取", "快取"];
const cacheBarColor = ["rgb(66, 69, 96)", "rgb(255, 69, 96)"];

function initCacheBarChart() {
    if (chartDOM.value) {
        const chartOption = {
            tooltip: {
                trigger: "axis",
                axisPointer: {
                    type: "shadow",
                },
            },
            legend: {
                data: cacheBarTitle.value,
                bottom: "bottom",
            },
            xAxis: {
                type: "category",
                data: props.cacheData.map((e) => e.date),
                name: "日期",
            },
            yAxis: {
                type: "value",
                name: "訊息數量",
            },
            series: [
                {
                    name: cacheBarTitle[1],
                    type: "bar",
                    stack: "總量",
                    data: props.cacheData.map((e) => e.cacheNumber),
                    itemStyle: {
                        color: cacheBarColor[1],
                    },
                    barMaxWidth: 40,
                },
                {
                    name: cacheBarTitle[0],
                    type: "bar",
                    stack: "總量",
                    data: props.cacheData.map((e) => e.msgNumber - e.cacheNumber),
                    itemStyle: {
                        color: cacheBarColor[0],
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
                                    "每日快取數量",
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
                    text: props.cacheData.find((e) => e.msgNumber || e.cacheNumber)
                        ? ""
                        : `${props.subtitle}無相關資訊`,
                    fontSize: 20,
                    fill: "#999",
                },
            },
        };

        if (!cacheBarChart) {
            cacheBarChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.cacheData.length === 0) {
            cacheBarChart.dispose();
            cacheBarChart = echarts.init(chartDOM.value);
        }
        cacheBarChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.cacheData,
        () => {
            initCacheBarChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (cacheBarChart) {
        cacheBarChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (cacheBarChart) {
        cacheBarChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備匯出成Excel的資料
function prepareJsonData() {
    const data = props.cacheData.map((item) => {
        return {
            日期: item.date,
            非快取: item.msgNumber - item.cacheNumber,
            快取: item.cacheNumber,
        };
    });
    return data;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            每日快取數量
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                顯示每日的訊息數以及快取使用數量
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
