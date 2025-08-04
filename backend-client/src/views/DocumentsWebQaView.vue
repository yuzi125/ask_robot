<script setup>
import { ref, inject, onMounted, computed } from "vue";
import { format } from "date-fns";
import FormComponents from "../components/FormComponents.vue";
import PagesComponents from "../components/PagesComponents.vue";
import SwitchComponents from "../components/SwitchComponents.vue";
import ConfirmComponents from "../components/ConfirmComponents.vue";

const emitter = inject("emitter");
const axios = inject("axios");
const props = defineProps({
    datasets_id: { type: String, default: "" },
    syncweb_id: { type: String, default: "" },
});
onMounted(() => {
    init();
});
const QAList = ref([]);
const QA = ref([]);
const crawlerInfo = ref({});
const extraQaSource = ref({});
const justExtra = ref(false);

const searchs = ["question", "answer"];
async function init() {
    await getDocumentQA();
    // initPages();
}

async function getDocumentQA() {
    let rs = await axios.get(`/crawler/${props.datasets_id}/syncWeb/${props.syncweb_id}`);
    if (rs.data.code === 0) {
        rs = rs.data.data;
        QA.value = rs.qa_list;
        const qa_extra_list = rs.qa_extra_list.map((m, i) => {
            let qa_data = JSON.parse(m.qa_data);
            let first_data = qa_data.shift();
            return {
                question: first_data.question,
                answer: first_data.answer,
                source_name: first_data.source_name,
                source_url: first_data.source_url,
                qa_extra_id: m.id,
                qa_extra_data: qa_data,
                is_extra: true,
                is_enable: m.is_enable,
                index: i + 1,
            };
        });
        QA.value.forEach((item, index) => {
            item.index = index + 1;
        });
        QA.value.unshift(...qa_extra_list);

        //強制重新渲染
        pagesKey.value++;
        rs.crawler_info.update_time = format(new Date(rs.crawler_info.update_time), "yyyy-MM-dd HH:mm:ss");
        crawlerInfo.value = rs.crawler_info;
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

const qaOptionList = ref([]);

const formFullTextRef = ref(null);
const showDeleteButton = ref(false);
function openFullTextForm(item, index) {
    if (item.is_extra) {
        justExtra.value = true;
        showDeleteButton.value = true;
    } else {
        justExtra.value = false;
        showDeleteButton.value = false;
    }
    let title = index;
    let placeholder = "";
    let data;

    data = [
        { name: "question", type: "textarea", rows: "3", placeholder: "問題", readonly: true },
        { name: "answer", type: "textarea", placeholder: "答案", readonly: true },
    ];
    formFullTextRef.value.setFormData({
        id: item.id,
        qa_extra_id: item.qa_extra_id,
        question: item.question,
        answer: item.answer,
    });

    formFullTextRef.value.open({ title, placeholder, data });

    qaOptionList.value = [];
    extraQaSource.value = {};

    if (!item.qa_extra_data) return;
    qaOptionList.value.push(...item.qa_extra_data);
    extraQaSource.value = { source_name: item.source_name, source_url: item.source_url };
}
const formAddQaRef = ref(null);
function openAddQaForm(title) {
    let placeholder = "";
    let data = [
        { name: "question", type: "textarea", rows: "3", placeholder: "問題", required: true },
        { name: "answer", type: "textarea", placeholder: "答案", required: true },
    ];
    formAddQaRef.value.open({ title, placeholder, data });

    qaOptionList.value = [];
    extraQaSource.value = {};
}

// function addQaOption() {
//     let data = [
//         { name: `q_${addQaCount}`, type: "textarea", rows: "3", placeholder: `問題${addQaCount}` },
//         { name: `a_${addQaCount}`, type: "textarea", placeholder: `答案${addQaCount}` },
//     ];
//     qaOptionList.push(...data);
//     formFullTextRef.value.setData(qaOptionList);
//     formAddQaRef.value.setData(qaOptionList)
//     addQaCount++;
// }

const qa_action_finish = ref(true);
async function newQa(formdata) {
    console.log(formdata);
    console.log(extraQaSource.value);
    console.log(qaOptionList.value);
    //先檢查source_name與source_url必須兩個都要或都不要
    if (extraQaSource.value.source_name === "") delete extraQaSource.value.source_name;
    if (extraQaSource.value.source_url === "") delete extraQaSource.value.source_url;
    if (
        (!extraQaSource.value.source_name && extraQaSource.value.source_url) ||
        (extraQaSource.value.source_name && !extraQaSource.value.source_url)
    ) {
        emitter.emit("openSnackbar", { message: "來源的名稱與網址只能都填或都不填", color: "error" });
        return;
    }
    if (extraQaSource.value.source_name && extraQaSource.value.source_url) {
        formdata.source_name = extraQaSource.value.source_name;
        formdata.source_url = extraQaSource.value.source_url;
    }
    formAddQaRef.value.close();
    qaOptionList.value = qaOptionList.value.filter((f) => f.question !== "" || f.answer !== "");

    formdata.is_show = 1;
    let qaData = [];
    qaData[0] = formdata;
    qaData.push(...qaOptionList.value);
    qa_action_finish.value = false;
    let rs = await axios.post(
        "/crawler/insertQA",
        JSON.stringify({
            // qaExtraId: formdata.qa_extra_id,
            datasetsId: props.datasets_id,
            syncwebId: props.syncweb_id,
            qaData: qaData,
        })
    );
    qa_action_finish.value = true;

    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "新增成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
    getDocumentQA();
}

const pagesKey = ref(0);
async function addQa(formdata) {
    console.log(formdata);
    console.log(qaOptionList.value);

    formFullTextRef.value.close();
    qaOptionList.value = qaOptionList.value.filter((f) => f.question !== "" || f.answer !== "");
    //沒有id則是額外新增
    if (!formdata.id) {
        let qaData = [
            {
                question: formdata.question,
                answer: formdata.answer,
                is_show: 1,
                source_name: extraQaSource.value.source_name,
                source_url: extraQaSource.value.source_url,
            },
        ];
        qaData.push(...qaOptionList.value);
        qa_action_finish.value = false;
        let rs = await axios.post(
            "/crawler/insertQA",
            JSON.stringify({
                qaExtraId: formdata.qa_extra_id,
                datasetsId: props.datasets_id,
                syncwebId: props.syncweb_id,
                qaData: qaData,
            })
        );
        qa_action_finish.value = true;

        if (rs.data.code === 0) {
            emitter.emit("openSnackbar", { message: "新增成功", color: "success" });
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
        getDocumentQA();
        return;
    }
    //不是額外新增 也沒有qa_extra_id 代表第一次綁定
    if (!formdata.qa_extra_id) {
        if (qaOptionList.value.length === 0) return;
        qa_action_finish.value = false;
        let rs = await axios.post(
            "/crawler/bindQA",
            JSON.stringify({
                qaId: formdata.id,
                datasetsId: props.datasets_id,
                syncwebId: props.syncweb_id,
                qaData: qaOptionList.value,
            })
        );
        qa_action_finish.value = true;
        if (rs.data.code === 0) {
            emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
        getDocumentQA();
    } else {
        //不是額外新增 有qa_extra_id 代表綁定過
        qa_action_finish.value = false;
        let rs = await axios.put(
            "/crawler/bindQA",
            JSON.stringify({
                qaExtraId: formdata.qa_extra_id,
                qaId: formdata.id,
                datasetsId: props.datasets_id,
                syncwebId: props.syncweb_id,
                qaData: qaOptionList.value,
            })
        );
        qa_action_finish.value = true;

        if (rs.data.code === 0) {
            emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
        getDocumentQA();
    }
}

function addQaOption() {
    qaOptionList.value.push({ question: "", answer: "", is_show: 1 });
}
function delQaOption(index) {
    qaOptionList.value.splice(index, 1);
}

const isEdit = ref(false);
function cancelEdit() {
    isEdit.value = false;
    QA.value.forEach((item) => {
        if (item.isUpdate) {
            item.is_enable = item.is_enable ? false : true;
        }
        item.isUpdate = false;
    });
    updateData.value = [];
}

function save() {
    //送出修改啟用/禁用
    console.log(updateData.value);
}

const updateData = ref([]);
async function handleSwitch(data, item) {
    let index = updateData.value.findIndex((f) => f.id === data.id);
    item.is_enable = item.is_enable ? false : true;
    if (index !== -1) {
        updateData.value.splice(index, 1);
        item.isUpdate = false;
    } else {
        updateData.value.push({ id: data.id, state: data.state });
        item.isUpdate = true;
    }
}

const confirm_delete_qa = ref(null);
function openDeleteQaConfirm(item) {
    confirm_delete_qa.value.open(item);
}
async function deleteQa(formdata) {
    qa_action_finish.value = false;
    formFullTextRef.value.close();
    let rs = await axios.put(
        "/crawler/bindQA",
        JSON.stringify({
            qaExtraId: formdata.qa_extra_id,
            qaId: formdata.id,
            datasetsId: props.datasets_id,
            syncwebId: props.syncweb_id,
            qaData: [],
        })
    );
    qa_action_finish.value = true;
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
    getDocumentQA();
}
</script>
<template>
    <div class="document_view" v-if="Object.keys(crawlerInfo).length">
        <PagesComponents :list="QA" :searchs="searchs" @list="QAList = $event" :key="pagesKey">
            <template v-slot:title>
                <div class="d-flex justify-space-between align-center">
                    <div class="title">
                        <router-link :to="`/datasets/${datasets_id}/syncweb`"
                            ><i class="fa-solid fa-arrow-left"></i
                        ></router-link>
                        <span style="color: #3a41c5; font-size: 1.5rem"
                            ><i class="fa-solid fa-earth-americas"></i
                        ></span>
                        <span class="text-h6 ml-1">{{ crawlerInfo.title }}</span>
                    </div>
                    <div class="crawler_info ml-10">
                        <p>同步網站: {{ crawlerInfo.url }}</p>
                        <p>最後同步時間: {{ crawlerInfo.update_time }}</p>
                    </div>
                </div>
            </template>
            <template v-slot:content>
                <div class="container pa-4">
                    <v-card
                        v-for="(item, index) in QAList"
                        :key="item.index"
                        class="item rounded-lg ma-2"
                        :class="{ mark2: item.isUpdate }"
                        @click="openFullTextForm(item, !item.is_extra ? `# ${item.index}` : `自訂${item.index}`)"
                    >
                        <div class="d-flex justify-space-between align-center mb-1">
                            <span class="bg-indigo-lighten-4" v-if="item.is_extra">自訂{{ item.index }}</span>
                            <span v-else># {{ item.index }}</span>
                            <SwitchComponents
                                v-if="isEdit"
                                :state="item.is_enable"
                                :id="item.id"
                                @change="handleSwitch($event, item)"
                            ></SwitchComponents>
                        </div>

                        <p class="question mb-2 border rounded pa-2">{{ item.question }}</p>
                        <!-- <v-divider class="my-2"></v-divider> -->
                        <p class="answer px-2">{{ item.answer }}</p>
                    </v-card>
                </div>
            </template>
            <template v-slot:footer>
                <div class="d-flex align-center">
                    <!-- <v-btn
                        v-if="!isEdit"
                        color="blue"
                        prepend-icon="mdi mdi-square-edit-outline"
                        @click="isEdit = true"
                        >啟用</v-btn
                    >
                    <div v-else class="d-flex align-center">
                        <v-btn color="blue" prepend-icon="mdi-content-save-outline" @click="save">儲存</v-btn>
                        <v-btn color="grey-lighten-4" class="ml-3" prepend-icon="mdi mdi-close" @click="cancelEdit"
                            >取消</v-btn
                        >
                        <div class="d-flex align-center ml-3">
                            <span class="mark mark2 mr-1"></span>
                            <span style="font-size: 0.9rem">啟用/禁用</span>
                        </div>
                    </div> -->
                    <v-btn
                        color="blue"
                        prepend-icon="mdi mdi-pencil-plus"
                        class="ml-3"
                        @click="openAddQaForm('新增QA')"
                        :loading="!qa_action_finish"
                        >新增</v-btn
                    >
                    <!-- <v-btn color="blue" prepend-icon="mdi mdi-file-document-plus" class="ml-3">新增</v-btn> -->
                </div>
            </template>
        </PagesComponents>

        <FormComponents
            ref="formFullTextRef"
            @send="addQa"
            :showDeleteButton="showDeleteButton"
            @delete="openDeleteQaConfirm"
        >
            <template v-slot:bottom>
                <div class="my-5">
                    <div v-if="justExtra">
                        <div class="form_item">
                            <textarea rows="1" placeholder="" v-model="extraQaSource.source_name"> </textarea>
                            <label>來源名稱</label>
                        </div>
                        <div class="form_item">
                            <textarea rows="1" placeholder="" v-model="extraQaSource.source_url"> </textarea>
                            <label>來源網址</label>
                        </div>
                    </div>
                    <v-btn variant="tonal" class="w-100 mb-5" prepend-icon="mdi mdi-pencil-plus" @click="addQaOption"
                        >補充QA</v-btn
                    >
                    <div v-for="(item, index) in qaOptionList" :key="index" class="mt-8">
                        <div class="d-flex align-center mb-1 justify-space-between">
                            <span class="mr-1">補充{{ index + 1 }}</span>
                            <div class="d-flex align-center">
                                <v-btn
                                    v-if="item.is_show"
                                    variant="text"
                                    @click="item.is_show = 0"
                                    style="font-size: 1.2rem"
                                    class="mr-1 bg-light-blue-lighten-5"
                                >
                                    <i class="fa-regular fa-eye"></i>
                                    <v-tooltip activator="parent" location="top">使用者能看見</v-tooltip>
                                </v-btn>
                                <v-btn
                                    v-else
                                    variant="text"
                                    @click="item.is_show = 1"
                                    style="font-size: 1.2rem"
                                    class="mr-1 bg-red-lighten-5"
                                >
                                    <i class="fa-regular fa-eye-slash"></i>
                                    <v-tooltip activator="parent" location="top">使用者無法看見</v-tooltip>
                                </v-btn>
                                <v-btn @click="delQaOption(index)" variant="tonal" style="font-size: 1.2rem">
                                    <i class="fa-regular fa-trash-can"></i>
                                </v-btn>
                            </div>
                        </div>
                        <div class="border rounded px-3">
                            <div class="form_item">
                                <textarea rows="2" placeholder="" v-model="item.question"> </textarea>
                                <label>問題</label>
                            </div>
                            <div class="form_item">
                                <textarea rows="2" placeholder="" v-model="item.answer"> </textarea>
                                <label>答案</label>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </FormComponents>
        <FormComponents ref="formAddQaRef" @send="newQa">
            <template v-slot:bottom>
                <div class="my-5">
                    <div class="form_item">
                        <textarea rows="1" placeholder="" v-model="extraQaSource.source_name"> </textarea>
                        <label>來源名稱</label>
                    </div>
                    <div class="form_item">
                        <textarea rows="1" placeholder="" v-model="extraQaSource.source_url"> </textarea>
                        <label>來源網址</label>
                    </div>
                    <v-btn variant="tonal" class="w-100" prepend-icon="mdi mdi-pencil-plus" @click="addQaOption"
                        >補充QA</v-btn
                    >
                    <div v-for="(item, index) in qaOptionList" :key="index" class="mt-8">
                        <div class="d-flex align-center mb-1 justify-space-between">
                            <span class="mr-1">補充{{ index + 1 }}</span>
                            <div class="d-flex align-center">
                                <v-btn
                                    v-if="item.is_show"
                                    variant="text"
                                    @click="item.is_show = 0"
                                    style="font-size: 1.2rem"
                                    class="mr-1 bg-light-blue-lighten-5"
                                >
                                    <i class="fa-regular fa-eye"></i>
                                    <v-tooltip activator="parent" location="top">使用者能看見</v-tooltip>
                                </v-btn>
                                <v-btn
                                    v-else
                                    variant="text"
                                    @click="item.is_show = 1"
                                    style="font-size: 1.2rem"
                                    class="mr-1 bg-red-lighten-5"
                                >
                                    <i class="fa-regular fa-eye-slash"></i>
                                    <v-tooltip activator="parent" location="top">使用者無法看見</v-tooltip>
                                </v-btn>
                                <v-btn @click="delQaOption(index)" variant="tonal" style="font-size: 1.2rem">
                                    <i class="fa-regular fa-trash-can"></i>
                                </v-btn>
                            </div>
                        </div>
                        <div class="border rounded px-3">
                            <div class="form_item">
                                <textarea rows="2" placeholder="" v-model="item.question"> </textarea>
                                <label>問題</label>
                            </div>
                            <div class="form_item">
                                <textarea rows="2" placeholder="" v-model="item.answer"> </textarea>
                                <label>答案</label>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </FormComponents>
        <ConfirmComponents
            ref="confirm_delete_qa"
            type="warning"
            message="確認要刪除嗎?"
            :confirmBtn="true"
            @confirm="deleteQa"
            saveBtnName="確認"
            closeBtnName="關閉"
        ></ConfirmComponents>
    </div>
</template>

<style lang="scss" scoped>
$color1: rgb(247, 207, 207);
$color2: rgb(243, 208, 162);
.mark {
    display: block;
    border-radius: 50%;
    width: 1rem;
    height: 1rem;
}
.mark2 {
    background-color: $color2 !important;
}
.document_view {
    .title {
        display: flex;
        align-items: center;
        white-space: nowrap;
        a {
            cursor: pointer;
            border-radius: 50%;
            box-shadow: 0px 3px 5px #e6e7e9;
            border: 1px solid #e6e7e9;
            color: #1c64f2;
            width: 2rem;
            height: 2rem;
            display: block;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            margin-right: 1rem;
            &:after {
                content: "";
                width: 1px;
                height: 1rem;
                background-color: #e6e7e9;
                position: absolute;
                right: -0.7rem;
            }
        }
    }
    .crawler_info {
        white-space: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        p {
            font-size: 0.9rem;
            color: #777777;
            margin-top: 0.5rem;
        }
    }
    .container {
        display: flex;
        flex-wrap: wrap;
        .item {
            width: 23%;
            min-width: 250px;
            // max-width: 500px;
            // height: 200px;
            // overflow-y: hidden;
            // border: 1.5rem solid #f5f8ff;
            background-color: #f5f8ff;
            padding: 1rem;
            &:hover {
                background-color: white;
                cursor: pointer;
            }
            span {
                display: inline-block;
                margin-bottom: 0.3rem;
                padding: 0.1rem 0.3rem;
                border: 1px solid gray;
                color: gray;
                border-radius: 0.3rem;
            }
            .answer {
                font-size: 0.9rem;
                line-height: 1rem;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 3;
                overflow: hidden;
            }
        }
    }
    .form_item {
        position: relative;
        margin: 0.7rem 0;
        margin: 1rem 0;

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
</style>
