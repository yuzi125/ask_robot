<script setup>
import { ref, computed, inject, watch } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { usePermissionChecker } from "@/composables";
const axios = inject("axios");
const dialog = ref(false);
const isUploading = ref(false);
const uploadError = ref(false);
const queryClient = useQueryClient();

const { canPerformAction: canUploadChangelog } = usePermissionChecker("allowedToUploadChangelog");

const parseChangelog = (content) => {
    // 移除開頭的 # Ava 版本開發紀錄:
    const contentWithoutTitle = content.replace(/^# [^\n]*\n/, "").trim();

    // 以 ## 分割不同版本
    const sections = contentWithoutTitle
        .split(/^## /m)
        .filter((section) => section.trim())
        .map((section) => {
            // 處理每個版本區塊
            const lines = section.split("\n");
            const version = {
                title: "",
                details: "", // 存放版本的其他詳細資訊，例如部署日期等
                content: "", // 存放版本的主要內容（包含 SQL）
            };

            // 第一行是版本標題
            const titleLine = lines[0].trim();
            const titleParts = titleLine.split(":`");
            version.title = titleParts[0].trim();
            if (titleParts.length > 1) {
                version.details = titleParts[1].replace("`", "").trim();
            }

            let currentContent = [];
            let isSQLBlock = false;

            // 處理剩餘的行
            lines.slice(1).forEach((line) => {
                const trimmedLine = line.trim();

                // 處理 SQL 程式碼區塊
                if (trimmedLine.startsWith("```")) {
                    isSQLBlock = !isSQLBlock;
                    if (isSQLBlock) {
                        currentContent.push('<pre class="sql-block">');
                    } else {
                        currentContent.push("</pre>");
                    }
                    return;
                }

                // 如果在 SQL 區塊內，保持原有格式
                if (isSQLBlock) {
                    currentContent.push(line);
                    return;
                }

                // 處理一般內容
                if (trimmedLine.startsWith("-")) {
                    currentContent.push(`<li>${trimmedLine.slice(1).trim()}</li>`);
                } else if (trimmedLine) {
                    currentContent.push(`<p>${trimmedLine}</p>`);
                }
            });

            version.content = currentContent.join("\n");
            return version;
        });

    return sections;
};

const fetchChangelog = async () => {
    const response = await axios.get("/changelog");
    return parseChangelog(response.data.data);
};

const { data: versions, isLoading } = useQuery({
    queryKey: ["changelog"],
    queryFn: fetchChangelog,
    enabled: computed(() => dialog.value),
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 30,
});

// 處理檔案上傳
const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 檢查檔案類型
    if (file.type !== "text/markdown" && !file.name.endsWith(".md")) {
        uploadError.value = "請上傳 Markdown 檔案 (.md)";
        return;
    }

    try {
        isUploading.value = true;
        uploadError.value = null;

        const formData = new FormData();
        formData.append("changelog", file);

        // 發送檔案到後端
        await axios.post("/changelog/upload", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        // 上傳成功後重新獲取變更記錄
        await queryClient.invalidateQueries({ queryKey: ["changelog"] });
    } catch (error) {
        console.error("Upload error:", error);
        uploadError.value = "上傳失敗，請稍後再試";
    } finally {
        isUploading.value = false;
        // 清除檔案選擇
        event.target.value = "";
    }
};

const isDownloading = ref(false);

// 下載功能
const handleDownload = async () => {
    try {
        isDownloading.value = true;

        // 發送下載請求
        const response = await axios.get("/changelog/download", {
            responseType: "blob", // 重要：設定回應類型為 blob
        });

        // 創建下載用的 URL
        const blob = new Blob([response.data], { type: "text/markdown" });
        const url = window.URL.createObjectURL(blob);

        // 創建一個暫時的 a 標籤來觸發下載
        const link = document.createElement("a");
        link.href = url;
        link.download = "changelog.md"; // 設定下載的檔名
        document.body.appendChild(link);
        link.click();

        // 清理
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Download error:", error);
    } finally {
        isDownloading.value = false;
    }
};

const showDialog = () => {
    dialog.value = true;
};

// dialog 關閉時重置所有狀態
watch(dialog, (newValue) => {
    if (!newValue) {
        uploadError.value = null;
    }
});
</script>

<template>
    <v-btn variant="text" icon @click="showDialog">
        <v-icon>mdi-history</v-icon>
        <v-tooltip activator="parent" location="top" content-class="custom-tooltip"> 版本更新日誌 </v-tooltip>
    </v-btn>

    <v-dialog v-model="dialog" width="800">
        <v-card>
            <v-card-title class="px-4 pt-4 d-flex align-center">
                <span class="text-h5">版本更新日誌</span>
                <v-spacer></v-spacer>

                <div v-if="canUploadChangelog" class="d-flex align-center">
                    <!-- 下載按鈕 -->
                    <v-btn
                        :loading="isDownloading"
                        :disabled="isDownloading"
                        color="success"
                        variant="text"
                        @click="handleDownload"
                    >
                        <v-icon>mdi-download</v-icon>
                        下載更新記錄
                    </v-btn>
                    <input type="file" accept=".md" class="d-none" ref="fileInput" @change="handleFileUpload" />
                    <v-btn
                        :loading="isUploading"
                        :disabled="isUploading"
                        color="primary"
                        variant="text"
                        class="mr-2"
                        @click="$refs.fileInput.click()"
                    >
                        <v-icon class="mr-1">mdi-upload</v-icon>
                        上傳更新記錄
                    </v-btn>
                </div>
            </v-card-title>

            <v-alert v-if="uploadError" type="error" variant="tonal" class="mx-4 mt-2" density="compact">
                {{ uploadError }}
            </v-alert>

            <v-card-text class="px-4">
                <v-progress-circular
                    v-if="isLoading || isUploading"
                    indeterminate
                    color="primary"
                    class="mx-auto my-4 d-flex"
                />

                <div v-else class="changelog-container">
                    <v-expansion-panels class="changelog-panels">
                        <v-expansion-panel
                            v-for="(version, index) in versions"
                            :key="index"
                            class="mb-2 changelog-panel"
                        >
                            <v-expansion-panel-title>
                                <div class="d-flex align-center">
                                    <span class="version-number">{{ version.title }}</span>
                                    <span v-if="version.details" class="ml-2 version-details">
                                        {{ version.details }}
                                    </span>
                                </div>
                            </v-expansion-panel-title>

                            <v-expansion-panel-text>
                                <div class="changelog-content mkd" v-html="version.content"></div>
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>
                </div>
            </v-card-text>

            <v-card-actions class="px-4 pb-4">
                <v-spacer></v-spacer>
                <v-btn color="grey darken-1" @click="dialog = false">關閉</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style>
.changelog-container {
    min-height: 200px;
    max-height: 70vh;
    overflow-y: auto;
}

.changelog-panels {
    background: transparent !important;
}

.changelog-panel {
    background: #f8f9fa !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    border-radius: 8px !important;
    transition: all 0.2s ease;
}

.changelog-panel:hover {
    border-color: rgba(0, 0, 0, 0.12) !important;
}

.version-number {
    font-size: 1rem;
    font-weight: 500;
    color: #1976d2;
}

.version-details {
    font-size: 0.9rem;
    color: rgba(0, 0, 0, 0.6);
}

.changelog-content {
    font-size: 0.95rem;
    line-height: 1.6;
}

.changelog-content li {
    margin-bottom: 8px;
    color: rgba(0, 0, 0, 0.87);
    list-style-type: disc;
    margin-left: 20px;
}

.changelog-content .sql-block {
    background-color: #f5f5f5;
    padding: 12px;
    border-radius: 4px;
    font-family: monospace;
    margin: 8px 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 0.9rem;
}

.changelog-content p {
    margin: 8px 0;
}

:deep(.v-expansion-panel-title) {
    padding: 16px !important;
    min-height: unset !important;
}

:deep(.v-expansion-panel-text__wrapper) {
    padding: 0 16px 16px !important;
}

/* SQL 區塊的捲軸樣式 */
.sql-block::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.sql-block::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

.sql-block::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
}

.sql-block::-webkit-scrollbar-thumb:hover {
    background: #555;
}

/* 容器捲軸樣式 */
.changelog-container::-webkit-scrollbar {
    width: 6px;
}

.changelog-container::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

.changelog-container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
}

.changelog-container::-webkit-scrollbar-thumb:hover {
    background: #555;
}
</style>
