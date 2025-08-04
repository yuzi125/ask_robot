<script setup>
import { ref, computed, defineProps, defineEmits, watch } from "vue";
import VueOfficeDocx from "@vue-office/docx";
import VueOfficeExcel from "@vue-office/excel";
import VueOfficePptx from "@vue-office/pptx";
import TxtPreview from "@/components/datasets/TxtPreview.vue";
import VueEasyLightbox from "vue-easy-lightbox";
import "@vue-office/docx/lib/index.css";
import "@vue-office/excel/lib/index.css";

const props = defineProps({
    file: Object, // { name: "xxx.docx", content: ArrayBuffer }
    show: Boolean,
});

const emit = defineEmits(["closeUploadPreviewDialog"]);

const dialog = ref(props.show);
const filename = ref(props.file?.name || "");
const fileContent = ref(props.file?.content || null);
const fileType = ref(getFileExtension(filename.value));

// 監聽 show 變數，開啟或關閉對話框
watch(
    () => props.show,
    (newVal) => {
        dialog.value = newVal;
        if (!newVal) closePreview();
    }
);

// 監聽 file 變數，更新預覽內容
watch(
    () => props.file,
    (newFile) => {
        filename.value = newFile?.name || "";
        fileContent.value = newFile?.content || null;
        fileType.value = getFileExtension(filename.value);
    }
);

// 取得副檔名
function getFileExtension(filename) {
    return filename.split(".").pop().toLowerCase();
}

// 判斷是否為圖片
const isImage = computed(() => {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "jfif"];
    const ext = filename.value.split(".").pop().toLowerCase();
    return imageExtensions.includes(ext);
});

// 圖片轉換為 Base64
const imagePreview = computed(() => {
    if (!isImage.value || !fileContent.value) return "";
    if (typeof fileContent.value === "string") {
        // 直接使用 URL
        return fileContent.value;
    } else if (fileContent.value instanceof ArrayBuffer) {
        // 轉換 ArrayBuffer 為 Base64
        return arrayBufferToBase64(fileContent.value);
    }
    return "";
});

// 轉換 ArrayBuffer 為 Base64
function arrayBufferToBase64(buffer) {
    let binary = "";
    let bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return `data:image/png;base64,${btoa(binary)}`; // 假設是 PNG，實際可以根據副檔名調整
}

// 動態計算預覽組件
const previewConfig = computed(() => {
    if (!filename.value) return { component: null, options: {} };

    if (filename.value.endsWith(".docx")) {
        return {
            component: VueOfficeDocx,
            options: {
                src: fileContent.value,
                className: "docx-preview",
                inWrapper: true,
                breakPages: true,
                useBase64URL: true,
                useMathMLPolyfill: true,
                showChanges: true,
            },
        };
    }
    if (filename.value.endsWith(".xlsx")) {
        return {
            component: VueOfficeExcel,
            options: {
                src: fileContent.value,
                minColLength: 20,
                minRowLength: 100,
            },
        };
    }
    if (filename.value.endsWith(".pptx")) {
        return {
            component: VueOfficePptx,
            options: {
                src: fileContent.value,
            },
        };
    }
    if (filename.value.endsWith(".txt")) {
        return {
            component: TxtPreview,
            options: {
                content: fileContent.value,
            },
        };
    }
    return { component: null, options: {} };
});

// 關閉預覽
function closePreview() {
    dialog.value = false;
    emit("closeUploadPreviewDialog", false);
}
</script>

<template>
    <!-- 圖片預覽 -->
    <vue-easy-lightbox v-if="isImage" :visible="dialog" :imgs="imagePreview" @hide="closePreview"></vue-easy-lightbox>

    <!-- 其他類型文件的預覽 -->
    <v-dialog v-model="dialog" width="90%" class="preview-dialog" @update:modelValue="closePreview" v-else>
        <v-card class="preview-card">
            <v-card-title class="preview-header">
                <div class="d-flex align-center justify-space-between w-100">
                    <div class="text-truncate">
                        <v-icon class="mr-2">mdi-file-document</v-icon>
                        {{ filename }}
                    </div>
                    <v-btn icon variant="text" @click="closePreview" class="ml-2">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </div>
            </v-card-title>
            <v-card-text class="preview-content">
                <!-- 動態渲染不同檔案類型 -->
                <component
                    :is="previewConfig.component"
                    v-bind="previewConfig.options"
                    v-if="previewConfig.component"
                />
                <p v-else class="text-center text-error">不支援的預覽格式，目前僅支援 docx、xlsx、pptx、圖片</p>
            </v-card-text>
            <v-card-actions class="d-flex justify-end">
                <v-btn variant="text" @click="closePreview">關閉</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
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
</style>
