<script setup>
import { apiKeyUtils } from "@/utils/apiKeyUtils";
import { useShowTableColumns } from "@/composables";
import ColumnSettings from "@/components/common/ColumnSettings.vue";

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

const emit = defineEmits([
    "edit-domains",
    "regenerate-key",
    "enable-user",
    "disable-user",
    "delete-user",
    "edit-common-settings",
    "edit-security-settings",
]);

const truncate = (text, maxLength) => {
    if (!text) return "";

    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

const { maskApiKey, copyApiKey } = apiKeyUtils();

const formatCurrency = (total_price, type) => {
    return total_price > 0 ? (type === "tooltip" ? `${total_price} USD` : `${total_price.toFixed(8)}`) : 0;
};
</script>

<template>
    <div class="api-key-table">
        <v-table>
            <thead>
                <tr>
                    <th
                        v-for="column in visibleColumns"
                        :key="column"
                        :class="{ 'text-center': ['status', 'action'].includes(column) }"
                    >
                        {{ columnLabels[column] }}
                    </th>
                    <th class="text-center">操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="item in items" :key="item.id">
                    <!-- 使用者名稱 -->
                    <td v-if="visibleColumns.includes('username')">
                        <div class="d-flex flex-column">
                            <v-tooltip activator="parent" location="top" :text="item.User.name">
                                <template v-slot:activator="{ props }">
                                    <span v-bind="props">{{ truncate(item.User.name, 10) }}</span>
                                </template>
                            </v-tooltip>
                        </div>
                    </td>

                    <!-- API Key -->
                    <td v-if="visibleColumns.includes('apiKey')">
                        <div class="d-flex align-center">
                            <span class="text-truncate">{{ maskApiKey(item.key) }}</span>
                            <v-btn
                                icon="mdi-content-copy"
                                variant="text"
                                density="compact"
                                @click="copyApiKey(item.key)"
                            />
                        </div>
                    </td>

                    <!-- 說明 -->
                    <td v-if="visibleColumns.includes('description')">
                        <div class="d-flex align-center">
                            <v-tooltip activator="parent" location="top" :text="item.description">
                                <template v-slot:activator="{ props }">
                                    <span v-bind="props">{{ truncate(item.description, 10) }}</span>
                                </template>
                            </v-tooltip>
                        </div>
                    </td>

                    <!-- 已設定網域 -->
                    <td v-if="visibleColumns.includes('domains')">
                        <div class="d-flex align-center">
                            <span>{{ item.ApiKeyDomains?.length || 0 }} 個網域</span>
                            <v-chip v-if="item.ApiKeyDomains?.length === 0" color="warning" size="x-small" class="ml-2">
                                未設定
                            </v-chip>
                        </div>
                    </td>

                    <!-- 已設定路徑 -->
                    <td v-if="visibleColumns.includes('paths')">
                        <div class="d-flex align-center">
                            <span>{{ item.ApiKeyScopes?.length || 0 }} 個路徑</span>
                            <v-chip v-if="item.ApiKeyScopes?.length === 0" color="warning" size="x-small" class="ml-2">
                                未設定
                            </v-chip>
                        </div>
                    </td>

                    <!-- 使用次數 -->
                    <td v-if="visibleColumns.includes('usageCount')">
                        <div class="d-flex align-center">
                            <span>{{ item.usage_count || 0 }}</span>
                        </div>
                    </td>

                    <!-- 總花費 -->
                    <td v-if="visibleColumns.includes('totalPrice')">
                        <div class="d-flex align-center">
                            <v-tooltip
                                activator="parent"
                                location="top"
                                :text="formatCurrency(item.total_price, 'tooltip')"
                            >
                                <template v-slot:activator="{ props }">
                                    <span v-bind="props">{{ formatCurrency(item.total_price) }}</span>
                                </template>
                            </v-tooltip>
                        </div>
                    </td>

                    <!-- 狀態 -->
                    <td v-if="visibleColumns.includes('status')" class="text-center">
                        <v-chip :color="item.status ? 'success' : 'error'" size="small">
                            {{ item.status ? "啟用" : "停用" }}
                        </v-chip>
                    </td>

                    <!-- 操作按鈕 (始終顯示) -->
                    <td class="text-center">
                        <v-menu>
                            <template v-slot:activator="{ props }">
                                <v-btn icon="mdi-dots-vertical" variant="text" v-bind="props"></v-btn>
                            </template>
                            <v-list>
                                <v-list-item @click="$emit('edit-security-settings', item)">
                                    <template v-slot:prepend>
                                        <v-icon color="primary">mdi-shield-check</v-icon>
                                    </template>
                                    <v-list-item-title>安全性設定</v-list-item-title>
                                </v-list-item>

                                <v-list-item @click="$emit('edit-common-settings', item)">
                                    <template v-slot:prepend>
                                        <v-icon color="primary">mdi-cog</v-icon>
                                    </template>
                                    <v-list-item-title>一般設定</v-list-item-title>
                                </v-list-item>

                                <v-divider></v-divider>

                                <v-list-item v-if="item.status" @click="$emit('disable-user', item)">
                                    <template v-slot:prepend>
                                        <v-icon color="warning">mdi-pause</v-icon>
                                    </template>
                                    <v-list-item-title>停用使用者</v-list-item-title>
                                </v-list-item>

                                <v-list-item v-else @click="$emit('enable-user', item)">
                                    <template v-slot:prepend>
                                        <v-icon color="success">mdi-play</v-icon>
                                    </template>
                                    <v-list-item-title>啟用使用者</v-list-item-title>
                                </v-list-item>

                                <v-list-item @click="$emit('delete-user', item)">
                                    <template v-slot:prepend>
                                        <v-icon color="error">mdi-delete</v-icon>
                                    </template>
                                    <v-list-item-title>刪除使用者</v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </td>
                </tr>
            </tbody>
        </v-table>
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
            background-color: rgb(var(--v-theme-surface));

            padding: 0 16px !important;
            vertical-align: middle;
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
</style>
