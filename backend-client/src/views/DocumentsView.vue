<script setup>
import { ref, toRefs, onMounted, inject, onUnmounted, watch, computed, toRaw } from "vue";
import FilePreview from "@/components/datasets/FilePreview.vue";
import FileComponents from "../components/FileComponents.vue";
import SwitchComponents from "../components/SwitchComponents.vue";
import ConfirmComponents from "../components/ConfirmComponents.vue";
import FormComponents from "../components/FormComponents.vue";
import FileChunksDetail from "@/components/datasets/FileChunksDetail.vue";
import FileDataSourceDetails from "@/components/datasets/FileDataSourceDetails.vue";
import ColumnSettings from "@/components/common/ColumnSettings.vue";
import { useQuery } from "@tanstack/vue-query";
import { usePermissionChecker } from "@/composables";
import { SUPPORTED_EXTENSIONS } from "@/utils/common";
import { format } from "date-fns";
import { useRouter, useRoute } from "vue-router";
import { useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { useDocuments } from "@/composables/useDocuments";

const downloadHost = import.meta.env.VITE_BACKEND_HOST + "/download/";
const downloadZipHost = import.meta.env.VITE_BACKEND_HOST + "/downloadzip/";
const router = useRouter();
const route = useRoute();
const emitter = inject("emitter");
const axios = inject("axios");
const search = ref("");
const page = ref(1);
const limit = ref(10);

const stateStore = useStateStore();
const { datasetsName, datasetsDescribe } = storeToRefs(stateStore);

const { canPerformAction: canUploadDocument } = usePermissionChecker("allowedToUploadDocument");
const props = defineProps({
    datasets_id: { type: String, default: {} },
});
const { datasets_id } = toRefs(props);

const autoUpdata = ref(true);
const enableContentReplacement = ref(true);
const tableData = ref({
    header: [
        { title: "文件名", sort: { field: "originalname", orderBy: "asc" } },
        { title: "上傳時間", sort: { field: "create_time", orderBy: "asc" } },
        { title: "更新時間", sort: { field: "update_time", orderBy: "asc" } },
        { title: "過期時間", sort: { field: "expiration_time", orderBy: "asc" } },
        { title: "切分符號", sort: { field: "separator", orderBy: "asc" } },
        { title: "狀態", sort: { field: "training_state", orderBy: "asc" } },
        { title: "啟用" },
    ],
    body: [],
});

const visibleColumns = useLocalStorage(
    "showDatasetTableColumn",
    tableData.value.header.map((_, index) => index)
);

const handleColumnChange = (columns) => {
    visibleColumns.value = columns;
};

onMounted(async () => {
    // 從 URL 讀取初始的 limit 和 page
    const urlLimit = Number(route.query.limit);
    const urlPage = Number(route.query.page);

    if (urlLimit && urlLimit > 0) limit.value = urlLimit;
    if (urlPage && urlPage > 0) page.value = urlPage;
});

let sortInfo = "";

const currentSort = ref({ field: null, orderBy: null });
const header = ref([
    { title: "文件名", sort: { field: "originalname", orderBy: "asc" } },
    { title: "上傳時間", sort: { field: "create_time", orderBy: "asc" } },
    { title: "更新時間", sort: { field: "update_time", orderBy: "asc" } },

    { title: "過期時間", sort: { field: "expiration_time", orderBy: "asc" } },

    { title: "切分符號", sort: { field: "separator", orderBy: "asc" } },
    { title: "狀態", sort: { field: "training_state", orderBy: "asc" } },
    { title: "啟用" },
]);
const pages = ref("");

const searchBody = ref([]);

// 新的過濾選項
const filterOption = ref("UserUpload");

const filterOptions = [
    { value: "all", label: "全部顯示" },
    { value: "UserUpload", label: "使用者上傳" },
    { value: "FormUpload", label: "表單產生" },
    { value: "FormBoundDocument", label: "被綁定表單的文件" },
    { value: "UnboundDocument", label: "未被綁定表單的文件" },
];

const tableBody = ref([]);
function initPages() {
    //初始化分頁
    let end = limit.value * page.value;
    let start = end - limit.value;
    pages.value = Math.ceil(tableData.value.body.length / limit.value);
    tableBody.value = tableData.value.body.filter((_, i) => i >= start && i < end);
}
const options = ref([
    { title: "10", value: 10 },
    { title: "25", value: 25 },
    { title: "50", value: 50 },
    { title: "100", value: 100 },
]);

const { data, error, isLoading, refetch } = useDocuments(datasets_id, autoUpdata);

function sort(sort, preserveOrder = false) {
    if (!preserveOrder) {
        sort.orderBy = sort.orderBy === "asc" ? "desc" : "asc";
    }
    currentSort.value = { ...sort };

    sortInfo = sort;
    if (sort.orderBy === "asc") {
        tableData.value.body = tableData.value.body.sort((a, b) => {
            if (a[sort.field] > b[sort.field]) return 1;
            if (a[sort.field] < b[sort.field]) return -1;
        });
    } else if (sort.orderBy === "desc") {
        tableData.value.body = tableData.value.body.sort((a, b) => {
            if (a[sort.field] > b[sort.field]) return -1;
            if (a[sort.field] < b[sort.field]) return 1;
        });
    }
    initPages();
}

watch(search, (newV) => {
    searchBody.value = tableData.value.body.filter((f) => f.originalname.indexOf(newV) !== -1);
});

const updateData = ref([]);
const delData = ref([]);
const switch_com = ref(null);
async function handleSwitch(data, item) {
    // data.datasets_id = datasets_id.value;
    let index = updateData.value.findIndex((f) => f.id === data.id);
    if (index !== -1) {
        updateData.value.splice(index, 1);
        item.isUpdate = false;
    } else {
        updateData.value.push({ id: data.id, state: data.state ? 2 : 4 });
        item.isUpdate = true;
    }
    // data.state = !data.state;
    // let rs = await axios.put("/datasets/documentEnable", JSON.stringify(data));
    // if (rs.data.code === 0) {
    //     switch_com.value[data.index].change();
    // }
}
function handleLink(documentt_id) {
    router.push(`/datasets/${datasets_id.value}/documents/${documentt_id}`);
}

const delBtn = ref([
    { title: "刪除", icon: "mdi mdi-delete", func: (item) => delDocument(item, true) },
    { title: "取消", icon: "mdi mdi-delete", func: (item) => delDocument(item, false) },
]);
async function delDocument(item, isDelete) {
    item.isDelete = isDelete;
    setTimeout(() => {
        item.showDel = isDelete;
    }, 500);
    if (!isDelete) {
        const index = delData.value.findIndex((f) => f.id === item.id);
        delData.value.splice(index, 1);
    } else {
        delData.value.push({ id: item.id, state: isDelete ? 5 : 1 });
    }
    // let rs = await axios.delete(`/datasets/documents/${item.id}/${datasets_id.value}`);
    // if (rs.data.code === 0) {
    //     tableData.value.body = tableData.value.body.filter((f) => f.id !== item.id);
    // }
}

const actions = ref([
    { title: "全部刪除", icon: "mdi mdi-delete", class: "text-red", click: confirmDelOpen },
    { title: "全部下載", icon: "mdi mdi-download", class: "", click: confirmDownloadOpen },
]);
const confirm_del_com = ref(null);
function confirmDelOpen() {
    if (tableData.value.body.length !== 0) {
        confirm_del_com.value.open();
    }
}
function allDel() {
    delData.value = tableData.value.body
        .filter((item) => item.training_state !== 2 || item.training_state !== 7)
        .map((m) => {
            return {
                id: m.id,
                state: 5,
            };
        });

    if (delData.value.length !== 0) {
        save();
    }
}

const confirm_download_com = ref(null);
function confirmDownloadOpen() {
    confirm_download_com.value.open();
}
async function allDownload() {
    console.log("開始下載全部");
    const filenames = tableData.value.body.map((m) => m.filename);
    let rs = await axios.post("/downloadzip", JSON.stringify({ filenames: filenames }));
    const filename = rs.data.data.filename;
    const a = document.createElement("a");
    a.href = downloadZipHost + filename + `?zip_name=${props.datasets_id}`;
    a.click();
}

const form_bind_ref = ref(null);
async function confirmBindingOpen(item) {
    let document_id = item.id;
    let dataset_id = datasets_id.value;
    let title = "選擇要綁定的表單";
    let placeholder = "";

    let rs = await axios.get("/form/form");

    let rs1 = await axios.post("/form/getBindingAssociationForm", JSON.stringify({ document_id }));
    if (rs1.data.code === 0) {
        forms.value = rs1.data.data.map((m) => {
            return {
                form_id: m.form_id, // 確保取得 form_id
                document_id: document_id, // 新增 document_id
                dataset_id: dataset_id, // 新增 dataset_id
                name: m.form_name,
            };
        });
    }
    if (rs.data.code === 0) {
        let option = rs.data.data.map((m) => {
            return {
                show: m.form_name,
                value: m.id,
            };
        });

        let data = [{ type: "select", name: "form_id", required: true, placeholder: "綁定表單", option }];
        form_bind_ref.value.setFormData({ document_id, dataset_id });
        form_bind_ref.value.open({ title, placeholder, data });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

async function unbindFormDoc(index) {
    let form = forms.value[index];
    let rs = await axios.post(
        "/form/unbindFormDoc",
        JSON.stringify({
            document_id: form.document_id,
            datasets_id: form.dataset_id,
            form_id: form.form_id,
        })
    );
    if (rs.data.code === 0) {
        let rs1 = await axios.post(
            "/form/getBindingAssociationForm",
            JSON.stringify({ document_id: form.document_id })
        );
        if (rs1.data.code === 0) {
            forms.value = rs1.data.data.map((m) => {
                return {
                    form_id: m.form_id,
                    document_id: form.document_id,
                    dataset_id: form.dataset_id,
                    name: m.form_name,
                };
            });
        }
        emitter.emit("openSnackbar", { message: "刪除成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

async function bindingForm(data) {
    console.log("data: ", data);
    let rs = await axios.post(
        "/form/bindFormDoc",
        JSON.stringify({
            form_id: data.form_id,
            datasets_id: data.dataset_id,
            document_id: data.document_id,
        })
    );
    form_bind_ref.value.close();
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

async function save() {
    const data = updateData.value.concat(delData.value);
    const saveData = { updateData: data, datasets_id: datasets_id.value };
    updateData.value = [];
    delData.value = [];
    let rs = await axios.put("/datasets/documentStatus", JSON.stringify(saveData));
    if (rs.data.code === 0) {
        refetch();
        emitter.emit("openSnackbar", { message: "成功執行", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: "執行失敗", color: "error" });
    }
}
function goAddSource() {
    router.push(`/datasets/${props.datasets_id}/source?active=0`);
}

const forms = ref([]);

// Computed property for filtered data
const filteredData = computed(() => {
    let filtered = tableData.value.body;

    // 應用搜索過濾
    if (search.value) {
        filtered = filtered.filter((item) => item.originalname.toLowerCase().includes(search.value.toLowerCase()));
    }

    // 應用分類過濾
    // "UserUpload": 用戶上傳的文件。
    // "FormUpload": 表單上傳的文件。
    // "FormBoundDocument": 被綁定表單的文件。
    // "UnboundDocument": 未被綁定表單的文件。
    switch (filterOption.value) {
        case "UserUpload":
            filtered = filtered.filter((item) => item.upload_type === "UserUpload");
            break;
        case "FormUpload":
            filtered = filtered.filter((item) => item.upload_type === "FormUpload");
            break;
        case "FormBoundDocument":
            filtered = filtered.filter((item) => item.file_status === "FormBoundDocument");
            break;
        case "UnboundDocument":
            filtered = filtered.filter((item) => item.file_status === "UnboundDocument");
            break;
    }

    return filtered;
});
// 修改 paginatedData 計算屬性
const paginatedData = computed(() => {
    const start = (page.value - 1) * limit.value;
    const end = start + limit.value;
    return filteredData.value.slice(start, end);
});

// 修改 totalPages 計算屬性
const totalPages = computed(() => {
    return Math.ceil(filteredData.value.length / limit.value);
});

// 監聽 search 變化
watch(search, () => {
    page.value = 1;
    updateRoute();
});

// 監聽 limit 變化
watch(limit, () => {
    page.value = 1;
    updateRoute();
});

watch(
    () => data.value,
    (newData) => {
        if (newData) {
            const copiedData = JSON.parse(JSON.stringify(toRaw(newData)));
            tableData.value = {
                header: tableData.value.header,
                body: copiedData.body,
            };
            datasetsDescribe.value = copiedData.describe;
            datasetsName.value = copiedData.name;
            if (currentSort.value.field) {
                sort(currentSort.value, true);
            }
        }
    },
    { immediate: true }
);

function changePage(newPage) {
    if (newPage < 1 || newPage > totalPages.value) return;
    page.value = newPage;
    updateRoute();
}
function updateRoute() {
    router.push({
        path: route.path,
        query: { ...route.query, limit: limit.value, page: page.value },
    });
}

// 開啟外部連結
const openExternalLink = (url) => {
    emitter.emit("openUrl", url);
};

// todo: 改成 tanstack 後 invalidate 就好了
const handleDocumentUpdate = async () => {
    refetch();
};

const fileExtension = (filename, type = "all") => {
    const extension = filename.split(".").pop().toLowerCase();

    if (type === "all") {
        const allExtensions = Object.values(SUPPORTED_EXTENSIONS).flat();
        return allExtensions.includes(extension);
    }

    return SUPPORTED_EXTENSIONS[type]?.includes(extension) || false;
};

const isPDF = (filename) => {
    if (filename.endsWith(".pdf")) {
        return true;
    }
    return false;
};

function copyToClipboard(text) {
    navigator.clipboard
        .writeText(text)
        .then(() => {
            emitter.emit("openSnackbar", { message: "ID 已複製到剪貼簿", color: "success" });
        })
        .catch((err) => {
            emitter.emit("openSnackbar", { message: "複製失敗", color: "error" });
        });
}

// 切換內容替換設置狀態
async function toggleEnableContentReplacement() {
    try {
        const result = await axios.put(
            "/datasets/enableContentReplacement",
            JSON.stringify({
                datasets_id: datasets_id.value,
                enable_content_replacement_list: !enableContentReplacement.value,
            })
        );

        if (result.data.code === 0) {
            enableContentReplacement.value = result.data.data.enable_content_replacement_list;
            emitter.emit("openSnackbar", {
                message: enableContentReplacement.value ? "已啟用字典替換文字" : "已停用字典替換文字",
                color: "success",
            });
        } else {
            emitter.emit("openSnackbar", {
                message: "更新設置失敗",
                color: "error",
            });
        }
    } catch (error) {
        console.error("切換內容替換狀態失敗", error);
        emitter.emit("openSnackbar", {
            message: "切換內容替換狀態失敗: " + (error.message || "未知錯誤"),
            color: "error",
        });
    }
}
</script>

<template>
    <div class="table_com">
        <div class="title">
            <p>文件</p>

            <span>知識庫的所有文件都在這裡顯示，整個知識庫都可以鏈接到Ava引用獲通過Chat外掛進行索引</span>
        </div>
        <div class="search_addFile">
            <v-btn v-if="canUploadDocument" prepend-icon="fa-solid fa-plus" class="bg-blue" @click="goAddSource"
                >新增文件</v-btn
            >
            <div class="d-flex align-center">
                <div class="mr-4 d-flex align-center">
                    <span class="mark markFormUpload"></span>
                    <span class="ml-1 text-overline">表單產生</span>
                </div>
                <div class="mr-4 d-flex align-center">
                    <span class="mark mark1"></span>
                    <span class="ml-1 text-overline">刪除</span>
                </div>
                <div class="mr-4 d-flex align-center">
                    <span class="mark mark2"></span>
                    <span class="ml-1 text-overline">啟用/禁用</span>
                </div>

                <div class="mr-4 d-flex align-center">
                    <v-switch hide-details color="primary" v-model="autoUpdata"> </v-switch>
                    <div class="mt-1 ml-1">
                        <span class="text-overline">自動更新狀態</span>
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="top">開啟後，每三秒會自動更新檔案狀態</v-tooltip>
                    </div>
                </div>

                <!-- 新增字典替換按鈕 -->
                <div class="mr-4 d-flex align-center">
                    <v-switch
                        v-model="enableContentReplacement"
                        color="primary"
                        hide-details
                        @change="toggleEnableContentReplacement"
                    ></v-switch>
                    <div class="mt-1 ml-1">
                        <span class="text-overline">根據字典替換文字</span>
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="top"
                            >啟用後，新上傳的文件將根據設定的內容替換規則進行文字替換</v-tooltip
                        >
                    </div>
                </div>

                <v-btn
                    @click="save"
                    prepend-icon="mdi-content-save-outline"
                    class="ml-4 bg-blue"
                    :disabled="!updateData.length && !delData.length"
                    >儲存</v-btn
                >
            </div>
        </div>
        <div class="justify-end my-2 d-flex">
            <!-- <v-btn prepend-icon="mdi mdi-refresh" color="blue" @click="retrain">重新訓練尚未成功的</v-btn> -->
            <!-- <v-btn prepend-icon="mdi mdi-delete" color="red-darken-2" @click="allDel">{{ btnDelText }}</v-btn> -->
        </div>

        <v-card class="mb-4" v-if="tableData.body?.length > 0">
            <v-card-text>
                <div class="flex-wrap d-flex align-center justify-space-between">
                    <div class="mb-2 d-flex align-center me-4">
                        <span class="me-2">每頁數量:</span>
                        <v-select
                            v-model="limit"
                            :items="options"
                            item-title="title"
                            item-value="value"
                            hide-details
                            density="compact"
                            style="width: 100px"
                        ></v-select>
                    </div>
                    <div class="mb-2 d-flex align-center me-4">
                        <span class="me-2">搜尋:</span>
                        <v-text-field
                            v-model="search"
                            hide-details
                            density="compact"
                            style="width: 200px"
                        ></v-text-field>
                    </div>
                    <div class="mb-2 d-flex align-center">
                        <span class="me-2">過濾:</span>
                        <v-select
                            v-model="filterOption"
                            :items="filterOptions"
                            item-title="label"
                            item-value="value"
                            hide-details
                            density="compact"
                            style="width: 200px"
                        ></v-select>
                    </div>

                    <div class="d-flex align-center">
                        <!-- 其他功能按鈕 -->
                        <ColumnSettings
                            v-model="visibleColumns"
                            :headers="tableData.header"
                            @change="handleColumnChange"
                        />
                    </div>
                </div>
            </v-card-text>
        </v-card>
        <!-- datatable -->

        <!-- 表格區域 -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th
                            v-for="(item, index) in tableData.header"
                            :key="index"
                            v-show="visibleColumns.includes(index)"
                        >
                            <div v-if="item.sort" class="sort" @click="sort(item.sort)">
                                <span>{{ item.title }}</span>
                                <span
                                    :class="{
                                        'mdi mdi-chevron-down': item.sort.orderBy == 'asc',
                                        'mdi mdi-chevron-up': item.sort.orderBy == 'desc',
                                    }"
                                ></span>
                            </div>
                            <span v-else>{{ item.title }}</span>
                        </th>
                        <th>
                            <p>操作</p>
                            <v-menu>
                                <template v-slot:activator="{ props }">
                                    <span v-bind="props" class="action mdi mdi-dots-vertical"></span>
                                </template>
                                <v-list>
                                    <v-list-item
                                        v-for="(item, index) in actions"
                                        :key="index"
                                        :value="index"
                                        :class="item.class"
                                        @click="item.click"
                                    >
                                        <div class="d-flex align-center">
                                            <v-icon :icon="item.icon"></v-icon>
                                            <span class="ml-1">{{ item.title }}</span>
                                        </div>
                                    </v-list-item>
                                </v-list>
                            </v-menu>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <div
                        class="justify-center py-3 w-100 d-flex"
                        style="background-color: #dddddd"
                        v-if="tableData.body?.length === 0"
                    >
                        <p>查無資料</p>
                    </div>

                    <tr
                        v-for="(item, index) in paginatedData"
                        :key="item.id"
                        :class="{
                            update: item.isUpdate,
                            del: item.isDelete,
                            'form-upload':
                                item.upload_type === 'FormUpload' || item.file_status === 'FormBoundDocument',
                        }"
                    >
                        <td style="cursor: pointer" @click="copyToClipboard(item.id)">
                            <v-tooltip location="top" :text="`ID: ${item.id}`">
                                <template v-slot:activator="{ props }">
                                    <span v-bind="props">{{ index + 1 }}</span>
                                </template>
                            </v-tooltip>
                        </td>

                        <!-- 檔案名稱欄位 -->
                        <td v-show="visibleColumns.includes(0)" class="file-name-box">
                            <div>
                                <a class="file-name" @click.stop="openExternalLink(downloadHost + item.filename)">
                                    <FileComponents :filename="item.originalname"></FileComponents>
                                    <v-tooltip
                                        activator="parent"
                                        location="top"
                                        v-if="item.originalname || item.datasource_name || item.datasource_url"
                                    >
                                        <span v-if="item.originalname">檔案名稱: {{ item.originalname }}</span>
                                        <br v-if="item.datasource_name" />
                                        <span v-if="item.datasource_name"
                                            >來源顯示名稱: {{ item.datasource_name }}</span
                                        >
                                        <br v-if="item.datasource_url" />
                                        <span v-if="item.datasource_url">來源連結: {{ item.datasource_url }}</span>
                                    </v-tooltip>
                                </a>
                            </div>
                            <div class="icon-btn">
                                <a
                                    :href="downloadHost + item.filename + '?preview=true'"
                                    target="_blank"
                                    v-if="isPDF(item.filename)"
                                >
                                    <i class="fa-solid fa-eye icon-hover"></i>
                                    <v-tooltip activator="parent" location="top">
                                        預覽 {{ item.originalname }}
                                    </v-tooltip>
                                </a>

                                <FilePreview
                                    :fileInfo="item"
                                    :downloadHost="downloadHost"
                                    v-if="fileExtension(item.filename)"
                                    @downloadFile="openExternalLink"
                                />

                                <FileChunksDetail :fileInfo="item"></FileChunksDetail>
                                <FileDataSourceDetails
                                    @update:documentFile="handleDocumentUpdate"
                                    :fileInfo="item"
                                    :datasets_id="datasets_id"
                                ></FileDataSourceDetails>
                                <button @click="confirmBindingOpen(item)">
                                    <i class="fa-brands fa-wpforms icon-hover"></i>
                                    <v-tooltip activator="parent" location="top">顯示已綁定表單</v-tooltip>
                                </button>
                            </div>
                        </td>

                        <!-- 上傳時間欄位 -->
                        <td v-show="visibleColumns.includes(1)">
                            <v-tooltip
                                location="top"
                                :text="
                                    item.created_by_name || item.created_by
                                        ? `建立者：${item.created_by_name || item.created_by}`
                                        : ''
                                "
                            >
                                <template v-slot:activator="{ props }">
                                    <span v-bind="props">
                                        {{ format(new Date(item.create_time), "yyyy-MM-dd HH:mm:ss") }}
                                    </span>
                                </template>
                            </v-tooltip>
                        </td>

                        <!-- 更新時間欄位 -->
                        <td v-show="visibleColumns.includes(2)">
                            <v-tooltip
                                location="top"
                                :text="`更新者：${item.updated_by_name || item.updated_by}`"
                                :disabled="!(item.updated_by_name || item.updated_by)"
                            >
                                <template v-slot:activator="{ props }">
                                    <span v-bind="props">
                                        {{ format(new Date(item.update_time), "yyyy-MM-dd HH:mm:ss") }}
                                    </span>
                                </template>
                            </v-tooltip>
                        </td>

                        <!-- 過期時間欄位 -->
                        <td v-show="visibleColumns.includes(3)">
                            {{
                                item.expiration_time
                                    ? format(new Date(item.expiration_time), "yyyy-MM-dd HH:mm:ss")
                                    : "未設定"
                            }}
                        </td>

                        <!-- 切分符號欄位 -->
                        <td v-show="visibleColumns.includes(4)">
                            {{ item.separator ? item.separator : "系統預設" }}
                        </td>

                        <!-- 狀態欄位 -->
                        <td v-show="visibleColumns.includes(5)" data-cy="training-state">
                            {{ item.training_state_str }}
                        </td>

                        <!-- 啟用欄位 -->
                        <td v-show="visibleColumns.includes(6)">
                            <div v-if="item.upload_type !== 'FormUpload'">
                                <SwitchComponents
                                    ref="switch_com"
                                    :state="item.training_state === 3 ? true : false"
                                    :id="item.id"
                                    :disabled="item.training_state !== 3 && item.training_state !== 4 ? true : false"
                                    @change="handleSwitch($event, item)"
                                ></SwitchComponents>
                            </div>
                        </td>

                        <!-- 操作欄位 -->
                        <td>
                            <div v-if="item.upload_type !== 'FormUpload'">
                                <v-btn
                                    class="w-100"
                                    color="red"
                                    prepend-icon="mdi-delete"
                                    variant="text"
                                    :disabled="item.training_state === 2 || item.training_state === 7"
                                    @click="delBtn[!item.isDelete ? 0 : 1].func(item)"
                                >
                                    {{ delBtn[!item.isDelete ? 0 : 1].title }}
                                </v-btn>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pages" v-if="paginatedData.length > 0 && totalPages > 1">
            <span class="pages_btn" @click="changePage(1)"><i class="fa-solid fa-angles-left"></i></span>
            <span class="mr-3 pages_btn" @click="changePage(page - 1)"><i class="fa-solid fa-angle-left"></i></span>
            <span v-if="page > 3" class="mx-1 mark3"><i class="fa-solid fa-ellipsis"></i></span>
            <template v-for="p in totalPages" :key="p">
                <p
                    v-if="p < page + 3 && p > page - 3"
                    class="pages_btn"
                    :class="{ active_btn: page === p }"
                    @click="changePage(p)"
                >
                    {{ p }}
                </p>
            </template>
            <span v-if="page < totalPages - 2" class="mx-1 mark3"><i class="fa-solid fa-ellipsis"></i></span>
            <span class="ml-3 pages_btn" @click="changePage(page + 1)"><i class="fa-solid fa-angle-right"></i></span>
            <span class="pages_btn" @click="changePage(totalPages)"><i class="fa-solid fa-angles-right"></i></span>
        </div>
        <ConfirmComponents
            ref="confirm_del_com"
            type="delete"
            message="此操作不可復原,確認要刪除全部文件嗎?(包括表單文件)"
            :confirmBtn="true"
            @confirm="allDel"
            saveBtnName="刪除"
            closeBtnName="取消"
        ></ConfirmComponents>
        <ConfirmComponents
            ref="confirm_download_com"
            type="info"
            message="確認要下載全部嗎?"
            :confirmBtn="true"
            @confirm="allDownload"
            saveBtnName="確認"
            closeBtnName="取消"
        ></ConfirmComponents>
        <FormComponents ref="form_bind_ref" @send="bindingForm">
            <template v-slot:bottom>
                <div>已綁定表單:</div>
                <v-list class="w-100">
                    <v-list-item v-for="(form, index) in forms" :key="index" style="padding: 0">
                        <v-row>
                            <v-col class="d-flex align-center">
                                <v-btn class="mr-2" color="red" size="small" @click="unbindFormDoc(index, form)"
                                    >取消綁定</v-btn
                                >
                                <span>{{ form.name }}</span>
                            </v-col>
                        </v-row>
                    </v-list-item>
                </v-list>
            </template>
        </FormComponents>
    </div>
</template>

<style lang="scss" scoped>
$color1: rgb(247, 207, 207);
$color2: rgb(243, 208, 162);
$color3: #2196f3;
$formUploadColor: #e8f5e9;

.mark3 {
    color: $color3;
}

.pages {
    position: fixed;
    width: calc(100% - 300px);
    bottom: 0;
    /* left: 0; */
    right: 0;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 1rem;
    background-color: #fff; /* Adds a background to the pagination */
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1); /* Adds a subtle shadow for separation */

    .pages_btn {
        background-color: white;
        border: 1px solid #2196f3;
        color: #2196f3;
        border-radius: 0.2rem;
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        margin: 0 0.1rem;

        &:hover {
            background-color: #ebf5ff;
        }
    }

    .active_btn {
        background-color: #2196f3;
        color: white;

        &:hover {
            background-color: #2196f3;
        }
    }
}

.table_com {
    padding: 1.5rem;
    padding-bottom: 65px;

    .title {
        margin-bottom: 1rem;

        p {
            font-size: 1.3rem;
            margin-bottom: 1rem;
        }

        span {
            font-size: 0.9rem;
            color: #777777;
        }
    }

    .search_addFile {
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
        // margin-bottom: 1.5rem;

        .search {
            display: flex;
            align-items: center;

            input {
                padding: 0.5rem 0;
                height: 2rem;
                padding-left: 1.6rem;
                border-radius: 0.3rem;
                border: none;
                background-color: #f3f4f6;
            }

            .icon {
                position: absolute;
                padding: 0 0.5rem;
                font-size: 0.8rem;
                color: #666666;
            }
        }

        .addFile {
            background-color: #2196f3;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            font-size: 0.9rem;
            cursor: pointer;

            &:hover {
                opacity: 0.8;
            }

            span {
                margin-right: 0.5rem;
            }
        }

        .mark {
            display: block;
            border-radius: 50%;
            width: 1rem;
            height: 1rem;
        }

        .mark1 {
            background-color: $color1;
        }

        .mark2 {
            background-color: $color2;
        }
        .markFormUpload {
            background-color: $formUploadColor;
        }
    }

    .select {
        position: relative;
        display: inline-block;

        select {
            border: 1px solid gray;
            border-radius: 0.3rem;
            padding: 0.3rem;
            padding-right: 2rem;
        }

        span {
            position: absolute;
            right: 0.5rem;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
        }
    }

    .filter {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;

        input {
            border: 1px solid gray;
            border-radius: 0.3rem;
            padding: 0.3rem 0.5rem;
        }

        .limit {
            input {
                width: 5rem;
            }
        }

        .search {
            input {
            }
        }
    }

    table {
        width: 100%;

        tbody {
            tr {
                position: relative;
                &:hover {
                    background-color: #ebf5ff;
                }
            }

            .update {
                background-color: $color2;
                &:hover {
                    background-color: $color2;
                }
            }

            .form-upload {
                background-color: $formUploadColor;
                &:hover {
                    background-color: $formUploadColor;
                }
            }

            .del {
                background-color: $color1;
                &:hover {
                    background-color: $color1;
                }

                &::after {
                    content: "";
                    position: absolute;
                    width: 65%;
                    height: 1px;
                    top: 50%;
                    left: 4rem;
                    background-color: gray;
                }
            }
        }

        tr {
            display: flex;
            border-bottom: 1px solid #e5e7eb;
            min-height: 48px;
            width: 100%; // 確保每行佔滿容器寬度

            th,
            td {
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                padding: 0.5rem;
                overflow: hidden;

                // 修改為使用 flex-grow 和 flex-basis 來實現自適應
                &:nth-child(1) {
                    flex: 0 0 50px;
                }
                &:nth-child(2) {
                    flex: 0 1 400px;
                    min-width: 200px; // 設定最小寬度
                }
                &:nth-child(3),
                &:nth-child(4),
                &:nth-child(5) {
                    flex: 2 0 100px; // 時間相關欄位
                }
                &:nth-child(6),
                &:nth-child(7),
                &:nth-child(8) {
                    flex: 1 0 90px; // 狀態和啟用
                }
                &:nth-child(9) {
                    flex: 1 0 100px; // 操作固定寬度
                }

                // 隱藏時完全不占用空間
                &[style*="display: none"] {
                    flex: 0 0 0px !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }
            }
        }

        thead {
            tr {
                background-color: #f9fafb;
                th {
                    font-weight: 500;
                    color: #666666;

                    .sort {
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }

                    .action {
                        cursor: pointer;
                        margin-right: auto;
                    }
                }
            }
        }
    }
}

:deep(.v-list.operator-list) {
    padding: 4px;
}

:deep(.v-list.operator-list .v-list-item) {
    padding: 4px;
}

.icon-hover:hover {
    color: $color3;
}

.file-name-box {
    display: flex !important;
    align-items: center !important;
    gap: 8px;
    width: 100%;

    > div:first-child {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    .file-name {
        display: block;
        width: 100%;
        overflow: hidden;
    }

    .icon-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
        margin-left: 8px;
    }
}

// 當欄位被隱藏時的處理
[v-show="false"] {
    display: none !important;
    width: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
}

// 只有這裡先特別設定 因為這裡的按鈕高度與其他按鈕不同
:deep(.column-settings-trigger) {
    margin-top: -7px;
    height: 40px; // 明確設定高度
}
</style>
