<script setup>
import { ref, computed, inject, watch } from "vue";

const props = defineProps({
    modelValue: Boolean,
    currentSite: Object,
    editedSite: Object,
    siteFields: Array,
    crawlerModes: Array,
    statusOptions: Array,
    downloadAttachmentOptions: Array,
    fieldTypeOptions: Array,
});

const emit = defineEmits(["update:modelValue", "save", "close"]);

const customFieldKey = ref("");
const customFieldType = ref("text");
const customFieldLabel = ref("");
const errorMessage = ref("");
const emitter = inject("emitter");

// 創建本地響應式變數以避免直接修改 props
const localEditedSite = ref({});
const localSiteFields = ref([]);

// 監聽外部變化並更新本地變數
watch(
    () => props.editedSite,
    (newVal) => {
        if (newVal) {
            localEditedSite.value = JSON.parse(JSON.stringify(newVal));
        }
    },
    { immediate: true, deep: true }
);

watch(
    () => props.siteFields,
    (newVal) => {
        if (newVal) {
            localSiteFields.value = JSON.parse(JSON.stringify(newVal));
        }
    },
    { immediate: true, deep: true }
);

// 新增起始URL
const addStartUrl = () => {
    localEditedSite.value.start.push("");
};

// 移除起始URL
const removeStartUrl = (index) => {
    if (localEditedSite.value.start.length > 1) {
        localEditedSite.value.start.splice(index, 1);
    }
};

// 新增自訂欄位
const addCustomField = () => {
    if (!customFieldKey.value || !customFieldType.value) return;

    // 檢查鍵是否已存在
    if (Object.keys(localEditedSite.value).includes(customFieldKey.value)) {
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
    localEditedSite.value[customFieldKey.value] = defaultValue;

    // 新增到欄位列表
    localSiteFields.value.push({
        key: customFieldKey.value,
        label: customFieldLabel.value || customFieldKey.value,
        type: customFieldType.value,
    });

    // 重置輸入
    customFieldKey.value = "";
    customFieldType.value = "text";
    customFieldLabel.value = "";
    errorMessage.value = "";
};

// 移除自訂欄位
const removeCustomField = (key) => {
    if (key in localEditedSite.value) {
        delete localEditedSite.value[key];
        // 也從欄位列表中移除
        localSiteFields.value = localSiteFields.value.filter((field) => field.key !== key);

        // 提示使用者欄位已移除
        emitter.emit("openSnackbar", {
            message: `已移除欄位: ${key}`,
            color: "info",
        });
    }
};

// 關閉對話框
const closeDialog = () => {
    // 重置表單
    customFieldKey.value = "";
    customFieldType.value = "text";
    customFieldLabel.value = "";
    errorMessage.value = "";
    emit("close");
    emit("update:modelValue", false);
};

// 保存編輯
const saveEdit = () => {
    // 傳遞本地編輯後的資料給父元件
    emit("save", localEditedSite.value, localSiteFields.value);
};
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="900px"
        persistent
    >
        <v-card class="dialog-card">
            <v-card-title class="py-4 text-white headline bg-primary d-flex justify-space-between align-center">
                <v-icon class="mr-2" color="white">mdi-pencil</v-icon>
                編輯站點
                <v-spacer></v-spacer>
                <v-btn icon variant="plain" color="white" @click="closeDialog">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pt-4">
                <v-container>
                    <v-row>
                        <!-- 基本欄位 -->
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="localEditedSite.id"
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
                                v-model="localEditedSite.url"
                                label="URL"
                                required
                                outlined
                                dense
                                hint="輸入站點的網址 (url)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="localEditedSite.site_name"
                                label="站點名稱"
                                required
                                outlined
                                dense
                                hint="輸入站點名稱 (site_name)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="localEditedSite.site_id"
                                label="站點 ID"
                                required
                                outlined
                                dense
                                hint="輸入站點 ID (site_id)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="localEditedSite.template_id"
                                label="模板 ID"
                                outlined
                                dense
                                hint="輸入模板 ID (template_id)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="localEditedSite.template_name"
                                label="模板名稱"
                                outlined
                                dense
                                hint="輸入模板名稱 (template_name)"
                                persistent-hint
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="localEditedSite.crawler_mode"
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
                                v-model="localEditedSite.active"
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

                        <!-- 動態顯示特殊欄位 -->
                        <template v-if="'download_attachment' in localEditedSite">
                            <v-col cols="12" md="6">
                                <v-select
                                    v-model="localEditedSite.download_attachment"
                                    :items="downloadAttachmentOptions"
                                    item-title="text"
                                    item-value="value"
                                    label="下載附件"
                                    inset
                                    hint="設定是否下載附件 (download_attachment)"
                                    persistent-hint
                                ></v-select>
                            </v-col>
                        </template>

                        <!-- 爬蟲類別欄位 -->
                        <template v-if="'crawler_class' in localEditedSite">
                            <v-col cols="12">
                                <v-divider class="mb-4"></v-divider>
                                <h3 class="mb-3 text-subtitle-1 font-weight-bold">爬蟲類別設定</h3>
                                <v-text-field
                                    v-model="localEditedSite.crawler_class"
                                    label="爬蟲類別"
                                    outlined
                                    dense
                                    hint="例如: src.crawler.LawNewsCrawler"
                                    persistent-hint
                                ></v-text-field>
                            </v-col>
                        </template>

                        <!-- 起始 URL 欄位 -->
                        <v-col cols="12">
                            <v-divider class="mb-4"></v-divider>
                            <div class="mb-3 d-flex align-center">
                                <h3 class="mr-2 text-subtitle-1 font-weight-bold">起始URL (start)</h3>
                                <v-btn
                                    icon
                                    size="small"
                                    color="primary"
                                    variant="text"
                                    @click="addStartUrl"
                                    class="ml-2"
                                >
                                    <v-icon>mdi-plus</v-icon>
                                </v-btn>
                            </div>

                            <div v-for="(url, index) in localEditedSite.start" :key="index" class="mb-3 d-flex">
                                <v-text-field
                                    v-model="localEditedSite.start[index]"
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
                                    :disabled="localEditedSite.start.length <= 1"
                                    class="mt-1"
                                >
                                    <v-icon>mdi-delete</v-icon>
                                </v-btn>
                            </div>
                        </v-col>
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
                                        dense
                                        hide-details
                                    ></v-select>
                                </v-col>
                                <v-col cols="12" sm="4" class="d-flex align-center">
                                    <v-btn color="primary" @click="addCustomField" :disabled="!customFieldKey" block>
                                        新增欄位
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-col>

                        <!-- 其他可能的特殊欄位 -->
                        <template v-for="(value, key) in localEditedSite" :key="key">
                            <template
                                v-if="
                                    ![
                                        'id',
                                        'url',
                                        'site_name',
                                        'site_id',
                                        'template_id',
                                        'template_name',
                                        'crawler_mode',
                                        'active',
                                        'start',
                                        'download_attachment',
                                        'crawler_class',
                                    ].includes(key)
                                "
                            >
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
                                            v-model="localEditedSite[key]"
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
                                            v-model.number="localEditedSite[key]"
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
                                            v-model="localEditedSite[key]"
                                            :label="key"
                                            outlined
                                            dense
                                            :hint="`輸入 ${key}`"
                                            persistent-hint
                                        ></v-text-field>
                                    </template>
                                </v-col>
                            </template>
                        </template>
                    </v-row>
                </v-container>
            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions class="px-6 py-3 action-sticky">
                <v-btn color="grey" @click="closeDialog"> 取消 </v-btn>
                <v-btn color="primary" @click="saveEdit"> 儲存 </v-btn>
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
