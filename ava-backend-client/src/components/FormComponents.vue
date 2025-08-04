<script setup>
import { ref, defineProps, nextTick } from "vue";
import { watch, computed } from "vue";
const emit = defineEmits(["send", "delete", "selectionChange", "updateFormConfig"]);
const isOpenForm = ref(false); //開啟form
const formData = ref({}); //每一個name的value綁這裡面的key

const data = ref([]);
const title = ref("");
const placeholder = ref("");
const errorMessage = ref("");
const showSnackbar = ref(false);

watch(data, (newV) => {
    newV.filter((f) => f.isJson).forEach((item) => {
        try {
            formData.value[item.name] = JSON.stringify(JSON.parse(formData.value[item.name]), null, 2);
        } catch (error) {}
    });
    let index = newV.findIndex((f) => f.type === "select-multiple");
    if (index !== -1) {
        formData[newV[index]["name"]] = [];
    }
});

const inputType = ref(["text", "file", "password", "number", "date"]);

// 新增 props 接收父組件傳遞的 showDeleteButton 標誌
const props = defineProps({
    showDeleteButton: {
        type: Boolean,
        default: false,
    },
    multipleSelectWithButton: {
        type: Boolean,
        default: false,
    },
    showFooterBtnGroup: {
        type: Boolean,
        default: true,
    },
});

function close() {
    isOpenForm.value = false;
    formData.value = {};
    showSnackbar.value = false;
    form_com.value.removeEventListener("click", handleClick);
}

function pushFormData() {
    emit("send", formData.value);
}

function deleteItem() {
    emit("delete", formData.value);
}
const form_com = ref(null);

function handleClick() {
    close();
}

const open = function (item) {
    console.log("a", item);
    isOpenForm.value = true;
    data.value = item.data;
    title.value = item.title;
    placeholder.value = item.placeholder;
    nextTick(() => {
        form_com.value.addEventListener("click", handleClick);
    });
};

const setData = function (v) {
    data.value = [];
    data.value.push(...v);
};

const setFormData = function (formdata) {
    formData.value = formdata;
};

const handleSelection = (selectedValues) => {
    console.log("Selected values:", selectedValues);
    emit("selectionChange", selectedValues);
};

const updateFormConfig = () => {
    emit("updateFormConfig", formData.value);
};

function showError(message) {
    errorMessage.value = message;
    showSnackbar.value = true;
}

defineExpose({ open, close, setFormData, setData, showError });
</script>

<template>
    <transition name="form_com">
        <div class="form_components" ref="form_com" v-if="isOpenForm">
            <div class="container" @click.stop>
                <form @submit.prevent="pushFormData">
                    <p v-if="title" class="title">{{ title }}</p>
                    <p v-if="placeholder" class="placeholder">{{ placeholder }}</p>
                    <slot name="top"></slot>
                    <template v-for="item in data" :key="item">
                        <div v-if="inputType.includes(item.type)" class="item">
                            <input
                                :type="item.type"
                                v-model="formData[item.name]"
                                placeholder=""
                                :required="item.required || false"
                                :readonly="item.readonly || false"
                                :data-cy="item.dataCy || ''"
                            />
                            <label>{{ item.placeholder }}</label>
                        </div>
                        <div v-if="item.type === 'textarea'" class="textarea">
                            <textarea
                                :rows="item.rows || 10"
                                v-model="formData[item.name]"
                                :required="item.required || false"
                                placeholder=""
                                :readonly="item.readonly || false"
                            >
                            </textarea>
                            <label>{{ item.placeholder }}</label>
                        </div>

                        <div v-if="item.type === 'select'" class="item">
                            <template v-if="multipleSelectWithButton">
                                <div class="justify-end d-flex align-center">
                                    <v-btn color="warning" class="bindDatasetsBtn" @click="updateFormConfig"
                                        >更新</v-btn
                                    >
                                </div>

                                <v-divider :thickness="3" class="mb-3"></v-divider>
                                <div class="d-flex align-center">
                                    <v-select
                                        multiple
                                        v-model="formData[item.name]"
                                        :items="item.option"
                                        item-title="show"
                                        item-value="value"
                                        :label="item.placeholder"
                                        @update:model-value="handleSelection"
                                    ></v-select>
                                    <v-btn color="primary" class="ml-2 bindDatasetsBtn" type="submit"
                                        >新增此表單至知識庫</v-btn
                                    >
                                </div>
                            </template>
                            <template v-else>
                                <v-select
                                    multiple
                                    v-model="formData[item.name]"
                                    :items="item.option"
                                    item-title="show"
                                    item-value="value"
                                    :label="item.placeholder"
                                    @update:model-value="handleSelection"
                                ></v-select>
                            </template>
                        </div>
                        <div v-if="item.type === 'selectNoMultiple'" class="item">
                            <v-select
                                v-model="formData[item.name]"
                                :items="item.option"
                                item-title="show"
                                item-value="value"
                                :label="item.placeholder"
                            ></v-select>
                        </div>
                    </template>
                    <div v-if="formData.experts">
                        <p class="mb-1">已綁定專家</p>
                        <ul class="binding-expert-list">
                            <li v-for="(expert, index) in formData.experts" class="binding-expert">
                                <v-chip color="primary"
                                    ><v-avatar :image="expert.avatar" size="28"></v-avatar>
                                    <span class="ms-2">{{ expert.name }}</span></v-chip
                                >
                            </li>
                            <li>
                                <v-chip v-if="formData.experts.length === 0">無綁定專家</v-chip>
                            </li>
                        </ul>
                    </div>

                    <slot name="bottom"></slot>
                    <template v-if="showFooterBtnGroup">
                        <div class="btn">
                            <!-- 使用 v-if 來條件渲染刪除按鈕 -->
                            <div>
                                <v-btn
                                    elevation="0"
                                    class="text-none mf-4"
                                    color="red-darken-3"
                                    @click="deleteItem"
                                    v-if="showDeleteButton"
                                    >刪除</v-btn
                                >
                            </div>
                            <div>
                                <v-btn
                                    data-cy="form-confirm-btn"
                                    elevation="0"
                                    class="text-white text-none ms-4"
                                    color="blue-darken-4"
                                    type="submit"
                                    >確認</v-btn
                                >
                                <v-btn elevation="0" class="mr-4 text-none no" small @click="close">取消</v-btn>
                            </div>
                        </div>
                    </template>
                </form>
            </div>
        </div>
    </transition>

    <v-snackbar
        v-model="showSnackbar"
        :timeout="3000"
        color="red-darken-3"
        location="bottom right"
        style="z-index: 999999"
    >
        {{ errorMessage }}
    </v-snackbar>
</template>

<style lang="scss" scoped>
.bindDatasetsBtn {
    margin-bottom: 20px;
}
.form_components {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba($color: gray, $alpha: 0.5);

    .container {
        padding: 1.5rem;
        min-width: 300px;
        border-radius: 0.5rem;
        background-color: white;
        width: 80%;
        max-width: 600px;
        max-height: 90%;
        color: black;
        overflow-y: auto;
        overflow-x: hidden;

        form {
            display: flex;
            flex-direction: column;
            justify-content: center;

            .title {
                font-weight: bold;
                font-size: 1.2rem;
                margin-bottom: 1rem;
                margin-top: 1rem;
            }

            .placeholder {
                color: gray;
                font-size: 0.9rem;
                margin-bottom: 1rem;
            }

            .item {
                position: relative;
                margin: 0.7rem 0;

                input {
                    width: 100%;
                    border: 1px solid #aaaaaa;
                    border-radius: 0.3rem;
                    padding: 0.5rem;
                    background-color: white;
                }

                label {
                    position: absolute;
                    top: 50%;
                    left: 0.5rem;
                    transform: translateY(-50%);
                    pointer-events: none;
                    transition: 0.3s;
                    background-color: white;
                    margin-left: 3px;
                    padding: 0 0.2rem;
                    font-size: 0.9rem;
                    color: gray;
                }

                input:focus ~ label,
                input:not(:placeholder-shown) ~ label {
                    font-size: 0.8rem;
                    top: 0;
                    border-radius: 1rem;
                    color: black;
                }

                input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                }

                select {
                    width: 100%;
                    border: 1px solid gray;
                    outline: none;
                    border-radius: 0.3rem;
                    padding: 0.5rem;
                    background-color: white;
                }

                .select_open {
                    font-size: 0.8rem;
                    top: 0;
                    border-radius: 1rem;
                }
            }

            .textarea {
                position: relative;
                margin: 0.7rem 0;

                textarea {
                    resize: none;
                    width: 100%;
                    border: 1px solid #aaaaaa;
                    border-radius: 0.3rem;
                    padding: 1rem 0.5rem;
                    background-color: white;
                }

                label {
                    position: absolute;
                    top: 1rem;
                    left: 0.5rem;
                    transform: translateY(-50%);
                    pointer-events: none;
                    transition: 0.3s;
                    background-color: white;
                    margin-left: 3px;
                    padding: 0 0.2rem;
                    font-size: 0.9rem;
                    color: gray;
                }

                textarea:focus ~ label,
                textarea:not(:placeholder-shown) ~ label {
                    font-size: 0.8rem;
                    top: 0;
                    border-radius: 1rem;
                    color: black;
                }
            }
        }
    }

    .confirm {
        position: absolute;
        border: 1px solid gray;
        // background-color: #202123;
        border-radius: 0.3rem;
        min-width: 310px;
        max-width: 80%;
        min-height: 100px;
        max-height: 80%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        padding: 1.5rem 2rem;

        p {
            margin-bottom: 1rem;
        }
    }

    .btn {
        display: flex;
        justify-content: space-between;
        margin-top: 0.7rem;
        width: 100%;

        button {
            font-size: 1rem;
            border-radius: 0.3rem;
            border: none;
            padding: 0.3rem 1rem;
            margin-left: 0.5rem;
            cursor: pointer;

            &:hover {
                opacity: 0.8;
            }
        }

        .yes {
            background-color: #1c64f2;
            color: white;
        }

        .no {
            background-color: white;
            color: gray;
            border: 1px solid #cccccc;
        }
    }
}

.form_com-enter-from {
    opacity: 0;
}

.form_com-enter-active {
    transition: 0.3s;
}

.form_com-enter-to {
    opacity: 1;
}

.form_com-leave-from {
    opacity: 1;
}

.form_com-leave-active {
    transition: 0.3s;
}

.form_com-leave-to {
    opacity: 0;
}

.binding-expert-list {
    border: 1px solid rgb(172, 172, 172);
    border-radius: 5px;
    padding: 15px;
    min-height: 30px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    max-height: 100px;
    overflow: auto;
}

.binding-expert {
    display: flex;
    align-items: center;
    gap: 6px;
}
</style>
