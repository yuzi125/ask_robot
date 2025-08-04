<script setup>
import { ref, toRefs } from "vue";
const props = defineProps({
    card: { type: Object, default: {} },
});
const { card } = toRefs(props);

const emit = defineEmits(["pushForm", "pushText"]);

const errorMsg = ref("");

function confirmAction(form) {
    if (multiSelect.value.length === 0) {
        errorMsg.value = "*至少選一個";
    } else {
        errorMsg.value = "";

        const fields = {
            id: card.value.id,
            multiSelect: multiSelect.value.map((m) => card.value.items[m].value),
        };
        const type = card.value.type;
        emit("pushForm", { form, fields, type });
    }
}
function isItemDisabled(item) {
    return item.disabled === "true"; // 根據項目的屬性判斷是否禁用
}

const multiSelect = ref([]);

function handleClick(item, index) {
    if (isItemDisabled(item)) return;
    const selectIndex = multiSelect.value.findIndex((f) => f === index);
    if (selectIndex === -1) {
        multiSelect.value.push(index);
    } else {
        multiSelect.value = multiSelect.value.filter((f) => f !== index);
    }

    let is_delete = false;
    let selectRoom = typeof card.value.title === "string" ? card.value.title : card.value.title.text;
    let text = `${selectRoom} 選定的多選 `;
    if (multiSelect.value.length === 0) {
        is_delete = true;
    } else {
        multiSelect.value.forEach((item, index) => {
            text += `${card.value.items[item].text} `;
            if (index !== multiSelect.value.length - 1) {
                text += "、";
            }
        });
    }

    emit("pushText", { id: card.value.id, text: text, is_delete: is_delete });
}
</script>

<template>
    <div class="flex flex-col h-full card_range_com">
        <ul class="flex-1 content">
            <li v-for="(item, index) in card.items" :key="index" class="item">
                <span v-if="item.type && item.type == 'hr'" class="content-hr"></span>
                <div
                    v-else
                    class="content-div"
                    :class="[
                        { disabled: isItemDisabled(item) },
                        {
                            multiSelect: multiSelect.findIndex((f) => f === index) !== -1,
                        },
                    ]"
                    @click="handleClick(item, index)"
                >
                    <span class="selected selected-multi">多</span>
                    <span class="content-text">{{ item.text }}</span>
                    <v-tooltip location="right">{{ item.tip }}</v-tooltip>
                </div>
            </li>
        </ul>
        <div v-if="card.confirmAction" class="button-container">
            <p v-if="errorMsg" class="error_msg">{{ errorMsg }}</p>
            <button @click="confirmAction(card.form)">
                {{ card.confirmAction.text }}
            </button>
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
                    background-color: var(--primary-color);
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
            .multiSelect {
                // padding-left: 3rem;
                font-weight: bold;
                background-color: var(--primary-color);
                color: rgba(124, 44, 216, 1);
                .selected-multi {
                    transform: translateX(0);
                    opacity: 1;
                }
                &:hover {
                    background-color: var(--primary-color);
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
