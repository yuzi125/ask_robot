<script setup>
import { ref, reactive, computed, watch, inject } from "vue";
import { useQuery } from "@tanstack/vue-query";
import useSaveShortcut from "@/composables/useSaveShortcut";
import SystemHeader from "@/components/system/SystemHeader.vue";
const axios = inject("axios");
const emitter = inject("emitter");

const isSaving = ref(false);
const selectedExperts = ref([]);
const selectedApiKeys = ref([]);
const originalSettings = ref(null);

const settings = reactive({
    systemWide: { maxRequests: 1000, windowMs: 60000 },
    allExperts: { maxRequests: 500, windowMs: 60000 },
    expertSpecific: {},
    users: { maxRequests: 5, windowMs: 60000 },
});

const convertMsToS = (ms) => Math.round(ms / 1000);
const convertSToMs = (s) => s * 1000;

const {
    data: settingsData,
    isLoading: isSettingsLoading,
    isFetching: isSettingsFetching,
    refetch,
} = useQuery({
    queryKey: ["chatSettings"],
    queryFn: async () => {
        const response = await axios.get("/system/getChatSettings");
        return response.data.data.rateLimitRules;
    },
});

const { data: expertListData, isLoading: isExpertListLoading } = useQuery({
    queryKey: ["expertList"],
    queryFn: async () => {
        const response = await axios.get("/expert/expert");
        return response.data.data;
    },
});

const { data: apiKeyListData, isLoading: isApiKeyListLoading } = useQuery({
    queryKey: ["apiKeyList"],
    queryFn: async () => {
        const response = await axios.get("/system/getAPIKeys?MODE=simple");
        return response.data.data;
    },
});

const hasChanges = computed(() => {
    if (!originalSettings.value) return false;

    // 比較 systemWide 設定
    const systemWideChanged =
        settings.systemWide.maxRequests !== originalSettings.value.systemWide.maxRequests ||
        settings.systemWide.windowS !== originalSettings.value.systemWide.windowS;

    // 比較 allExperts 設定
    const allExpertsChanged =
        settings.allExperts.maxRequests !== originalSettings.value.allExperts.maxRequests ||
        settings.allExperts.windowS !== originalSettings.value.allExperts.windowS;

    // 比較 users 設定
    const usersChanged =
        settings.users.maxRequests !== originalSettings.value.users.maxRequests ||
        settings.users.windowS !== originalSettings.value.users.windowS;

    // 比較 expertSpecific 設定
    const expertSpecificChanged =
        JSON.stringify(settings.expertSpecific) !== JSON.stringify(originalSettings.value.expertSpecific);

    // 比較 apiKeySpecific 設定
    const apiKeySpecificChanged =
        JSON.stringify(settings.apiKeySpecific) !== JSON.stringify(originalSettings.value.apiKeySpecific);

    return systemWideChanged || allExpertsChanged || usersChanged || expertSpecificChanged || apiKeySpecificChanged;
});

// Header Actions
const headerActions = computed(() => [
    {
        id: "refresh",
        text: "更新資料",
        icon: "mdi-refresh",
        color: "info",
        loading: isSettingsFetching.value,
    },
    {
        id: "save",
        text: "儲存設定",
        icon: "mdi-content-save",
        color: "primary",
        loading: isSaving.value,
        // disabled: !hasChanges.value,
    },
]);

const expertList = computed(() => expertListData.value || []);
const apiKeyList = computed(() => apiKeyListData.value || []);

const expertNameMap = computed(() => {
    return expertList.value.reduce((acc, expert) => {
        acc[expert.id] = expert.name;
        return acc;
    }, {});
});

const apiKeyNameMap = computed(() => {
    return apiKeyList.value.reduce((acc, apiKey) => {
        acc[apiKey.id] = apiKey.name;
        return acc;
    }, {});
});

const getExpertNameById = (id) => {
    return expertNameMap.value[id] || id;
};

const getApiKeyNameById = (id) => {
    return apiKeyNameMap.value[id] || id;
};

const updateSelectedExperts = () => {
    selectedExperts.value = Object.entries(settings.expertSpecific).map(([id, limit]) => ({
        id,
        name: getExpertNameById(id),
        maxRequests: limit.maxRequests,
        windowS: limit.windowS || convertMsToS(limit.windowMs) || 60,
        errorMessage: limit.errorMessage || "已達到流量限制，請稍後再試",
    }));
};

const updateSelectedApiKeys = () => {
    selectedApiKeys.value = Object.entries(settings?.apiKeySpecific || {}).map(([id, limit]) => ({
        id,
        name: getApiKeyNameById(id),
        maxRequests: limit.maxRequests,
        windowS: limit.windowS || convertMsToS(limit.windowMs) || 60,
        errorMessage: limit.errorMessage || "已達到流量限制，請稍後再試",
    }));
};

const handleExpertSelection = () => {
    // 保存現有的設定
    const existingSettings = { ...settings.expertSpecific };

    // 清空當前設定
    settings.expertSpecific = {};

    // 重新添加選中的專家，保留已有的設定
    selectedExperts.value.forEach((expert) => {
        // 如果專家已經有設定，則使用現有設定
        if (existingSettings[expert.id]) {
            settings.expertSpecific[expert.id] = existingSettings[expert.id];
        } else {
            // 如果是新專家，則使用默認設定
            settings.expertSpecific[expert.id] = {
                maxRequests: expert.maxRequests || 100,
                windowMs: expert.windowMs || 60000,
                windowS: expert.windowS || 60,
                errorMessage: expert.errorMessage || "已達到流量限制，請稍後再試",
            };
        }
    });
};

const handleApiKeySelection = () => {
    // 保存現有的設定
    const existingSettings = { ...settings.apiKeySpecific };

    // 清空當前設定
    settings.apiKeySpecific = {};

    // 重新添加選中的專家，保留已有的設定
    selectedApiKeys.value.forEach((apiKey) => {
        // 如果專家已經有設定，則使用現有設定
        if (existingSettings[apiKey.id]) {
            settings.apiKeySpecific[apiKey.id] = existingSettings[apiKey.id];
        } else {
            // 如果是新專家，則使用默認設定
            settings.apiKeySpecific[apiKey.id] = {
                maxRequests: apiKey.maxRequests || 100,
                windowMs: apiKey.windowMs || 60000,
                windowS: apiKey.windowS || 60,
                errorMessage: apiKey.errorMessage || "已達到流量限制，請稍後再試",
            };
        }
    });
};

const removeExpertLimit = (id) => {
    delete settings.expertSpecific[id];
    updateSelectedExperts();
};

const removeApiKeyLimit = (id) => {
    delete settings.apiKeySpecific[id];
    updateSelectedApiKeys();
};

const save = async () => {
    try {
        isSaving.value = true;
        // 創建一個深拷貝並轉換設置
        const convertedSettings = JSON.parse(JSON.stringify(settings));

        // 轉換並清理 systemWide
        convertedSettings.systemWide.windowMs = convertSToMs(convertedSettings.systemWide.windowS);
        delete convertedSettings.systemWide.windowS;

        // 轉換並清理 allExperts
        convertedSettings.allExperts.windowMs = convertSToMs(convertedSettings.allExperts.windowS);
        delete convertedSettings.allExperts.windowS;

        // 轉換並清理 users
        convertedSettings.users.windowMs = convertSToMs(convertedSettings.users.windowS);
        delete convertedSettings.users.windowS;

        // 轉換並清理 expertSpecific
        for (const expert in convertedSettings.expertSpecific) {
            convertedSettings.expertSpecific[expert].windowMs = convertSToMs(
                convertedSettings.expertSpecific[expert].windowS
            );
            delete convertedSettings.expertSpecific[expert].windowS;
        }

        // 轉換並清理 apiKeySpecific
        for (const apiKey in convertedSettings.apiKeySpecific) {
            convertedSettings.apiKeySpecific[apiKey].windowMs = convertSToMs(
                convertedSettings.apiKeySpecific[apiKey].windowS
            );
            delete convertedSettings.apiKeySpecific[apiKey].windowS;
        }

        console.log("Converted settings", convertedSettings);

        const response = await axios.put("/system/updateRateLimit", { rateLimitRules: convertedSettings });
        if (response.data.code === 0) {
            console.log("儲存設定成功");
            emitter.emit("openSnackbar", { message: "儲存成功", color: "success" });
            refetch();
        } else {
            throw new Error(response.data.message || "儲存設定失敗");
        }
    } catch (error) {
        console.error("儲存設定時發生錯誤:", error);
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    } finally {
        isSaving.value = false;
    }
};

const handleHeaderAction = (actionId) => {
    switch (actionId) {
        case "save":
            save();
            break;
        case "refresh":
            refetch();
            break;
    }
};

// 設定 ctrl+s 快捷鍵
useSaveShortcut(save);

watch(
    settingsData,
    (newSettings) => {
        if (newSettings) {
            const writableSettings = JSON.parse(JSON.stringify(newSettings));
            console.log("newSettings", writableSettings);
            writableSettings.systemWide.windowS = convertMsToS(writableSettings.systemWide.windowMs);
            writableSettings.allExperts.windowS = convertMsToS(writableSettings.allExperts.windowMs);
            writableSettings.users.windowS = convertMsToS(writableSettings.users.windowMs);
            for (const expert in writableSettings.expertSpecific) {
                writableSettings.expertSpecific[expert].windowS = convertMsToS(
                    writableSettings.expertSpecific[expert].windowMs
                );
            }
            Object.assign(settings, writableSettings);
            // 保存原始設定
            originalSettings.value = JSON.parse(JSON.stringify(writableSettings));
            updateSelectedExperts();
        }
    },
    { deep: true, immediate: true }
);

watch(
    expertList,
    () => {
        updateSelectedExperts();
    },
    { deep: true }
);

watch(
    () => settings.expertSpecific,
    () => {
        updateSelectedExperts();
    },
    { deep: true }
);

watch(
    () => apiKeyList,
    () => {
        updateSelectedApiKeys();
    },
    { deep: true }
);

watch(
    () => settings.apiKeySpecific,
    () => {
        updateSelectedApiKeys();
    },
    { deep: true }
);
</script>

<template>
    <div class="settings-container">
        <div class="sticky-header">
            <SystemHeader
                title="系統限流設定"
                subtitle="設定系統流量限制（按下 Ctrl+S 可以直接儲存）"
                icon="mdi-speedometer"
                :actions="headerActions"
                @action="handleHeaderAction"
            />
        </div>

        <v-row class="justify-space-between">
            <v-col cols="12">
                <v-row>
                    <v-col cols="12" md="6">
                        <v-card class="mb-6 rounded">
                            <div class="px-6 pt-4 pb-2">
                                <div class="d-flex align-center">
                                    <div class="d-flex align-center">
                                        <v-icon size="32" class="mr-3" color="primary">mdi-web</v-icon>
                                        <div>
                                            <div class="text-h6">系統流量總限制</div>
                                            <div class="text-caption text-medium-emphasis">
                                                在此設定系統的流量限制，當請求達到設定的限制時，系統會顯示錯誤訊息。
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <v-card-text>
                                <v-text-field
                                    v-model="settings.systemWide.maxRequests"
                                    label="最大請求數"
                                    type="number"
                                    min="1"
                                    outlined
                                    dense
                                    hide-details
                                ></v-text-field>
                                <v-text-field
                                    v-model="settings.systemWide.windowS"
                                    label="限制請求的計時週期 (秒)"
                                    type="number"
                                    min="1"
                                    outlined
                                    dense
                                    hide-details
                                    class="mt-3"
                                ></v-text-field>
                                <v-text-field
                                    v-model="settings.systemWide.errorMessage"
                                    label="限流錯誤訊息"
                                    placeholder="請輸入達到限流時顯示的錯誤訊息"
                                    hint="當系統請求達到限制時將顯示此訊息"
                                    persistent-hint
                                    outlined
                                    dense
                                    class="mt-3"
                                ></v-text-field>
                            </v-card-text>
                        </v-card>
                    </v-col>

                    <v-col cols="12" md="6">
                        <v-card class="mb-6 rounded">
                            <div class="px-6 pt-4 pb-2">
                                <div class="d-flex align-center">
                                    <div class="d-flex align-center">
                                        <v-icon size="32" class="mr-3" color="primary">mdi-account-group</v-icon>
                                        <div>
                                            <div class="text-h6">所有專家流量總限制</div>
                                            <div class="text-caption text-medium-emphasis">
                                                在此設定所有專家的流量限制，當請求達到設定的限制時，系統會顯示錯誤訊息。
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <v-card-text>
                                <v-text-field
                                    v-model="settings.allExperts.maxRequests"
                                    label="最大請求數"
                                    type="number"
                                    min="1"
                                    outlined
                                    dense
                                    hide-details
                                ></v-text-field>
                                <v-text-field
                                    v-model="settings.allExperts.windowS"
                                    label="限制請求的計時週期 (秒)"
                                    type="number"
                                    min="1"
                                    outlined
                                    dense
                                    hide-details
                                    class="mt-3"
                                ></v-text-field>
                                <v-text-field
                                    v-model="settings.allExperts.errorMessage"
                                    label="限流錯誤訊息"
                                    placeholder="請輸入達到限流時顯示的錯誤訊息"
                                    hint="當所有專家請求達到限制時將顯示此訊息"
                                    persistent-hint
                                    outlined
                                    dense
                                    class="mt-3"
                                ></v-text-field>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <v-card class="mb-6 rounded">
                    <div class="px-6 pt-4 pb-2">
                        <div class="d-flex align-center">
                            <div class="d-flex align-center">
                                <v-icon size="32" class="mr-3" color="primary">mdi-account-multiple</v-icon>
                                <div>
                                    <div class="text-h6">單一使用者流量限制</div>
                                    <div class="text-caption text-medium-emphasis">
                                        在此設定單一使用者的流量限制，當請求達到設定的限制時，系統會顯示錯誤訊息。
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <v-card-text>
                        <v-row>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="settings.users.maxRequests"
                                    label="最大請求數"
                                    type="number"
                                    min="1"
                                    outlined
                                    dense
                                    hide-details
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="settings.users.windowS"
                                    label="限制請求的計時週期 (秒)"
                                    type="number"
                                    min="1"
                                    outlined
                                    dense
                                    hide-details
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12">
                                <v-text-field
                                    v-model="settings.users.errorMessage"
                                    label="限流錯誤訊息"
                                    placeholder="請輸入達到限流時顯示的錯誤訊息"
                                    hint="當使用者請求達到限制時將顯示此訊息"
                                    persistent-hint
                                    outlined
                                    dense
                                ></v-text-field>
                            </v-col>
                        </v-row>
                    </v-card-text>
                </v-card>

                <v-card class="mb-6 rounded">
                    <div class="px-6 pt-4 pb-2">
                        <div class="d-flex align-center">
                            <div class="d-flex align-center">
                                <v-icon size="32" class="mr-3" color="primary">mdi-account-cog</v-icon>
                                <div>
                                    <div class="text-h6">專家流量限制</div>
                                    <div class="text-caption text-medium-emphasis">
                                        在此設定各專家的流量限制與達到限制時的錯誤訊息。當請求達到設定的限制時，系統會顯示對應的錯誤訊息。
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 新增提示文字 -->

                    <v-card-text>
                        <v-combobox
                            v-model="selectedExperts"
                            :items="expertList"
                            item-title="name"
                            item-value="id"
                            label="選擇專家"
                            multiple
                            chips
                            outlined
                            dense
                            :loading="isExpertListLoading"
                            :disabled="isExpertListLoading"
                            @update:model-value="handleExpertSelection"
                            return-object
                            hide-details
                        >
                            <template v-slot:chip="{ props, item }">
                                <v-chip v-bind="props" :text="getExpertNameById(item.raw.id)"></v-chip>
                            </template>
                        </v-combobox>

                        <v-row class="mt-4">
                            <v-col cols="12" v-for="(expert, id) in settings.expertSpecific" :key="id">
                                <v-card class="expert-card">
                                    <v-card-title class="text-h6">
                                        <div class="d-flex justify-md-center align-center">
                                            專家名稱:{{ getExpertNameById(id) }}
                                            <v-spacer></v-spacer>
                                            <v-btn
                                                color="error"
                                                icon="mdi-trash-can"
                                                variant="text"
                                                @click="removeExpertLimit(id)"
                                            >
                                            </v-btn>
                                        </div>
                                    </v-card-title>
                                    <v-card-text>
                                        <v-row>
                                            <v-col cols="12" sm="6">
                                                <v-text-field
                                                    v-model="expert.maxRequests"
                                                    label="最大請求數"
                                                    type="number"
                                                    min="1"
                                                    outlined
                                                    dense
                                                    hide-details
                                                ></v-text-field>
                                            </v-col>
                                            <v-col cols="12" sm="6">
                                                <v-text-field
                                                    v-model="expert.windowS"
                                                    label="限制請求的計時週期 (秒)"
                                                    type="number"
                                                    min="1"
                                                    placeholder="60"
                                                    outlined
                                                    dense
                                                    hide-details
                                                ></v-text-field>
                                            </v-col>
                                            <!-- 新增錯誤訊息輸入欄位 -->
                                            <v-col cols="12">
                                                <v-text-field
                                                    v-model="expert.errorMessage"
                                                    label="限流錯誤訊息"
                                                    placeholder="請輸入達到限流時顯示的錯誤訊息"
                                                    hint="當請求達到限制時將顯示此訊息"
                                                    persistent-hint
                                                    outlined
                                                    dense
                                                ></v-text-field>
                                            </v-col>
                                        </v-row>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                    </v-card-text>
                </v-card>

                <v-card class="mb-6 rounded">
                    <div class="px-6 pt-4 pb-2">
                        <div class="d-flex align-center">
                            <div class="d-flex align-center">
                                <v-icon size="32" class="mr-3" color="primary">mdi-account-cog</v-icon>
                                <div>
                                    <div class="text-h6">API Key流量限制</div>
                                    <div class="text-caption text-medium-emphasis">
                                        在此設定各 API Key
                                        的流量限制與達到限制時的錯誤訊息。當請求達到設定的限制時，系統會顯示對應的錯誤訊息。
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 新增提示文字 -->

                    <v-card-text>
                        <v-combobox
                            v-model="selectedApiKeys"
                            :items="apiKeyList"
                            item-title="name"
                            item-value="id"
                            label="選擇API Key"
                            multiple
                            chips
                            outlined
                            dense
                            :loading="isApiKeyListLoading"
                            :disabled="isApiKeyListLoading"
                            @update:model-value="handleApiKeySelection"
                            return-object
                            hide-details
                        >
                            <template v-slot:chip="{ props, item }">
                                <v-chip v-bind="props" :text="getApiKeyNameById(item.raw.id)"></v-chip>
                            </template>
                        </v-combobox>

                        <v-row class="mt-4">
                            <v-col cols="12" v-for="(apiKey, id) in settings.apiKeySpecific" :key="id">
                                <v-card class="expert-card">
                                    <v-card-title class="text-h6">
                                        <div class="d-flex justify-md-center align-center">
                                            API Key名稱:{{ getApiKeyNameById(id) }}
                                            <v-spacer></v-spacer>
                                            <v-btn
                                                color="error"
                                                icon="mdi-trash-can"
                                                variant="text"
                                                @click="removeApiKeyLimit(id)"
                                            >
                                            </v-btn>
                                        </div>
                                    </v-card-title>
                                    <v-card-text>
                                        <v-row>
                                            <v-col cols="12" sm="6">
                                                <v-text-field
                                                    v-model="apiKey.maxRequests"
                                                    label="最大請求數"
                                                    type="number"
                                                    min="1"
                                                    outlined
                                                    dense
                                                    hide-details
                                                ></v-text-field>
                                            </v-col>
                                            <v-col cols="12" sm="6">
                                                <v-text-field
                                                    v-model="apiKey.windowS"
                                                    label="限制請求的計時週期 (秒)"
                                                    type="number"
                                                    min="1"
                                                    placeholder="60"
                                                    outlined
                                                    dense
                                                    hide-details
                                                ></v-text-field>
                                            </v-col>
                                            <!-- 新增錯誤訊息輸入欄位 -->
                                            <v-col cols="12">
                                                <v-text-field
                                                    v-model="apiKey.errorMessage"
                                                    label="限流錯誤訊息"
                                                    placeholder="請輸入達到限流時顯示的錯誤訊息"
                                                    hint="當請求達到限制時將顯示此訊息"
                                                    persistent-hint
                                                    outlined
                                                    dense
                                                ></v-text-field>
                                            </v-col>
                                        </v-row>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
.settings-container {
    padding: 2em;
    padding-top: 0;
}

.sticky-header {
    position: sticky;
    top: -35px;
    z-index: 100;

    padding-top: 2em;
    padding-bottom: 1em;
    /* margin-bottom: 1em; */
}

.save-button {
    min-width: 200px;
}
.expert-card {
    background-color: #f5f5f5;
    margin-bottom: 16px;
    border-radius: 8px;
}
.expert-card:nth-child(even) {
    background-color: #e0e0e0;
}
</style>
