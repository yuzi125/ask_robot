<script setup>
import InputComponents from "../components/InputComponents.vue";
import TipComponent from "../components/TipComponents.vue";
import ConfigurationSelect from "@/components/ConfigurationSelect.vue";
import { useDocuments } from "../composables/useDocuments";
import { useUserStore, useStateStore, useSettingStore, usePermissionStore } from "../store/index";
import { ref, toRefs, onMounted, inject, nextTick, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute } from "vue-router";
import * as XLSX from "xlsx";
import Papa from "papaparse";
const axios = inject("axios");
const emitter = inject("emitter");
const route = useRoute();
// const props = defineProps({
//     data: { type: Object, default: {} },
// });
const userStore = useUserStore();
const { nickname, email, image, user_no } = storeToRefs(userStore);
// setting store
onMounted(() => {
    init();
});
const datasets_id = route.params.datasets_id;

const content_replacement_list = ref({});
const search_kwargs = ref({});
// const examples = ref([]);
const tip = ref([]);
const config_jsonb = ref({});
const model = ref({});
const embedding_model = ref({});
const downloadSourceFile = ref();
const sortPriority = ref();
const contentReplacementListRef = ref(null);

const isDownloadableMap = {
    true: "開啟",
    false: "關閉",
};
const permissionStore = usePermissionStore();
const { userPermission } = storeToRefs(permissionStore);

const defaultSelect = "系統預設 (claude-3-haiku-20240307)";

const modelSelect = ref({ state: defaultSelect, abbr: { name: "model", text: "", isJson: false } });

const defaultEmbeddingSelect = "系統預設 (text-embedding-3-large)";
const embeddingModelSelects = ref([
    { state: defaultEmbeddingSelect, abbr: { name: "embedding_model", text: "text-embedding-3-large", isJson: false } },
    {
        state: "text-embedding-3-large",
        abbr: { name: "embedding_model", text: "text-embedding-3-large", isJson: false },
    },
    {
        state: "text-embedding-ada-002",
        abbr: { name: "embedding_model", text: "text-embedding-ada-002", isJson: false },
    },
]);
const downloadSourceFileSelect = ref([
    { text: "開啟", abbr: { name: "is_downloadable", text: true } },
    { text: "關閉", abbr: { name: "is_downloadable", text: false } },
]);

const embeddingModelSelect = ref({
    state: defaultEmbeddingSelect,
    abbr: { name: "model", text: "text-embedding-3-large", isJson: false },
});

const sortPriorityOptions = [
    { text: "1", abbr: { name: "sort_priority", text: "1" } },
    { text: "2", abbr: { name: "sort_priority", text: "2" } },
    { text: "3", abbr: { name: "sort_priority", text: "3" } },
    { text: "4", abbr: { name: "sort_priority", text: "4" } },
    { text: "5", abbr: { name: "sort_priority", text: "5" } },
];

// 新增文件上传相关的变量
const fileInputRef = ref(null);
const uploadProgress = ref(false);

async function init() {
    let rs = await axios.get(`/datasets/datasets?datasets_id=${datasets_id}`);
    if (rs.data.code === 0) {
        rs = rs.data.data[0]?.config_jsonb;
        config_jsonb.value = rs;
        //若有新增增加這邊
        content_replacement_list.value = {
            text: rs.content_replacement_list,
            name: "content_replacement_list",
            isJson: false,
        };
        search_kwargs.value = { text: JSON.stringify(rs.search_kwargs), name: "search_kwargs", isJson: true };
        // examples.value = { text: JSON.stringify(rs.examples), name: "examples", isJson: true };
        model.value = { text: rs.model ? rs.model : defaultSelect, name: "model", isJson: false };
        modelSelect.value = { state: rs.model ? rs.model : defaultSelect, abbr: model.value };
        tip.value = { text: JSON.stringify(rs.tip), name: "tip", isArray: true, isJson: false };
        downloadSourceFile.value = {
            text:
                rs.is_downloadable !== undefined
                    ? isDownloadableMap[rs.is_downloadable]
                    : "請選擇是否要啟用來源檔案的下載功能",
            name: "is_downloadable",
            isJson: true,
        };

        sortPriority.value = { text: rs.sort_priority ? rs.sort_priority : "5", name: "sort_priority", isJson: false };

        embedding_model.value = {
            text: rs.embedding_model ? rs.embedding_model : defaultEmbeddingSelect,
            name: "embedding_model",
            isJson: false,
        };
        embeddingModelSelect.value = {
            state: rs.embedding_model ? rs.embedding_model : defaultEmbeddingSelect,
            abbr: embedding_model.value,
        };
    }
}
const update_finish = ref(true);
const update_name = ref(true);
async function update(item) {
    let value = chkJsonValue(item);
    let arrValue = checkIsArray(item);

    if ((value === false || arrValue === false) && item.name !== "is_downloadable") {
        return;
    }

    config_jsonb.value[item.name] = value;

    if (arrValue) {
        config_jsonb.value["tip"] = arrValue;
    }

    update_finish.value = false;
    update_name.value = item.name;
    let rs = await axios.put(
        "/datasets/update",
        JSON.stringify({ datasets_id: datasets_id, config_jsonb: config_jsonb.value })
    );
    update_finish.value = true;
    update_name.value = "";
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
}
function chkJsonValue(item) {
    if (item.isJson) {
        try {
            JSON.parse(item.text);
            item.text = JSON.stringify(JSON.parse(item.text));
            return JSON.parse(item.text);
        } catch (e) {
            item.text = item.originalText;
            emitter.emit("openSnackbar", { message: "請輸入json格式", color: "warning" });
            return false;
        }
    }
    return item.text;
}

function checkArrayElements(array) {
    for (let item of array) {
        if (typeof item === "object" && !Array.isArray(item)) {
            if (!item.hasOwnProperty("buttonValue") || !item.hasOwnProperty("clickValue")) {
                throw new Error('物件元素必須包含 "buttonValue" 或 "clickValue" 屬性');
            }
        }
    }
    return true; // 如果所有元素都檢查通過，返回 true
}

function checkIsArray(item) {
    if (item.isArray) {
        try {
            const arrParsed = JSON.parse(item.text);
            if (!Array.isArray(arrParsed)) {
                throw new Error('請輸入陣列格式 例如：["專業技能1","專業技能2"]');
            }

            checkArrayElements(arrParsed); // 調用 checkArrayElements 函數來檢查陣列內的元素

            return arrParsed;
        } catch (error) {
            console.error("Invalid array string:", error.message);
            item.text = item.originalText;
            emitter.emit("openSnackbar", {
                message: error.message,
                color: "warning",
            });
            return false;
        }
    }
}

const isEditing = ref(false);
function enterEditMode() {
    isEditing.value = true;
}

function exitEditMode() {
    isEditing.value = false;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    uploadProgress.value = true;
    const fileType = file.name.split(".").pop().toLowerCase();

    if (fileType === "csv") {
        Papa.parse(file, {
            complete: function (results) {
                processFileData(results.data);
            },
            error: function (error) {
                emitter.emit("openSnackbar", { message: "CSV檔案解析失敗: " + error.message, color: "error" });
                uploadProgress.value = false;
            },
        });
    } else if (fileType === "xlsx" || fileType === "xls") {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                processFileData(rows);
            } catch (error) {
                emitter.emit("openSnackbar", { message: "Excel檔案解析失敗: " + error.message, color: "error" });
                uploadProgress.value = false;
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        emitter.emit("openSnackbar", { message: "請上傳.csv或.xlsx/.xls格式的檔案", color: "warning" });
        uploadProgress.value = false;
    }

    // 重置檔案輸入以允許再次選擇同一檔案
    event.target.value = "";
}

function processFileData(rows) {
    try {
        const filteredRows = rows.filter((row) => row && row.length > 1 && row[0]); // 過濾掉空行
        if (filteredRows.length === 0) {
            throw new Error("檔案中沒有有效數據");
        }

        const replacementRules = {};
        filteredRows.forEach((row) => {
            const oldStr = row[0].toString().trim();
            if (oldStr) {
                for (let i = 1; i < row.length; i++) {
                    const newStr = row[i]?.toString().trim();
                    if (newStr) {
                        replacementRules[newStr] = oldStr;
                    }
                }
            }
        });

        // 檢查是否有規則生成
        if (Object.keys(replacementRules).length === 0) {
            throw new Error("未能生成有效的替換規則");
        }

        content_replacement_list.value.text = JSON.stringify(replacementRules, null, 2);
        if (contentReplacementListRef.value) {
            contentReplacementListRef.value.openSelectPanel(content_replacement_list.value);
        }
        uploadProgress.value = false;
    } catch (error) {
        emitter.emit("openSnackbar", { message: "處理檔案失敗: " + error.message, color: "error" });
        uploadProgress.value = false;
    }
}

// 觸發檔案選擇對話框
function triggerFileUpload() {
    fileInputRef.value.click();
}

// 下載範例檔案
function downloadExampleFile(fileType) {
    const link = document.createElement("a");
    const host = window.location.origin;
    link.href = `${host}/ava/back/example_replace_rule_dict.${fileType}`;
    link.download = `example_replace_rule_dict.${fileType}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const autoUpdata = ref(false);
const datasets_id_ref = ref(datasets_id);
const {
    data: documents,
    error: documentError,
    isLoading: isLoadingDocuments,
    refetch: refetchDocuments,
} = useDocuments(datasets_id_ref, autoUpdata);

async function updateEmbeddingFiles(items) {
    const { item, data } = items;

    // 更新content_replacement_list
    let value = chkJsonValue(item);
    let arrValue = checkIsArray(item);

    if ((value === false || arrValue === false) && item.name !== "is_downloadable") {
        return;
    }

    config_jsonb.value[item.name] = value;

    if (arrValue) {
        config_jsonb.value["tip"] = arrValue;
    }

    update_finish.value = false;
    update_name.value = item.name;
    let rs = await axios.put(
        "/datasets/update",
        JSON.stringify({ datasets_id: datasets_id, config_jsonb: config_jsonb.value })
    );
    update_finish.value = true;
    update_name.value = "";
    if (rs.data.code !== 0) {
        emitter.emit("openSnackbar", { message: "修改失敗", color: "error" });
        return;
    }

    // 更新文件狀態
    if (Array.isArray(data) && data.length > 0) {
        emitter.emit("openSnackbar", { message: "可至文件清單確認狀態", color: "success" });
        const formattedCloseStateData = data.map((item) => ({
            id: item.id,
            state: 4,
        }));

        const closeStateData = { updateData: formattedCloseStateData, datasets_id: datasets_id };
        let closeStateRs = await axios.put("/datasets/documentStatus", JSON.stringify(closeStateData));

        if (closeStateRs.data.code !== 0) {
            emitter.emit("openSnackbar", { message: "檔案更新狀態失敗", color: "error" });
            return;
        }
        const formattedOpenStateData = data.map((item) => ({
            id: item.id,
            state: 2,
        }));

        const openStateData = { updateData: formattedOpenStateData, datasets_id: datasets_id };
        let openStateRs = await axios.put("/datasets/documentStatus", JSON.stringify(openStateData));
        if (openStateRs.data.code !== 0) {
            emitter.emit("openSnackbar", { message: "檔案更新狀態失敗", color: "error" });
            return;
        }
    } else {
        emitter.emit("openSnackbar", { message: "內容替換規則已成功更新", color: "success" });
    }
}
</script>

<template>
    <div class="dataset_configuration_view">
        <div class="section-card" v-if="userPermission">
            <div class="section-header">
                <span class="text-h6 font-weight-medium">embedding_model</span>
                <div class="tooltip-wrapper">
                    <span class="mdi mdi-help-circle text-grey"></span>
                    <v-tooltip activator="parent" location="right">模組: 設定GTP embedding的模組</v-tooltip>
                </div>
            </div>
            <ConfigurationSelect
                v-model="embeddingModelSelect"
                :items="embeddingModelSelects"
                label="選擇模組"
                itemTitle="state"
                itemValue="abbr"
                :disabled="true"
                :loading="!update_finish"
                @update:modelValue="update"
            />
        </div>

        <div class="section-card" v-if="userPermission">
            <div class="section-header">
                <span class="text-h6 font-weight-medium">下載來源檔案</span>
                <div class="tooltip-wrapper">
                    <span class="mdi mdi-help-circle text-grey"></span>
                    <v-tooltip activator="parent" location="right">開啟的話可下載相關來源的檔案</v-tooltip>
                </div>
            </div>
            <ConfigurationSelect
                v-model="downloadSourceFile"
                :items="downloadSourceFileSelect"
                label="選擇開啟或關閉"
                itemTitle="text"
                itemValue="abbr"
                :loading="!update_finish"
                @update:modelValue="update"
            />
        </div>

        <div class="section-card" v-if="userPermission">
            <div class="section-header">
                <span class="text-h6 font-weight-medium">內容替換規則</span>
                <div class="tooltip-wrapper">
                    <span class="mdi mdi-help-circle text-grey"></span>
                    <v-tooltip activator="parent" location="right"
                        >此處進行替換的是chunk內的資訊，並不影響下載文件的內容，主要影響的是送到LLM的chunk會替換的資訊。</v-tooltip
                    >
                </div>
            </div>

            <div class="w-100">
                <InputComponents
                    ref="contentReplacementListRef"
                    :loading="!update_finish || uploadProgress"
                    :data="content_replacement_list"
                    @send="updateEmbeddingFiles"
                    multiline
                    :rows="5"
                    hint='請按照下列格式輸入 : {"您輸入的文字":"取代文字","中鋼":"中鋼集團"} 備註 : 可使用正規表達式。'
                    scope="content_replacement_list"
                    :datasets_id="datasets_id"
                    :documents="documents?.body?.filter((doc) => doc.training_state === 3) || []"
                    :documentError="documentError"
                    :isLoadingDocuments="isLoadingDocuments"
                    :refetchDocuments="refetchDocuments"
                >
                </InputComponents>

                <!-- 檔案上傳按鈕 -->
                <div class="mt-4 file-actions">
                    <v-btn
                        color="secondary"
                        variant="outlined"
                        size="small"
                        prepend-icon="mdi-file-download-outline"
                        @click="downloadExampleFile('csv')"
                    >
                        下載範例 CSV
                        <v-tooltip activator="parent" location="top">下載 CSV 格式的內容替換規則範例檔案</v-tooltip>
                    </v-btn>
                    <v-btn
                        color="secondary"
                        variant="outlined"
                        size="small"
                        prepend-icon="mdi-file-download-outline"
                        @click="downloadExampleFile('xlsx')"
                        class="ml-2"
                    >
                        下載範例 XLSX
                        <v-tooltip activator="parent" location="top">下載 XLSX 格式的內容替換規則範例檔案</v-tooltip>
                    </v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        size="small"
                        prepend-icon="mdi-file-upload-outline"
                        :loading="uploadProgress"
                        :disabled="uploadProgress"
                        @click="triggerFileUpload"
                        class="ml-2"
                    >
                        上傳替換規則表格
                        <v-tooltip activator="parent" location="top"
                            >上傳 CSV 或 XLSX
                            格式的檔案，自動生成內容替換規則。表格格式：第一列為原字符串，其餘列為替換後的字符串。</v-tooltip
                        >
                    </v-btn>
                    <input
                        ref="fileInputRef"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        @change="handleFileUpload"
                        style="display: none"
                    />
                </div>
            </div>
        </div>

        <div class="section-card">
            <div class="section-header">
                <span class="text-h6 font-weight-medium">search_kwargs</span>
                <div class="tooltip-wrapper">
                    <span class="mdi mdi-help-circle text-grey"></span>
                    <v-tooltip activator="parent" location="right"
                        >搜尋關鍵字參數: 用於操作搜尋的參數，k代表GPT一次會得到的chunk數量。</v-tooltip
                    >
                </div>
            </div>
            <InputComponents :loading="!update_finish" :data="search_kwargs" @send="update"></InputComponents>
        </div>

        <div class="section-card" v-if="userPermission">
            <div class="section-header">
                <span class="text-h6 font-weight-medium">排序優先級</span>
                <div class="tooltip-wrapper">
                    <span class="mdi mdi-help-circle text-grey"></span>
                    <v-tooltip activator="parent" location="right">設定排序優先級</v-tooltip>
                </div>
            </div>
            <ConfigurationSelect
                v-model="sortPriority"
                :items="sortPriorityOptions"
                label="選擇排序優先級"
                itemTitle="text"
                itemValue="abbr"
                :loading="!update_finish"
                @update:modelValue="update"
            />
        </div>

        <TipComponent
            :tipData="tip"
            :loading="!update_finish"
            :isEditing="isEditing"
            @update="update"
            @enterEditMode="enterEditMode"
            @exitEditMode="exitEditMode"
        />
    </div>
</template>

<style lang="scss" scoped>
.dataset_configuration_view {
    padding: 2rem;
    background: linear-gradient(to bottom, #ffffff, #f4f7fc);
    height: auto;
    min-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    /* max-width: 1200px; */
    /* margin: 0 auto; */

    h1 {
        color: #3a4173;
        margin-bottom: 1.5rem;
        position: relative;
        padding-bottom: 0.5rem;

        &:after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 60px;
            height: 3px;
            background: linear-gradient(to right, #6576db, #a7b3f3);
            border-radius: 3px;
        }
    }

    .section-card {
        padding: 1.25rem;
        width: 100%;
        min-width: 400px;
        max-width: 1000px;
        margin-bottom: 1.75rem;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
        overflow: visible;

        &:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .section-header {
            display: flex;
            align-items: center;
            margin-bottom: 1.25rem;

            .text-h6 {
                color: #3a4173;
                font-weight: 500;
                margin-right: 8px;
            }

            .tooltip-wrapper {
                display: inline-flex;
                align-items: center;
                position: relative;

                .mdi-help-circle {
                    opacity: 0.7;
                    transition: opacity 0.2s;
                    font-size: 1.1rem;
                    cursor: pointer;

                    &:hover {
                        opacity: 1;
                    }
                }
            }
        }

        .v-select {
            background-color: #f8fafc;
            border-radius: 10px;
            margin-top: 4px;
            position: relative;

            &:after {
                content: "";
                position: absolute;
                left: -4px;
                top: -4px;
                right: -4px;
                bottom: -4px;
                border-radius: 12px;
                z-index: -1;
                background: linear-gradient(to right, rgba(101, 118, 219, 0.1), rgba(167, 179, 243, 0.1));
                opacity: 0;
                transition: opacity 0.3s;
            }

            &:hover:after {
                opacity: 1;
            }
        }
    }
}

.file-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .v-btn {
        transition: all 0.2s ease;

        &:hover {
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        &.primary {
            background: linear-gradient(to right, #6576db, #7a89e8);

            &:hover {
                background: linear-gradient(to right, #5465c5, #6576db);
            }
        }
    }

    @media (max-width: 768px) {
        flex-direction: column;

        .v-btn {
            margin-left: 0 !important;
            margin-top: 8px;
        }
    }
}

// Vuetify 全域樣式覆蓋
:deep(.v-field__input) {
    color: rgba(0, 0, 0, 0.87);
    font-size: 0.95rem;
}

:deep(.v-label) {
    color: rgba(0, 0, 0, 0.6);
    font-size: 0.95rem;
    font-weight: 500;
}

:deep(.v-field--focused .v-label) {
    color: #6576db;
}

:deep(.v-field--focused .v-field__outline) {
    color: #6576db;
}

:deep(.v-field) {
    border-radius: 8px;
    transition: all 0.3s ease;
}

:deep(.v-btn--variant-flat) {
    background: linear-gradient(to right, #6576db, #7a89e8);
    color: white;
    transition: all 0.2s;

    &:hover {
        background: linear-gradient(to right, #5465c5, #6576db);

        box-shadow: 0 4px 8px rgba(101, 118, 219, 0.2);
    }
}

:deep(.v-tooltip__content) {
    background-color: #3a4173;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.875rem;
    max-width: 300px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
