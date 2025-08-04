<script setup>
import { ref, computed, defineEmits, defineProps } from "vue";
import { useToast } from "@/components/ui/toast";

const props = defineProps({
    maxFileSize: {
        type: Number,
        default: 10 * 1024 * 1024, // 10MB
    },
    allowedFileTypes: {
        type: Array,
        default: () => [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/gif",
            "image/webp",
            "text/plain",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
            "application/msword", // doc
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
            "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
        ],
    },
    maxFiles: {
        type: Number,
        default: 2,
    },
    uploading: {
        type: Boolean,
        default: false,
    },
    uploadProgress: {
        type: Number,
        default: 0,
    },
    // 新增屬性，用於接收已上傳檔案的資訊
    uploadedFiles: {
        type: Array,
        default: () => [],
    },
});

const { toast } = useToast();

// 修改事件，增加 fileUpload 用於個別檔案上傳
const emit = defineEmits(["filesChanged", "uploadFiles", "fileUpload", "removeFile", "close"]);

const fileInputRef = ref(null);
const dragActive = ref(false);
const uploadedFiles = ref([]);

const getFileIcon = (fileType) => {
    console.log("fileType", fileType);
    if (fileType === "application/pdf") {
        return {
            icon: "fa-solid fa-file-pdf",
            color: "#FF0000", // PDF 紅色
        };
    } else if (fileType === "text/plain") {
        return {
            icon: "fa-solid fa-file-lines",
            color: "#A9A9A9", // TXT 灰白色
        };
    } else if (fileType.includes("powerpoint") || fileType.includes("presentationml")) {
        return {
            icon: "fa-solid fa-file-powerpoint",
            color: "#D24726", // PowerPoint 橘色
        };
    } else if (fileType.includes("excel") || fileType.includes("spreadsheet") || fileType.includes("spreadsheetml")) {
        return {
            icon: "fa-solid fa-file-excel",
            color: "#217346", // Excel 綠色
        };
    } else if (
        fileType.includes("word") ||
        (fileType.includes("document") && !fileType.includes("presentationml") && !fileType.includes("spreadsheetml"))
    ) {
        return {
            icon: "fa-solid fa-file-word",
            color: "#295496", // Word 藍色
        };
    } else if (fileType.includes("image")) {
        return {
            icon: "fa-solid fa-file-image",
            color: "#FFB900", // 圖片 黃色
        };
    } else if (fileType.includes("audio")) {
        return {
            icon: "fa-solid fa-file-audio",
            color: "#7358C1", // 音頻 紫色
        };
    } else if (fileType.includes("video")) {
        return {
            icon: "fa-solid fa-file-video",
            color: "#0078D7", // 視頻 藍色
        };
    } else if (fileType.includes("zip") || fileType.includes("archive") || fileType.includes("compressed")) {
        return {
            icon: "fa-solid fa-file-zipper",
            color: "#E26A00", // 壓縮檔 橘色
        };
    } else if (
        fileType.includes("code") ||
        fileType.includes("javascript") ||
        fileType.includes("html") ||
        fileType.includes("css")
    ) {
        return {
            icon: "fa-solid fa-file-code",
            color: "#007ACC", // 程式碼 藍色
        };
    } else {
        return {
            icon: "fa-solid fa-file",
            color: "#808080", // 其他檔案 灰色
        };
    }
};

// 處理拖放事件
const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
        dragActive.value = true;
    } else if (e.type === "dragleave") {
        dragActive.value = false;
    }
};

// 處理檔案上傳
const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragActive.value = false;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileChange(e.dataTransfer.files);
    }
};

// 處理檔案選擇
const handleFileSelect = () => {
    fileInputRef.value.click();
};

const handleFileChange = (files) => {
    if (uploadedFiles.value.length >= props.maxFiles) {
        toast({
            title: "檔案數量超過限制",
            description: `最多只能上傳 ${props.maxFiles} 個檔案`,
            variant: "destructive",
        });
        return;
    }

    const newFiles = [];

    for (let i = 0; i < files.length; i++) {
        // 檢查是否超過最大數量
        if (uploadedFiles.value.length + newFiles.length >= props.maxFiles) break;

        const file = files[i];

        // 檢查檔案類型
        if (!props.allowedFileTypes.includes(file.type)) {
            console.log("不支援的檔案類型", file.type);
            toast({
                title: "不支援的檔案類型",
                description: `${file.name} 不是允許的檔案類型`,
                variant: "destructive",
            });
            continue;
        }

        // 檢查檔案大小
        if (file.size > props.maxFileSize) {
            toast({
                title: "檔案太大",
                description: `${file.name} 超過 ${formatFileSize(props.maxFileSize)} 的限制`,
                variant: "destructive",
            });
            continue;
        }

        // 檢查是否已經上傳相同檔案
        const isDuplicate = uploadedFiles.value.some((f) => f.name === file.name && f.size === file.size);
        if (isDuplicate) {
            toast({
                title: "重複檔案",
                description: `${file.name} 已經在列表中`,
                variant: "warning",
            });
            continue;
        }

        // 獲取檔案圖標和顏色
        const fileIconInfo = getFileIcon(file.type);

        // 預覽檔案圖標
        const fileObj = {
            id: Date.now() + Math.random().toString(36).substring(2, 9),
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            icon: fileIconInfo.icon,
            iconColor: fileIconInfo.color,
            uploading: true, // 新增上傳狀態
            progress: 0, // 新增上傳進度
        };

        newFiles.push(fileObj);
    }

    // 添加新檔案到列表
    uploadedFiles.value = [...uploadedFiles.value, ...newFiles];

    // 更新檔案列表
    emit("filesChanged", uploadedFiles.value);

    // 重置檔案輸入
    if (fileInputRef.value) {
        fileInputRef.value.value = null;
    }

    // 如果有新檔案，立即開始上傳
    if (newFiles.length > 0) {
        emit("uploadFiles", newFiles); // 只上傳新檔案，不是所有檔案
    }
};
// 移除檔案
const removeFile = (id) => {
    // 找到要移除的檔案
    const file = uploadedFiles.value.find((f) => f.id === id);

    // 從列表中移除檔案
    uploadedFiles.value = uploadedFiles.value.filter((file) => file.id !== id);

    // 通知父元件
    emit("filesChanged", uploadedFiles.value);

    // 如果需要調用刪除 API，可以發射額外事件
    if (file) {
        emit("removeFile", file);
    }
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

// 從外部清除檔案
const clearFiles = () => {
    // uploadedFiles.value = [];
    // emit("filesChanged", []);
};

// 更新單個檔案進度
const updateFileProgress = (fileId, progress) => {
    const index = uploadedFiles.value.findIndex((f) => f.id === fileId);
    if (index !== -1) {
        uploadedFiles.value[index].progress = progress;
        if (progress >= 100) {
            uploadedFiles.value[index].uploading = false;
        }
    }
};

const handleExternalFiles = (files) => {
    // 拖曳狀態以提供視覺反饋
    dragActive.value = true;

    // 實際處理檔案
    handleFileChange(files);

    // 0.5秒後重置拖曳狀態
    setTimeout(() => {
        dragActive.value = false;
    }, 500);
};
// 準備接收檔案的方法
const prepareForDrop = () => {
    // 可以做一些準備工作，例如清除之前的錯誤提示等
    dragActive.value = true;

    // 短暫延遲後重置，避免視覺效果閃爍
    setTimeout(() => {
        dragActive.value = false;
    }, 300);
};

const setFiles = (files) => {
    uploadedFiles.value = [...files];
};

// 公開方法
defineExpose({
    clearFiles,
    updateFileProgress,
    handleExternalFiles,
    prepareForDrop,
    setFiles,
});

// 當有檔案時顯示發送按鈕
const hasFiles = computed(() => uploadedFiles.value.length > 0);
</script>

<template>
    <div class="relative w-full">
        <button
            class="flex absolute -top-2 -right-2 z-10 justify-center items-center w-6 h-6 rounded-full shadow-sm transition-colors bg-muted hover:bg-muted-foreground/20"
            @click="$emit('close')"
            type="button"
        >
            <i class="text-xs fa-solid fa-xmark"></i>
        </button>
        <!-- 檔案拖放區 -->
        <div
            class="p-3 mb-2 w-full rounded-lg border-2 border-dashed transition-all duration-300 bg-background"
            :class="{ 'border-primary bg-primary/5': dragActive, 'border-muted': !dragActive }"
            @dragenter="handleDrag"
            @dragleave="handleDrag"
            @dragover="handleDrag"
            @drop="handleFileDrop"
        >
            <!-- 無檔案時的提示 -->
            <div class="flex flex-col justify-center items-center py-2" v-if="uploadedFiles.length === 0">
                <div class="text-sm text-muted-foreground">
                    拖放檔案至此或
                    <span class="cursor-pointer text-primary hover:underline" @click="handleFileSelect">
                        選擇檔案
                    </span>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">
                    支援的檔案類型: PDF, TXT, DOC, DOCX (最大 {{ formatFileSize(maxFileSize) }})
                </div>
            </div>
            <!-- 使用者已上傳的檔案顯示區 - 水平排列 -->
            <div v-else-if="uploadedFiles.length > 0">
                <!-- 水平捲動檔案列表 -->
                <div class="flex overflow-x-auto gap-3 pb-2 file-scroll-container">
                    <div
                        v-for="file in uploadedFiles"
                        :key="file.id"
                        class="relative flex-shrink-0 w-36 rounded-md transition-colors bg-muted/40 group hover:bg-muted/60"
                    >
                        <div class="flex flex-col items-center p-3">
                            <div class="mb-1 text-2xl" :style="{ color: file.iconColor }">
                                <i :class="file.icon"></i>
                            </div>
                            <div class="w-full text-center">
                                <div class="px-1 text-sm font-medium truncate">{{ file.name }}</div>
                                <div class="text-xs text-muted-foreground">{{ formatFileSize(file.size) }}</div>
                            </div>

                            <!-- 上傳進度指示器 (當檔案正在上傳時顯示) -->
                            <div
                                v-if="file.uploading"
                                class="flex absolute inset-0 justify-center items-center rounded-md bg-black/50"
                            >
                                <div class="relative w-12 h-12">
                                    <svg class="w-full h-full" viewBox="0 0 120 120">
                                        <circle cx="60" cy="60" r="54" fill="none" stroke="#e6e6e6" stroke-width="8" />
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="54"
                                            fill="none"
                                            stroke="#3c45ff"
                                            stroke-width="8"
                                            stroke-linecap="round"
                                            :stroke-dasharray="339.292"
                                            :stroke-dashoffset="339.292 * (1 - file.progress / 100)"
                                            class="transform origin-center -rotate-90"
                                        />
                                    </svg>
                                    <div
                                        class="flex absolute inset-0 justify-center items-center text-xs font-bold text-white"
                                    >
                                        {{ Math.round(file.progress) }}%
                                    </div>
                                </div>
                            </div>

                            <button
                                class="flex absolute top-1 right-1 justify-center items-center w-5 h-5 rounded-full shadow-sm opacity-80 bg-background hover:opacity-100"
                                @click.stop="removeFile(file.id)"
                                :disabled="file.uploading"
                            >
                                <i class="text-xs fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>

                    <!-- 添加更多檔案按鈕 -->
                    <div
                        class="flex flex-shrink-0 justify-center items-center w-36 rounded-md border-2 border-dashed transition-colors cursor-pointer border-muted hover:bg-muted/10"
                        @click="handleFileSelect"
                    >
                        <div class="flex flex-col items-center p-3">
                            <div class="mb-1 text-2xl text-primary">
                                <i class="fa-solid fa-plus"></i>
                            </div>
                            <div class="text-xs text-muted-foreground">新增更多</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 檔案選擇輸入框 (隱藏) -->
        <input type="file" ref="fileInputRef" class="hidden" @change="handleFileChange($event.target.files)" multiple />
    </div>
</template>

<style scoped>
.file-scroll-container {
    scrollbar-width: thin;
    scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
}

.file-scroll-container::-webkit-scrollbar {
    height: 6px;
}

.file-scroll-container::-webkit-scrollbar-track {
    background: transparent;
}

.file-scroll-container::-webkit-scrollbar-thumb {
    background-color: rgba(155, 155, 155, 0.5);
    border-radius: 20px;
    border: transparent;
}

.file-scroll-container::-webkit-scrollbar-thumb:hover {
    background-color: rgba(155, 155, 155, 0.7);
}

/* 添加進度條動畫 */
.progress-ring-circle {
    transition: stroke-dashoffset 0.3s ease;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
}
</style>
