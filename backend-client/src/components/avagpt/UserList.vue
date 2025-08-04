<script setup>
import { ref, computed, inject, watch } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { format } from "date-fns";
import { useDebounceFn, useWindowSize } from "@vueuse/core";

const axios = inject("axios");
const emit = defineEmits(["select-user"]);
const props = defineProps({
    elementWidth: {
        type: Number,
        required: false,
    },
    dateRange: {
        type: Object,
        required: true,
        default: () => ({
            start: new Date(),
            end: new Date(),
        }),
    },
});

const selectedUserId = ref(null);
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);
// 創建防抖後的搜尋變數
const debouncedSearchQuery = ref("");

// 使用 debounce 處理搜尋
const debouncedSearch = useDebounceFn(() => {
    currentPage.value = 1; // 重置到第一頁
    // 更新防抖後的搜尋值，這會觸發 query 重新執行
    debouncedSearchQuery.value = searchQuery.value;
}, 500);

// 當搜尋關鍵字變更時
watch(searchQuery, () => {
    debouncedSearch();
});

const fetchUsers = async () => {
    const startDate = format(props.dateRange.start, "yyyy-MM-dd'T'HH:mm:ss");
    const endDate = format(props.dateRange.end, "yyyy-MM-dd'T'HH:mm:ss");

    const { data } = await axios.get(`/avaGPT/chat/users`, {
        params: {
            startDate,
            endDate,
            page: currentPage.value,
            limit: itemsPerPage.value,
            searchQuery: debouncedSearchQuery.value,
        },
    });

    if (data.code !== 200) {
        throw new Error(data.message);
    }

    return data.data;
};

const {
    data: usersData,
    refetch,
    isPlaceholderData,
} = useQuery({
    queryKey: ["users", props.dateRange, currentPage, itemsPerPage, debouncedSearchQuery],
    queryFn: fetchUsers,
    placeholderData: keepPreviousData,
});

// 計算總頁數
const totalPages = computed(() => {
    return usersData.value?.totalPages || 1;
});

// 用戶列表
const users = computed(() => {
    return usersData.value?.users || [];
});

// 監聽日期範圍變化
watch(
    () => props.dateRange,
    () => {
        currentPage.value = 1;
        refetch();
    },
    { deep: true }
);

// 處理頁碼變更
const handlePageChange = (newPage) => {
    currentPage.value = newPage;
    refetch();
};

const selectUser = (user) => {
    selectedUserId.value = user.userId;
    emit("select-user", user);
};
</script>

<template>
    <v-card elevation="2" class="rounded-lg h-100 d-flex flex-column">
        <v-card-title class="flex-none px-4 py-2 d-flex align-center bg-surface-variant">
            <div class="d-flex align-center text-truncate">
                <v-icon icon="mdi-account-group" class="flex-none me-2" />
                <span class="text-truncate">使用者列表</span>
            </div>
        </v-card-title>

        <div class="overflow-hidden d-flex flex-column flex-grow-1">
            <v-text-field
                v-model="searchQuery"
                density="compact"
                variant="solo-filled"
                label="搜尋使用者"
                prepend-inner-icon="mdi-magnify"
                clearable
                hide-details
                class="flex-none mx-2 mt-2 search-field"
                style="max-height: 40px"
            ></v-text-field>

            <div class="user-list-container flex-grow-1 position-relative">
                <!-- Loading overlay -->
                <div v-if="isPlaceholderData" class="table-overlay">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                </div>

                <div v-if="users.length > 0" class="user-list-scroll">
                    <v-list class="overflow-y-auto pa-0" style="max-height: 100%">
                        <v-list-item
                            v-for="user in users"
                            :key="user.userId"
                            :active="selectedUserId === user.userId"
                            @click="selectUser(user)"
                            class="py-2"
                            rounded="0"
                        >
                            <v-list-item-title class="user-list-title">{{ user.name }}</v-list-item-title>
                            <v-list-item-subtitle class="user-list-subtitle">
                                <span>{{ user.email }}</span>
                            </v-list-item-subtitle>

                            <template v-slot:append>
                                <v-badge :content="user.totalMessagesCount" color="info" inline class="mr-2"></v-badge>
                                <v-icon icon="mdi-chevron-right" size="small"></v-icon>
                            </template>
                        </v-list-item>
                    </v-list>
                </div>

                <div v-else class="justify-center d-flex align-center">
                    <v-alert
                        type="info"
                        variant="tonal"
                        border="start"
                        class="ma-2"
                        text="此時間範圍內無使用者對話記錄"
                    ></v-alert>
                </div>

                <div class="pagination-wrapper">
                    <v-pagination
                        v-if="totalPages > 1"
                        v-model="currentPage"
                        :length="totalPages"
                        :total-visible="elementWidth > 1100 ? 5 : 3"
                        @update:model-value="handlePageChange"
                        density="compact"
                        rounded="circle"
                    ></v-pagination>
                </div>
            </div>
        </div>
    </v-card>
</template>

<style scoped>
.h-100 {
    height: 100%;
}

.flex-none {
    flex: none;
}

.user-list-container {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex: 1;
}

.search-field {
    margin-bottom: 8px !important;
}

.v-list-item--active {
    background-color: rgba(var(--v-theme-primary), 0.15);
}

.v-list-item--active .v-list-item-subtitle {
    color: rgba(0, 0, 0, 0.6) !important;
}

.user-list-title,
.user-list-subtitle {
    color: inherit !important;
}

.v-list-item--active .user-list-title {
    color: rgb(var(--v-theme-primary)) !important;
    font-weight: 600;
}

.text-truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.flex-none {
    flex: none;
}

.pagination-wrapper {
    display: flex;
    justify-content: center;
    padding: 8px 0;
    background-color: white;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
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

.user-list-scroll {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex: 1;
}
</style>
