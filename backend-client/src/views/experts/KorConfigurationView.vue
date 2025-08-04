<script setup>
import { ref, reactive, computed, watch, inject } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useRoute } from "vue-router";
import AddModelDialog from "@/components/modelDialog/AddModelDialog.vue";
import EditModelDialog from "@/components/modelDialog/EditModelDialog.vue";
import DeleteConfirmDialog from "@/components/modelDialog/DeleteConfirmDialog.vue";
import ExportModelConfigDialog from "@/components/modelDialog/ExportModelConfigDialog.vue";
import { handleModelExport } from "@/utils/expert";
import ModelCard from "@/components/card/ModelCard.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import {
    fetchExpertListByModelType,
    fetchExpertConfigJsonbByExpertId,
    updateExpertConfig,
    updateExpertCurrentConfig,
    updateExpertModelParams,
    deleteExpertModelByName,
} from "@/network/service";

const emitter = inject("emitter");
const queryClient = useQueryClient();
const route = useRoute();

const expertId = route.params.expert_id;
const updateModelType = "kor";
const queryKey = ["korModelList", "korConfigJsonb"];

const { data: modelsData } = useQuery({
    queryKey: [queryKey[0]],
    queryFn: () => fetchExpertListByModelType("kor"),
});

const {
    data: configData,
    isLoading,
    isError,
    error,
} = useQuery({
    queryKey: [queryKey[1]],
    queryFn: () => fetchExpertConfigJsonbByExpertId(expertId),
});

// 控制新增模型的 dialog
const addModelDialog = ref(false);
// 控制編輯模型參數的 dialog
const editModelDialog = ref(false);
// 控制刪除模型的 dialog
const deleteConfirmDialog = ref(false);
const exportModelDialog = ref(false);
// 記錄要刪除的模型
const itemToDelete = ref(null);
// 記錄要編輯的模型
const editedItem = ref({});

// 排序
const sortBy = ref("displayName");
const sortDesc = ref(false);

// 搜尋
const search = ref("");
const isSearching = computed(() => search.value.length > 0);
const selectedModelUuid = ref(null);
const currentExportItem = ref({});

const modelOptions = computed(() => {
    return modelsData.value?.map((model) => model.name) || [];
});

const mutableConfig = reactive({
    [updateModelType]: {
        current_config: null,
    },
});

const localKorModels = ref([]);

async function addModel(newModelValue) {
    let selectedModelData = modelsData.value.find((model) => model.name === newModelValue.name);
    const displayName = newModelValue.displayName;
    if (selectedModelData) {
        const status = await updateExpertConfig(
            selectedModelData["id"],
            expertId,
            selectedModelData["config"],
            selectedModelData["name"],
            displayName,
            updateModelType
        );
        if (status?.isDuplicate) {
            emitter.emit("openSnackbar", { message: `模型名稱 ${displayName} 已存在`, color: "error" });
            return;
        }
        queryClient.invalidateQueries({ queryKey: [queryKey[1]] });
        emitter.emit("openSnackbar", { message: `已成功新增 ${displayName} 模型`, color: "success" });
    }

    addModelDialog.value = false;
}

function editItem(item) {
    editedItem.value = Object.assign({}, item);
    editModelDialog.value = true;
}

function deleteItem(item) {
    itemToDelete.value = item;
    deleteConfirmDialog.value = true;
}

async function saveModel(newModelValue) {
    const displayName = newModelValue["model_params"]["displayName"];
    const modelParams = newModelValue["model_params"];
    await updateExpertModelParams(expertId, modelParams, displayName, updateModelType);
    emitter.emit("openSnackbar", { message: `已成功更新 ${displayName} 模型參數`, color: "success" });
    queryClient.invalidateQueries({ queryKey: [queryKey[1]] });
    editModelDialog.value = false;
}

async function deleteModel() {
    try {
        const displayName = itemToDelete.value.displayName;
        await deleteExpertModelByName(expertId, updateModelType, displayName);
        emitter.emit("openSnackbar", { message: `已刪除 ${displayName} 模型`, color: "success" });
        await queryClient.invalidateQueries({ queryKey: [queryKey[1]] });
        deleteConfirmDialog.value = false;
        itemToDelete.value = null;
    } catch (error) {
        console.error("刪除模型時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: `刪除模型時發生錯誤`, color: "error" });
    }
}

function openExportDialog(item) {
    console.log("exportModelDialog", exportModelDialog);
    currentExportItem.value = item;
    exportModelDialog.value = true;
}

async function handleExport(exportData) {
    try {
        const result = await handleModelExport(exportData, updateModelType);

        if (!result.success) {
            emitter.emit("openSnackbar", {
                message: result.message,
                color: "error",
            });
            return;
        } else if (result.skippedExperts.length > 0) {
            emitter.emit("openSnackbar", {
                message: result.message,
                color: "warning",
            });
        } else {
            emitter.emit("openSnackbar", {
                message: result.message,
                color: "success",
            });
        }

        exportModelDialog.value = false; // 確保無論如何都會關閉對話框
    } catch (error) {
        console.error("Error during export:", error);
        emitter.emit("openSnackbar", {
            message: "匯出時發生錯誤，請稍後再試",
            color: "error",
        });
    }
}

async function selectModel(uuid) {
    selectedModelUuid.value = uuid;
    mutableConfig[updateModelType]["current_config"] = uuid;
    await updateExpertCurrentConfig(expertId, uuid, updateModelType);
    emitter.emit("openSnackbar", { message: `已切換至 ${uuid} 模型成功`, color: "success" });
    queryClient.invalidateQueries({ queryKey: [queryKey[1]] });
}

watch(
    () => configData.value,
    (newValue) => {
        if (newValue && newValue[updateModelType]) {
            mutableConfig[updateModelType]["current_config"] = newValue[updateModelType]["current_config"];
            selectedModelUuid.value = mutableConfig[updateModelType]["current_config"];

            localKorModels.value = Object.entries(newValue[updateModelType])
                .filter(([key]) => key !== "current_config")
                .map(([uuid, data]) => ({
                    id: data.model_list_id,
                    uuid,
                    displayName: uuid,
                    model_name: data.model_name,
                    create_time: data.create_time,
                    update_time: data.update_time,
                    ...data.model_params,
                }));
        }
    },
    { deep: true, immediate: true }
);

const sortOptions = [
    { text: "顯示名稱", value: "displayName" },
    { text: "建立時間", value: "create_time" },
    { text: "更新時間", value: "update_time" },
];

const sortDirections = [
    { text: "升序", value: false },
    { text: "降序", value: true },
];

const sortedAndFilteredModels = computed(() => {
    return localKorModels.value
        .filter(
            (model) =>
                model.displayName.toLowerCase().includes(search.value.toLowerCase()) ||
                model.uuid.toLowerCase().includes(search.value.toLowerCase())
        )
        .sort((a, b) => {
            // 首先將選中的模型排在最前面
            // if (a.uuid === selectedModelUuid.value) return -1;
            // if (b.uuid === selectedModelUuid.value) return 1;

            // 然後按照選擇的排序方式進行排序
            let comparison = 0;
            if (a[sortBy.value] < b[sortBy.value]) comparison = -1;
            if (a[sortBy.value] > b[sortBy.value]) comparison = 1;
            return sortDesc.value ? -comparison : comparison;
        });
});

function formatDate(date) {
    return new Date(date).toLocaleString();
}
</script>

<template>
    <v-container fluid class="pa-4">
        <v-card class="mb-6 rounded-lg kor-module-list" elevation="2">
            <v-row no-gutters class="align-center">
                <v-col cols="12" md="3" class="pa-4">
                    <h2 class="mb-0 text-blue-darken-2 text-h6 font-weight-bold">自然語言功能列表</h2>
                    <p class="mt-1 mb-0 text-blue-darken-2">管理您的自然語言模型</p>
                </v-col>
                <v-col cols="12" md="9">
                    <v-card-text class="px-4 py-3">
                        <v-row dense>
                            <v-col cols="12" sm="4" md="3">
                                <v-text-field
                                    v-model="search"
                                    prepend-inner-icon="mdi-magnify"
                                    label="搜尋模型"
                                    single-line
                                    hide-details
                                    density="compact"
                                    variant="outlined"
                                    bg-color="grey-lighten-4"
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="4" md="3">
                                <v-select
                                    v-model="sortBy"
                                    :items="sortOptions"
                                    item-title="text"
                                    item-value="value"
                                    label="排序方式"
                                    density="compact"
                                    hide-details
                                    variant="outlined"
                                    bg-color="grey-lighten-4"
                                ></v-select>
                            </v-col>
                            <v-col cols="12" sm="4" md="3">
                                <v-select
                                    v-model="sortDesc"
                                    :items="sortDirections"
                                    item-title="text"
                                    item-value="value"
                                    label="排序順序"
                                    density="compact"
                                    hide-details
                                    variant="outlined"
                                    bg-color="grey-lighten-4"
                                ></v-select>
                            </v-col>
                            <v-col cols="12" sm="12" md="3" class="justify-end d-flex">
                                <v-btn
                                    prepend-icon="mdi-plus"
                                    @click="addModelDialog = true"
                                    class="px-4 bg-blue-darken-1"
                                >
                                    新增模型
                                </v-btn>
                            </v-col>
                        </v-row>
                    </v-card-text>
                </v-col>
            </v-row>
        </v-card>

        <!-- 載入的時候顯示 skeleton -->
        <v-row v-if="isLoading">
            <v-col v-for="n in 3" :key="n" cols="12" sm="6" md="6" lg="4">
                <v-skeleton-loader type="card" :loading="true"></v-skeleton-loader>
            </v-col>
        </v-row>

        <!-- 錯誤顯示 -->
        <v-row v-else-if="isError" class="justify-center fill-height align-center">
            <v-col cols="12" class="text-center">
                <p class="text-error">載入失敗: {{ error.message }}</p>
            </v-col>
        </v-row>

        <!-- 無數據顯示 EmptyState -->
        <v-row v-else-if="sortedAndFilteredModels.length === 0" class="justify-center fill-height align-center">
            <v-col cols="12" sm="10" md="8" lg="6" xl="4">
                <EmptyState
                    title="尚未建立自然語言模組"
                    description="目前還沒有建立任何自然語言模組，您可以建立新的模組來顯示和管理，並進一步調整模組參數。"
                />
            </v-col>
        </v-row>

        <v-row>
            <v-col v-for="item in sortedAndFilteredModels" :key="item.uuid" cols="12" sm="6" md="6" lg="4">
                <ModelCard
                    :item="item"
                    :selectedModelUuid="selectedModelUuid"
                    @select="selectModel"
                    @edit="editItem"
                    @delete="deleteItem"
                    @export="openExportDialog"
                    :class="{ 'selected-model': item.uuid === selectedModelUuid }"
                />
            </v-col>
        </v-row>
        <!-- dialog -->
        <ExportModelConfigDialog
            v-model:dialog="exportModelDialog"
            :modelItem="currentExportItem"
            @export="handleExport"
        />
        <AddModelDialog v-model:dialog="addModelDialog" :model-options="modelOptions" @add="addModel" />
        <EditModelDialog v-model:dialog="editModelDialog" :item="editedItem" @save="saveModel" />
        <DeleteConfirmDialog v-model:dialog="deleteConfirmDialog" @confirm="deleteModel" />
    </v-container>
</template>

<style scoped>
.kor-module-list {
    overflow: hidden;
}

.module-card {
    transition: all 0.3s ease;
    border: 1px solid #e0e0e0;
}

.module-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

.v-card-title {
    word-break: break-word;
}
.selected-model {
    border: 2px solid #1976d2 !important; /* Use your preferred color */
    box-shadow: 0 0 10px rgba(25, 118, 210, 0.5) !important; /* Optional: adds a glow effect */
}
</style>
