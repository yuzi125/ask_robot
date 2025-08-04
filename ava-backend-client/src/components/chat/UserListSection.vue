<script setup>
import { ref, computed, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
const props = defineProps({
    users: Array,
    selectedUser: Object,
    selectedExpert: Object,
    totalPages: Number,
    totalUsers: Number,
    currentUserPage: Number,
    userListExpanded: Boolean,
    isPlaceholderData: Boolean,
});

const emit = defineEmits(["select-user-expert", "toggle-user-list-section", "update:current-user-page", "search"]);

const showUserSearchBar = ref(false);
const searchQuery = ref("");
const expandedUsers = ref([]);

const userListHeight = computed(() => "calc(100vh - 240px)");

const debouncedSearch = useDebounceFn((value) => {
    emit("search", value);
}, 500);

const toggleUserListSection = () => {
    emit("toggle-user-list-section");
};

const toggleUserSearchBar = () => {
    showUserSearchBar.value = !showUserSearchBar.value;
    if (!showUserSearchBar.value) {
        searchQuery.value = "";

        emit("search", "");
    }
};

const toggleUserExpanded = (user) => {
    const index = expandedUsers.value.indexOf(user.id);
    if (index === -1) {
        expandedUsers.value.push(user.id);
    } else {
        expandedUsers.value.splice(index, 1);
    }
};

const selectUserAndExpert = (user, expert) => {
    emit("select-user-expert", { user, expert });
};

const filteredUsers = computed(() => props.users);

const handlePageChange = (newPage) => {
    emit("update:current-user-page", newPage);
};

watch(
    () => props.currentUserPage,
    (newValue, oldValue) => {
        if (newValue !== oldValue) {
            // 清空搜尋和展開狀態
            searchQuery.value = "";
            expandedUsers.value = [];
        }
    }
);

watch(searchQuery, (newValue) => {
    debouncedSearch(newValue);
});
</script>

<template>
    <div class="sidebar user-list-section border-right" :class="{ collapsed: !userListExpanded }">
        <v-card flat height="100%" class="d-flex flex-column">
            <v-card-title class="py-2 d-flex justify-space-between align-center">
                使用者列表({{ totalUsers }})
                <v-btn icon small @click="toggleUserListSection" class="toggle-btn">
                    <v-icon>{{ userListExpanded ? "mdi-chevron-left" : "mdi-chevron-right" }}</v-icon>
                </v-btn>
                <v-btn icon @click="toggleUserSearchBar">
                    <v-icon>{{ showUserSearchBar ? "mdi-close" : "mdi-magnify" }}</v-icon>
                </v-btn>
            </v-card-title>

            <div class="search-bar">
                <v-slide-y-transition>
                    <v-text-field
                        v-if="showUserSearchBar"
                        v-model="searchQuery"
                        label="搜尋使用者"
                        append-inner-icon="mdi-magnify"
                        clearable
                        dense
                        outlined
                        hide-details
                        class="mx-2 mb-2"
                    ></v-text-field>
                </v-slide-y-transition>
            </div>

            <v-card-text v-show="userListExpanded" class="flex-grow-1 pa-0 user-list-content">
                <div class="user-list-container">
                    <!-- Loading overlay -->
                    <div v-if="isPlaceholderData" class="table-overlay">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    </div>
                    <v-virtual-scroll :items="filteredUsers" :height="userListHeight" item-height="64">
                        <template v-slot:default="{ item: user }">
                            <v-hover v-slot="{ hover }">
                                <v-card
                                    class="mx-2 mb-2 user-card"
                                    :elevation="hover || expandedUsers.includes(user.id) ? 2 : 0"
                                    @click="toggleUserExpanded(user)"
                                >
                                    <v-card-text class="py-2">
                                        <div class="d-flex align-center">
                                            <v-icon
                                                small
                                                class="mr-2 transition-fast-in-fast-out"
                                                :class="{ 'rotate-icon': expandedUsers.includes(user.id) }"
                                            >
                                                mdi-chevron-right
                                            </v-icon>
                                            <div>
                                                <div class="font-weight-medium">
                                                    {{ user.name !== null ? user.name : "遊客" }}
                                                </div>
                                                <div class="caption text--secondary">{{ user.auth_id }}</div>
                                            </div>
                                        </div>
                                    </v-card-text>
                                </v-card>
                            </v-hover>
                            <v-expand-transition>
                                <div v-if="expandedUsers.includes(user.id)">
                                    <v-list-item
                                        v-for="expert in user.experts"
                                        :key="expert.expert_id"
                                        @click="selectUserAndExpert(user, expert)"
                                        class="mb-1 ml-4 rounded expert-item"
                                        :class="{
                                            'selected-expert':
                                                selectedUser &&
                                                selectedUser.id === user.id &&
                                                selectedExpert &&
                                                selectedExpert.expert_id === expert.expert_id,
                                        }"
                                    >
                                        <v-list-item-title class="body-2">{{ expert.expert_name }}</v-list-item-title>
                                    </v-list-item>
                                </div>
                            </v-expand-transition>
                        </template>
                    </v-virtual-scroll>
                </div>
            </v-card-text>

            <div class="pagination-container">
                <v-pagination
                    :model-value="currentUserPage"
                    :length="totalPages"
                    :total-visible="5"
                    dense
                    class="custom-pagination"
                    @update:model-value="handlePageChange"
                ></v-pagination>
            </div>
        </v-card>
    </div>
</template>

<style scoped>
.user-list-container {
    padding-bottom: 60px;
    flex-grow: 1;
    overflow-y: auto;
    position: relative;
    height: 100%;
    width: 100%;
    overflow: visible;
}

.user-list-section {
    height: calc(100vh - 68px);
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
}

.pagination-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: white;
    padding: 4px 0;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.v-slide-y-transition-enter-active,
.v-slide-y-transition-leave-active {
    transition: all 0.3s ease;
}

.border-right {
    border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.toggle-btn {
    position: absolute;
    right: -20px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    background-color: white !important;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
}

.search-bar {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
}

.user-list-section {
    background-color: #e0e0e0;
}

.user-card {
    transition: all 0.3s ease;
    cursor: pointer;
    border-radius: 4px;
}

.user-card:hover {
    background-color: #e0e0e0;
}

.expert-item {
    transition: background-color 0.2s ease;
    border-left: 2px solid #1976d2;
}

.expert-item:hover {
    background-color: #e3f2fd;
}

.selected-expert {
    background-color: #bbdefb !important;
}

.rotate-icon {
    transform: rotate(90deg);
}

.transition-fast-in-fast-out {
    transition: all 0.2s ease;
}

.sidebar {
    position: relative;
    flex: 0 0 25%;
    max-width: 25%;
    transition: all 0.3s ease;
    will-change: flex, max-width;
}

.sidebar.collapsed {
    flex: 0 0 40px;
    max-width: 40px;
}

.sidebar.collapsed .v-card-text,
.sidebar.collapsed .v-card-title > *:not(.toggle-btn) {
    display: none;
}

.chat-search-bar {
    flex: 0;
}

.custom-pagination {
    justify-content: center;
}

.custom-pagination :deep(.v-pagination__item) {
    height: 28px;
    min-width: 28px;
    width: 28px;
    font-size: 0.875rem;
}

.custom-pagination :deep(.v-pagination__navigation) {
    height: 28px;
    width: 28px;
}

.custom-pagination :deep(.v-pagination__navigation .v-icon) {
    font-size: 1rem;
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
</style>
