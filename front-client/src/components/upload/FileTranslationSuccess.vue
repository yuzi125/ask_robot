<script setup>
import { defineProps, computed } from "vue";
import { getFileIconByFileName, getIconBgColorByFileName } from "@/utils/files";

const props = defineProps({
    files: {
        type: Array,
        required: true,
    },
});

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

// 判斷是否可預覽的檔案類型
const isPreviewable = (fileName) => {
    if (!fileName) return false;
    const ext = fileName.split(".").pop().toLowerCase();
    return ["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
};

// 為檔案 URL 添加預覽參數
const getPreviewUrl = (url) => {
    if (!url) return "#";
    // 判斷URL是否已有參數
    return url.includes("?") ? `${url}&preview=true` : `${url}?preview=true`;
};
</script>

<template>
    <div class="translation-success">
        <div
            class="text bot bg-[var(--chatbox-robot-bg-color)] -mt-5 inline-block mb-2 px-4 py-2 rounded-2xl break-words"
        >
            <p class="success-title">
                <i class="fa-solid fa-check-circle success-icon"></i>
                翻譯完成，您可以下載以下檔案：
            </p>
        </div>
        <div class="files-container">
            <div v-for="(file, index) in files" :key="index" class="file-item">
                <div class="file-icon" :style="{ backgroundColor: getIconBgColorByFileName(file.file_name) }">
                    <i :class="getFileIconByFileName(file.file_name)" class="icon"></i>
                    <div class="file-type">{{ getFileExtension(file.file_name) }}</div>
                </div>
                <div class="file-info">
                    <div class="file-name">{{ getOriginalFileName(file.file_name) }}</div>
                    <div class="file-type-label">
                        {{ file.file_name.includes(".dual.") ? "雙語版本" : "單語版本" }}
                    </div>
                </div>
                <div class="action-buttons">
                    <!-- 預覽按鈕 - 只對可預覽的檔案顯示 -->
                    <a
                        v-if="isPreviewable(file.file_name)"
                        :href="getPreviewUrl(file.file_url)"
                        target="_blank"
                        class="action-button preview-button"
                        title="預覽檔案"
                    >
                        <i class="fa-solid fa-eye"></i>
                    </a>
                    <!-- 下載按鈕 - 所有檔案都顯示 -->
                    <a :href="file.file_url" target="_blank" class="action-button download-button" title="下載檔案">
                        <i class="fa-solid fa-download"></i>
                    </a>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 翻譯成功相關樣式 */
.translation-success {
    margin: 20px 0;
    width: 100%;
    max-width: 600px;
}

.success-title {
    font-weight: 500;
    color: green;
    display: flex;
    align-items: center;
    font-size: 0.95rem;
}

.success-icon {
    margin-right: 8px;
    font-size: 1.1rem;
}

.files-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-radius: 12px;
    padding: 12px;
    border: 1px solid rgba(0, 0, 0, 0.05);
}

.file-item {
    display: flex;
    align-items: center;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
    transition: all 0.2s ease;
}

.file-item:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
}

.file-icon {
    position: relative;
    height: 44px;
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 8px;
    margin-right: 14px;
}

.icon {
    color: white;
    font-size: 1.1rem;
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
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
}

.file-info {
    flex-grow: 1;
    overflow: hidden;
}

.file-name {
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-type-label {
    font-size: 0.75rem;
    color: #666;
    margin-top: 3px;
    display: flex;
    align-items: center;
}

.action-buttons {
    display: flex;
    gap: 10px;
    margin-left: 10px;
}

.action-button {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    border-radius: 8px;
    transition: all 0.2s ease;
    font-size: 0.85rem;
}

.download-button {
    background-color: #2196f3;
}

.preview-button {
    background-color: #ff9800;
}

.download-button:hover {
    background-color: #1976d2;
    transform: scale(1.05);
}

.preview-button:hover {
    background-color: #f57c00;
    transform: scale(1.05);
}

.file-item {
    background-color: rgba(50, 50, 50, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
}

.file-name {
    color: #e0e0e0;
}

.file-type-label {
    color: #aaa;
}

.download-button {
    background-color: #1976d2;
}

.preview-button {
    background-color: #f57c00;
}

.download-button:hover {
    background-color: #2196f3;
}

.preview-button:hover {
    background-color: #ff9800;
}
</style>
