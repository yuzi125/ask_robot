<script setup>
import { inject, nextTick, onMounted, onUnmounted, ref, toRef, toRefs, watch } from "vue";
import * as echarts from "echarts";
import { useUserStore, useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import html2canvas from "html2canvas";

const userStore = useUserStore();
const { contactList } = storeToRefs(userStore);
const stateStore = useStateStore();
const { chatPartner, isOpenMenu } = storeToRefs(stateStore);
const props = defineProps({
    data: { type: Object, default: {} },
});
const { data } = toRefs(props);
const router = useRouter();

const axios = inject("axios");
const emitter = inject("emitter");

watch(
    () => data.value.option,
    () => {
        option = data.value.option;
        option && myChart.setOption(option, { notMerge: true });
    }
);

const chartDom = ref(null);
const chart = ref(null);
const full_screen = ref(false);

const active = ref("");
const selectValue = ref("");
const isOpenSelect = ref(false);

let myChart, option;

onMounted(() => {
    initParam();
    initEcharts();
    initEvent();
});
onUnmounted(() => {
    myChart.dispose();
});
function initParam() {
    active.value = (data.value.search && data.value.search[0]) || "";
    selectValue.value = (data.value.type && data.value.type[0]) || "";
}
function initEcharts() {
    myChart = echarts.init(chartDom.value);
    // myChart = echarts.init(document.querySelector(".chartDom"));
    option = data.value.option;
    option && myChart.setOption(option, { notMerge: true });
    // , { notMerge: true }
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

    return imageBlob;
}
async function createUserRoom(roomId, toUid) {
    //沒有房間建立一個
    if (!roomId) {
        let rs = await axios.post("/contact/room", JSON.stringify({ user2Uid: toUid }));
        // contactList.value.find((f) => f.uid == chatPartner.value.uid).roomId = rs.data.data.roomId;
        return rs.data.data.roomId;
    }
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
    if (!item.roomId) {
        item.roomId = await createUserRoom(item.roomId, toUid);
    }
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

function pushEchartsData() {
    let item = { search: active.value, type: selectValue.value };
    emitter.emit("pushEchartsData", { data: item, type: "charts", time: data.value.time });
}
</script>

<template>
    <div class="chart" ref="chart">
        <div class="content">
            <div class="header">
                <p class="title">{{ data.title }}</p>
                <div class="right">
                    <div class="btn download">
                        <p @click="download"><i class="fa-solid fa-download"></i></p>
                    </div>
                    <div class="btn share">
                        <p @click="shareContact"><i class="fa-solid fa-share-from-square"></i></p>
                    </div>
                    <div class="btn switch">
                        <p v-if="!full_screen" @click="fullScreen"><i class="fa-solid fa-expand"></i></p>
                        <p v-else @click="unFullScreen"><i class="fa-solid fa-expand"></i></p>
                    </div>
                </div>
            </div>
            <div class="direction">
                <div class="menu" v-if="selectValue || active">
                    <div class="show_unit">
                        <p
                            v-for="item in data.search"
                            :key="item"
                            :class="{ active: active == item }"
                            @click="
                                active = item;
                                pushEchartsData();
                            "
                        >
                            {{ item }}
                        </p>
                    </div>
                    <!-- <select class="hint_type" v-model="selectValue">
                        <option v-for="item in data.type" :key="item" :value="item">{{ item }}</option>
                    </select> -->
                    <div class="hint_type">
                        <div class="select" @click="isOpenSelect = isOpenSelect ? false : true">
                            <p>{{ selectValue }}</p>
                            <span><i class="fa-solid fa-angle-down"></i></span>
                        </div>
                        <div class="option" :class="{ option_show: isOpenSelect }">
                            <p
                                class="item"
                                v-for="item in data.type"
                                :key="item"
                                @click="
                                    isOpenSelect = false;
                                    selectValue = item;
                                    pushEchartsData();
                                "
                            >
                                {{ item }}
                            </p>
                        </div>
                    </div>
                </div>
                <div class="chartDom" ref="chartDom" style="width: 100%; height: 300px"></div>
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

    .direction {
        .menu {
            display: flex;
            justify-content: center;
            align-items: center;
            color: #5470c6;
            margin-bottom: 1rem;
            flex-wrap: wrap;

            .show_unit {
                display: flex;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                margin-left: 1rem;

                p {
                    border-radius: 1rem;
                    margin: 2px;
                    padding: 2px 0.3rem;
                    cursor: pointer;
                    border: 2px solid #5470c6;
                    background-color: white;
                }
                .active {
                    background-color: #5470c6;
                    color: white;
                }
            }
            .hint_type {
                margin: 0.5rem 1rem;
                color: #5470c6;
                font-size: 1rem;
                position: relative;
                white-space: nowrap;

                .select {
                    display: flex;
                    padding: 0.2rem;
                    border: 2px solid #5470c6;
                    background-color: white;
                    cursor: pointer;
                    border-radius: 0.3rem;
                    p {
                        margin-right: 0.3rem;
                    }
                }
                .option {
                    margin-top: 0.5rem;
                    position: absolute;
                    padding: 0.2rem;
                    border: 2px solid #5470c6;
                    background-color: white;
                    z-index: 1;
                    display: none;
                    border-radius: 0.3rem;
                    .item {
                        cursor: pointer;
                        &:hover {
                            background-color: #cccccc;
                        }
                    }
                }
                .option_show {
                    display: block;
                }
            }
        }

        .chartDom {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
            padding-bottom: 0.5rem;
            word-break: break-all;
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
