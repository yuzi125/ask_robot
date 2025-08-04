<script setup>
import { ref, computed, watch } from "vue";
import VueOfficePdf from "@vue-office/pdf";
import VueOfficeDocx from "@vue-office/docx";
import VueOfficeExcel from "@vue-office/excel";
import VueOfficePptx from "@vue-office/pptx";
import TxtPreview from "./TxtPreview.vue"; // 引入 TxtPreview 組件
import VueEasyLightbox from "vue-easy-lightbox";

import "@vue-office/docx/lib/index.css";
import "@vue-office/excel/lib/index.css";

const props = defineProps({
    fileInfo: { type: Object, required: false },
    downloadHost: { type: String, required: false },
    showText: { type: Boolean, required: false },
});

const emit = defineEmits(["downloadFile"]);

const dialog = ref(false);
const isLoading = ref(true);
const hasError = ref(false);
const errorMessage = ref("");

const fileUrl = computed(() => {
    if (props.fileInfo.attachmentId) {
        return (
            props.downloadHost + props.fileInfo.filename + "?preview=true&attachmentId=" + props.fileInfo.attachmentId
        );
    }
    return props.downloadHost + props.fileInfo.filename + "?preview=true";
});

const isImage = computed(() => {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
    const ext = props.fileInfo.originalname.split(".").pop().toLowerCase();
    return imageExtensions.includes(ext);
});

const previewConfig = computed(() => {
    const { originalname } = props.fileInfo;

    if (isImage.value) {
        return {
            component: VueEasyLightbox,
            options: {
                visible: true,
                imgs: props.downloadHost + props.fileInfo.filename,
            },
        };
    }

    if (originalname.endsWith(".docx")) {
        return {
            component: VueOfficeDocx,
            options: {
                className: "docx-preview",
                inWrapper: true,
                breakPages: true,
                useBase64URL: true,
                useMathMLPolyfill: true,
                showChanges: true,
            },
        };
    }
    if (originalname.endsWith(".xlsx")) {
        return {
            component: VueOfficeExcel,
            options: {
                minColLength: 20,
                minRowLength: 100,
            },
        };
    }
    if (originalname.endsWith(".pptx")) {
        return {
            component: VueOfficePptx,
            options: {},
        };
    }

    if (originalname.endsWith(".txt")) {
        return {
            component: TxtPreview,
            options: {},
        };
    }
    return { component: null, options: {} };
});

watch(
    () => dialog.value,
    (newVal) => {
        if (newVal) {
            isLoading.value = true;
            hasError.value = false;
            errorMessage.value = "";
        }
    }
);

const handleRendered = () => {
    isLoading.value = false;
    console.log("Document rendered successfully");
};

const handleError = (error) => {
    isLoading.value = false;
    hasError.value = true;
    errorMessage.value = "文件載入失敗";
    console.error("Document loading error:", error);
};

const openDialog = () => {
    dialog.value = true;
};

const closeDialog = () => {
    dialog.value = false;
};

const downloadFile = () => {
    if (props.fileInfo.attachmentId) {
        return emit(
            "downloadFile",
            props.downloadHost + props.fileInfo.filename + "?attachmentId=" + props.fileInfo.attachmentId
        );
    }
    emit("downloadFile", props.downloadHost + props.fileInfo.filename);
};
</script>

<template>
    <div :class="{ 'text-center': !showText, 'text-left': showText }">
        <!-- 預覽按鈕 -->
        <button @click="openDialog">
            <i class="fa-solid fa-eye icon-hover" v-if="!showText"></i>
            <v-btn variant="text" class="link-text" @click.stop="openDialog" v-else>
                <v-icon start>fa-solid fa-eye</v-icon>
                預覽檔案
            </v-btn>
            <v-tooltip activator="parent" location="top"> 預覽 {{ props.fileInfo.originalname }} </v-tooltip>
        </button>

        <!-- 圖片預覽 -->
        <vue-easy-lightbox v-if="isImage" :visible="dialog" :imgs="fileUrl" @hide="closeDialog">
            <!-- 使用 toolbar slot 添加下載按鈕 -->
            <template v-slot:toolbar="{ toolbarMethods }">
                <!-- 保留原有按鈕 -->
                <div class="vel-toolbar">
                    <button type="button" class="vel-toolbar__btn" @click="toolbarMethods.zoomIn">
                        <i class="mdi mdi-magnify-plus"></i>
                        <v-tooltip activator="parent" location="top">放大</v-tooltip>
                    </button>
                    <button type="button" class="vel-toolbar__btn" @click="toolbarMethods.zoomOut">
                        <i class="mdi mdi-magnify-minus"></i>
                        <v-tooltip activator="parent" location="top">縮小</v-tooltip>
                    </button>
                    <button type="button" class="vel-toolbar__btn" @click="toolbarMethods.resize">
                        <i class="mdi mdi-resize"></i>
                        <v-tooltip activator="parent" location="top">重置大小</v-tooltip>
                    </button>
                    <button type="button" class="vel-toolbar__btn" @click="toolbarMethods.rotateRight">
                        <i class="mdi mdi-rotate-right"></i>
                        <v-tooltip activator="parent" location="top">向右旋轉</v-tooltip>
                    </button>
                    <button type="button" class="vel-toolbar__btn" @click="toolbarMethods.rotateLeft">
                        <i class="mdi mdi-rotate-left"></i>
                        <v-tooltip activator="parent" location="top">向左旋轉</v-tooltip>
                    </button>
                    <!-- 下載按鈕 -->
                    <button type="button" class="vel-toolbar__btn" @click="downloadFile">
                        <i class="mdi mdi-download"></i>
                        <v-tooltip activator="parent" location="top">下載</v-tooltip>
                    </button>
                </div>
            </template>
        </vue-easy-lightbox>

        <!-- 預覽對話框 -->
        <v-dialog v-model="dialog" width="90%" class="preview-dialog" v-else>
            <v-card class="preview-card">
                <!-- 標題欄 -->
                <v-card-title class="preview-header">
                    <div class="d-flex align-center justify-space-between w-100">
                        <div class="text-truncate">
                            <v-icon class="mr-2">mdi-file-document</v-icon>
                            {{ props.fileInfo.originalname }}
                        </div>
                        <v-btn icon variant="text" @click="closeDialog" class="ml-2">
                            <v-icon>mdi-close</v-icon>
                        </v-btn>
                    </div>
                </v-card-title>

                <!-- 載入狀態 -->
                <div v-if="isLoading" class="loading-overlay">
                    <v-progress-circular indeterminate color="primary" size="64" />
                </div>

                <!-- 錯誤提示 -->
                <v-alert v-if="hasError" type="error" variant="tonal" class="ma-4">
                    <template v-slot:title> 載入失敗 </template>
                    {{ errorMessage }}
                </v-alert>

                <!-- 文件預覽區域 -->
                <v-card-text class="preview-content">
                    <component
                        v-if="previewConfig.component"
                        :is="previewConfig.component"
                        :src="fileUrl"
                        :options="previewConfig.options"
                        @rendered="handleRendered"
                        @error="handleError"
                        class="preview-component"
                    />
                </v-card-text>

                <!-- 底部操作欄 -->
                <v-card-actions class="preview-actions">
                    <v-spacer />
                    <v-btn variant="text" color="success" @click="downloadFile"> 下載 </v-btn>

                    <v-btn variant="text" @click="closeDialog"> 關閉 </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
.preview-btn {
    transition: transform 0.2s;
}

.preview-btn:hover {
    transform: scale(1.1);
}

.preview-dialog {
    overflow: hidden;
}

.preview-card {
    display: flex;
    flex-direction: column;
    height: 90vh;
}

.preview-header {
    flex: 0 0 auto;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    position: sticky;
    top: 0;
    background: white;
    z-index: 2;
}

.preview-content {
    flex: 1 1 auto;
    overflow: auto;
    position: relative;
    height: calc(90vh - 130px);
}

.preview-component {
    height: 100%;
    width: 100%;
}

.preview-actions {
    flex: 0 0 auto;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    position: sticky;
    bottom: 0;
    background: white;
    z-index: 2;
    padding: 12px 24px;
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
    background: rgba(255, 255, 255, 0.8);
    z-index: 3;
}

.icon-hover:hover {
    color: #2196f3;
}

:deep(.vel-toolbar__btn) {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 8px 12px;
    font-size: 20px;
    opacity: 0.8;
    transition: opacity 0.3s;
}

:deep(.vel-toolbar__btn:hover) {
    opacity: 1;
}

:deep(.mdi-download) {
    font-size: 24px;
}

.link-text {
    padding-left: 5px;
    padding-right: 5px;
}
</style>
