<script setup>
import { ref, inject, watch, onMounted } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { formatGitStyleDiff } from "@/utils/crawler";
import { useLocalStorage } from "@vueuse/core";

const axios = inject("axios");
const emitter = inject("emitter");
const queryClient = useQueryClient();
const backupTemplateConfigData = useLocalStorage("crawler-template-config-data", {});

// 模板配置資料 - 使用深拷貝來保存從 Vue Query 獲取的數據
const templateConfigData = ref({});
// 保存原始數據用於比較
const originalTemplateData = ref({});
// 編輯器內容
const editorContent = ref("");
const validationError = ref("");

// 搜尋相關
const textareaRef = ref(null);

// 變更預覽對話框相關
const diffPreviewDialog = ref(false);
const diffHtml = ref("");
const successDetails = ref({
    message: "",
    changedCount: 0,
});

// 使用 Vue Query 獲取模板配置
const fetchTemplateConfig = async () => {
    const res = await axios.get("/crawlerFastAPI/getCrawlerTemplateConfig");
    return res.data.data; // 確保返回 res.data.data
};

const { isLoading, isFetching, data } = useQuery({
    queryKey: ["crawlerTemplateConfig"],
    queryFn: fetchTemplateConfig,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5分鐘
});

// 監聽 data 變化並更新到本地響應式變數
watch(
    data,
    (newData) => {
        if (newData) {
            // 深拷貝避免 readonly 問題
            const deepCopy = JSON.parse(JSON.stringify(newData));
            templateConfigData.value = deepCopy;
            originalTemplateData.value = deepCopy;

            // 格式化 JSON 並設置到編輯器
            editorContent.value = JSON.stringify(deepCopy, null, 2);
        }
    },
    { immediate: true }
);

// 格式化與驗證 JSON
const formatJSON = () => {
    try {
        // 先解析確保是有效的 JSON
        const parsed = JSON.parse(editorContent.value);
        // 再格式化
        editorContent.value = JSON.stringify(parsed, null, 2);
        validationError.value = "";
    } catch (e) {
        validationError.value = `JSON 格式錯誤: ${e.message}`;
    }
};

// 重置編輯器內容
const resetEditor = () => {
    editorContent.value = JSON.stringify(originalTemplateData.value, null, 2);
    validationError.value = "";
};

// 重新獲取配置
const refetchTemplateConfig = () => {
    queryClient.invalidateQueries({ queryKey: ["crawlerTemplateConfig"] });
};

// Git 風格的差異格式化函數

// 計算變更數量
const countChanges = (originalObj, modifiedObj) => {
    const originalLines = JSON.stringify(originalObj, null, 2).split("\n");
    const modifiedLines = JSON.stringify(modifiedObj, null, 2).split("\n");

    let changesCount = 0;

    // 使用簡單的差異算法來計算變更行數
    let originalIndex = 0;
    let modifiedIndex = 0;

    while (originalIndex < originalLines.length || modifiedIndex < modifiedLines.length) {
        const originalLine = originalIndex < originalLines.length ? originalLines[originalIndex] : null;
        const modifiedLine = modifiedIndex < modifiedLines.length ? modifiedLines[modifiedIndex] : null;

        if (originalLine === modifiedLine) {
            originalIndex++;
            modifiedIndex++;
        } else {
            // 行不同，計算為一次變更
            changesCount++;
            if (originalIndex < originalLines.length) originalIndex++;
            if (modifiedIndex < modifiedLines.length) modifiedIndex++;
        }
    }

    return changesCount;
};

// 預覽變更
const previewChanges = () => {
    try {
        // 解析編輯後的 JSON
        const newData = JSON.parse(editorContent.value);

        // 計算差異
        if (JSON.stringify(originalTemplateData.value) === JSON.stringify(newData)) {
            diffHtml.value = '<div class="diff-no-changes">沒有檢測到任何變更</div>';
            successDetails.value.changedCount = 0;
        } else {
            // 使用 Git 風格差異格式化
            diffHtml.value = formatGitStyleDiff(originalTemplateData.value, newData);

            // 計算變更數量
            successDetails.value.changedCount = countChanges(originalTemplateData.value, newData);
        }

        // 打開預覽對話框
        diffPreviewDialog.value = true;
        validationError.value = "";
    } catch (e) {
        validationError.value = `JSON 格式錯誤: ${e.message}`;
    }
};

// 提交變更
const submitChanges = async () => {
    try {
        // 解析編輯後的 JSON
        const newData = JSON.parse(editorContent.value);

        // 如果沒有差異，不需要更新
        if (JSON.stringify(originalTemplateData.value) === JSON.stringify(newData)) {
            emitter.emit("openSnackbar", {
                message: "沒有檢測到任何變更",
                color: "info",
            });
            diffPreviewDialog.value = false;
            return;
        }

        backupTemplateConfigData.value = JSON.parse(JSON.stringify(templateConfigData.value));

        // 更新配置到伺服器
        await axios.post("/crawlerFastAPI/updateCrawlerTemplateConfig", newData);

        // 更新本地數據和查詢緩存
        templateConfigData.value = newData;
        originalTemplateData.value = JSON.parse(JSON.stringify(newData));
        queryClient.setQueryData(["crawlerTemplateConfig"], JSON.parse(JSON.stringify(newData)));

        // 關閉預覽對話框
        diffPreviewDialog.value = false;

        // 顯示成功確認
        successDetails.value = {
            message: "成功更新模板配置",
            changedCount: successDetails.value.changedCount,
        };

        emitter.emit("openSnackbar", {
            message: "成功更新模板配置",
            color: "success",
        });
    } catch (error) {
        console.error("Error updating template config:", error);
        emitter.emit("openSnackbar", {
            message: "更新模板配置時發生錯誤",
            color: "error",
        });
        diffPreviewDialog.value = false;
    }
};

// 取消變更預覽
const cancelPreview = () => {
    diffPreviewDialog.value = false;
};

// 匯出 JSON 配置文件
const exportJSON = () => {
    try {
        // 格式化當前編輯器內容
        const jsonContent = JSON.stringify(JSON.parse(editorContent.value), null, 2);

        // 創建 Blob 對象
        const blob = new Blob([jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // 創建下載鏈接
        const link = document.createElement("a");
        link.href = url;
        link.download = "crawler_template_config.json";
        document.body.appendChild(link);
        link.click();

        // 清理
        URL.revokeObjectURL(url);
        document.body.removeChild(link);

        emitter.emit("openSnackbar", {
            message: "成功匯出模板配置",
            color: "success",
        });
    } catch (e) {
        emitter.emit("openSnackbar", {
            message: `匯出失敗: ${e.message}`,
            color: "error",
        });
    }
};
</script>

<template>
    <div class="crawler-template-settings pa-4">
        <v-container fluid>
            <!-- 標題與操作按鈕 -->
            <v-row>
                <v-col cols="12" class="d-flex justify-space-between align-center">
                    <v-spacer></v-spacer>
                    <div>
                        <v-btn
                            color="info"
                            variant="tonal"
                            @click="refetchTemplateConfig"
                            :loading="isFetching"
                            class="mr-2 text-caption text-md-subtitle-2"
                        >
                            <v-icon class="mr-1">mdi-refresh</v-icon>
                            更新資料
                        </v-btn>
                        <v-btn
                            color="info"
                            @click="formatJSON"
                            :disabled="isLoading"
                            class="text-caption text-md-subtitle-2"
                        >
                            <v-icon class="mr-1">mdi-code-json</v-icon>
                            格式化 JSON
                        </v-btn>
                        <v-btn
                            color="secondary"
                            @click="exportJSON"
                            :disabled="isLoading"
                            class="ml-2 text-caption text-md-subtitle-2"
                        >
                            <v-icon class="mr-1">mdi-file-export</v-icon>
                            匯出 JSON
                        </v-btn>
                    </div>
                </v-col>
            </v-row>

            <!-- 驗證錯誤顯示 -->
            <v-row v-if="validationError">
                <v-col cols="12">
                    <v-alert type="error" variant="tonal" closable>
                        {{ validationError }}
                    </v-alert>
                </v-col>
            </v-row>

            <!-- JSON 編輯器 -->
            <v-row>
                <v-col cols="12">
                    <v-card class="elevation-2">
                        <!-- 提示按下 ctrl+f 搜尋 -->
                        <v-card-text>
                            <v-alert type="info" variant="tonal"> 按下 <strong>Ctrl+F</strong> 搜尋關鍵字 </v-alert>
                        </v-card-text>

                        <v-card-text>
                            <v-textarea
                                ref="textareaRef"
                                v-model="editorContent"
                                label="JSON 配置"
                                hint="編輯模板配置 JSON"
                                persistent-hint
                                :loading="isLoading"
                                :disabled="isLoading"
                                :rows="20"
                                hide-details
                                class="json-editor font-monospace"
                                autocomplete="off"
                                autocorrect="off"
                                spellcheck="false"
                            ></v-textarea>
                        </v-card-text>
                        <v-card-actions class="pa-4 d-flex justify-space-between">
                            <v-btn color="grey" @click="resetEditor">
                                <v-icon class="mr-1">mdi-restore</v-icon>
                                重置
                            </v-btn>
                            <v-btn color="primary" variant="text" @click="previewChanges">
                                <v-icon class="mr-1">mdi-content-save</v-icon>
                                預覽變更
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>

        <!-- 變更預覽對話框 -->
        <v-dialog v-model="diffPreviewDialog" max-width="900px" persistent>
            <v-card class="dialog-card">
                <v-card-title class="py-4 text-white headline bg-info d-flex justify-space-between align-center">
                    <div>
                        <v-icon class="mr-2" color="white">mdi-compare</v-icon>
                        預覽變更
                    </div>
                    <v-btn icon variant="text" color="white" @click="cancelPreview">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-card-text class="pt-4 pb-0">
                    <v-alert v-if="diffHtml.includes('沒有檢測到任何變更')" type="info" variant="tonal" class="mb-4">
                        沒有檢測到任何變更，無需保存。
                    </v-alert>

                    <template v-else>
                        <v-alert type="info" variant="tonal" class="mb-4">
                            <p><strong>變更說明：</strong></p>
                            <p>您正在修改模板配置。請檢查以下差異，確認變更是否正確。</p>
                        </v-alert>

                        <div class="mb-2 font-weight-bold">變更內容：</div>
                        <!-- 使用 v-html 顯示 JSON 差異 -->
                        <div class="json-diff-wrapper">
                            <div v-html="diffHtml"></div>
                        </div>
                    </template>
                </v-card-text>

                <v-divider class="mt-4"></v-divider>

                <v-card-actions class="px-6 py-3">
                    <v-btn color="grey" variant="text" @click="cancelPreview"> 取消 </v-btn>

                    <v-btn
                        color="primary"
                        variant="text"
                        @click="submitChanges"
                        :disabled="diffHtml.includes('沒有檢測到任何變更')"
                    >
                        儲存
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>
<style scoped>
:deep(.json-editor) {
    font-family: monospace !important;
}

:deep(.json-diff-wrapper) {
    max-height: 500px;
    overflow-y: auto;
    background-color: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-family: monospace;
    padding: 8px;
}

/* jsondiffpatch 的樣式增強 */
:deep(.jsondiffpatch-delta) {
    font-family: monospace;
    font-size: 14px;
    padding: 8px;
    margin: 0;
}

:deep(.jsondiffpatch-added) {
    background-color: #e6ffed !important;
    border-left: 3px solid #22863a !important;
}

:deep(.jsondiffpatch-removed) {
    background-color: #ffeef0 !important;
    border-left: 3px solid #cb2431 !important;
}

:deep(.jsondiffpatch-textdiff) {
    white-space: pre-wrap;
}

:deep(.jsondiffpatch-delta ul) {
    padding-left: 20px;
}

:deep(.jsondiffpatch-modified) {
    border-left: 3px solid #0366d6 !important;
}

:deep(.jsondiffpatch-value) {
    word-break: break-word;
}

/* 對話框樣式 */
:deep(.dialog-card) {
    border-radius: 8px;
    overflow: hidden;
}

/* Git 風格差異比較樣式 */
:deep(.diff-container) {
    font-family: monospace;
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 20px;
    background-color: #fff;
}

:deep(.diff-header) {
    background-color: #f1f1f1;
    border-bottom: 1px solid #ddd;
    padding: 10px;
}

:deep(.diff-file-info) {
    font-weight: bold;
    margin-bottom: 5px;
}

:deep(.diff-file-paths) {
    display: flex;
    font-size: 0.9em;
    color: #586069;
}

:deep(.diff-original),
:deep(.diff-modified) {
    flex: 1;
}

:deep(.diff-content) {
    overflow-x: auto;
    counter-reset: line;
}

:deep(.diff-line) {
    display: flex;
    line-height: 1.5;
    font-size: 14px;
}

:deep(.diff-line-num) {
    width: 50px;
    text-align: right;
    padding: 0 10px;
    border-right: 1px solid #ddd;
    color: #999;
    user-select: none;
}

:deep(.diff-line-content) {
    padding: 0 10px;
    white-space: pre;
    flex-grow: 1;
}

:deep(.diff-context) {
    background-color: #fff;
}

:deep(.diff-add) {
    background-color: #e6ffed;
}

:deep(.diff-delete) {
    background-color: #ffeef0;
}

:deep(.diff-add-marker) {
    color: #22863a;
    font-weight: bold;
    margin-right: 5px;
}

:deep(.diff-delete-marker) {
    color: #cb2431;
    font-weight: bold;
    margin-right: 5px;
}

:deep(.diff-line:hover) {
    background-color: #f6f8fa;
}

:deep(.diff-add:hover) {
    background-color: #dcffe4;
}

:deep(.diff-delete:hover) {
    background-color: #ffdce0;
}

/* 摺疊/展開按鈕 */
:deep(.diff-expander) {
    width: 20px;
    text-align: center;
    cursor: pointer;
    user-select: none;
    color: #586069;
}

:deep(.diff-expander:hover) {
    color: #0366d6;
}

/* 搜尋結果高亮 */
:deep(.diff-search-highlight) {
    background-color: #fff5b1;
    border-radius: 2px;
}
</style>
