<script setup>
defineProps({
    stats: {
        type: Array,
        default: () => [],
    },
    isPlaceholderData: {
        type: Boolean,
        default: false,
    },
    sortBy: {
        type: String,
        default: "messages",
    },
});

// 格式化數字
const formatNumber = (num) => {
    if (num >= 1000000) {
        return Math.floor(num / 100000) / 10 + "M"; // 保留 1 位小數
    } else if (num >= 1000) {
        return Math.floor(num / 100) / 10 + "K"; // 保留 1 位小數
    }
    return num.toString();
};

// 格式化費用
const formatCost = (cost) => {
    if (cost >= 1) {
        return cost.toFixed(2);
    } else if (cost >= 0.01) {
        return cost.toFixed(4);
    } else if (cost > 0) {
        return cost.toFixed(6);
    }
    return "0.00";
};

// 獲取排名顏色
const getRankColor = (rank) => {
    switch (rank) {
        case 1:
            return "warning"; // 金色
        case 2:
            return "grey-darken-1"; // 銀色
        case 3:
            return "orange-darken-2"; // 銅色
        default:
            return "primary";
    }
};
</script>

<template>
    <v-card elevation="2" class="rounded-lg h-100">
        <v-card-title class="px-4 py-3 d-flex align-center bg-surface-variant">
            <v-icon :icon="sortBy === 'cost' ? 'mdi-currency-usd' : 'mdi-trophy'" color="warning" class="me-2" />
            <span class="text-h6 font-weight-medium"> Top 10 {{ sortBy === "cost" ? "高花費" : "活躍" }}使用者 </span>
            <v-spacer></v-spacer>
            <v-chip size="small" color="info" variant="flat"> {{ stats.length }} 位使用者 </v-chip>
        </v-card-title>

        <v-card-text class="pa-0">
            <div v-if="!stats || stats.length === 0" class="justify-center d-flex align-center pa-8">
                <div v-if="isPlaceholderData" class="justify-center d-flex align-center" style="height: 200px">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                </div>
                <v-alert
                    v-else
                    type="info"
                    variant="tonal"
                    border="start"
                    text="此時間範圍內無使用者對話記錄"
                ></v-alert>
            </div>

            <div v-else class="top-users-list" :class="{ 'loading-overlay': isPlaceholderData }">
                <v-list class="pa-0">
                    <v-list-item
                        v-for="(user, index) in stats"
                        :key="user.userId"
                        class="px-4 py-3 border-b"
                        :class="{ 'bg-warning-lighten-5': index < 3 }"
                    >
                        <template v-slot:prepend>
                            <v-avatar :color="getRankColor(user.rank)" size="32" class="me-3">
                                <span class="text-white font-weight-bold">{{ user.rank }}</span>
                            </v-avatar>
                        </template>

                        <v-list-item-title class="font-weight-medium">
                            {{ user.userName }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                            {{ user.userEmail }}
                        </v-list-item-subtitle>

                        <template v-slot:append>
                            <div class="stats-container">
                                <!-- 主要統計數據 -->
                                <div class="justify-end gap-3 d-flex align-center">
                                    <div class="mr-2 stat-item" v-if="sortBy === 'cost'">
                                        <div class="stat-value text-success">${{ formatCost(user.totalCostUSD) }}</div>
                                        <div class="stat-label">花費 (USD)</div>
                                    </div>
                                    <div class="stat-item" v-else>
                                        <div class="stat-value text-primary">
                                            {{ formatNumber(user.userMessages) }}
                                        </div>
                                        <div class="stat-label">訊息</div>
                                    </div>
                                    <v-divider vertical class="mr-2"></v-divider>
                                    <div class="stat-item" v-if="sortBy === 'cost'">
                                        <div class="stat-value text-primary">
                                            {{ formatNumber(user.userMessages) }}
                                        </div>
                                        <div class="stat-label">訊息</div>
                                    </div>
                                    <div class="stat-item" v-else>
                                        <div class="stat-value text-success">${{ formatCost(user.totalCostUSD) }}</div>
                                        <div class="stat-label">花費 (USD)</div>
                                    </div>
                                </div>
                                <!-- Token 數量 -->
                                <div class="token-info">
                                    <v-chip size="x-small" color="secondary" variant="flat">
                                        {{ formatNumber(user.totalTokens) }} tokens
                                    </v-chip>
                                </div>
                            </div>
                        </template>
                    </v-list-item>
                </v-list>

                <!-- Loading overlay when placeholder data is shown -->
                <div v-if="isPlaceholderData" class="loading-overlay-content">
                    <v-progress-circular indeterminate color="primary" size="24"></v-progress-circular>
                    <span class="ml-2 text-caption">載入中...</span>
                </div>
            </div>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.h-100 {
    height: 100%;
}

.border-b {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.border-b:last-child {
    border-bottom: none;
}

.bg-warning-lighten-5 {
    background-color: rgba(var(--v-theme-warning), 0.05) !important;
}

.top-users-list {
    max-height: 400px;
    overflow-y: auto;
}

.top-users-list::-webkit-scrollbar {
    width: 6px;
}

.top-users-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

.top-users-list::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
}

.top-users-list::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

/* 新增的統計數據樣式 */
.stats-container {
    text-align: right;
    min-width: 120px;
}

.stat-item {
    text-align: center;
    min-width: 50px;
}

.stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1.2;
}

.stat-label {
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.6);
    line-height: 1;
    margin-top: 2px;
}

.stat-divider {
    width: 1px;
    height: 24px;
    background-color: rgba(var(--v-theme-on-surface), 0.12);
}

.token-info {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
}

/* Loading overlay styles */
.loading-overlay {
    position: relative;
}

.loading-overlay-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    backdrop-filter: blur(1px);
}
</style>
