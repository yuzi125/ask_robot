<script setup>
import { defineEmits, defineProps, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
const route = useRoute();

// 取得預設prompt 資料
import { storeToRefs } from "pinia";
import { useDefaultPromptStore } from "@/store/index";
const defaultPromptStore = useDefaultPromptStore();
const { getDefaultPrompts } = defaultPromptStore;
const { defaultPrompts } = storeToRefs(defaultPromptStore);
getDefaultPrompts();

const props = defineProps({
    dialog: Boolean,
    item: Object,
    showSearchKwargs: {
        type: Boolean,
        default: false,
    },
    is_voice_model: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["update:dialog", "save"]);

const localDialog = ref(props.dialog);
const editedItem = reactive({
    model_params: {
        system_prompt: "",
        default_system_prompt: 0,
        top_p: 0,
        max_tokens: 0,
        temperature: 0,
        frequency_penalty: 0,
    },
    search_kwargs: {
        k: 0,
        score_threshold: 0,
        cache_enabled: true,
        cache_threshold: 0,
        max_extra_chunk_cache_threshold: 0,
        min_extra_chunk_cache_threshold: 0,
    },
});
const activeTab = ref("model-params");

const cache_enabled_select = ref([
    { text: "開啟", abbr: true },
    { text: "關閉", abbr: false },
]);

watch(
    () => props.dialog,
    (newValue) => {
        localDialog.value = newValue;
    }
);

watch(
    () => props.item,
    (newValue) => {
        if (newValue) {
            // 深度複製對象以避免直接修改 props
            editedItem.model_params = JSON.parse(JSON.stringify(newValue || {}));
            editedItem.search_kwargs = JSON.parse(JSON.stringify(newValue.search_kwargs || {}));
        }
    },
    { deep: true, immediate: true }
);

function updateDialog(value) {
    emit("update:dialog", value);
}

function close() {
    updateDialog(false);
}

function save() {
    emit("save", {
        model_params: editedItem.model_params,
        search_kwargs: editedItem.search_kwargs,
    });
    // close();
}
</script>

<template>
    <v-dialog v-model="localDialog" max-width="800px" @update:model-value="updateDialog">
        <v-card>
            <v-card-title class="text-white text-h5 bg-primary"> 編輯模型 </v-card-title>
            <!-- <v-card-title>
                <span class="text-h5">編輯模型</span>
            </v-card-title> -->

            <v-card-text>
                <v-tabs v-model="activeTab" color="primary">
                    <v-tab value="search-kwargs" v-if="showSearchKwargs">搜尋參數</v-tab>
                    <v-tab value="model-params">模型參數</v-tab>
                </v-tabs>

                <v-window v-model="activeTab">
                    <v-window-item value="model-params">
                        <v-container>
                            <v-row>
                                <v-col cols="12" v-if="route.path.match('search')" class="pb-0">
                                    <v-select
                                        v-model="editedItem.model_params.default_system_prompt"
                                        :items="defaultPrompts"
                                        item-title="name"
                                        item-value="id"
                                        label="選擇預設值"
                                        :hint="`${
                                            defaultPrompts.find(
                                                (e) => e.id === editedItem.model_params.default_system_prompt
                                            )?.describe || ''
                                        }`"
                                        persistent-hint
                                    >
                                        <template v-slot:item="{ props, item }">
                                            <v-list-item v-bind="props" :subtitle="item.raw.describe"></v-list-item>
                                        </template>
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                選擇是否套用系統預設的Prompt。
                                            </v-tooltip>
                                        </template>
                                    </v-select>
                                </v-col>
                                <v-col cols="12">
                                    <v-textarea
                                        rows="5"
                                        no-resize
                                        persistent-hint
                                        v-model="editedItem.model_params.system_prompt"
                                        label="System Prompt"
                                        hint="設置模型的初始行為和背景知識"
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                System Prompt
                                                用於定義模型的初始狀態、角色或行為。它為模型提供上下文和指導。
                                            </v-tooltip>
                                        </template>
                                    </v-textarea>
                                </v-col>
                                <v-col cols="12" sm="6" v-if="!is_voice_model">
                                    <v-text-field
                                        v-model.number="editedItem.model_params.top_p"
                                        label="Top P"
                                        type="number"
                                        max="1"
                                        min="0"
                                        step="0.1"
                                        hint="控制輸出的多樣性（0至1）"
                                        persistent-hint
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                Top
                                                P（核心採樣）決定模型在生成文本時考慮的候選詞彙範圍。較低的值會產生更加確定和重複的輸出，較高的值會增加多樣性。
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6" v-if="!is_voice_model">
                                    <v-text-field
                                        v-model.number="editedItem.model_params.max_tokens"
                                        label="Max Tokens"
                                        type="number"
                                        hint="設置生成文本的最大長度"
                                        persistent-hint
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                Max Tokens
                                                限制模型在一次對話中生成的最大標記（詞）數。這有助於控制輸出的長度和計算成本。
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6">
                                    <v-text-field
                                        v-model.number="editedItem.model_params.temperature"
                                        label="Temperature"
                                        type="number"
                                        max="2"
                                        min="0"
                                        step="0.1"
                                        hint="控制輸出的隨機性（0至2）"
                                        persistent-hint
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                Temperature
                                                控制生成文本的隨機性。較低的值會產生更加確定和一致的輸出，較高的值會增加創造性和不可預測性。
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6" v-if="!is_voice_model">
                                    <v-text-field
                                        v-model.number="editedItem.model_params.frequency_penalty"
                                        label="Frequency Penalty"
                                        type="number"
                                        max="2"
                                        min="-2"
                                        step="0.1"
                                        hint="降低重複詞語的使用（-2.0至2.0）"
                                        persistent-hint
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                Frequency Penalty
                                                用於減少文本中單詞和短語的重複。正值會降低已出現詞語的出現機率，有助於產生更多樣化的輸出。
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                            </v-row>
                        </v-container>
                    </v-window-item>

                    <!-- search kwargs 區塊 -->
                    <v-window-item value="search-kwargs" v-if="showSearchKwargs">
                        <v-container>
                            <v-row>
                                <v-col cols="6">
                                    <v-text-field
                                        v-model.number="editedItem.search_kwargs.k"
                                        max="100"
                                        min="1"
                                        step="1"
                                        type="number"
                                        label="K"
                                        hint="資料來源上限  (預設5)"
                                        persistent-hint
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                設定語意相似度搜尋筆數結果的上限
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field
                                        v-model.number="editedItem.search_kwargs.score_threshold"
                                        label="Score Threshold"
                                        type="number"
                                        max="1"
                                        min="0.1"
                                        step="0.1"
                                        hint="語意相似度閾值0.1至1 (預設0.4)"
                                        persistent-hint
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                設定語意相似度搜尋的閾值
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-select
                                        class="w-100"
                                        label="選擇開啟或關閉"
                                        :items="cache_enabled_select"
                                        v-model="editedItem.search_kwargs.cache_enabled"
                                        item-title="text"
                                        hint='是否啟用快取 (預設"開啟")'
                                        persistent-hint
                                        item-value="abbr"
                                        :return-object="false"
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                開啟的話可快取回答的內容，使用者下次問相關問題時可以直接使用快取回答
                                            </v-tooltip>
                                        </template>
                                    </v-select>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field
                                        v-model.number="editedItem.search_kwargs.cache_threshold"
                                        label="cache_threshold"
                                        type="number"
                                        max="1"
                                        min="0"
                                        step="0.05"
                                        hint="快取的語意相似度閾值0至1 (預設0.75)"
                                        persistent-hint
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                設定快取的語意相似度搜尋的閾值
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field
                                        v-model.number="editedItem.search_kwargs.min_extra_chunk_cache_threshold"
                                        label="min_extra_chunk_cache_threshold"
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        hint="相關問題相似度的閾值下限 (預設0.2)"
                                        persistent-hint
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                設定相關問題相似度的閾值下限
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field
                                        v-model.number="editedItem.search_kwargs.max_extra_chunk_cache_threshold"
                                        label="max_extra_chunk_cache_threshold"
                                        type="number"
                                        hint="相關問題相似度的閾值上限 (預設0.6)"
                                        persistent-hint
                                        min="0"
                                        max="1"
                                        step="0.1"
                                    >
                                        <template v-slot:append>
                                            <v-tooltip location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                                                </template>
                                                設定相關問題相似度的閾值上限
                                            </v-tooltip>
                                        </template>
                                    </v-text-field>
                                </v-col>
                            </v-row>
                        </v-container>
                    </v-window-item>
                </v-window>
            </v-card-text>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="close">取消</v-btn>
                <v-btn color="primary" variant="text" @click="save">保存</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
