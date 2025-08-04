<script setup>
import { inject, onMounted, ref } from "vue";

const emitter = inject("emitter");
const isOpenForm = ref(false); //開啟form
const formData = ref({}); //每一個name的value綁這裡面的key
const confirmCancel = ref(false); //取消確認

const data = ref({});
const title = ref("");
const btnConfirm = ref("");
const btnCancel = ref("");

const time = ref(""); //組件帶過來的time
const type = ref(""); //組件帶過來的組件類別
// const comVal = ref(""); //組件使用form本身帶的值
const fields = ref({});
const dataInfo = ref({});

const responseType = ref("json");

onMounted(() => {
    emitter.on("pushForm", (msg) => {
        btnConfirm.value = msg.btnConfirm;
        btnCancel.value = msg.btnCancel;
        data.value = msg.data;
        title.value = msg.title;
        time.value = msg.time;
        type.value = msg.type;
        isOpenForm.value = true;
        data.value.forEach((item) => {
            formData.value[item.name] = item.default_value;
        });
        data.value.find((f) => {
            if (f.type === "hidden") {
                formData.value[f.name] = f.data;
            }
            if (f.type === "p") {
                formData.value[f.name] = f.data;
                console.log(formData.value);
            }
        });

        // formData.value["comVal"] = msg.comVal;
        // formData.value["fields"] = msg.fields;
        // formData.value['type'] = msg.type;
        // formData.value["next_skill"] = msg.next_skill;
        fields.value = msg.fields;
        dataInfo.value = { next_skill: msg.next_skill, type: msg.type };

        responseType.value = msg.responseType || "json";
    });
});

// const inputType = ref([
//     "text",
//     "file",
//     "password",
//     "number",
//     "checkbox",
//     "email",
//     "date",
//     "time",
//     "radio",
//     "url",
//     "time",
//     "color",
//     "range",
//     "hidden",
//     "submit",
//     "reset",
//     "button",
// ]);
const inputType = ref(["text", "file", "password", "number", "date"]);

function clearForm() {
    isOpenForm.value = false;
    confirmCancel.value = false;
    formData.value = {};
}
function cancelFormData() {
    if (!type.value) {
        dataInfo.value.state = 0;
        emitter.emit("cancelFormData", { data: dataInfo.value });
    }
    clearForm();
}
function pushFormData() {
    if (responseType.value === "json") {
        dataInfo.value.state = 1;
        emitter.emit("pushFormData", {
            data: { form: formData.value, fields: fields.value, ...dataInfo.value },
            type: type.value,
            time: time.value,
        });
    } else if (responseType.value === "string") {
        let keys = Object.keys(formData.value);
        let str = "";
        keys.forEach((key) => {
            str += `${key}: ${formData.value[key]} `;
        });
        if (fields.value.singleSelect) {
            str += `時間: ${fields.value.singleSelect}`;
        } else if (fields.value.startSelect && fields.value.endSelect) {
            str += `時間: ${fields.value.startSelect} ~ ${fields.value.endSelect}`;
        } else if (fields.value.multiSelect) {
            fields.value.multiSelect.forEach((item) => {
                str += `時間: ${item}  `;
            });
        }

        emitter.emit("pushData", { data: str, type: "text" });
    }

    clearForm();
}
</script>

<template>
    <transition name="form_com">
        <div class="form_components" v-if="isOpenForm">
            <form @submit.prevent="pushFormData">
                <p class="title">{{ title }}</p>
                <template v-for="item in data" :key="item">
                    <div v-if="inputType.includes(item.type)" class="item">
                        <input
                            :type="item.type"
                            v-model="formData[item.name]"
                            :required="item.required"
                            :min="item.type === 'number' && item.min !== undefined ? item.min : null"
                            :max="item.type === 'number' && item.max !== undefined ? item.max : null"
                            placeholder=""
                        />
                        <!-- :placeholder="item.placeholder ? item.placeholder : ''" -->
                        <label>{{ item.title }}</label>
                        <span @click="formData[item.name] = ''" class="clear"><i class="fa-solid fa-xmark"></i></span>
                    </div>
                    <div v-if="item.type === 'p'" class="item">
                        <p>{{ item.title }}</p>
                    </div>
                    <div v-if="item.type === 'select'" class="item">
                        <select v-model="formData[item.name]" :required="item.required">
                            <option v-for="(option, index) in item.option" :key="index" :value="option.value">
                                {{ option.show }}
                            </option>
                        </select>
                        <label :class="{ select_open: formData[item.name] }">{{ item.title }}</label>
                        <span @click="formData[item.name] = ''" class="clear"><i class="fa-solid fa-xmark"></i></span>
                    </div>
                </template>
                <div class="btn">
                    <button type="submit" class="yes">{{ btnConfirm?.title || "確認送出" }}</button>
                    <button type="button" class="no" @click="cancelFormData">
                        {{ btnCancel?.title || "取消操作" }}
                    </button>
                </div>
            </form>
            <!-- <div class="confirm" v-if="confirmCancel">
            <p>確認則這筆請求失效，確認取消?</p>
            <div class="btn">
                <button class="yes" @click="clearForm">確認</button>
                <button class="no" @click="confirmCancel = false">取消</button>
            </div>
        </div> -->
        </div>
    </transition>
</template>

<style lang="scss" scoped>
.form_components {
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba($color: #000000, $alpha: 0.5);

    form {
        min-width: 300px;
        max-width: 80%;
        min-height: 150px;
        max-height: 80%;
        overflow-y: auto;
        border: 1px solid gray;
        border-radius: 0.5rem;
        background-color: var(--primary-color);
        padding: 1.5rem;
        color: var(--text-color);

        .title {
            margin-bottom: 0.7rem;
            font-weight: bold;
            font-size: 1.2rem;
        }

        .item {
            position: relative;
            margin: 0.7rem 0;
            border: 1px solid var(--text-color);
            border-radius: 0.3rem;
            padding-right: 1.5rem;
            p {
                padding: 0.5rem;
            }

            input {
                width: 100%;
                border: none;
                border-radius: 0.3rem;
                padding: 0.5rem;
                background-color: var(--primary-color);
                color: var(--text-color);
            }

            label {
                position: absolute;
                top: 50%;
                left: 0.5rem;
                transform: translateY(-50%);
                color: var(--text-color);
                pointer-events: none;
                transition: 0.3s;
                background-color: var(--primary-color);
                margin-left: 0px;
                padding: 0 0.2rem;
                font-size: 0.9rem;
            }

            input:focus ~ label,
            input:not(:placeholder-shown) ~ label {
                font-size: 0.8rem;
                top: 0;
                border-radius: 1rem;
            }

            input[type="date"]::-webkit-calendar-picker-indicator {
                // filter: invert(1);
            }

            // input[type="file"] {
            //     visibility: hidden;
            //     position: relative;
            //     &::before {
            //         content: "";
            //         position: absolute;
            //         visibility: visible;
            //         left: 0;
            //         top: 0;
            //         width: 100%;
            //         height: 100%;
            //         border: 1px solid var(--text-color);
            //         border-radius: 0.3rem;
            //         padding: 0.5rem;
            //         background-color: var(--primary-color);
            //         color: var(--text-color);
            //         cursor: pointer;
            //     }
            // }
            select {
                border: none;
                width: 100%;
                border-radius: 0.3rem;
                outline: none;
                padding: 0.5rem;
                background-color: var(--primary-color);
                color: var(--text-color);
            }

            .select_open {
                font-size: 0.8rem;
                top: 0;
                border-radius: 1rem;
            }
            .clear {
                position: absolute;
                right: 0.5rem;
                top: 50%;
                transform: translateY(-50%);
                cursor: pointer;
                color: gray;
            }
        }
    }

    .confirm {
        position: absolute;
        border: 1px solid gray;
        background-color: var(--primary-color);
        border-radius: 0.3rem;
        min-width: 310px;
        max-width: 80%;
        min-height: 100px;
        max-height: 80%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: var(--text-color);
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
            width: 45%;
            border-radius: 0.3rem;
            border: none;
            padding: 0.3rem;
            cursor: pointer;

            &:hover {
                opacity: 0.8;
            }
        }

        .yes {
            background-color: #365899;
            color: white;
        }

        .no {
            background-color: gray;
            color: white;
        }
    }
}

.form_com-enter-from {
    opacity: 0;
    transform: scale(1.1);
}

.form_com-enter-active {
    transition: 0.3s;
}

.form_com-enter-to {
    opacity: 1;
    transform: scale(1);
}

.form_com-leave-from {
    opacity: 1;
    transform: scale(1);
}

.form_com-leave-active {
    transition: 0.3s;
}

.form_com-leave-to {
    opacity: 0;
    // transform: scale(1.1);
}
</style>
