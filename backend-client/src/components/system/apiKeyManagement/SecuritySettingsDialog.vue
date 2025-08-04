<script setup>
import { ref, computed, watch } from "vue";
import { apiKeyUtils } from "@/utils/apiKeyUtils";

const props = defineProps({
    modelValue: Boolean,
    user: {
        type: Object,
        default: () => ({}),
    },
    loading: Boolean,
});

const emit = defineEmits([
    "update:modelValue",
    "add-domain",
    "toggle-domain",
    "delete-domain",
    "add-path",
    "toggle-path",
    "delete-path",
]);

// 工具函數
const { formatDate, getStatusColor, getStatusText } = apiKeyUtils();

// 對話框控制
const dialog = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value),
});

// 本地狀態
const domainInput = ref("");
const errorMessage = ref("");
const adding = ref(false);
const localDomains = ref([]);

const activeTab = ref("domains");
const pathInput = ref("");
const pathError = ref("");
const addingPath = ref(false);
const localPaths = ref([]);

// 路徑驗證規則
const pathRules = [(v) => !!v || "請輸入路徑", (v) => v === "*" || /^\/[a-zA-Z0-9\/-]*$/.test(v) || "請輸入有效的路徑"];

// 驗證規則
const domainRules = [
    (v) => !!v || "請輸入網域",
    (v) => {
        // 如果是 '*'，直接通過驗證
        if (v === "*") return true;
        // 否則套用原本的網域驗證規則
        return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(v) || "請輸入有效的網域";
    },
];

// 計算屬性
const isValidDomain = computed(() => {
    return domainInput.value && domainRules.every((rule) => rule(domainInput.value) === true);
});

const isValidPath = computed(() => {
    return pathInput.value && pathRules.every((rule) => rule(pathInput.value) === true);
});

// 方法
const handleAddDomain = async () => {
    if (!isValidDomain.value) return;

    adding.value = true;
    errorMessage.value = "";

    try {
        await emit("add-domain", {
            keyId: props.user.api_key_id,
            userId: props.user.User.user_id,
            domain: domainInput.value,
        });
        domainInput.value = "";

        emit("refresh");
    } catch (error) {
        errorMessage.value = error.message || "新增網域失敗";
    } finally {
        adding.value = false;
    }
};

const toggleDomain = async (domain) => {
    domain.updating = true;
    try {
        await emit("toggle-domain", {
            domainId: domain.domain_id,
            status: domain.status,
        });
    } finally {
        domain.updating = false;
    }
};

const deleteDomain = async (domain) => {
    domain.deleting = true;
    try {
        await emit("delete-domain", {
            domainId: domain.domain_id,
        });
    } finally {
        domain.deleting = false;
    }
};

const handleAddPath = async () => {
    if (!isValidPath.value) return;

    addingPath.value = true;
    pathError.value = "";

    try {
        await emit("add-path", {
            keyId: props.user.api_key_id,
            path: pathInput.value,
        });
        pathInput.value = "";
    } catch (error) {
        pathError.value = error.message || "新增路徑失敗";
    } finally {
        addingPath.value = false;
    }
};

const togglePath = async (path) => {
    path.updating = true;

    try {
        await emit("toggle-path", {
            pathId: path.scope_id,
            status: path.status,
        });
    } finally {
        path.updating = false;
    }
};

const deletePath = async (path) => {
    path.deleting = true;
    try {
        await emit("delete-path", {
            pathId: path.scope_id,
        });
    } finally {
        path.deleting = false;
    }
};

const closeDialog = () => {
    dialog.value = false;
    resetForm();
};

const resetForm = () => {
    domainInput.value = "";
    pathInput.value = "";
    errorMessage.value = "";
    pathError.value = "";
    localDomains.value = [];
    localPaths.value = [];
    activeTab.value = "domains"; // 重置到預設分頁
};
// 監聽器
watch(
    () => props.user,
    (newUser) => {
        if (newUser?.ApiKeyDomains) {
            localDomains.value = JSON.parse(JSON.stringify(newUser.ApiKeyDomains));
        }

        if (newUser?.ApiKeyScopes) {
            localPaths.value = JSON.parse(JSON.stringify(newUser.ApiKeyScopes));
        }
    },
    { immediate: true, deep: true }
);

watch(
    () => dialog.value,
    (newVal) => {
        if (!newVal) {
            resetForm();
        }
    }
);
</script>

<template>
    <v-dialog v-model="dialog" max-width="700">
        <v-card>
            <v-card-title>
                <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center">
                        {{ user?.User?.name }}
                        <v-chip :color="getStatusColor(user?.status)" size="small" class="ml-2">
                            {{ getStatusText(user?.status) }}
                        </v-chip>
                    </div>
                </div>
            </v-card-title>

            <v-tabs v-model="activeTab" class="px-4">
                <v-tab value="domains">網域設定</v-tab>
                <v-tab value="paths">路徑設定</v-tab>
            </v-tabs>

            <v-card-text>
                <v-window v-model="activeTab">
                    <!-- 網域管理頁 -->
                    <v-window-item value="domains">
                        <v-text-field
                            v-model="domainInput"
                            label="新增網域"
                            placeholder="例如：api.example.com"
                            :rules="domainRules"
                            hide-details="auto"
                            :error-messages="errorMessage"
                            class="mb-4"
                            @keyup.enter="handleAddDomain"
                            :disabled="!user?.status"
                            hint="請輸入完整的網域，例如：api.example.com，或輸入 * 代表所有網域。"
                        >
                            <template v-slot:append>
                                <v-btn
                                    color="primary"
                                    @click="handleAddDomain"
                                    :disabled="!isValidDomain || !user?.status"
                                    :loading="adding"
                                >
                                    新增
                                </v-btn>
                            </template>
                        </v-text-field>

                        <v-table>
                            <thead>
                                <tr>
                                    <th>網域</th>
                                    <th>新增時間</th>
                                    <th class="text-center">狀態</th>
                                    <th class="text-center" v-if="user?.status">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="domain in localDomains" :key="domain.id">
                                    <td>{{ domain.domain }}</td>
                                    <td>{{ formatDate(domain.create_time) }}</td>
                                    <td class="text-center">
                                        <v-chip :color="domain.status ? 'success' : 'error'" size="small">
                                            {{ domain.status ? "啟用" : "停用" }}
                                        </v-chip>
                                    </td>
                                    <td class="text-center" v-if="user?.status">
                                        <v-btn
                                            :icon="domain.status ? 'mdi-pause' : 'mdi-play'"
                                            variant="text"
                                            :color="domain.status ? 'warning' : 'success'"
                                            size="small"
                                            class="mr-2"
                                            @click="toggleDomain(domain)"
                                            :loading="domain.updating"
                                        ></v-btn>
                                        <v-btn
                                            icon="mdi-delete"
                                            variant="text"
                                            color="error"
                                            size="small"
                                            @click="deleteDomain(domain)"
                                            :loading="domain.deleting"
                                        ></v-btn>
                                    </td>
                                </tr>
                                <tr v-if="localDomains.length === 0">
                                    <td colspan="5" class="py-4 text-center text-grey">尚未設定任何網域</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>

                    <!-- 路徑設定頁 -->
                    <v-window-item value="paths">
                        <v-text-field
                            v-model="pathInput"
                            label="新增路徑"
                            placeholder="例如：/bot/avaTextGeneration"
                            :rules="pathRules"
                            hide-details="auto"
                            :error-messages="pathError"
                            class="mb-4"
                            @keyup.enter="handleAddPath"
                            :disabled="!user?.status"
                            hint="輸入 API 路徑，例如：/bot/avaTextGeneration，或輸入 * 代表所有路徑"
                        >
                            <template v-slot:append>
                                <v-btn
                                    color="primary"
                                    @click="handleAddPath"
                                    :disabled="!isValidPath || !user?.status"
                                    :loading="addingPath"
                                >
                                    新增
                                </v-btn>
                            </template>
                        </v-text-field>

                        <v-table>
                            <thead>
                                <tr>
                                    <th>路徑</th>
                                    <th>新增時間</th>
                                    <th class="text-center">狀態</th>
                                    <th class="text-center" v-if="user?.status">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="path in localPaths" :key="path.id">
                                    <td>{{ path.path }}</td>
                                    <td>{{ formatDate(path.create_time) }}</td>
                                    <td class="text-center">
                                        <v-chip :color="path.status ? 'success' : 'error'" size="small">
                                            {{ path.status ? "啟用" : "停用" }}
                                        </v-chip>
                                    </td>
                                    <td class="text-center" v-if="user?.status">
                                        <v-btn
                                            :icon="path.status ? 'mdi-pause' : 'mdi-play'"
                                            variant="text"
                                            :color="path.status ? 'warning' : 'success'"
                                            size="small"
                                            class="mr-2"
                                            @click="togglePath(path)"
                                            :loading="path.updating"
                                        ></v-btn>
                                        <v-btn
                                            icon="mdi-delete"
                                            variant="text"
                                            color="error"
                                            size="small"
                                            @click="deletePath(path)"
                                            :loading="path.deleting"
                                        ></v-btn>
                                    </td>
                                </tr>
                                <tr v-if="localPaths.length === 0">
                                    <td colspan="4" class="py-4 text-center text-grey">尚未設定任何路徑</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>
                </v-window>
            </v-card-text>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="grey darken-1" @click="closeDialog">關閉</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style lang="scss" scoped>
.mr-2 {
    margin-right: 8px;
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
