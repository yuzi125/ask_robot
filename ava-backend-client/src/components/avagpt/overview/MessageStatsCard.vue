<script setup>
import { computed } from "vue";

// 接收父組件傳入的數據
const props = defineProps({
    statistics: {
        type: Array,
        default: () => [],
    },
    isPlaceholderData: {
        type: Boolean,
        default: false,
    },
});

// 計算卡片的CSS類
const getCardClass = (stat) => {
    const baseClass = "stat-card ";
    switch (stat.title) {
        case "總訊息數":
            return baseClass + "bg-blue-lighten-5";
        case "使用者訊息":
            return baseClass + "bg-amber-lighten-5";
        case "機器人訊息":
            return baseClass + "bg-green-lighten-5";
        case "活躍天數":
            return baseClass + "bg-purple-lighten-5";
        default:
            return baseClass;
    }
};

// 統計卡片資料
const summaryStats = computed(() => {
    let totalMessages = 0;
    let userMessages = 0;
    let botMessages = 0;
    let activeDays = 0;
    let averageMessagesPerDay = 0;
    let userPercentage = 0;
    let botPercentage = 0;

    // 峰值數據
    let peakDay = {
        date: "",
        totalCount: 0,
        userCount: 0,
        botCount: 0,
    };

    // 計算當前週期的資料
    if (props.statistics && Array.isArray(props.statistics)) {
        props.statistics.forEach((day) => {
            const dayCount = day.count || 0;
            const userCount = day.userMessageCount || 0;
            const botCount = day.botMessageCount || 0;

            totalMessages += dayCount;
            userMessages += userCount;
            botMessages += botCount;

            if (dayCount > 0) activeDays++;

            // 檢查是否是峰值日
            if (dayCount > peakDay.totalCount) {
                peakDay.date = day.date;
                peakDay.totalCount = dayCount;
                peakDay.userCount = userCount;
                peakDay.botCount = botCount;
            }
        });

        // 計算平均每日訊息數
        if (activeDays > 0) {
            averageMessagesPerDay = Math.round(totalMessages / activeDays);
        }

        // 計算百分比
        if (totalMessages > 0) {
            userPercentage = Math.round((userMessages / totalMessages) * 100);
            botPercentage = Math.round((botMessages / totalMessages) * 100);
        }
    }

    return [
        {
            title: "總訊息數",
            value: totalMessages,
            peak: {
                count: peakDay.totalCount,
                date: peakDay.date ? peakDay.date.substring(5) : "", // 只顯示月-日
            },
        },
        {
            title: "使用者訊息",
            value: userMessages,
            percentage: userPercentage,
            peak: {
                count: peakDay.userCount,
                date: peakDay.date ? peakDay.date.substring(5) : "",
            },
        },
        {
            title: "機器人訊息",
            value: botMessages,
            percentage: botPercentage,
            peak: {
                count: peakDay.botCount,
                date: peakDay.date ? peakDay.date.substring(5) : "",
            },
        },
        {
            title: "活躍天數",
            value: activeDays,
            averagePerDay: averageMessagesPerDay,
        },
    ];
});
</script>

<template>
    <div>
        <v-row v-if="statistics?.length">
            <v-col v-for="(stat, index) in summaryStats" :key="index" cols="12" sm="6" md="3">
                <v-card
                    :class="getCardClass(stat)"
                    variant="flat"
                    class="stat-card"
                    :loading="isPlaceholderData"
                    :disabled="isPlaceholderData"
                >
                    <v-card-item>
                        <div class="d-flex flex-column">
                            <div class="mb-1 text-subtitle-2 text-grey-darken-1 font-weight-regular">
                                {{ stat.title }}
                            </div>
                            <div class="text-h4 font-weight-bold">
                                {{ stat.value.toLocaleString() }}
                            </div>

                            <!-- 顯示峰值 -->
                            <div v-if="stat.peak !== undefined && stat.peak.count > 0" class="mt-1 d-flex align-center">
                                <v-icon size="small" color="primary" class="mr-1">mdi-chart-bell-curve</v-icon>
                                <span class="text-grey-darken-1 text-caption">
                                    峰值:
                                    <span class="font-weight-medium text-primary">{{ stat.peak.count }}</span>
                                    ({{ stat.peak.date }})
                                </span>
                            </div>

                            <!-- 顯示佔比 -->
                            <!-- <div v-if="stat.percentage !== undefined" class="mt-1 d-flex align-center">
                                <v-icon size="small" color="grey-darken-1" class="mr-1">mdi-percent</v-icon>
                                <span class="text-grey-darken-1 text-caption">佔總訊息 {{ stat.percentage }}%</span>
                            </div> -->

                            <!-- 顯示平均每日訊息 -->
                            <div v-if="stat.averagePerDay !== undefined" class="mt-1 d-flex align-center">
                                <v-icon size="small" color="grey-darken-1" class="mr-1">mdi-chart-line</v-icon>
                                <span class="text-grey-darken-1 text-caption"
                                    >平均每日 {{ stat.averagePerDay }} 則訊息</span
                                >
                            </div>
                        </div>
                    </v-card-item>
                    <template v-if="isPlaceholderData" v-slot:loader="{ isActive }">
                        <v-progress-linear :active="isActive" color="cyan" indeterminate height="4"></v-progress-linear>
                    </template>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
/* 統計卡片樣式 */
.stat-card {
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
}

.bg-blue-lighten-5 {
    background-color: #e3f2fd !important;
    border-left: 4px solid #1e88e5;
}

.bg-amber-lighten-5 {
    background-color: #fff8e1 !important;
    border-left: 4px solid #ffb300;
}

.bg-green-lighten-5 {
    background-color: #e8f5e9 !important;
    border-left: 4px solid #43a047;
}

.bg-purple-lighten-5 {
    background-color: #f3e5f5 !important;
    border-left: 4px solid #8e24aa;
}

.text-primary {
    color: #1976d2 !important;
}

.text-success {
    color: #2e7d32 !important;
}

.text-h4 {
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
}
</style>
