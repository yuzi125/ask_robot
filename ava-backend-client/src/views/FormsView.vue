<script setup>
import { ref, onMounted, inject, computed, watch, nextTick } from "vue";

import FormComponents from "../components/FormComponents.vue";
import ConfirmComponents from "@/components/ConfirmComponents.vue";
import GroupedFileSelector from "@/components/forms/GroupedFileSelector.vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

import { useStateStore } from "../store/index";
const stateStore = useStateStore();
import { storeToRefs } from "pinia";
const { datasetsIcon, formIcon } = storeToRefs(stateStore);

const axios = inject("axios");
const emitter = inject("emitter");

// 設定每行顯示的卡片數量 (響應式)
const cardsPerRow = ref(4); // 預設值，會根據螢幕寬度自動調整
const ROW_HEIGHT = 220; // 每行高度
const searchQuery = ref("");
const isLoading = ref(true);
const isError = ref(false);
const error = ref(null);

onMounted(() => {
    getForms();
    getPresetFormConfig();
    updateCardsPerRow(); // 初始化時計算
    window.addEventListener("resize", updateVirtualizer);
});

const formCards = ref([]);
const formInfo = ref();

async function getForms() {
    try {
        isLoading.value = true;
        const rs = await axios.get("/form/form");
        if (rs.data.code === 0) {
            formCards.value = rs.data.data;
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
            isError.value = true;
            error.value = new Error(rs.data.message);
        }
    } catch (err) {
        isError.value = true;
        error.value = err;
        emitter.emit("openSnackbar", { message: err.message, color: "error" });
    } finally {
        isLoading.value = false;
    }
}

// 虛擬滾動相關
const scrollContainerRef = ref(null);

// 自動調整每行顯示的卡片數量
const updateCardsPerRow = () => {
    const containerWidth = scrollContainerRef.value?.clientWidth || window.innerWidth;

    // 根據容器寬度動態調整每行卡片數量
    if (containerWidth > 1800) {
        cardsPerRow.value = 6; // 大螢幕顯示6個
    } else if (containerWidth > 1500) {
        cardsPerRow.value = 5; // 中等大螢幕顯示5個
    } else if (containerWidth > 1200) {
        cardsPerRow.value = 4; // 標準螢幕顯示4個
    } else if (containerWidth > 900) {
        cardsPerRow.value = 3; // 小螢幕顯示3個
    } else if (containerWidth > 600) {
        cardsPerRow.value = 2; // 平板顯示2個
    } else {
        cardsPerRow.value = 1; // 手機顯示1個
    }
};

// 根據搜尋過濾數據
const filteredForms = computed(() => {
    if (!formCards.value || formCards.value.length === 0) return [];

    if (!searchQuery.value.trim()) {
        return formCards.value;
    }

    const query = searchQuery.value.toLowerCase();
    return formCards.value.filter(
        (form) => form.form_name?.toLowerCase().includes(query) || form.form_description?.toLowerCase().includes(query)
    );
});

// 將"上傳新表單"按鈕納入計算，創建一個合併的數據源
const combinedData = computed(() => {
    if (!filteredForms.value) return [];

    let result = [...filteredForms.value];

    // 添加新表單按鈕
    result.unshift({ id: "add-card", isAddCard: true });

    return result;
});

// 將數據分為行
const rows = computed(() => {
    if (!combinedData.value.length) return [];

    const rowCount = Math.ceil(combinedData.value.length / cardsPerRow.value);
    const result = [];

    for (let i = 0; i < rowCount; i++) {
        const startIdx = i * cardsPerRow.value;
        const endIdx = Math.min(startIdx + cardsPerRow.value, combinedData.value.length);
        result.push(combinedData.value.slice(startIdx, endIdx));
    }

    return result;
});

// 設置虛擬滾動 (基於行)
const rowVirtualizer = computed(() => {
    if (!rows.value.length) return null;

    return useVirtualizer({
        count: rows.value.length,
        getScrollElement: () => scrollContainerRef.value,
        estimateSize: () => ROW_HEIGHT, // 每行的高度
        overscan: 3, // 預加載的行數
    });
});

// 獲取虛擬行
const virtualRows = computed(() => {
    return rowVirtualizer.value?.value?.getVirtualItems() || [];
});

// 總高度
const totalHeight = computed(() => {
    return rowVirtualizer.value?.value?.getTotalSize() || 0;
});

// 卡片寬度計算 (考慮內容寬度，確保卡片不被截斷)
const cardWidth = computed(() => {
    const containerWidth = scrollContainerRef.value?.clientWidth || 1200;
    // 減去padding和margin的空間
    const availableWidth = containerWidth - 80;
    return availableWidth / cardsPerRow.value - 16; // 每個卡片減去margin
});

// 當容器大小變化時，重新計算虛擬滾動
const updateVirtualizer = () => {
    updateCardsPerRow();
    nextTick(() => {
        rowVirtualizer.value?.value?.measure();
    });
};

const previousCardsPerRow = ref(cardsPerRow.value);
watch(cardsPerRow, (newValue) => {
    // 解決點同一個兩次的話，會變成undefined的問題
    if (newValue === null || newValue === undefined) {
        cardsPerRow.value = previousCardsPerRow.value;
    } else {
        previousCardsPerRow.value = newValue;
    }

    // 當cardsPerRow變化時，重新計算虛擬滾動
    nextTick(() => {
        rowVirtualizer.value?.value?.measure();
    });
});

const preset_form_config = ref("");
function getPresetFormConfig() {
    preset_form_config.value = {};
    // axios.get("/skill/preset_form_config").then((rs) => {
    //     if (rs.data.code === 0) {
    //         preset_form_config.value = rs.data.data;
    //     } else {
    //         emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    //     }
    // });
}

const addFormBtn = ref({
    header: "上傳新表單",
    description: "導入您自己的api",
});

const formUpdateRef = ref(null);
const forms = ref([]);

async function openUpdateForm() {
    let title = "修改表單";
    let placeholder = "";
    let rs = await axios.get("/datasets/datasets");
    let option = rs.data.data.map((m) => {
        return {
            show: m.name,
            value: m.id,
        };
    });
    let data = [
        { type: "text", name: "form_name", required: true, placeholder: "表單名稱" },
        { type: "textarea", name: "form_description", required: true, placeholder: "表單描述" },
        { type: "textarea", name: "form_config", required: true, placeholder: "config設定(json)", isJson: true },
        { type: "select", name: "dataset_id", required: false, placeholder: "綁定知識庫", option },
    ];
    formUpdateRef.value.open({ title, placeholder, data });
}
async function getForm(form_id) {
    selectedFiles.value = [];
    fileData.value = {};
    await axios.get(`/form/form?form_id=${form_id}`).then((rs) => {
        if (rs.data.code === 0) {
            rs = rs.data.data[0];
            const obj = {
                form_id: rs.id,
                form_name: rs.form_name,
                form_description: rs.form_description,
                form_config: JSON.stringify(rs.form_config),
            };
            formInfo.value = {
                form_id: rs.id,
                form_name: rs.form_name,
                form_description: rs.form_description,
                form_config: JSON.stringify(rs.form_config),
            };
            formUpdateRef.value.setFormData(obj);
            openUpdateForm();
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
    });
    let rs1 = await axios.post("/form/getBindingAssociationFile", JSON.stringify({ form_id }));
    if (rs1.data.code === 0) {
        forms.value = rs1.data.data.map((m) => {
            return {
                form_id: m.form_id, // 確保取得 form_id
                document_id: m.document_id, // 新增 document_id
                dataset_id: m.dataset_id, // 新增 dataset_id
                name: m.document_name,
                datasets_name: m.datasets_name,
            };
        });
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
        let rs1 = await axios.post("/form/getBindingAssociationFile", JSON.stringify({ form_id: form.form_id }));
        if (rs1.data.code === 0) {
            forms.value = rs1.data.data.map((m) => {
                return {
                    form_id: m.form_id, // 確保取得 form_id
                    document_id: m.document_id, // 新增 document_id
                    dataset_id: m.dataset_id, // 新增 dataset_id
                    name: m.document_name,
                    datasets_name: m.datasets_name,
                };
            });
        }
        emitter.emit("openSnackbar", { message: "取消成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

async function updateForm(data) {
    if (!isValidJSON(data.form_config)) {
        emitter.emit("openSnackbar", { message: "請輸入json格式", color: "error" });
        return;
    }

    formUpdateRef.value.close();
    let rs = await axios.put(
        "/form/form",
        JSON.stringify({
            form_id: data.form_id,
            form_name: data.form_name,
            form_description: data.form_description,
            form_config: data.form_config,
        })
    );
    if (rs.data.code === 0) {
        getForms();
        // const form_id = rs.data.data.form_id;
        if (!data.dataset_id) return;
        rs = await axios.post(
            "/form/bindFormDataset",
            JSON.stringify({
                form_id: data.form_id,
                datasets_id: data.dataset_id,
                form_name: data.form_name,
                form_description: data.form_description,
                datasource_url: "",
                datasource_name: "",
                separator: data.separator || null, // TODO: 前端要補上切割符號
            })
        );

        emitter.emit("openSnackbar", { message: "修改成功，系統處理中，請稍後查看結果", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}
async function deleteForm(data) {
    formUpdateRef.value.close();
    const form_id = formInfo.value.form_id;
    let rs = await axios.delete("/form/form", {
        data: {
            form_id,
        },
    });
    if (rs.data.code === 0) {
        getForms();
        emitter.emit("openSnackbar", { message: "刪除成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

const formRef = ref(null);
async function openForm() {
    let title = "開始新建一張表單";
    let placeholder = "";
    let data = [
        { type: "text", name: "form_name", required: true, placeholder: "表單名稱" },
        { type: "textarea", name: "form_description", required: true, placeholder: "表單描述" },
        { type: "textarea", name: "form_config", required: true, placeholder: "config設定(json)", isJson: true },
    ];

    formRef.value.setFormData({ form_config: JSON.stringify(preset_form_config.value) });
    formRef.value.open({ title, placeholder, data });
}

//檢查是否為json字串
function isValidJSON(JsonStr) {
    try {
        const obj = JSON.parse(JsonStr);
        if (typeof obj === "object" && obj) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}
async function createForm(data) {
    if (!isValidJSON(data.form_config)) {
        emitter.emit("openSnackbar", { message: "請輸入json格式", color: "error" });
        return;
    }
    formRef.value.close();
    let rs = await axios.post(
        "/form/create",
        JSON.stringify({
            form_name: data.form_name,
            form_description: data.form_description,
            form_config: data.form_config,
        })
    );
    if (rs.data.code === 0) {
        getForms();
        emitter.emit("openSnackbar", { message: "創建成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

const selectedDataset = ref([]);
const selectedFiles = ref([]);
const fileData = ref({});

async function handleDatasetSelection(value) {
    selectedDataset.value = value;
    if (value) {
        await handleChildSelection([value]);
    } else {
        fileData.value = {};
        selectedFiles.value = [];
    }
}

// 用知識庫 id 撈出對應的文件
async function handleChildSelection(selectedValues) {
    // 如果沒有 selectedValues，就改用 selectedDataset
    if (!selectedValues) {
        selectedValues = selectedDataset.value;
    }

    console.log("refetch", selectedValues);

    let rs = await axios.get("/form/getDocumentsByDatasetId", {
        params: {
            datasets_id: selectedValues,
        },
    });
    if (rs.data.code === 0) {
        fileData.value = rs.data.data;
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

// 當檔案被選擇時觸發
function handleFileSelection(files) {
    selectedFiles.value = files;
    console.log("Selected files:", files);
}

// 綁定所有文件
async function bindAllFiles() {
    try {
        let response = await axios.post("/form/bindMultipleFormDoc", {
            files: selectedFiles.value,
            formInfo: formInfo.value,
        });

        if (response.data.code === 0) {
            selectedDataset.value = [];
            selectedFiles.value = [];
            fileData.value = {};
            getForm(formInfo.value.form_id);
            emitter.emit("openSnackbar", { message: "綁定成功", color: "success" });
        }
    } catch (error) {
        console.error("Error binding files:", error);
    }
}

// 關閉視窗
const closeForm = () => {
    formUpdateRef.value.close();
};

// 開啟確認視窗
const confirm_com = ref(null);
const confirmOpen = function () {
    confirm_com.value.open();
};
</script>

<template>
    <div class="forms_view">
        <!-- 搜尋和控制區域 -->
        <div class="control-panel">
            <div class="search-container">
                <div class="search-input-wrapper">
                    <i class="fa-solid fa-magnifying-glass search-icon"></i>
                    <input type="text" v-model="searchQuery" class="search-input" placeholder="搜尋表單..." />
                    <v-btn
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        variant="text"
                        density="compact"
                        icon="fa-solid fa-times"
                        size="small"
                        class="clear-button"
                    ></v-btn>
                </div>
            </div>
            <div class="layout-controls">
                <div class="view-mode-label">顯示模式</div>
                <v-btn-toggle v-model="cardsPerRow" color="primary" density="comfortable" class="grid-toggle">
                    <v-btn :value="2" variant="text" class="grid-btn">
                        <i class="fa-solid fa-table-cells-large"></i>
                    </v-btn>
                    <v-btn :value="4" variant="text" class="grid-btn">
                        <i class="fa-solid fa-table-cells"></i>
                    </v-btn>
                    <v-btn :value="6" variant="text" class="grid-btn">
                        <i class="fa-solid fa-grip"></i>
                    </v-btn>
                </v-btn-toggle>
            </div>
        </div>

        <div class="scroll-container" ref="scrollContainerRef">
            <!-- 虛擬滾動容器 -->
            <template v-if="isLoading">
                <v-row class="d-flex justify-space-between">
                    <v-col v-for="n in 4" :key="n" cols="12" sm="6" md="4" lg="3">
                        <v-skeleton-loader type="image, list-item-two-line" />
                    </v-col>
                </v-row>
            </template>

            <div v-else-if="rows.length > 0" class="virtual-list-container" :style="{ height: `${totalHeight}px` }">
                <div
                    v-for="virtualRow in virtualRows"
                    :key="virtualRow.index"
                    class="row"
                    :style="{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${ROW_HEIGHT}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                    }"
                >
                    <!-- 每行的卡片 -->
                    <div
                        v-for="(item, colIndex) in rows[virtualRow.index]"
                        :key="item.id || colIndex"
                        class="col"
                        :style="{
                            width: `${cardWidth}px`,
                            flex: `0 0 ${cardWidth}px`,
                        }"
                    >
                        <!-- 新增表單卡片 -->
                        <div v-if="item.isAddCard" class="card add_card" @click="openForm">
                            <div class="card_top add_card_top">
                                <span><i class="fa-solid fa-plus"></i></span>
                                <p>{{ addFormBtn.header }}</p>
                            </div>
                            <div class="card_center add_card_center">
                                <p>{{ addFormBtn.description }}</p>
                            </div>
                        </div>

                        <!-- 表單卡片 -->
                        <template v-else>
                            <v-tooltip
                                location="top"
                                :disabled="
                                    !(
                                        item.created_by_name ||
                                        item.created_by ||
                                        item.updated_by_name ||
                                        item.updated_by
                                    )
                                "
                                :text="
                                    (item.created_by_name || item.created_by
                                        ? `建立者：${item.created_by_name || item.created_by}`
                                        : '') +
                                    (item.updated_by_name || item.updated_by
                                        ? `更新者：${item.updated_by_name || item.updated_by}`
                                        : '')
                                "
                            >
                                <template v-slot:activator="{ props }">
                                    <div class="card" v-bind="props" @click="getForm(item.id)">
                                        <div class="card_top">
                                            <span><i class="fa-brands fa-wpforms"></i></span>
                                            <p>{{ item.form_name }}</p>
                                        </div>
                                        <div class="card_center">
                                            <p>{{ item.form_description }}</p>
                                        </div>
                                        <div class="card_bottom">
                                            <div class="item">
                                                <span><i class="fa-solid fa-file-lines"></i></span>
                                                <p>{{ item.files?.length || 0 }}文件</p>
                                            </div>
                                            <div class="flex-wrap item">
                                                <span><i class="fa-solid fa-diagram-project"></i></span>
                                                <p>{{ item.datasets?.length || 0 }}關聯專家</p>
                                                <div
                                                    v-for="(dataset, idx) in item.datasets || []"
                                                    :key="idx"
                                                    class="dataset-icon-box"
                                                >
                                                    <i class="icon" v-if="dataset.icon" :class="dataset.icon"></i>
                                                    <i v-else class="fa-solid fa-database icon"></i>
                                                    <v-tooltip activator="parent" location="top">{{
                                                        dataset.name
                                                    }}</v-tooltip>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </v-tooltip>
                        </template>
                    </div>
                </div>
            </div>

            <div v-else-if="isLoading" class="status-message">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
                <div class="mt-3">正在載入表單列表...</div>
            </div>
            <div v-else-if="isError" class="status-message">
                <v-icon color="error" size="large">fa-solid fa-triangle-exclamation</v-icon>
                <div class="mt-3">載入失敗: {{ error?.message }}</div>
            </div>
            <div v-else-if="searchQuery && filteredForms.length === 0" class="status-message">
                <v-icon color="info" size="large">fa-solid fa-search</v-icon>
                <div class="mt-3">沒有符合 "{{ searchQuery }}" 的表單</div>
            </div>
            <div v-else-if="formCards.length === 0" class="status-message">
                <v-icon color="info" size="large">fa-solid fa-wpforms</v-icon>
                <div class="mt-3">目前沒有表單，請點擊"上傳新表單"按鈕創建一個新表單。</div>
            </div>
        </div>

        <FormComponents ref="formRef" @send="createForm"></FormComponents>

        <FormComponents
            ref="formUpdateRef"
            :showDeleteButton="true"
            :multipleSelectWithButton="true"
            :showFooterBtnGroup="false"
            @send="updateForm"
            @updateFormConfig="updateForm"
            @selectionChange="handleDatasetSelection"
        >
            <template v-slot:top> </template>
            <template v-slot:bottom>
                <GroupedFileSelector
                    :fileData="fileData"
                    :showBindDocumentSelect="selectedDataset.length > 0"
                    v-model="selectedFiles"
                    :forms="forms"
                    :formInfo="formInfo"
                    @update:modelValue="handleFileSelection"
                    @refetch="handleChildSelection"
                    @bindAll="bindAllFiles"
                    @unbindFormDoc="unbindFormDoc"
                />

                <div class="btn btnGroup">
                    <div>
                        <v-btn elevation="0" class="text-none mf-4" color="red-darken-3" @click="confirmOpen()"
                            >刪除表單</v-btn
                        >
                    </div>
                    <div class="saveAction">
                        <v-btn elevation="0" class="text-none no cancelBtn" small @click="closeForm">取消</v-btn>
                    </div>
                </div>
            </template>
        </FormComponents>
        <ConfirmComponents
            ref="confirm_com"
            type="warning"
            message="將不可復原，確認要刪除嗎?"
            :confirmBtn="true"
            @confirm="deleteForm"
            saveBtnName="確認刪除"
            closeBtnName="關閉"
        ></ConfirmComponents>
    </div>
</template>

<style lang="scss" scoped>
$color1: rgb(106, 174, 233);
$color2: rgb(104, 197, 127);
$color3: rgb(139, 139, 139);
$primary-color: #1c64f1;
$light-gray: #f9fafb;
$border-color: #e0e0e0;

.forms_view {
    position: relative;
    height: calc(100vh - 75px);
    width: 100%;
    overflow: hidden;
    padding: 1rem 2rem;
}

.control-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    padding: 0.5rem 1rem;
    flex-wrap: wrap;
    gap: 1rem;
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-container {
    flex: 1;
    max-width: 500px;
}

.search-input-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    background-color: $light-gray;
    border-radius: 8px;
    padding: 0.1rem 0.5rem;
    border: 1px solid $border-color;
    transition: all 0.2s;

    &:focus-within {
        border-color: $primary-color;
        box-shadow: 0 0 0 2px rgba($primary-color, 0.1);
    }
}

.search-input {
    width: 100%;
    padding: 0.7rem 0.5rem;
    border: none;
    font-size: 0.95rem;
    background-color: transparent;

    &:focus {
        outline: none;
    }
}

.search-icon {
    color: #6b7280;
    font-size: 0.9rem;
    margin-right: 0.5rem;
}

.clear-button {
    margin-left: auto;
}

.layout-controls {
    display: flex;
    align-items: center;
    gap: 0.7rem;
}

.view-mode-label {
    font-size: 0.9rem;
    color: #6b7280;
    margin-right: 0.3rem;
}

.grid-toggle {
    border: 1px solid $border-color;
    border-radius: 8px;
    overflow: hidden;
}

.grid-btn {
    min-width: 42px;
    width: 42px;
}

.scroll-container {
    height: calc(100% - 70px);
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
}

.virtual-list-container {
    position: relative;
    width: 100%;
}

.row {
    display: flex;
    flex-wrap: nowrap;
    width: 100%;
    gap: 1rem;
    padding: 0 0.5rem;
}

.col {
    margin-bottom: 1rem;
}

.btnGroup {
    display: flex;
    justify-content: space-between;
    position: sticky;
    bottom: -25px;
    padding: 8px 0;
    background-color: white;
    z-index: 1;
}

.cancelBtn {
    background-color: #f3f4f6;
}

.saveAction {
    display: flex;
    gap: 10px;
}

.card {
    width: 100%;
    border-radius: 0.7rem;
    background-color: white;
    cursor: pointer;
    transition: 0.25s;
    padding: 1rem;
    box-shadow: 0px 1px 5px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    height: 190px;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    border: 3px solid rgba($color: $color2, $alpha: 0.5);

    &:hover {
        box-shadow: 0px 8px 15px rgba($color: $color2, $alpha: 0.3);
        border: 3px solid rgba($color: $color2, $alpha: 0.7);
    }

    .card_top {
        display: flex;
        align-items: center;
        height: 40px;
        margin-bottom: 0.5rem;

        img {
            width: 2rem;
            height: 2rem;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
            border: 1px solid #e4e5e7;
        }
        span {
            width: 2rem;
            height: 2rem;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
            border: 1px solid #e4e5e7;
            display: flex;
            justify-content: center;
            align-items: center;
            color: $color2;
        }
    }

    .card_center {
        color: #6b7280;
        word-break: break-all;
        font-size: 0.85rem;
        line-height: 1.4;
        height: 68px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        margin-bottom: 0.7rem;
    }

    .card_bottom {
        color: #6b7280;
        font-size: 0.8rem;
        display: flex;
        flex-wrap: wrap;
        margin-top: auto;

        .item {
            display: flex;
            align-items: center;
            flex-wrap: wrap;

            span {
                color: #98a2b3;
                margin-right: 0.3rem;
                font-size: 0.8rem;
            }

            p {
                margin-right: 1rem;
                margin-bottom: 0.5rem;
                margin-top: 0.2rem;
                white-space: nowrap;
            }

            .dataset-icon-box {
                width: 22px;
                aspect-ratio: 1 / 1;
                border: 0.5px solid rgba(128, 128, 128, 0.288);
                border-radius: 30%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 0.6rem;

                .icon {
                    color: rgb(106, 174, 233);
                }
            }
        }
    }
}

.add_card {
    background-color: #eceef1;
    border: 2px solid rgba($color: $color2, $alpha: 0.3);

    &:hover {
        background-color: white;
        box-shadow: 0px 8px 10px rgba($color: $color2, $alpha: 0.3);
        border: 2px solid rgba($color: $color2, $alpha: 0.5);
    }

    .add_card_top {
        span {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 2rem;
            height: 2rem;
            color: #6b7280;
            font-size: 0.5rem;
            border: 1px solid #e4e5e7;
            background-color: #f3f4f6;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
        }
    }
}
</style>
