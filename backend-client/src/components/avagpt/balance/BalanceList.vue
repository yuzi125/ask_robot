<script setup>
import { ref, computed, watch, inject } from "vue";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/vue-query";
import { format, formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useDebounceFn, useWindowSize } from "@vueuse/core";
import BalanceEditDialog from "./BalanceEditDialog.vue";
import BalanceBatchEditDialog from "./BalanceBatchEditDialog.vue";
import BalanceBatchAllEditDialog from "./BalanceBatchAllEditDialog.vue";

const axios = inject("axios");

const emit = defineEmits(["refresh"]);

// 響應式資料
const searchQuery = ref("");
const debouncedSearchQuery = ref("");
const selectedUsers = ref([]);
const editDialog = ref(false);
const batchEditDialog = ref(false);
const batchAllEditDialog = ref(false);
const selectedBalance = ref(null);
const refillLoading = ref({});
const currentPage = ref(1);
const itemsPerPage = ref(10);
const { width: windowWidth } = useWindowSize();

// 全選狀態
const selectAll = computed({
    get: () => selectedUsers.value.length === balances.value.length && balances.value.length > 0,
    set: (value) => {
        if (value) {
            selectedUsers.value = balances.value.map((balance) => balance._id);
        } else {
            selectedUsers.value = [];
        }
    },
});

// 創建防抖後的搜尋變數
const debouncedSearch = useDebounceFn(() => {
    currentPage.value = 1;
    debouncedSearchQuery.value = searchQuery.value;
}, 500);

// 當搜尋關鍵字變更時
watch(searchQuery, () => {
    debouncedSearch();
});

// 查詢客戶端
const queryClient = useQueryClient();

// 獲取 Balance 列表
const {
    data: balanceData,
    refetch,
    isLoading,
    isRefetching,
    isPlaceholderData,
} = useQuery({
    queryKey: ["user-balances", currentPage, itemsPerPage, debouncedSearchQuery],
    queryFn: async () => {
        const { data } = await axios.get("/avaGPT/balance/users", {
            params: {
                page: currentPage.value,
                limit: itemsPerPage.value,
                searchQuery: debouncedSearchQuery.value,
            },
        });

        if (data.code !== 200) {
            throw new Error(data.message);
        }

        return data.data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
});

// 計算屬性
const balances = computed(() => balanceData.value?.balances || []);
const total = computed(() => balanceData.value?.total || 0);
const totalPages = computed(() => balanceData.value?.totalPages || 1);

// 觸發 refill mutation
const refillMutation = useMutation({
    mutationFn: async (userId) => {
        const { data } = await axios.post("/avaGPT/balance/refill", { userId });
        if (data.code !== 200) {
            throw new Error(data.message);
        }
        return data;
    },
    onSuccess: () => {
        refetch();
        emit("refresh");
    },
});

// 方法
const handlePageChange = (newPage) => {
    currentPage.value = newPage;
};

const toggleSelectAll = () => {
    // selectAll 的 setter 會自動處理
};

const editBalance = (balance) => {
    selectedBalance.value = balance;
    editDialog.value = true;
};

const openBatchEditDialog = () => {
    batchEditDialog.value = true;
};

const openBatchAllEditDialog = () => {
    batchAllEditDialog.value = true;
};

const triggerRefill = async (balance) => {
    refillLoading.value[balance._id] = true;
    try {
        await refillMutation.mutateAsync(balance.userId);
    } finally {
        refillLoading.value[balance._id] = false;
    }
};

const handleBalanceSaved = () => {
    refetch();
    emit("refresh");
    selectedUsers.value = [];
};

const handleBatchSaved = () => {
    refetch();
    emit("refresh");
    selectedUsers.value = [];
};

const handleBatchAllSaved = () => {
    refetch();
    emit("refresh");
    selectedUsers.value = [];
};

// 格式化函數
const formatTokenCredits = (credits) => {
    if (credits >= 1000000) {
        return `${(credits / 1000000).toFixed(1)}M`;
    } else if (credits >= 1000) {
        return `${(credits / 1000).toFixed(1)}K`;
    }
    return credits.toString();
};

const getTokenCreditsColor = (credits) => {
    if (credits <= 0) return "error";
    if (credits < 1000) return "warning";
    if (credits < 10000) return "info";
    return "success";
};

const getUnitText = (unit) => {
    const unitMap = {
        seconds: "秒",
        minutes: "分鐘",
        hours: "小時",
        days: "天",
        weeks: "週",
        months: "月",
    };
    return unitMap[unit] || unit;
};

const formatDateTime = (dateString) => {
    return format(new Date(dateString), "yyyy/MM/dd HH:mm", { locale: zhTW });
};

const getRelativeTime = (dateString) => {
    return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhTW,
    });
};

const getNextRefillClass = (nextRefillTime) => {
    const now = new Date();
    const refillTime = new Date(nextRefillTime);

    if (refillTime <= now) {
        return "text-success"; // 已經可以觸發補充機制
    } else if (refillTime <= new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
        return "text-warning"; // 24小時內可以觸發補充機制
    }
    return "text-success";
};

// 監聽搜尋變化
watch(searchQuery, () => {
    currentPage.value = 1;
});
</script>

<template>
    <div class="balance-list">
        <v-card elevation="2" class="rounded-lg">
            <v-card-title class="px-4 py-3 d-flex align-center bg-surface-variant">
                <div class="d-flex align-center text-truncate">
                    <v-icon icon="fa-solid fa-wallet" class="flex-none me-2" size="small" />
                    <span class="text-truncate">餘額管理</span>
                </div>
            </v-card-title>

            <v-card-text>
                <!-- 搜尋和操作工具列 -->
                <v-row align="center" class="my-2">
                    <v-col cols="12" md="6">
                        <v-text-field
                            v-model="searchQuery"
                            density="compact"
                            variant="solo-filled"
                            label="搜尋使用者名稱、信箱或帳號"
                            prepend-inner-icon="mdi-magnify"
                            clearable
                            hide-details
                        ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="6" class="justify-end d-flex ga-2">
                        <v-btn
                            color="primary"
                            variant="outlined"
                            prepend-icon="mdi-account-multiple-plus"
                            :disabled="selectedUsers.length === 0"
                            @click="openBatchEditDialog"
                        >
                            批次設定 ({{ selectedUsers.length }})
                        </v-btn>
                        <v-btn
                            color="warning"
                            variant="outlined"
                            prepend-icon="mdi-account-group"
                            @click="openBatchAllEditDialog"
                        >
                            全部設定
                        </v-btn>
                        <v-btn
                            color="success"
                            variant="outlined"
                            prepend-icon="mdi-refresh"
                            @click="refetch"
                            :loading="isRefetching"
                        >
                            重新整理
                        </v-btn>
                    </v-col>
                </v-row>

                <div class="position-relative">
                    <!-- Loading overlay -->
                    <div v-if="isLoading || isPlaceholderData" class="table-overlay">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    </div>

                    <div v-if="balances.length > 0" class="data-container">
                        <v-table class="balance-table list-table">
                            <thead>
                                <tr>
                                    <th class="text-left" style="width: 50px">
                                        <v-checkbox
                                            v-model="selectAll"
                                            @update:model-value="toggleSelectAll"
                                            hide-details
                                            density="compact"
                                        />
                                    </th>
                                    <th class="text-left">使用者</th>
                                    <th class="text-center">Token Credits</th>
                                    <th class="text-center">自動補充</th>
                                    <th class="text-left">補充設定</th>
                                    <th class="text-center">上次補充</th>
                                    <th class="text-center">下次補充</th>
                                    <th class="text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="balance in balances" :key="balance._id" class="balance-row">
                                    <td>
                                        <v-checkbox
                                            v-model="selectedUsers"
                                            :value="balance._id"
                                            hide-details
                                            density="compact"
                                        />
                                    </td>
                                    <td class="text-left">
                                        <div class="d-flex align-center">
                                            <v-avatar size="32" color="primary" class="me-3">
                                                <span class="text-white text-caption">
                                                    {{ balance.userName.charAt(0).toUpperCase() }}
                                                </span>
                                            </v-avatar>
                                            <div>
                                                <div class="font-weight-medium">{{ balance.userName }}</div>
                                                <div class="text-caption text-grey-darken-1">
                                                    {{ balance.userEmail }}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <v-chip
                                            :color="getTokenCreditsColor(balance.tokenCredits)"
                                            variant="tonal"
                                            size="small"
                                        >
                                            {{ formatTokenCredits(balance.tokenCredits) }}
                                        </v-chip>
                                        <v-tooltip activator="parent" location="top">{{
                                            balance.tokenCredits
                                        }}</v-tooltip>
                                    </td>
                                    <td class="text-center">
                                        <v-chip
                                            :color="balance.autoRefillEnabled ? 'success' : 'grey'"
                                            variant="tonal"
                                            size="small"
                                        >
                                            <v-icon start>
                                                {{
                                                    balance.autoRefillEnabled ? "mdi-check-circle" : "mdi-close-circle"
                                                }}
                                            </v-icon>
                                            {{ balance.autoRefillEnabled ? "已啟用" : "已停用" }}
                                        </v-chip>
                                    </td>
                                    <td class="text-left">
                                        <div v-if="balance.autoRefillEnabled">
                                            <div class="text-body-2">
                                                每 {{ balance.refillIntervalValue }}
                                                {{ getUnitText(balance.refillIntervalUnit) }}
                                            </div>
                                            <div class="text-caption text-grey-darken-1">
                                                補充 {{ formatTokenCredits(balance.refillAmount) }}
                                            </div>
                                        </div>
                                        <div v-else class="text-grey-darken-1">未設定</div>
                                    </td>
                                    <td class="text-center">
                                        <div v-if="balance.lastRefill">
                                            <div class="text-body-2">{{ formatDateTime(balance.lastRefill) }}</div>
                                            <div class="text-caption text-grey-darken-1">
                                                {{ getRelativeTime(balance.lastRefill) }}
                                            </div>
                                        </div>
                                        <div v-else class="text-grey-darken-1">從未補充</div>
                                    </td>
                                    <td class="text-center">
                                        <div v-if="balance.nextRefillTime && balance.autoRefillEnabled">
                                            <div class="text-body-2">{{ formatDateTime(balance.nextRefillTime) }}</div>
                                            <div
                                                class="text-caption"
                                                :class="getNextRefillClass(balance.nextRefillTime)"
                                            >
                                                {{ getRelativeTime(balance.nextRefillTime) }}
                                            </div>
                                        </div>
                                        <div v-else class="text-grey-darken-1">無排程</div>
                                    </td>
                                    <td class="text-center">
                                        <div class="justify-center d-flex ga-1">
                                            <v-tooltip text="編輯餘額" location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-btn
                                                        v-bind="props"
                                                        icon="mdi-pencil"
                                                        size="small"
                                                        variant="text"
                                                        color="primary"
                                                        @click="editBalance(balance)"
                                                    />
                                                </template>
                                            </v-tooltip>
                                            <v-tooltip text="重新補充餘額" location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-btn
                                                        v-if="balance.autoRefillEnabled"
                                                        icon="mdi-cash-plus"
                                                        size="small"
                                                        v-bind="props"
                                                        variant="text"
                                                        color="success"
                                                        @click="triggerRefill(balance)"
                                                        :loading="refillLoading[balance._id]"
                                                    />
                                                </template>
                                            </v-tooltip>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </div>

                    <div v-else class="justify-center d-flex align-center pa-8">
                        <v-alert
                            type="info"
                            variant="tonal"
                            border="start"
                            class="ma-2"
                            text="目前沒有任何 Balance 記錄"
                        ></v-alert>
                    </div>

                    <div class="mt-4 pagination-wrapper">
                        <v-pagination
                            v-if="totalPages > 1"
                            v-model="currentPage"
                            :length="totalPages"
                            :total-visible="windowWidth > 1100 ? 7 : 5"
                            @update:model-value="handlePageChange"
                            density="compact"
                            rounded="circle"
                        ></v-pagination>
                    </div>
                </div>
            </v-card-text>
        </v-card>

        <!-- 編輯對話框 -->
        <BalanceEditDialog v-model="editDialog" :balance="selectedBalance" @saved="handleBalanceSaved" />

        <!-- 批次編輯對話框 -->
        <BalanceBatchEditDialog
            v-model="batchEditDialog"
            :selected-users="selectedUsers"
            :balances="balances"
            @saved="handleBatchSaved"
        />

        <!-- 全部設定對話框 -->
        <BalanceBatchAllEditDialog v-model="batchAllEditDialog" @saved="handleBatchAllSaved" />
    </div>
</template>

<style scoped>
.flex-none {
    flex: none;
}

.position-relative {
    position: relative;
}

.table-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.data-container {
    overflow-x: auto;
}

.balance-table {
    width: 100%;
    border-collapse: collapse;
}

.balance-table th {
    font-weight: 600;
    white-space: nowrap;
}

.balance-table td {
    vertical-align: middle;
    padding: 10px 16px;
}

.balance-row {
    transition: background-color 0.2s;
}

.balance-row:hover {
    background-color: rgba(var(--v-theme-primary), 0.05);
}

.pagination-wrapper {
    display: flex;
    justify-content: center;
    padding: 8px 0;
}

.list-table {
    table-layout: fixed;
    width: 100%;
}

.list-table td {
    padding: 12px 16px;
    vertical-align: middle;
}

.list-table .text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.list-table tr:hover {
    background-color: #f5f5f5;
}

.list-table th,
.list-table td {
    padding: 0 8px;
    vertical-align: middle;
}

@media (max-width: 600px) {
    .balance-table th,
    .balance-table td {
        padding: 8px;
    }
}
</style>
