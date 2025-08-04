<script setup>
import { ref, toRefs, inject, computed } from "vue";
import ConfirmComponents from "./ConfirmComponents.vue";

const emitter = inject("emitter");

import { useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
const stateStore = useStateStore();
const { chatPartner } = storeToRefs(stateStore);

const props = defineProps({
    data: { type: Object, default: {} },
});
const data = props.data;
const recheck_data = ref([]);

function isFieldValid(field) {
    if (field === undefined || field === true) {
        return true;
    } else if (field === false) {
        return false;
    }
}
Object.keys(data).forEach((item) => {
    if (item === "time") return;
    let obj = {
        key: item,
        value: data[item].value,
        editable: isFieldValid(data[item].editable),
        label: data[item].label,
        is_show:  isFieldValid(data[item].is_show),
    };

    recheck_data.value.push(obj);
});

//設定本地隧道模式
function setLocalTunnel(roomId, msg) {
    localStorage.setItem("tunnel_" + roomId, JSON.stringify(msg || false));
}
//取得本地隧道模式
function getLocalTunnel(roomId) {
    return JSON.parse(localStorage.getItem("tunnel_" + roomId)) || false;
}

const is_edit = computed(() => {
    return recheck_data.value.findIndex((f) => f.input) !== -1;
});

const send_confirm = ref(null);
function sendform() {
    let msg = getLocalTunnel(chatPartner.value.roomId);
    recheck_data.value.forEach((item) => {
        msg.current_form[item.key].value = item.value;
    });
    setLocalTunnel(chatPartner.value.roomId, msg);
    emitter.emit("pushData", { data: "表單確認", type: "text" });
    send_confirm.value.isOpen = false;
}

</script>

<template>
    <div class="recheck_box">
        <div class="mkd">
            <p>目前填單資訊:</p>
            <div v-for="(item, index) in recheck_data" :key="index" >
                <div v-if="item.is_show" class="item">
                    <p class="info">{{ item.label }} :</p>
                    <div class="field">
                        <p v-if="!item.input">{{ item.value }}</p>
                        <input v-else type="text" v-model="item.value" />
                        <div v-if="item.editable">
                            <span v-if="!item.input" @click="item.input = true"><i
                                    class="fa-solid fa-pen-to-square"></i></span>
                            <span v-else @click="item.input = false"><i class="fa-solid fa-check"></i></span>
                        </div>
                    </div>
                </div>
            </div>
            <button v-if="!is_edit" @click="send_confirm.isOpen = true" class="sendform">確認送出表單</button>
            <button v-else class="sendform disabled">編輯中...</button>
        </div>
        <ConfirmComponents ref="send_confirm" title="確認要送出表單嗎?" detail="送出後將不可修改" @confirm="sendform">
        </ConfirmComponents>
    </div>
</template>

<style lang="scss" scoped>
.recheck_box {
    margin-bottom: 1rem;

    .item {
        display: flex;
        align-items: center;

        input {
            margin-left: 0.5rem;
            margin-right: 0.5rem;
            border: none;
            // border-bottom: 1px solid var(--text-color);
            background-color: var(--primary-color);
            color: var(--text-color);
            font-size: 1rem;
            display: block;
            border-radius: 0.2rem;
        }

        .field {
            display: flex;

            p {
                margin-left: 0.5rem;
                margin-right: 0.5rem;
                color: var(--text-color);
            }

            span {
                cursor: pointer;
            }
        }
    }

    .sendform {
        // border: 1px solid var(--text-color);
        border: none;
        background-color: var(--theme-color);
        color: white;
        border-radius: 0.2rem;
        cursor: pointer;
        padding: 0.5rem 1rem;
    }

    .disabled {
        background-color: var(--theme-color-30);
        cursor: auto;
    }
}
</style>
