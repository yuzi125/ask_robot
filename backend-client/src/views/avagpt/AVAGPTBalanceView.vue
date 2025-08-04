<script setup>
import { ref, computed, inject, onMounted } from "vue";
import { useQuery } from "@tanstack/vue-query";
import BalanceList from "@/components/avagpt/balance/BalanceList.vue";

const axios = inject("axios");

// 統計資料
const stats = ref({
    totalUsers: 0,
    totalCredits: 0,
    autoRefillUsers: 0,
    lowBalanceUsers: 0,
});

// 獲取統計資料
const fetchStats = async () => {
    try {
        const { data } = await axios.get("/avaGPT/balance/users", {
            params: {
                page: 1,
                limit: 1000, // 獲取所有資料來計算統計
                searchQuery: "",
            },
        });

        if (data.code !== 200) {
            throw new Error(data.message);
        }

        const balances = data.data.balances || [];

        stats.value = {
            totalUsers: balances.length,
            totalCredits: balances.reduce((sum, balance) => sum + (balance.tokenCredits || 0), 0),
            autoRefillUsers: balances.filter((balance) => balance.autoRefillEnabled).length,
            lowBalanceUsers: balances.filter((balance) => (balance.tokenCredits || 0) < 1000).length,
        };

        return data.data;
    } catch (error) {
        console.error("獲取統計資料失敗:", error);
        return null;
    }
};

// 查詢統計資料
const { refetch: refetchStats } = useQuery({
    queryKey: ["balance-stats"],
    queryFn: fetchStats,
    refetchInterval: 30000, // 每30秒更新一次統計
});

// 方法
const refreshStats = () => {
    refetchStats();
};

const formatTokenCredits = (credits) => {
    if (credits >= 1000000) {
        return `${(credits / 1000000).toFixed(1)}M`;
    } else if (credits >= 1000) {
        return `${(credits / 1000).toFixed(1)}K`;
    }
    return credits.toString();
};

// 初始化
onMounted(() => {
    fetchStats();
});
</script>

<template>
    <v-container fluid class="pa-4">
        <v-row>
            <v-col cols="12">
                <!-- 頁面標題 -->
                <v-card class="mb-4 dashboard-card" elevation="1">
                    <v-card-title class="px-6 py-4 d-flex align-center">
                        <div>
                            <div class="d-flex align-center">
                                <v-icon icon="fa-solid fa-wallet" color="primary" class="me-2" size="small"></v-icon>
                                <span class="text-h6 font-weight-medium">餘額管理</span>
                            </div>
                            <div class="d-flex align-center">
                                <div class="mt-1 ga-1 d-flex align-center text-subtitle-2 text-grey-darken-1">
                                    管理使用者的 Token Credits 餘額與自動補充設定 •
                                    <div class="d-flex align-center text-body-2 text-medium-emphasis">
                                        <v-icon icon="mdi-pulse" size="small" class="mr-1" />
                                        每 30 秒自動更新
                                    </div>
                                </div>
                            </div>
                        </div>
                        <v-spacer></v-spacer>
                        <div class="d-flex align-center ga-2">
                            <v-chip color="info" variant="tonal" prepend-icon="mdi-information" size="small">
                                1000 credits = $0.001 USD
                            </v-chip>
                        </div>
                    </v-card-title>
                </v-card>

                <!-- Balance 列表 -->
                <BalanceList @refresh="refreshStats" />
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.dashboard-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05) !important;
    background-color: white;
    transition: transform 0.2s, box-shadow 0.2s;
}

.dashboard-card:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
}
</style>
