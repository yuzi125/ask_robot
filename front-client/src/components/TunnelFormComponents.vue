<script setup>
import { ref, watch, inject, nextTick } from "vue";
import { useStateStore } from "../store/index";
import { storeToRefs } from "pinia";

const emitter = inject("emitter");
const axios = inject("axios");

const stateStore = useStateStore();
const { userInput, isOpenTunnelForm, is_tunnel,isWaitRes,isOpenCmd} = storeToRefs(stateStore);

//未完成先禁用此功能，強制關閉
// watch(isOpenTunnelForm,(newV)=>{
//     if(newV){
//         isOpenTunnelForm.value = false;
//     }
// })

let tunnel_form_list = [];

// 這個是用於檢查目前的一個週期內是否有按下 Enter  預設: 200 ms
let is_press_enter = false


async function init() {
    let rs = await axios.get("/bot/form");
    if (rs.data.data.length === 0) return;
    tunnel_form_list = rs.data.data.map((m) => {
        return {
            text: m.form_name,
            plac: "",
        };
    });
    list.value = tunnel_form_list.reverse();
    list_active.value = list.value.length - 1;
    scrollBottom("auto");
}
init();
watch(is_tunnel, (newV) => {
    if (newV) init();
});
watch(isOpenTunnelForm, async (newV) => {
    if (newV) await scrollBottom("auto");
});
//有輸入則直接過濾出任一段有相同的
watch(userInput, (newV) => {
    if (!is_tunnel.value) return;
    if (!newV) {
        list.value = tunnel_form_list;
        scrollBottom("auto");
        return;
    }
    list.value = tunnel_form_list.filter((f) => f.text.indexOf(newV) !== -1);
    if (list.value.length === 0) return;
    list_active.value = list.value.length - 1;
});

const listRef = ref(null);
async function scrollBottom(behavior) {
    await nextTick();
    if (listRef.value) {
        listRef.value.scrollTo({
            behavior: behavior,
            top: listRef.value.scrollHeight,
        });
    }
}
async function scrollItem(behavior) {
    await nextTick();
    let top = document.querySelector(".hover").offsetTop;
    if (listRef.value) {
        listRef.value.scrollTo({
            behavior: behavior,
            top: top - 50,
        });
    }
}
const list = ref([]);
const list_active = ref(0);
//限制acitve最大與最小
watch(list_active, (newV, oldV) => {
    if (newV < 0 || newV >= list.value.length) {
        list_active.value = oldV;
    }
});

document.addEventListener("keydown", handleKeydown);
function handleKeydown(event) {
    if (!is_tunnel.value) return;
    if (event.ctrlKey) {
        if (isOpenTunnelForm.value) {
            isOpenTunnelForm.value = false;
            return;
        }
        if (is_tunnel.value) {
            isOpenTunnelForm.value = true;
        }
    }
    if (isOpenTunnelForm.value) {
        if (event.key === "ArrowUp") {
            scrollItem("smooth");
            event.preventDefault();
            list_active.value--;
        } else if (event.key === "ArrowDown") {
            scrollItem("smooth");
            event.preventDefault();
            list_active.value++;
        }
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            isOpenTunnelForm.value = false;
            pushInput(list.value[list_active.value].text);
        }
        if (event.key === "Escape") {
            event.preventDefault();
            isOpenTunnelForm.value = false;
        }
    } else {
        if (event.key === "Enter" && !event.shiftKey && !is_press_enter) {
            event.preventDefault();
            is_press_enter = true
            if (isOpenCmd.value) return;
            if (!isWaitRes.value && userInput.value.trim() !== "") {
                emitter.emit("pushData", { data: userInput.value, type: "text" });
                userInput.value = "";
            }
            setTimeout(() => {
                is_press_enter = false
            }, 200);
        }
    }
}

function handleMouseenter(index) {
    list_active.value = index;
}

function pushInput(data) {
    emitter.emit("pushData", { data: `/e /t ${data}`, type: "text" });
    nextTick(() => {
        isOpenTunnelForm.value = false;
    });
}
</script>

<template>
    <div class="tunnel_form_box" v-show="isOpenTunnelForm && list.length !== 0">
        <div class="list" ref="listRef">
            <div
                v-for="(cmd, index) in list"
                :key="index"
                @click="pushInput(cmd.text)"
                @mouseenter="handleMouseenter(index)"
                class="item"
                :class="{ hover: list_active === index }"
            >
                <p>{{ cmd.text }}</p>
                <span>{{ cmd.plac }}</span>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.tunnel_form_box {
    width: 100%;
    max-height: 15rem;
    border-top: 1px solid var(--theme-color);
    border-radius: 0.5rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background-color: var(--primary-color);
    .list {
        padding: 0.5rem 1rem;
        margin-top: 0.5rem;
        overflow-y: auto;

        .item {
            cursor: pointer;
            padding: 0.5rem;
            margin: 0.3rem 0;
            border-radius: 0.3rem;
            transition: 0.3s;
            border: 1px solid var(--theme-color);
            word-break: break-all;
            display: flex;
            align-items: center;
            p {
                font-weight: bold;
                color: var(--text-color);
            }
            span {
                color: #888888;
                margin-left: 0.3rem;
                font-size: 0.9rem;
            }
        }
        .hover {
            border: 1px solid var(--theme-color);
            background-color: var(--theme-color-30);
        }
    }
}
</style>
