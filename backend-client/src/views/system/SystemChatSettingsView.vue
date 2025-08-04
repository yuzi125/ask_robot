<script setup>
import { ref, inject, computed, watch } from "vue";
import { useQuery, useMutation } from "@tanstack/vue-query";
import SystemHeader from "@/components/system/SystemHeader.vue";
import ConversationDirectionSelector from "@/components/system/ConversationDirectionSelector.vue";
import ChunkDisplayToggle from "@/components/system/ChunkDisplayToggle.vue";

import RecordRTC from "@/components/system/RecordRTC.vue";
import MinMessageLength from "@/components/system/MinMessageLength.vue";
import MaxMessageLength from "@/components/system/MaxMessageLength.vue";
import useSaveShortcut from "@/composables/useSaveShortcut";
import inputPlaceholder from "@/components/system/inputPlaceholder.vue";
import inputHeight from "@/components/system/inputHeight.vue";
import ChatFileUploadEnable from "@/components/system/ChatFileUploadEnable.vue";
import ChatFileTranslateEnable from "@/components/system/ChatFileTranslateEnable.vue";
const axios = inject("axios");
const emitter = inject("emitter");

// 初始默認值
const defaultSettings = {
    conversationDirection: "左側",
    sourceChunk: "開啟",
    extraChunk: "開啟",
    recordRTC: "關閉",
    chatInputPlaceholder: "請輸入訊息",
    chatInputHeight: 1,
    minMessageLength: 4,
    maxMessageLength: 200,
    chatFileUploadEnable: "關閉",
    chatFileTranslateEnable: "關閉",
};

// 當前編輯中的設定
const editableSettings = ref({ ...defaultSettings });
// 原始設定（用於比較變更）
const originalSettings = ref({ ...defaultSettings });

// 數據轉換函數
const transformSettings = (data) => {
    if (!data) return defaultSettings;

    // 保存原始資料的對應關係
    const originalMapping = {
        conversation_direction: data.conversation_direction,
        show_source_chunk: data.show_source_chunk,
        show_extra_chunk: data.show_extra_chunk,
        enable_rtc_recording: data.enable_rtc_recording,
        welcome_word_update_frequency: data.welcome_word_update_frequency,
        chat_input_placeholder: data.chat_input_placeholder,
        chat_input_height: data.chat_input_height,
        min_message_length: data.min_message_length,
        max_message_length: data.max_message_length,
        chat_file_upload_enable: data.chat_file_upload_enable,
        chat_file_translate_enable: data.chat_file_translate_enable,
    };

    return {
        conversationDirection: data.conversation_direction === "left" ? "左側" : "右側",
        sourceChunk: data.show_source_chunk == 1 ? "開啟" : "關閉",
        extraChunk: data.show_extra_chunk == 1 ? "開啟" : "關閉",
        recordRTC: data.enable_rtc_recording == 1 ? "開啟" : "關閉",
        chatFileUploadEnable: data.chat_file_upload_enable == 1 ? "開啟" : "關閉",
        chatFileTranslateEnable: data.chat_file_translate_enable == 1 ? "開啟" : "關閉",
        chatInputPlaceholder: data.chat_input_placeholder,
        chatInputHeight: data.chat_input_height,
        minMessageLength: data.min_message_length,
        maxMessageLength: data.max_message_length,
        originalData: originalMapping, // 保存原始數據的映射
    };
};

// 獲取系統設定
const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: async () => {
        const response = await axios.get("/system/getChatSettings");
        if (response.data.code !== 0) {
            throw new Error("Failed to fetch system settings");
        }
        return response.data.data;
    },
});

// 監聽數據變化
watch(
    () => data.value,
    (newData) => {
        if (newData) {
            const transformedData = transformSettings(newData);
            editableSettings.value = { ...transformedData };
            originalSettings.value = { ...transformedData };
        }
    },
    { immediate: true }
);

// 檢查是否有變更
const hasChanges = computed(() => {
    if (!editableSettings.value || !originalSettings.value) return false;

    return Object.keys(editableSettings.value).some((key) => {
        // 確保兩個值都轉為字符串進行比較
        const editableValue = String(editableSettings.value[key]);
        const originalValue = String(originalSettings.value[key]);
        return editableValue !== originalValue;
    });
});

// 轉換回 API 格式
const transformToApiFormat = (settings) => {
    return {
        conversation_direction: settings.conversationDirection == "左側" ? "left" : "right",
        show_source_chunk: settings.sourceChunk == "開啟" ? 1 : 0,
        show_extra_chunk: settings.extraChunk == "開啟" ? 1 : 0,
        enable_rtc_recording: settings.recordRTC == "開啟" ? 1 : 0,
        chat_file_upload_enable: settings.chatFileUploadEnable == "開啟" ? 1 : 0,
        chat_file_translate_enable: settings.chatFileTranslateEnable == "開啟" ? 1 : 0,
        min_message_length: Number(settings.minMessageLength),
        max_message_length: Number(settings.maxMessageLength),
        chat_input_placeholder: settings.chatInputPlaceholder,
        chat_input_height: Number(settings.chatInputHeight),
    };
};

// 更新 mutation
const { mutate: updateMutation, isPending: updateMutationPending } = useMutation({
    mutationFn: async (settings) => {
        const apiData = transformToApiFormat(settings);
        const response = await axios.put("/system/updateSettings", apiData);
        if (response.data.code !== 0) {
            throw new Error("更新失敗");
        }
        return response.data;
    },
    onSuccess: () => {
        emitter.emit("openSnackbar", { message: "設定已更新", color: "success" });
        originalSettings.value = { ...editableSettings.value };
        refetch();
    },
    onError: (error) => {
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    },
});

const keyMapping = {
    conversation_direction: "conversationDirection",
    show_source_chunk: "sourceChunk",
    show_extra_chunk: "extraChunk",
    enable_rtc_recording: "recordRTC",
    min_message_length: "minMessageLength",
    max_message_length: "maxMessageLength",
    chat_input_placeholder: "chatInputPlaceholder",
    chat_input_height: "chatInputHeight",
    chat_file_upload_enable: "chatFileUploadEnable",
    chat_file_translate_enable: "chatFileTranslateEnable",
};

const resetToDefault = (apiKey) => {
    const editableKey = keyMapping[apiKey];
    if (editableKey && originalSettings.value) {
        // 根據原始資料格式轉換值
        let value;
        switch (apiKey) {
            case "conversation_direction":
                value = originalSettings.value.originalData[apiKey] === "left" ? "左側" : "右側";
                break;
            case "show_source_chunk":
            case "show_extra_chunk":
            case "enable_rtc_recording":
            case "chat_file_upload_enable":
                value = originalSettings.value.originalData[apiKey] == 1 ? "開啟" : "關閉";
                break;
            default:
                value = originalSettings.value.originalData[apiKey];
        }
        editableSettings.value[editableKey] = value;
    }
};

// Header Actions
const headerActions = computed(() => [
    {
        id: "refresh",
        text: "更新資料",
        icon: "mdi-refresh",
        color: "info",
        loading: isFetching.value,
    },
    {
        id: "save",
        text: "儲存設定",
        icon: "mdi-content-save",
        color: "primary",
        loading: updateMutationPending.value,
        disabled: !hasChanges.value,
    },
]);

// 保存所有變更
const save = () => {
    if (hasChanges.value) {
        const isDataAllValid = Object.values(dataInvalid.value).every((value) => value === false);
        if (isDataAllValid) {
            updateMutation(editableSettings.value);
        } else {
            emitter.emit("openSnackbar", {
                message: "請檢查所有輸入框是否填寫正確",
                color: "error",
            });
        }
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

// 紀錄資料是否不合格
const dataInvalid = ref({
    chatInputPlaceholder: false,
    chatInputHeight: false,
    minMessageLength: false,
    maxMessageLength: false,
});
const changeDataStatus = (newValue) => {
    dataInvalid.value[newValue.name] = newValue.invalid;
};
</script>

<template>
    <div class="settings-container">
        <SystemHeader
            title="聊天室基本設定"
            subtitle="調整聊天室基本功能設定（按下 Ctrl+S 可以直接儲存）"
            icon="mdi-chat"
            :actions="headerActions"
            @action="handleHeaderAction"
        />

        <v-row v-if="isLoading">
            <v-col cols="12" md="6">
                <v-skeleton-loader class="mx-auto" elevation="2" type="paragraph, paragraph" />
            </v-col>
            <v-col cols="12" md="6">
                <v-skeleton-loader class="mx-auto" elevation="2" type="paragraph, paragraph" />
            </v-col>
        </v-row>

        <v-container v-else class="px-0">
            <v-row>
                <!-- 基本設定卡片 -->
                <v-col cols="12" md="6">
                    <v-card elevation="2">
                        <v-card-item>
                            <div class="mb-4 d-flex align-center justify-space-between">
                                <div class="d-flex align-center">
                                    <v-icon icon="mdi-tune" color="primary" size="24" class="mr-2" />
                                    <div>
                                        <div class="text-h6">基本設定</div>
                                        <div class="text-subtitle-2 text-grey">調整系統基本功能設定</div>
                                    </div>
                                </div>

                                <v-tooltip location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon="mdi-restore"
                                            variant="text"
                                            color="primary"
                                            density="comfortable"
                                            @click="
                                                () => {
                                                    resetToDefault('conversation_direction');
                                                    resetToDefault('enable_rtc_recording');
                                                    resetToDefault('welcome_word_update_frequency');
                                                    resetToDefault('min_message_length');
                                                    resetToDefault('max_message_length');
                                                    resetToDefault('chat_input_placeholder');
                                                    resetToDefault('chat_input_height');
                                                    resetToDefault('chat_file_upload_enable');
                                                    resetToDefault('chat_file_translate_enable');
                                                }
                                            "
                                        >
                                        </v-btn>
                                    </template>
                                    還原
                                </v-tooltip>
                            </div>

                            <div class="settings-group">
                                <ConversationDirectionSelector v-model="editableSettings.conversationDirection" />
                                <ChatFileUploadEnable
                                    label="檔案上傳功能"
                                    @changeDataStatus="changeDataStatus"
                                    v-model="editableSettings.chatFileUploadEnable"
                                />
                                <ChatFileTranslateEnable
                                    label="檔案翻譯功能"
                                    @changeDataStatus="changeDataStatus"
                                    v-model="editableSettings.chatFileTranslateEnable"
                                />
                                <RecordRTC label="語音輸入功能" v-model="editableSettings.recordRTC" />
                                <inputPlaceholder
                                    @changeDataStatus="changeDataStatus"
                                    v-model="editableSettings.chatInputPlaceholder"
                                />
                                <inputHeight
                                    @changeDataStatus="changeDataStatus"
                                    v-model="editableSettings.chatInputHeight"
                                />
                                <MinMessageLength
                                    @changeDataStatus="changeDataStatus"
                                    v-model="editableSettings.minMessageLength"
                                />
                                <MaxMessageLength
                                    @changeDataStatus="changeDataStatus"
                                    v-model="editableSettings.maxMessageLength"
                                />
                            </div>
                        </v-card-item>
                    </v-card>
                </v-col>

                <!-- 顯示設定卡片 -->
                <v-col cols="12" md="6">
                    <v-card elevation="2">
                        <v-card-item>
                            <div class="mb-4 d-flex align-center justify-space-between">
                                <div class="d-flex align-center">
                                    <v-icon icon="mdi-eye" color="primary" size="24" class="mr-2" />
                                    <div>
                                        <div class="text-h6">顯示設定</div>
                                        <div class="text-subtitle-2 text-grey">調整系統顯示內容設定</div>
                                    </div>
                                </div>
                                <v-tooltip location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon="mdi-restore"
                                            variant="text"
                                            color="primary"
                                            density="comfortable"
                                            @click="
                                                () => {
                                                    resetToDefault('show_extra_chunk');
                                                    resetToDefault('show_source_chunk');
                                                }
                                            "
                                        >
                                        </v-btn>
                                    </template>
                                    還原
                                </v-tooltip>
                            </div>

                            <div class="settings-group">
                                <ChunkDisplayToggle label="顯示資料來源" v-model="editableSettings.sourceChunk" />
                                <ChunkDisplayToggle label="顯示資料相關" v-model="editableSettings.extraChunk" />
                            </div>
                        </v-card-item>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
    </div>
</template>

<style scoped>
.settings-container {
    padding: 2em;
}

.settings-group {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.cancel-button {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 99;
}

@media (max-width: 960px) {
    .settings-container {
        padding: 1em;
    }

    .cancel-button {
        bottom: 1rem;
        right: 1rem;
    }
}
</style>
