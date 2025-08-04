<script setup>
import { inject, nextTick, onMounted, ref, watch, watchEffect } from "vue";
import { useStateStore, useApiStatusStore } from "../store/index";
import { storeToRefs } from "pinia";
const stateStore = useStateStore();
const { isOpenRecommend, recommendList, recommendActive, recommendListActive, chatPartner } = storeToRefs(stateStore);
const apiStatusStore = useApiStatusStore();

const emitter = inject("emitter");
const axios = inject("axios");
const oftenList = ref([]);
const customList = ref([]);
const historyList = ref([]);
const customInput = ref("");
const customInputDom = ref(null);

onMounted(() => {
    init();
});
async function init() {
    recommendActive.value = 0;
    emitter.on("pushHistory", (msg) => {
        // const index = recommendList.value.findIndex((f) => f.text === msg.text);
        // if (index !== -1) {
        //     recommendList.value.splice(index, 1);
        // }
        // recommendList.value.unshift(msg);
        historyList.value.push(msg);
        // recommendList.value.push(msg);
    });
}
watch(chatPartner, () => {
    recommendActive.value = 0;
    apiStatusStore.registerRequest();
    try {
        axios.get(`/bot/recommend?expert_id=${chatPartner.value.expertId}`).then((rs) => {
            if (rs.data.code === 0) {
                rs = rs.data.data;
                rs.customList = rs.customList.sort((a, b) => {
                    return a.sort - b.sort;
                });
                rs.historyList = rs.historyList.sort((a, b) => {
                    return new Date(a.time) - new Date(b.time);
                });
                oftenList.value = rs.recommendList;
                customList.value = rs.customList;
                // recommendList.value = rs.historyList;
                historyList.value = rs.historyList;
                recommendList.value = historyList.value;
            }
        });
    } catch (error) {
        console.log("recommend watch error", error);
    } finally {
        apiStatusStore.markRequestComplete();
    }
});
watch(recommendListActive, () => {
    if (recommendListActive.value === recommendList.value.length) {
        document.querySelector(".hover")?.classList.remove("hover");
        scrollBottom("auto");
    } else {
        handleListActive();
    }
});
function handleListActive() {
    let hover = document.querySelector(".hover");
    if (!hover) return false;
    const list = document.querySelector(".recommend .list");
    if (!list) return false;
    let hoverTop = hover.offsetTop - list.clientHeight / 2 - 25;
    list.scrollTo({
        behavior: "smooth",
        top: hoverTop,
    });
    return true;
}
watch(recommendActive, (newV, oldV) => {
    if (newV < 0 || newV > titles.value.length - 1) {
        recommendActive.value = oldV;
    } else {
        switch (newV) {
            case 0:
                recommendList.value = historyList.value;
                break;
            case 1:
                recommendList.value = customList.value;
                break;
            case 2:
                recommendList.value = oftenList.value;
                break;
        }
        nextTick(() => {
            recommendListActive.value = recommendList.value.length;
            recommendList.value.forEach((item) => {
                item.hover = false;
            });
        });

        scrollBottom("auto");
    }
});
watchEffect(() => {
    if (isOpenRecommend.value && !handleListActive()) {
        scrollBottom("auto");
    }
});
async function scrollBottom(behavior) {
    await nextTick();
    const list = document.querySelector(".recommend .list");
    if (!list) return;
    list.scrollTo({
        behavior: behavior,
        top: list.scrollHeight,
    });
}

// async function scrollBottom(behavior) {
//     await nextTick();
//     let list = document.querySelector(".list");
//     if (!list) return;
//     list.scrollTo({
//         behavior: behavior,
//         top: list.scrollHeight,
//     });
// }

// const active = ref(0);
const isOpenAdd = ref(false);
const titles = ref([
    { title: "歷史記錄", icon: "fa-solid fa-clock-rotate-left" },
    { title: "個人專用", icon: "fa-regular fa-comment-dots" },
    { title: "常用指令", icon: "fa-regular fa-rectangle-list" },
]);
// fa-regular fa-comment-dots
// fa-regular fa-rectangle-list
function pushInput(data) {
    // emitter.emit("pushData", { data: data, type: "text" });
    isOpenRecommend.value = false;
    emitter.emit("pushInput", data);
}
function pushData(data) {
    isOpenRecommend.value = false;
    emitter.emit("pushData", { data: data, type: "text" });
}
async function switchInput() {
    isOpenAdd.value = isOpenAdd.value ? false : true;
    if (isOpenAdd.value) {
        // await nextTick();
        // customInputDom.value.click();
    }
}
async function addRecommend() {
    if (!customInput.value.trim()) return;
    let rs = await axios.post("/bot/customRecommend", JSON.stringify({ text: customInput.value }));
    if (rs.data.code == 0) {
        let sort = rs.data.data.sort;
        customList.value.push({ text: customInput.value, sort: sort });
        customInput.value = "";
        isOpenAdd.value = false;
    }
}
function addCusRecommend(text) {
    customInput.value = text;
    addRecommend();
    recommendActive.value = 1;
}
async function delRecommend(sort) {
    let rs = await axios.post("/bot/delCustomRecommend", JSON.stringify({ sort: sort }));

    if (rs.data.code == 0) {
        customList.value = customList.value.filter((f) => f.sort != sort);
    }
}
</script>

<template>
    <div class="recommend" v-show="isOpenRecommend">
        <div class="navbar">
            <div class="btns">
                <div class="btn" v-for="(item, index) in titles" :key="index" @click="recommendActive = index">
                    <div style="display: flex" class="title">
                        <!-- <span><i :class="item.icon"></i></span> -->
                        <p>{{ item.title }}</p>
                    </div>
                    <transition name="active">
                        <span class="bottom_line" v-if="recommendActive === index"></span>
                    </transition>
                </div>
            </div>
            <div class="btn_close" @click="isOpenRecommend = false">
                <p><i class="fa-solid fa-xmark"></i></p>
            </div>
        </div>
        <div class="list" v-if="recommendActive === 0">
            <div class="group" v-for="item in recommendList" :key="item" :class="{ hover: item.hover }">
                <div class="btn">
                    <span class="select_text" @click="pushData(item.text)">送出</span>
                    <span v-if="!item.isOpenBtnGroup" class="select" @click="item.isOpenBtnGroup = true"
                        ><i class="fa-solid fa-angle-right"></i
                    ></span>
                    <span v-else class="select" @click="item.isOpenBtnGroup = false"
                        ><i class="fa-solid fa-angle-left"></i
                    ></span>
                </div>
                <div
                    class="btn_group"
                    :class="{ btn_group_show: item.isOpenBtnGroup }"
                    @click="item.isOpenBtnGroup = false"
                >
                    <div class="btn" @click="addCusRecommend(item.text)">
                        <span><i class="fa-regular fa-square-plus"></i></span>
                        <span>個人</span>
                    </div>
                </div>
                <p @click="pushInput(item.text)" class="item">{{ item.text }}</p>
            </div>
        </div>

        <div class="list custom" v-if="recommendActive === 1">
            <div :class="{ hover: item.hover }" v-for="item in customList" :key="item">
                <div class="item item_list">
                    <p @click="pushInput(item.text)">
                        {{ item.text }}
                    </p>
                    <span @click="delRecommend(item.sort)"><i class="fa-solid fa-trash"></i></span>
                </div>
            </div>
            <div class="addInput" :class="{ open_input: isOpenAdd }">
                <textarea ref="customInputDom" type="text" v-model="customInput"></textarea>
                <p @click="addRecommend"><i class="fa-solid fa-check"></i></p>
            </div>
            <p class="item addItem" @click="switchInput">自訂義快捷<i class="fa-regular fa-square-plus"></i></p>
        </div>

        <div class="list" v-if="recommendActive === 2">
            <div :class="{ hover: item.hover }" v-for="item in oftenList" :key="item">
                <p @click="pushInput(item.text)" class="item">
                    {{ item.text }}
                </p>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.recommend {
    width: 100%;
    height: 15rem;
    border-top: 1px solid var(--theme-color);
    border-radius: 0.5rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background-color: var(--primary-color);
    .navbar {
        display: flex;
        padding-top: 0.5rem;
        justify-content: space-between;
        .btns {
            display: flex;
            .btn {
                display: flex;
                flex-direction: column;
                cursor: pointer;
                margin-left: 1rem;
                .title {
                    display: flex;
                    align-items: center;
                    span {
                        color: var(--text-color);
                        font-size: 0.8rem;
                    }
                }
                p {
                    padding: 0.3rem;
                    color: var(--text-color);
                }
                .bottom_line {
                    background-color: var(--theme-color);
                    height: 3px;
                    width: 100%;
                    display: block;
                    border-radius: 3px;
                }
            }
        }
        .btn_close {
            cursor: pointer;
            margin-right: 1rem;
            p {
                color: var(--text-color);
                padding: 0.3rem;
                font-size: 1.2rem;
            }
        }
    }
    .list {
        color: var(--text-color);
        padding: 0.5rem 1rem;
        margin-top: 0.5rem;
        overflow-y: scroll;
        // height: 80%;
        transition: 0.3s;
        .item {
            cursor: pointer;
            padding: 0.5rem;
            margin: 0.3rem 0;
            border-radius: 0.3rem;
            transition: 0.3s;
            border: 1px solid rgba($color: #6576db, $alpha: 0.3);
            word-break: break-all;

            &:hover {
                border: 1px solid var(--theme-color);
            }
        }
        .hover {
            .item {
                border: 1px solid var(--theme-color);
            }
        }
        .group {
            display: flex;
            width: 100%;
            align-items: center;
            justify-content: space-between;
            position: relative;
            .item {
                width: 100%;
            }
            .btn {
                // width: 40%;
                // margin-left: 0.5rem;
                min-width: 5rem;
                height: 2rem;
                margin-right: 0.5rem;
                padding: 0.3rem 0;
                // background-color: rgba($color: #6576db, $alpha: 0.3);
                // border: 1px solid rgba($color: #6576db, $alpha: 0.3);
                // background-color: rgba($color: #303753, $alpha: 1);
                // border: 1px solid rgba($color: #404a7c, $alpha: 1);
                background-color: rgba($color: var(--primary-color), $alpha: 0.8);
                border: 1px solid var(--theme-color);
                color: var(--text-color);
                border-radius: 0.3rem;
                cursor: pointer;
                transition: 0.3s;
                max-width: 5rem;
                overflow: hidden;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1;
                transition: 0.3s;
                &:hover {
                    border: 1px solid var(--theme-color);
                }
                span {
                    margin: 0 0.2rem;
                    font-size: 0.9rem;
                }
                .select_text {
                    display: flex;
                    justify-content: center;
                    width: 70%;
                    white-space: nowrap;
                    padding: 2rem 0;
                }
                .select {
                    background-color: var(--theme-color);
                    padding: 0.8rem 0.5rem;
                    margin: 0;
                    width: 30%;
                    display: flex;
                    justify-content: center;
                    color: white;
                }
            }
            .btn_group {
                position: absolute;
                left: 0;
                opacity: 0;
                // transition: 0.3s;
                visibility: hidden;
            }
            .btn_group_show {
                // left: 5.5rem;
                position: static;
                visibility: visible;
                opacity: 1;
            }
        }
    }
    .custom {
        .item_list {
            position: relative;
            display: flex;
            align-items: center;
            padding-right: 2.5rem;
            z-index: 0;
            p {
                word-break: break-all;
                width: 100%;
            }
            span {
                padding: 0.5rem 0.8rem;
                position: absolute;
                right: 0;
            }
        }
        .addItem {
            display: flex;
            justify-content: space-between;
            background-color: rgba($color: #6576db, $alpha: 0.3);
        }
        .addInput {
            width: 100%;
            display: flex;
            position: relative;
            overflow: hidden;
            transition: 0.3s;
            height: 0;
            opacity: 0;
            textarea {
                width: 100%;
                resize: none;
                font-size: 1rem;
                border: 1px solid rgba($color: #6576db, $alpha: 0.3);
                border-radius: 0.3rem;
                color: var(--text-color);
                padding: 0.5rem;
                background-color: rgba($color: #000000, $alpha: 0);
                padding-right: 2rem;
                overflow: hidden;
                &:focus {
                    border: 1px solid rgba($color: #6576db, $alpha: 1);
                }
            }
            p {
                cursor: pointer;
                position: absolute;
                top: 0.5rem;
                right: 1rem;
            }
        }
        .open_input {
            height: 5rem;
            opacity: 1;
            textarea {
                overflow: auto;
            }
        }
    }
}

.active-enter-from {
    opacity: 0;
    transform: translateY(100%);
}
.active-enter-active {
    transition: 0.1s;
}
.active-enter-to {
    opacity: 1;
    transform: translateY(0);
}

.active-leave-from {
    opacity: 1;
    transform: translateY(0);
}
.active-leave-active {
    transition: 0.1s;
}
.active-leave-to {
    opacity: 0;
    transform: translateY(100%);
}
</style>
