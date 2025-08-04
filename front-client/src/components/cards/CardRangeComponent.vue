<script setup>
import { ref, toRefs } from "vue";
const props = defineProps({
    card: { type: Object, default: {} },
});
const { card } = toRefs(props);

const emit = defineEmits(["pushForm", "pushText"]);

const errorMsg = ref("");

function confirmAction(form) {
    if (startSelect.value === -1 || endSelect.value === -1) {
        errorMsg.value = "*未填完整";
    } else {
        errorMsg.value = "";
        const fields = {
            id: card.value.id,
            startSelect: card.value.items[startSelect.value].value,
            endSelect: card.value.items[endSelect.value].value,
        };
        const type = card.value.type;
        emit("pushForm", { form, fields, type });
    }
}
function isItemDisabled(item) {
    return item.disabled === "true" || item.disabled === true; // 根據項目的屬性判斷是否禁用
}

const startSelect = ref(-1);
const endSelect = ref(-1);

function selectSort() {
    //時間 起>訖 則交換
    if (
        startSelect.value !== -1 &&
        endSelect.value !== -1 &&
        parseTimeToDecimal(card.value.items[startSelect.value].value) >
            parseTimeToDecimal(card.value.items[endSelect.value].value)
    ) {
        let temp = startSelect.value;
        startSelect.value = endSelect.value;
        endSelect.value = temp;
    }
}

function handleClick(item, index) {
    if (isItemDisabled(item)) return;
    if (startSelect.value === index) {
        //再次點擊起時
        if (endSelect.value === -1) {
            //有起 無訖則取消起
            startSelect.value = -1;
        } else {
            //有起 有訖則起=訖，並取消訖
            startSelect.value = endSelect.value;
            endSelect.value = -1;
        }
    } else if (endSelect.value === index) {
        //再次點擊訖時，取消訖
        endSelect.value = -1;
    } else if (startSelect.value === -1) {
        //點擊起時
        startSelect.value = index;
    } else if (endSelect.value === -1) {
        //點擊訖時
        endSelect.value = index;
    } else {
        //起訖都點過，並點擊新的地方，則刷新
        endSelect.value = -1;
        startSelect.value = index;
    }

    selectSort();

    let is_delete = false;
    let text;
    if (startSelect.value === -1 && endSelect.value === -1) {
        is_delete = true;
    } else {
        let selectRoom = typeof card.value.title === "string" ? card.value.title : card.value.title.text;
        text = `${selectRoom} 選定起訖的時間 ${
            startSelect.value !== -1 ? card.value.items[startSelect.value].text : "________"
        } 至 ${endSelect.value !== -1 ? card.value.items[endSelect.value].text : "________"}`;
    }

    emit("pushText", { id: card.value.id, text: text, is_delete: is_delete });
}

// 解析時間並將其轉換為小數形式
function parseTimeToDecimal(time) {
    const match = time.match(/^(\d+):(\d{2})$/);
    if (match) {
        const hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        return hour + minute / 60; // 例如：11:30 -> 11 + 30/60 = 11.5
    }
    return null; // 如果無法匹配格式，返回 null
}
</script>

<template>
    <div class="flex flex-col h-full card_range_com">
        <ul class="flex-1 content">
            <li v-for="(item, index) in card.items" :key="index" class="item">
                <span v-if="item.type && item.type == 'hr'" class="content-hr"></span>
                <div
                    v-else
                    class="content-div selected"
                    :class="[
                        { disabled: isItemDisabled(item) },
                        {
                            startSelect: index === startSelect,
                            endSelect: index === endSelect,
                            centerSelect: index > startSelect && index < endSelect,
                        },
                    ]"
                    @click="handleClick(item, index)"
                >
                    <span class="selected selected-start">起</span>
                    <!-- 顯示「起」 -->
                    <span class="selected selected-end">訖</span>
                    <!-- 顯示「訖」 -->
                    <span class="content-text">{{ item.text }}</span>
                    <v-tooltip location="right">{{ item.tip }}</v-tooltip>
                </div>
            </li>
        </ul>
        <div v-if="card.confirmAction" class="button-container">
            <p v-if="errorMsg" class="error_msg">{{ errorMsg }}</p>
            <button @click="confirmAction(card.form)">{{ card.confirmAction.text }}</button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.card_range_com {
    .content {
        overflow-y: auto;
        max-height: 25vh;

        .item {
            display: flex;
            justify-content: center;
            cursor: pointer;
            overflow: hidden;

            &:last-child {
                border-bottom-left-radius: 0.5rem;
                border-bottom-right-radius: 0.5rem;
            }

            .disabled {
                cursor: not-allowed;
                opacity: 0.6;
            }

            .content-hr {
                height: 1px;
                background-color: var(--text-color);
                width: 90%;
                margin: 0.3rem 0;
            }

            .content-div {
                width: 100%;
                background-color: var(--secondary-color);
                transition: 0.3s padding, 0.3s background-color;
                display: flex;
                justify-content: center;
                position: relative;
                .content-text {
                    width: 100%;
                    text-align: center;
                    padding: 0.5rem 0;
                }
                .selected {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100%;
                    width: 3rem;
                    position: absolute;
                    left: 0;
                    top: 0;
                    transition: 0.3s transform, 0.3s opacity;
                    transform: translateX(-3rem);
                    opacity: 0;
                }
                &:hover {
                    background-color: var(--primary-color);
                    // color: black;
                    // background-color: #365899;
                }
            }
            .startSelect {
                // padding-left: 3rem;
                font-weight: bold;
                background-color: var(--select-color);
                color: #22C55E;
                .selected-start {
                    transform: translateX(0);
                    opacity: 1;
                }
                &:hover {
                    background-color: var(--primary-color);
                }
            }
            .centerSelect {
                background-color: var(--select-color);
            }
            .endSelect {
                // padding-left: 3rem;
                font-weight: bold;
                background-color: var(--select-color);
                color: rgba(230, 80, 76, 1);
                .selected-end {
                    transform: translateX(0);
                    opacity: 1;
                }
                &:hover {
                    background-color: var(--select-color);
                }
            }
        }
    }
    .button-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.5rem 0;
        border-top: 1px solid var(--text-color);
        .error_msg {
            color: red;
            font-size: 0.8rem;
        }
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
}
</style>
