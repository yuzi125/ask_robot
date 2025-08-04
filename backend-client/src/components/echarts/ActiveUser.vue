<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { dataSourceTable } from "../../utils/echart";
import * as echarts from "echarts";
import { echartExportExcel, excelIconPath, getExcelFileName } from "../../utils/echart";

const props = defineProps({
    activeUserData: {
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
let userChart = null;

function initActiveUserChart() {
    if (chartDOM.value) {
        const chartOption = {
            tooltip: {
                trigger: "axis",
            },
            xAxis: {
                type: "category",
                data: props.activeUserData.map((e) => e.date),
            },
            yAxis: {
                type: "value",
            },
            series: [
                {
                    name: "用戶數",
                    type: "line",
                    data: props.activeUserData.map((e) => e["用戶數"]),
                },
            ],
            graphic: {
                type: "text",
                left: "center",
                top: "middle",
                style: {
                    text: props.activeUserData.length === 0 ? "查無相關資料" : "",
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
                                    "活躍用戶數",
                                    props.startDate,
                                    props.endDate,
                                    props.hideNoData
                                )
                            ),
                    },
                },
            },
        };

        if (!userChart) {
            userChart = echarts.init(chartDOM.value);
            window.addEventListener("resize", resizeChart);
        } else if (props.activeUserData.length === 0) {
            userChart.dispose();
            userChart = echarts.init(chartDOM.value);
        }
        userChart.setOption(chartOption);
    }
}

onMounted(async () => {
    watch(
        () => props.activeUserData,
        () => {
            initActiveUserChart();
        }
    );
});

// 視窗大小改變時，圖表跟著改變
function resizeChart() {
    if (userChart) {
        userChart.resize();
    }
}

// 離開畫面時，將圖表與監聽移除。
onUnmounted(() => {
    if (userChart) {
        userChart.dispose();
    }
    window.removeEventListener("resize", resizeChart);
});

// 準備匯出成Excel的資料
function prepareJsonData() {
    const data = props.activeUserData.map((item) => {
        return {
            日期: item.date,
            用戶數: item["用戶數"],
        };
    });
    return data;
}
</script>

<template>
    <v-card class="chart-container">
        <v-card-title>
            活躍用戶數
            <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" small class="ml-2">mdi-information</v-icon>
                </template>
                每天有多少人使用過AVA(與AVA有效互動)
            </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ props.subtitle }}</v-card-subtitle>
        <v-card-text>
            <div ref="chartDOM" style="width: 100%" :style="{ height: props.height }"></div>
        </v-card-text>
    </v-card>
</template>
