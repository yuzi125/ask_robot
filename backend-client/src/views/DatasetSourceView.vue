<script setup>
import FileComponents from "../components/FileComponents.vue";
import UploadImage from "@/components/datasets/UploadImage.vue";

import { ref, computed, inject, onMounted, toRefs } from "vue";
import { useRouter, useRoute } from "vue-router";
import { usefileStore, useStateStore, useSettingStore } from "@/store/index";
import { storeToRefs } from "pinia";
import { getFileExtension as getFileExtensionUtil } from "@/utils/common";
import { usePermissionChecker } from "@/composables";
import UploadPreviewDialog from "@/components/datasets/UploadPreviewDialog.vue";

const settingStore = useSettingStore();
const { maxFileSize } = storeToRefs(settingStore);

async function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const props = defineProps({
    datasets_id: { type: String, default: {} },
});
const { datasets_id } = toRefs(props);

const stateStore = useStateStore();
const { datasetsFolderName } = storeToRefs(stateStore);

const fileStore = usefileStore();
const { types, icons } = storeToRefs(fileStore);
const router = useRouter();
const route = useRoute();

const axios = inject("axios");
const emitter = inject("emitter");

const process = ["新增數據源", "處理並完成"];
const processActive = ref(0);

const { canPerformAction: canUploadDocument } = usePermissionChecker("allowedToUploadDocument");

const source = computed(() => {
    const items = [
        { title: "上傳文件", icon: "fa-solid fa-file-lines" },
        { title: "上傳圖片", icon: "fa-solid fa-file-image" },
    ];

    return items;
});

const sourceActive = ref(parseInt(route.query.active));
function changeActive(index) {
    sourceActive.value = index;
    router.replace(`${route.path}?active=${index}`);
}
if (!route.query.active) changeActive(0);

const step = ref(0);
const excludedTypes = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "jfif"];
const maxSize = 1024 * 1024 * maxFileSize.value; //最大size;
const typesText = computed(() => {
    return types.value
        .filter((type) => !excludedTypes.includes(type.toLowerCase()))
        .join("、")
        .toUpperCase();
});

//型別單位提取
function convertType(filename) {
    let arr = filename.split(".");
    return arr[arr.length - 1];
}

const inputFile = ref(null);
const inputFile1 = ref(null);
const dropFiles = ref([]);
const uploadFiles = ref([]);

// 新增選擇的選項
const options = ["系統預設", "自訂切分方式", "@@", "!!", "##", "~~", "--"];
const selectedOption = ref(options[0]);
// const chunkSize = [200, 300];
// const chunkSizeSelected = ref(chunkSize[0]);
// 使用者選擇自訂輸入
const customChunkInput = ref("");

// 取得文件副檔名並轉為小寫
function getFileExtension(filename) {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
}

// 將文件名稱的副檔名轉為小寫
function getLowerCaseFileName(filename) {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) return filename; // 如果沒有副檔名，直接返回原檔名
    const name = filename.substring(0, lastDotIndex);
    const ext = filename.substring(lastDotIndex + 1).toLowerCase();
    return `${name}.${ext}`;
}

// 檢查文件類型和大小
function chkTypeAndSize(file) {
    let type = getFileExtension(file.name);
    let conformType = types.value.includes(type) && !excludedTypes.includes(type); // 排除圖片格式
    let conformSize = file.size <= maxSize;

    if (!conformType) {
        console.log(`文件 ${file.name} 格式錯誤`);
        file.errorType = true;
    }
    if (!conformSize) {
        console.log(`文件 ${file.name} 大小超過限制`);
        file.exceedSize = true;
    }

    return conformType && conformSize;
}

function toggleEdit(index) {
    if (!dropFiles.value[index].isEditing) {
        dropFiles.value[index] = {
            ...dropFiles.value[index],
            isEditing: true,
            expirationDate: dropFiles.value[index].expirationDate || "",
            expirationTime: dropFiles.value[index].expirationTime || "",
        };
    } else {
        dropFiles.value[index].isEditing = !dropFiles.value[index].isEditing;
    }
}

// 共同的文件處理邏輯
async function processFiles(files) {
    let conformFiles = [];
    let nonConformFiles = [];

    // 蒐集符合和不符合的文件
    for (let file of files) {
        if (chkTypeAndSize(file)) {
            const newFileName = getLowerCaseFileName(file.name);
            const newFile = new File([file], newFileName, { type: file.type });
            conformFiles.push(newFile);
        } else {
            nonConformFiles.push(file);
        }
    }

    if (nonConformFiles.length > 0) {
        if (files.length === 1) {
            if (files[0].errorType) {
                emitter.emit("openSnackbar", {
                    message: "文件格式不符合要求，請上傳以下格式的文件：pdf、docx、doc、txt、csv、xlsx、pptx、ppt。",
                    color: "error",
                });
            }
            if (files[0].exceedSize) {
                emitter.emit("openSnackbar", {
                    message: `文件大小超過 ${maxFileSize.value} MB 的限制，請上傳一個不超過 ${maxFileSize.value} MB 的文件。`,
                    color: "error",
                });
            }
        } else {
            emitter.emit("openSnackbar", {
                message: "部分文件不符合要求，已被跳過，符合要求的文件已新增。",
                color: "warning",
            });
        }
    }

    // 逐一新增符合的文件
    for (let file of conformFiles) {
        dropFiles.value.unshift({
            file: file, // 保存整個 File 對象
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            datasource_name: "",
            datasource_url: "",
            isEditing: false,
        });
        await delay(1);
    }

    // 顯示提示訊息
    if (conformFiles.length > 0 && nonConformFiles.length === 0) {
        emitter.emit("openSnackbar", {
            message: `成功新增 ${conformFiles.length} 個文件。`,
            color: "success",
        });
    }
}

// 拖曳文件
async function handleDrop(e) {
    const dropzone = document.querySelector(".dropzone");
    dropzone.classList.remove("dragover");
    let files = [...e.dataTransfer.files];
    await processFiles(files);
}

// 手動上傳文件
async function handleChange(e) {
    let files = [...e.target.files];
    await processFiles(files);
    inputFile.value.value = "";
}

function handleDragover(e) {
    e.preventDefault();
    const dropzone = document.querySelector(".dropzone");
    dropzone.classList.add("dragover");
}
function handleDragleave(e) {
    e.prevent.preventDefault();
    const dropzone = document.querySelector(".dropzone");
    dropzone.classList.remove("dragover");
}

function delFile(index) {
    dropFiles.value.splice(index, index + 1);
}

function updateUTCExpiration(item) {
    let dateTimeString;
    const today = new Date().toISOString().split("T")[0]; // 獲取當前日期 YYYY-MM-DD

    if (item.expirationDate && item.expirationTime) {
        // 如果有日期和時間
        dateTimeString = `${item.expirationDate}T${item.expirationTime}:00`;
    } else if (item.expirationDate) {
        // 如果只有日期，將時間設置為當天的結束（23:59:59）
        dateTimeString = `${item.expirationDate}T23:59:59`;
    } else if (item.expirationTime) {
        // 如果只有時間，使用當前日期
        dateTimeString = `${today}T${item.expirationTime}:00`;
    } else {
        // 如果既沒有日期也沒有時間
        item.utcExpiration = null;
        return;
    }

    const localDate = new Date(dateTimeString);
    item.utcExpiration = localDate.toISOString();
}
async function uploadFile() {
    if (dropFiles.value.length === 0) {
        return;
    }
    console.log("dropFiles.value: ", dropFiles.value);
    let selectedSeparator = selectedOption.value === "系統預設" ? null : selectedOption.value;

    // 處理選擇的選項
    if (selectedOption.value === "自訂切分方式" && customChunkInput.value === "") {
        emitter.emit("openSnackbar", { message: "請輸入自訂切分方式", color: "warning" });
        return;
    } else if (selectedOption.value === "自訂切分方式") {
        selectedSeparator = customChunkInput.value;
    }

    processActive.value += 1;

    // 準備 FormData
    const formData = new FormData();

    formData.append("separator", selectedSeparator);
    formData.append("datasets_id", datasets_id.value);
    formData.append("folder_name", datasetsFolderName.value);

    // 計算所有檔案的總大小
    let totalSize = 0;
    dropFiles.value.forEach((file) => {
        totalSize += file.file.size;
    });

    // 把所有檔案都加入到 FormData 中
    dropFiles.value.forEach((file) => {
        formData.append("files", file.file);
        formData.append("datasource_url", file.datasource_url);
        formData.append("datasource_name", file.datasource_name);
        formData.append("expiration_time", file.utcExpiration);
        uploadFiles.value.unshift({ name: file.name, schedule: 0, size: file.size });
    });

    try {
        const response = await axios.post("/datasets/sendFile", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) => {
                let totalLoaded = event.loaded; // 總共上傳的大小
                uploadFiles.value.forEach((file) => {
                    // 計算每個檔案的進度
                    let fileProgress = Math.min(100, (totalLoaded / totalSize) * 100);
                    file.schedule = fileProgress;
                });
            },
        });
        if (response?.status === 200) {
            step.value = 2;
            emitter.emit("openSnackbar", { message: "檔案上傳成功", color: "success" });
        } else {
            emitter.emit("openSnackbar", {
                message: "檔案上傳失敗，請檢查檔案大小及檔案類型是否符合規定。",
                color: "error",
            });
        }
    } catch (error) {
        console.log("error", error.message);
        emitter.emit("openSnackbar", { message: "檔案上傳發生錯誤" + error.message, color: "error" });
    }
}

function goDocuments() {
    router.replace(`/datasets/${datasets_id.value}/documents`);
}

const confirm_cancel_com = ref(null);
const confirm_com = ref(null);

onMounted(() => {
    if (!canUploadDocument.value) {
        router.replace(`/no-access`);
    }
});
const showPreview = ref(false);
const previewFileData = ref(null);
// 讀取文件並開啟預覽
function previewFile(file) {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
        previewFileData.value = { name: file.name, content: e.target.result };
    };
    showPreview.value = true;
}

function handleCloseUploadPreviewDialog() {
    showPreview.value = false;
    previewFileData.value = null;
}
</script>

<template>
    <div class="datasets_create">
        <div class="main" v-if="processActive !== process.length - 1">
            <p class="title">{{ process[processActive] }}</p>

            <div class="step" v-if="processActive === 0">
                <div class="btns">
                    <div
                        class="btn"
                        :class="{ btn_active: sourceActive === index }"
                        v-for="(item, index) in source"
                        :key="index"
                        @click="changeActive(index)"
                    >
                        <span><i :class="item.icon"></i></span>
                        <p>{{ item.title }}</p>
                    </div>
                </div>
                <div class="import_file" v-if="sourceActive === 0">
                    <!-- 新增選擇框 -->
                    <v-select
                        v-model="selectedOption"
                        :items="options"
                        label="本次上傳文件的chunk切分方式"
                        class="mt-2"
                    ></v-select>
                    <v-text-field
                        v-if="selectedOption === '自訂切分方式'"
                        label="輸入切分方式"
                        variant="outlined"
                        v-model="customChunkInput"
                        hint="請輸入自訂切分方式，例如 && 或 ** 等。"
                    ></v-text-field>

                    <div
                        class="dropzone"
                        @click.stop="inputFile.click"
                        @drop.prevent="handleDrop"
                        @dragover.prevent="handleDragover"
                        @dragleave.prevent="handleDragleave"
                    >
                        <input
                            type="file"
                            ref="inputFile"
                            style="display: none"
                            multiple
                            @change="handleChange"
                            data-cy="upload-file"
                        />
                        <div class="hint">
                            <p>
                                <span><i class="fa-solid fa-cloud-arrow-up"></i></span>
                                拖曳文件至此，或直接點擊此處
                            </p>
                            <p style="font-size: 0.8rem">已支援{{ typesText }}，每個文件不超過{{ maxFileSize }}MB。</p>
                        </div>
                    </div>
                    <div class="my-5">
                        <input
                            ref="inputFile1"
                            accept="*/*"
                            type="file"
                            style="display: none"
                            webkitdirectory
                            @change="handleChange"
                        />
                        <v-btn color="blue" variant="outlined" @click.stop="inputFile1.click()"
                            >點擊上傳整個文件夾(包含子文件夾內檔案)
                        </v-btn>
                    </div>
                    <div class="files">
                        <div class="item" v-for="(item, index) in dropFiles" :key="index">
                            <div class="item-main">
                                <div @click.stop="previewFile(item.file)">
                                    <FileComponents :filename="item.name" :filesize="item.size"></FileComponents>
                                </div>
                                <div class="item-actions">
                                    <v-btn
                                        variant="text"
                                        prepend-icon="fa-regular fa-pen-to-square"
                                        color="info"
                                        @click.stop="toggleEdit(index)"
                                    >
                                        進階設定
                                    </v-btn>
                                    <span
                                        class="file_del"
                                        @click.stop="previewFile(item.file)"
                                        v-if="getFileExtensionUtil(item.name)"
                                    >
                                        <i class="fa-solid fa-eye fa-xl"></i>
                                        <v-tooltip activator="parent" location="top">預覽</v-tooltip>
                                    </span>
                                    <span class="file_del" @click.stop="delFile(index)">
                                        <i class="fa-solid fa-xmark fa-xl"></i>
                                        <v-tooltip activator="parent" location="top">刪除</v-tooltip>
                                    </span>
                                </div>
                            </div>
                            <v-expand-transition>
                                <div v-if="item.isEditing" class="item-inputs">
                                    <v-row dense>
                                        <v-col cols="12" sm="6">
                                            <v-text-field
                                                v-model="item.datasource_name"
                                                label="來源顯示名稱"
                                                dense
                                                hide-details
                                            ></v-text-field>
                                        </v-col>
                                        <v-col cols="12" sm="6">
                                            <v-text-field
                                                v-model="item.datasource_url"
                                                label="來源連結(URL)"
                                                dense
                                                hide-details
                                            ></v-text-field>
                                        </v-col>
                                        <v-col cols="12" sm="6">
                                            <v-text-field
                                                v-model="item.expirationDate"
                                                label="過期日期"
                                                type="date"
                                                dense
                                                hide-details
                                                clearable
                                                @input="updateUTCExpiration(item)"
                                            ></v-text-field>
                                        </v-col>
                                        <v-col cols="12" sm="6">
                                            <v-text-field
                                                v-model="item.expirationTime"
                                                label="過期時間"
                                                type="time"
                                                dense
                                                hide-details
                                                clearable
                                                @input="updateUTCExpiration(item)"
                                            ></v-text-field>
                                        </v-col>
                                    </v-row>
                                </div>
                            </v-expand-transition>
                        </div>
                    </div>
                    <v-btn
                        data-cy="upload-file-btn"
                        color="blue"
                        @click="uploadFile"
                        :disabled="dropFiles.length === 0"
                        class="mt-2"
                        >保存並處理</v-btn
                    >
                </div>

                <div class="uploadImage" v-if="sourceActive === 1">
                    <UploadImage :datasets_id="datasets_id" />
                </div>

                <!--  -->
            </div>
        </div>

        <div class="main" v-else>
            <div class="mx-auto d-flex flex-column">
                <div class="end_title">
                    <span class="end_icon bg-grey">1</span>
                    <p>文件上傳</p>
                    <img src="../assets/loading.gif" alt="" v-if="step < 2" />
                    <span class="end_icon" v-else><i class="fa-solid fa-check"></i></span>
                </div>
                <v-divider></v-divider>
                <div class="end_title">
                    <span class="end_icon bg-grey">2</span>
                    <p v-if="step < 2">請勿離開此頁面</p>
                    <p v-else>已開始建立，可前往文件</p>
                    <img src="../assets/loading.gif" alt="" v-if="step < 2" />
                    <span class="end_icon" v-else><i class="fa-solid fa-check"></i></span>
                </div>
            </div>
            <v-divider></v-divider>
            <div class="schedule">
                <div class="files">
                    <div
                        class="item"
                        v-for="(item, index) in uploadFiles"
                        :key="index"
                        :style="{
                            'background-color': item.schedule === 100 ? '#D1FADF' : '#e5e7eb',
                        }"
                    >
                        <FileComponents :filename="item.name"></FileComponents>
                        <span class="file_schedule">{{ item.schedule.toFixed(2) }}%</span>
                    </div>
                </div>
            </div>
            <v-divider></v-divider>
            <v-btn
                color="blue"
                append-icon="mdi mdi-arrow-right-bold"
                class="mt-5"
                :disabled="step !== 2"
                @click="goDocuments"
                data-cy="go-documents-btn"
                >前往文件</v-btn
            >
        </div>

        <UploadPreviewDialog
            @closeUploadPreviewDialog="handleCloseUploadPreviewDialog"
            :file="previewFileData"
            :show="showPreview"
        />
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

    .main {
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
                margin-bottom: 1rem;

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
                max-width: 1240px;

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
                        cursor: pointer;
                        overflow: hidden;
                        box-shadow: 1px 1px 3px #d5d5d5;

                        .item-main {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        }
                        .item-actions {
                            display: flex;
                            align-items: center;
                            gap: 0.5rem;
                        }

                        .item-inputs {
                            margin-top: 0.5rem;
                        }

                        .file_edit {
                            margin: 0 0.3rem;
                            color: gray;
                        }

                        .file_del {
                            margin: 0 0.3rem;
                            color: gray;
                        }

                        &:hover {
                            background-color: #f5f8ff;
                            border: 1px solid #e1eaff;
                        }

                        &:hover .file_del {
                            color: gray;
                        }
                    }
                }
            }

            .syncWeb {
                margin-bottom: 2rem;

                .cards {
                    display: flex;
                    flex: 1 1 500px;
                    flex-wrap: wrap;

                    .item {
                        min-width: 500px;
                        width: 500px;

                        .domain {
                            overflow-x: auto;
                            overflow-y: hidden;
                        }
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
                margin: 1rem 0.5rem;
                font-size: 1rem;
            }

            .btn_next_open {
                background-color: rgba($color: #1c64f2, $alpha: 1);

                &:hover {
                    background-color: rgba($color: #1c64f2, $alpha: 0.7);
                }
            }
        }

        .end_title {
            margin: 1rem 0.5rem;
            display: flex;
            align-items: center;
            width: 100%;

            .end_icon {
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 1rem;
                min-width: 1.5rem;
                min-height: 1.5rem;
                background-color: green;
                color: white;
                border-radius: 50%;
                margin-right: 0.5rem;
            }

            p {
                font-size: 1.3rem;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 0.5rem;
            }

            img {
                width: 20px;
                height: 20px;
            }

            span {
                color: #6b7280;
                font-size: 0.9rem;
            }
        }

        .schedule {
            display: flex;
            padding: 1rem 0;

            // justify-content: center;
            p {
                margin: 1rem;
            }

            .files {
                min-width: 320px;
                width: 80%;
                max-height: 60vh;
                overflow-y: auto;

                .item {
                    border: 1px solid #e6e7e9;
                    border-radius: 0.5rem;
                    margin: 0.5rem 0;
                    padding: 0.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;

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
            margin: 1rem 0;
            font-size: 1rem;
            width: 150px;
            height: 45px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 1rem auto;

            &:hover {
                background-color: rgba($color: #1c64f2, $alpha: 0.7);
            }

            span {
                margin-left: 0.5rem;
            }
        }
    }
}

:deep(.v-text-field) {
    .v-input__slot {
        min-height: 32px;
        padding: 0 8px !important;
    }
    input {
        font-size: 0.875rem;
    }
}
</style>
