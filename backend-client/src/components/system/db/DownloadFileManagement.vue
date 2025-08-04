<script setup>
import { ref, inject, onMounted, computed } from "vue";
import ConfirmComponents from "@/components/ConfirmComponents.vue";
const axios = inject("axios");
const emitter = inject("emitter");

const tempZipFiles = ref([]);
const tempZipFilesLoading = ref(false);
const tempZipFileSearch = ref("");
const deleteTempFileLoading = ref(false);
const confirmValue = ref({});
const confirm_com = ref(null);

onMounted(() => {
    getTempZipFiles();
});

async function getTempZipFiles() {
    tempZipFilesLoading.value = true;
    try {
        const response = await axios.post("/system/db/temp-files", JSON.stringify({ list_temp_files: true }));
        if (response.data.code === 0) {
            tempZipFiles.value = response.data.data;
        } else {
            emitter.emit("openSnackbar", { message: response.data.message || "無法獲取暫存檔案列表", color: "error" });
        }
    } catch (error) {
        console.error("獲取暫存檔案列表時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "獲取暫存檔案列表時發生錯誤", color: "error" });
    } finally {
        tempZipFilesLoading.value = false;
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const totalTempFileSize = computed(() => {
    if (!tempZipFiles.value.length) return "0 Bytes";

    const totalSize = tempZipFiles.value.reduce((sum, file) => sum + file.size, 0);
    return formatFileSize(totalSize);
});

async function deleteTempZipFile(fileName) {
    deleteTempFileLoading.value = true;
    try {
        const response = await axios.post("/system/db/temp-files", JSON.stringify({ delete_temp_file: fileName }));
        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: response.data.message || "已刪除檔案", color: "success" });
            await getTempZipFiles();
        } else {
            emitter.emit("openSnackbar", { message: response.data.message || "無法刪除檔案", color: "error" });
        }
    } catch (error) {
        console.error("刪除暫存檔案時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "刪除暫存檔案時發生錯誤", color: "error" });
    } finally {
        deleteTempFileLoading.value = false;
    }
}

function confirmDeleteTempZipFile(fileName) {
    confirmValue.value = {
        message: `確定要刪除檔案 ${fileName} 嗎？此操作無法撤銷！`,
        confirm: () => deleteTempZipFile(fileName),
    };
    confirm_com.value.open();
}

async function deleteAllTempZipFiles() {
    deleteTempFileLoading.value = true;
    try {
        const response = await axios.post("/system/db/temp-files", JSON.stringify({ delete_all_temp_files: true }));
        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: response.data.message || "已刪除所有檔案", color: "success" });
            await getTempZipFiles();
        } else {
            emitter.emit("openSnackbar", { message: response.data.message || "無法刪除檔案", color: "error" });
        }
    } catch (error) {
        console.error("刪除所有暫存檔案時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "刪除所有暫存檔案時發生錯誤", color: "error" });
    } finally {
        deleteTempFileLoading.value = false;
    }
}

function confirmDeleteAllTempZipFiles() {
    confirmValue.value = {
        message: "確定要刪除所有下載的 ZIP 檔案嗎？此操作無法撤銷！",
        confirm: deleteAllTempZipFiles,
    };
    confirm_com.value.open();
}

const filteredTempZipFiles = computed(() => {
    if (!tempZipFileSearch.value) return tempZipFiles.value;

    return tempZipFiles.value.filter((file) => file.name.toLowerCase().includes(tempZipFileSearch.value.toLowerCase()));
});

function downloadTempZipFile(fileName) {
    const downloadUrl = import.meta.env.VITE_BACKEND_HOST + `/system/db/download-zip?fileName=${fileName}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
</script>

<template>
    <div class="download_file_management">
        <v-sheet rounded="lg" elevation="4" class="pa-4">
            <h2 class="mb-4 text-h5 font-weight-bold">下載檔案管理</h2>

            <div class="mb-4 d-flex justify-space-between align-center">
                <v-text-field
                    v-model="tempZipFileSearch"
                    label="搜尋檔案"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    outlined
                    dense
                    hide-details
                    style="max-width: 300px"
                    @click:clear="tempZipFileSearch = ''"
                ></v-text-field>

                <div>
                    <v-btn color="primary" @click="getTempZipFiles" :loading="tempZipFilesLoading" class="mr-2">
                        <v-icon left>mdi-refresh</v-icon>
                        刷新檔案列表
                    </v-btn>

                    <v-btn
                        color="error"
                        @click="confirmDeleteAllTempZipFiles"
                        :loading="deleteTempFileLoading"
                        :disabled="!tempZipFiles.length"
                    >
                        <v-icon left>mdi-delete-sweep</v-icon>
                        刪除所有 tempResource 資料夾下的檔案
                    </v-btn>
                </div>
            </div>

            <v-data-table
                :headers="[
                    { title: '檔案名稱', key: 'name', align: 'start', sortable: true },
                    { title: '檔案大小', key: 'sizeFormatted', align: 'start', sortable: false },
                    { title: '建立時間', key: 'formattedDate', align: 'start', sortable: false },
                    { title: '操作', key: 'actions', align: 'center', sortable: false },
                ]"
                :items="filteredTempZipFiles"
                :items-per-page="10"
                :loading="tempZipFilesLoading"
                :search="tempZipFileSearch"
                class="elevation-1 custom-table"
                :footer-props="{
                    'items-per-page-options': [5, 10, 20, 50],
                    'items-per-page-text': '每頁顯示',
                    'show-first-last-page': true,
                }"
            >
                <template v-slot:item.actions="{ item }">
                    <div class="justify-center d-flex">
                        <v-icon
                            icon="mdi-download"
                            small
                            text
                            color="primary"
                            @click="downloadTempZipFile(item.name)"
                            class="mx-2"
                        >
                            <v-tooltip activator="parent" location="top">下載</v-tooltip>
                        </v-icon>

                        <v-icon
                            icon="mdi-delete"
                            small
                            text
                            color="error"
                            @click="confirmDeleteTempZipFile(item.name)"
                            :loading="deleteTempFileLoading"
                            class="mx-2"
                        >
                            <v-tooltip activator="parent" location="top">刪除</v-tooltip>
                        </v-icon>
                    </div>
                </template>

                <template v-slot:no-data>
                    <div class="py-4 text-center">
                        <p class="mb-2 text-subtitle-1">尚無下載的 ZIP 檔案</p>
                    </div>
                </template>
            </v-data-table>

            <div class="mt-4 text-caption">
                <p>※ 此處顯示所有已下載的 ZIP 備份檔案</p>
                <p>※ 檔案存放路徑: tempResource/</p>
                <p v-if="tempZipFiles.length" class="mt-2 text-body-2">
                    共有 {{ tempZipFiles.length }} 個檔案，總大小: {{ totalTempFileSize }}
                </p>
            </div>
        </v-sheet>

        <ConfirmComponents
            ref="confirm_com"
            type="info"
            :message="confirmValue.message"
            :confirmBtn="true"
            @confirm="confirmValue.confirm"
            saveBtnName="確認"
            closeBtnName="關閉"
        ></ConfirmComponents>
    </div>
</template>

<style lang="scss" scoped>
.download_file_management {
    padding: 20px;
}

:deep(.custom-table) {
    min-height: 400px;
}

:deep(.custom-table .v-selection-control) {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}

:deep(.custom-table tbody tr td) {
    vertical-align: middle;
}

:deep(.custom-table th.v-data-table__th) {
    vertical-align: middle;
    text-transform: none;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 500;
}
</style>
