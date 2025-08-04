<script setup>
import { computed, inject, watch, ref } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { format } from "date-fns";
import TopUsersCard from "./TopUsersCard.vue";
import TopUsersChart from "./TopUsersChart.vue";

const axios = inject("axios");

const props = defineProps({
    dateRange: {
        type: Object,
        required: true,
        default: () => ({
            start: new Date(),
            end: new Date(),
        }),
    },
});

defineEmits(["refresh"]);

// 排序類型
const sortBy = ref("messages"); // "messages" 或 "cost"

// 獲取 Top 10 使用者統計數據
const fetchTopUsersData = async () => {
    const startDate = format(props.dateRange.start, "yyyy-MM-dd'T'HH:mm:ss");
    const endDate = format(props.dateRange.end, "yyyy-MM-dd'T'HH:mm:ss");

    const { data } = await axios.get(`/avaGPT/chat/top-users`, {
        params: {
            startDate,
            endDate,
            sortBy: sortBy.value,
        },
    });

    if (data.code !== 200) {
        throw new Error(data.message);
    }

    return data.data;
};

const refetchInterval = 30000;

// 獲取 Top 10 使用者統計
const {
    data: statistics,
    refetch: refetchTopUsers,
    isPlaceholderData,
} = useQuery({
    queryKey: ["top-users-statistics", props.dateRange, sortBy],
    queryFn: fetchTopUsersData,
    placeholderData: keepPreviousData,
    refetchInterval,
});

// 監聽日期範圍變化
watch(
    () => props.dateRange,
    () => {
        refetchTopUsers();
    },
    { deep: true }
);

// 監聽排序類型變化
watch(sortBy, () => {
    refetchTopUsers();
});

// 切換排序類型
const toggleSortBy = () => {
    sortBy.value = sortBy.value === "messages" ? "cost" : "messages";
};
</script>

<template>
    <div class="top-users-stats">
        <!-- 排序類型切換按鈕 -->
        <div class="mb-4 d-flex align-center">
            <v-btn-toggle v-model="sortBy" color="primary" mandatory>
                <v-btn value="messages" size="small">
                    <v-icon start>mdi-message-text</v-icon>
                    按訊息數排序
                </v-btn>
                <v-btn value="cost" size="small">
                    <v-icon start>mdi-currency-usd</v-icon>
                    按花費排序
                </v-btn>
            </v-btn-toggle>
        </div>

        <v-row>
            <!-- Top 10 使用者卡片 -->
            <v-col cols="12" md="6">
                <TopUsersCard :stats="statistics" :isPlaceholderData="isPlaceholderData" :sortBy="sortBy" />
            </v-col>

            <!-- Top 10 使用者圖表 -->
            <v-col cols="12" md="6">
                <TopUsersChart
                    :statistics="statistics"
                    :isPlaceholderData="isPlaceholderData"
                    :sortBy="sortBy"
                    @refresh="$emit('refresh')"
                />
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
.top-users-stats {
    width: 100%;
}
</style>
