<script setup>
import { ref, inject, watch } from "vue";

const props = defineProps({
    modelValue: Boolean,
    newSiteData: Object,
    customFieldsData: Object,
    crawlerModes: Array,
    statusOptions: Array,
    fieldTypeOptions: Array,
});

const emit = defineEmits(["update:modelValue", "save", "close", "update:newSiteData", "update:customFieldsData"]);

const newSite = ref({});
const customFields = ref({});
const customFieldKey = ref("");
const customFieldType = ref("text");
const customFieldLabel = ref("");
const errorMessage = ref("");
const emitter = inject("emitter");

// 監聽外部變化並更新本地變數
watch(
    () => props.newSiteData,
    (newVal) => {
        if (newVal) {
            newSite.value = JSON.parse(JSON.stringify(newVal));
        }
    },
    { immediate: true, deep: true }
);

watch(
    () => props.customFieldsData,
    (newVal) => {
        if (newVal) {
            customFields.value = JSON.parse(JSON.stringify(newVal));
        }
    },
    { immediate: true, deep: true }
);

// 新增起始URL
const addStartUrl = () => {
    newSite.value.start.push("");
};

// 移除起始URL
const removeStartUrl = (index) => {
    if (newSite.value.start.length > 1) {
        newSite.value.start.splice(index, 1);
    }
};

// 新增自訂欄位
const addCustomField = () => {
    if (!customFieldKey.value || !customFieldType.value) return;

    // 檢查鍵是否已存在
    if (Object.keys(newSite.value).includes(customFieldKey.value)) {
        emitter.emit("openSnackbar", {
            message: `欄位 "${customFieldKey.value}" 已存在`,
            color: "error",
        });
        return;
    }

    // 根據選擇的類型設置默認值
    let defaultValue;
    switch (customFieldType.value) {
        case "text":
            defaultValue = "";
            break;
        case "number":
            defaultValue = 0;
            break;
        case "boolean":
            defaultValue = false;
            break;
        default:
            defaultValue = "";
    }

    // 新增欄位
    newSite.value[customFieldKey.value] = defaultValue;
    // 更新 customFields 追蹤
    customFields.value[customFieldKey.value] = defaultValue;

    // 重置輸入
    customFieldKey.value = "";
    customFieldType.value = "text";
    customFieldLabel.value = "";
    errorMessage.value = "";

    // 通知父元件更新
    emit("update:newSiteData", newSite.value);
    emit("update:customFieldsData", customFields.value);
};

// 移除自訂欄位
const removeCustomField = (key) => {
    if (key in newSite.value) {
        delete newSite.value[key];
        delete customFields.value[key];

        // 提示使用者欄位已移除
        emitter.emit("openSnackbar", {
            message: `已移除欄位: ${key}`,
            color: "info",
        });

        // 通知父元件更新
        emit("update:newSiteData", newSite.value);
        emit("update:customFieldsData", customFields.value);
    }
};

// 關閉對話框
const closeDialog = () => {
    // 保存當前自訂欄位狀態到父元件
    emit("close", customFields.value);
    emit("update:modelValue", false);
};

// 儲存新站點
const saveNewSite = () => {
    // 驗證必填字段
    if (!newSite.value.url || !newSite.value.site_name || !newSite.value.site_id) {
        emitter.emit("openSnackbar", {
            message: "請填寫所有必填欄位",
            color: "error",
        });
        return;
    }

    // 傳遞本地編輯後的資料給父元件
    emit("save", newSite.value, customFields.value);
};
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="900px"
        persistent
        @click:outside="closeDialog"
    >
        <v-card class="dialog-card">
            <v-card-title class="py-4 text-white headline bg-primary d-flex justify-space-between align-center">
                <v-icon class="mr-2" color="white">mdi-plus-circle</v-icon>
                新增站點
                <v-spacer></v-spacer>
                <v-btn icon variant="text" color="white" @click="closeDialog">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pt-4">
                <v-container>
                    <v-row>
                        <!-- 基本欄位 -->
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="newSite.id"
                                label="ID"
                                readonly
                                outlined
                                dense
                                bg-color="grey-lighten-4"
                                hint="id"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="newSite.url"
                                label="URL *"
                                required
                                outlined
                                dense
                                hint="輸入站點的網址 (url)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="newSite.site_name"
                                label="站點名稱 *"
                                required
                                outlined
                                dense
                                hint="輸入站點名稱 (site_name)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="newSite.site_id"
                                label="站點ID *"
                                required
                                outlined
                                dense
                                hint="輸入站點 ID (site_id)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="newSite.template_id"
                                label="模板 ID"
                                outlined
                                dense
                                hint="輸入模板 ID (template_id)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="newSite.template_name"
                                label="模板名稱"
                                outlined
                                dense
                                hint="輸入模板名稱 (template_name)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="newSite.crawler_mode"
                                :items="crawlerModes"
                                item-title="text"
                                item-value="value"
                                label="爬蟲模式"
                                outlined
                                dense
                                hint="選擇此站點使用的爬蟲模式 (crawler_mode)"
                                persistent-hint
                            ></v-select>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="newSite.active"
                                :items="statusOptions"
                                item-title="text"
                                item-value="value"
                                label="狀態"
                                outlined
                                dense
                                hint="選擇此站點狀態 (active)"
                                persistent-hint
                            ></v-select>
                        </v-col>

                        <!-- 起始 URL 欄位 -->
                        <v-col cols="12">
                            <v-divider class="mb-4"></v-divider>
                            <div class="mb-3 d-flex align-center">
                                <h3 class="mr-2 text-subtitle-1 font-weight-bold">起始URL (start)</h3>
                                <v-btn
                                    icon
                                    size="small"
                                    color="primary"
                                    variant="tonal"
                                    @click="addStartUrl"
                                    class="ml-2"
                                >
                                    <v-icon>mdi-plus</v-icon>
                                </v-btn>
                            </div>

                            <div v-for="(url, index) in newSite.start" :key="index" class="mb-3 d-flex">
                                <v-text-field
                                    v-model="newSite.start[index]"
                                    label="URL路徑"
                                    outlined
                                    dense
                                    class="mr-2 flex-grow-1"
                                    hint="輸入完整URL，包含http://或https://"
                                    persistent-hint
                                ></v-text-field>
                                <v-btn
                                    icon
                                    size="small"
                                    color="error"
                                    variant="text"
                                    @click="removeStartUrl(index)"
                                    :disabled="newSite.start.length <= 1"
                                    class="mt-1"
                                >
                                    <v-icon>mdi-delete</v-icon>
                                </v-btn>
                            </div>
                        </v-col>

                        <!-- 新增自定義欄位部分 -->
                        <v-col cols="12">
                            <v-divider class="mt-4 mb-2"></v-divider>
                            <h3 class="mb-3 text-subtitle-1 font-weight-bold">新增自訂欄位</h3>
                            <v-row>
                                <v-col cols="12" sm="4">
                                    <v-text-field
                                        v-model="customFieldKey"
                                        label="欄位名稱"
                                        outlined
                                        dense
                                        hide-details
                                        persistent-hint
                                    ></v-text-field>
                                </v-col>
                                <v-col cols="12" sm="4">
                                    <v-select
                                        v-model="customFieldType"
                                        :items="fieldTypeOptions"
                                        label="欄位類型"
                                        item-title="text"
                                        item-value="value"
                                        outlined
                                        hide-details
                                        dense
                                    ></v-select>
                                </v-col>
                                <v-col cols="12" sm="4" class="d-flex align-center">
                                    <v-btn color="primary" @click="addCustomField" :disabled="!customFieldKey" block>
                                        新增欄位
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-col>

                        <!-- 已新增的自定義欄位 - 使用與編輯對話框相同的格式 -->
                        <template v-for="(value, key) in customFields" :key="key">
                            <v-col cols="12" md="6">
                                <div class="mb-1 d-flex justify-space-between align-center">
                                    <span class="text-subtitle-2">{{ key }}</span>
                                    <v-btn
                                        icon
                                        size="small"
                                        color="error"
                                        variant="text"
                                        @click="removeCustomField(key)"
                                        class="ms-2"
                                    >
                                        <v-icon>mdi-delete</v-icon>
                                    </v-btn>
                                </div>
                                <template v-if="typeof value === 'boolean'">
                                    <v-select
                                        v-model="newSite[key]"
                                        :items="statusOptions"
                                        item-title="text"
                                        item-value="value"
                                        :label="`${key}`"
                                        dense
                                        :hint="`設定 ${key}`"
                                        persistent-hint
                                    ></v-select>
                                </template>
                                <template v-else-if="typeof value === 'number'">
                                    <v-text-field
                                        v-model.number="newSite[key]"
                                        :label="key"
                                        type="number"
                                        outlined
                                        dense
                                        :hint="`輸入 ${key}`"
                                        persistent-hint
                                    ></v-text-field>
                                </template>
                                <template v-else>
                                    <v-text-field
                                        v-model="newSite[key]"
                                        :label="key"
                                        outlined
                                        dense
                                        :hint="`輸入 ${key}`"
                                        persistent-hint
                                    ></v-text-field>
                                </template>
                            </v-col>
                        </template>

                        <!-- 爬蟲類別欄位選項 -->
                        <v-col cols="12" v-if="newSite.crawler_mode === 'crawler'">
                            <v-divider class="mb-4"></v-divider>
                            <h3 class="mb-3 text-subtitle-1 font-weight-bold">爬蟲類別設定</h3>
                            <v-text-field
                                v-model="newSite.crawler_class"
                                label="爬蟲類別"
                                outlined
                                dense
                                hint="例如: src.crawler.LawNewsCrawler"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions class="px-6 py-3 action-sticky">
                <v-btn color="grey" variant="text" @click="closeDialog"> 取消 </v-btn>
                <v-btn color="success" variant="text" @click="saveNewSite"> 新增站點 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.action-sticky {
    flex: 0 0 auto;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    position: sticky;
    bottom: 0;
    background: white;
    z-index: 2;
    padding: 12px 24px;
}

.dialog-card {
    border-radius: 8px;
    overflow: hidden;
}
</style>
