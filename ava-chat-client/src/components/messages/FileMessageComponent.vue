<script setup>
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/store";
import VueEasyLightbox from "vue-easy-lightbox";

const props = defineProps({
    files: {
        type: Array,
        required: true,
    },
});

const currentFullUrl = window.location.href;
const urlObj = new URL(currentFullUrl);
const domain = urlObj.origin;

const settingsStore = useSettingsStore();
const { conversation_direction } = storeToRefs(settingsStore);

// 縮圖加載狀態
const loadingImages = ref({});
// 圖片錯誤狀態
const errorImages = ref({});

// 燈箱狀態
const lightboxVisible = ref(false);
const lightboxImgs = ref([]);
const lightboxIndex = ref(0);

const downloadFile = (file) => {
    const fileUrl = getFileUrl(file);
    if (!fileUrl) return;

    // 創建一個隱藏的 a 標籤來執行下載
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = file.name || "download"; // 使用原始文件名或預設名稱
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();

    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
    }, 100);
};

// 判斷是否為圖片檔案
const isImageFile = (fileType) => {
    return fileType && fileType.startsWith("image/");
};

// 處理不同格式的文件數據
const normalizedFiles = computed(() => {
    // 檢查是否為嵌套數組 (二維數組)
    if (props.files.length > 0 && Array.isArray(props.files[0])) {
        // 如果是二維數組，取第一個子數組
        return props.files[0];
    }
    // 如果已經是一維數組，直接返回
    return props.files;
});

// 過濾掉錯誤的圖片文件
const filteredFiles = computed(() => {
    return normalizedFiles.value.filter((file) => {
        // 如果是圖片文件且有錯誤，則過濾掉
        if (isImageFile(file?.type) && errorImages.value[file.id]) {
            return false;
        }
        return true;
    });
});

// 獲取圖片URL
const getFileUrl = (file) => {
    // 設置初始加載狀態
    if (loadingImages.value[file.id] === undefined) {
        loadingImages.value[file.id] = true;
    }

    // 如果有 path，使用 path 構建下載 URL
    if (file.path) {
        const fileDownloadQuery = file.path.split("/");
        const userId = fileDownloadQuery[2];
        const conversationId = fileDownloadQuery[3];
        const filename = fileDownloadQuery[4];
        return `${domain}/ava/backend/downloadChat/${userId}?conversationId=${conversationId}&conversationFilename=${filename}`;
    }

    // 如果有 blob URL，使用 blob URL
    if (file.blobUrl) {
        return file.blobUrl;
    }

    // 如果文件對象本身存在，創建一個 blob URL
    if (file.file && typeof file.file === "object") {
        const blobUrl = URL.createObjectURL(file.file);
        // 將 blobUrl 添加到一個獨立的對象中，避免修改props
        loadingImages.value[`blob_${file.id}`] = blobUrl;
        return blobUrl;
    }
};

// 圖片加載完成
const onImageLoad = (fileId) => {
    loadingImages.value[fileId] = false;
    // 確保錯誤狀態為 false
    errorImages.value[fileId] = false;
};

// 圖片加載失敗
const onImageError = (fileId) => {
    loadingImages.value[fileId] = false;
    // 設置錯誤狀態為 true
    errorImages.value[fileId] = true;
    console.warn(`圖片載入失敗: ${fileId}`);
};

// 處理檔案點擊
const handleFileClick = (file) => {
    // 如果是圖片檔案，顯示燈箱
    if (isImageFile(file.type)) {
        lightboxImgs.value = [getFileUrl(file)];
        lightboxIndex.value = 0;
        lightboxVisible.value = true;
    } else {
        // 非圖片檔案，執行下載
        // downloadFile(file);
    }
};

// 處理燈箱關閉
const onLightboxHide = () => {
    lightboxVisible.value = false;
};

// 從UUID檔名獲取原始檔名
const getOriginalFileName = (fileName) => {
    // 如果檔名是UUID格式，只顯示前8個字符
    if (fileName?.includes("-") && fileName.length > 20) {
        return fileName.substring(0, 8) + "...";
    }

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

// 獲取檔案下載連結
const getFileDownloadLink = (file) => {
    // 如果有檔案路徑，使用該路徑生成下載連結
    if (file.path) {
        return `/api/download-file?path=${encodeURIComponent(file.path)}`;
    }
    return "#"; // 如果沒有路徑，使用佔位符
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

// 根據檔案類型獲取圖標背景顏色
const getIconBgColor = (fileType) => {
    if (fileType === "application/pdf") {
        return "#FF5252"; // 明亮的紅色
    } else if (fileType?.includes("word") || fileType?.includes("document")) {
        return "#2196F3"; // 微軟藍
    } else if (fileType === "text/plain") {
        return "#78909C"; // 藍灰色
    } else if (fileType?.includes("spreadsheet") || fileType?.includes("excel")) {
        return "#4CAF50"; // 綠色
    } else if (fileType?.includes("presentation") || fileType?.includes("powerpoint")) {
        return "#FF9800"; // 橙色
    } else if (fileType?.includes("image")) {
        return "#9C27B0"; // 紫色
    } else if (fileType?.includes("audio")) {
        return "#E91E63"; // 粉紅色
    } else if (fileType?.includes("video")) {
        return "#673AB7"; // 深紫色
    } else if (fileType?.includes("zip") || fileType?.includes("compressed")) {
        return "#795548"; // 棕色
    } else {
        return "#607D8B"; // 藍灰色
    }
};
</script>

<template>
    <div class="file-message">
        <div class="files-container" :class="conversation_direction == 'right' ? 'justify-end' : 'justify-start'">
            <div
                v-for="file in filteredFiles"
                :key="file.id"
                class="file-item"
                :class="{ 'image-file': isImageFile(file?.type) }"
                @click="handleFileClick(file)"
            >
                <!-- 圖片類型顯示縮圖 -->
                <div v-if="isImageFile(file?.type)" class="image-preview">
                    <img
                        :src="getFileUrl(file)"
                        :alt="file?.name"
                        class="thumbnail"
                        @load="onImageLoad(file.id)"
                        @error="onImageError(file.id)"
                    />
                    <div v-if="loadingImages[file.id]" class="loading-overlay">
                        <div class="spinner"></div>
                    </div>
                </div>

                <!-- 非圖片類型顯示圖標 -->
                <div v-else class="file-icon">
                    <div class="icon-container" :style="{ backgroundColor: getIconBgColor(file?.type) }">
                        <i :class="file?.icon" class="icon"></i>
                    </div>
                    <!-- 檔案類型標籤 -->
                    <div class="file-type">{{ getFileExtension(file?.name) }}</div>
                </div>

                <!-- 檔案資訊 -->
                <div class="file-info" :class="{ 'image-file-info': isImageFile(file?.type) }">
                    <div class="file-name">{{ getOriginalFileName(file?.name) }}</div>
                    <div class="file-size">{{ formatFileSize(file?.size) }}</div>
                </div>
            </div>
        </div>

        <!-- 使用 vue-easy-lightbox 顯示圖片 -->
        <Teleport to="body">
            <vue-easy-lightbox
                :visible="lightboxVisible"
                :imgs="lightboxImgs"
                :index="lightboxIndex"
                @hide="onLightboxHide"
            />
        </Teleport>
    </div>
</template>

<style scoped>
.file-message {
    width: 100%;
    margin: 8px 0;
}

.files-container {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.file-item {
    display: flex;
    align-items: center;
    min-width: 160px;
    max-width: 220px;
    height: 48px;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    text-decoration: none;
    color: inherit;
    border: 1px solid rgba(0, 0, 0, 0.1);
}

.file-item:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* 圖片檔案樣式 */
.file-item.image-file {
    min-width: 200px;
    max-width: 280px;
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.image-preview {
    width: 100%;
    height: 120px;
    position: relative;
    overflow: hidden;
    background-color: #f5f5f5;
}

.thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
}

.file-item.image-file:hover .thumbnail {
    transform: scale(1.05);
}

.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.7);
}

.spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: #3c45ff;
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.file-icon {
    position: relative;
    height: 100%;
    width: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.icon-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
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
    font-size: 0.55rem;
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

.image-file-info {
    padding: 8px;
    width: 100%;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    background-color: white;
}

.file-name {
    font-size: 0.8rem;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-size {
    font-size: 0.65rem;
    color: #666;
    margin-top: 2px;
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

    .image-preview {
        background-color: #333;
    }

    .image-file-info {
        background-color: #2d2d2d;
        border-top-color: rgba(255, 255, 255, 0.1);
    }

    .loading-overlay {
        background-color: rgba(0, 0, 0, 0.5);
    }

    .spinner {
        border-color: rgba(255, 255, 255, 0.2);
        border-top-color: #3c45ff;
    }
}
</style>
