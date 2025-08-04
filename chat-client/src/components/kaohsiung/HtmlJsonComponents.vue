<script setup>
import { ref, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import ConfirmComponents from "@/components/ConfirmComponents.vue";
import { useStateStore, useUserStore } from "@/store/index";
import { storeToRefs } from "pinia";
import { marked } from "marked";

const router = useRouter();

const stateStore = useStateStore();
const props = defineProps({
    data: { type: Array, default: [] },
});
const { chatPartner } = storeToRefs(stateStore);
const userStore = useUserStore();
const { contactList } = storeToRefs(userStore);
const data = props.data;

const emitter = inject("emitter");
const axios = inject("axios");

const confirm = ref(null);

const action = ref({});
const open_confirm = function (item) {
    confirm.value.isOpen = true;
    action.value = item;
};
const handleButtonNoConfirm = function (item) {
    action.value = item;
    actions[action.value.action]();
};
function handleConfirm() {
    console.log("action: ", action);
    try {
        actions[action.value.action]();
        confirm.value.isOpen = false;
    } catch (error) {
        console.error("執行 action 時發生錯誤:", error);
    }
}

const tunnelStart = function () {
    let args = action.value.args;
    emitter.emit("pushData", { data: `/t ${args[0]}`, type: "text" });
};

/* 
    切換專家，python 傳過來的格式會是
    {
        "tag": "button",
        "text": "我是 text",
        "action": "switchExpert",
        "args": ["cacfc68a-0fd9-4bfe-a9ca-bcc04d4d9120", "我會直接輸出"]
    }
*/
const switchExpert = async function () {
    let args = action.value.args;
    let expertId = args[0]; //專家 id
    let message = args[1]; // 點擊按鈕後要輸出的訊息
    //用專家 id 去找 roomid
    // contactList 是房間的列表 會有 expertId 和 roomId 等等的資訊
    const targetContact = contactList.value.find((f) => f.expertId === expertId);
    if (!targetContact.roomId) {
        console.log("該專家尚未建立聊天室，準備建立...");
        let rs = await axios.post("/bot/room", JSON.stringify({ expertId }));
        if (rs.data.data?.roomId) {
            targetContact.roomId = rs.data.data?.roomId;
            console.log("聊天室建立完成");
        } else {
            console.log("聊天室建立失敗");
            return;
        }
    }
    router.push(`/b/${targetContact.roomId}`);

    setTimeout(() => {
        emitter.emit("pushData", { data: message, type: "text" });
    }, 2000);
};

const postMessage = function () {
    console.log("action.value.args: ", action.value.args);
    let args = action.value.args;

    // 確保 args 是一個對象並且不是數組
    if (typeof args !== "object" || Array.isArray(args)) {
        console.error("args 不是一個對象:", args);
        return;
    }

    let post_function = args.post_function;
    let value = args.value;

    // 確保 post_function 是字串
    if (typeof post_function !== "string") {
        console.error("post_function 必須是字串:", post_function);
        return;
    }

    // 確保 value 是一個字串
    if (typeof value !== "string") {
        console.error("value 必須是一個字串:", value);
        return;
    }

    // 確保 value 是可序列化的
    try {
        const parsedValue = JSON.parse(value);
        value = JSON.stringify(parsedValue);
    } catch (error) {
        console.error("value 無法解析和序列化:", value, error);
        return;
    }

    window.parent.postMessage({ type: post_function, value: value }, "*");
};

const apiPost = function () {
    const expert_id = chatPartner.value.expertId;
    let args = action.value.args;
    let url = args.url;
    let post_data = args.post_data;
    let header = args.header;
    let actionMessage = args.actionMessage;
    let headers = {
        ...header,
    };
    emitter.emit("writeChatUser", { data: actionMessage, type: "text" });
    post_data = {
        expert_id: expert_id,
        ...{ post_data },
    };
    axios.post(url, post_data, { headers: headers }).then((res) => {
        emitter.emit("writeChatBot", {
            msg: { data: res.data.data, type: "text" },
            userMsg: { data: actionMessage, type: "text" },
        });
    });
};

const buttonTextToInput = () => {
    console.log("buttonTextToInput");
};
const actions = {
    tunnelStart: tunnelStart,
    apiPost: apiPost,
    buttonTextToInput: buttonTextToInput,
    switchExpert: switchExpert,
    postMessage: postMessage,
    pushData: () => {
        emitter.emit("pushData", { data: action.value.args[0], type: "text" });
    },
};

const handleButtonTextToInput = (item) => {
    emitter.emit("pushInput", item.text);
};

const handleButtonParamsToInput = (item) => {
    emitter.emit("pushInput", item.params);
};

const renderMarkdown = (text) => {
    return marked(text);
};

const openExternalLink = (url) => {
    emitter.emit("openUrl", url);
};
</script>

<template>
    <!-- 渲染歡迎詞和提示按鈕 為了不要套用到原本的 style 所以額外判斷 -->
    <div class="flex flex-wrap items-center">
        <template v-for="(item, index) in data" :key="index">
            <template v-if="item && item.isTip">
                <template v-if="item.tag === 'buttonTip'">
                    <button class="p-2 m-2 rounded-sm bg-[#57B0B7] text-white" @click="handleButtonTextToInput(item)">
                        {{ item.text }}
                    </button>
                </template>
                <template v-if="item.tag === 'buttonTipWithParams'">
                    <button class="p-2 m-2 rounded-sm bg-[#57B0B7] text-white" @click="handleButtonParamsToInput(item)">
                        {{ item.text }}
                    </button>
                </template>
                <template v-else-if="item.tag === 'buttonTipBr'">
                    <br />
                </template>
                <template v-else-if="item.tag === 'buttonTipHr'">
                    <hr class="w-full h-1 mt-2" />
                </template>
                <template v-else-if="item.tag === 'buttonTipP'">
                    <!-- 如果 data.length 是 1 的話 代表只有歡迎詞而已 沒有提示 -->

                    <div class="mkd" style="line-height: 1.1" v-dompurify-html="renderMarkdown(item.text)"></div>
                </template>
            </template>
        </template>
        <!-- <span v-if="data.length >= 2">或者，你也可以使用上方的問號按鈕來查看功能。</span> -->
    </div>
    <div class="html_json_box">
        <!-- {{ data }} -->
        <template v-for="(item, index) in data" :key="index">
            <template v-if="!item?.isTip">
                <div v-if="item.tag === 'button'" :class="{ 'new-line': item.after_new_line }">
                    <div class="item">
                        <button @click="open_confirm(item)">{{ item.text }}</button>
                    </div>
                </div>
                <div v-if="item.tag === 'button_no_confirm'" :class="{ 'new-line': item.after_new_line }">
                    <div class="item">
                        <button @click="handleButtonNoConfirm(item)">{{ item.text }}</button>
                    </div>
                </div>
                <div v-else-if="item.tag === 'p'" :class="{ 'new-line': item.after_new_line }">
                    <div class="item">
                        <p>{{ item.text }}</p>
                    </div>
                </div>
                <div v-else-if="item.tag === 'html'" class="mkd" :class="{ 'new-line': item.after_new_line }">
                    <div class="item">
                        <div>
                            <div v-dompurify-html="item.text"></div>
                        </div>
                    </div>
                </div>
                <div v-else-if="item.tag === 'href'" class="mkd" :class="{ 'new-line': item.after_new_line }">
                    <div class="item">
                        <div>
                            <a @click.stop="openExternalLink(item.url)">
                                <div v-dompurify-html="item.text"></div>
                            </a>
                        </div>
                    </div>
                </div>
                <div v-else-if="item.tag === 'input'" :class="{ 'new-line': item.after_new_line }">
                    <div class="item">
                        <input type="text" :value="item.text" />
                    </div>
                </div>
                <template v-else-if="item.tag === 'hr'">
                    <hr class="w-full my-2 h-1 bg-[color:var(--text-color)]" />
                </template>

                <span v-if="item.tag == 'br'" class="content-br"></span>

                <!-- <span v-if="item.tag == 'hr'" class="content-hr"></span> -->
            </template>
        </template>
    </div>

    <ConfirmComponents
        ref="confirm"
        :title="`確認要${action.action === 'switchExpert' ? `切換至 ${action.text} 專家` : action.text}嗎?`"
        @confirm="handleConfirm"
    ></ConfirmComponents>
</template>

<style lang="scss" scoped>
.html_json_box {
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;

    .new-line {
        width: 100%;
    }

    .item {
        padding: 0.5rem 0;
        padding-right: 1rem;
        display: flex;
        justify-content: start;
        overflow: hidden;

        .content-hr {
            height: 1px;
            background-color: var(--text-color);
            width: 100%;
        }

        .content-br {
            height: 1px;
            width: 100%;
        }

        .mkd {
            width: 100%;
            /* Ensure the div takes full width for wrapping */
        }

        button {
            border: none;
            background-color: #57b0b7;
            color: white;
            border-radius: 0.2rem;
            cursor: pointer;
            padding: 0.5rem 1rem;
        }
    }
}
</style>
