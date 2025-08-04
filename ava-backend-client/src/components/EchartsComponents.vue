<script setup>
import { inject, onMounted, onUnmounted, ref, toRefs, watch, nextTick } from "vue";
import * as echarts from "echarts";
import { useRouter } from "vue-router";
import html2canvas from "html2canvas";

const props = defineProps({
    data: { type: Object, default: {} },
});
const { data } = toRefs(props);
const router = useRouter();

const axios = inject("axios");
const emitter = inject("emitter");

// watch(
//     () => data.value.option,
//     () => {
//         console.log("@@@@@@@@@@@@@@@@");
//         option = data.value.option;
//         option && myChart.setOption(option, { notMerge: true });
//     }
// );

const chartDom = ref(null);
const chart = ref(null);
const full_screen = ref(false);

const active = ref("");
const selectValue = ref("");
const isOpenSelect = ref(false);

let myChart, option;

onMounted(() => {
    initEcharts();
    initEvent();
});
onUnmounted(() => {
    myChart.dispose();
});
function initEcharts() {
    myChart = echarts.init(chartDom.value);
    // option = data.value.option;
    // option && myChart.setOption(option, { notMerge: true });
}
function initEvent() {
    window.addEventListener("resize", function () {
        nextTick(() => {
            myChart.resize();
        });
    });
}

async function screenshot() {
    if (!chartDom.value) {
        return undefined;
    }
    const divScreenshot = await html2canvas(chart.value, { willReadFrequently: true });
    const imageBlob = await new Promise((resolve) => {
        divScreenshot.toBlob((blob) => {
            resolve(blob);
        });
    });
    // return imageBlob;
    const files = new File([imageBlob], "chart.png", { type: "image/png" });
    return [files];
}
function shareEcharts() {
    const fils = screenshot();
    navigator.share({
        title: "統計圖",
        text: "年終上升比率",
        files: fils,
    });
}

async function download() {
    if (!chartDom.value) {
        return undefined;
    }
    const divScreenshot = await html2canvas(chart.value, { willReadFrequently: true });
    const dataURL = divScreenshot.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = data.value.title + ".png";
    link.click();
}

// nextTick(() => {
//     chart.value.addEventListener("click", handleClick);
// });
function handleClick() {
    fullScreen();
}
function fullScreen() {
    chart.value.classList.toggle("full_screen");
    if (Array.from(chart.value.classList).includes("full_screen")) {
        chart.value.addEventListener("click", handleClick);
    } else {
        chart.value.removeEventListener("click", handleClick);
    }
    myChart.resize();
}

const hasData = ref(true);
const setOption = function (option) {
    hasData.value = option ? true : false;
    option && myChart.setOption(option, { notMerge: true });
};

defineExpose({ setOption });
</script>

<template>
    <div class="chart" ref="chart">
        <div class="content" @click.stop>
            <div class="header">
                <div>
                    <p class="title">
                        <span>{{ data.title }}</span>
                        <span class="ml-2 text-grey" style="font-size: 0.9rem">
                            <i class="fa-solid fa-circle-question"></i>
                        </span>
                        <v-tooltip activator="parent" location="top">{{ data.tooltip }}</v-tooltip>
                    </p>
                    <span class="mt-2 d-block">{{ data.period }}</span>
                </div>

                <slot name="detail"></slot>
                <div class="right">
                    <div class="btn download">
                        <p @click="download"><i class="fa-solid fa-download"></i></p>
                    </div>
                    <!-- <div class="btn share">
                        <p @click="shareEcharts"><i class="fa-solid fa-share-from-square"></i></p>
                    </div> -->
                    <div class="btn switch">
                        <p @click="fullScreen"><i class="fa-solid fa-expand"></i></p>
                        <!-- <p><i class="fa-solid fa-expand"></i></p> -->
                    </div>
                </div>
            </div>
            <div class="chartDom">
                <div
                    class="main pa-3"
                    ref="chartDom"
                    style="width: 100%; height: 100%; min-height: 300px; max-height: 1000px"
                ></div>
                <div
                    class="layer pa-3"
                    v-if="!hasData"
                    style="width: 100%; height: 100%; min-height: 300px; max-height: 1000px"
                >
                    <p>查無資料</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.chart {
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #d8dae6;
    transition: 0.3s;
    background-color: white;
    .header {
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        .title {
            color: black;
            font-weight: bold;
            display: flex;
            align-items: center;
        }
        .right {
            display: flex;
            .btn {
                color: #9a9aa0;
                cursor: pointer;
                margin-right: 1rem;
                &:last-child {
                    margin-right: 0;
                }
            }
        }
    }
    .chartDom {
        position: relative;
        .layer {
            position: absolute;
            left: 0;
            top: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f3f4f6;
            color: grey;
            font-weight: bold;
        }
    }
}
.full_screen {
    border-radius: 0;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    transform-origin: top left;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    touch-action: none;
    background-color: rgba($color: #000000, $alpha: 0.5);

    .content {
        width: 100%;
        background-color: white;
        .chartDom {
            // height: calc(100vh - 72px);
            height: 350px;
        }
    }
    .direction {
        display: flex;
        .menu {
            flex-direction: column;

            .show_unit {
                flex-direction: column;
                white-space: nowrap;
                text-align: center;
                margin: 0;
                p {
                    margin: 0.5rem 0;
                }
            }
            .hint_type {
                margin: 0;
                margin-left: 0;
                margin-top: 2rem;
            }
        }
    }
}
</style>
