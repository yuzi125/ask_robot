<script setup>
import { ref, inject, onMounted, computed, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import ConfirmComponents from "@/components/ConfirmComponents.vue";
const axios = inject("axios");
const emitter = inject("emitter");

const allTables = ref([]);
const allTablesLoading = ref(false);
const tableSearch = ref("");
const selectedTables = ref([]);
const selectBackupTablesLoading = ref(false);
const lastSelectedBackupId = useLocalStorage("lastSelectedBackupId", null);
const confirmValue = ref({});
const confirm_com = ref(null);

// 新增下載備份相關變數
const downloadBackupDialog = ref(false);
const selectedBackupId = ref(null);
const backupTables = ref([]);
const zipBackupTablesLoading = ref(false);
const backupTablesError = ref(null);
const selectedBackupTables = ref([]);
const backupTableSearch = ref("");
const createZipLoading = ref(false);
const selectAllTablesCheckbox = ref(false);
const showDownloadDialog = ref(false);

const backupHistory = ref([]);
const backupHistoryLoading = ref(false);

const activeBackupTaskId = ref(null);
const isBackupInProgress = ref(false);
const backupProgress = ref({
    completed: false,
    successCount: 0,
    errorCount: 0,
    timeElapsed: "0",
    currentTable: "",
    totalTables: 0,
});

onMounted(() => {
    getAllTableNames();
    getBackupHistory();
});

async function getAllTableNames() {
    allTablesLoading.value = true;
    try {
        const response = await axios.post("/system/db", JSON.stringify({ db_get_all_tables: true }));
        if (response.data.code === 0) {
            allTables.value = response.data.data.map((name) => ({ name }));
        } else {
            emitter.emit("openSnackbar", { message: response.data.message || "無法取得表格列表", color: "error" });
        }
    } catch (error) {
        console.error("獲取表格列表時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "獲取表格列表時發生錯誤", color: "error" });
    } finally {
        allTablesLoading.value = false;
    }
}

function removeFromSelectedTables(tableName) {
    const index = selectedTables.value.indexOf(tableName);
    if (index !== -1) {
        selectedTables.value.splice(index, 1);
    }
}

async function backupSelectedTables() {
    selectBackupTablesLoading.value = true;
    try {
        const response = await axios.post("/system/db", JSON.stringify({ db_backup_tables: selectedTables.value }));
        if (response.data.code === 0) {
            if (response.data.data && response.data.data.taskId) {
                activeBackupTaskId.value = response.data.data.taskId;
                isBackupInProgress.value = true;

                // 開始輪詢備份狀態
                pollBackupStatus(response.data.data.taskId);
            }

            emitter.emit("openSnackbar", {
                message: "備份任務已開始",
                color: "success",
            });
        } else {
            emitter.emit("openSnackbar", {
                message: response.data.message || "備份表格失敗",
                color: "error",
            });
        }
    } catch (error) {
        console.error("備份表格時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "備份表格時發生錯誤", color: "error" });
    } finally {
        selectBackupTablesLoading.value = false;
    }
}

// 新增輪詢備份狀態的函數
async function pollBackupStatus(taskId) {
    const maxAttempts = 60; // 最多嘗試 60 次
    let attempts = 0;

    const poll = async () => {
        try {
            const response = await axios.post("/system/db", JSON.stringify({ db_get_backup_status: taskId }));

            if (response.data.code === 0) {
                const status = response.data.data;
                backupProgress.value = status;

                if (status.completed) {
                    isBackupInProgress.value = false;
                    activeBackupTaskId.value = null;

                    if (status.error) {
                        emitter.emit("openSnackbar", {
                            message: `備份失敗: ${status.error}`,
                            color: "error",
                        });
                    } else {
                        lastSelectedBackupId.value = status.backupId;
                        emitter.emit("openSnackbar", {
                            message: `備份完成！成功備份 ${status.successCount} 個表格，耗時 ${status.timeElapsed} 秒`,
                            color: "success",
                        });

                        // 自動打開下載對話框
                        openBackupDownloadDialog(status.backupId);
                    }
                    return;
                }
            }

            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 1000); // 每秒檢查一次
            } else {
                isBackupInProgress.value = false;
                activeBackupTaskId.value = null;
                emitter.emit("openSnackbar", {
                    message: "備份狀態檢查超時",
                    color: "warning",
                });
            }
        } catch (error) {
            console.error("檢查備份狀態時發生錯誤:", error);
            isBackupInProgress.value = false;
            activeBackupTaskId.value = null;
            emitter.emit("openSnackbar", {
                message: "檢查備份狀態時發生錯誤",
                color: "error",
            });
        }
    };

    poll();
}

async function cancelBackup() {
    if (!activeBackupTaskId.value) return;

    try {
        const response = await axios.post("/system/db", JSON.stringify({ db_cancel_backup: activeBackupTaskId.value }));
        if (response.data.code === 0) {
            isBackupInProgress.value = false;
            activeBackupTaskId.value = null;
            emitter.emit("openSnackbar", {
                message: "已發送取消備份的請求",
                color: "info",
            });
        } else {
            emitter.emit("openSnackbar", {
                message: response.data.message || "取消備份失敗",
                color: "error",
            });
        }
    } catch (error) {
        console.error("取消備份時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: "取消備份時發生錯誤", color: "error" });
    }
}

function confirmBackupSelectedTables() {
    confirmValue.value = {
        message: `確定要備份選擇的 ${selectedTables.value.length} 個表格嗎？`,
        confirm: backupSelectedTables,
    };
    confirm_com.value.open();
}

const filteredTableNames = computed(() => {
    return allTables.value.filter((table) => {
        if (tableSearch.value === "") return true;
        return table.name.toLowerCase().includes(tableSearch.value.toLowerCase());
    });
});

// 新增下載備份相關函數
function openBackupDownloadDialog(backupId) {
    selectedBackupId.value = backupId;
    selectedBackupTables.value = []; // 清空先前的選擇
    downloadBackupDialog.value = true;
    getBackupTables(backupId);
}

function closeBackupDownloadDialog() {
    downloadBackupDialog.value = false;
    backupTablesError.value = null;
    backupTables.value = [];
    backupTableSearch.value = "";
    selectedBackupTables.value = [];
}

async function getBackupTables(backupId) {
    zipBackupTablesLoading.value = true;
    backupTablesError.value = null;

    try {
        const response = await axios.post("/system/db", JSON.stringify({ db_get_backup_tables: backupId }));

        if (response.data.code === 0) {
            backupTables.value = response.data.data;
        } else {
            backupTablesError.value = response.data.message || "無法獲取備份表格";
        }
    } catch (error) {
        console.error("獲取備份表格時發生錯誤:", error);
        backupTablesError.value = "獲取備份表格時發生錯誤";
    } finally {
        zipBackupTablesLoading.value = false;
    }
}

const filteredBackupTableList = computed(() => {
    if (!backupTableSearch.value) return backupTables.value;

    return backupTables.value.filter((table) =>
        table.name.toLowerCase().includes(backupTableSearch.value.toLowerCase())
    );
});

function selectAllBackupTables() {
    selectedBackupTables.value = backupTables.value.map((table) => table.name);
    selectAllTablesCheckbox.value = true;
}

function unselectAllBackupTables() {
    selectedBackupTables.value = [];
    selectAllTablesCheckbox.value = false;
}

function toggleAllTables() {
    if (selectAllTablesCheckbox.value) {
        selectAllBackupTables();
    } else {
        unselectAllBackupTables();
    }
}

watch(selectedBackupTables, (newVal) => {
    if (newVal.length === backupTables.value.length) {
        selectAllTablesCheckbox.value = true;
    } else {
        selectAllTablesCheckbox.value = false;
    }
});

async function downloadBackup(backupId) {
    try {
        const response = await axios.post(
            "/system/db",
            JSON.stringify({
                db_create_backup_zip: {
                    backupId: backupId,
                    tableNames: [], // 空陣列表示下載所有表格
                },
            })
        );

        if (response.data.code === 0) {
            const { fileName, tablesCount } = response.data.data;
            const downloadUrl = import.meta.env.VITE_BACKEND_HOST + `/system/db/download-zip?fileName=${fileName}`;
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            emitter.emit("openSnackbar", {
                message: `正在下載 ${tablesCount} 個表格的備份ZIP檔案`,
                color: "success",
            });
        } else {
            throw new Error(response.data.message || "建立ZIP檔案失敗");
        }
    } catch (error) {
        console.error("下載備份時發生錯誤:", error);
        emitter.emit("openSnackbar", {
            message: error.message || "下載備份時發生錯誤",
            color: "error",
        });
    }
}

async function downloadSelectedTablesAsZip() {
    if (!selectedBackupId.value || selectedBackupTables.value.length === 0) {
        emitter.emit("openSnackbar", {
            message: "請選擇要下載的表格",
            color: "warning",
        });
        return;
    }

    createZipLoading.value = true;
    try {
        const response = await axios.post(
            "/system/db",
            JSON.stringify({
                db_create_backup_zip: {
                    backupId: selectedBackupId.value,
                    tableNames: selectedBackupTables.value,
                },
            })
        );

        if (response.data.code === 0) {
            const { fileName, tablesCount } = response.data.data;
            const downloadUrl = import.meta.env.VITE_BACKEND_HOST + `/system/db/download-zip?fileName=${fileName}`;
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            emitter.emit("openSnackbar", {
                message: `正在下載 ${tablesCount} 個表格的備份ZIP檔案`,
                color: "success",
            });

            // 關閉對話框
            closeBackupDownloadDialog();
        } else {
            throw new Error(response.data.message || "創建 ZIP 文件失敗");
        }
    } catch (error) {
        console.error("下載備份時發生錯誤:", error);
        emitter.emit("openSnackbar", {
            message: error.message || "下載備份時發生錯誤",
            color: "error",
        });
    } finally {
        createZipLoading.value = false;
    }
}

async function downloadAllTablesAsZip() {
    if (!selectedBackupId.value) {
        emitter.emit("openSnackbar", {
            message: "請選擇要下載的備份",
            color: "warning",
        });
        return;
    }

    createZipLoading.value = true;
    try {
        const response = await axios.post(
            "/system/db",
            JSON.stringify({
                db_create_backup_zip: {
                    backupId: selectedBackupId.value,
                    tableNames: [], // 空陣列表示下載所有表格
                },
            })
        );

        if (response.data.code === 0) {
            const { fileName, tablesCount } = response.data.data;
            const downloadUrl = import.meta.env.VITE_BACKEND_HOST + `/system/db/download-zip?fileName=${fileName}`;
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            emitter.emit("openSnackbar", {
                message: `正在下載 ${tablesCount} 個表格的備份ZIP檔案`,
                color: "success",
            });

            // 關閉對話框
            closeBackupDownloadDialog();
        } else {
            throw new Error(response.data.message || "創建 ZIP 文件失敗");
        }
    } catch (error) {
        console.error("下載備份時發生錯誤:", error);
        emitter.emit("openSnackbar", {
            message: error.message || "下載備份時發生錯誤",
            color: "error",
        });
    } finally {
        createZipLoading.value = false;
    }
}

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

function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
</script>

<template>
    <div class="selective_table_backup">
        <v-sheet rounded="lg" elevation="4" class="pa-4">
            <h2 class="mb-4 text-h5 font-weight-bold">選擇性資料表備份</h2>

            <div class="mb-4 d-flex justify-space-between align-center">
                <div>
                    <v-btn color="primary" @click="getAllTableNames" :loading="allTablesLoading">
                        <v-icon left>mdi-refresh</v-icon>
                        載入所有表格
                    </v-btn>
                    <v-btn class="ml-2" color="error" @click="confirmDeleteAllBackups">
                        <v-icon left>mdi-delete-sweep</v-icon>
                        刪除 db/backup 資料夾所有備份
                    </v-btn>
                </div>
                <div>
                    <v-btn v-if="isBackupInProgress" color="warning" @click="cancelBackup" class="mr-2">
                        <v-icon left>mdi-cancel</v-icon>
                        取消備份
                    </v-btn>
                    <v-btn
                        color="success"
                        @click="confirmBackupSelectedTables"
                        :disabled="selectedTables.length === 0 || isBackupInProgress"
                        :loading="selectBackupTablesLoading"
                    >
                        <v-icon left>mdi-database-export</v-icon>
                        {{ isBackupInProgress ? "備份進行中..." : "備份選擇的表格" }}
                    </v-btn>
                </div>
            </div>

            <div class="mb-4">
                <v-text-field
                    v-model="tableSearch"
                    label="搜尋表格名稱"
                    outlined
                    clearable
                    prepend-inner-icon="mdi-magnify"
                    @click:clear="tableSearch = ''"
                ></v-text-field>
            </div>

            <v-row>
                <v-col cols="12">
                    <v-data-table
                        :headers="[
                            {
                                title: '',
                                key: 'checkbox',
                                sortable: false,
                                align: 'center',
                                width: '80px',
                            },
                            { title: '表格名稱', key: 'name', align: 'start' },
                        ]"
                        :items="filteredTableNames"
                        :items-per-page="10"
                        :loading="allTablesLoading"
                        :search="tableSearch"
                        item-key="name"
                        class="elevation-1 custom-table"
                        :footer-props="{
                            'items-per-page-options': [10, 20, 50, 100],
                            'items-per-page-text': '每頁顯示',
                        }"
                    >
                        <template v-slot:item.checkbox="{ item }">
                            <v-checkbox v-model="selectedTables" :value="item.name" hide-details dense></v-checkbox>
                        </template>
                    </v-data-table>
                </v-col>
            </v-row>

            <v-divider class="my-4"></v-divider>

            <h3 class="mb-2">已選擇的表格</h3>
            <v-chip-group column>
                <v-chip
                    v-for="table in selectedTables"
                    :key="table"
                    close
                    color="primary"
                    @click:close="removeFromSelectedTables(table)"
                >
                    {{ table }}
                </v-chip>
            </v-chip-group>

            <div v-if="selectedTables.length === 0" class="text-center grey--text text--darken-1 pa-4">
                尚未選擇任何表格
            </div>

            <div class="justify-end mt-4 d-flex">
                <v-btn
                    v-if="lastSelectedBackupId"
                    color="primary"
                    @click="openBackupDownloadDialog(lastSelectedBackupId)"
                    class="ml-2"
                >
                    <v-icon left>mdi-download</v-icon>
                    下載上次備份的表格
                </v-btn>
            </div>

            <div class="mt-4 text-caption">
                <p>※ 選擇性備份允許您只備份需要的資料表</p>
                <p>※ 備份檔案將存放在特定的資料夾中，可從備份管理中查看</p>
            </div>

            <div class="mb-4">
                <h3>備份歷史</h3>
                <div v-if="backupHistory.length > 0" class="backup-history">
                    <div v-for="backup in backupHistory" :key="backup.id" class="backup-item">
                        <div class="backup-info">
                            <span class="backup-date">{{ backup.formattedDate }}</span>
                            <span
                                class="backup-status"
                                :class="{ completed: backup.completed, error: backup.errorCount > 0 }"
                            >
                                {{ backup.errorCount > 0 ? `(${backup.errorCount}個錯誤)` : "" }}
                            </span>
                        </div>
                        <div class="backup-actions">
                            <button @click="downloadBackup(backup.id)" class="btn btn-sm btn-primary">下載</button>
                        </div>
                    </div>
                </div>
                <div v-else class="no-backups">暫無備份記錄</div>
            </div>

            <div v-if="showDownloadDialog" class="download-dialog">
                <h4>選擇要下載的表格</h4>
                <div class="table-list">
                    <div v-for="table in backupTables" :key="table.name" class="table-item">
                        <input
                            type="checkbox"
                            :id="'download-' + table.name"
                            v-model="selectedDownloadTables"
                            :value="table.name"
                        />
                        <label :for="'download-' + table.name">
                            {{ table.name }} ({{ formatFileSize(table.size) }})
                        </label>
                    </div>
                </div>
                <div class="dialog-actions">
                    <button @click="downloadSelectedTablesAsZip" class="btn btn-primary">下載</button>
                    <button @click="showDownloadDialog = false" class="btn btn-secondary">取消</button>
                </div>
            </div>

            <div v-if="isBackupInProgress" class="backup-progress">
                <v-progress-linear
                    :value="
                        ((backupProgress.successCount + backupProgress.errorCount) / backupProgress.totalTables) * 100
                    "
                    height="25"
                    color="primary"
                >
                    <template v-slot:default="{ value }">
                        <strong>{{ Math.ceil(value) }}%</strong>
                    </template>
                </v-progress-linear>
                <div class="mt-2 progress-details">
                    <div>正在備份: {{ backupProgress.currentTable }}</div>
                    <div>
                        已完成: {{ backupProgress.successCount + backupProgress.errorCount }} /
                        {{ backupProgress.totalTables }}
                    </div>
                    <div>成功: {{ backupProgress.successCount }} | 失敗: {{ backupProgress.errorCount }}</div>
                    <div>耗時: {{ backupProgress.timeElapsed }} 秒</div>
                </div>
            </div>
        </v-sheet>

        <!-- 新增下載備份對話框 -->
        <v-dialog v-model="downloadBackupDialog" max-width="800px">
            <v-card>
                <v-card-title class="headline"> 下載備份 #{{ selectedBackupId }} </v-card-title>

                <v-card-text v-if="zipBackupTablesLoading">
                    <v-progress-circular
                        indeterminate
                        color="primary"
                        class="mx-auto my-5 d-block"
                    ></v-progress-circular>
                    <p class="text-center">正在載入備份表格...</p>
                </v-card-text>

                <v-card-text v-else>
                    <v-alert v-if="backupTablesError" type="error" class="mb-4">
                        {{ backupTablesError }}
                    </v-alert>

                    <template v-else>
                        <p class="mb-3">選擇要下載的表格，或直接下載全部表格。</p>

                        <div class="mb-4 d-flex align-center">
                            <v-text-field
                                v-model="backupTableSearch"
                                label="搜尋表格"
                                prepend-inner-icon="mdi-magnify"
                                clearable
                                outlined
                                dense
                                hide-details
                                class="mr-4"
                            ></v-text-field>

                            <v-btn color="success" @click="selectAllBackupTables" class="mr-2">全選</v-btn>
                            <v-btn color="info" @click="unselectAllBackupTables">取消全選</v-btn>
                        </div>

                        <v-data-table
                            :headers="[
                                { title: '', key: 'checkbox', sortable: false, align: 'center', width: '80px' },
                                { title: '表格名稱', key: 'name', align: 'start' },
                                { title: '大小', key: 'size', align: 'end' },
                            ]"
                            :items="filteredBackupTableList"
                            :items-per-page="10"
                            dense
                            class="mb-4 elevation-1 custom-table"
                            :footer-props="{
                                'items-per-page-options': [10, 20, 50, 100],
                                'items-per-page-text': '每頁顯示',
                                'show-first-last-page': true,
                            }"
                            :page="1"
                            :search="backupTableSearch"
                        >
                            <template v-slot:item.checkbox="{ item }">
                                <v-checkbox
                                    v-model="selectedBackupTables"
                                    :value="item.name"
                                    hide-details
                                    dense
                                ></v-checkbox>
                            </template>
                            <template v-slot:item.size="{ item }">
                                {{ formatFileSize(item.size) }}
                            </template>
                        </v-data-table>

                        <div class="d-flex justify-space-between align-center">
                            <div>
                                <p class="mb-0">
                                    已選擇 {{ selectedBackupTables.length }} / {{ backupTables.length }} 個表格
                                </p>
                            </div>
                            <div>
                                <v-btn
                                    color="primary"
                                    :loading="createZipLoading"
                                    :disabled="selectedBackupTables.length === 0"
                                    @click="downloadSelectedTablesAsZip"
                                    class="mr-2"
                                >
                                    <v-icon left>mdi-zip-box</v-icon>
                                    下載選擇的表格
                                </v-btn>
                                <v-btn color="secondary" :loading="createZipLoading" @click="downloadAllTablesAsZip">
                                    <v-icon left>mdi-download-box</v-icon>
                                    下載全部表格
                                </v-btn>
                            </div>
                        </div>
                    </template>
                </v-card-text>

                <v-divider></v-divider>

                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="grey darken-1" text @click="closeBackupDownloadDialog" :disabled="createZipLoading">
                        關閉
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

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
.selective_table_backup {
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

.backup-history {
    margin-bottom: 20px;
}

.backup-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border: 1px solid #ddd;
    margin-bottom: 5px;
    border-radius: 4px;
}

.backup-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.backup-date {
    font-weight: bold;
}

.backup-status {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.9em;
}

.backup-status.completed {
    background-color: #d4edda;
    color: #155724;
}

.backup-status.error {
    background-color: #f8d7da;
    color: #721c24;
}

.no-backups {
    padding: 20px;
    text-align: center;
    color: #666;
}

.download-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-width: 500px;
    width: 90%;
}

.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

.table-list {
    max-height: 300px;
    overflow-y: auto;
    margin: 10px 0;
}

.table-item {
    display: flex;
    align-items: center;
    padding: 5px 0;
}

.table-item input[type="checkbox"] {
    margin-right: 10px;
}

.backup-progress {
    margin: 20px 0;
    padding: 15px;
    background-color: #f5f5f5;
    border-radius: 4px;
}

.progress-details {
    font-size: 0.9em;
    color: #666;
    > div {
        margin: 4px 0;
    }
}
</style>
