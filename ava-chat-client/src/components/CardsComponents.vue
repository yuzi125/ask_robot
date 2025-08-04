<script setup>
import { computed, inject, onMounted, ref, toRefs } from "vue";
import CardMultiComponent from "./cards/CardMultiComponent.vue";
import CardRangeComponent from "./cards/CardRangeComponent.vue";
import CardSingleComponent from "./cards/CardSingleComponent.vue";
const props = defineProps({
    data: { type: Object, default: {} },
});

const { data } = toRefs(props);
const emitter = inject("emitter");

function pushForm(item, responseType) {
    //聊天結束時data被塞入時間 再將此時間塞入form(獨立)
    let form = JSON.parse(JSON.stringify(item.form));
    form.time = data.value.time;
    form.type = item.type;
    form.comVal = item.form;
    //打開form表單的組件的值，例如: card組件打開form，則form的comVal裡面會有card傳來的值
    // form.comVal = item.comVal;
    form.fields = item.fields;
    form.responseType = responseType;
    emitter.emit("pushForm", form);
}

const selectInfoList = ref([]);
function pushText(item) {
    if (item.is_delete) {
        selectInfoList.value = selectInfoList.value.filter((f) => f.id !== item.id);
        return;
    }
    const selectInfo = selectInfoList.value.find((f) => f.id === item.id);
    if (selectInfo) {
        selectInfo.text = item.text;
    } else {
        selectInfoList.value.push(item);
    }
}

const active = ref(0);
const cards = ref(null);
let card;

const notPCUser = ref(false);
onMounted(() => {
    const u = navigator.userAgent;
    const isAndroid = u.indexOf("Android") > -1;
    const isIPhone = u.indexOf("iPhone") > -1;
    if (isAndroid || isIPhone) {
        cards.value.style.overflowX = "scroll";
        notPCUser.value = true;
        cards.value.style.paddingBottom = "1rem";
    }
    card = cards.value.querySelectorAll(".card");
});

function changeActive(n) {
    if (active.value + n < 0 || active.value + n > data.value.data.length - 1) {
        return;
    }
    active.value += n;
    //每個card的最左側x座標

    const activeLeft = card[active.value].offsetLeft;
    //如果每個是80% 左右兩邊各空10%，修改card的width這邊要改
    const space = cards.value.offsetWidth * 0.1;
    if (cards.value) {
        cards.value.scrollTo({
            behavior: "smooth",
            left: activeLeft - space,
        });
    }
}

// 透過 titleDisplay 來判斷 title 是字串還是物件
const titleDisplay = computed(() => (card) => {
    if (typeof card.title === "string") {
        return { isString: true, text: card.title };
    } else {
        return {
            isString: false,
            text: card.title.text,
            href: card.title.href,
            target: card.title.target,
            tip: card.title.tip,
        };
    }
});

// 開啟外部連結
const openExternalLink = (url) => {
    emitter.emit("openUrl", url);
};
</script>

<template>
    <div class="cards_box">
        <!-- <p v-show="active > 0 && !notPCUser" class="left-right left" @click="changeActive(-1)">
            <i class="fa-solid fa-angle-left"></i>
        </p>
        <p v-show="active < data.data.length - 1 && !notPCUser" class="left-right right" @click="changeActive(1)">
            <i class="fa-solid fa-angle-right"></i>
        </p> -->
        <div class="cards" ref="cards">
            <div class="flex flex-col card" v-for="(card, index) in data.data" :key="index">
                <!-- <p class="title">{{ card.title }}</p> -->
                <div class="flex items-center justify-center h-14 title">
                    <template v-if="titleDisplay(card).isString">
                        <p>{{ titleDisplay(card).text }}</p>
                    </template>
                    <template v-else>
                        <a @click.stop="openExternalLink(titleDisplay(card).href)">{{ titleDisplay(card).text }}</a>
                        <!-- <span>{{ titleDisplay(card).tip }}</span> -->
                    </template>
                </div>
                <div v-if="card.selection_mode === 'start_end'" class="flex-1">
                    <CardRangeComponent
                        :card="card"
                        @pushForm="pushForm($event, card.responseType)"
                        @pushText="pushText"
                    ></CardRangeComponent>
                </div>
                <div v-else-if="card.selection_mode === 'multi'" class="flex-1">
                    <CardMultiComponent :card="card" @pushForm="pushForm" @pushText="pushText"></CardMultiComponent>
                </div>
                <div v-else-if="card.selection_mode === 'single'" class="flex-1">
                    <CardSingleComponent :card="card" @pushForm="pushForm" @pushText="pushText"></CardSingleComponent>
                </div>
                <div v-else class="flex-1">
                    <CardRangeComponent :card="card" @pushForm="pushForm" @pushText="pushText"></CardRangeComponent>
                </div>
            </div>
        </div>
        <!-- 顯示預定時間 -->
        <div v-for="(item, index) in selectInfoList" :key="index">
            <div class="select_info_list">
                <p>{{ item.title }}</p>
                <p>{{ item.text }}</p>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.cards_box {
    position: relative;

    // .left-right {
    //     position: absolute;
    //     cursor: pointer;
    //     font-size: 2rem;
    //     // background-color: var(--text-color);
    //     // color: black;
    //     background-color: #888888;
    //     color: var(--text-color);
    //     min-width: 2.5rem;
    //     min-height: 2.5rem;
    //     display: flex;
    //     justify-content: center;
    //     align-items: center;
    //     border-radius: 50%;
    //     // border: 2px solid var(--secondary-color);
    //     top: 50%;
    //     transform: translateY(-50%);
    //     box-shadow: 0px 0px 10px black;
    // }

    // .left {
    //     left: 0;
    // }

    .button-container {
        display: flex;
        justify-content: center;
        padding: 0.5rem 0;
        border-top: 1px solid var(--text-color);
    }

    .button-container button {
        padding: 5px 15px;
        /* 調整按鈕大小 */
        background-color: var(--theme-color);
        /* 按鈕顏色 */
        color: white;
        border: none;
        border-radius: 5px;
        /* 或其他樣式 */
        cursor: pointer;
    }

    .button-container button:hover {
        background-color: var(--theme-color);
        /* 按鈕 hover 狀態的顏色 */
    }

    .right {
        right: 0;
    }

    .cards {
        display: flex;
        justify-items: center;
        align-items: stretch;
        overflow-x: auto;

        .card {
            border: 1px solid var(--text-color);
            background-color: var(--secondary-color);
            // background-color: var(--primary-color);
            border-radius: 0.5rem;
            margin-right: 0.5rem;
            // min-width: 80%;
            width: 80%;
            min-width: 200px;
            max-width: 350px;

            &:last-child {
                margin-right: 0;
            }

            .title {
                padding: 0.5rem 0.5rem;
                display: flex;
                justify-content: center;
                border-bottom: 1px solid var(--text-color);
                color: var(--text-color);

                a {
                    color: var(--text-color);
                }
            }
        }
    }
    .select_info_list {
        display: inline-block;
        margin-top: 0.5rem;
        padding: 0.3rem 0;
        border-bottom: 1px solid var(--text-color);
        color: var(--text-color);
    }
}
</style>
