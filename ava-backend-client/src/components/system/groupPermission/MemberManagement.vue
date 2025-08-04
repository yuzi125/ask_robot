<script setup>
import { ref, computed, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";

const props = defineProps({
    selectedGroup: Object,
    selectedMembers: Array,
    usersData: Object,
    isLoadingUsers: Boolean,
    isPlaceholderData: Boolean,
    searchParams: Object,
    updating: Boolean,
    loading: Boolean,
    hasUnsavedChanges: Boolean,
});

const emit = defineEmits(["update-params", "toggle-selection", "save-members", "add-group"]);

const searchText = ref("");

// 分頁參數
const currentPage = computed({
    get: () => props.searchParams.page,
    set: (val) => emit("update-params", { page: val }),
});

// 使用 debounce 處理搜尋
const debouncedSearch = useDebounceFn((value) => {
    emit("update-params", { search: value, page: 1 });
}, 500);

// 監聽搜尋文字變化
watch(searchText, (newValue) => {
    debouncedSearch(newValue);
});

// 分頁變更
const handlePageChange = (page) => {
    emit("update-params", { page });
};

// 使用者列表和分頁資訊
const users = computed(() => props.usersData?.users || []);
const pagination = computed(() => props.usersData?.pagination || { total: 0, page: 1, pageSize: 10, totalPages: 1 });

// 檢查使用者是否已選擇
const isUserSelected = (userNo) => {
    return props.selectedMembers.includes(userNo);
};
</script>

<template>
    <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="px-4 py-3 text-white rounded-t-lg d-flex align-center justify-space-between bg-primary">
            <div class="d-flex align-center">
                <v-icon class="mr-2">mdi-account-edit</v-icon>
                <span>{{ selectedGroup.groupName }} 成員管理</span>
            </div>
            <v-btn
                color="white"
                variant="outlined"
                @click="$emit('save-members')"
                :loading="loading || updating"
                :disabled="!hasUnsavedChanges"
            >
                <v-icon left>mdi-content-save</v-icon>
                儲存變更
            </v-btn>
        </v-card-title>

        <v-card-text class="pa-4">
            <v-text-field
                v-model="searchText"
                label="搜尋使用者"
                variant="outlined"
                density="comfortable"
                hide-details
                bg-color="grey-lighten-4"
                class="mb-4 search-field"
            ></v-text-field>

            <div class="mb-3 d-flex justify-space-between align-center">
                <div class="member-counter">
                    <v-chip color="primary" variant="flat" class="px-2 py-1">
                        <v-icon size="small" left>mdi-account-check</v-icon>
                        已選擇: {{ selectedMembers.length }} 位成員
                    </v-chip>
                    <span v-if="hasUnsavedChanges" class="ml-2 text-caption text-warning">
                        <v-icon size="small" color="warning">mdi-alert-circle</v-icon>
                        有未儲存的變更
                    </span>
                </div>
            </div>

            <div class="selection-container content-container">
                <div v-if="users.length === 0" class="text-center empty-state pa-8">
                    <v-icon size="64" color="grey-lighten-2">mdi-account-search</v-icon>
                    <div class="mt-4 text-h6 text-grey">未找到符合條件的使用者</div>
                    <div class="text-body-2 text-grey-darken-1">嘗試修改搜尋條件</div>
                </div>

                <div v-if="isPlaceholderData" class="justify-center table-overlay d-flex align-center">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                </div>

                <div class="user-grid">
                    <v-hover v-for="user in users" :key="user.user_no" v-slot="{ isHovering, props }">
                        <div
                            v-bind="props"
                            :class="[
                                'user-item',
                                isUserSelected(user.user_no) ? 'user-selected' : '',
                                isHovering ? 'user-hover' : '',
                            ]"
                            @click="$emit('toggle-selection', user.user_no)"
                        >
                            <v-checkbox
                                :model-value="isUserSelected(user.user_no)"
                                hide-details
                                density="comfortable"
                                color="primary"
                                class="user-checkbox"
                                @click.stop
                                @change="$emit('toggle-selection', user.user_no)"
                            ></v-checkbox>
                            <div class="user-info">
                                <div class="user-name">{{ user.name }}</div>
                                <div class="user-id">{{ user.user_no }}</div>
                            </div>
                        </div>
                    </v-hover>
                </div>
            </div>

            <div class="justify-center mt-4 d-flex" v-if="pagination.totalPages > 1">
                <v-pagination
                    v-model="currentPage"
                    :length="pagination.totalPages"
                    :total-visible="7"
                    @update:model-value="handlePageChange"
                ></v-pagination>
            </div>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.selection-container {
    padding: 10px 0;
    min-height: 300px;
    background-color: #fafafa;
    border-radius: 8px;
}

.user-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    padding: 12px;
}

.user-item {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border-radius: 8px;
    background-color: white;
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
    cursor: pointer;
}

.user-hover {
    background-color: rgba(0, 0, 0, 0.02);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.user-selected {
    background-color: #e8f4fe;
    border-color: #90caf9;
    box-shadow: 0 1px 3px rgba(0, 120, 255, 0.1);
}

.user-checkbox {
    margin-right: 12px;
}

.user-info {
    flex: 1;
    min-width: 0; /* 防止溢出 */
}

.user-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.user-id {
    font-size: 0.8rem;
    color: rgba(0, 0, 0, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.search-field {
    border-radius: 8px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
}

.member-counter {
    display: flex;
    align-items: center;
}

.table-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 10;
}

.content-container {
    position: relative;
    overflow: visible !important;
}

/* 響應式調整 */
@media (max-width: 959px) {
    .user-grid {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
}

/* 分頁器樣式 */
:deep(.v-pagination__item--is-active) {
    font-weight: bold;
}

.text-warning {
    color: #fb8c00;
}
</style>
