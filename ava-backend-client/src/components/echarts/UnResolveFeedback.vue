<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { dataSourceTable, excelIconPath, echartExportExcel, getExcelFileName } from "@/utils/echart";
import * as echarts from "echarts";

const props = defineProps({
    unResolvedData: {
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
let unResolveChart = null;

function initUnresolveChart() {
    if (chartDOM.value) {
        const chartOption = {
            tooltip: {
                trigger: "axis",
                axisPointer: {
                    type: "shadow",
                },
            },
            legend: {
                data: ["未處理"],
                bottom: "bottom",
            },
            xAxis: {
                type: "category",
                data: props.unResolvedData.map((e) => e.date),
                name: "日期",
            },
            yAxis: {
                type: "value",
                name: "數量",
            },
            series: [
                {
                    name: "未處理",
                    type: "bar",
                    data: props.unResolvedData.map((e) => e.notDoneFeedbacks),
                    itemStyle: {
                        color: "rgba(255, 99, 132, 0.8)",
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
                    myExcel: {
                        show: true,
                        title: "匯出成Excel",
                        icon: excelIconPath(),
                        onclick: () =>
                            echartExportExcel(
                                prepareJsonData(),
                                getExcelFileName(
                                    props.expert.name,
                                    "每日未處理評論",
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
                    text: props.unResolvedData.find((e) => e.notDoneFeedbacks !== 0)
                        ? ""
                        : `${props.subtitle}無未處理評論`,
                    fontSize: 20,
                    fill: "#999",
                },
            },
        };

        if (!unResolveChart) {
            unResolveChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.unResolvedData.length === 0) {
            unResolveChart.dispose();
            unResolveChart = echarts.init(chartDOM.value);
        }
        unResolveChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.unResolvedData,
        () => {
            initUnresolveChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (unResolveChart) {
        unResolveChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (unResolveChart) {
        unResolveChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備匯出成Excel的資料
function prepareJsonData() {
    const data = props.unResolvedData.map((item) => {
        return {
            日期: item.date,
            未處理: item.notDoneFeedbacks,
        };
    });
    return data;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            每日未處理評論
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                顯示每日尚未處理的評論數量
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
