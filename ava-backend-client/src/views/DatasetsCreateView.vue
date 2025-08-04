<script setup>
import FileComponents from "../components/FileComponents.vue";
import FormComponents from "../components/FormComponents.vue";

import { ref, computed, inject, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { usefileStore } from "../store/index";
import { storeToRefs } from "pinia";
import axios1 from "axios";

const fileStore = usefileStore();
const { types, icons } = storeToRefs(fileStore);
const router = useRouter();

const axios = inject("axios");
const emitter = inject("emitter");

onMounted(() => {
    getCrawlerList();
});

const process = ["新增資料源", "處理並完成"];
const processActive = ref(0);

const source = [
    { title: "導入已有文本", icon: "fa-solid fa-file-lines" },
    { title: "同步網站", icon: "fa-solid fa-diagram-project" },
];
const sourceActive = ref(0);

const schedule = ref(0);
const datasetsName = ref("");
const datasetsId = ref("");
const converter = ref(false);

const datasetsFolderName = ref("");

const maxSize = 15728640; //最大15MB;
const typesText = computed(() => {
    return types.value.join("、").toUpperCase();
});

//型別單位提取
function convertType(filename) {
    let arr = filename.split(".");
    return arr[arr.length - 1];
}

const inputFile = ref(null);
const dropFiles = ref([]);
const uploadFiles = ref([]);

function chkTypeAndSize(files) {
    let conformType = true;
    let conformSize = true;
    for (let i = 0; i < files.length; i++) {
        let item = files[i];
        let type = convertType(item.name);
        if (!types.value.includes(type)) {
            conformType = false;
        }
        if (item.size > maxSize) {
            conformSize = false;
        }
    }
    if (!conformType) {
        console.log("type錯誤");
    }
    if (!conformSize) {
        console.log("size錯誤");
    }
    return conformType && conformSize;
}
function handleDrop(e) {
    const dropzone = document.querySelector(".dropzone");
    dropzone.classList.remove("dragover");
    let files = [...e.dataTransfer.files];
    //檢查檔案型別
    if (!chkTypeAndSize(files)) {
        return;
    }
    dropFiles.value.push(...files);
}
function handleChange(e) {
    let files = [...e.target.files];
    //檢查檔案型別
    if (!chkTypeAndSize(files)) {
        return;
    }
    dropFiles.value.push(...files);
    inputFile.value.value = "";
}

function handleDragover(e) {
    e.preventDefault();
    const dropzone = document.querySelector(".dropzone");
    dropzone.classList.add("dragover");
}
function handleDragleave(e) {
    e.preventDefault();
    const dropzone = document.querySelector(".dropzone");
    dropzone.classList.remove("dragover");
}

function delFile(index) {
    dropFiles.value.splice(index, index + 1);
}

const formRef = ref(null);
function openForm() {
    let title = "建立空知識庫";
    let placeholder = "空知識庫中還沒有文件，你可以在今後任何時候上傳文件至該知識庫。";
    let data = [{ type: "text", name: "name", required: true, placeholder: "知識庫名稱" }];
    formRef.value.open({ title, placeholder, data });
}

async function createDatasets(data) {
    formRef.value.close();
    let rs = await axios.post("/datasets/create", JSON.stringify({ name: data.name }));
    if (rs.data.code !== 0) {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "warning" });
        return;
    }
    datasetsId.value = rs.data.data.datasets_id;

    router.push(`/datasets/${datasetsId.value}/documents`);
}

async function uploadFile() {
    // if (!/^[a-zA-Z0-9\s!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]+$/gi.test(datasetsFolderName.value)) {
    //     emitter.emit("openSnackbar", { message: "資料夾名稱無法設定中文", color: "warning" });
    //     return;
    // }
    if (dropFiles.value.length === 0) {
        return;
    }
    datasetsName.value = datasetsName.value ? datasetsName.value : dropFiles.value[0].name + "...";

    let rs = await axios.post("/datasets/create", JSON.stringify({ name: datasetsName.value }));

    if (rs.data.code !== 0) {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "warning" });
        return;
    }
    processActive.value += 1;
    datasetsId.value = rs.data.data.datasets_id;
    datasetsFolderName.value = rs.data.data.folder_name;
    let tempFormData = new FormData();
    const formData = new FormData();
    formData.append("datasets_id", datasetsId.value);
    formData.append("folder_name", datasetsFolderName.value);
    for (let i = 0; i < dropFiles.value.length; i++) {
        let item = dropFiles.value[i];
        if (item.type !== "application/pdf") {
            let filename = item.name.split(".");
            filename.pop();
            filename = filename.join(".");
            tempFormData = new FormData();
            tempFormData.append("file", item);
            try {
                let rs = await axios1.post("https://drfilemgr.icsc.com.tw/api/v2/converter/to-pdf", tempFormData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    responseType: "blob",
                    onUploadProgress: (event) => {
                        schedule.value = (event.loaded / event.total) * 50;
                    },
                });
                const blob = rs.data;
                const file = new File([blob], `${filename}.pdf`, { type: "application/pdf" });
                formData.append("files", file);
                uploadFiles.value.push(file);
            } catch (error) {
                console.error(error.message);
            }
        } else {
            formData.append("files", item);
            uploadFiles.value.push(item);
        }
    }
    let rs1 = await axios.post("/datasets/sendFile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
            schedule.value = (event.loaded / event.total) * 50 + 50;
        },
    });
    converter.value = true;
    console.log(rs1.data);
}

// function goDocuments() {
//     router.push(`/datasets/${datasetsId.value}/documents`);
// }

const webs = ref([]);
function getCrawlerList() {
    axios.get("/crawler/list").then((rs) => {
        if (rs.data.code === 0) {
            webs.value = rs.data.data;
        }
    });
}
async function syncWeb(id) {
    let rs = await axios.post("/crawler/syncWeb", JSON.stringify({ id: id }), {
        headers: { "Content-Type": "application/json" },
    });
    console.log(rs.data.data);
}
</script>

<template>
    <div class="datasets_create">
        <div class="process">
            <div class="title">
                <router-link to="/datasets"><i class="fa-solid fa-arrow-left"></i></router-link>
                <p>建立知識庫</p>
            </div>
            <div
                class="item"
                :class="{ item_active: processActive === index }"
                v-for="(item, index) in process"
                :key="item"
            >
                <span v-if="index < processActive" style="background-color: #f2f4f7"
                    ><i class="fa-solid fa-check"></i
                ></span>
                <span v-else>{{ index + 1 }}</span>
                <p>{{ item }}</p>
            </div>
        </div>
        <div class="main" v-if="processActive !== process.length - 1">
            <p class="title">{{ process[processActive] }}</p>

            <div class="step" v-if="processActive === 0">
                <div class="btns">
                    <div
                        class="btn"
                        :class="{ btn_active: sourceActive === index }"
                        v-for="(item, index) in source"
                        :key="index"
                        @click="sourceActive = index"
                    >
                        <span><i :class="item.icon"></i></span>
                        <p>{{ item.title }}</p>
                    </div>
                </div>
                <v-text-field class="input_datasetName" v-model="datasetsName" label="知識庫名稱"></v-text-field>
                <div class="import_file" v-if="sourceActive === 0">
                    <!-- <v-text-field
                        class="input_datasetName"
                        v-model="datasetsFolderName"
                        label="資料夾名稱(限制:英文、不重複)"
                    ></v-text-field> -->
                    <p>上傳文本文件</p>
                    <div
                        class="dropzone"
                        @click="inputFile.click"
                        @drop.prevent="handleDrop"
                        @dragover.prevent="handleDragover"
                        @dragleave.prevent="handleDragleave"
                    >
                        <input type="file" ref="inputFile" style="display: none" multiple @change="handleChange" />
                        <div class="hint">
                            <p>
                                <span><i class="fa-solid fa-cloud-arrow-up"></i></span>
                                拖曳文件至此，或直接點擊此處
                            </p>
                            <p style="font-size: 0.8rem">已支援{{ typesText }}，每個文件不超過15MB。</p>
                        </div>
                    </div>
                    <div class="files">
                        <div class="item" v-for="(item, index) in dropFiles" :key="item">
                            <FileComponents :filename="item.name" :filesize="item.size"></FileComponents>
                            <span class="file_del" @click="delFile(index)"
                                ><i class="fa-regular fa-trash-can"></i
                            ></span>
                        </div>
                    </div>
                </div>

                <div class="syncWeb" v-if="sourceActive === 1">
                    <div class="cards">
                        <div v-for="(item, index) in webs" :key="index" class="item">
                            <div
                                class="mx-3 rounded d-flex align-center justify-space-between pa-3"
                                style="border: 1px solid #e6e7e9"
                            >
                                <p>{{ item.title }}</p>
                                <v-btn @click="syncWeb(item.id)">同步</v-btn>
                            </div>
                        </div>
                    </div>
                </div>
                <button @click="uploadFile" class="btn_next" :class="{ btn_next_open: dropFiles.length }">
                    保存並處理
                </button>
            </div>

            <div class="add_emptydata" @click="openForm">
                <span><i class="fa-solid fa-folder-plus"></i></span>
                <p>建立一個空知識庫</p>
            </div>
            <FormComponents ref="formRef" @send="createDatasets"></FormComponents>
        </div>
        <div class="main" v-else>
            <div class="end_title">
                <span class="end_icon"><i class="fa-solid fa-check"></i></span>
                <p>知識庫已建立</p>
                <span>我們自動為該知識庫起了個名稱，您也可以隨時修改</span>
            </div>
            <div class="datas_name_item">
                <p class="datas_label">知識庫名稱</p>
                <p class="datas_name">{{ datasetsName }}</p>
            </div>
            <div class="schedule">
                <p>{{ converter ? "上傳完成" : "" }}</p>

                <div class="files">
                    <div
                        class="item"
                        v-for="(item, index) in uploadFiles"
                        :key="item"
                        :style="{ 'background-color': schedule === 100 ? '#D1FADF' : '#e5e7eb' }"
                    >
                        <FileComponents :filename="item.name"></FileComponents>
                        <span class="file_schedule">{{ schedule }}%</span>
                    </div>
                </div>
            </div>
            <router-link v-if="datasetsId" :to="`/datasets/${datasetsId}/documents`" class="btn_document">
                前往文件
                <span><i class="fa-solid fa-arrow-right"></i></span>
            </router-link>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.mark3 {
    background-color: #31c48d;
    border: 1px solid #14a273;
    width: 0.5rem;
    height: 0.5rem;
}
.mark4 {
    background-color: #31c48d;
    border: 1px solid #14a273;
    width: 0.5rem;
    height: 0.5rem;
}
.datasets_create {
    display: flex;
    height: 100%;
    background-color: white;

    .process {
        display: flex;
        flex-direction: column;
        padding: 2rem;
        padding-right: 3rem;
        min-width: 220px;

        .title {
            display: flex;
            align-items: center;
            margin-bottom: 3rem;

            a {
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
            }

            p {
                margin-left: 0.8rem;
                font-weight: bold;
                font-size: 0.9rem;
            }
        }

        .item {
            display: flex;
            align-items: center;
            color: #98a2c4;
            padding: 0.5rem 0;

            span {
                border-radius: 50%;
                border: 1px solid #e6e7e9;
                display: block;
                display: flex;
                justify-content: center;
                align-items: center;
                width: 1.5rem;
                height: 1.5rem;
                font-size: 0.7rem;
                position: relative;

                &::after {
                    content: "";
                    background-color: #e6e7e9;
                    width: 3px;
                    height: 0.7rem;
                    position: absolute;
                    bottom: -0.9rem;
                }
            }

            p {
                margin-left: 0.8rem;
                font-size: 0.9rem;
            }

            &:last-child span::after {
                width: 0;
            }
        }

        .item_active {
            color: #1c64f2;

            span {
                background-color: #e8ecf7;
            }
        }
    }

    .main {
        border-left: 1px solid #e5e7eb;
        overflow-x: auto;
        padding: 1.5rem;
        width: 100%;

        .title {
            font-weight: bold;
            font-size: 1.2rem;
            margin: 1rem 0.5rem;
        }

        .step {
            .btns {
                display: flex;

                .btn {
                    border: 1px solid #e6e7e9;
                    border-radius: 0.7rem;
                    padding: 0.7rem 1rem;
                    background-color: white;
                    margin: 0.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;

                    span {
                        color: #3a41c5;
                        width: 2rem;
                        height: 2rem;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        border-radius: 0.5rem;
                        border: 1px solid #e1eaff;
                        margin-right: 0.5rem;
                    }

                    p {
                        font-size: 0.9rem;
                        text-wrap: nowrap;
                    }
                }

                .btn_active {
                    border: 1px solid #1c64f2;
                    background-color: #f5f8ff;
                }
            }

            .import_file {
                margin: 0.5rem;

                .dropzone {
                    max-width: 500px;
                    min-width: 320px;
                    border: 1px dashed #98a2c4;
                    border-radius: 1rem;
                    padding: 2rem 1rem;
                    background-color: #f5f8ff;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                    margin: 1rem 0;

                    .hint {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        pointer-events: none;

                        p {
                            font-size: 0.9rem;
                            display: flex;
                            align-items: center;
                            margin: 0.3rem 0;
                            color: #6b7280;

                            span {
                                color: gray;
                                font-size: 1.2rem;
                                padding: 0 0.5rem;
                            }
                        }
                    }
                }
                .dragover {
                    border: 2px dashed #98a2c4;
                }

                .files {
                    min-width: 320px;
                    width: 100%;

                    .item {
                        width: 100%;
                        border: 1px solid #e6e7e9;
                        border-radius: 0.5rem;
                        margin: 0.5rem 0;
                        padding: 0.5rem;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        cursor: pointer;
                        overflow: hidden;

                        .file_del {
                            margin: 0 0.3rem;
                            color: gray;
                            display: none;
                        }

                        &:hover {
                            background-color: #f5f8ff;
                            border: 1px solid #e1eaff;
                        }

                        &:hover .file_del {
                            display: block;
                        }
                    }
                }
            }
            .syncWeb {
                margin-bottom: 2rem;
                .cards {
                    display: flex;
                    flex: 1 1 320px;
                    flex-wrap: wrap;
                    .item {
                        min-width: 320px;
                    }
                }
            }
            .btn_next {
                border: none;
                background-color: rgba($color: #1c64f2, $alpha: 0.3);
                border-radius: 0.5rem;
                padding: 0.5rem 2rem;
                color: white;
                cursor: pointer;
                margin: 1rem 0;
                font-size: 1rem;
            }

            .btn_next_open {
                background-color: rgba($color: #1c64f2, $alpha: 1);

                &:hover {
                    background-color: rgba($color: #1c64f2, $alpha: 0.7);
                }
            }
            .input_datasetName {
                margin: 2rem 0.5rem;
                color: #1c64f2;
                // display: flex;
                align-items: center;
                cursor: pointer;
                // border-top: 1px solid #e5e7eb;
                // padding: 2rem 0;
                max-width: 500px;
            }
        }

        .add_emptydata {
            margin: 0.5rem;
            color: #1c64f2;
            display: flex;
            align-items: center;
            cursor: pointer;
            border-top: 1px solid #e5e7eb;
            padding: 2rem 0;

            span {
                margin-right: 0.3rem;
                font-size: 0.9rem;
            }

            p {
                font-size: 0.8rem;
            }
        }

        .end_title {
            margin: 1rem 0.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;

            .end_icon {
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 1rem;
                width: 1.5rem;
                height: 1.5rem;
                background-color: green;
                color: white;
                border-radius: 50%;
                margin-bottom: 1rem;
            }

            p {
                font-size: 1.3rem;
                margin-bottom: 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            span {
                color: #6b7280;
                font-size: 0.9rem;
            }
        }

        .datas_name_item {
            display: flex;
            flex-direction: column;
            align-items: center;
            border-bottom: 1px solid #e5e7eb;
            padding: 1rem 0;

            .datas_label {
                margin-bottom: 1rem;
            }

            .datas_name {
                font-size: 0.9rem;
                background-color: #f5f8ff;
                border: 1px solid #e1eaff;
                border-radius: 0.5rem;
                margin: 0.5rem 0;
                padding: 0.5rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
            }
        }

        .schedule {
            display: flex;
            flex-direction: column;
            align-items: center;
            border-bottom: 1px solid #e5e7eb;
            padding: 1rem 0;

            p {
                margin: 1rem;
            }

            .files {
                min-width: 320px;
                width: 80%;

                .item {
                    border: 1px solid #e6e7e9;
                    border-radius: 0.5rem;
                    margin: 0.5rem 0;
                    padding: 0.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;

                    // background-color: #D1FADF;
                    // background-color:#e5e7eb;
                    .file_schedule {
                        font-size: 0.8rem;
                    }
                }
            }
        }

        .btn_document {
            border: none;
            background-color: rgba($color: #1c64f2, $alpha: 1);
            border-radius: 0.5rem;
            color: white;
            cursor: pointer;
            margin: 1rem auto;
            font-size: 1rem;
            width: 150px;
            height: 45px;
            display: flex;
            justify-content: center;
            align-items: center;

            &:hover {
                background-color: rgba($color: #1c64f2, $alpha: 0.7);
            }

            span {
                margin-left: 0.5rem;
            }
        }
    }
}
</style>
