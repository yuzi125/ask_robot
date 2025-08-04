<script setup>
import InputComponents from "@/components/InputComponents.vue";
import TextPrison from "@/components/system/TextPrison.vue";
import ConfigurationSelect from "@/components/ConfigurationSelect.vue";
import { usePermissionStore } from "../store/index";
import { ref, onMounted, inject, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useRoute } from "vue-router";
import {
    fetchExpertsWithoutSelf,
    updateExpertRecommendation,
    updateLinkChunkLevel,
    updateShowExpertRecommendation,
    updateShowDatasetName,
    updateEnableContextHistory,
    fetchModelList,
    updateTranslationExpert,
} from "@/network/service";
const axios = inject("axios");
const emitter = inject("emitter");
const route = useRoute();

const permissionStore = usePermissionStore();
const { actionPermissions } = storeToRefs(permissionStore);

onMounted(() => {
    init();
});
const expert_id = route.params.expert_id;
const expertList = ref([]);
const selectedExperts = ref([]);
const system_prompt = ref({});
const suggest_question = ref({});
const no_data_found = ref({});
const content_replacement_list = ref({});
const config_jsonb = ref({});
const model = ref({});
const intentionModel = ref({});
const kor = ref({});
const model_params = ref({});
const update_finish = ref(true);
const update_name = ref(true);

const defaultSelect = "系統預設 (gpt-3.5-turbo-0125)";

const createSelectOption = (state, name) => ({
    state: state.name,
    abbr: { name: name, text: state.model_name, config: state.config, isJson: false },
});

// 暫時先跟 search_model 分開用 之後這支會刪掉 統一用 createSelectOption
const createSelectTextOption = (state, name) => ({
    state: state,
    abbr: { name: name, text: state, isJson: false },
});

const defaultSelectOption = (name) => ({
    state: defaultSelect,
    abbr: { name: name, text: "", isJson: false },
});

const modelStates = [
    "azure-gpt-4o",
    "azure-gpt-4-turbo",
    "azure-gpt-4-32k",
    "azure-gpt-35-turbo-16k",
    "azure-gpt-35-turbo",
    "gpt-4",
    "gpt-4o",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "claude-3-haiku-20240307",
    "twcc-ffm-llama3-70b-chat",
    "caf-azure-gpt-4o",
    "caf-azure-gpt-4-turbo",
    "caf-azure-gpt-4-32k",
    "caf-azure-gpt-35-turbo-16k",
    "caf-azure-gpt-35-turbo",
];

const modelSelects = ref([]);

const intentionModelSelects = ref([
    defaultSelectOption("intention"),
    ...modelStates.map((state) => createSelectTextOption(state, "intention")),
]);

const korSelects = ref([
    defaultSelectOption("kor"),
    ...modelStates.map((state) => createSelectTextOption(state, "kor")),
]);
const modelSelect = ref(defaultSelectOption("model"));
const intensionModelSelect = ref(defaultSelectOption("intention"));
const korSelect = ref(defaultSelectOption("kor"));

const textPrisonWords = ref([]);
const globalPrisonWords = ref([]);
const linkChunkLevel = ref(0);
const showRecommendExpert = ref(false);
const showDatasetName = ref(false);
const translationExpert = ref(false);
const enableContextHistory = ref(false);

// 為 v-select 準備的選項
const linkChunkLevelOptions = ref([
    { text: "關閉", value: 0 },
    { text: "1", value: 1 },
    { text: "2", value: 2 },
    { text: "3", value: 3 },
]);

const showRecommendOptions = ref([
    { text: "關閉", value: false },
    { text: "開啟", value: true },
]);

const showDatasetNameOptions = ref([
    { text: "關閉", value: false },
    { text: "開啟", value: true },
]);

const enableContextHistoryOptions = ref([
    { text: "關閉", value: false },
    { text: "開啟", value: true },
]);

const translationExpertOptions = ref([
    { text: "關閉", value: false },
    { text: "開啟", value: true },
]);

async function init() {
    let rs = await axios.get(`/expert/expert?expert_id=${expert_id}`);
    if (rs.data.code === 0) {
        rs = rs.data.data[0]?.config_jsonb;

        config_jsonb.value = rs || {};
        //若有新增增加這邊
        system_prompt.value = {
            text: rs.system_prompt,
            name: "system_prompt",
            isJson: false,
        };
        suggest_question.value = {
            text: rs.suggest_question,
            name: "suggest_question",
            isJson: false,
        };
        no_data_found.value = {
            text: rs.no_data_found,
            name: "no_data_found",
            isJson: false,
        };
        content_replacement_list.value = {
            text: rs.content_replacement_list,
            name: "content_replacement_list",
            isJson: false,
        };
        model_params.value = {
            text: JSON.stringify(rs.model_params),
            name: "model_params",
            isJson: true,
        };

        // search_model
        model.value = {
            text: rs.model ? rs.model : defaultSelect,
            name: "model",
            isJson: false,
        };
        modelSelect.value = {
            state: rs.model ? rs.model : defaultSelect,
            abbr: model.value,
        };

        intentionModel.value = {
            text: rs.intention ? rs.intention : defaultSelect,
            name: "intention",
            isJson: false,
        };

        intensionModelSelect.value = {
            state: rs.intention ? rs.intention : defaultSelect,
            abbr: intentionModel.value,
        };

        kor.value = {
            text: rs.kor ? rs.kor : defaultSelect,
            name: "model",
            isJson: false,
        };
        korSelect.value = {
            state: rs.kor ? rs.kor : defaultSelect,
            abbr: kor.value,
        };
        textPrisonWords.value = rs.text_prison_words || [];
        selectedExperts.value = rs.recommendation_experts || [];
        linkChunkLevel.value = rs.link_chunk_level || 0;
        showRecommendExpert.value = rs.show_recommended_experts || false;
        showDatasetName.value = rs.show_dataset_name || false;
        translationExpert.value = rs.translation_expert || false;
        enableContextHistory.value = rs.enable_context_history || false;
    }

    let response = await fetchModelList(false);

    if (response.data.code === 0) {
        let modelList = response.data.data;
        // 因為原本的寫法是去讀取 expert config_jsonb 的 model，但顯示的 select 是 name 不是 model_name 所以要換掉。

        // 去 model list 找出跟 rs.model 一樣的 model_name 並取得 name
        const modelListByRSModel = modelList.find((state) => state.model_name === rs.model);
        if (modelListByRSModel) {
            modelSelect.value = {
                state: modelListByRSModel.name ? modelListByRSModel.name : defaultSelect,
                abbr: model.value,
            };
        }

        // 取得 model list 並過濾 model_type
        modelSelects.value = [
            defaultSelectOption("model"),
            ...modelList
                .filter((state) => state.model_type === "search_model")
                .map((state) => createSelectOption(state, "model")),
        ];
        // intentionModelSelects.value = [
        //     defaultSelectOption("intention"),
        //     ...modelList
        //         .filter((state) => state.model_type === "intention")
        //         .map((state) => createSelectOption(state, "intention")),
        // ];
        // korSelects.value = [
        //     defaultSelectOption("kor"),
        //     ...modelList.filter((state) => state.model_type === "kor").map((state) => createSelectOption(state, "kor")),
        // ];
    }

    rs = await axios.get("/system/getChatSettings");

    if (rs.data.code === 0) {
        const systemSettings = rs.data.data;
        globalPrisonWords.value = systemSettings.text_prison_words || [];
    }

    const expertsData = await fetchExpertsWithoutSelf(expert_id);

    if (expertsData.length > 0) {
        expertList.value = expertsData;
    }
}

// 更新禁用詞
const updateTextPrison = async function (newWords) {
    config_jsonb.value["text_prison_words"] = newWords;

    let rs = await axios.put(
        "/expert/updatePrompt",
        JSON.stringify({
            expert_id,
            config_jsonb: config_jsonb.value,
        })
    );

    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "禁用詞設定已更新", color: "success" });
    }
};

const updateSetting = async function (endpoint, data, successMessage) {
    let rs = await axios.put(endpoint, data);
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: successMessage, color: "success" });
    }
};

async function update(item) {
    let value = chkJsonValue(item);

    if (value === false) {
        return;
    }

    config_jsonb.value[item.name] = value;
    if (item.name === "model") {
        config_jsonb.value["model_params"] = item.config;
    }

    update_finish.value = false;
    update_name.value = item.name;

    let rs = await axios.put(
        "/expert/updatePrompt",
        JSON.stringify({
            expert_id,
            config_jsonb: config_jsonb.value,
        })
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
            emitter.emit("openSnackbar", {
                message: "請輸入json格式",
                color: "warning",
            });
            return false;
        }
    }
    return item.text;
}

const handleShowRecommendExpertSelection = async (selection) => {
    const updateStatus = await updateShowExpertRecommendation(expert_id, selection);
    if (updateStatus.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
};

const handleShowDatasetNameSelection = async (selection) => {
    const updateStatus = await updateShowDatasetName(expert_id, selection);
    if (updateStatus.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
};

const handleEnableContextHistorySelection = async (selection) => {
    const updateStatus = await updateEnableContextHistory(expert_id, selection);
    if (updateStatus.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
};

const handleRecommendExpertSelection = async (selection) => {
    const selectedData = selection.map((id) => {
        const item = expertList.value.find((item) => item.id === id);
        return { id, name: item ? item.name : "" };
    });

    const updateStatus = await updateExpertRecommendation(expert_id, selectedData);
    if (updateStatus.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
};

const handleTranslationExpertSelection = async (selection) => {
    const updateStatus = await updateTranslationExpert(expert_id, selection);
    if (updateStatus.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
};

// 當選中的值變更時的處理邏輯
const handleLinkChunkLevelSelection = async (value) => {
    const linkChunkLevelProp = value;
    // 這裡你可以處理選中的值，例如保存或發送到後端
    const updateStatus = await updateLinkChunkLevel(expert_id, linkChunkLevelProp);
    if (updateStatus.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
};

const isEditing = ref(false);
function enterEditMode() {
    isEditing.value = true;
}

function exitEditMode() {
    isEditing.value = false;
}
</script>

<template>
    <div class="configuration_view">
        <div v-if="actionPermissions.allowedToUseExpertConfiguration">
            <!-- 輸入替換規則 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">輸入替換規則</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right"
                            >此處會替換使用者的輸入，只要輸入的字有對應到，即會進行替換</v-tooltip
                        >
                    </div>
                </div>
                <InputComponents
                    :loading="!update_finish"
                    :data="content_replacement_list"
                    @send="update"
                    multiline
                    :rows="5"
                    hint='請按照下列格式輸入 : {"您輸入的文字":"取代文字","中鋼":"中鋼集團"} 備註 : 可使用正規表達式。'
                    @enterEditMode="enterEditMode"
                    @exitEditMode="exitEditMode"
                />
            </div>

            <!-- 自訂錯誤提示 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">自訂錯誤提示</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right"
                            >當遇到不明意圖或系統錯誤時的自定義回答</v-tooltip
                        >
                    </div>
                </div>
                <InputComponents
                    :loading="!update_finish"
                    :data="suggest_question"
                    @send="update"
                    multiline
                    :rows="5"
                    @enterEditMode="enterEditMode"
                    @exitEditMode="exitEditMode"
                />
            </div>

            <!-- 自訂搜尋不到答案提示 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">自訂搜尋不到答案提示</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right">用於沒有搜尋到相關答案時的自定義回答</v-tooltip>
                    </div>
                </div>
                <InputComponents
                    :loading="!update_finish"
                    :data="no_data_found"
                    @send="update"
                    multiline
                    :rows="5"
                    @enterEditMode="enterEditMode"
                    @exitEditMode="exitEditMode"
                />
            </div>

            <!-- 補全參考來源組數 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">補全參考來源組數</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right"
                            >設定補全參考來源的組數，當使用者提問時，系統會自動補全參考來源。</v-tooltip
                        >
                    </div>
                </div>
                <ConfigurationSelect
                    v-model="linkChunkLevel"
                    :items="linkChunkLevelOptions"
                    label="選擇狀態"
                    @update:modelValue="handleLinkChunkLevelSelection"
                    :loading="!update_finish"
                />
            </div>

            <!-- 翻譯專家 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">翻譯專家</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right"
                            >是否為翻譯專家</v-tooltip
                        >
                    </div>
                </div>
                <ConfigurationSelect
                    v-model="translationExpert"
                    :items="translationExpertOptions"
                    label="選擇狀態"
                    @update:modelValue="handleTranslationExpertSelection"
                    :loading="!update_finish"
                />
            </div>

            <!-- 顯示推薦專家 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">顯示推薦專家</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right">是否要顯示推薦專家</v-tooltip>
                    </div>
                </div>
                <ConfigurationSelect
                    v-model="showRecommendExpert"
                    :items="showRecommendOptions"
                    label="選擇狀態"
                    @update:modelValue="handleShowRecommendExpertSelection"
                    :loading="!update_finish"
                />
            </div>
            <!-- 顯示來源知識庫名稱 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">顯示來源知識庫名稱</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right">是否要顯示來源知識庫名稱</v-tooltip>
                    </div>
                </div>

                <ConfigurationSelect
                    v-model="showDatasetName"
                    :items="showDatasetNameOptions"
                    label="選擇狀態"
                    @update:modelValue="handleShowDatasetNameSelection"
                    :loading="!update_finish"
                />
            </div>
            <!-- 顯示是否啟用多輪對話 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">是否啟用多輪對話</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right">是否啟用多輪對話</v-tooltip>
                    </div>
                </div>

                <ConfigurationSelect
                    v-model="enableContextHistory"
                    :items="enableContextHistoryOptions"
                    label="選擇狀態"
                    @update:modelValue="handleEnableContextHistorySelection"
                    :loading="!update_finish"
                />
            </div>
            <!-- 推薦專家 -->
            <div class="section-card">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">推薦專家</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right"
                            >當這位專家無法回答使用者提出的問題，就推薦使用者可以嘗試詢問哪些專家。</v-tooltip
                        >
                    </div>
                </div>
                <ConfigurationSelect
                    v-model="selectedExperts"
                    :items="expertList"
                    label="選擇推薦專家"
                    itemTitle="name"
                    itemValue="id"
                    :multiple="true"
                    :chips="true"
                    :closableChips="true"
                    :disabled="!showRecommendExpert"
                    :loading="!update_finish"
                    @update:modelValue="handleRecommendExpertSelection"
                />
            </div>

            <!-- 禁用詞設定 -->
            <div class="section-card">
                <TextPrison
                    v-model="textPrisonWords"
                    @update:modelValue="updateTextPrison"
                    scope="expert"
                    :globalWords="globalPrisonWords"
                />
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.configuration_view {
    padding: 2rem;
    background: linear-gradient(to bottom, #ffffff, #f4f7fc);
    height: auto;
    min-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;

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
    }

    .w-100 {
        width: 100%;
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
