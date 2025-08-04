<script setup>
import { storeToRefs } from "pinia";
import { ref, watch } from "vue";
import defaultAxios from "axios";
import { getFileIcon, getIconBgColor } from "@/utils/files";
import { useStateStore, useUserStore } from "@/store/index";
import { useToast } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { languages } from "@/utils/files";

const stateStore = useStateStore();
const { chatPartner, historyMessageIdForFileTranslation } = storeToRefs(stateStore);

const userStore = useUserStore();
const { uid } = storeToRefs(userStore);

const props = defineProps({
    item: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits(["upload-complete", "upload-cancel"]);
const { toast } = useToast();
const fileInput = ref(null);
const selectedFiles = ref([]);
const isDragOver = ref(false);
const isUploading = ref(false);
const selectedLanguage = ref("zh-TW");

// 允許的檔案類型
const allowedFileTypes = ["application/pdf"];
const allowedExtensions = [".pdf"];

// 檢查檔案類型是否允許
const isFileTypeAllowed = (file) => {
    // 檢查 MIME 類型
    if (allowedFileTypes.includes(file.type)) {
        return true;
    }

    // 如果 MIME 類型檢查失敗，再檢查副檔名
    const extension = "." + file.name.split(".").pop().toLowerCase();
    return allowedExtensions.includes(extension);
};

// 上傳區域相關函數
const triggerFileSelect = () => {
    fileInput.value.click();
};

const handleDragOver = (event) => {
    isDragOver.value = true;
};

const handleDragLeave = (event) => {
    isDragOver.value = false;
};

const handleDrop = (event) => {
    isDragOver.value = false;
    if (event.dataTransfer.files.length > 0) {
        handleFiles(event.dataTransfer.files);
    }
};

const handleFileSelect = (event) => {
    if (event.target.files.length > 0) {
        handleFiles(event.target.files);
    }
};

const handleFiles = (files) => {
    let invalidFiles = [];

    // 在選擇檔案的時候 把這個 history_message_id 設定給 historyMessageIdForFileTranslation
    historyMessageIdForFileTranslation.value = props.item.history_message_id;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (isFileTypeAllowed(file)) {
            selectedFiles.value.push(file);
        } else {
            invalidFiles.push(file.name);
        }
    }

    // 如果有不支援的檔案類型，顯示 toast 提示
    if (invalidFiles.length > 0) {
        toast({
            title: "不支援的檔案類型",
            description: `僅支援 PDF 檔案。不支援: ${invalidFiles.join(", ")}`,
            variant: "destructive",
        });
    }
};

const removeFile = (index) => {
    selectedFiles.value.splice(index, 1);
};

const resetFileInput = () => {
    // 重置文件輸入框，確保相同文件能被再次選中
    if (fileInput.value) {
        fileInput.value.value = "";
    }
};

const cancelUpload = () => {
    selectedFiles.value = [];
    resetFileInput(); // 重置文件輸入
    emit("upload-cancel");
};

const submitFiles = async () => {
    if (selectedFiles.value.length === 0) return;

    isUploading.value = true;

    try {
        const formData = new FormData();

        formData.append("userId", uid.value);
        formData.append("conversationId", chatPartner.value.roomId);
        formData.append("lang_out", selectedLanguage.value);
        formData.append("history_message_id", props.item.history_message_id);

        selectedFiles.value.forEach((file) => {
            formData.append("files", file);
        });

        const response = await defaultAxios.post("/ava/chat/upload-translation-files", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.data) {
            // 發送上傳完成事件，傳遞響應數據
            emit("upload-complete", {
                response: response.data,
                files: selectedFiles.value.map((f) => f.name),
                targetLanguage: selectedLanguage.value,
            });
            selectedFiles.value = [];
        }
    } catch (error) {
        console.error("檔案上傳失敗:", error);
        // 可以在這裡添加錯誤處理邏輯
    } finally {
        isUploading.value = false;
    }
};

// 從UUID檔名獲取原始檔名
const getOriginalFileName = (fileName) => {
    // 如果檔名超過20個字符，截斷並添加省略號
    if (fileName?.length > 20) {
        return fileName?.substring(0, 18) + "...";
    }
    return fileName;
};

// 獲取檔案擴展名
const getFileExtension = (fileName) => {
    const extension = fileName?.split(".").pop().toUpperCase();
    return extension || "FILE";
};

// 格式化檔案大小
const formatFileSize = (bytes) => {
    if (bytes < 1024) {
        return bytes + " B";
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    } else {
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }
};

watch(selectedFiles, (newFiles) => {
    if (newFiles.length === 0) {
        resetFileInput();
    }
});
</script>

<template>
    <div class="file-translation-upload">
        <div
            class="upload-area"
            :class="{ 'drag-over': isDragOver }"
            @dragover.prevent="handleDragOver"
            @dragleave.prevent="handleDragLeave"
            @drop.prevent="handleDrop"
        >
            <input
                type="file"
                ref="fileInput"
                class="hidden-input"
                multiple
                @change="handleFileSelect"
                accept=".pdf,.docx"
            />
            <div v-if="!selectedFiles.length" class="upload-prompt">
                <div class="upload-icon">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <p class="upload-text">拖放檔案至此或</p>
                <button class="upload-button" @click="triggerFileSelect">選擇檔案</button>
                <p class="upload-hint">
                    僅支援 PDF 格式<br />
                    支援上傳多個檔案
                </p>
            </div>

            <div v-else class="file-preview-area">
                <h3 class="preview-title">已選擇的檔案</h3>
                <div class="file-list">
                    <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
                        <div class="file-icon" :style="{ backgroundColor: getIconBgColor(file.type) }">
                            <i :class="getFileIcon(file.type)" class="icon"></i>
                            <div class="file-type">{{ getFileExtension(file.name) }}</div>
                        </div>
                        <div class="file-info">
                            <div class="file-name">{{ getOriginalFileName(file.name) }}</div>
                            <div class="file-size">{{ formatFileSize(file.size) }}</div>
                        </div>
                        <button class="remove-file" @click="removeFile(index)">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- 語言選擇部分 -->
                <div class="language-selection">
                    <div class="language-label">選擇輸出語系：</div>
                    <div class="select-wrapper">
                        <Select v-model="selectedLanguage" class="language-select">
                            <SelectTrigger class="select-trigger">
                                <SelectValue placeholder="選擇語言" />
                            </SelectTrigger>
                            <SelectContent class="select-content">
                                <SelectItem v-for="lang in languages" :key="lang.code" :value="lang.code">
                                    {{ lang.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="cancel-button" @click="cancelUpload">取消</button>
                    <button class="submit-button" @click="submitFiles" :disabled="isUploading">
                        <span v-if="isUploading"> <i class="fa-solid fa-spinner fa-spin"></i> 上傳中... </span>
                        <span v-else>送出檔案</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 檔案上傳區域樣式 */
.file-translation-upload {
    margin: 15px 0;
    width: 100%;
}

.upload-area {
    border: 2px dashed #ccc;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    transition: all 0.3s ease;
    background-color: rgba(255, 255, 255, 0.05);
}

.drag-over {
    border-color: var(--theme-color);
    background-color: rgba(var(--theme-color-rgb), 0.1);
}

.hidden-input {
    display: none;
}

.upload-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
}

.upload-icon {
    font-size: 48px;
    color: #aaa;
    margin-bottom: 15px;
}

.upload-text {
    margin-bottom: 10px;
    color: #666;
}

.upload-button {
    background-color: var(--theme-color);
    color: white;
    padding: 8px 20px;
    border-radius: 5px;
    border: none;
    cursor: pointer;
    margin: 10px 0;
    transition: background-color 0.3s;
}

.upload-button:hover {
    background-color: var(--theme-color-dark, #0056b3);
}

.upload-hint {
    font-size: 0.8rem;
    color: #888;
    margin-top: 10px;
}

.file-preview-area {
    width: 100%;
}

.preview-title {
    margin-bottom: 15px;
    font-size: 1.1rem;
    text-align: left;
}

.file-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 15px;
}

.file-item {
    display: flex;
    align-items: center;
    width: 100%;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding-right: 10px;
    position: relative;
}

.file-icon {
    position: relative;
    height: 48px;
    width: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.icon {
    color: white;
    font-size: 1.2rem;
}

.file-type {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    font-size: 0.5rem;
    font-weight: bold;
    text-align: center;
    color: white;
    background-color: rgba(0, 0, 0, 0.3);
    padding: 1px 0;
}

.file-info {
    padding: 0 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex-grow: 1;
}

.file-name {
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-size {
    font-size: 0.7rem;
    color: #666;
}

.remove-file {
    background: none;
    border: none;
    color: #ff5252;
    cursor: pointer;
    padding: 5px;
    margin-left: auto;
}

/* 語言選擇部分 */
.language-selection {
    display: flex;
    align-items: center;
    margin: 20px 0;
    padding: 12px;
    border-radius: 8px;
    background-color: rgba(var(--theme-color-rgb), 0.05);
}

.language-label {
    font-size: 0.9rem;
    font-weight: 500;
    margin-right: 15px;
    white-space: nowrap;
}

.select-wrapper {
    flex-grow: 1;
    max-width: 300px;
}

.select-trigger {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border-radius: 6px;
}

.action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 15px;
}

.cancel-button {
    padding: 8px 16px;
    background-color: #f2f2f2;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.cancel-button:hover {
    background-color: #e5e5e5;
}

.submit-button {
    padding: 8px 16px;
    background-color: var(--theme-color);
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 110px;
}

.submit-button:hover:not(:disabled) {
    background-color: var(--theme-color-dark, #0056b3);
    transform: translateY(-1px);
}

.submit-button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}

/* 深色模式適配 */
@media (prefers-color-scheme: dark) {
    .file-item {
        background-color: rgba(50, 50, 50, 0.8);
        border-color: rgba(255, 255, 255, 0.1);
    }

    .file-name {
        color: #e0e0e0;
    }

    .file-size {
        color: #aaa;
    }

    .upload-text,
    .upload-hint {
        color: #aaa;
    }

    .cancel-button {
        background-color: #333;
        color: #eee;
        border-color: #555;
    }

    .cancel-button:hover {
        background-color: #444;
    }

    .language-selection {
        background-color: rgba(var(--theme-color-rgb), 0.1);
        border-color: var(--theme-color);
    }
}
</style>
