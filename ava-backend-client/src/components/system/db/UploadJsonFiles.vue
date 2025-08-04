<script setup>
import { ref, inject } from "vue";
const axios = inject("axios");
const emitter = inject("emitter");

const files = ref([]);
const uploading = ref(false);

const onFileChange = (fileList) => {
    console.log("File change event:", fileList);
    files.value = Array.isArray(fileList) ? fileList : fileList ? [fileList] : [];
    console.log("Updated files:", files.value);
};

// 格式化檔案大小的函數
function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const cleanFileName = (fileName) => {
    // 將文件名分割成名稱和擴展名
    const [name, extension] = fileName.split(".");
    // 移除名稱中的 " (數字)" 部分
    const cleanedName = name.replace(/\s*\(\d+\)$/, "");
    // 重新組合文件名
    return `${cleanedName}.${extension}`;
};

const uploadFiles = async () => {
    if (files.value.length === 0) return;

    uploading.value = true;
    const formData = new FormData();
    const usedNames = new Set(); // 用於檢查重複名稱

    files.value.forEach((file, index) => {
        if (file && file.name) {
            let cleanedName = cleanFileName(file.name);

            // 處理可能的命名衝突
            let uniqueName = cleanedName;
            let counter = 1;
            while (usedNames.has(uniqueName)) {
                const [name, extension] = cleanedName.split(".");
                uniqueName = `${name}_${counter}.${extension}`;
                counter++;
            }
            usedNames.add(uniqueName);

            formData.append("files", file, uniqueName);
            console.log(`正在新增文件: ${uniqueName} (原名: ${file.name})`);
        } else {
            console.warn(`文件 ${index} 無效或缺少名稱`);
        }
    });

    try {
        const response = await axios.post("/system/upload-json", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        emitter.emit("openSnackbar", { message: "上傳成功", color: "success" });
        console.log("上傳成功:", response.data);
    } catch (error) {
        console.error("上傳失敗:", error);
        emitter.emit("openSnackbar", { message: "上傳失敗", color: "error" });
    } finally {
        uploading.value = false;
    }
};
</script>

<template>
    <v-row justify="center" class="mt-6">
        <v-col cols="12" sm="8" md="6">
            <v-sheet rounded="lg" elevation="4" class="pa-4">
                <h2 class="mb-4 text-h5 font-weight-bold">上傳資料表 JSON 文件</h2>

                <v-file-input
                    v-model="files"
                    label="選擇 JSON 文件"
                    multiple
                    chips
                    accept=".json"
                    prepend-icon="mdi-file-upload"
                    @update:model-value="onFileChange"
                    show-size
                    truncate-length="15"
                ></v-file-input>

                <v-expand-transition>
                    <div v-if="files.length > 0" class="mt-4">
                        <v-divider class="mb-4"></v-divider>
                        <h3 class="mb-2 text-subtitle-1 font-weight-medium">已選擇的文件：</h3>
                        <v-list density="compact">
                            <v-list-item
                                v-for="(file, index) in files"
                                :key="index"
                                :title="file.name"
                                :subtitle="formatFileSize(file.size)"
                            >
                                <template v-slot:prepend>
                                    <v-icon icon="mdi-file-document-outline"></v-icon>
                                </template>
                            </v-list-item>
                        </v-list>
                    </div>
                </v-expand-transition>

                <v-btn
                    color="primary"
                    @click="uploadFiles"
                    :disabled="files.length === 0"
                    :loading="uploading"
                    class="mt-4"
                    block
                >
                    <v-icon left>mdi-cloud-upload</v-icon>
                    上傳文件
                </v-btn>
            </v-sheet>
        </v-col>
    </v-row>
</template>
