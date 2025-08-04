<script setup>
import { ref } from "vue";
import dayjs from "dayjs";
import DOMPurify from "dompurify";
import { marked } from "marked";

const props = defineProps({
    items: {
        type: Array,
        required: true,
    },
    visibleColumns: {
        type: Array,
        required: true,
    },
    columnLabels: {
        type: Object,
        required: true,
    },
});

const truncate = (text, maxLength) => {
    if (!text) return "";

    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

const announcementTypes = [
    { title: "公告訊息", value: "NOTICE", color: "primary", icon: "mdi-bell", iconColor: "info" },
    { title: "使用說明", value: "TERMS", color: "secondary", icon: "mdi-file-document", iconColor: "primary" },
];

const actionTypes = [
    { title: "已讀", value: "READ" },
    { title: "同意", value: "AGREED" },
];

const statusTypes = [
    { title: "草稿", value: "DRAFT", icon: "mdi-file-outline", iconColor: "grey" },
    { title: "已發布", value: "PUBLISHED", icon: "mdi-check-circle", iconColor: "success" },
    { title: "已封存", value: "ARCHIVED", icon: "mdi-archive", iconColor: "error" },
];

const dialog = ref(false);
const selectedAnnouncement = ref({
    type: {
        title: "",
        color: "",
        icon: "",
    },
    status: {
        title: "",
        color: "",
        icon: "",
    },
    requireAgreement: false,
    useMarkdown: false,
    title: "",
    content: "",
});
const openDialog = (item) => {
    selectedAnnouncement.value = {
        type: announcementTypes.find((e) => e.value === item.announcementType),
        status: statusTypes.find((e) => e.value === item.announcementStatus),
        requireAgreement: item.requireAgreement,
        useMarkdown: item.useMarkdown,
        title: item.announcementTitle,
        titlePreview: DOMPurify.sanitize(marked(item.announcementTitle)),
        content: item.announcementContent,
        contentPreview: DOMPurify.sanitize(marked(item.announcementContent)),
    };
    dialog.value = true;
};
</script>

<template>
    <div class="table-wrapper">
        <v-table class="table">
            <thead class="sticky-header">
                <tr>
                    <th v-for="column in visibleColumns" :key="column">
                        {{ columnLabels[column] }}
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="item in items" :key="item.id">
                    <!-- 使用者名稱 -->
                    <td v-if="visibleColumns.includes('userName')">
                        <div class="">
                            <span>{{ item.userName }}</span>
                        </div>
                    </td>

                    <!-- 公告標題 -->
                    <td v-if="visibleColumns.includes('announcementTitle')">
                        <div>
                            <span class="announcement-title" v-bind="props" @click="openDialog(item)">{{
                                truncate(item.announcementTitle, 10)
                            }}</span>
                        </div>
                    </td>

                    <!-- 公告種類 -->
                    <td v-if="visibleColumns.includes('announcementType')">
                        <div>
                            <v-chip
                                size="small"
                                variant="tonal"
                                :color="announcementTypes.find((e) => e.value === item.announcementType)?.color"
                            >
                                <span>{{
                                    announcementTypes.find((e) => e.value === item.announcementType)?.title
                                }}</span>
                            </v-chip>
                        </div>
                    </td>

                    <!-- 動作 -->
                    <td v-if="visibleColumns.includes('action')">
                        <div>
                            <span>{{ actionTypes.find((e) => e.value === item.action)?.title }}</span>
                        </div>
                    </td>

                    <!-- IP 位址 -->
                    <td v-if="visibleColumns.includes('ipAddress')">
                        <div>
                            <span>{{ item.ipAddress }}</span>
                        </div>
                    </td>

                    <!-- 使用者代理 -->
                    <td v-if="visibleColumns.includes('userAgent')">
                        <div>
                            <v-tooltip activator="parent" location="top" :text="item.userAgent">
                                <template v-slot:activator="{ props }">
                                    <<span>{{ truncate(item.userAgent, 10) }}</span>
                                </template>
                            </v-tooltip>
                        </div>
                    </td>

                    <!-- 建立時間 -->
                    <td v-if="visibleColumns.includes('createTime')">
                        <div>
                            <span>{{ dayjs(item.createTime).format("YYYY-MM-DD HH:mm:ss") }}</span>
                        </div>
                    </td>
                </tr>
            </tbody>
        </v-table>
        <v-dialog v-model="dialog" max-width="800">
            <v-card>
                <!-- 標題 -->
                <v-card-title class="px-6 py-4 d-flex align-center bg-grey-lighten-4">
                    <v-icon size="24" class="mr-2" color="primary"> mdi-eye </v-icon>
                    <span class="text-h6">公告詳細資訊</span>
                </v-card-title>

                <v-divider></v-divider>

                <!-- 內容 -->
                <div style="max-height: 70vh; overflow-y: auto">
                    <v-card-text class="pa-6">
                        <v-row>
                            <v-col cols="12">
                                <div class="mb-4 text-subtitle-1 font-weight-medium">發布設定</div>
                                <v-row>
                                    <v-col cols="12" sm="6">
                                        <v-text-field
                                            label="公告類型"
                                            variant="outlined"
                                            v-model="selectedAnnouncement.type.title"
                                            readonly
                                        >
                                            <template v-slot:prepend-inner>
                                                <v-icon
                                                    :color="selectedAnnouncement.type.iconColor"
                                                    :icon="selectedAnnouncement.type.icon"
                                                ></v-icon>
                                            </template>
                                        </v-text-field>
                                    </v-col>

                                    <v-col cols="12" sm="6">
                                        <v-text-field
                                            label="發布狀態"
                                            variant="outlined"
                                            v-model="selectedAnnouncement.status.title"
                                            readonly
                                        >
                                            <template v-slot:prepend-inner>
                                                <v-icon
                                                    :color="selectedAnnouncement.status.iconColor"
                                                    :icon="selectedAnnouncement.status.icon"
                                                ></v-icon>
                                            </template>
                                        </v-text-field>
                                    </v-col>

                                    <!-- 需要使用者同意 -->
                                    <v-col cols="12" class="pt-0" v-if="selectedAnnouncement.typeName === '使用說明'">
                                        <v-checkbox
                                            v-model="selectedAnnouncement.requireAgreement"
                                            color="primary"
                                            hide-details
                                            readonly
                                        >
                                            <template v-slot:label>
                                                <div class="d-flex flex-column">
                                                    <span class="text-body-2 font-weight-medium">需要使用者同意</span>
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
                                        v-model="selectedAnnouncement.useMarkdown"
                                        label="使用 Markdown"
                                        hide-details
                                        readonly
                                        density="compact"
                                    />
                                </div>

                                <!-- 標題欄位 -->
                                <v-text-field
                                    v-model="selectedAnnouncement.title"
                                    label="標題"
                                    variant="outlined"
                                    density="comfortable"
                                    class="mb-4"
                                    readonly
                                />
                                <div
                                    v-if="selectedAnnouncement.useMarkdown"
                                    class="mb-4 rounded pa-3 bg-grey-lighten-4"
                                >
                                    <div class="mb-2 text-caption text-grey">預覽標題</div>
                                    <div v-dompurify-html="selectedAnnouncement.titlePreview" class="mkd"></div>
                                </div>

                                <!-- 內容區塊 -->
                                <div class="content-editor">
                                    <v-textarea
                                        label="內容"
                                        v-model="selectedAnnouncement.content"
                                        variant="outlined"
                                        rows="6"
                                        auto-grow
                                        class="mb-2"
                                        readonly
                                    />
                                    <div
                                        v-if="selectedAnnouncement.useMarkdown"
                                        class="rounded content-preview pa-3 bg-grey-lighten-4"
                                    >
                                        <div class="mb-2 text-caption text-grey">預覽內容</div>
                                        <div v-dompurify-html="selectedAnnouncement.contentPreview" class="mkd"></div>
                                    </div>
                                </div>
                            </v-col>
                        </v-row>
                    </v-card-text>
                </div>

                <!-- 固定在底部的按鈕 -->
                <div class="dialog-footer">
                    <v-divider></v-divider>
                    <v-card-actions class="pa-4">
                        <v-btn class="ml-auto" text="關閉" @click="dialog = false"></v-btn>
                    </v-card-actions>
                </div>
            </v-card>
        </v-dialog>
    </div>
</template>

<style lang="scss" scoped>
.text-truncate {
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

:deep(.v-table) {
    thead {
        th {
            white-space: nowrap;
            padding: 0 16px !important;
            vertical-align: middle;
            background-color: white !important;
        }
    }

    tr {
        td {
            padding: 8px 16px !important;
            height: 52px !important;
            vertical-align: middle;
        }

        &:hover {
            background-color: rgba(var(--v-theme-primary), 0.05);
        }
    }
}

:deep(.v-chip) {
    z-index: 1;
}

.announcement-title {
    cursor: pointer;
    &:hover {
        text-decoration: underline;
    }
}

.table-wrapper {
    height: 100%;
}

.table {
    height: 100%;
}

.sticky-header {
    position: sticky;
    top: 0;
    z-index: 2;
}
</style>
