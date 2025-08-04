<script setup>
import { ref, inject, watch, computed } from "vue";
import { marked } from "marked";

import ConfirmComponents from "@/components/ConfirmComponents.vue";

const axios = inject("axios");
const emitter = inject("emitter");

const props = defineProps({
    fileInfo: { type: Object, default: {} },
});

async function getChunksData() {
    addMode.value = false;
    editMode.value = false;

    const rs = await axios.get(`/datasets/fileChunks/${props.fileInfo.id}`);
    chunks.value = [];
    if (rs && rs.data && rs.data.data) {
        chunks.value = rs.data.data;
    }
}

const convertContent = ref("");
const selectedChunk = ref(null);
const chunks = ref([]);
const searchQuery = ref("");

// 搜尋功能
const filteredChunks = computed(() => {
    if (!searchQuery.value) return chunks.value;
    return chunks.value.filter((chunk) => chunk.page_content.toLowerCase().includes(searchQuery.value.toLowerCase()));
});

watch(
    () => selectedChunk.value,
    () => {
        editMode.value = false;
    }
);

// 新增功能
const addMode = ref(false);
const newChunkContent = ref("");
const addError = ref({
    isError: false,
    errorMsg: "",
});
function openAddArea() {
    newChunkContent.value = "";
    addMode.value = true;
}
function cancelAddition() {
    addError.value.isError = false;
    addError.value.errorMsg = "";
    addMode.value = false;
}
async function addChunk() {
    console.log("addChunk...");

    // const reqBody = {
    //     fileID: props.fileInfo.id,
    //     chunkID: selectedChunk.value.id,
    //     newContent: tempChunkContent.value,
    // };
    // const rs = await axios.post(`/datasets/editChunk`, JSON.stringify(reqBody));
    // if (rs && rs.data && rs.data.code === 0) {
    //     emitter.emit("openSnackbar", { message: rs.data.message, color: "success" });
    //     // 刷新資料
    //     getChunksData();
    // } else {
    //     emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    // }
}
const confirm_com_add_chunk = ref(null);
function confirmAddOpen() {
    if (newChunkContent.value.length === 0) {
        addError.value.isError = true;
        addError.value.errorMsg = "不可為空值";
    } else {
        addError.value.isError = false;
        addError.value.errorMsg = "";
        confirm_com_add_chunk.value.open();
    }
}

// 編輯功能
const editMode = ref(false);
const tempChunkContent = ref("");
const maxEditChunkLength = 1000; // 編輯chunk的最大長度。
const editError = ref({
    isError: false,
    errorMsg: "",
});
function openEditArea() {
    editMode.value = true;
    if (selectedChunk.value && selectedChunk.value.page_content)
        tempChunkContent.value = JSON.parse(JSON.stringify(selectedChunk.value.page_content));
}
function cancelEdition() {
    editError.value.isError = false;
    editError.value.errorMsg = "";
    editMode.value = false;
}
async function saveEditedChunk() {
    const reqBody = {
        fileID: props.fileInfo.id,
        chunkID: selectedChunk.value.id,
        newContent: tempChunkContent.value,
    };
    const rs = await axios.post(`/datasets/editChunk`, JSON.stringify(reqBody));
    if (rs && rs.data && rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "success" });
        // 刷新資料
        getChunksData();
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}
const confirm_com_edit_chunk = ref(null);
function confirmEditOpen() {
    if (tempChunkContent.value.length === 0) {
        editError.value.isError = true;
        editError.value.errorMsg = "不可為空值";
    } else if (tempChunkContent.value.length > maxEditChunkLength) {
        editError.value.isError = true;
        editError.value.errorMsg = `字數超過限制(${maxEditChunkLength}字)`;
    } else {
        editError.value.isError = false;
        editError.value.errorMsg = "";
        confirm_com_edit_chunk.value.open();
    }
}
</script>

<template>
    <div class="text-center">
        <button @click="getChunksData()">
            <i class="fa-solid fa-boxes-stacked icon-hover"></i>
            <v-tooltip activator="parent" location="top">顯示檔案切分結果</v-tooltip>
            <!-- Vuetify預設 - 透過parent按鈕打開Dialog -->
            <v-dialog activator="parent" max-width="1240px">
                <template v-slot:default="{ isActive }">
                    <v-card rounded="lg">
                        <v-card-title class="sticky-top d-flex justify-space-between align-center">
                            <div class="title">{{ props.fileInfo.originalname }}</div>
                            <div class="d-flex justify-space-between align-center">
                                <v-switch
                                    v-model="convertContent"
                                    :label="convertContent ? '轉換後內容' : '純文字內容'"
                                    color="primary"
                                    hide-details
                                ></v-switch>
                                <v-btn icon="mdi-close" variant="text" @click="isActive.value = false"></v-btn>
                            </div>
                        </v-card-title>

                        <v-card-text class="card-text-custom">
                            <div class="content-box d-flex ga-6">
                                <p class="subtitle">
                                    資料切分方式 :
                                    <v-chip color="primary">{{
                                        props.fileInfo.separator ? "自訂" : "系統預設"
                                    }}</v-chip>
                                </p>
                                <p class="subtitle">
                                    切分符號 : <v-chip color="info">{{ props.fileInfo.separator || "預設" }}</v-chip>
                                </p>
                            </div>

                            <div class="content-box">
                                <div class="d-flex justify-space-between align-center">
                                    <div class="d-flex align-center ga-6">
                                        <p class="subtitle">一共切成 {{ chunks.length }} 個區塊 :</p>
                                        <v-text-field
                                            v-model="searchQuery"
                                            density="compact"
                                            variant="outlined"
                                            label="搜尋內容"
                                            prepend-inner-icon="mdi-magnify"
                                            hide-details
                                            class="search-field"
                                        ></v-text-field>
                                    </div>
                                    <div v-if="false">
                                        <v-btn
                                            v-if="!addMode"
                                            color="primary"
                                            prepend-icon="mdi mdi-sticker-plus-outline"
                                            variant="tonal"
                                            @click="openAddArea()"
                                            >新增</v-btn
                                        >
                                        <div v-else class="d-flex ga-3">
                                            <v-btn color="success" variant="tonal" @click="confirmAddOpen()"
                                                >儲存</v-btn
                                            >
                                            <v-btn color="red" variant="tonal" @click="cancelAddition()">取消</v-btn>
                                        </div>
                                    </div>
                                </div>
                                <div class="my-3 chunk-add-box" :class="addMode ? 'openAddBox' : ''">
                                    <v-textarea
                                        v-model="newChunkContent"
                                        label="新增參考來源"
                                        variant="solo"
                                        no-resize
                                        bg-color="blue-lighten-5"
                                        base-color="primary"
                                        :error="addError.isError"
                                        :error-messages="addError.errorMsg"
                                        hide-details
                                    ></v-textarea>
                                </div>
                                <v-row class="chunk-card-container" no-gutters>
                                    <v-col
                                        v-for="(chunk, index) in filteredChunks"
                                        :key="index"
                                        cols="4"
                                        @click="selectedChunk = chunk"
                                    >
                                        <v-card
                                            class="chunk-card"
                                            :color="selectedChunk === chunk ? 'info' : 'grey-lighten-4'"
                                            :dark="selectedChunk === chunk"
                                            elevation="2"
                                            rounded
                                            hover
                                        >
                                            <div class="text-subtitle-1 font-weight-bold">{{ index + 1 + "." }}</div>
                                            <div class="text-body-1 text-truncate">
                                                {{ chunk.page_content }}
                                            </div>
                                        </v-card>
                                    </v-col>
                                    <v-col class="text-center" v-if="filteredChunks.length === 0" cols="12">
                                        {{ searchQuery ? "找不到符合的結果" : "查無相關資料" }}
                                    </v-col>
                                </v-row>
                            </div>

                            <div class="content-box">
                                <div class="mb-3 justify-space-between align-center d-flex">
                                    <p class="subtitle">切分內容 :</p>
                                    <div v-if="false">
                                        <v-btn
                                            v-if="!editMode"
                                            color="primary"
                                            prepend-icon="mdi mdi-pen"
                                            @click="openEditArea(selectedChunk)"
                                            variant="tonal"
                                            >編輯</v-btn
                                        >
                                        <div v-else class="d-flex ga-3">
                                            <v-btn color="success" variant="tonal" @click="confirmEditOpen()"
                                                >儲存修改</v-btn
                                            >
                                            <v-btn color="red" @click="cancelEdition()" variant="tonal">取消</v-btn>
                                        </div>
                                    </div>
                                </div>
                                <!-- 顯示模式 -->
                                <div v-if="!editMode" class="chunk-content-box">
                                    <div v-if="selectedChunk && !editMode">
                                        <div
                                            v-if="convertContent"
                                            class="mkd"
                                            v-dompurify-html="marked(selectedChunk?.page_content)"
                                        ></div>
                                        <div v-else>{{ selectedChunk?.page_content }}</div>
                                    </div>
                                    <div v-else>
                                        <p class="empty-text">請選擇一個切分資料</p>
                                    </div>
                                </div>
                                <!-- 編輯模式 -->
                                <div v-else class="chunk-edit-box">
                                    <v-textarea
                                        v-model="tempChunkContent"
                                        label="編輯參考來源"
                                        variant="solo"
                                        no-resize
                                        bg-color="grey-lighten-3"
                                        base-color="primary"
                                        counter
                                        :error="editError.isError"
                                        :error-messages="editError.errorMsg"
                                    ></v-textarea>
                                </div>
                            </div>
                        </v-card-text>

                        <v-card-actions class="sticky-bottom">
                            <v-btn
                                class="text-none"
                                color="primary"
                                rounded="xl"
                                text="關閉"
                                variant="flat"
                                @click="isActive.value = false"
                            ></v-btn>
                        </v-card-actions>
                    </v-card>
                </template>
            </v-dialog>
        </button>
        <ConfirmComponents
            ref="confirm_com_add_chunk"
            type="info"
            message="確定要儲存嗎 ?"
            :confirmBtn="true"
            @confirm="addChunk()"
            saveBtnName="確認"
            closeBtnName="取消"
        ></ConfirmComponents>
        <ConfirmComponents
            ref="confirm_com_edit_chunk"
            type="info"
            message="確定要儲存此次修改嗎 ? 儲存後將不可復原。"
            :confirmBtn="true"
            @confirm="saveEditedChunk()"
            saveBtnName="確認修改"
            closeBtnName="取消"
        ></ConfirmComponents>
    </div>
</template>

<style scoped>
.title {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
}

.subtitle {
    font-size: 1.2rem;
    font-weight: 500;
}

:deep(.v-card-text) {
    padding: 0px !important;
}

.card-text-custom {
    background-color: rgba(128, 128, 128, 0.25);
    .content-box {
        background-color: white;
        padding: 12px;
        margin: 8px;
    }
}

.chunk-card-container {
    max-height: 200px;
    overflow-y: auto;
}

.chunk-card {
    margin: 12px;
    padding: 12px;
    cursor: pointer;
}

.chunk-content-box {
    border: 3px solid rgba(156, 156, 156, 0.466);
    padding: 20px;
    border-radius: 5px;
    border-style: groove;
    max-height: 500px;
    font-size: 1.25rem;
    line-height: 1.25;
    overflow-y: auto;
}

.sticky-top {
    position: sticky;
    top: 0px;
    background-color: white;
    border-bottom: 2px solid rgba(128, 128, 128, 0.3);
    z-index: 1;
}

.sticky-bottom {
    position: sticky;
    bottom: 0px;
    padding: 10px;
    background-color: white;
    border-top: 2px solid rgba(128, 128, 128, 0.3);
}

.empty-text {
    color: gray;
    text-align: center;
}

.icon-hover:hover {
    color: #2196f3;
}

.chunk-add-box {
    max-height: 0;
    overflow-y: hidden;
    transition: all 0.5s ease-in-out;
}

.openAddBox {
    max-height: 500px;
    overflow-y: auto;
}

.ga-6 {
    gap: 1.5rem;
}

.search-field {
    min-width: 200px;
}

:deep(.v-field__input) {
    padding-top: 5px !important;
    padding-bottom: 5px !important;
}
</style>
