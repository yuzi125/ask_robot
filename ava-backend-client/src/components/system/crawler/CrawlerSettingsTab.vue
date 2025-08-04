<script setup>
import { ref, computed, inject, watch } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import * as jsondiffpatch from "jsondiffpatch";
import { diff_match_patch } from "diff-match-patch";
import { formatDeltaToHtml, estimateChangesCount } from "@/utils/crawler";
import { useLocalStorage } from "@vueuse/core";

// 導入子元件
import EditDialog from "./EditDialog.vue";
import AddDialog from "./AddDialog.vue";
import DiffPreviewDialog from "./DiffPreviewDialog.vue";

const axios = inject("axios");
const emitter = inject("emitter");
const queryClient = useQueryClient();
const backupSiteConfigData = useLocalStorage("crawler-site-config-data", {});

// 站點配置資料 - 使用深拷貝來保存從 Vue Query 獲取的數據
const siteConfigData = ref({ code: 0, data: { sites: [] } });
const errorMessage = ref("");

// 保存原始數據用於比較
const originalConfigData = ref({ code: 0, data: { sites: [] } });

// 編輯對話框相關
const editDialog = ref(false);
const currentSite = ref(null);
const editedSite = ref({});
const isEditing = ref(false);

// 新增對話框相關
const addDialog = ref(false);
const newSite = ref({
    id: "",
    url: "",
    template_id: "1-1",
    start: [""],
    template_name: "公用版型",
    site_name: "",
    site_id: "",
    crawler_mode: "scrapy_basic",
    active: true,
});
const customFields = ref({});
const persistentCustomFields = ref({});

// 搜尋和過濾相關
const searchTerm = ref("");
const crawlerModeFilter = ref("");
const statusFilter = ref("");

// 爬蟲模式選項
const crawlerModes = [
    { value: "scrapy_basic", text: "scrapy_basic" },
    { value: "scrapy_selenium", text: "scrapy_selenium" },
    { value: "crawler", text: "crawler" },
];

// 狀態選項
const statusOptions = [
    { value: true, text: "啟用" },
    { value: false, text: "停用" },
];

// 下載附件選項
const downloadAttachmentOptions = [
    { value: true, text: "是" },
    { value: false, text: "否" },
];

const fieldTypeOptions = [
    { value: "text", text: "文字" },
    { value: "number", text: "數字" },
    { value: "boolean", text: "Boolean" },
];

const siteFields = ref([]);

// 站點狀態的格式化文字
const statusText = computed(() => {
    return (status) => (status ? "啟用" : "停用");
});

// 站點狀態的顏色
const statusColor = computed(() => {
    return (status) => (status ? "success" : "error");
});

// 使用Vue Query獲取站點配置
const fetchCrawlerSiteConfig = async () => {
    const res = await axios.get("/crawlerFastAPI/getCrawlerSiteConfig");
    return res.data;
};

const { isLoading, isFetching, data } = useQuery({
    queryKey: ["crawlerSiteConfig"],
    queryFn: fetchCrawlerSiteConfig,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5分鐘
});

// 定義基本欄位（所有站點都應該有的）
const baseFields = [
    { key: "id", label: "ID", readonly: true },
    { key: "url", label: "URL", required: true },
    { key: "site_name", label: "站點名稱", required: true },
    { key: "site_id", label: "站點ID", required: true },
    { key: "template_id", label: "模板ID" },
    { key: "template_name", label: "模板名稱" },
    { key: "crawler_mode", label: "爬蟲模式", type: "select", options: crawlerModes },
    { key: "active", label: "狀態", type: "boolean" },
];

// 獲取站點的所有欄位（包括特殊欄位）
const getFieldsForSite = (site) => {
    // 先包含基本欄位
    const allFields = [...baseFields];

    // 檢測站點中的特殊欄位
    Object.keys(site).forEach((key) => {
        // 如果不是基本欄位且不是 'start'（start 數組需要特殊處理）
        if (!baseFields.some((f) => f.key === key) && key !== "start") {
            const value = site[key];
            const field = { key, label: key };

            // 根據值類型設置欄位類型
            if (typeof value === "boolean") {
                field.type = "boolean";
            } else if (typeof value === "number") {
                field.type = "number";
            } else if (typeof value === "string") {
                field.type = "text";
            } else if (Array.isArray(value)) {
                field.type = "array";
            } else if (typeof value === "object" && value !== null) {
                field.type = "object";
            }

            allFields.push(field);
        }
    });

    return allFields;
};

// 監聽data變化並更新到本地響應式變數 - 使用深拷貝避免readonly
watch(
    data,
    (newData) => {
        if (newData) {
            siteConfigData.value = JSON.parse(JSON.stringify(newData)); // 深拷貝避免readonly
            originalConfigData.value = JSON.parse(JSON.stringify(newData)); // 保存原始數據
        }
    },
    { immediate: true }
);

// 篩選後的站點列表
const filteredSites = computed(() => {
    if (!siteConfigData.value.data?.sites) return [];

    return siteConfigData.value.data.sites.filter((site) => {
        // 搜尋詞條件 (URL或站點名稱)
        const searchMatches =
            searchTerm.value === "" ||
            site.url.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
            site.site_name.toLowerCase().includes(searchTerm.value.toLowerCase());

        // 爬蟲模式條件
        const modeMatches = crawlerModeFilter.value === "" || site.crawler_mode === crawlerModeFilter.value;

        // 狀態條件
        const statusMatches =
            statusFilter.value === "" ||
            (statusFilter.value === true && site.active === true) ||
            (statusFilter.value === false && site.active === false);

        return searchMatches && modeMatches && statusMatches;
    });
});

// 重新獲取配置
const refetchSiteConfig = () => {
    queryClient.invalidateQueries({ queryKey: ["crawlerSiteConfig"] });
};

// 打開編輯對話框
const openEditDialog = (site) => {
    currentSite.value = site;
    editedSite.value = JSON.parse(JSON.stringify(site)); // 深拷貝
    siteFields.value = getFieldsForSite(site);
    isEditing.value = true;
    editDialog.value = true;
};

// 打開新增對話框
const openAddDialog = () => {
    // 生成新的ID
    const maxId = Math.max(...siteConfigData.value.data.sites.map((site) => parseInt(site.id, 10) || 0), 0);

    // 創建新站點，并包含之前保存的自訂欄位
    newSite.value = {
        id: String(maxId + 1).padStart(3, "0"),
        url: "",
        template_id: "1-1",
        start: [""],
        template_name: "公用版型",
        site_name: "",
        site_id: "",
        crawler_mode: "scrapy_basic",
        active: true,
        ...JSON.parse(JSON.stringify(persistentCustomFields.value)),
    };

    // 設置 customFields 為與 persistentCustomFields 相同的內容
    customFields.value = JSON.parse(JSON.stringify(persistentCustomFields.value));

    // 設置基本欄位
    siteFields.value = baseFields;

    // 設置編輯標誌為 false
    isEditing.value = false;

    // 打開對話框
    addDialog.value = true;
};

// 關閉新增對話框時保存自訂欄位
const closeAddDialog = (savedCustomFields) => {
    // 保存自訂欄位以便下次開啟時使用
    persistentCustomFields.value = JSON.parse(JSON.stringify(savedCustomFields || {}));

    // 關閉對話框
    addDialog.value = false;
};

// 完全重置自訂欄位
const resetCustomFields = () => {
    // 清空自訂欄位存儲
    persistentCustomFields.value = {};
    customFields.value = {};
};

// 清除所有過濾器
const clearFilters = () => {
    searchTerm.value = "";
    crawlerModeFilter.value = "";
    statusFilter.value = "";
};

// 匯出配置
const exportJson = () => {
    // 創建與API返回結構相同的數據格式
    const exportData = {
        sites: siteConfigData.value.data.sites,
    };

    // 創建Blob並下載JSON文件
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.download = "crawler_site_config.json";
    a.href = url;
    a.click();

    URL.revokeObjectURL(url);
};

// 變更預覽對話框相關
const diffPreviewDialog = ref(false);
const diffHtml = ref("");
const pendingOperation = ref(null);
const pendingOperationData = ref(null);
const successDetails = ref({
    message: "",
    changedCount: 0,
    operationType: "",
});

// 創建 jsondiffpatch 實例
const diffpatcher = jsondiffpatch.create({
    objectHash: (obj) => obj.id || obj.site_id,
    textDiff: {
        // 使用 diff-match-patch 進行文本差異比較
        diffMatchPatch: diff_match_patch,
    },
});

// 預覽變更的函數
const previewChanges = (operation, data = null) => {
    let left, right;

    if (operation === "edit") {
        // 編輯操作
        const index = originalConfigData.value.data.sites.findIndex((site) => site.id === currentSite.value.id);
        if (index === -1) return;

        // 設置左右數據用於比較
        left = { site: originalConfigData.value.data.sites[index] };
        right = { site: editedSite.value };
    } else if (operation === "delete") {
        // 刪除操作
        left = { sites: originalConfigData.value.data.sites };

        // 創建不包含要刪除站點的數據
        const newSites = originalConfigData.value.data.sites.filter((site) => site.id !== data.id);
        right = { sites: newSites };
    } else if (operation === "add") {
        // 新增操作
        left = { sites: originalConfigData.value.data.sites };
        right = { sites: [...originalConfigData.value.data.sites, newSite.value] };
    } else if (operation === "update") {
        // 批量更新操作
        left = { sites: originalConfigData.value.data.sites };
        right = { sites: siteConfigData.value.data.sites };
    }

    // 計算差異
    const delta = diffpatcher.diff(left, right);

    // 如果沒有差異，顯示提示
    if (!delta) {
        diffHtml.value = '<div class="diff-no-changes">沒有檢測到任何變更</div>';
        successDetails.value.changedCount = 0;
    } else {
        // 使用 jsondiffpatch 的 html 格式化器格式化差異
        // 這裡我們需要自己實現一個簡單的 HTML 格式化
        diffHtml.value = formatDeltaToHtml(delta);

        // 計算變更數量 (簡單估計)
        successDetails.value.changedCount = estimateChangesCount(delta);
    }

    // 保存待執行的操作和數據
    pendingOperation.value = operation;
    pendingOperationData.value = data;

    // 打開預覽對話框
    diffPreviewDialog.value = true;
};

// 執行待處理操作的函數
const executePendingOperation = async () => {
    if (!pendingOperation.value) {
        diffPreviewDialog.value = false;
        return;
    }

    // 追蹤被操作的特定站點
    let operatedSite = null;

    // 根據操作類型執行相應操作
    if (pendingOperation.value === "edit") {
        // 執行編輯操作
        const index = siteConfigData.value.data.sites.findIndex((site) => site.id === currentSite.value.id);
        if (index !== -1) {
            // 保存被編輯的站點資訊
            operatedSite = { ...editedSite.value };

            // 創建新數組，修改相應站點
            const newSites = [...siteConfigData.value.data.sites];
            newSites[index] = editedSite.value;

            siteConfigData.value = {
                ...siteConfigData.value,
                data: {
                    ...siteConfigData.value.data,
                    sites: newSites,
                },
            };
        }
        editDialog.value = false;
    } else if (pendingOperation.value === "delete") {
        // 執行刪除操作
        const index = siteConfigData.value.data.sites.findIndex((site) => site.id === pendingOperationData.value.id);
        if (index !== -1) {
            // 保存被刪除的站點資訊
            operatedSite = { ...siteConfigData.value.data.sites[index] };

            // 創建新數組，過濾掉要刪除的站點
            const newSites = siteConfigData.value.data.sites.filter(
                (site) => site.id !== pendingOperationData.value.id
            );

            siteConfigData.value = {
                ...siteConfigData.value,
                data: {
                    ...siteConfigData.value.data,
                    sites: newSites,
                },
            };
        }
    } else if (pendingOperation.value === "add") {
        // 保存新增的站點資訊
        operatedSite = { ...newSite.value };

        // 執行新增操作
        const newSites = [...siteConfigData.value.data.sites, newSite.value];

        siteConfigData.value = {
            ...siteConfigData.value,
            data: {
                ...siteConfigData.value.data,
                sites: newSites,
            },
        };

        addDialog.value = false;

        // 重置新站點表單和自訂欄位
        resetCustomFields();
        newSite.value = {
            id: "",
            url: "",
            template_id: "1-1",
            start: [""],
            template_name: "公用版型",
            site_name: "",
            site_id: "",
            crawler_mode: "scrapy_basic",
            active: true,
        };
    }

    // 關閉預覽對話框
    diffPreviewDialog.value = false;

    // 更新配置到服務器
    try {
        // 構建與後端API預期一致的數據格式
        backupSiteConfigData.value = JSON.parse(JSON.stringify(siteConfigData.value.data.sites));
        const requestData = {
            sites: {
                sites: siteConfigData.value.data.sites,
            },
            operation: pendingOperation.value,
            operatedSite: operatedSite,
        };

        await axios.post("/crawlerFastAPI/updateCrawlerSiteConfig", requestData);

        // 更新查詢緩存，使用深拷貝避免readonly問題
        queryClient.setQueryData(["crawlerSiteConfig"], JSON.parse(JSON.stringify(siteConfigData.value)));

        // 更新原始數據
        originalConfigData.value = JSON.parse(JSON.stringify(siteConfigData.value));

        // 顯示成功確認
        successDetails.value = {
            message: "成功更新站點配置",
            changedCount: successDetails.value.changedCount,
            operationType: pendingOperation.value,
        };

        emitter.emit("openSnackbar", {
            message: `成功${
                pendingOperation.value === "add"
                    ? "新增"
                    : pendingOperation.value === "edit"
                    ? "編輯"
                    : pendingOperation.value === "delete"
                    ? "刪除"
                    : "更新"
            }站點配置`,
            color: "success",
        });
    } catch (error) {
        console.error("Error updating site config:", error);
        emitter.emit("openSnackbar", {
            message: "更新站點配置時發生錯誤",
            color: "error",
        });
    }

    // 重置待執行操作
    pendingOperation.value = null;
    pendingOperationData.value = null;
};

// 取消待處理操作的函數
const cancelPendingOperation = () => {
    diffPreviewDialog.value = false;
    pendingOperation.value = null;
    pendingOperationData.value = null;
};

// 處理編輯對話框儲存
const handleEditSave = (updatedSite, updatedFields) => {
    editedSite.value = updatedSite;
    siteFields.value = updatedFields;
    previewChanges("edit");
};

// 處理新增對話框儲存
const handleAddSave = (newSiteData, newCustomFieldsData) => {
    newSite.value = newSiteData;
    customFields.value = newCustomFieldsData;
    previewChanges("add");
};

// 刪除站點
const deleteSite = (site) => {
    // 預覽變更
    previewChanges("delete", site);
};
</script>

<template>
    <div class="crawler-settings pa-4">
        <v-container fluid>
            <!-- 操作按鈕 -->
            <v-row>
                <v-col cols="12">
                    <v-alert
                        text="頁面上呈現的資料是從爬蟲 API 取回來的，這裡修改的 config 是針對爬蟲站點的設定，要注意這裡改動以後也會跟系統的 crawler 資料表有關聯。"
                        type="info"
                    ></v-alert>
                </v-col>
            </v-row>
            <v-row>
                <v-col cols="12" class="d-flex justify-space-between">
                    <div>
                        <v-btn
                            color="success"
                            @click="openAddDialog"
                            :disabled="isLoading"
                            class="text-caption text-md-subtitle-2"
                        >
                            <v-icon class="mr-1">mdi-plus</v-icon>
                            新增站點
                        </v-btn>
                    </div>
                    <div>
                        <v-btn
                            color="info"
                            variant="tonal"
                            @click="refetchSiteConfig"
                            :loading="isFetching"
                            class="mr-2 text-caption text-md-subtitle-2"
                        >
                            <v-icon class="mr-1">mdi-refresh</v-icon>
                            更新資料
                        </v-btn>

                        <v-btn
                            color="secondary"
                            @click="exportJson"
                            :disabled="isLoading"
                            class="ml-2 text-caption text-md-subtitle-2"
                        >
                            <v-icon class="mr-1">mdi-file-export</v-icon>
                            匯出 JSON
                        </v-btn>
                    </div>
                </v-col>
            </v-row>

            <!-- 搜尋與過濾 -->
            <v-card class="mt-4 elevation-1 pa-3">
                <v-row align="center">
                    <v-col cols="12" sm="6" md="4">
                        <v-text-field
                            v-model="searchTerm"
                            label="搜尋 URL 或站點名稱"
                            hide-details
                            outlined
                            dense
                            clearable
                            prepend-inner-icon="mdi-magnify"
                        ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6" md="3">
                        <v-select
                            v-model="crawlerModeFilter"
                            :items="[{ value: '', text: '所有爬蟲模式' }, ...crawlerModes]"
                            item-title="text"
                            item-value="value"
                            label="爬蟲模式"
                            hide-details
                            outlined
                            dense
                        ></v-select>
                    </v-col>
                    <v-col cols="12" sm="6" md="3">
                        <v-select
                            v-model="statusFilter"
                            :items="[{ value: '', text: '所有狀態' }, ...statusOptions]"
                            item-title="text"
                            item-value="value"
                            label="狀態"
                            hide-details
                            outlined
                            dense
                        ></v-select>
                    </v-col>
                    <v-col cols="12" sm="6" md="2" class="text-center">
                        <v-btn color="grey" variant="outlined" @click="clearFilters" class="mt-2" block>
                            <v-icon class="mr-1">mdi-filter-remove</v-icon>
                            清除過濾
                        </v-btn>
                    </v-col>
                </v-row>
            </v-card>

            <!-- 站點列表 -->
            <v-card class="mt-4 elevation-2">
                <v-data-table
                    :headers="[
                        { title: 'ID', key: 'id', sortable: true, align: 'center' },
                        { title: 'URL', key: 'url', sortable: true, align: 'center' },
                        { title: '站點名稱', key: 'site_name', sortable: true, align: 'center' },
                        { title: '爬蟲模式', key: 'crawler_mode', sortable: true, align: 'center' },
                        { title: '狀態', key: 'active', sortable: true, align: 'center' },
                        { title: '操作', key: 'actions', sortable: false, align: 'center' },
                    ]"
                    :items="filteredSites"
                    :loading="isLoading"
                    class="site-data-table"
                    :no-data-text="isLoading ? '載入中...' : '沒有符合條件的站點'"
                >
                    <!-- 自定義列格式 -->
                    <template v-slot:item.id="{ item }">
                        <div class="text-center">{{ item.id }}</div>
                    </template>

                    <template v-slot:item.url="{ item }">
                        <div class="text-center">{{ item.url }}</div>
                    </template>

                    <template v-slot:item.site_name="{ item }">
                        <div class="text-center">{{ item.site_name }}</div>
                    </template>

                    <template v-slot:item.crawler_mode="{ item }">
                        <div class="text-center">
                            {{
                                crawlerModes.find((mode) => mode.value === item.crawler_mode)?.text || item.crawler_mode
                            }}
                        </div>
                    </template>

                    <template v-slot:item.active="{ item }">
                        <div class="text-center">
                            <v-chip
                                :color="statusColor(item.active)"
                                text-color="white"
                                size="small"
                                class="font-weight-medium"
                            >
                                {{ statusText(item.active) }}
                            </v-chip>
                        </div>
                    </template>

                    <template v-slot:item.actions="{ item }">
                        <div class="text-center">
                            <v-btn
                                icon
                                variant="text"
                                color="primary"
                                size="small"
                                @click="openEditDialog(item)"
                                class="mx-1"
                            >
                                <v-icon>mdi-pencil</v-icon>
                            </v-btn>
                            <v-btn
                                icon
                                variant="text"
                                color="error"
                                size="small"
                                @click="deleteSite(item)"
                                class="mx-1"
                            >
                                <v-icon>mdi-delete</v-icon>
                            </v-btn>
                        </div>
                    </template>
                </v-data-table>
            </v-card>
        </v-container>

        <!-- 導入子元件 -->
        <EditDialog
            v-model="editDialog"
            :current-site="currentSite"
            :edited-site="editedSite"
            :site-fields="siteFields"
            :crawler-modes="crawlerModes"
            :status-options="statusOptions"
            :download-attachment-options="downloadAttachmentOptions"
            :field-type-options="fieldTypeOptions"
            @save="handleEditSave"
            @close="editDialog = false"
        />

        <AddDialog
            v-model="addDialog"
            :new-site-data="newSite"
            :custom-fields-data="customFields"
            :crawler-modes="crawlerModes"
            :status-options="statusOptions"
            :field-type-options="fieldTypeOptions"
            @save="handleAddSave"
            @close="closeAddDialog"
        />

        <DiffPreviewDialog
            v-model="diffPreviewDialog"
            :diff-html="diffHtml"
            :pending-operation="pendingOperation"
            :pending-operation-data="pendingOperationData"
            :current-site="currentSite"
            @confirm="executePendingOperation"
            @cancel="cancelPendingOperation"
        />
    </div>
</template>

<style scoped>
/* 自定義樣式 */
.crawler-settings {
    min-height: 70vh;
}

/* 表格垂直居中對齊 */
:deep(.site-data-table th) {
    font-size: 14px !important;
    font-weight: bold !important;
    color: rgba(0, 0, 0, 0.8) !important;
    text-align: center !important;
    vertical-align: middle !important;
}

:deep(.site-data-table td) {
    text-align: center !important;
    vertical-align: middle !important;
}

.v-btn {
    letter-spacing: 0.5px;
}

:deep(.v-card-title) {
    letter-spacing: 0.5px;
}

:deep(.v-text-field .v-input__details) {
    padding-left: 4px;
}

:deep(.v-text-field--disabled .v-field__input) {
    opacity: 0.8;
}
</style>
