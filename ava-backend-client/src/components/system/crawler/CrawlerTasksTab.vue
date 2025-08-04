<script setup>
import { ref, onMounted } from "vue";
import HistoryDialog from "./HistoryDialog.vue";
import JsonViewer from "./JsonViewer.vue";

const props = defineProps({
    siteList: {
        type: Array,
        required: true,
    },
    axios: {
        type: Object,
        required: true,
    },
    emitter: {
        type: Object,
        required: true,
    },
});

const crawlerData = ref(null);
const errorMessage = ref("");
const successMessage = ref("");
const queryUUID = ref("");
const deleteUUID = ref("");
const zipPath = ref("");
const selectedSites = ref([]);
const showHistory = ref(false);
const sentSitesHistory = ref([]);

// 獨立的 loading 狀態
const loadingCrawlerList = ref(false);
const loadingQuery = ref(false);
const loadingDelete = ref(false);
const loadingSubmit = ref(false);
const loadingDownload = ref(false);
const loadingCheck = ref(false);

const selectedSite = ref(null);
const checkUUID = ref("");

const getCrawlerSiteStatusList = async () => {
    loadingCrawlerList.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
        const res = await props.axios.get("/crawlerFastAPI/getCrawlerSiteStatusList");
        crawlerData.value = res.data;
        successMessage.value = "成功獲取爬蟲列表";
    } catch (error) {
        console.error("Error fetching crawler list:", error);
        errorMessage.value = "獲取爬蟲列表時發生錯誤";
    } finally {
        loadingCrawlerList.value = false;
    }
};

const getCrawlerByUUID = async () => {
    if (!queryUUID.value) {
        errorMessage.value = "請輸入爬蟲 UUID";
        return;
    }
    loadingQuery.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
        const res = await props.axios.get(`/crawlerFastAPI/getCrawlerSiteStatus`, {
            params: { crawlerUUID: queryUUID.value },
        });
        crawlerData.value = res.data;
        successMessage.value = "成功獲取爬蟲資料";
    } catch (error) {
        console.error("Error fetching crawler:", error);
        errorMessage.value = "獲取爬蟲資料時發生錯誤";
    } finally {
        loadingQuery.value = false;
    }
};

const deleteCrawler = async () => {
    if (!deleteUUID.value) {
        errorMessage.value = "請輸入要刪除的爬蟲 UUID";
        return;
    }
    loadingDelete.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
        const res = await props.axios.delete(`/crawlerFastAPI/deleteCrawler`, {
            data: {
                crawlerUUID: deleteUUID.value,
            },
        });
        crawlerData.value = res.data;
        successMessage.value = "成功刪除爬蟲";
    } catch (error) {
        console.error("Error deleting crawler:", error);
        errorMessage.value = "刪除爬蟲時發生錯誤";
    } finally {
        loadingDelete.value = false;
    }
};

const submitSelectedSites = async () => {
    if (selectedSites.value.length === 0) {
        errorMessage.value = "請至少選擇一個站點";
        return;
    }
    loadingSubmit.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    const siteIds = selectedSites.value.map((site) => site.site_id);
    try {
        const res = await props.axios.post("/crawlerFastAPI/createCrawler", {
            site_ids: siteIds,
        });
        crawlerData.value = res.data;
        successMessage.value = "成功提交選定的站點";

        console.log("res.data", res.data);

        // 從回應中獲取 UUID
        const uuid = res.data.data.data.uuid[0];

        // 保存發送的站點和 UUID 到 localStorage
        const history = JSON.parse(localStorage.getItem("sentSitesHistory") || "[]");
        history.push({
            date: new Date().toISOString(),
            sites: selectedSites.value,
            uuid: uuid,
        });
        localStorage.setItem("sentSitesHistory", JSON.stringify(history));
        loadSentSitesHistory();
    } catch (error) {
        console.error("Error submitting selected sites:", error);
        errorMessage.value = "提交選定站點時發生錯誤";
    } finally {
        loadingSubmit.value = false;
    }
};

const submitDownloadZip = async () => {
    loadingDownload.value = true;
    try {
        const response = await props.axios.post(
            "/crawlerFastAPI/downloadZip",
            {
                zipPath: zipPath.value,
            },
            {
                responseType: "blob",
            }
        );

        const blob = new Blob([response.data], { type: "application/zip" });
        const downloadUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", "pages_data.zip");
        document.body.appendChild(link);
        link.click();

        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error("下載 ZIP 檔案時發生錯誤:", error);
        errorMessage.value = "下載 ZIP 檔案時發生錯誤";
    } finally {
        loadingDownload.value = false;
    }
};

const loadSentSitesHistory = () => {
    const history = JSON.parse(localStorage.getItem("sentSitesHistory") || "[]");
    sentSitesHistory.value = history.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const checkSiteStatus = async () => {
    if (!selectedSite.value?.site_id || !checkUUID.value) {
        errorMessage.value = "請選擇站點並輸入爬蟲 UUID";
        return;
    }

    loadingCheck.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    try {
        const res = await props.axios.get("/crawlerFastAPI/checkSiteStatus", {
            params: {
                crawlerUUID: checkUUID.value,
                siteId: selectedSite.value.site_id,
            },
        });

        crawlerData.value = res.data;
        successMessage.value = "成功獲取站點狀態";
    } catch (error) {
        console.error("Error checking site status:", error);
        errorMessage.value = "獲取站點狀態時發生錯誤";
    } finally {
        loadingCheck.value = false;
    }
};

const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
        () => {
            props.emitter.emit("openSnackbar", { message: `已複製 ${text}`, color: "success" });
        },
        (err) => {
            console.error("Could not copy text: ", err);
        }
    );
};

onMounted(() => {
    loadSentSitesHistory();
});
</script>

<template>
    <div class="crawler-tasks">
        <v-container fluid>
            <v-row>
                <v-col cols="12" class="text-right">
                    <v-btn
                        color="primary"
                        @click="getCrawlerSiteStatusList"
                        :loading="loadingCrawlerList"
                        elevation="2"
                    >
                        運行中的爬蟲列表
                    </v-btn>
                </v-col>
            </v-row>

            <v-row>
                <v-col cols="12" md="6">
                    <v-text-field
                        v-model="queryUUID"
                        label="查詢爬蟲 UUID"
                        placeholder="輸入爬蟲 UUID"
                        outlined
                        dense
                        clearable
                    ></v-text-field>
                    <v-btn color="primary" @click="getCrawlerByUUID" :loading="loadingQuery" block elevation="2">
                        查詢
                    </v-btn>
                </v-col>
                <v-col cols="12" md="6">
                    <v-text-field
                        v-model="deleteUUID"
                        label="刪除爬蟲 UUID"
                        placeholder="輸入要刪除的爬蟲 UUID"
                        outlined
                        dense
                        clearable
                    ></v-text-field>
                    <v-btn color="error" @click="deleteCrawler" :loading="loadingDelete" block elevation="2">
                        刪除
                    </v-btn>
                </v-col>
            </v-row>

            <v-row class="mb-4">
                <v-col cols="6">
                    <v-combobox
                        v-model="selectedSites"
                        :items="siteList"
                        item-title="title"
                        item-value="site_id"
                        label="選擇站點"
                        multiple
                        chips
                        outlined
                        clearable
                    ></v-combobox>
                    <v-btn
                        color="primary"
                        @click="submitSelectedSites"
                        :loading="loadingSubmit"
                        block
                        elevation="2"
                        class="mt-2"
                    >
                        提交選定的站點
                    </v-btn>
                </v-col>
                <v-col cols="6">
                    <v-text-field
                        v-model="zipPath"
                        label="ZIP 檔路徑"
                        placeholder="輸入 zip 檔路徑"
                        outlined
                        dense
                        clearable
                    ></v-text-field>
                    <v-btn
                        color="primary"
                        @click="submitDownloadZip"
                        :loading="loadingDownload"
                        block
                        elevation="2"
                        class="mt-2"
                    >
                        下載 ZIP 檔案
                    </v-btn>
                </v-col>
            </v-row>

            <v-row class="mb-4">
                <v-col cols="12">
                    <v-card>
                        <v-card-text>
                            <v-row>
                                <v-col cols="5">
                                    <v-combobox
                                        v-model="selectedSite"
                                        :items="siteList"
                                        item-title="title"
                                        item-value="site_id"
                                        label="選擇站點"
                                        chips
                                        outlined
                                        clearable
                                    ></v-combobox>
                                </v-col>
                                <v-col cols="5">
                                    <v-text-field
                                        v-model="checkUUID"
                                        label="爬蟲 UUID"
                                        placeholder="輸入爬蟲 UUID"
                                        outlined
                                        dense
                                        clearable
                                    ></v-text-field>
                                </v-col>
                                <v-col cols="2">
                                    <v-btn
                                        color="primary"
                                        @click="checkSiteStatus"
                                        :loading="loadingCheck"
                                        block
                                        elevation="2"
                                    >
                                        查詢站點狀態
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>

            <!-- 使用 JsonViewer 組件顯示 JSON 數據 -->
            <JsonViewer v-if="crawlerData" :data="crawlerData" />
        </v-container>

        <!-- 添加固定位置的圓形歷史記錄按鈕 -->
        <v-btn class="history-btn" icon color="primary" @click="showHistory = true">
            <v-icon>mdi-history</v-icon>
        </v-btn>

        <!-- 歷史記錄彈出框 (使用組件) -->
        <HistoryDialog v-model="showHistory" :history-items="sentSitesHistory" @copy="copyToClipboard" />
    </div>
</template>

<style scoped>
.history-btn {
    position: fixed;
    left: 20px;
    bottom: 20px;
    z-index: 1000;
}
</style>
