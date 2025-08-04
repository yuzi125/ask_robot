<script setup>
import { ref, watch, inject, nextTick, onUnmounted } from "vue";
import { useStateStore } from "../store/index";
import { storeToRefs } from "pinia";

const emitter = inject("emitter");
const stateStore = useStateStore();
const { isOpenCmd, isOpenRecommend, userInput, is_tunnel } = storeToRefs(stateStore);

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
                top: top - 20,
            });
        }
    
}
let tunnel_cmd = [
    { text: "/t ", plac: "(您的訊息) # 申請模式" },
    // { text: "/tunnel ", plac: "(您的訊息) # 申請模式" },
];
let exit_cmd = [
    { text: "/e", plac: "# 離開申請模式" },
    // { text: "/exit",plac:"# 離開申請模式" }
];
let cmd_data = [...tunnel_cmd, ...exit_cmd];
// let cmd_data = ["/t ", "/tunnel ", "/e", "/exit"];

cmd_data = cmd_data.reverse();
const cmds = ref([]);
const cmd_active = ref(0);
//提示詞呼叫出則關閉cmd選單
watch(isOpenRecommend, () => {
    isOpenCmd.value = false;
});
//使用者輸入變化則偵測有無/以及提示詞關閉才能打開
watch(userInput, (newV) => {
    if (!newV) {
        isOpenCmd.value = false;
        return;
    }
    cmds.value = cmd_data.filter((f) => f.text.indexOf(newV) !== -1);

    if ((newV && !newV.startsWith("/")) || cmds.value.length === 0 || isOpenRecommend.value || is_tunnel.value) {
        isOpenCmd.value = false;
    } else {
        isOpenCmd.value = true;
        cmd_active.value = cmds.value.length > 0 ? cmds.value.length - 1 : 0;
        scrollBottom("auto");
    }
});
//限制acitve最大與最小
watch(cmd_active, (newV, oldV) => {
    if (newV < 0 || newV >= cmds.value.length) {
        cmd_active.value = oldV;
    }
});

function handleKeydown(event) {
    if (!isOpenCmd.value) return;
    if (event.key === "ArrowDown") {
        cmd_active.value++;
        scrollItem("smooth");
    } else if (event.key === "ArrowUp") {
        cmd_active.value--;
        scrollItem("smooth");
    }
    if (event.key === "Enter") {
        // event.preventDefault();
        pushInput(cmds.value[cmd_active.value].text);
    }
    if (event.key === "Escape") {
        isOpenCmd.value = false;
    }
}

watch(isOpenCmd, (newV) => {
    if (newV) {
        document.addEventListener("keydown", handleKeydown);
    } else {
        document.removeEventListener("keydown", handleKeydown);
    }
});
function handleMouseenter(index) {
    cmd_active.value = index;
}

function pushInput(data) {
    emitter.emit("pushInput", data);
    nextTick(() => {
        isOpenCmd.value = false;
    });
}
</script>

<template>
    <div class="cmd_com" v-show="isOpenCmd && cmds.length !== 0">
        <div class="list" ref="listRef">
            <div
                v-for="(cmd, index) in cmds"
                :key="index"
                @click="pushInput(cmd.text)"
                @mouseenter="handleMouseenter(index)"
                class="item"
                :class="{ hover: cmd_active === index }"
            >
                <p>{{ cmd.text }}</p>
                <span>{{ cmd.plac }}</span>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.cmd_com {
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
