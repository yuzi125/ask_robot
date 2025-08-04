<script setup>
import { ref, computed, watch, defineExpose } from "vue";
import { useDebounceFn } from "@vueuse/core";

const props = defineProps({
    groupsData: Object,
    isLoading: Boolean,
    isPlaceholderData: Boolean,
    groupParams: Object,
    selectedGroup: Object,
});

const emit = defineEmits(["update-params", "select-group", "edit-group", "delete-group", "add-group"]);

const groupSearchText = ref("");

// 群組分頁參數
const groupCurrentPage = computed({
    get: () => props.groupParams.page,
    set: (val) => emit("update-params", { page: val }),
});

// 使用 debounce 處理群組搜尋
const debouncedGroupSearch = useDebounceFn((value) => {
    emit("update-params", { search: value, page: 1 });
}, 500);

// 監聽群組搜尋文字變化
watch(groupSearchText, (newValue) => {
    debouncedGroupSearch(newValue);
});

// 群組分頁變更
const handleGroupPageChange = (page) => {
    emit("update-params", { page });
};

// 編輯群組 (阻止事件冒泡)
const handleEditGroup = (event, group) => {
    event.stopPropagation();
    emit("edit-group", group);
};

// 刪除群組 (阻止事件冒泡)
const handleDeleteGroup = (event, group) => {
    event.stopPropagation();
    emit("delete-group", group);
};

// 定義一個函數來檢查是否需要切換到上一頁
const checkAndGoToPreviousPage = () => {
    if (props?.groupsData?.groups?.length === 0 && props?.groupsData?.pagination?.totalPages >= 1) {
        const previousPage = Math.max(1, groupCurrentPage.value - 1);
        emit("update-params", { page: previousPage });
    }
};

defineExpose({
    checkAndGoToPreviousPage
});
</script>

<template>
    <v-card elevation="2" rounded="lg" class="h-100 d-flex flex-column">
        <v-card-title class="px-4 py-3 text-white rounded-t-lg d-flex align-center justify-space-between bg-primary">
            <div class="d-flex align-center">
                <v-icon class="mr-2">mdi-account-multiple</v-icon>
                <span>群組列表</span>
            </div>
            <v-text-field
                v-model="groupSearchText"
                label="搜尋群組"
                density="compact"
                hide-details
                bg-color="blue-lighten-4"
                class="ml-2 search-field"
                style="max-width: 180px"
            ></v-text-field>
        </v-card-title>

        <v-card-text class="pa-0 flex-grow-1 d-flex flex-column" style="background-color: #fafafa">
            <div
                class="selection-container content-container"
                :style="{
                    backgroundColor: groupsData?.groups?.length > 0 ? '#ffffff' : '#fafafa',
                }"
            >
                <div v-if="isPlaceholderData" class="justify-center table-overlay d-flex align-center">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                </div>
                <v-list-item v-if="(!groupsData || groupsData?.groups?.length === 0) && groupSearchText === '' && groupCurrentPage === 1">
                    <div class="text-center empty-state pa-8">
                        <v-icon size="64" color="grey-lighten-2">mdi-account-group-outline</v-icon>
                        <div class="mt-4 text-h6 text-grey">尚未建立任何群組</div>
                        <v-btn color="primary" class="mt-4" prepend-icon="mdi-plus" @click="$emit('add-group')">
                            新增群組
                        </v-btn>
                    </div>
                </v-list-item>

                <div v-else-if="groupsData?.groups?.length === 0" class="text-center empty-state pa-8">
                    <v-icon size="64" color="grey-lighten-2">mdi-account-search</v-icon>
                    <div class="mt-4 text-h6 text-grey">未找到符合條件的群組</div>
                    <div class="text-body-2 text-grey-darken-1">嘗試修改搜尋條件</div>
                </div>

                <v-list class="pa-0">
                    <v-list-item
                        v-for="group in groupsData?.groups"
                        :key="group.groupId"
                        :active="selectedGroup && selectedGroup.groupId === group.groupId"
                        @click="$emit('select-group', group)"
                        class="group-item"
                        :class="{
                            'selected-group': selectedGroup && selectedGroup.groupId === group.groupId,
                        }"
                        rounded="lg"
                        :ripple="false"
                    >
                        <template v-slot:prepend>
                            <v-icon
                                :color="selectedGroup && selectedGroup.groupId === group.groupId ? 'primary' : 'grey'"
                            >
                                mdi-account-group-outline
                            </v-icon>
                        </template>

                        <v-list-item-title class="font-weight-medium">{{ group.groupName }}</v-list-item-title>
                        <v-list-item-subtitle class="text-caption">ID: {{ group.groupId }}</v-list-item-subtitle>

                        <template v-slot:append>
                            <div class="d-flex align-center">
                                <v-chip color="primary" size="small" variant="outlined" class="mr-2">
                                    {{ group.groupMember ? group.groupMember.length : 0 }} 位成員
                                </v-chip>
                                <v-menu location="bottom end">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            icon="mdi-dots-vertical"
                                            variant="text"
                                            size="small"
                                            color="grey-darken-1"
                                            v-bind="props"
                                            @click.stop
                                        ></v-btn>
                                    </template>
                                    <v-list density="compact">
                                        <v-list-item @click="handleEditGroup($event, group)">
                                            <template v-slot:prepend>
                                                <v-icon size="small" color="warning">mdi-pencil</v-icon>
                                            </template>
                                            <v-list-item-title class="text-warning">編輯群組</v-list-item-title>
                                        </v-list-item>
                                        <v-list-item @click="handleDeleteGroup($event, group)">
                                            <template v-slot:prepend>
                                                <v-icon size="small" color="error">mdi-delete</v-icon>
                                            </template>
                                            <v-list-item-title class="text-error">刪除群組</v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                            </div>
                        </template>
                    </v-list-item>
                </v-list>
            </div>

            <!-- 群組分頁 -->
            <div class="justify-center d-flex pa-2" v-if="groupsData?.pagination?.totalPages > 1">
                <v-pagination
                    v-model="groupCurrentPage"
                    :length="groupsData?.pagination?.totalPages || 1"
                    :total-visible="5"
                    density="compact"
                    @update:model-value="handleGroupPageChange"
                ></v-pagination>
            </div>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.group-item {
    margin: 4px 8px;
    border-radius: 8px !important;
    transition: all 0.2s ease;
    border-left: 3px solid transparent;
}

.group-item:hover {
    background-color: rgba(0, 0, 0, 0.03);
}

.selected-group {
    background-color: #f0f7ff !important;
    border-left: 3px solid var(--v-primary-base) !important;
}

.selection-container {
    padding: 10px 0;
    min-height: 300px;
    height: 100%;
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
</style>
