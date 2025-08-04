<script setup>
import { ref, computed } from "vue";
import { marked } from "marked";
import { useCacheStore } from "@/store";
import { storeToRefs } from "pinia";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const cacheStore = useCacheStore();
const { chunksData, loadingChunksData } = storeToRefs(cacheStore);

const props = defineProps({
    modelValue: Boolean,
    selectedItem: Object,
    previewMode: Boolean,
});

const emit = defineEmits(["update:modelValue", "close", "delete", "togglePreview"]);

const selectedChunk = ref(null);
const selectedChunkIndex = ref(null);

const formattedUpdateTime = computed(() => {
    if (!props.selectedItem?.update_time) return "N/A";
    return dayjs(props.selectedItem.update_time)
        .tz("Asia/Taipei")
        .format("YYYY-MM-DD HH:mm:ss");
});

const parsedAnswer = computed(() => {
    if (!props.selectedItem?.answer) return "";
    return props.previewMode ? marked(props.selectedItem.answer) : props.selectedItem.answer;
});

const parsedChunkContent = (text) => {
    if (!text) return "";
    return props.previewMode ? marked(text) : text;
};

const tooltipVisible = ref(false);

const formattedModelParams = computed(() => {
    if (!props.selectedItem?.model_params) return {};

    let params = { ...props.selectedItem.model_params };
    let systemPrompt = params.system_prompt;
    delete params.system_prompt;

    // 格式化其他參數
    const formattedParams = Object.entries(params).map(([key, value]) => ({
        key,
        value: JSON.stringify(value, null, 2),
    }));

    // 將 system_prompt 移動到最後面
    if (systemPrompt) {
        formattedParams.push({
            key: "system_prompt",
            value: formatSystemPrompt(systemPrompt, 100),
        });
    }

    return formattedParams;
});

const fullSystemPrompt = computed(() => {
    if (!props.selectedItem?.model_params?.system_prompt) return "N/A";
    return formatSystemPrompt(props.selectedItem.model_params.system_prompt);
});

const showFullPrompt = ref(false);

function toggleFullPrompt() {
    showFullPrompt.value = !showFullPrompt.value;
}

function formatSystemPrompt(prompt, maxLength = Infinity) {
    // 去除前後空格並將 \n 轉換為實際的換行
    let formatted = prompt.trim().replace(/\\n/g, "\n");

    if (maxLength < Infinity && formatted.length > maxLength) {
        formatted = formatted.slice(0, maxLength) + "... (點擊查看完整 system prompt)";
    }

    return formatted;
}

function showTooltip() {
    tooltipVisible.value = true;
}

const selectChunk = (index) => {
    selectedChunk.value = [];
    chunksData.value[index].forEach((chunkGroup, i) => {
        if (i === 0) {
            selectedChunk.value.push(...chunkGroup);
        } else {
            selectedChunk.value.push({ hasChunkGap: true });
            selectedChunk.value.push(...chunkGroup);
        }
    });
    selectedChunkIndex.value = index;
};

const stripMarkdownAndHtml = (text) => {
    if (!text) return text;

    let plainText = marked(text);

    let strippedText = plainText.replace(/<[^>]+>/g, "");

    strippedText = strippedText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line)
        .join("\n")
        .replace(/[ \t]+/g, " ");

    return strippedText;
};

const truncateText = (text, length) => {
    if (text) {
        return text.length > length ? text.slice(0, length) + "..." : text;
    } else {
        return text;
    }
};

const deleteItem = (selectedItem) => {
    const id = selectedItem.id;

    emit("delete", id);
};

const chunkBackground = (chunk) => {
    if (chunk.is_target) {
        return chunk.is_target ? "rgba(59, 130, 246, 0.3)" : "rgba(209, 213, 219, 0.5)";
    } else if (chunk.hasChunkGap) {
        return "rgb(255 156 156 / 30%)";
    } else {
        return "rgba(209, 213, 219, 0.5)";
    }
};

const chunksNum = (file) => {
    let count = 0;
    file.forEach((e) => {
        count += e.length;
    });
    return count;
};
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="70%"
        @click:outside="$emit('close')"
    >
        <v-card class="rounded-lg">
            <v-card-title class="px-4 py-2 align-center headline d-flex justify-space-between primary white--text">
                <div class="items-center d-flex">
                    <v-chip class="mr-2">使用次數: {{ selectedItem?.usage_count }}</v-chip>
                    <span class="text-h6">最後更新時間: {{ formattedUpdateTime }}</span>
                </div>
                <div class="d-flex align-center">
                    <v-switch
                        :model-value="previewMode"
                        @update:model-value="$emit('togglePreview')"
                        :label="previewMode ? '預覽' : '純文字'"
                        hide-details
                        class="pt-0 mt-0"
                    ></v-switch>
                    <v-menu v-model="tooltipVisible" :close-on-content-click="false" location="top">
                        <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" @click="showTooltip" small class="mx-2"> mdi-information </v-icon>
                        </template>
                        <v-card class="model-params-tooltip">
                            <v-card-text>
                                <h3 class="tooltip-title">Model Parameters</h3>
                                <div v-if="!showFullPrompt" class="params-list">
                                    <div v-for="param in formattedModelParams" :key="param.key" class="param-item">
                                        <strong>{{ param.key }}:</strong>
                                        <pre v-if="param.key === 'system_prompt'" v-text="param.value"></pre>
                                        <span v-else>{{ param.value }}</span>
                                    </div>
                                </div>
                                <div v-else>
                                    <h4 class="full-prompt-title">完整的 System Prompt:</h4>
                                    <pre v-text="fullSystemPrompt" class="full-prompt"></pre>
                                </div>
                                <v-btn x-small @click="toggleFullPrompt" class="mt-2" color="secondary">
                                    {{ showFullPrompt ? "返回" : "查看完整 System Prompt" }}
                                </v-btn>
                            </v-card-text>
                        </v-card>
                    </v-menu>
                    <v-btn color="error" @click="deleteItem(selectedItem)" small>刪除</v-btn>
                </div>
            </v-card-title>
            <v-card-text class="dialog-content">
                <v-row>
                    <v-col cols="12">
                        <h2 class="mb-3 text-h5">Q:</h2>
                        <p class="mb-6 text-body-1">{{ selectedItem?.question }}</p>
                        <h2 class="mb-3 text-h5">A:</h2>
                        <div v-if="previewMode" v-dompurify-html="parsedAnswer" class="text-body-1 answer"></div>
                        <p v-else class="text-body-1">{{ selectedItem?.answer }}</p>
                    </v-col>
                </v-row>
                <v-divider class="my-6"></v-divider>

                <div v-if="loadingChunksData" class="ga-3 d-flex">
                    <div v-for="i in 3" :key="i" class="custom-skeleton-loader"></div>
                </div>
                <div class="mb-6 sticky-chunks" v-else-if="chunksData.length > 0">
                    <div class="chunk-list-container">
                        <div class="chunk-list" ref="chunkList">
                            <div
                                class="chunk-cards-wrap"
                                v-for="(file, index) in chunksData"
                                :key="'fileChunks-' + index"
                            >
                                <v-card
                                    class="ma-2 chunk-card"
                                    :class="{ selected: selectedChunkIndex === index }"
                                    width="100"
                                    height="60"
                                    @click="selectChunk(index)"
                                >
                                    <v-card-text class="justify-center pa-2 d-flex align-center chunk-content">
                                        {{ truncateText(stripMarkdownAndHtml(file[0][0].page_content), 15) }}
                                    </v-card-text>
                                </v-card>
                                <v-card v-if="chunksNum(file) > 1" class="card-background-1" width="100" height="60">
                                </v-card>
                                <v-card v-if="chunksNum(file) > 1" class="card-background-2" width="100" height="60">
                                </v-card>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else>查無相關來源</div>
                <v-row v-if="selectedChunk">
                    <v-col cols="12">
                        <v-card outlined>
                            <v-card-text class="pa-4">
                                <div class="chunkTitle">
                                    <span class="target"></span>
                                    <span class="text">主要 Chunk</span>
                                    <span class="others"></span>
                                    <span class="text">其他 Chunk</span>
                                </div>
                                <div
                                    class="chunkBox"
                                    v-for="chunk in selectedChunk"
                                    :key="'chunk-' + chunk.id"
                                    :style="{ background: chunkBackground(chunk) }"
                                >
                                    <div
                                        v-if="previewMode && chunk.page_content"
                                        v-dompurify-html="parsedChunkContent(chunk.page_content)"
                                        class="mkd"
                                    ></div>
                                    <div v-else>{{ chunk.hasChunkGap ? "..." : chunk.page_content }}</div>
                                </div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions class="pa-4">
                <!-- <span class="text-body-2">檔案下載: {{ selectedItem?.filename || "N/A" }}</span> -->
                <v-spacer></v-spacer>
                <v-btn text @click="$emit('close')">關閉</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.dialog-content {
    max-height: 70vh;
    overflow-y: auto;
}
.model-params-tooltip {
    max-width: 400px;
    max-height: 400px;
    overflow-y: auto;
    background-color: #f8f9fa;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.tooltip-title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 12px;
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 8px;
}

.params-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.param-item {
    background-color: #ffffff;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.param-item strong {
    color: #34495e;
    font-size: 14px;
    display: block;
    margin-bottom: 4px;
}

.param-item span,
.param-item pre {
    font-size: 13px;
    color: #555;
    line-height: 1.4;
}

.full-prompt-title {
    font-size: 16px;
    font-weight: bold;
    margin-top: 12px;
    margin-bottom: 8px;
    color: #2c3e50;
}

.full-prompt {
    background-color: #ffffff;
    border-radius: 4px;
    padding: 12px;
    font-size: 13px;
    line-height: 1.5;
    color: #333;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
}

.model-params-tooltip pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 12px;
    line-height: 1.4;
    margin-bottom: 10px;
}

.v-tooltip__content {
    background-color: #f5f5f5 !important;
    color: #333 !important;
}
.sticky-chunks {
    position: sticky;
    top: -20px;
    background-color: white;
    z-index: 1;
    padding: 8px 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chunk-list-container {
    overflow-x: auto;
}

.chunk-list {
    display: flex;
    flex-wrap: nowrap;
}

.chunk-cards-wrap {
    position: relative;
}

.chunk-card {
    flex: 0 0 auto;
}

.chunk-card.selected {
    background-color: #f4f4f4;
}

.chunk-content {
    font-size: 0.75rem;
    line-height: 1.2;
    word-break: break-word;
    overflow: hidden;
    display: -webkit-box;
    line-clamp: 4;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
}

.card-background-1 {
    position: absolute;
    background: #b1b1b1;
    transform: rotate(1deg);
    top: 12px;
    left: 12px;
    right: -12px;
    bottom: -12px;
    z-index: -1;
}

.card-background-2 {
    position: absolute;
    background: #7f7f7f;
    transform: rotate(2deg);
    top: 14px;
    left: 14px;
    right: -14px;
    bottom: -14px;
    z-index: -2;
}

.chunkBox {
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 12px;
}

.chunkTitle {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
}

.chunkTitle .text {
    margin-left: 6px;
}

.chunkTitle .target {
    width: 16px;
    aspect-ratio: 1/1;
    background: rgba(59, 130, 246, 0.3);
    border-radius: 3px;
}

.chunkTitle .sub {
    width: 16px;
    aspect-ratio: 1/1;
    background: rgba(59, 130, 246, 0.3);
    margin-left: 24px;
    border-radius: 3px;
}

.chunkTitle .others {
    width: 16px;
    aspect-ratio: 1/1;
    background: rgb(255, 215, 215);
    margin-left: 24px;
    border-radius: 3px;
}

.custom-skeleton-loader {
    width: 100px;
    height: 60px;
    background-color: #e0e0e0;
    border-radius: 4px;
    animation: skeleton-loading 1.5s infinite linear;
}

@keyframes skeleton-loading {
    0% {
        background-color: #e0e0e0;
    }
    50% {
        background-color: #f0f0f0;
    }
    100% {
        background-color: #e0e0e0;
    }
}
</style>
