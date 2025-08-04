<script setup>
import { inject, onMounted, onUnmounted, ref, toRefs } from "vue";
import * as echarts from "echarts";
import { useUserStore, useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
const userStore = useUserStore();
const { contactList } = storeToRefs(userStore);
const stateStore = useStateStore();
const { isOpenMenu } = storeToRefs(stateStore);

const router = useRouter();

const props = defineProps({
    data: { type: Object, default: {} },
});

const axios = inject("axios");
const { data } = toRefs(props);

const chartDom = ref(null);
const chart = ref(null);
const full_screen = ref(false);

const unit = ref("");
const active = ref("");
const months = ref();

function getSecureRandomInt(max) {
    const crypto = window.crypto || window.msCrypto; // 兼容性處理
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max; // 生成 0 到 max 之間的隨機數
}

let myChart, option;

onMounted(() => {
    initParam();
    initEcharts();
});
onUnmounted(() => {
    myChart.dispose();
});
function initParam() {
    let series = [
        { name: "師", data: [] },
        { name: "員", data: [] },
    ];
    series.forEach((item) => {
        for (let i = 0; i < 360; i++) {
            item.data.push(getSecureRandomInt(300));
        }
    });
    let total = { name: "總計", data: [] };
    for (let i = 0; i < 360; i++) {
        total.data.push(series[0].data[i] + series[1].data[i]);
    }
    series.push(total);
    data.value.series = series;
    active.value = data.value.preset;
    switch (data.value.preset) {
        case "近1年":
            months.value = 12;
            break;
        case "近2年":
            months.value = 24;
            break;
        case "近10年":
            months.value = 120;
            break;
        case "近20年":
            months.value = 240;
            break;
        case "全部":
            months.value = 360;
            break;
    }
}
function initEcharts() {
    myChart = echarts.init(chartDom.value);
    // myChart = echarts.init(document.querySelector(".chartDom"));

    option = {
        title: {
            // text: "Stacked Line",
        },
        tooltip: {
            trigger: "axis",
        },
        legend: {
            data: [],
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            containLabel: true,
        },
        toolbox: {
            feature: {
                saveAsImage: {},
            },
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: [],
        },
        yAxis: {
            type: "value",
        },
        series: [],
    };

    initUi(months.value);
}
function initUi(count) {
    renderUi(count, "month");
    unit.value = "month";
}
function renderUi(count, unit) {
    option.legend.data = [];
    option.series = [];
    option.xAxis.data = [];
    switch (unit) {
        case "month":
            data.value.series.forEach((item) => {
                let data = item.data.slice(-1 * count);
                option.legend.data.push(item.name);
                option.series.push({ name: item.name, type: "line", stack: "Total", data: data });
            });
            for (let i = 0; i < count; i++) {
                option.xAxis.data.push(i + 1 + "");
            }
            break;
        case "year":
            data.value.series.forEach((item) => {
                let data = item.data.slice(-1 * count);
                option.legend.data.push(item.name);
                //陣列每年12個的總和;
                let yearSum = chunkArraySum(data, 12);
                option.series.push({ name: item.name, type: "line", stack: "Total", data: yearSum });
            });
            for (let i = 0; i < count / 12; i++) {
                option.xAxis.data.push(i + 112 + "");
            }
            break;
    }

    option && myChart.setOption(option);
}

function changeUi(year, act) {
    active.value = act;
    let month = year * 12;
    if (year >= 10) {
        renderUi(month, "year");
        unit.value = "year";
    } else {
        renderUi(month, "month");
        unit.value = "month";
    }
}
function chunkArraySum(array, chunkSize) {
    const chunkedArray = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        let sum = array.slice(i, i + chunkSize).reduce((a, b) => a + b);
        chunkedArray.push(sum);
    }
    return chunkedArray;
}
function fullChange() {
    if (document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        document.exitFullscreen();
    } else {
    }
}
// function hadnleScroll(event) {
//     event.preventDefault();
// }
// window.addEventListener("scroll", hadnleScroll);
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

    return imageBlob;
}
async function shareContact() {
    const imageBlob = await screenshot();
    if (!imageBlob) {
        console.log("可能有權限問題取不到iframe內容");
        return;
    }
    //到時根據工號找到uid，先預設Jeason
    let toUid = "3b78c6be-3769-43a7-be1a-f01e9f79a80c";
    let item = contactList.value.find((f) => f.uid == toUid);

    const formData = new FormData();
    formData.append("file", imageBlob);
    formData.append("toUid", toUid);
    formData.append("roomId", item.roomId);

    axios.post("/contact/share", formData, { headers: { "Content-Type": "multipart/form-data" } });
    isOpenMenu.value = true;
    setTimeout(() => {
        router.replace("/u/" + item.roomId);
        isOpenMenu.value = false;
    }, 500);
}
</script>

<template>
    <div class="chart" ref="chart">
        <div class="content">
            <div class="header">
                <p class="title">{{ data.title }}</p>
                <div class="right">
                    <div class="share">
                        <p @click="shareContact"><i class="fa-solid fa-share-from-square"></i></p>
                    </div>
                    <div class="switch">
                        <p v-if="!full_screen" @click="fullScreen"><i class="fa-solid fa-maximize"></i></p>
                        <p v-else @click="unFullScreen"><i class="fa-solid fa-minimize"></i></p>
                    </div>
                </div>
            </div>
            <div class="direction">
                <div class="menu">
                    <div class="show_unit show_month">
                        <p :class="{ active: active == '近1年' }" @click="changeUi(1, '近1年')">近1年</p>
                        <p :class="{ active: active == '近2年' }" @click="changeUi(2, '近2年')">近2年</p>
                    </div>
                    <div class="show_unit show_year">
                        <p :class="{ active: active == '近10年' }" @click="changeUi(10, '近10年')">近10年</p>
                        <p :class="{ active: active == '近20年' }" @click="changeUi(20, '近20年')">近20年</p>
                        <p :class="{ active: active == '全部' }" @click="changeUi(30, '全部')">全部</p>
                    </div>
                </div>
                <div class="chartDom" ref="chartDom" style="width: 100%; height: 300px"></div>
                <div class="unit">
                    <p :class="{ month: unit == 'month', year: unit == 'year' }">
                        {{ unit == "month" ? "退休月" : "退休年" }}
                    </p>
                </div>
            </div>
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
        .right {
            display: flex;
            .share {
                color: #9a9aa0;
                cursor: pointer;
                margin-right: 1rem;
            }
            .switch {
                color: #9a9aa0;
                cursor: pointer;
            }
        }
    }

    .direction {
        .menu {
            display: flex;
            justify-content: center;
            color: black;
            margin-bottom: 1rem;
            flex-wrap: wrap;
            .show_unit {
                display: flex;
                flex-wrap: wrap;

                p {
                    margin: 2px;
                    padding: 2px;
                    cursor: pointer;
                }
            }
            .show_month {
                p {
                    border: 2px solid #debe26;
                    color: #debe26;
                }
                .active {
                    background-color: #debe26;
                    color: white;
                }
            }
            .show_year {
                p {
                    border: 2px solid #8b6bcc;
                    color: #8b6bcc;
                }
                .active {
                    background-color: #8b6bcc;
                    color: white;
                }
            }
        }
        .unit {
            color: black;
            display: flex;
            justify-content: center;
            padding-bottom: 1rem;
            font-weight: bold;

            .month {
                color: #debe26;
            }
            .year {
                color: #8b6bcc;
            }
        }

        .chartDom {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
            padding-bottom: 0.5rem;
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
    .direction {
        display: flex;
        .menu {
            flex-direction: column;

            .show_unit {
                flex-direction: column;
                white-space: nowrap;
                text-align: center;
                p {
                    margin: 0.5rem 0;
                    margin-left: 0.5rem;
                }
            }
        }
        .unit {
            margin-right: 1rem;
            align-items: flex-end;
            p {
                writing-mode: vertical-rl;
            }
        }
    }
}
</style>
