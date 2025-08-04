<script setup>
import { onMounted, onUnmounted, ref, toRefs } from "vue";
import * as echarts from "echarts";

const props = defineProps({
    data: { type: Object, default: {} },
});
const { data } = toRefs(props);

const chartDom = ref(null);
const chart = ref(null);
const full_screen = ref(false);

const unit = ref("");
const active = ref("");
const months = ref();

let myChart, option;

onMounted(() => {
    initParam();
    initEcharts();
});
onUnmounted(() => {
    myChart.dispose();
});
function initParam() {
    // active.value = data.value.preset;
}
function initEcharts() {
    myChart = echarts.init(chartDom.value);
    // myChart = echarts.init(document.querySelector(".chartDom"));

    option = {
        tooltip: {
            trigger: "axis",
            axisPointer: {
                // Use axis to trigger tooltip
                type: "shadow", // 'shadow' as default; can also be 'line' or 'shadow'
            },
        },
        legend: {},
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            containLabel: true,
        },
        xAxis: {
            type: "value",
        },
        yAxis: {
            type: "category",
            data: ["經理部門", "一級主管", "二級主管", "三級主管", "四級主管", "專業職位", "非操作", "操作基層"],
        },
        series: [
            {
                name: "高中職以下",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [0, 0, 0, 0, 990, 0, 3680, 3320],
                data: [20, 25, 10, 30, 15, 25, 15, 10],
            },
            {
                name: "專科",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [0, 150, 575, 843, 804, 232, 1590, 1271],
                data: [20, 25, 15, 25, 20, 10, 25, 10],
            },
            {
                name: "學士",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [3231, 4571, 4355, 3000, 3059, 2767, 4403, 5361],
                data: [20, 25, 25, 20, 20, 20, 10, 30],
            },
            {
                name: "碩士",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [4890, 4554, 4685, 6127, 5097, 6061, 327, 48],
                data: [20, 15, 25, 15, 25, 25, 25, 25],
            },
            {
                name: "博士",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [1880, 725, 385, 30, 50, 940],
                data: [20, 10, 25, 10, 20, 20, 25, 25],
            },
        ],
    };
    option && myChart.setOption(option);
}

function fullScreen() {
    chart.value.classList.add("full_screen");
    full_screen.value = true;
    myChart.resize();
}
function unFullScreen() {
    chart.value.classList.remove("full_screen");
    full_screen.value = false;
    myChart.resize();
}
</script>

<template>
    <div class="chart" ref="chart">
        <div class="content">
            <div class="header">
                <p class="title">{{ data.title }}</p>
                <div class="switch">
                    <p v-if="!full_screen" @click="fullScreen"><i class="fa-solid fa-maximize"></i></p>
                    <p v-else @click="unFullScreen"><i class="fa-solid fa-minimize"></i></p>
                </div>
            </div>
            <div class="chartDom" ref="chartDom" style="width: 100%; height: 300px"></div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.chart {
    background-color: #eeeeee;
    border-radius: 0.5rem;
    // overflow: hidden;
    // transition: 0.3s ease-in-out;
    transition: 0.3s;
    .header {
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        .title {
            color: black;
            font-weight: bold;
        }
        .switch {
            color: #9a9aa0;
            cursor: pointer;
        }
    }
    .chartDom {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
        padding-bottom: 0.5rem;
    }
}
.full_screen {
    border-radius: 0;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    transform-origin: top left;
    transform: rotate(90deg) translateY(-100%);
    width: 100vh;
    height: 100vw;
    display: flex;
    justify-content: flex-start;
    padding-left: 2rem;
    touch-action: none;

    .content {
        width: 80%;
    }
}
</style>
