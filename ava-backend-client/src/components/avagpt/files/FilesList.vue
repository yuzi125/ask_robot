<script setup>
import { ref, computed, inject, watch } from "vue";
import { format, formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useWindowSize } from "@vueuse/core";
import { getFileIcon, getFileIconColor } from "@/utils/common";
import VueEasyLightbox from "vue-easy-lightbox";
import QuestionDialog from "./QuestionDialog.vue";

// Props
const props = defineProps({
    files: {
        type: Array,
        default: () => [],
    },
    total: {
        type: Number,
        default: 0,
    },
    totalPages: {
        type: Number,
        default: 1,
    },
    isLoading: {
        type: Boolean,
        default: false,
    },
    isRefetching: {
        type: Boolean,
        default: false,
    },
    isPlaceholderData: {
        type: Boolean,
        default: false,
    },
    searchQuery: {
        type: String,
        default: "",
    },
    currentPage: {
        type: Number,
        default: 1,
    },
});

const emit = defineEmits(["refresh", "page-change", "search-change"]);

// 響應式資料
const { width: windowWidth } = useWindowSize();

// Lightbox 相關
const lightboxVisible = ref(false);
const lightboxImages = ref([]);
const lightboxIndex = ref(0);

// 問題詳情 Dialog 相關
const questionsDialog = ref(false);
const selectedFile = ref(null);

// 本地搜尋狀態
const localSearchQuery = ref(props.searchQuery);

// 監聽 props 變化
watch(
    () => props.searchQuery,
    (newVal) => {
        localSearchQuery.value = newVal;
    }
);

// 監聽本地搜尋變化
watch(localSearchQuery, (newVal) => {
    emit("search-change", newVal);
});

// 方法
const handlePageChange = (newPage) => {
    emit("page-change", newPage);
};

// 格式化函數
const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileTypeColor = (filename) => {
    return getFileIconColor(filename);
};

const getFileTypeIcon = (filename) => {
    return getFileIcon(filename);
};

const formatDateTime = (dateString) => {
    return format(new Date(dateString), "yyyy/MM/dd HH:mm", { locale: zhTW });
};

const getRelativeTime = (dateString) => {
    return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhTW,
    });
};

const isImageFile = (file) => {
    return file.type && file.type.startsWith("image/");
};

const openImageLightbox = (file, index) => {
    if (isImageFile(file)) {
        // 收集所有圖片文件
        const imageFiles = props.files.filter((f) => isImageFile(f));
        lightboxImages.value = imageFiles.map((f) => f.fileUrl);

        // 找到當前圖片在圖片列表中的索引
        const imageIndex = imageFiles.findIndex((f) => f._id === file._id);
        lightboxIndex.value = imageIndex >= 0 ? imageIndex : 0;

        lightboxVisible.value = true;
    }
};

const closeLightbox = () => {
    lightboxVisible.value = false;
};

// 開啟問題詳情 Dialog
const openQuestionsDialog = (file) => {
    selectedFile.value = file;
    questionsDialog.value = true;
};

// 關閉問題詳情 Dialog
const closeQuestionsDialog = () => {
    questionsDialog.value = false;
    selectedFile.value = null;
};

// 複製對話連結
const copyConversationLink = (conversationId) => {
    const link = `${window.location.origin}/c/${conversationId}`;
    navigator.clipboard.writeText(link);
    // 可以加入 toast 提示
};
</script>

<template>
    <div class="files-list">
        <v-card elevation="2" class="rounded-lg">
            <v-card-title class="px-4 py-3 d-flex align-center bg-surface-variant">
                <div class="d-flex align-center text-truncate">
                    <v-icon icon="fa-solid fa-folder-open" class="flex-none me-2" size="small" />
                    <span class="text-truncate">文件清單</span>
                </div>
            </v-card-title>

            <v-card-text>
                <!-- 搜尋工具列 -->
                <v-row align="center" class="my-2">
                    <v-col cols="12" md="8">
                        <v-text-field
                            v-model="localSearchQuery"
                            density="compact"
                            variant="solo-filled"
                            label="搜尋使用者名稱、信箱、文件名稱或類型"
                            prepend-inner-icon="mdi-magnify"
                            clearable
                            hide-details
                        ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="4" class="justify-end d-flex ga-2">
                        <v-btn
                            color="success"
                            variant="outlined"
                            prepend-icon="mdi-refresh"
                            @click="emit('refresh')"
                            :loading="isRefetching"
                        >
                            重新整理
                        </v-btn>
                    </v-col>
                </v-row>

                <div class="position-relative">
                    <!-- Loading overlay -->
                    <div v-if="isLoading || isPlaceholderData" class="table-overlay">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    </div>

                    <div v-if="files.length > 0" class="data-container">
                        <v-table class="files-table list-table">
                            <thead>
                                <tr>
                                    <th class="text-left">文件資訊</th>
                                    <th class="text-left">使用者</th>
                                    <th class="text-center">文件類型</th>
                                    <th class="text-center">文件大小</th>
                                    <!-- <th class="text-center">尺寸</th> -->
                                    <th class="text-center">使用次數</th>
                                    <th class="text-center">相關問題</th>
                                    <th class="text-center">上傳時間</th>
                                    <!-- <th class="text-center">操作</th> -->
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(file, index) in files" :key="file._id" class="file-row">
                                    <td class="text-left">
                                        <div class="d-flex align-center">
                                            <!-- 圖片縮圖或文件圖示 -->
                                            <div class="file-icon-container me-3">
                                                <img
                                                    v-if="isImageFile(file)"
                                                    :src="file.fileUrl"
                                                    :alt="file.filename"
                                                    class="file-thumbnail"
                                                    @click="openImageLightbox(file, index)"
                                                    @error="$event.target.style.display = 'none'"
                                                />
                                                <v-icon
                                                    v-else
                                                    :icon="getFileTypeIcon(file.filename)"
                                                    :color="getFileTypeColor(file.filename)"
                                                    size="large"
                                                />
                                            </div>
                                            <div>
                                                <div class="font-weight-medium text-truncate" style="max-width: 200px">
                                                    {{ file.filename }}
                                                </div>
                                                <div class="text-caption text-grey-darken-1">
                                                    ID: {{ file.fileId.substring(0, 8) }}...
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-left">
                                        <div class="d-flex align-center">
                                            <v-avatar size="32" color="primary" class="me-3">
                                                <span class="text-white text-caption">
                                                    {{ file.userName.charAt(0).toUpperCase() }}
                                                </span>
                                            </v-avatar>
                                            <div>
                                                <div class="font-weight-medium">{{ file.userName }}</div>
                                                <div class="text-caption text-grey-darken-1">
                                                    {{ file.userEmail }}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <v-chip :color="getFileTypeColor(file.filename)" variant="tonal" size="small">
                                            {{ file.type || "未知" }}
                                        </v-chip>
                                    </td>
                                    <td class="text-center">
                                        <span class="font-weight-medium">{{ formatFileSize(file.bytes) }}</span>
                                    </td>
                                    <!-- <td class="text-center">
                                        <div v-if="file.width && file.height">
                                            <div class="text-body-2">{{ file.width }} × {{ file.height }}</div>
                                            <div class="text-caption text-grey-darken-1">像素</div>
                                        </div>
                                        <div v-else class="text-grey-darken-1">-</div>
                                    </td> -->
                                    <td class="text-center">
                                        <v-chip
                                            :color="file.usage > 0 ? 'success' : 'grey'"
                                            variant="tonal"
                                            size="small"
                                        >
                                            {{ file.usage || 0 }}
                                        </v-chip>
                                    </td>
                                    <td class="text-center">
                                        <v-chip
                                            v-if="file.questionsCount > 0"
                                            :color="'info'"
                                            variant="tonal"
                                            size="small"
                                            class="cursor-pointer"
                                            @click="openQuestionsDialog(file)"
                                        >
                                            {{ file.questionsCount }} 個問題
                                        </v-chip>
                                        <span v-else class="text-grey-darken-1">無問題</span>
                                    </td>
                                    <td class="text-center">
                                        <div v-if="file.createdAt">
                                            <div class="text-body-2">{{ formatDateTime(file.createdAt) }}</div>
                                            <div class="text-caption text-grey-darken-1">
                                                {{ getRelativeTime(file.createdAt) }}
                                            </div>
                                        </div>
                                        <div v-else class="text-grey-darken-1">未知</div>
                                    </td>
                                    <!-- <td class="text-center">
                                        <div class="justify-center d-flex ga-1">
                                            <v-tooltip text="預覽圖片" location="top" v-if="isImageFile(file)">
                                                <template v-slot:activator="{ props }">
                                                    <v-btn
                                                        v-bind="props"
                                                        icon="mdi-eye"
                                                        size="small"
                                                        variant="text"
                                                        color="primary"
                                                        @click="openImageLightbox(file, index)"
                                                    />
                                                </template>
                                            </v-tooltip>
                                            <v-tooltip text="複製文件 ID" location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-btn
                                                        v-bind="props"
                                                        icon="mdi-content-copy"
                                                        size="small"
                                                        variant="text"
                                                        color="secondary"
                                                        @click="navigator.clipboard.writeText(file.fileId)"
                                                    />
                                                </template>
                                            </v-tooltip>
                                        </div>
                                    </td> -->
                                </tr>
                            </tbody>
                        </v-table>
                    </div>

                    <div v-else class="justify-center d-flex align-center pa-8">
                        <v-alert
                            type="info"
                            variant="tonal"
                            border="start"
                            class="ma-2"
                            text="目前沒有任何文件記錄"
                        ></v-alert>
                    </div>

                    <div class="mt-4 pagination-wrapper">
                        <v-pagination
                            v-if="totalPages > 1"
                            :model-value="currentPage"
                            :length="totalPages"
                            :total-visible="windowWidth > 1100 ? 7 : 5"
                            @update:model-value="handlePageChange"
                            density="compact"
                            rounded="circle"
                        ></v-pagination>
                    </div>
                </div>
            </v-card-text>
        </v-card>

        <!-- 圖片 Lightbox -->
        <vue-easy-lightbox
            :visible="lightboxVisible"
            :imgs="lightboxImages"
            :index="lightboxIndex"
            @hide="closeLightbox"
        />

        <!-- 問題詳情 Dialog -->
        <QuestionDialog v-model="questionsDialog" :selected-file="selectedFile" @close="closeQuestionsDialog" />
    </div>
</template>

<style scoped>
.flex-none {
    flex: none;
}

.position-relative {
    position: relative;
}

.table-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.data-container {
    overflow-x: auto;
}

.files-table {
    width: 100%;
    border-collapse: collapse;
}

.files-table th {
    font-weight: 600;
    white-space: nowrap;
}

.files-table td {
    vertical-align: middle;
    padding: 10px 16px;
}

.file-row {
    transition: background-color 0.2s;
}

.file-row:hover {
    background-color: rgba(var(--v-theme-primary), 0.05);
}

.pagination-wrapper {
    display: flex;
    justify-content: center;
    padding: 8px 0;
}

.list-table {
    table-layout: fixed;
    width: 100%;
}

.list-table td {
    padding: 12px 16px;
    vertical-align: middle;
}

.list-table .text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.list-table tr:hover {
    background-color: #f5f5f5;
}

.list-table th,
.list-table td {
    padding: 0 8px;
    vertical-align: middle;
}

.file-icon-container {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.file-thumbnail {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 0.2s;
    border: 1px solid #e0e0e0;
}

.file-thumbnail:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.cursor-pointer {
    cursor: pointer;
}

.question-text {
    background-color: #f8f9fa;
    padding: 12px;
    border-radius: 8px;
    border-left: 4px solid #2196f3;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}

@media (max-width: 600px) {
    .files-table th,
    .files-table td {
        padding: 8px;
    }

    .file-icon-container {
        width: 32px;
        height: 32px;
    }

    .file-thumbnail {
        width: 32px;
        height: 32px;
    }
}
</style>
