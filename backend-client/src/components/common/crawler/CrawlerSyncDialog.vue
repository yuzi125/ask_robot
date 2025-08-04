<script setup>
import { ref, computed, inject } from "vue";

const syncDialog = ref(false);
const currentTab = ref(0);
const currentItem = ref(null);
const isSaving = ref(false);
const axios = inject("axios");
const emitter = inject("emitter");

const emits = defineEmits(["refetch"]);
const props = defineProps({
    type: {
        type: String,
        default: "crawler",
    },
});

// Refs for auto sync
const syncDays = ref(null);
const syncTime = ref("");

// Refs for delay sync
const delayHours = ref(0);
const delayMinutes = ref(0);

// Computed properties for auto sync
const isSyncDaysValid = computed(() => {
    return syncDays.value === null || (syncDays.value >= 0 && syncDays.value <= 365);
});

const isSyncSettingComplete = computed(() => {
    return syncDays.value && syncTime.value;
});

const syncSettingMessage = computed(() => {
    if (!isSyncSettingComplete.value) return "";
    const syncDate = calculateSyncDate();
    return `今天是 ${formatDate(new Date())}，設定 ${syncDays.value} 天 ${
        syncTime.value
    }，則會在 ${syncDate} 左右執行同步。`;
});

// Validation functions
const validateSyncDays = () => {
    const days = Number(syncDays.value);
    if (isNaN(days) || days <= 0) {
        syncDays.value = null;
        syncTime.value = "";
    }
};

const validateDelayInput = (refName, value, maxValue) => {
    let numValue = parseInt(value) || 0;
    numValue = Math.max(0, Math.min(numValue, maxValue));

    if (refName === "hours") {
        delayHours.value = numValue;
    } else if (refName === "minutes") {
        delayMinutes.value = numValue;
    }
};

// Dialog control functions
const openSyncDialog = async (item, initialTab = 0) => {
    currentItem.value = item;
    currentTab.value = initialTab;
    syncDialog.value = true;
    resetForm();

    // 如果是編輯模式且是單一項目，則獲取現有設定
    if (initialTab === 0 && !Array.isArray(item)) {
        await fetchSyncSettings(item.dataset_id, item.crawler_id);
    }
};

const closeSyncDialog = () => {
    syncDialog.value = false;
    resetForm();
};

const resetForm = () => {
    syncDays.value = null;
    syncTime.value = "";
    delayHours.value = 0;
    delayMinutes.value = 0;
    isDelay.value = true; // 重置為延後模式
};
// API interaction functions
const fetchSyncSettings = async (datasetsId, crawlerId) => {
    try {
        const response = await axios.get(`/crawler/getCrawlerSiteSyncSettings`, {
            params: {
                datasetsId,
                crawlerId,
                type: props.type,
            },
        });

        if (response.data.code === 0) {
            const data = response.data.data;
            syncDays.value = data.sync_days;
            syncTime.value = data.sync_time?.slice(0, 5); // 取 HH:MM 部分
        }
    } catch (error) {
        console.error("Error fetching sync settings:", error);
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    }
};

const saveSyncSettings = async () => {
    if (currentTab.value === 0) {
        await saveAutoSync();
    } else {
        await saveDelay();
    }
};

const saveAutoSync = async () => {
    if (!isSyncSettingComplete.value) return;

    let syncItems;
    if (!Array.isArray(currentItem.value)) {
        syncItems = [{ crawlerId: currentItem.value.crawler_id, datasetId: currentItem.value.dataset_id }];
    } else {
        syncItems = currentItem.value.map((item) => ({
            crawlerId: item.crawler_id,
            datasetId: item.dataset_id,
        }));
    }

    isSaving.value = true;
    try {
        const response = await axios.post("/system/systemSyncCrawlerSchedule", {
            syncItems,
            syncDays: syncDays.value,
            syncTime: syncTime.value,
            type: props.type,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "成功更新同步時間", color: "success" });
            emits("refetch");
            closeSyncDialog();
        }
    } catch (error) {
        console.error("Error saving sync settings:", error);
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    } finally {
        isSaving.value = false;
    }
};

const saveDelay = async () => {
    if (delayHours.value === 0 && delayMinutes.value === 0) return;

    let syncItems;
    if (!Array.isArray(currentItem.value)) {
        syncItems = [{ crawlerId: currentItem.value.crawler_id, datasetId: currentItem.value.dataset_id }];
    } else {
        syncItems = currentItem.value.map((item) => ({
            crawlerId: item.crawler_id,
            datasetId: item.dataset_id,
        }));
    }

    isSaving.value = true;
    try {
        const response = await axios.post("/system/delayCrawlerSchedule", {
            syncItems,
            delayHours: delayHours.value,
            delayMinutes: delayMinutes.value,
            isDelay: isDelay.value, // 新增這個參數
            type: props.type,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", {
                message: `成功${isDelay.value ? "延遲" : "提前"}同步時間`,
                color: "success",
            });
            emits("refetch");
            closeSyncDialog();
        }
    } catch (error) {
        console.error("Error saving delay settings:", error);
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    } finally {
        isSaving.value = false;
    }
};

// Helper functions
const formatDate = (date) => {
    return date.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
};

const calculateSyncDate = () => {
    if (!isSyncSettingComplete.value) return "";

    if (syncTime.value?.split(":")) {
        const today = new Date();
        const syncDate = new Date(today.setDate(today.getDate() + Number(syncDays.value)));
        const [hours, minutes] = syncTime.value.split(":");
        syncDate.setHours(Number(hours), Number(minutes), 0, 0);
        return formatDate(syncDate) + " " + syncTime.value;
    }
    return "";
};

const isDelay = ref(true);

defineExpose({
    openSyncDialog,
});
</script>

<template>
    <v-dialog v-model="syncDialog" max-width="500px">
        <v-card>
            <v-toolbar color="primary" density="compact">
                <v-tabs v-model="currentTab" align-tabs="center">
                    <v-tab value="0">自動同步</v-tab>
                    <v-tab value="1">延遲執行</v-tab>
                </v-tabs>
            </v-toolbar>

            <v-card-text class="mt-4">
                <v-row>
                    <!-- Common header -->
                    <v-col cols="12">
                        <div class="mb-2 text-subtitle-1">
                            正在設定：
                            <template v-if="Array.isArray(currentItem)">
                                <strong>{{ currentItem.length }} 個站點</strong>
                                <v-tooltip bottom>
                                    <template v-slot:activator="{ props }">
                                        <v-icon small v-bind="props">mdi-information-outline</v-icon>
                                    </template>
                                    <span>
                                        <ul class="pa-0 ma-0">
                                            <li v-for="item in currentItem" :key="item.id">{{ item.title }}</li>
                                        </ul>
                                    </span>
                                </v-tooltip>
                            </template>
                            <template v-else>
                                <strong>{{ currentItem?.title }}</strong>
                            </template>
                        </div>
                    </v-col>

                    <!-- Auto Sync Tab Content -->
                    <v-window v-model="currentTab">
                        <v-window-item value="0">
                            <v-row>
                                <v-col cols="6">
                                    <v-tooltip bottom>
                                        <template v-slot:activator="{ props }">
                                            <v-text-field
                                                v-model="syncDays"
                                                label="同步天數"
                                                type="number"
                                                suffix="天"
                                                v-bind="props"
                                                @input="validateSyncDays"
                                                clearable
                                            ></v-text-field>
                                        </template>
                                        <span>設定多少天後執行同步</span>
                                    </v-tooltip>
                                </v-col>

                                <v-col cols="6">
                                    <v-tooltip bottom>
                                        <template v-slot:activator="{ props }">
                                            <v-text-field
                                                v-model="syncTime"
                                                label="同步時間"
                                                type="time"
                                                v-bind="props"
                                                :disabled="!isSyncDaysValid"
                                                clearable
                                            ></v-text-field>
                                        </template>
                                        <span>設定在指定天數後的哪個時間點執行同步</span>
                                    </v-tooltip>
                                </v-col>

                                <v-col cols="12">
                                    <v-alert
                                        v-if="isSyncSettingComplete"
                                        type="info"
                                        variant="outlined"
                                        density="compact"
                                    >
                                        {{ syncSettingMessage }}
                                    </v-alert>
                                    <v-alert v-else-if="syncDays" type="warning" variant="outlined" density="compact">
                                        請選擇同步時間以完成設定。
                                    </v-alert>
                                    <v-alert v-else type="warning" variant="outlined" density="compact">
                                        請設定同步天數和時間以查看預計同步日期。
                                    </v-alert>
                                </v-col>
                            </v-row>
                        </v-window-item>

                        <!-- Delay Sync Tab Content -->
                        <v-window-item value="1">
                            <v-row>
                                <v-col cols="12">
                                    <v-btn-toggle v-model="isDelay" color="primary" mandatory class="mb-4">
                                        <v-btn :value="true" class="px-4">
                                            <v-icon start>mdi-clock-plus</v-icon>
                                            延後
                                        </v-btn>
                                        <v-btn :value="false" class="px-4">
                                            <v-icon start>mdi-clock-minus</v-icon>
                                            提前
                                        </v-btn>
                                    </v-btn-toggle>
                                </v-col>

                                <v-col cols="6">
                                    <v-tooltip bottom>
                                        <template v-slot:activator="{ props }">
                                            <v-text-field
                                                v-model="delayHours"
                                                :label="isDelay ? '延後小時' : '提前小時'"
                                                type="number"
                                                suffix="小時"
                                                v-bind="props"
                                                @input="(v) => validateDelayInput('hours', v.target.value, 23)"
                                            ></v-text-field>
                                        </template>
                                        <span>{{ isDelay ? "延後" : "提前" }}執行的小時數</span>
                                    </v-tooltip>
                                </v-col>

                                <v-col cols="6">
                                    <v-tooltip bottom>
                                        <template v-slot:activator="{ props }">
                                            <v-text-field
                                                v-model="delayMinutes"
                                                :label="isDelay ? '延後分鐘' : '提前分鐘'"
                                                type="number"
                                                suffix="分鐘"
                                                v-bind="props"
                                                @input="(v) => validateDelayInput('minutes', v.target.value, 59)"
                                            ></v-text-field>
                                        </template>
                                        <span>{{ isDelay ? "延後" : "提前" }}執行的分鐘數</span>
                                    </v-tooltip>
                                </v-col>

                                <v-col cols="12">
                                    <v-alert type="info" variant="outlined" density="compact">
                                        將把原定的同步時間{{ isDelay ? "延後" : "提前" }} {{ delayHours }} 小時
                                        {{ delayMinutes }} 分鐘
                                    </v-alert>
                                </v-col>
                            </v-row>
                        </v-window-item>
                    </v-window>
                </v-row>
            </v-card-text>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="grey darken-1" text @click="closeSyncDialog">取消</v-btn>
                <v-btn
                    color="primary"
                    @click="saveSyncSettings"
                    :disabled="currentTab === 0 ? !isSyncSettingComplete : delayHours === 0 && delayMinutes === 0"
                    :loading="isSaving"
                    >確認</v-btn
                >
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.v-toolbar {
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
