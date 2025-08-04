<script setup>
import { ref, computed, onUnmounted, watchEffect, inject, watch, nextTick } from "vue";
import successAnimation from "@/assets/lottie/success.json"; // 匯入下載的 JSON 檔案
import errorAnimation from "@/assets/lottie/error.json"; // 匯入下載的 JSON 檔案
import { UseWindowSize } from "@vueuse/components";
import { useQuery } from "@tanstack/vue-query";

const emitter = inject("emitter");
const axios = inject("axios");

// 最後更新時間
const lastUpdateTime = ref(new Date());

// 服務檢查 loading 狀態
const serviceCheckLoading = ref({});

// 新增功能狀態
const featureTestResults = ref({
    uploadFile: { status: null, errorMessage: null },
    downloadFile: { status: null, errorMessage: null },
    modifyFileStatus: { status: null, errorMessage: null },
    askQuestion: { status: null, errorMessage: null },
});

// 健康檢查查詢
const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["healthCheck"],
    queryFn: async () => {
        const response = await axios.get("/healthCheck/serverHealthCheckList");
        return response.data;
    },
    refetchInterval: 30000,
});

const healthCheck = computed(() => {
    return data?.value?.data;
});

// 執行單一服務檢查
const checkService = async (serverName, serviceName) => {
    serviceCheckLoading.value = {
        ...serviceCheckLoading.value,
        [`${serverName}-${serviceName}`]: true,
    };

    try {
        const apiPath = `/healthCheck/${serverName}${capitalizeFirstLetter(serviceName)}Check`;
        const response = await axios.get(apiPath);

        // 如果請求成功，更新整體狀態
        if (response.data.code === 0) {
            await refetch();
        }
    } catch (error) {
        // 處理錯誤
        emitter.emit("openSnackbar", {
            message: "測試連線失敗",
            color: "error",
        });
        console.error("測試連線失敗:", error);
    } finally {
        serviceCheckLoading.value[`${serverName}-${serviceName}`] = false;
    }
};

// 測試功能狀態的函數
// 修改檔案下載的測試函數
const checkFeature = async (feature) => {
    const featureLoadingKey = `${feature}Loading`;
    serviceCheckLoading.value[featureLoadingKey] = true;

    try {
        const apiMapping = {
            uploadFile: "/healthCheck/uploadFileCheck",
            downloadFile: "/healthCheck/downloadFileCheck",
            modifyFileStatus: "/healthCheck/modifyFileStatusCheck",
            askQuestion: "/healthCheck/askQuestionCheck",
        };

        // 特別處理下載檔案的情況
        if (feature === "downloadFile") {
            const response = await axios.get(apiMapping[feature], {
                responseType: "blob", // 設置響應類型為 blob
            });

            // 檢查響應頭，確認是否為檔案下載
            const contentType = response.headers["content-type"];
            const contentDisposition = response.headers["content-disposition"];

            if (contentType === "application/octet-stream" && contentDisposition) {
                // 從 content-disposition 中獲取檔名
                const filename = contentDisposition.split("filename*=UTF-8''")[1] || "downloaded-file";

                // 創建 Blob URL 並下載
                const blob = new Blob([response.data]);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = decodeURIComponent(filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                // 更新狀態為成功
                featureTestResults.value[feature] = {
                    status: true,
                    errorMessage: null,
                };
            }
        } else {
            // 其他功能的原有處理邏輯
            const response = await axios.get(apiMapping[feature]);
            featureTestResults.value[feature] = {
                status: response.data.data[`can${capitalizeFirstLetter(feature)}`],
                errorMessage: response.data["error-message"] || null,
            };
        }
    } catch (error) {
        console.error(`測試${feature}失敗:`, error);

        // 處理錯誤回應
        if (error.response?.data instanceof Blob) {
            // 如果是 Blob 類型的錯誤回應，需要先讀取內容
            const text = await error.response.data.text();
            const errorData = JSON.parse(text);
            featureTestResults.value[feature] = {
                status: false,
                errorMessage: errorData["error-message"] || "下載失敗",
            };
        } else {
            featureTestResults.value[feature] = {
                status: false,
                errorMessage: error.response?.data?.["error-message"] || "連線失敗",
            };
        }

        emitter.emit("openSnackbar", {
            message: `測試${feature}失敗`,
            color: "error",
        });
    } finally {
        serviceCheckLoading.value[featureLoadingKey] = false;
    }
};

const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

// 格式化更新時間
const formatUpdateTime = (date) => {
    return new Intl.DateTimeFormat("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(date);
};

// 新增：控制錯誤詳情對話框
const errorDialog = ref(false);
const selectedError = ref(null);

// 新增：顯示錯誤詳情
const showErrorDetail = (message) => {
    selectedError.value = message;
    errorDialog.value = true;
};

// 新增：縮短錯誤訊息顯示
const truncateMessage = (message, length = 30) => {
    if (!message) return "";
    return message.length > length ? `${message.slice(0, length)}...` : message;
};

// 監聽資料更新
watchEffect(() => {
    if (!isFetching.value && healthCheck.value) {
        lastUpdateTime.value = new Date();
    }
});

// 計算伺服器狀態
const getServerStatus = computed(() => {
    if (!healthCheck.value) return [];
    const servers = {
        avaApiServer: "主要 API 伺服器",
        avaChatServer: "聊天伺服器",
        avaBackendServer: "後端伺服器",
        avaLinebotServer: "Linebot 伺服器",
    };

    return Object.entries(servers).map(([key, label]) => {
        const server = healthCheck.value[key];
        const services = {};

        // 處理所有服務
        ["redis", "db", "pgVector"].forEach((serviceKey) => {
            if (server[serviceKey]) {
                services[serviceKey] = {
                    connect: server[serviceKey].connect,
                    errorMessage: server[serviceKey]["error-message"],
                };
            }
        });

        const allServicesUp = Object.values(services).every((service) => service.connect);

        return {
            id: key,
            name: label,
            status: server?.status === 200 && allServicesUp ? "operational" : "error",
            services,
        };
    });
});

// 計算功能狀態
// 修改功能狀態的計算
const featureStatus = computed(() => {
    return [
        {
            name: "檔案上傳",
            key: "uploadFile",
            status:
                featureTestResults.value.uploadFile.status === null
                    ? "untested"
                    : featureTestResults.value.uploadFile.status
                    ? "operational"
                    : "error",
            errorMessage: featureTestResults.value.uploadFile.errorMessage,
            icon: "mdi-cloud-upload",
        },
        {
            name: "檔案下載",
            key: "downloadFile",
            status:
                featureTestResults.value.downloadFile.status === null
                    ? "untested"
                    : featureTestResults.value.downloadFile.status
                    ? "operational"
                    : "error",
            errorMessage: featureTestResults.value.downloadFile.errorMessage,
            icon: "mdi-cloud-download",
        },
        {
            name: "檔案狀態修改",
            key: "modifyFileStatus",
            status:
                featureTestResults.value.modifyFileStatus.status === null
                    ? "untested"
                    : featureTestResults.value.modifyFileStatus.status
                    ? "operational"
                    : "error",
            errorMessage: featureTestResults.value.modifyFileStatus.errorMessage,
            icon: "mdi-file-edit",
        },
        {
            name: "提問功能",
            key: "askQuestion",
            status:
                featureTestResults.value.askQuestion.status === null
                    ? "untested"
                    : featureTestResults.value.askQuestion.status
                    ? "operational"
                    : "error",
            errorMessage: featureTestResults.value.askQuestion.errorMessage,
            icon: "mdi-comment-question",
        },
    ];
});
// 計算整體系統健康狀態
const systemHealth = computed(() => {
    if (!healthCheck.value) return { status: "unknown", percentage: 0 };

    const servers = getServerStatus.value;
    const total = servers.length;
    const operational = servers.filter((s) => s.status === "operational").length;

    return {
        status: operational === total ? "healthy" : "degraded",
        percentage: Math.round((operational / total) * 100),
    };
});

// 狀態顯示函數
const getStatusColor = (status) => {
    if (status === "untested") return "grey";
    return status === "operational" ? "success" : "error";
};

const getStatusIcon = (status) => {
    if (status === "untested") return "mdi-help-circle";
    return status === "operational" ? "mdi-check-circle" : "mdi-alert-circle";
};

const copyErrorMessage = async (event, message) => {
    event.stopPropagation(); // 防止觸發其他點擊事件
    try {
        await navigator.clipboard.writeText(message);
        emitter.emit("openSnackbar", {
            message: "複製成功",
            color: "success",
        });
    } catch (err) {
        emitter.emit("openSnackbar", {
            message: "複製失敗",
            color: "error",
        });
    }
};

const playState = ref(true);

watch(
    () => isFetching.value,
    (newIsFetching) => {
        if (newIsFetching) {
            playState.value = !playState.value;
        }
    }
);
</script>

<template>
    <div class="monitor-view">
        <UseWindowSize v-slot="{ width }">
            <div class="d-flex flex-column">
                <!-- 頁面標題區塊 -->
                <v-card class="mb-6" elevation="1">
                    <div class="px-6 py-4">
                        <div class="flex-wrap d-flex align-center justify-space-between">
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-server-network" size="x-large" color="primary" class="mr-3" />
                                <div>
                                    <div class="text-h5 font-weight-bold">系統健康監控</div>
                                    <div class="mt-1 d-flex align-center">
                                        <div class="text-body-2 text-medium-emphasis">
                                            最後更新時間: {{ formatUpdateTime(lastUpdateTime) }}
                                        </div>
                                        <div class="mx-2 text-medium-emphasis">•</div>
                                        <div class="d-flex align-center text-body-2 text-medium-emphasis">
                                            <v-icon icon="mdi-pulse" size="small" class="mr-1" />
                                            每 30 秒自動更新
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="mt-2 d-flex align-center mt-sm-0">
                                <v-chip
                                    :color="systemHealth.status === 'healthy' ? 'success' : 'warning'"
                                    class="mr-4"
                                    size="large"
                                >
                                    <template v-slot:prepend>
                                        <v-icon
                                            :icon="systemHealth.status === 'healthy' ? 'mdi-check-circle' : 'mdi-alert'"
                                            start
                                        />
                                    </template>
                                    系統健康度: {{ systemHealth.percentage }}%
                                </v-chip>

                                <v-btn :loading="isFetching" color="primary" variant="tonal" @click="refetch">
                                    <v-icon icon="mdi-refresh" class="mr-2" />
                                    更新狀態
                                </v-btn>
                            </div>
                        </div>
                    </div>
                </v-card>

                <v-row>
                    <!-- 伺服器狀態卡片 -->
                    <v-col cols="12">
                        <v-card elevation="1">
                            <v-card-title class="px-6 pt-6 d-flex align-center">
                                <v-icon icon="mdi-server" class="mr-2" color="primary" />
                                伺服器狀態
                            </v-card-title>

                            <v-card-text>
                                <v-expansion-panels v-if="!isLoading">
                                    <v-expansion-panel
                                        v-for="(server, index) in getServerStatus"
                                        :key="server.id"
                                        :class="{ 'error-subtle': server.status !== 'operational' }"
                                    >
                                        <v-expansion-panel-title>
                                            <div class="d-flex align-center w-100">
                                                <Vue3Lottie
                                                    class="status-icon-container"
                                                    :animationData="
                                                        server.status === 'operational'
                                                            ? successAnimation
                                                            : errorAnimation
                                                    "
                                                    :loop="false"
                                                    :backgroundColor="
                                                        server.status === 'operational' ? '#2cda94' : '#e84142'
                                                    "
                                                    noMargin
                                                    :pause-animation="playState"
                                                />

                                                <div>
                                                    <div class="text-body-1">{{ server.name }}</div>
                                                    <div class="text-caption text-medium-emphasis">
                                                        {{ Object.keys(server.services).length }} 個服務
                                                    </div>
                                                </div>
                                            </div>
                                        </v-expansion-panel-title>

                                        <v-expansion-panel-text>
                                            <v-list>
                                                <v-list-item
                                                    v-for="(service, serviceName) in server.services"
                                                    :key="serviceName"
                                                    :class="{ 'bg-error-subtle': !service.connect }"
                                                >
                                                    <template v-slot:prepend>
                                                        <Vue3Lottie
                                                            class="status-icon-container"
                                                            :animationData="
                                                                service.connect ? successAnimation : errorAnimation
                                                            "
                                                            :loop="false"
                                                            :backgroundColor="service.connect ? '#2cda94' : '#e84142'"
                                                            noMargin
                                                            :pause-animation="playState"
                                                        />
                                                    </template>

                                                    <v-list-item-title>{{ serviceName }}</v-list-item-title>

                                                    <template v-slot:append>
                                                        <div class="d-flex align-center">
                                                            <template v-if="service.errorMessage">
                                                                <v-tooltip location="top" max-width="400px">
                                                                    <template v-slot:activator="{ props }">
                                                                        <v-chip
                                                                            color="error"
                                                                            size="small"
                                                                            class="mr-4"
                                                                            v-bind="props"
                                                                        >
                                                                            <span
                                                                                class="cursor-pointer"
                                                                                @click="
                                                                                    showErrorDetail(
                                                                                        service.errorMessage
                                                                                    )
                                                                                "
                                                                            >
                                                                                {{
                                                                                    truncateMessage(
                                                                                        service.errorMessage
                                                                                    )
                                                                                }}
                                                                            </span>

                                                                            <v-icon
                                                                                size="small"
                                                                                class="ml-1 copy-icon"
                                                                                icon="mdi-content-copy"
                                                                                @click.stop="
                                                                                    (e) =>
                                                                                        copyErrorMessage(
                                                                                            e,
                                                                                            service.errorMessage
                                                                                        )
                                                                                "
                                                                            >
                                                                                <v-tooltip
                                                                                    activator="parent"
                                                                                    location="top"
                                                                                >
                                                                                    複製錯誤訊息
                                                                                </v-tooltip>
                                                                            </v-icon>
                                                                        </v-chip>
                                                                    </template>
                                                                    <span class="text-wrap">{{
                                                                        service.errorMessage
                                                                    }}</span>
                                                                </v-tooltip>
                                                            </template>

                                                            <v-btn
                                                                :loading="
                                                                    serviceCheckLoading[`${server.id}-${serviceName}`]
                                                                "
                                                                color="primary"
                                                                variant="tonal"
                                                                size="small"
                                                                @click.stop="checkService(server.id, serviceName)"
                                                            >
                                                                測試連線
                                                            </v-btn>
                                                        </div>
                                                    </template>
                                                </v-list-item>
                                            </v-list>
                                        </v-expansion-panel-text>
                                    </v-expansion-panel>
                                </v-expansion-panels>

                                <v-skeleton-loader v-else type="article@3" />
                            </v-card-text>
                        </v-card>
                    </v-col>

                    <!-- 功能狀態卡片 -->
                    <v-col cols="12">
                        <v-card elevation="1">
                            <v-card-title class="px-6 pt-6 d-flex align-center">
                                <v-icon icon="mdi-cog" class="mr-2" color="primary" />
                                功能狀態
                            </v-card-title>

                            <v-card-text>
                                <v-list v-if="!isLoading">
                                    <v-list-item
                                        v-for="feature in featureStatus"
                                        :key="feature.key"
                                        :class="{ 'bg-error-subtle': feature.status === 'error' }"
                                    >
                                        <template v-slot:prepend v-if="feature.status == 'untested'">
                                            <v-avatar :color="getStatusColor(feature.status)" size="small" class="mr-3">
                                                <v-icon :icon="feature.icon" color="white" size="small" />
                                            </v-avatar>
                                        </template>
                                        <template v-slot:prepend v-else>
                                            <Vue3Lottie
                                                class="status-icon-container"
                                                :animationData="
                                                    feature.status === 'operational' ? successAnimation : errorAnimation
                                                "
                                                :loop="false"
                                                :backgroundColor="
                                                    feature.status === 'operational' ? '#2cda94' : '#e84142'
                                                "
                                                noMargin
                                                :pause-animation="playState"
                                            />
                                        </template>

                                        <v-list-item-title>{{ feature.name }}</v-list-item-title>

                                        <template v-slot:append>
                                            <div class="d-flex align-center">
                                                <!-- 顯示錯誤或成功狀態 -->
                                                <template v-if="feature.status !== 'untested'">
                                                    <v-chip
                                                        :color="getStatusColor(feature.status)"
                                                        :variant="feature.status === 'operational' ? 'flat' : 'tonal'"
                                                        size="small"
                                                        class="mr-4"
                                                    >
                                                        <template
                                                            v-if="feature.status === 'error' && feature.errorMessage"
                                                        >
                                                            <span
                                                                class="cursor-pointer"
                                                                @click="showErrorDetail(feature.errorMessage)"
                                                            >
                                                                {{ truncateMessage(feature.errorMessage) }}
                                                            </span>

                                                            <v-icon
                                                                size="small"
                                                                class="ml-1 copy-icon"
                                                                icon="mdi-content-copy"
                                                                @click.stop="
                                                                    (e) => copyErrorMessage(e, feature.errorMessage)
                                                                "
                                                            >
                                                                <v-tooltip activator="parent" location="top">
                                                                    複製錯誤訊息
                                                                </v-tooltip>
                                                            </v-icon>
                                                        </template>
                                                        <template v-else>
                                                            {{ feature.status === "operational" ? "正常" : "異常" }}
                                                        </template>
                                                    </v-chip>
                                                </template>

                                                <v-btn
                                                    :loading="serviceCheckLoading[`${feature.key}Loading`]"
                                                    color="primary"
                                                    variant="tonal"
                                                    size="small"
                                                    @click="checkFeature(feature.key)"
                                                >
                                                    測試功能
                                                </v-btn>
                                            </div>
                                        </template>
                                    </v-list-item>
                                </v-list>
                                <v-skeleton-loader v-else type="list-item-two-line@4" />
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </div>
        </UseWindowSize>
    </div>

    <v-dialog v-model="errorDialog" max-width="600">
        <v-card>
            <v-card-title class="px-6 pt-6 d-flex align-center">
                <v-icon icon="mdi-alert-circle" color="error" class="mr-2" size="small" />
                <span>錯誤詳細資訊</span>
                <v-spacer />
                <v-btn
                    icon="mdi-close"
                    variant="text"
                    density="comfortable"
                    size="small"
                    @click="errorDialog = false"
                />
            </v-card-title>

            <v-card-text class="px-6 pt-4 pb-4">
                <div class="error-message-content">
                    {{ selectedError }}
                </div>
            </v-card-text>

            <v-card-actions class="px-6 pb-4">
                <v-spacer />
                <v-btn variant="text" @click="errorDialog = false"> 關閉 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style lang="scss" scoped>
.monitor-view {
    padding: 2rem;
    width: 100%;
    height: 100%;
    background-color: rgb(250, 250, 250);

    :deep(.v-expansion-panel) {
        margin-bottom: 8px;
        overflow: hidden;
    }

    :deep(.v-list-item) {
        min-height: 64px;
        border-radius: 8px;
        margin-bottom: 4px;

        &:hover {
            background-color: rgb(245, 245, 245);
        }
    }

    .error-subtle:deep(.v-expansion-panel-title) {
        background-color: rgb(254, 242, 242);
    }

    .bg-error-subtle {
        background-color: rgb(254, 242, 242);
    }

    .cursor-pointer {
        cursor: pointer;
    }

    .error-message-content {
        font-family: monospace;
        background-color: rgb(250, 250, 250);
        border-radius: 4px;
        padding: 16px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid rgba(0, 0, 0, 0.12);
        font-size: 14px;
        line-height: 1.5;
    }

    .copy-icon {
        opacity: 0.7;
        transition: opacity 0.2s;
        cursor: pointer;
        margin-left: 4px;

        &:hover {
            opacity: 1;
        }
    }

    .cursor-pointer {
        cursor: pointer;
    }
}

.status-icon-container {
    margin-right: 27px;
    /* padding-right: 5px; */
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    transition: background-color 0.3s ease;
    position: relative;
}
</style>
