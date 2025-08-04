<script setup>
import { ref, computed, reactive, watch } from "vue";
import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { fetchUsersWithExperts, fetchUserExpertChat, fetchUserExpertChatDates } from "@/network/service";
import SearchSection from "@/components/chat/SearchSection.vue";
import UserListSection from "@/components/chat/UserListSection.vue";
import ChatSection from "@/components/chat/ChatSection.vue";
import { useWindowSize } from "@vueuse/core";
const { width } = useWindowSize();
const selectedUser = ref(null);
const selectedExpert = ref(null);

const currentUserPage = ref(1);

const itemsPerPage = 7;
// 主組件中
const isSearchManuallyCollapsed = ref(false); // 新增手動控制狀態
const isUserListManuallyCollapsed = ref(false);

// 修改 computed 來結合自動和手動狀態
const searchExpanded = computed({
    get: () => {
        // 如果是手動控制狀態，就用手動控制的值
        return !isSearchManuallyCollapsed.value;
    },
    set: (value) => {
        isSearchManuallyCollapsed.value = !value;
    },
});

const userListExpanded = computed({
    get: () => {
        return !isUserListManuallyCollapsed.value;
    },
    set: (value) => {
        isUserListManuallyCollapsed.value = !value;
    },
});

const currentChatPage = ref(1);
const chatItemsPerPage = 10; // 或其他適合的數量
const selectedDate = ref(null);
const searchQuery = ref("");
const searchUserQuery = ref("");

const searchParams = reactive({
    startDate: "",
    endDate: "",
    searchQuery: "",
    selectedUserType: "遊客",
    enabledDeleteExpert: false,
});

// 取得使用者列表
const {
    isLoading,
    data: usersData,
    refetch: refetchUsers,
    isPlaceholderData: isUsersPlaceholderData,
} = useQuery({
    queryKey: ["usersWithExperts", currentUserPage, itemsPerPage, searchParams, searchUserQuery.value],
    queryFn: () =>
        fetchUsersWithExperts({
            ...searchParams,
            page: currentUserPage.value,
            pageSize: itemsPerPage,
            searchQuery: searchUserQuery.value,
        }),
    enabled: false,
    placeholderData: keepPreviousData,
});

// 取得使用者對話記錄的 query key
const chatQueryKey = computed(() => [
    "userExpertChat",
    selectedUser.value?.id,
    selectedExpert.value?.expert_id,
    currentChatPage.value,
    selectedDate.value, // 加入選擇的日期
    searchQuery.value, // 加入搜尋關鍵字
]);

// 取得使用者對話記錄
const {
    data: chatData,
    isLoading: isChatLoading,
    refetch: refetchChat,
    isPlaceholderData: isChatPlaceholderData,
} = useQuery({
    queryKey: chatQueryKey,
    queryFn: () => {
        return fetchUserExpertChat({
            userId: selectedUser.value.id,
            expertId: selectedExpert.value.expert_id,
            page: currentChatPage.value,
            pageSize: chatItemsPerPage,
            startDate: selectedDate.value ? `${selectedDate.value}T00:00:00.000+08:00` : searchParams.startDate,
            endDate: selectedDate.value ? `${selectedDate.value}T23:59:59.999+08:00` : searchParams.endDate,
            searchQuery: searchQuery.value,
        });
    },
    enabled: !!selectedUser.value && !!selectedExpert.value,
    placeholderData: keepPreviousData,
    gcTime: 1000 * 60 * 3,
});

// 取得使用者對話記錄日期的 query key
const datesQueryKey = computed(() => [
    "userExpertDates",
    selectedUser.value?.id,
    selectedExpert.value?.expert_id,
    searchQuery.value, // 加入搜尋關鍵字
]);

const handleDateSelect = (date) => {
    if (date) {
        // 首先將日期轉換為本地時間的午夜時刻
        const localDate = new Date(date);
        const year = localDate.getFullYear();
        const month = localDate.getMonth();
        const day = localDate.getDate();

        // 創建該日期的本地時間字符串
        selectedDate.value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else {
        selectedDate.value = null;
    }
    currentChatPage.value = 1;
    refetchChat();
};

// 取得使用者對話記錄日期
const {
    data: datesData,
    isLoading: isDatesLoading,
    refetch: refetchDates,
    isPlaceholderData: isDatesPlaceholderData,
} = useQuery({
    queryKey: datesQueryKey,
    queryFn: () =>
        fetchUserExpertChatDates({
            userId: selectedUser.value.id,
            expertId: selectedExpert.value.expert_id,
            startDate: searchParams.startDate,
            endDate: searchParams.endDate,
            searchQuery: searchQuery.value, // 加入搜尋關鍵字
        }),
    enabled: !!selectedUser.value && !!selectedExpert.value,
    placeholderData: keepPreviousData,
    gcTime: 1000 * 60 * 3,
});

const selectUserAndExpert = ({ user, expert }) => {
    selectedUser.value = user;
    selectedExpert.value = expert;
    currentChatPage.value = 1;
    refetchChat();
    refetchDates();
};
const applyFilter = (params) => {
    currentUserPage.value = 1;
    Object.assign(searchParams, params);
    refetchUsers();
};

const toggleSearchSection = () => {
    isSearchManuallyCollapsed.value = !isSearchManuallyCollapsed.value;
};

const toggleUserListSection = () => {
    userListExpanded.value = !userListExpanded.value;
};

const totalPages = computed(() => {
    if (!usersData.value?.data?.total) return 0;
    return Math.ceil(usersData.value.data.total / itemsPerPage);
});

const totalUsers = computed(() => {
    if (!usersData.value || !usersData.value.data) return 0;
    return usersData.value.data.total;
});

const handleUserPageChange = (newPage) => {
    currentUserPage.value = newPage;
    refetchUsers();
};

const handleSearch = (query) => {
    searchQuery.value = query;
    currentChatPage.value = 1; // 重置頁碼
    refetchChat();
    refetchDates();
};

const handleUserSearch = (query) => {
    searchUserQuery.value = query;
    currentUserPage.value = 1;
    refetchUsers();
};

const allUsers = computed(() => {
    if (!usersData.value?.data?.users) return [];
    return usersData.value.data.users;
});

// 監聽專家變化
watch(
    () => selectedExpert.value?.expert_id,
    () => {
        if (selectedUser.value && selectedExpert.value) {
            refetchDates();
            refetchChat();
        }
    }
);

// 監聽分頁變化
watch(
    () => currentChatPage.value,
    () => {
        if (selectedUser.value && selectedExpert.value) {
            refetchChat();
        }
    }
);

watch(width, (newWidth) => {
    if (newWidth < 800) {
        isSearchManuallyCollapsed.value = true;
        isUserListManuallyCollapsed.value = true;
    } else {
        isSearchManuallyCollapsed.value = false;
        isUserListManuallyCollapsed.value = false;
    }
});
</script>
<template>
    <v-container fluid class="pa-0 main-container">
        <!-- 第一區塊 Search Section -->
        <SearchSection
            :is-loading="isLoading"
            @apply-filter="applyFilter"
            @toggle-search-section="toggleSearchSection"
            :search-expanded="searchExpanded"
        />

        <!-- 第二區塊 User List Section -->
        <UserListSection
            :users="allUsers"
            :selected-user="selectedUser"
            :selected-expert="selectedExpert"
            :total-pages="totalPages"
            :total-users="totalUsers"
            :current-user-page="currentUserPage"
            @select-user-expert="selectUserAndExpert"
            @toggle-user-list-section="toggleUserListSection"
            @update:current-user-page="handleUserPageChange"
            @search="handleUserSearch"
            :user-list-expanded="userListExpanded"
            :is-placeholder-data="isUsersPlaceholderData"
        />
        <!-- 第三區塊 Chat Section -->
        <ChatSection
            :selected-user="selectedUser"
            :selected-expert="selectedExpert"
            :chat-data="chatData?.data"
            :dates-data="datesData?.data"
            :is-loading="isChatLoading"
            :is-dates-loading="isDatesLoading"
            :search-expanded="searchExpanded"
            :is-placeholder-data="isChatPlaceholderData"
            :is-placeholder-dates="isDatesPlaceholderData"
            :user-list-expanded="userListExpanded"
            :selected-date="selectedDate"
            @update:current-page="currentChatPage = $event"
            @update:selected-date="handleDateSelect"
            @search="handleSearch"
        />
    </v-container>
</template>

<style scoped>
.main-container {
    display: flex;
    overflow: hidden;
}

.chat-section {
    max-width: 100vw; /* 限制最多佔滿視窗寬度 */
    overflow: hidden;  /* 避免內容超出 */
}
</style>
