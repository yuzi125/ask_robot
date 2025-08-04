<script setup>
import { ref, inject, computed } from "vue";
import DOMPurify from "dompurify";
import { UseWindowSize } from "@vueuse/components";
import { useQuery, useMutation } from "@tanstack/vue-query";
import { marked } from "marked";
import SystemHeader from "@/components/system/SystemHeader.vue";

const axios = inject("axios");
const emitter = inject("emitter");
const dialog = ref(false);
const editingAnnouncement = ref(null);

// 查詢公告列表
const {
    data: announcements,
    isLoading: announcementsLoading,
    isFetching: announcementsFetching,
    error,
    refetch,
} = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
        const response = await axios.get("/system/announcements");
        return response.data.data;
    },
});

// 新增、更新公告的 mutation
const { mutate: updateAnnouncement, isPending: isUpdating } = useMutation({
    mutationFn: async (data) => {
        const url = data.id ? `/system/announcements/${data.id}` : "/system/announcements";
        const method = data.id ? "put" : "post";
        const response = await axios[method](url, data);
        return response.data;
    },

    onSuccess: () => {
        dialog.value = false;
        editingAnnouncement.value = null;
        refetch();
    },
});

// 刪除相關狀態
const deleteDialog = ref(false);
const deleteTarget = ref(null);

// 刪除的 mutation
const { mutate: deleteAnnouncement, isPending: isDeleting } = useMutation({
    mutationFn: async (id) => {
        const response = await axios.delete(`/system/announcements/${id}`);
        return response.data;
    },
    onSuccess: () => {
        deleteDialog.value = false;
        deleteTarget.value = null;
        // 重新取得列表
        refetch();
    },
});

// 確認刪除方法
const confirmDelete = (item) => {
    deleteTarget.value = item;
    deleteDialog.value = true;
};

// 執行刪除方法
const handleDelete = async () => {
    if (!deleteTarget.value) return;
    await deleteAnnouncement(deleteTarget.value.id);
};

// 表單數據
const formData = ref({
    title: "",
    content: "",
    type: "NOTICE",
    require_agreement: false,
    status: "DRAFT",
    use_markdown: false,
});

// 禁用說明相關
const showAlertTextDialog = ref(false);
const alertText = ref("");
const markedAlertText = computed(() => {
    if (!alertText.value) return "";
    const markedText = marked(alertText.value);
    let modifiedText = markedText.replace(/<a/g, '<a title="點擊前往" class="link-btn" target="_blank"');
    modifiedText = modifiedText.replace(
        /<\/a>/g,
        "<i class='ml-1 fa-solid fa-arrow-up-right-from-square' style='font-size: 0.75rem;margin-top:3.5px;'></i></a>"
    );
    return modifiedText;
});
const {
    data,
    isLoading: alertTextLoading,
    isFetching: alertTextFetching,
    refetch: refetchAlertText,
} = useQuery({
    queryKey: ["announcementAlertText"],
    queryFn: async () => {
        const response = await axios.get("/system/announcements/alertText/getAlertText");
        alertText.value = response.data.data;
        return response.data.data;
    },
    staleTime: Infinity,
});
const validateAlertText = (text) => {
    if (text && typeof text === "string" && text.trim() !== "") {
        if (text.length > 1000) {
            emitter.emit("openSnackbar", { message: "禁用說明不能超過500字。", color: "error" });
            return;
        }
        updateAlertText({ alert_text: text });
    } else {
        emitter.emit("openSnackbar", { message: "禁用說明不能為空。", color: "error" });
    }
};
const { mutate: updateAlertText, isPending: isUpdatingAlertText } = useMutation({
    mutationFn: async (data) => {
        const url = "/system/announcements/alertText/updateAlertText";
        const method = "put";
        const response = await axios[method](url, data);
        return response.data;
    },
    onSuccess: (response) => {
        if (response.code === 0) {
            emitter.emit("openSnackbar", { message: "更新禁用說明成功。", color: "success" });
            showAlertTextDialog.value = false;
            refetchAlertText();
        } else {
            emitter.emit("openSnackbar", { message: "更新禁用說明失敗。", color: "error" });
        }
    },
    onError: (error) => {
        emitter.emit("openSnackbar", { message: "更新禁用說明失敗。", color: "error" });
    },
});

// 操作方法
const handleAction = (action) => {
    if (action === "add") {
        editingAnnouncement.value = null;
        formData.value = {
            title: "",
            content: "",
            type: "NOTICE",
            require_agreement: false,
            status: "DRAFT",
            use_markdown: false,
        };
        dialog.value = true;
    } else if (action === "alertText") {
        showAlertTextDialog.value = true;
    }
};

const handleEdit = (announcement) => {
    editingAnnouncement.value = announcement;
    formData.value = { ...announcement };
    dialog.value = true;
};

const handleSubmit = () => {
    const data = {
        ...formData.value,
        id: editingAnnouncement.value?.id,
    };
    updateAnnouncement(data);
};

const headers = [
    { title: "公告標題", key: "title", width: "40%" },
    { title: "公告類型", key: "type", width: "15%" },
    { title: "發布狀態", key: "status", width: "15%" },
    { title: "發布時間", key: "publish_start", width: "20%" },
    { title: "操作", key: "actions", align: "center", width: "10%", sortable: false },
];

// 輔助函數
const getTypeColor = (type) => {
    return (
        {
            TERMS: "primary",
            MAINTENANCE: "warning",
            NOTICE: "info",
        }[type] || "grey"
    );
};

const getTypeText = (type) => {
    return (
        {
            TERMS: "使用說明",
            MAINTENANCE: "維護公告",
            NOTICE: "公告訊息",
        }[type] || "未知類型"
    );
};

const getStatusColor = (status) => {
    return (
        {
            PUBLISHED: "success",
            DRAFT: "grey",
            ARCHIVED: "error",
        }[status] || "grey"
    );
};

const getStatusText = (status) => {
    return (
        {
            PUBLISHED: "已發布",
            DRAFT: "草稿",
            ARCHIVED: "已封存",
        }[status] || "未知狀態"
    );
};

const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

// Markdown 預覽計算屬性
const markedTitle = computed(() => {
    if (!formData.value.use_markdown || !formData.value.title) return "";
    return DOMPurify.sanitize(marked(formData.value.title));
});

const markedContent = computed(() => {
    if (!formData.value.use_markdown || !formData.value.content) return "";
    return DOMPurify.sanitize(marked(formData.value.content));
});
</script>

<template>
    <div class="announcement-view">
        <div v-if="announcementsLoading" class="">
            <v-skeleton-loader class="mx-auto" elevation="2" type="paragraph, paragraph" />
        </div>

        <UseWindowSize v-slot="{ width }" v-else>
            <div class="d-flex flex-column">
                <SystemHeader
                    title="使用說明與公告訊息管理"
                    subtitle="管理系統中的使用說明與公告訊息，包括發布、編輯和封存。"
                    icon="mdi-bullhorn"
                    :actions="[
                        {
                            id: 'alertText',
                            text: '設定禁用說明',
                            icon: 'mdi-alert-circle',
                            color: 'warning',
                            loading: isUpdatingAlertText || alertTextLoading || alertTextFetching,
                        },
                        {
                            id: 'add',
                            text: '新增公告',
                            icon: 'mdi-plus-circle',
                            color: 'success',
                            loading: announcementsLoading || announcementsFetching,
                        },
                    ]"
                    @action="handleAction"
                />

                <!-- 公告列表 -->
                <v-card class="mb-6">
                    <v-data-table
                        :headers="headers"
                        class="elevation-1 list-table"
                        :items="announcements || []"
                        :loading="announcementsLoading"
                        hover
                    >
                        <template v-slot:header="{ props: { headers } }">
                            <tr>
                                <th v-for="header in headers" :key="header.key">
                                    {{ header.title }}
                                </th>
                            </tr>
                        </template>

                        <template v-slot:item="{ item }">
                            <tr>
                                <td>{{ item.title }}</td>
                                <td>
                                    <v-chip :color="getTypeColor(item.type)" size="small" class="font-weight-medium">
                                        {{ getTypeText(item.type) }}
                                    </v-chip>
                                </td>
                                <td>
                                    <v-chip
                                        :color="getStatusColor(item.status)"
                                        size="small"
                                        class="font-weight-medium"
                                    >
                                        {{ getStatusText(item.status) }}
                                    </v-chip>
                                </td>
                                <td>
                                    {{ formatDateTime(item.update_time) }}
                                </td>
                                <td>
                                    <div class="d-flex">
                                        <v-tooltip text="編輯" location="top">
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    icon
                                                    variant="text"
                                                    size="small"
                                                    color="primary"
                                                    v-bind="props"
                                                    @click="handleEdit(item)"
                                                    class="mr-2"
                                                >
                                                    <v-icon size="small">mdi-pencil</v-icon>
                                                </v-btn>
                                            </template>
                                        </v-tooltip>

                                        <v-tooltip text="刪除" location="top">
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    icon
                                                    variant="text"
                                                    size="small"
                                                    color="error"
                                                    v-bind="props"
                                                    @click="confirmDelete(item)"
                                                >
                                                    <v-icon size="small">mdi-delete</v-icon>
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </v-data-table>
                </v-card>
            </div>
        </UseWindowSize>

        <!-- 編輯禁用說明 -->
        <v-dialog v-model="showAlertTextDialog" width="600">
            <v-card>
                <v-card-title>編輯 - 禁用說明</v-card-title>
                <v-card-text>
                    <v-textarea
                        v-model="alertText"
                        label="禁用說明"
                        variant="outlined"
                        auto-grow
                        no-resize
                        rows="2"
                        max-rows="10"
                        hide-details
                    ></v-textarea>
                </v-card-text>
                <v-card-text>
                    <div class="preview">
                        <div class="title">預覽</div>
                        <div class="content">
                            <div class="mkd" v-dompurify-html="markedAlertText"></div>
                        </div>
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="grey darken-1" @click="showAlertTextDialog = false"> 關閉 </v-btn>
                    <v-btn color="primary" :loading="isUpdatingAlertText" @click="validateAlertText(alertText)">
                        儲存
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 編輯對話框 -->
        <v-dialog v-model="dialog" max-width="800px">
            <v-card>
                <!-- 標題區域 -->
                <v-card-title class="px-6 py-4 d-flex align-center bg-grey-lighten-4">
                    <v-icon size="24" class="mr-2" color="primary">
                        {{ editingAnnouncement ? "mdi-pencil" : "mdi-plus" }}
                    </v-icon>
                    <span class="text-h6">{{ editingAnnouncement ? "編輯公告" : "新增公告" }}</span>
                </v-card-title>

                <v-divider></v-divider>

                <!-- 表單內容 -->
                <div style="max-height: 70vh; overflow-y: auto">
                    <v-card-text class="pa-6">
                        <v-form @submit.prevent="handleSubmit">
                            <v-container class="pa-0">
                                <v-row>
                                    <v-col cols="12">
                                        <div class="mb-4 text-subtitle-1 font-weight-medium">發布設定</div>
                                        <v-row>
                                            <v-col cols="12" sm="6">
                                                <v-select
                                                    v-model="formData.type"
                                                    label="公告類型"
                                                    variant="outlined"
                                                    density="comfortable"
                                                    :items="[
                                                        {
                                                            title: '使用說明',
                                                            value: 'TERMS',
                                                            icon: 'mdi-file-document',
                                                        },
                                                        { title: '公告訊息', value: 'NOTICE', icon: 'mdi-bell' },
                                                    ]"
                                                    item-title="title"
                                                    item-value="value"
                                                    :disabled="editingAnnouncement"
                                                    required
                                                    hint="使用說明公告類型，發布後將無法修改。"
                                                    persistent-hint
                                                >
                                                    <template v-slot:selection="{ item }">
                                                        <v-icon :color="getTypeColor(item.raw.value)" class="mr-2">
                                                            {{ item.raw.icon }}
                                                        </v-icon>
                                                        {{ item.title }}
                                                    </template>
                                                    <template v-slot:item="{ item, props }">
                                                        <v-list-item v-bind="props">
                                                            <template v-slot:prepend>
                                                                <v-icon :color="getTypeColor(item.raw.value)">
                                                                    {{ item.raw.icon }}
                                                                </v-icon>
                                                            </template>
                                                            <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                                                        </v-list-item>
                                                    </template>
                                                </v-select>
                                            </v-col>

                                            <v-col cols="12" sm="6">
                                                <v-select
                                                    v-model="formData.status"
                                                    label="發布狀態"
                                                    variant="outlined"
                                                    density="comfortable"
                                                    :items="[
                                                        { title: '草稿', value: 'DRAFT', icon: 'mdi-file-outline' },
                                                        {
                                                            title: '已發布',
                                                            value: 'PUBLISHED',
                                                            icon: 'mdi-check-circle',
                                                        },
                                                        { title: '已封存', value: 'ARCHIVED', icon: 'mdi-archive' },
                                                    ]"
                                                    item-title="title"
                                                    item-value="value"
                                                    required
                                                >
                                                    <template v-slot:selection="{ item }">
                                                        <v-icon :color="getStatusColor(item.raw.value)" class="mr-2">
                                                            {{ item.raw.icon }}
                                                        </v-icon>
                                                        {{ item.title }}
                                                    </template>
                                                    <template v-slot:item="{ item, props }">
                                                        <v-list-item v-bind="props">
                                                            <template v-slot:prepend>
                                                                <v-icon :color="getStatusColor(item.raw.value)">
                                                                    {{ item.raw.icon }}
                                                                </v-icon>
                                                            </template>
                                                            <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                                                        </v-list-item>
                                                    </template>
                                                </v-select>
                                            </v-col>

                                            <!-- 移動 checkbox 到這裡 -->
                                            <v-col cols="12" class="pt-0" v-if="formData.type === 'TERMS'">
                                                <v-checkbox
                                                    v-model="formData.require_agreement"
                                                    color="primary"
                                                    :disabled="editingAnnouncement"
                                                >
                                                    <template v-slot:label>
                                                        <div
                                                            class="d-flex flex-column"
                                                            :class="{ 'checked-text': formData.require_agreement }"
                                                        >
                                                            <span class="text-body-2 font-weight-medium"
                                                                >需要使用者同意</span
                                                            >
                                                            <span class="text-caption text-grey">
                                                                使用者必須同意此條款才能繼續使用
                                                            </span>
                                                        </div>
                                                    </template>
                                                </v-checkbox>
                                            </v-col>
                                        </v-row>
                                    </v-col>
                                    <v-col cols="12">
                                        <div class="mb-4 d-flex justify-space-between align-center">
                                            <div class="text-subtitle-1 font-weight-medium">公告訊息</div>
                                            <v-checkbox
                                                v-model="formData.use_markdown"
                                                label="使用 Markdown"
                                                hide-details
                                                density="compact"
                                            />
                                        </div>

                                        <!-- 標題欄位 -->
                                        <v-text-field
                                            v-model="formData.title"
                                            label="標題"
                                            placeholder="請輸入公告標題"
                                            variant="outlined"
                                            density="comfortable"
                                            class="mb-4"
                                            required
                                        />
                                        <div
                                            v-if="formData.use_markdown && formData.title"
                                            class="mb-4 rounded pa-3 bg-grey-lighten-4"
                                        >
                                            <div class="mb-2 text-caption text-grey">預覽標題</div>
                                            <div v-dompurify-html="markedTitle" class="mkd"></div>
                                        </div>

                                        <!-- 內容區塊 -->
                                        <div class="content-editor">
                                            <v-textarea
                                                v-model="formData.content"
                                                label="內容"
                                                placeholder="請輸入公告內容"
                                                variant="outlined"
                                                rows="6"
                                                auto-grow
                                                class="mb-2"
                                                required
                                            />
                                            <div
                                                v-if="formData.use_markdown && formData.content"
                                                class="rounded content-preview pa-3 bg-grey-lighten-4"
                                            >
                                                <div class="mb-2 text-caption text-grey">預覽內容</div>
                                                <div v-dompurify-html="markedContent" class="mkd"></div>
                                            </div>
                                        </div>
                                    </v-col>
                                    <!-- 發布設置區 -->
                                </v-row>
                            </v-container>
                        </v-form>
                    </v-card-text>
                </div>

                <!-- 固定在底部的按鈕 -->
                <div class="dialog-footer">
                    <v-divider></v-divider>
                    <v-card-actions class="pa-4">
                        <v-spacer />
                        <v-btn color="grey darken-1" @click="dialog = false"> 關閉 </v-btn>
                        <v-btn color="primary" :loading="isUpdating" @click="handleSubmit">
                            {{ editingAnnouncement ? "保存修改" : "創建公告" }}
                        </v-btn>
                    </v-card-actions>
                </div>
            </v-card>
        </v-dialog>

        <v-dialog v-model="deleteDialog" max-width="500px">
            <v-card>
                <v-card-title class="text-h6"> 確認刪除 </v-card-title>
                <v-card-text class="pa-4">
                    <v-row>
                        <v-col cols="12">
                            <p class="text-body-1">
                                確定要刪除這則

                                <strong>{{ deleteTarget?.title }}</strong>
                                公告嗎？
                            </p>
                        </v-col>
                        <v-col cols="12">
                            <v-alert type="error" outlined dense> 此操作將會刪除此公告，無法恢復。 </v-alert>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="grey darken-1" text @click="deleteDialog = false"> 關閉 </v-btn>
                    <v-btn color="error" variant="text" :loading="isDeleting" @click="handleDelete"> 刪除 </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style lang="scss" scoped>
.announcement-view {
    padding: 2rem;
    width: 100%;
    height: 100%;

    .title-section {
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        padding-bottom: 1rem;
    }

    .actions-section {
        .v-btn {
            text-transform: none;
        }
    }
}

.list-table {
    table-layout: fixed;
    width: 100%;
}

.list-table td {
    padding: 12px 16px;
    vertical-align: middle;
}

.list-table tr th,
.list-table td {
    padding: 0 8px;
    vertical-align: middle;
}

/* 表頭內容置中 */
.header-content {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
}

.list-table:deep(th) {
    vertical-align: middle;
}

.dialog-footer {
    position: sticky;
    bottom: 0;
    background: white;
    z-index: 1;
}

.checked-text {
    .text-body-2 {
        font-weight: bold !important;
        color: #000 !important;
    }
    .text-caption {
        color: #000 !important;
    }
}

.preview {
    .title {
        font-weight: bold;
        color: #000;
        margin-bottom: 0.5rem;
    }
    .content {
        background-color: #f0f0f0;
        padding: 1rem;
        border-radius: 0.5rem;
        min-height: 50px;
    }
    .content * {
        color: red;
    }
}
:deep(.link-btn) {
    border: 1px solid rgba(0, 0, 0, 0.1);
    text-decoration: underline;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    margin: 0 2px;
}
</style>
