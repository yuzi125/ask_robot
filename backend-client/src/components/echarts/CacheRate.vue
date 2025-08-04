<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as echarts from "echarts";
import { excelIconPath, echartExportExcel, getExcelFileName } from "../../utils/echart";

const props = defineProps({
    rateData: {
        type: Number,
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
let rateChart = null;

function initRateChart() {
    if (chartDOM.value) {
        const chartOption = {
            tooltip: {
                formatter: "{a} <br/>{b} : {c}%",
            },
            series: [
                {
                    name: "用戶評論參與率",
                    type: "gauge",
                    progress: {
                        show: true,
                    },
                    detail: { formatter: "{value}%", valueAnimation: true, offsetCenter: [0, "70%"] },
                    data: [{ value: props.rateData, name: "取用率" }],
                },
            ],
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
                                    "取用快取比率",
                                    props.startDate,
                                    props.endDate,
                                    props.hideNoData
                                )
                            ),
                    },
                },
            },
        };

        if (!rateChart) {
            rateChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.rateData.length === 0) {
            rateChart.dispose();
            rateChart = echarts.init(chartDOM.value);
        }
        rateChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.rateData,
        () => {
            initRateChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (rateChart) {
        rateChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (rateChart) {
        rateChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備匯出成Excel的資料
function prepareJsonData() {
    const data = {
        日期: `${props.startDate} ~ ${props.endDate}`,
        "取用率(%)": props.rateData,
    };
    return [data];
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            使用快取比率
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                顯示快取佔總訊息的比率。
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
