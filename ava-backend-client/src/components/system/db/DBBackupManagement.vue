<script setup>
import { ref, inject, onMounted } from "vue";
import ConfirmComponents from "@/components/ConfirmComponents.vue";
const axios = inject("axios");
const emitter = inject("emitter");

const backupHistory = ref([]);
const backupHistoryLoading = ref(false);
const deleteBackupLoading = ref(false);
const confirmValue = ref({});
const confirm_com = ref(null);

onMounted(() => {
    getBackupHistory();
});

async function getBackupHistory() {
    backupHistoryLoading.value = true;
    try {
        const response = await axios.post("/system/db", JSON.stringify({ db_backup_history: true }));
        if (response.data.code === 0) {
            backupHistory.value = response.data.data;
        } else {
            emitter.emit("openSnackbar", { message: response.data.message || "無法取得備份歷史", color: "error" });
        }
    } catch (error) {
        console.error("獲取備份歷史時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "獲取備份歷史時發生錯誤", color: "error" });
    } finally {
        backupHistoryLoading.value = false;
    }
}

async function deleteBackup(backupId) {
    deleteBackupLoading.value = true;
    try {
        const response = await axios.post("/system/db", JSON.stringify({ db_delete_backup: backupId }));
        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: response.data.data || "刪除備份成功", color: "success" });
            getBackupHistory(); // 重新讀取備份歷史
        } else {
            emitter.emit("openSnackbar", { message: response.data.message || "無法刪除備份", color: "error" });
        }
    } catch (error) {
        console.error("刪除備份時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "刪除備份時發生錯誤", color: "error" });
    } finally {
        deleteBackupLoading.value = false;
    }
}

function confirmDeleteBackup(backupId) {
    confirmValue.value = {
        message: `確定要刪除備份 ${backupId} 嗎？此操作無法撤銷！`,
        confirm: () => deleteBackup(backupId),
    };
    confirm_com.value.open();
}

async function executeDbBackupManage() {
    try {
        const response = await axios.post("/system/db", JSON.stringify({ db_js: "db-backup-manage.js" }));
        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: response.data.data || "自動清理備份成功", color: "success" });
            getBackupHistory(); // 重新讀取備份歷史
        } else {
            emitter.emit("openSnackbar", { message: response.data.message || "無法清理備份", color: "error" });
        }
    } catch (error) {
        console.error("清理備份時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "清理備份時發生錯誤", color: "error" });
    }
}

function confirmCleanBackups() {
    confirmValue.value = {
        message: `確定要執行自動清理備份嗎？此操作將保留最新的備份並刪除舊的備份。`,
        confirm: executeDbBackupManage,
    };
    confirm_com.value.open();
}

async function deleteAllBackups() {
    try {
        const response = await axios.post("/system/db", JSON.stringify({ db_delete_all_backups: true }));
        if (response.data.code === 0) {
            const result = response.data.data;
            emitter.emit("openSnackbar", {
                message: result.message || "已刪除所有備份",
                color: result.success ? "success" : "error",
            });
            getBackupHistory(); // 重新讀取備份歷史
        } else {
            emitter.emit("openSnackbar", { message: response.data.message || "無法刪除所有備份", color: "error" });
        }
    } catch (error) {
        console.error("刪除所有備份時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "刪除所有備份時發生錯誤", color: "error" });
    }
}

function confirmDeleteAllBackups() {
    confirmValue.value = {
        message: `確定要刪除所有備份嗎？此操作無法撤銷！`,
        confirm: deleteAllBackups,
    };
    confirm_com.value.open();
}
</script>

<template>
    <div class="db_backup_management">
        <v-sheet rounded="lg" elevation="4" class="pa-4">
            <h2 class="mb-4 text-h5 font-weight-bold">資料庫備份管理</h2>

            <div class="mb-4 d-flex justify-space-between align-center">
                <div>
                    <v-btn color="primary" @click="getBackupHistory" :loading="backupHistoryLoading">
                        <v-icon left>mdi-refresh</v-icon>
                        刷新備份列表
                    </v-btn>
                    <v-btn class="ml-2" color="warning" @click="confirmCleanBackups">
                        <v-icon left>mdi-broom</v-icon>
                        自動清理舊備份
                    </v-btn>
                    <v-btn class="ml-2" color="error" @click="confirmDeleteAllBackups">
                        <v-icon left>mdi-delete-sweep</v-icon>
                        刪除所有備份
                    </v-btn>
                </div>
            </div>

            <v-data-table
                :headers="[
                    { title: '備份 ID', key: 'id', align: 'start', sortable: true },
                    { title: '建立時間', key: 'formattedDate', align: 'start', sortable: false },
                    { title: '備份大小', key: 'sizeFormatted', align: 'start', sortable: false },
                    { title: '檔案數量', key: 'fileCount', align: 'start', sortable: false },
                    { title: '狀態', key: 'isComplete', align: 'start', sortable: false },
                    { title: '操作', key: 'actions', align: 'center', sortable: false },
                ]"
                :items="backupHistory"
                :items-per-page="10"
                :loading="backupHistoryLoading"
                class="elevation-1 custom-table"
                :footer-props="{
                    'items-per-page-options': [5, 10, 20, 50],
                    'items-per-page-text': '每頁顯示',
                    'show-first-last-page': true,
                }"
            >
                <template v-slot:item.isComplete="{ item }">
                    <v-chip :color="item.isComplete ? 'success' : 'warning'" text-color="white">
                        {{ item.isComplete ? "完成" : "處理中" }}
                    </v-chip>
                </template>

                <template v-slot:item.actions="{ item }">
                    <div class="justify-center d-flex">
                        <v-icon
                            icon="mdi-delete"
                            small
                            text
                            color="error"
                            @click="confirmDeleteBackup(item.id)"
                            :loading="deleteBackupLoading"
                            class="mx-3"
                        >
                            <v-tooltip activator="parent" location="top">刪除</v-tooltip>
                        </v-icon>
                    </div>
                </template>

                <template v-slot:no-data>
                    <div class="py-4 text-center">
                        <p class="mb-2 text-subtitle-1">尚無備份資料</p>
                    </div>
                </template>
            </v-data-table>

            <div class="mt-4 text-caption">
                <p>※ 自動清理舊備份將保留最新的 5 個備份，總大小不超過 10GB</p>
                <p>※ 備份檔案路徑: db/db-backup/[時間戳]</p>
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
.db_backup_management {
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
