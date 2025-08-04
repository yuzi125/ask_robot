<script setup>
import { ref, computed, inject } from "vue";
import { usefileStore, useStateStore, useSettingStore } from "@/store/index";
import { storeToRefs } from "pinia";
import FileComponents from "@/components/FileComponents.vue";
import { useRouter } from "vue-router";
import UploadPreviewDialog from "@/components/datasets/UploadPreviewDialog.vue";

const props = defineProps({
    datasets_id: { type: String, required: true },
});

const settingStore = useSettingStore();
const { maxImageSize } = storeToRefs(settingStore);
const stateStore = useStateStore();
const { datasetsFolderName } = storeToRefs(stateStore);

const fileStore = usefileStore();
const { types } = storeToRefs(fileStore);

const axios = inject("axios");
const emitter = inject("emitter");
const maxSize = 1024 * 1024 * maxImageSize.value; // 最大size
const router = useRouter();
const typesText = computed(() => {
    return types.value
        .filter((type) => ["jpg", "jpeg", "png", "gif", "webp", "bmp", "jfif"].includes(type))
        .join("、")
        .toUpperCase();
});

const inputFile = ref(null);
const inputFile1 = ref(null);
const dropFiles = ref([]);
const uploadFiles = ref([]);

const step = ref(0);
const isUploadComplete = ref(false);

function getFileExtension(filename) {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
}

function getLowerCaseFileName(filename) {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) return filename;
    const name = filename.substring(0, lastDotIndex);
    const ext = filename.substring(lastDotIndex + 1).toLowerCase();
    return `${name}.${ext}`;
}

function chkTypeAndSize(file) {
    let type = getFileExtension(file.name);
    let conformType = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "jfif"].includes(type);
    let conformSize = file.size <= maxSize;

    if (!conformType) {
        console.log(`圖片 ${file.name} 格式錯誤`);
        file.errorType = true;
    }
    if (!conformSize) {
        console.log(`圖片 ${file.name} 大小超過限制`);
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

async function processFiles(files) {
    let conformFiles = [];
    let nonConformFiles = [];

    for (let file of files) {
        if (chkTypeAndSize(file)) {
            const newFileName = getLowerCaseFileName(file.name);
            const newFile = new File([file], newFileName, { type: file.type });
            // 為圖片文件創建縮圖
            if (file.type.startsWith("image/")) {
                const thumbnail = await createThumbnail(file);
                conformFiles.push({ file: newFile, thumbnail });
            } else {
                conformFiles.push({ file: newFile, thumbnail: null });
            }
        } else {
            nonConformFiles.push(file);
        }
    }
    if (nonConformFiles.length > 0) {
        if (files.length === 1) {
            if (files[0].errorType) {
                emitter.emit("openSnackbar", {
                    message: "圖片格式不符合要求，請上傳以下格式的圖片：jpg、jpeg、png、gif。",
                    color: "error",
                });
            }
            if (files[0].exceedSize) {
                emitter.emit("openSnackbar", {
                    message: `圖片大小超過 ${maxImageSize.value} MB 的限制，請上傳一個不超過 ${maxImageSize.value} MB 的圖片。`,
                    color: "error",
                });
            }
        } else {
            emitter.emit("openSnackbar", {
                message: "部分圖片不符合要求，已被跳過，符合要求的圖片已新增。",
                color: "warning",
            });
        }
    }

    for (let file of conformFiles) {
        dropFiles.value.unshift({
            file: file, // 保存整個 File 對象
            name: file.file.name,
            size: file.file.size,
            type: file.file.type,
            lastModified: file.file.lastModified,
            datasource_name: "",
            datasource_url: "",
            isEditing: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 1));
    }

    if (conformFiles.length > 0 && nonConformFiles.length === 0) {
        emitter.emit("openSnackbar", {
            message: `成功新增 ${conformFiles.length} 張圖片。`,
            color: "success",
        });
    }
}

async function handleDrop(e) {
    const dropzone = document.querySelector(".dropzone");
    dropzone.classList.remove("dragover");
    let files = [...e.dataTransfer.files];
    await processFiles(files);
}

async function handleChange(e) {
    let files = [...e.target.files];
    await processFiles(files);
    e.target.value = "";
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
    dropFiles.value.splice(index, 1);
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

    console.log("dropFiles", dropFiles.value);

    step.value = 1;

    const formData = new FormData();
    formData.append("datasets_id", props.datasets_id);
    formData.append("folder_name", datasetsFolderName.value);
    isUploadComplete.value = true;

    // 將所有檔案添加到 formData 中
    for (let i = 0; i < dropFiles.value.length; i++) {
        let file = dropFiles.value[i]["file"];
        let item = dropFiles.value[i];

        formData.append("files", file.file); // 將每個檔案加入 formData
        formData.append("datasource_url", item.datasource_url);
        formData.append("datasource_name", item.datasource_name);
        formData.append("expiration_time", item.utcExpiration);
        uploadFiles.value.unshift({ name: item.name, schedule: 0 });
    }

    // 發送一次請求上傳所有檔案
    try {
        const response = await axios.post("/datasets/sendFile", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) => {
                // 這裡的進度是針對所有檔案的總進度
                let totalFiles = dropFiles.value.length;
                let totalSize = dropFiles.value.reduce((acc, file) => acc + file.size, 0);
                uploadFiles.value.forEach((file, index) => {
                    // 計算每個檔案的進度
                    file.schedule = Math.min(100, (event.loaded / totalSize) * 100);
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
    router.replace(`/datasets/${props.datasets_id}/documents`);
}

const imageScale = ref(1);
const minScale = ref(0.1);

function createThumbnail(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const MAX_SIZE = 60; // 縮小縮圖尺寸
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL(file.type, 0.8)); // 提高質量到 0.8
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const showPreview = ref(false);
const previewFileData = ref(null);
// 讀取文件並開啟預覽
function previewFile(file) {
    console.log("previewFile", file);
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
    <div class="upload_image">
        <div v-if="!isUploadComplete">
            <div class="import_file">
                <div
                    class="dropzone"
                    @click="inputFile.click"
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
                        accept="image/*"
                    />
                    <div class="hint">
                        <p>
                            <span><i class="fa-solid fa-cloud-arrow-up"></i></span>
                            拖曳圖片至此，或直接點擊此處
                        </p>
                        <p style="font-size: 0.8rem">已支援{{ typesText }}，每個圖片不超過{{ maxImageSize }}MB。</p>
                    </div>
                </div>
                <div class="my-5">
                    <input
                        ref="inputFile1"
                        accept="image/*"
                        type="file"
                        style="display: none"
                        webkitdirectory
                        @change="handleChange"
                    />
                    <v-btn color="blue" variant="outlined" @click="inputFile1.click()">
                        點擊上傳整個文件夾(包含子文件夾內圖片)
                    </v-btn>
                </div>
                <div class="files">
                    <div
                        class="item"
                        v-for="(item, index) in dropFiles"
                        :key="index"
                        @click="previewFile(item.file.file)"
                    >
                        <div class="item-main">
                            <div class="file-content">
                                <img
                                    v-if="item.file.thumbnail"
                                    :src="item.file.thumbnail"
                                    alt="Thumbnail"
                                    class="thumbnail"
                                />

                                <div class="file-info">
                                    <span class="file-name">{{ item.name }}</span>
                                    <span class="file-size">{{ formatFileSize(item.size) }}</span>
                                </div>
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

                                <span class="file_del">
                                    <i class="fa-solid fa-eye fa-xl"></i>
                                    <v-tooltip activator="parent" location="top">預覽</v-tooltip>
                                </span>
                                <span class="file_del" @click.stop="delFile(index)">
                                    <i class="fa-solid fa-xmark fa-xl"></i
                                ></span>
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
                                            @click.stop
                                        ></v-text-field>
                                    </v-col>
                                    <v-col cols="12" sm="6">
                                        <v-text-field
                                            v-model="item.datasource_url"
                                            label="來源連結(URL)"
                                            dense
                                            hide-details
                                            @click.stop
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
                                            @click.stop
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
                                            @click.stop
                                        ></v-text-field>
                                    </v-col>
                                </v-row>
                            </div>
                        </v-expand-transition>
                    </div>
                </div>
                <v-btn color="blue" @click="uploadFile" :disabled="dropFiles.length === 0" class="mt-2"
                    >保存並處理</v-btn
                >
            </div>
        </div>
        <div v-else class="main">
            <div class="mx-auto d-flex flex-column">
                <div class="end_title">
                    <span class="end_icon bg-grey">1</span>
                    <p>圖片上傳</p>
                    <img src="../../assets/loading.gif" alt="" v-if="step < 2" />
                    <span class="end_icon" v-else><i class="fa-solid fa-check"></i></span>
                </div>
                <v-divider></v-divider>
                <div class="end_title">
                    <span class="end_icon bg-grey">2</span>
                    <p v-if="step < 2">請勿離開此頁面</p>
                    <p v-else>已開始建立，可前往查看</p>
                    <img src="../../assets/loading.gif" alt="" v-if="step < 2" />
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
                >前往查看</v-btn
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
.file-content {
    display: flex;
    align-items: center;
    flex-grow: 1;
}
.thumbnail {
    width: 60px;
    height: 60px;
    object-fit: cover;
    margin-right: 15px;
}
.file-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.file-name {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 4px;
}
.file-size {
    font-size: 12px;
    color: #666;
}
.file_del {
    margin-left: 10px;
    color: #ff4081;
    cursor: pointer;
}
.file_del:hover {
    color: #f50057;
}
.preview-dialog {
    display: flex;
    flex-direction: column;
}

.preview-card {
    display: flex;
    flex-direction: column;
    height: 90vh; /* 設置最大高度為視窗高度的90% */
    background-color: #f5f5f5;
}

.preview-title {
    padding: 16px;
    font-size: 1.2rem;
    font-weight: bold;
    background-color: #ffffff;
    border-bottom: 1px solid #e0e0e0;
}

.preview-content {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
    overflow: auto;
}

.image-preview-container {
    max-width: 100%;
    max-height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: auto;
}

.preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.3s ease;
}

.preview-actions {
    padding: 16px;
    background-color: #ffffff;
    border-top: 1px solid #e0e0e0;
    display: flex;
    justify-content: flex-start;
    align-items: center;
}

/* 媒體查詢，適應小螢幕 */
@media (max-width: 600px) {
    .preview-card {
        height: 100vh; /* 在小螢幕上使用全高 */
    }

    .preview-title {
        font-size: 1rem;
        padding: 12px;
    }

    .preview-content {
        padding: 8px;
    }

    .preview-actions {
        padding: 12px;
    }
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
                    max-height: 35vh;
                    overflow-y: auto;

                    .item {
                        width: 100%;
                        border: 1px solid #e6e7e9;
                        border-radius: 0.5rem;
                        margin: 0.5rem 0;
                        padding: 0.5rem;

                        cursor: pointer;
                        overflow: hidden;

                        .item-main {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        }
                        .item-actions {
                            display: flex;
                            align-items: center;
                        }

                        .item-inputs {
                            margin-top: 0.5rem;
                            display: flex;
                            gap: 0.5rem;
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
</style>
