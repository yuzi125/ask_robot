<script setup>
import { ref, watch, computed, inject, nextTick } from "vue";
import { useWindowSize } from "@vueuse/core";
const emitter = inject("emitter");
import { useRoute } from "vue-router";
const route = useRoute();

import dayjs from "dayjs";
import { marked } from "marked";
import { updateAdminProcess } from "@/network/service";

import ConfirmComponents from "@/components/ConfirmComponents.vue";

import { useUserStore } from "@/store/index";
const userStore = useUserStore();
import { storeToRefs } from "pinia";
const { uid } = storeToRefs(userStore);

const props = defineProps({
    openDialog: Boolean,
    dialogActiveKey: Number,
    dialogData: Object,
    processHistory: {
        type: Array,
        default: () => [],
    },
    operatorOptions: {
        type: Array,
        default: () => [],
    },
    feedbackOptions: {
        type: Array,
        default: () => [],
    },
});
const emit = defineEmits(["handleCloseDialog", "handleProcessSuccess"]);

const formatChunksData = computed(() => {
    try {
        let formatData = props.dialogData.source_chunk_content.map((file) => {
            let formatFileChunks = [];
            file.forEach((chunks, index) => {
                if (index === 0) {
                    formatFileChunks = formatFileChunks.concat(chunks);
                } else {
                    formatFileChunks.push({ isGap: true, content: "..." });
                    formatFileChunks = formatFileChunks.concat(chunks);
                }
            });
            return formatFileChunks;
        });
        return formatData;
    } catch (error) {
        return [];
    }
});

// 每次dialog打開時將一些元件與內容初始化
watch(
    () => props.dialogActiveKey,
    () => {
        // 風琴元件，預設QA打開。
        openPanelList.value = ["QA-info"];
        // 清空處理輸入欄位
        selectedFeedbackTags.value = [];
        adminComment.value = "";
    }
);

// 決定視窗劉海顏色
const dialogTitleColor = (type) => {
    switch (type) {
        case "user_positive":
            return { background: "#E8F5E9" };
        case "user_negative":
            return { background: "#FCE4EC" };
        default:
            return { background: "#ECEFF1" };
    }
};

// 風琴元件功能
const openPanelList = ref(["QA-info"]);

// 內容顯示格式切換功能
const previewMode = ref(true);
const parsedAnswer = computed(() => {
    if (!props.dialogData.answer) return "";
    const answer = props.dialogData.answer;
    if (answer) {
        return previewMode.value ? marked(answer) : answer;
    } else {
        return "";
    }
});

const stripMarkdownAndHtml = (text) => {
    if (!text) return "";

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
    return text.length > length ? text.slice(0, length) + "..." : text;
};

// chunks選擇
const selectedChunk = ref(null);
const selectedChunkIndex = ref(null);
const targetMetaData = ref(null);
const selectChunk = (index) => {
    if (selectedChunkIndex.value === index) {
        selectedChunk.value = null;
        selectedChunkIndex.value = null;
        targetMetaData.value = null;
    } else {
        selectedChunk.value = formatChunksData.value[index];

        selectedChunkIndex.value = index;
        targetMetaData.value =
            JSON.parse(formatChunksData.value[index].find((chunk) => chunk.is_target)?.meta_data) || null;
        if (targetMetaData.value["chunk_type"] === "crawler") {
            let datasource_name = targetMetaData.value["datasource_name"];

            const nameParts = datasource_name?.split("-") || [];
            if (nameParts.length > 1) {
                if (nameParts[0]?.trim() === nameParts[1]?.trim()) {
                    targetMetaData.value["datasource_name"] = nameParts[0];
                }
            }
        }
    }
};
watch(
    () => props.dialogData?.datasource_info,
    () => {
        selectedChunk.value = null;
        selectedChunkIndex.value = null;
    }
);

// 顯示回答與chunks詳細視窗
const showFullView = ref(false);
const fullViewType = ref("");
const openFullView = (type) => {
    showFullView.value = true;
    fullViewType.value = type;
};

// 管理者處理
const adminComment = ref("");
const adminStatus = ref("");
const feedbackProcess = async () => {
    if (!props.dialogData.id || !uid.value) {
        emitter.emit("openSnackbar", {
            message: "資料錯誤，請回到上一頁並刷新頁面後，再試一次，謝謝!",
            color: "warning",
        });
        return;
    }

    const reqBody = {
        feedbackId: props.dialogData.id,
        statusId: [props.dialogData.status],
        tagsId: selectedFeedbackTags.value.map((e) => e.id),
        userId: uid.value,
        comment: adminComment.value,
    };

    const rs = await updateAdminProcess(reqBody);

    if (!rs) {
        emitter.emit("openSnackbar", {
            message:
                "評論處理過程中發生錯誤，請重新整理頁面後，再試一次。(若問題仍無法請聯繫維護單位，造成不便，請見諒。)",
            color: "error",
        });
    } else if (rs && rs.status === 200 && rs.data) {
        emitter.emit("openSnackbar", {
            message: rs.data.message,
            color: "success",
        });
        // 資料刷新
        adminComment.value = "";
        emit("handleProcessSuccess");
    }
};
// 名稱過濾
const checkNameAndID = (name, ID) => {
    if ((name, ID)) {
        return `${name} - ${ID}`;
    } else {
        return "遊客";
    }
};

// 確認視窗
// const confirm_com = ref(null);
// const confirmOpen = function (item) {
//     confirm_com.value.open(item);
// };

// 管理者替此評論加上標籤
const selectedFeedbackTags = ref([]);
const feedbackTags = computed(() => {
    return props.feedbackOptions
        .filter((e) => e.status.match("feedback_tag"))
        .sort((a, b) => {
            return a.id - b.id;
        });
});
const itemProps = (item) => {
    return {
        title: item.name,
        subtitle: item.status === "feedback_tag_positive" ? "正面標籤" : "負面標籤",
    };
};
const getTagName = (tagsId) => {
    const tagList = tagsId.map((id) => {
        return feedbackTags.value.find((tag) => tag.id === id) || {};
    });
    return tagList || [];
};

// 檢查視窗寬度
const { width } = useWindowSize();
const isLargeScreen = computed(() => width.value > 1240);

const chunkContentBox = ref(null);
const chunkContentFullBox = ref(null);

watch(
    () => selectedChunk.value,
    (newVal) => {
        if (newVal) {
            nextTick(() => {
                if (chunkContentBox.value) {
                    chunkContentBox.value.scrollTo({
                        top: 0,
                        behavior: "smooth",
                    });
                }
                if (chunkContentFullBox.value) {
                    chunkContentFullBox.value.scrollTo({
                        top: 0,
                        behavior: "smooth",
                    });
                }
            });
        }
    }
);

const tooltipVisible = ref(false);
const showFullPrompt = ref(false);

const fullPrompt = computed(() => {
    if (!props.dialogData?.model_params?.prompt) return "N/A";
    return formatPrompt(props.dialogData.model_params.prompt);
});

const formattedModelParams = computed(() => {
    if (!props.dialogData?.model_params) return {};

    let params = { ...props.dialogData.model_params };
    let prompt = params.prompt;
    delete params.system_prompt;
    delete params.prompt;

    // 格式化其他參數
    const formattedParams = Object.entries(params).map(([key, value]) => ({
        key,
        value: JSON.stringify(value, null, 2),
    }));

    // 將 prompt 移動到最後面
    if (prompt) {
        formattedParams.push({
            key: "prompt",
            value: formatPrompt(prompt, 100),
        });
    }

    return formattedParams;
});

function formatPrompt(prompt, maxLength = Infinity) {
    // 去除前後空格並將 \n 轉換為實際的換行
    let formatted = prompt.trim().replace(/\\n/g, "\n");

    if (maxLength < Infinity && formatted.length > maxLength) {
        formatted = formatted.slice(0, maxLength) + "... (點擊查看完整 prompt)";
    }

    return formatted;
}

function showTooltip() {
    tooltipVisible.value = true;
}

function toggleFullPrompt() {
    showFullPrompt.value = !showFullPrompt.value;
}

// 更改檔案副檔名
const changeFileExtension = (filename, originalname) => {
    const originalExtension = originalname?.split(".").pop();
    const baseFilename = filename?.split(".").slice(0, -1).join(".");
    return `${baseFilename}.${originalExtension}`;
};

// 開啟外部連結 因為用 :href 會有 xss 的問題
const openExternalLink = (url) => {
    emitter.emit("openUrl", url);
};

// 檢查是否是 IPv4 映射 IPv6 地址（以 ::ffff: 開頭）
const formatIP = (ip) => {
    if (ip.startsWith("::ffff:")) {
        return ip.split("::ffff:")[1];
    }
    return ip;
};

const currentFullUrl = window.location.href;
const urlObj = new URL(currentFullUrl);
const domain = urlObj.origin;

function getChunkColor(chunk) {
    if (chunk.isGap) {
        return "rgb(255 215 215)";
    } else if (chunk.is_target) {
        return "rgba(96, 165, 250, 0.2)";
    } else {
        return "rgba(107, 114, 128, 0.2)";
    }
}
</script>

<template>
    <div>
        <v-dialog v-model="props.openDialog" max-width="1200">
            <v-card>
                <v-card-title class="dialog-title" :style="dialogTitleColor(props.dialogData.feedback_type)">
                    <p>詳細資訊</p>
                    <div class="dialog-title-action">
                        <v-switch
                            :color="previewMode ? 'blue' : ''"
                            :model-value="previewMode"
                            @update:model-value="previewMode = !previewMode"
                            :label="previewMode ? '預覽' : '文字'"
                            hide-details
                            class="pt-0 mt-0"
                        ></v-switch>
                        <v-menu v-model="tooltipVisible" :close-on-content-click="false" location="top">
                            <template v-slot:activator="{ props }">
                                <v-icon v-bind="props" @click="showTooltip" small class="mx-2">
                                    mdi-information
                                </v-icon>
                            </template>
                            <v-card class="model-params-tooltip">
                                <v-card-text>
                                    <h3 class="tooltip-title">Model Parameters</h3>
                                    <div v-if="!showFullPrompt" class="params-list">
                                        <div v-for="param in formattedModelParams" :key="param.key" class="param-item">
                                            <strong>{{ param.key }}:</strong>
                                            <pre v-if="param.key === 'prompt'" v-text="param.value"></pre>
                                            <span v-else>{{ param.value }}</span>
                                        </div>
                                    </div>
                                    <div v-else>
                                        <h4 class="full-prompt-title">完整的 Prompt:</h4>
                                        <pre v-text="fullPrompt" class="full-prompt"></pre>
                                    </div>
                                    <v-btn x-small @click="toggleFullPrompt" class="mt-2" color="secondary">
                                        {{ showFullPrompt ? "返回" : "查看完整 Prompt" }}
                                    </v-btn>
                                </v-card-text>
                            </v-card>
                        </v-menu>
                    </div>
                </v-card-title>

                <v-card-text class="overflow-y-auto">
                    <v-container fluid>
                        <v-row>
                            <v-col :cols="isLargeScreen ? 6 : 12" class="pt-0">
                                <v-expansion-panels multiple v-model="openPanelList">
                                    <v-expansion-panel value="user-info">
                                        <v-expansion-panel-title
                                            collapse-icon="mdi-minus"
                                            expand-icon="mdi-plus"
                                            class="active-panel-title"
                                        >
                                            使用者資訊
                                        </v-expansion-panel-title>
                                        <v-expansion-panel-text>
                                            <div class="user-info-container">
                                                <div class="user-info">
                                                    <label>
                                                        <i class="fa-solid fa-user"></i> 使用者 :
                                                        <span>{{ props.dialogData.userProcess.name || "遊客" }}</span>
                                                    </label>
                                                </div>
                                                <div class="user-info">
                                                    <label>
                                                        <i class="fa-regular fa-address-card"></i> 職編 :
                                                        <span>{{ props.dialogData.userProcess.authID || "無" }}</span>
                                                    </label>
                                                </div>
                                                <div class="user-info">
                                                    <label>
                                                        <i class="fa-solid fa-globe"></i> IP位址 :
                                                        <span>{{ formatIP(props.dialogData.ip || "無") }}</span>
                                                    </label>
                                                </div>
                                                <div>
                                                    <label>
                                                        <i class="fa-regular fa-clock"></i> 評論時間 :
                                                        <span>{{
                                                            dayjs(props.dialogData.create_time).format(
                                                                "YYYY-MM-DD HH:mm:ss"
                                                            )
                                                        }}</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </v-expansion-panel-text>
                                    </v-expansion-panel>

                                    <v-expansion-panel value="QA-info">
                                        <v-expansion-panel-title collapse-icon="mdi-minus" expand-icon="mdi-plus">
                                            問答資訊
                                        </v-expansion-panel-title>
                                        <v-expansion-panel-text class="position-relative">
                                            <div class="justify-end d-flex">
                                                <div class="showFullChunkBtn" @click="openFullView('QA')">
                                                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                                    <v-tooltip activator="parent" location="end">放大檢視</v-tooltip>
                                                </div>
                                            </div>
                                            <div class="QA-container">
                                                <div class="question">
                                                    <h2>問 :</h2>
                                                    <p>{{ props.dialogData.question }}</p>
                                                </div>
                                                <h2>答 :</h2>
                                                <div class="answer-box">
                                                    <div
                                                        v-if="previewMode"
                                                        v-dompurify-html="parsedAnswer"
                                                        class="mkd"
                                                    ></div>
                                                    <p v-else class="text-body-1">{{ props.dialogData.answer }}</p>
                                                </div>
                                            </div>
                                        </v-expansion-panel-text>
                                    </v-expansion-panel>

                                    <v-expansion-panel value="chunks-info">
                                        <v-expansion-panel-title collapse-icon="mdi-minus" expand-icon="mdi-plus">
                                            資料來源
                                        </v-expansion-panel-title>
                                        <v-expansion-panel-text class="position-relative">
                                            <div class="justify-end d-flex">
                                                <div class="showFullChunkBtn" @click="openFullView('chunk')">
                                                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                                    <v-tooltip activator="parent" location="end">放大檢視</v-tooltip>
                                                </div>
                                            </div>
                                            <div class="datasets-container">
                                                <span>來源知識庫 : </span>
                                                <div class="dataset-chip-group">
                                                    <div
                                                        class="dataset-chip"
                                                        v-for="dataset in props.dialogData.datasets"
                                                        :key="dataset.datasets_id"
                                                    >
                                                        {{ dataset.name }}
                                                    </div>
                                                    <div v-if="props.dialogData.datasets.length === 0" color="info">
                                                        無相關來源
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="chunks-container">
                                                <span>資料來源 : </span>
                                                <p class="no-chunks" v-if="formatChunksData.length === 0">
                                                    無相關資料來源
                                                </p>
                                                <div class="chunk-list">
                                                    <div
                                                        v-for="(fileChunks, index) in formatChunksData"
                                                        :key="'fileChunks-' + index"
                                                        @click="selectChunk(index)"
                                                        class="position-relative"
                                                    >
                                                        <div
                                                            class="chunk-card"
                                                            :class="{ activeChunk: selectedChunkIndex === index }"
                                                        >
                                                            {{
                                                                truncateText(
                                                                    stripMarkdownAndHtml(fileChunks[0].content),
                                                                    15
                                                                )
                                                            }}
                                                        </div>
                                                        <div
                                                            v-if="fileChunks.length > 1"
                                                            class="chunk-card multi-chunk-card"
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="justify-end chunk-color-tips d-flex align-center">
                                                <span class="main"></span>
                                                <span class="mr-3">主要 Chunk</span>
                                                <span class="sub"></span>
                                                <span class="mr-3">補全 Chunk</span>
                                                <span class="others"></span>
                                                <span>其他 Chunk</span>
                                            </div>
                                            <div class="m-2 chunk-content-box" ref="chunkContentBox">
                                                <div v-if="selectedChunk" class="chunk-content">
                                                    <div>
                                                        <div
                                                            v-for="(chunk, index) in selectedChunk"
                                                            :key="'chunk' + index"
                                                            class="chunk-box"
                                                            :style="{
                                                                background: getChunkColor(chunk),
                                                            }"
                                                        >
                                                            <div
                                                                class="mkd parsed-chunk"
                                                                v-if="previewMode && chunk.content"
                                                                v-dompurify-html="marked(chunk.content)"
                                                            ></div>
                                                            <div v-else>{{ chunk.content }}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="not-select-text" v-else>尚未選取資料來源</div>
                                            </div>
                                            <div class="fixed-bottom" v-if="selectedChunk">
                                                <div class="bottom-content">
                                                    <div
                                                        class="link-row"
                                                        v-if="
                                                            targetMetaData?.datasource_url ||
                                                            targetMetaData?.datasource_name
                                                        "
                                                    >
                                                        <span class="link-label">外部連結:</span>
                                                        <span class="link-content">
                                                            <template
                                                                v-if="
                                                                    targetMetaData.datasource_name &&
                                                                    !targetMetaData.datasource_url
                                                                "
                                                            >
                                                                {{ targetMetaData.datasource_name }}
                                                            </template>
                                                            <template
                                                                v-else-if="
                                                                    targetMetaData.datasource_url &&
                                                                    !targetMetaData.datasource_name
                                                                "
                                                            >
                                                                <a
                                                                    class="external-link"
                                                                    @click.stop="
                                                                        openExternalLink(targetMetaData.datasource_url)
                                                                    "
                                                                >
                                                                    點擊此處
                                                                </a>
                                                            </template>
                                                            <template v-else>
                                                                <a
                                                                    class="external-link"
                                                                    @click.stop="
                                                                        openExternalLink(targetMetaData.datasource_url)
                                                                    "
                                                                >
                                                                    {{ targetMetaData.datasource_name }}
                                                                </a>
                                                            </template>
                                                        </span>
                                                    </div>
                                                    <div class="link-row" v-if="targetMetaData?.filename">
                                                        <span class="link-label">檔案下載:</span>
                                                        <span class="link-content">
                                                            <a
                                                                class="external-link"
                                                                @click.stop="
                                                                    openExternalLink(
                                                                        `${domain}/ava/backend/download/${changeFileExtension(
                                                                            targetMetaData.filename,
                                                                            targetMetaData.originalname
                                                                        )}`
                                                                    )
                                                                "
                                                            >
                                                                {{ targetMetaData.originalname }}
                                                            </a>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </v-expansion-panel-text>
                                    </v-expansion-panel>
                                </v-expansion-panels>
                            </v-col>

                            <v-col :cols="isLargeScreen ? 6 : 12">
                                <v-row>
                                    <!-- 使用者評價 -->
                                    <v-col cols="12" class="seperate-box">
                                        <h2>使用者評價</h2>
                                        <p class="mb-2 title">
                                            評論類別 :
                                            <span v-if="dialogData.feedback_type === 'user_positive'">
                                                <i class="fas fa-thumbs-up" style="color: green"></i> 好評
                                            </span>
                                            <span v-else-if="dialogData.feedback_type === 'user_negative'">
                                                <i class="fas fa-thumbs-down" style="color: red"></i> 負評
                                            </span>
                                            <span v-else>--</span>
                                        </p>
                                        <div class="feedback-tag-box">
                                            <p class="title">評價標籤 :</p>
                                            <v-chip-group>
                                                <v-chip
                                                    class="mx-1"
                                                    v-for="tag in dialogData.userProcess.options"
                                                    :color="
                                                        dialogData.feedback_type === 'user_positive' ? 'success' : 'red'
                                                    "
                                                    :style="{
                                                        color:
                                                            dialogData.feedback_type === 'user_positive'
                                                                ? 'green'
                                                                : 'red',
                                                    }"
                                                >
                                                    {{ props.feedbackOptions.find((e) => e.id === tag).name || "--" }}
                                                </v-chip>
                                            </v-chip-group>
                                        </div>
                                        <div class="feedback-text-box">
                                            <p class="title">評論內容 :</p>
                                            <p class="content">
                                                {{ dialogData.userProcess.comment || "無" }}
                                            </p>
                                        </div>
                                    </v-col>

                                    <v-col cols="12"></v-col>
                                    <!-- 處理 -->
                                    <v-col cols="12" class="seperate-box">
                                        <div class="process-title">
                                            <h2>處理</h2>
                                        </div>
                                        <div class="mb-3 d-flex">
                                            <p class="pr-1 admin-title">處理狀態 :</p>
                                            <v-select
                                                v-model="props.dialogData.status"
                                                :items="props.operatorOptions"
                                                item-title="name"
                                                item-value="id"
                                                hide-details
                                                variant="outlined"
                                                density="compact"
                                            ></v-select>
                                        </div>
                                        <div class="mb-3 d-flex">
                                            <p class="admin-title">處理內容 :</p>
                                            <v-textarea
                                                row-height="15"
                                                rows="1"
                                                auto-grow
                                                v-model="adminComment"
                                                clearable
                                                label="內容"
                                                hide-details
                                            ></v-textarea>
                                        </div>
                                        <div class="mb-3">
                                            <div class="mb-2 justify-space-between d-flex align-end">
                                                <p class="admin-title">評論標籤 :</p>
                                            </div>
                                            <v-select
                                                v-model="selectedFeedbackTags"
                                                :item-props="itemProps"
                                                :items="feedbackTags"
                                                variant="outlined"
                                                multiple
                                                hide-details
                                                placeholder="請選擇評論標籤"
                                                clearable
                                            >
                                                <template v-slot:selection="{ item, index }">
                                                    <v-chip
                                                        :color="
                                                            item.value.status === 'feedback_tag_positive'
                                                                ? 'green'
                                                                : 'red'
                                                        "
                                                        size="large"
                                                    >
                                                        <span>{{ item.title }}</span>
                                                    </v-chip>
                                                </template>
                                            </v-select>
                                        </div>
                                        <div class="mb-3">
                                            <p class="mb-2 admin-title">處理歷程 :</p>
                                            <div class="table-wrap">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>姓名/職編</th>
                                                            <th>狀態</th>
                                                            <th>內容</th>
                                                            <th>標籤</th>
                                                            <th>更新時間</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr v-for="data in processHistory" :key="data.id">
                                                            <td>
                                                                {{ checkNameAndID(data.user_name, data.auth_id) }}
                                                                <v-tooltip activator="parent" location="top">
                                                                    {{
                                                                        checkNameAndID(data.user_name, data.auth_id)
                                                                    }}</v-tooltip
                                                                >
                                                            </td>

                                                            <td>
                                                                {{
                                                                    props.operatorOptions.find(
                                                                        (e) => e.id === data.feedback_options_ids[0]
                                                                    )?.name || "--"
                                                                }}
                                                                <v-tooltip activator="parent" location="top">
                                                                    {{
                                                                        props.operatorOptions.find(
                                                                            (e) => e.id === data.feedback_options_ids[0]
                                                                        )?.name || "--"
                                                                    }}</v-tooltip
                                                                >
                                                            </td>
                                                            <td>
                                                                {{ data.comment }}
                                                                <v-tooltip activator="parent" location="top">
                                                                    <span style="white-space: pre-wrap">{{
                                                                        data.comment
                                                                    }}</span></v-tooltip
                                                                >
                                                            </td>
                                                            <td>
                                                                <div class="align-end justify-space-between d-flex">
                                                                    <div
                                                                        v-for="(tag, index) in getTagName(data.tags_id)"
                                                                    >
                                                                        <v-chip
                                                                            v-if="index === 0"
                                                                            :key="'tag-' + index"
                                                                            :color="
                                                                                tag.status.match('positive')
                                                                                    ? 'success'
                                                                                    : 'red'
                                                                            "
                                                                            >{{ tag.name }}</v-chip
                                                                        >
                                                                        <span v-else-if="index === 1">...</span>
                                                                    </div>
                                                                </div>
                                                                <v-tooltip activator="parent" location="top">
                                                                    <v-chip
                                                                        v-for="(tag, index) in getTagName(data.tags_id)"
                                                                        class="mx-1"
                                                                        :key="'tag-' + index"
                                                                        variant="flat"
                                                                        :color="
                                                                            tag.status.match('positive')
                                                                                ? 'success'
                                                                                : 'red'
                                                                        "
                                                                        >{{ tag.name }}</v-chip
                                                                    ></v-tooltip
                                                                >
                                                            </td>
                                                            <td>
                                                                {{ dayjs(data.update_time).format("YYYY-MM-DD HH:mm") }}
                                                                <v-tooltip activator="parent" location="top">
                                                                    {{
                                                                        dayjs(data.update_time).format(
                                                                            "YYYY-MM-DD HH:mm"
                                                                        )
                                                                    }}</v-tooltip
                                                                >
                                                            </td>
                                                        </tr>
                                                        <tr v-if="processHistory.length === 0">
                                                            <td class="table-no-data" colspan="5">尚無處理相關資訊</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </v-col>
                                </v-row>
                            </v-col>
                        </v-row>
                    </v-container>
                </v-card-text>

                <v-card-actions class="card-actions-custom">
                    <v-spacer></v-spacer>
                    <v-btn size="large" color="red" @click="emit('handleCloseDialog')">關閉</v-btn>
                    <v-btn size="large" color="info" @click="feedbackProcess">儲存</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- <ConfirmComponents
            ref="confirm_com"
            type="info"
            message="確定要儲存此次修改嗎 ?"
            :confirmBtn="true"
            @confirm="feedbackProcess"
            saveBtnName="確認"
            closeBtnName="取消"
        ></ConfirmComponents> -->

        <v-overlay opacity="0.7" v-model="showFullView" class="justify-center align-center">
            <div class="fullDataView">
                <v-btn
                    class="mb-3 ml-auto mr-3 d-block"
                    density="comfortable"
                    @click="showFullView = false"
                    style="
                        background-color: #000000;
                        color: #fff;
                        border-radius: 50%;
                        min-width: 20px;
                        min-height: 20px;
                    "
                    icon
                >
                    <span style="font-size: 16px">x</span>
                </v-btn>
                <div class="content">
                    <v-switch
                        :color="previewMode ? 'blue' : ''"
                        :model-value="previewMode"
                        @update:model-value="previewMode = !previewMode"
                        :label="previewMode ? '預覽' : '文字'"
                        hide-details
                        class="switch-full-view"
                    ></v-switch>
                    <div class="h-100 d-flex flex-column" v-if="fullViewType === 'chunk'">
                        <div class="datasets-container">
                            <span>來源知識庫 : </span>
                            <div v-for="dataset in dialogData.datasets" :key="dataset.id">
                                <v-chip v-if="dataset.id" color="info">
                                    {{ dataset.name }}
                                </v-chip>
                                <v-chip v-else color="info"> 無相關來源 </v-chip>
                            </div>
                        </div>
                        <div class="chunks-container">
                            <span>資料來源 : </span>
                            <p class="no-chunks" v-if="formatChunksData.length === 0">無相關資料來源</p>
                            <div class="chunk-list">
                                <div
                                    class="position-relative"
                                    v-for="(fileChunks, index) in formatChunksData"
                                    :key="'fileChunks-' + index"
                                >
                                    <div
                                        class="chunk-card"
                                        :class="{ activeChunk: selectedChunkIndex === index }"
                                        @click="selectChunk(index)"
                                    >
                                        {{ truncateText(stripMarkdownAndHtml(fileChunks[0].content), 15) }}
                                    </div>
                                    <div v-if="fileChunks.length > 0" class="chunk-card multi-chunk-card"></div>
                                </div>
                            </div>
                        </div>
                        <div class="justify-end chunk-color-tips d-flex align-center">
                            <span class="main"></span>
                            <span class="mr-3">主要 Chunk</span>
                            <span class="sub"></span>
                            <span class="mr-3">補全 Chunk</span>
                            <span class="others"></span>
                            <span>其他 Chunk</span>
                        </div>
                        <div class="chunk-content-full-view" ref="chunkContentFullBox">
                            <div v-if="selectedChunk">
                                <div>
                                    <div
                                        v-for="(chunk, index) in selectedChunk"
                                        :key="'chunk' + index"
                                        class="chunk-box"
                                        :style="{
                                            background: getChunkColor(chunk),
                                        }"
                                    >
                                        <div
                                            class="mkd parsed-chunk"
                                            v-if="previewMode && chunk.content"
                                            v-dompurify-html="marked(chunk.content)"
                                        ></div>
                                        <div v-else>{{ chunk.content }}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="not-select-text" v-else>尚未選取資料來源</div>
                        </div>
                    </div>
                    <div class="h-100 d-flex flex-column" v-else>
                        <div class="align-center d-flex ga-3">
                            <h2 class="text-h5 text-nowrap">問 :</h2>
                            <p>{{ props.dialogData.question }}</p>
                        </div>
                        <h2 class="text-h5">答 :</h2>
                        <div class="answer-box-full-view">
                            <div v-if="previewMode" v-dompurify-html="parsedAnswer" class="mkd"></div>
                            <p v-else class="text-body-1">{{ props.dialogData.answer }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </v-overlay>
    </div>
</template>

<style scoped>
.text-nowrap {
    white-space: nowrap;
}

.dialog-title-action {
    display: flex;
    justify-content: center;
    align-items: center;
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

/* Dialog 視窗樣式 */
.dialog-title {
    display: flex;
    justify-content: space-between;
    p {
        font-size: 2rem;
        font-weight: 900;
    }
}

/* expansion-panel 樣式 */
:deep(.v-expansion-panel-text__wrapper) {
    padding: 12px;
}

:deep(.v-expansion-panel-title--active) {
    background-color: #bbdefb73;
}

/* 使用者資訊 */
.user-info-container {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 20px;
}

.user-info {
    width: 45%;
}

/* 問答 */
.QA-container {
    h2 {
        font-size: 20px;
        margin-bottom: 6px;
    }
    .question {
        margin-top: 6px;
        display: flex;
        gap: 12px;
        > h2 {
            padding-top: 6px;
            text-wrap: nowrap;
        }
        > p {
            padding-top: 6px;
            max-height: 100px;
            min-height: 18px;
            overflow-y: auto;
            line-height: normal;
        }
    }
    .answer-box {
        max-height: 300px;
        overflow-y: auto;
        border: 0.5px solid rgba(128, 128, 128, 0.185);
        border-radius: 9px;
        padding: 5px;
    }
}

/* 資料來源 */
.datasets-container {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    > span {
        font-size: 1rem;
        text-wrap: nowrap;
    }
    .dataset-chip-group {
        overflow-x: auto;
        display: flex;
        gap: 6px;
        align-items: center;
        .dataset-chip {
            background: #e3f2fd;
            color: #1e88e5;
            font-weight: 700;
            padding: 8px 12px;
            border-radius: 15px;
            flex-grow: 0;
            flex-shrink: 0;
        }
    }
}

.chunks-container {
    margin-top: 24px;
    display: flex;
    gap: 3px;
    > span {
        font-size: 1rem;
        white-space: nowrap;
    }
    .no-chunks {
        text-align: center;
        color: rgb(82, 82, 82);
        font-size: 16px;
        font-weight: 700;
    }
}

.chunk-list {
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    padding: 0px 12px 12px 0px;
    overflow-x: auto;
    .chunk-card {
        flex: 0 0 auto;
        background-color: white;
        cursor: pointer;
        width: 100px;
        height: 60px;
        border-radius: 5px;
        box-shadow: 2px 2px 2px rgba(128, 128, 128, 0.486);
        padding: 6px;
        position: relative;
        z-index: 1;

        font-size: 0.8rem;
        font-weight: 700;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: normal;
    }
    .chunk-card.activeChunk {
        background-color: #e1f5fe;
    }
    .multi-chunk-card {
        position: absolute;
        top: 0px;
        left: 7px;
        /* 設定旋轉錨點為左上角 */
        transform-origin: 0 0;
        /* 設定旋轉的角度，例如 45 度 */
        transform: rotate(4deg);
        z-index: 0;
        background: rgb(182, 182, 182);
    }
}

.chunk-content-box {
    border: 3px solid rgba(128, 128, 128, 0.5);
    background-color: white;
    border-radius: 5px;
    max-height: calc(300px - 70px);
    overflow-y: auto;
    margin-top: 6px;
    padding: 6px;
    position: relative;
    .chunk-content {
        min-height: 100%;
    }

    .parsed-chunk {
        white-space: pre-line;
    }

    .not-select-text {
        padding-top: 6px;
        text-align: center;
    }
}

.showFullChunkBtn {
    cursor: pointer;
    &:hover {
        color: blue;
    }
}

.fixed-bottom {
    position: relative;
    background-color: white;
    border-top: 1px solid #ccc;
    padding: 10px;
    margin-top: 6px;
    border-radius: 0 0 5px 5px;
    max-height: 70px;
    overflow-y: auto;
}

.bottom-content {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.link-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
}

.link-label {
    flex-shrink: 0;
    font-weight: bold;
    min-width: 80px;
}

.link-content {
    flex-grow: 1;
    word-break: break-all;
}

.external-link {
    text-decoration: underline;
    cursor: pointer;

    &:hover {
        opacity: 0.8;
    }
}

.fullDataView {
    width: 90vw;
    /* max-width: 1024px; */
    height: 90vh;
    background: white;
    padding: 10px 0px 0px 0px;
    display: flex;
    flex-direction: column;
    .content {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 24px;
        background: #a7a7a75e;
        .switch-full-view {
            position: absolute;
            right: 100px;
            top: 0px;
        }
        .chunk-content-full-view {
            flex: 1 1 auto;
            overflow-y: auto;
            background: white;
            padding: 12px;
            border-radius: 10px;
        }
        .answer-box-full-view {
            flex: 1 1 auto;
            overflow-y: auto;
            background: white;
            padding: 12px;
            border-radius: 10px;
        }
    }
}

/* 虛線容器 */
.seperate-box {
    border: 3px dashed rgba(133, 133, 133, 0.541);
    padding: 12px;
    border-radius: 15px;
    h2 {
        margin-bottom: 4px;
        font-size: 20px;
    }
}

/* 使用者評價 */
.feedback-tag-box {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
    .title {
        text-wrap: nowrap;
    }
}

.feedback-text-box {
    display: flex;
    gap: 3px;
    .title {
        text-wrap: nowrap;
    }
    .content {
        max-height: 100px;
        min-height: 18px;
        overflow-y: auto;
    }
}

/* 處理欄位 */
.process-title {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
}

.admin-title {
    width: 80px;
}

.error-msg {
    color: red;
}

.card-actions-custom {
    border-top: 1px solid #e0e0e0; /* 添加邊框以分隔滾動內容 */
}

.table-wrap {
    overflow-x: auto;
    table {
        width: 100%;
        border-collapse: collapse;
    }
    table,
    th,
    td {
        border: 1px solid rgb(173, 173, 173);
    }
    th,
    td {
        max-width: 100px;
        padding: 8px;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    th {
        background-color: #f2f2f2;
        white-space: nowrap;
    }
    .table-no-data {
        text-align: center;
    }

    .active-panel-title {
        background-color: red;
    }
}

.v-tooltip .v-overlay__content .chip {
    background: white;
}

.chunk-box {
    padding: 16px;
    border-radius: 12px;
    margin-bottom: 12px;
}

.chunk-color-tips {
    margin: 10px 0px 10px 0px;
    .main {
        background: rgba(96, 165, 250, 0.5);
        width: 15px;
        height: 15px;
        margin-right: 6px;
    }
    .sub {
        background: rgba(107, 114, 128, 0.5);
        width: 15px;
        height: 15px;
        margin-right: 6px;
    }
    .others {
        background: rgb(255, 215, 215);
        width: 15px;
        height: 15px;
        margin-right: 6px;
    }
}
</style>
