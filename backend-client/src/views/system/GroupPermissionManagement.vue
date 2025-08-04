<script setup>
import { ref, computed, watch, inject } from "vue";
import { useGroupPermission } from "@/composables/useGroupPermission";
import SystemHeader from "@/components/system/SystemHeader.vue";
import GroupList from "@/components/system/groupPermission/GroupList.vue";
import MemberManagement from "@/components/system/groupPermission/MemberManagement.vue";
import AddGroupDialog from "@/components/system/groupPermission/AddGroupDialog.vue";
import EditGroupDialog from "@/components/system/groupPermission/EditGroupDialog.vue";
import ConfirmDialog from "@/components/system/groupPermission/ConfirmDialog.vue";

const emitter = inject("emitter");

// 狀態管理
const selectedGroup = ref(null);
const selectedMembers = ref([]);
const groupForm = ref({
    groupId: "",
    groupName: "",
    remark: "",
});
const loading = ref(false);
const showAddGroupDialog = ref(false);
const showEditGroupDialog = ref(false);
const showConfirmDialog = ref(false);
const confirmDialogTitle = ref("");
const confirmDialogMessage = ref("");
const confirmDialogAction = ref(null);
const hasUnsavedChanges = ref(false);
const groupListRef = ref(null);

// 使用整合後的 useGroupPermission
const {
    groupsData,
    isLoadingGroups,
    refetchGroups,
    usersData,
    isLoadingUsers,
    refetchUsers,
    searchParams,
    groupParams,
    updateSearchParams,
    updateGroupParams,
    createGroupAsync,
    updateGroupAsync,
    deleteGroupAsync,
    creating,
    updating,
    isGroupsPlaceholderData,
    isUsersPlaceholderData,
} = useGroupPermission();

// 監控成員變化，設定變更標記
watch(
    selectedMembers,
    () => {
        if (selectedGroup.value) {
            const currentMembers = Array.isArray(selectedGroup.value.groupMember)
                ? selectedGroup.value.groupMember
                : [];
            // 檢查是否有變更
            if (currentMembers.length !== selectedMembers.value.length) {
                hasUnsavedChanges.value = true;
            } else {
                const hasDifference =
                    currentMembers.some((member) => !selectedMembers.value.includes(member)) ||
                    selectedMembers.value.some((member) => !currentMembers.includes(member));
                hasUnsavedChanges.value = hasDifference;
            }
        }
    },
    { deep: true }
);

// 處理標題欄操作
const handleHeaderAction = (actionId) => {
    if (actionId === "refresh") {
        refetchGroups();
        refetchUsers();
    } else if (actionId === "add") {
        openAddGroupDialog();
    }
};

// 確認對話框
const openConfirmDialog = (title, message, action) => {
    confirmDialogTitle.value = title;
    confirmDialogMessage.value = message;
    confirmDialogAction.value = action;
    showConfirmDialog.value = true;
};

// 打開新增群組對話框
const openAddGroupDialog = () => {
    groupForm.value = {
        groupId: "",
        groupName: "",
        remark: "",
    };
    showAddGroupDialog.value = true;
};

// 打開編輯群組對話框
const openEditGroupDialog = (group) => {
    groupForm.value = {
        groupId: group.groupId,
        groupName: group.groupName,
        remark: group.remark || "",
    };
    showEditGroupDialog.value = true;
};

// 檢查變更並選擇群組
const selectGroup = async (group) => {
    if (hasUnsavedChanges.value && selectedGroup.value) {
        openConfirmDialog("未儲存的變更", "您有未儲存的成員變更，是否要繼續？您的變更將會遺失。", () => {
            selectedGroup.value = group;
            updateSelectedGroupMembers(group);
        });
    } else {
        selectedGroup.value = group;
        updateSelectedGroupMembers(group);
    }
};

// 更新選中的成員列表
const updateSelectedGroupMembers = (group) => {
    selectedMembers.value = Array.isArray(group.groupMember) ? [...group.groupMember] : [];
    hasUnsavedChanges.value = false;
};

// 新增群組
const createGroup = async (formData) => {
    try {
        loading.value = true;
        await createGroupAsync(formData);
        showAddGroupDialog.value = false;
        emitter.emit("openSnackbar", { message: "群組新增成功", color: "success" });
        await refetchGroups();
    } catch (error) {
        emitter.emit("openSnackbar", { message: error.message || "群組新增失敗", color: "error" });
    } finally {
        loading.value = false;
    }
};

// 更新群組
const updateGroup = async (formData) => {
    try {
        loading.value = true;
        // 取得原始的群組成員
        const groupMembers = selectedGroup.value
            ? Array.isArray(selectedGroup.value.groupMember)
                ? selectedGroup.value.groupMember
                : []
            : [];

        await updateGroupAsync({
            ...formData,
            groupMember: groupMembers,
        });

        await refetchGroups();

        // 更新本地選中的群組資訊
        if (selectedGroup.value) {
            const updatedGroup = groupsData.value.groups.find((g) => g.groupId === selectedGroup.value.groupId);
            if (updatedGroup) {
                selectedGroup.value = updatedGroup;
            }
        }

        showEditGroupDialog.value = false;
    } catch (error) {
        emitter.emit("openSnackbar", { message: error.message || "群組更新失敗", color: "error" });
    } finally {
        loading.value = false;
    }
};

// 確認刪除群組
const confirmDeleteGroup = (group) => {
    openConfirmDialog("確認刪除", `確定要刪除「${group.groupName}」群組嗎？`, () => deleteGroup(group.groupId));
};

// 刪除群組
const deleteGroup = async (groupId) => {
    try {
        loading.value = true;
        await deleteGroupAsync(groupId);
        if (selectedGroup.value && selectedGroup.value.groupId === groupId) {
            selectedGroup.value = null;
        }
        await refetchGroups();
        groupListRef.value.checkAndGoToPreviousPage();
        emitter.emit("openSnackbar", { message: "群組刪除成功", color: "success" });
    } catch (error) {
        emitter.emit("openSnackbar", { message: error.message || "群組刪除失敗", color: "error" });
    } finally {
        loading.value = false;
    }
};

// 切換使用者選擇狀態
const toggleUserSelection = (userNo) => {
    if (!selectedGroup.value) return;

    if (selectedMembers.value.includes(userNo)) {
        // 移除使用者
        selectedMembers.value = selectedMembers.value.filter((id) => id !== userNo);
    } else {
        // 新增使用者
        selectedMembers.value = [...selectedMembers.value, userNo];
    }
};

// 儲存群組成員變更
const saveGroupMembers = async () => {
    if (!selectedGroup.value) return;

    try {
        loading.value = true;

        // 確保沒有重複的成員
        const uniqueMembers = [...new Set(selectedMembers.value)];

        // 使用單一請求更新群組成員
        await updateGroupAsync({
            groupId: selectedGroup.value.groupId,
            groupName: selectedGroup.value.groupName,
            remark: selectedGroup.value.remark || "",
            groupMember: uniqueMembers,
        });

        await refetchGroups();

        // 更新本地選中的群組
        if (selectedGroup.value) {
            const updatedGroup = groupsData.value.groups.find((g) => g.groupId === selectedGroup.value.groupId);
            if (updatedGroup) {
                selectedGroup.value = updatedGroup;
                // 重設本地成員列表，確保與資料庫同步
                selectedMembers.value = Array.isArray(updatedGroup.groupMember) ? [...updatedGroup.groupMember] : [];
            }
        }

        hasUnsavedChanges.value = false;
        emitter.emit("openSnackbar", { message: "群組成員更新成功", color: "success" });
    } catch (error) {
        emitter.emit("openSnackbar", { message: error.message || "群組成員更新失敗", color: "error" });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="settings-container">
        <SystemHeader
            title="群組權限管理"
            subtitle="管理系統群組及其成員，設定不同群組的權限範圍。"
            icon="mdi-account-group"
            :actions="[
                {
                    id: 'refresh',
                    text: '更新資料',
                    icon: 'mdi-refresh',
                    color: 'info',
                    loading: isLoadingGroups || isLoadingUsers,
                },
                {
                    id: 'add',
                    text: '新增群組',
                    icon: 'mdi-plus',
                    color: 'success',
                },
            ]"
            @action="handleHeaderAction"
        />

        <v-row>
            <!-- 左側群組列表 -->
            <v-col cols="12" md="4" class="pr-md-3">
                <GroupList
                    ref="groupListRef"
                    :groups-data="groupsData"
                    :is-loading="isLoadingGroups"
                    :is-placeholder-data="isGroupsPlaceholderData"
                    :group-params="groupParams"
                    :selected-group="selectedGroup"
                    @update-params="updateGroupParams"
                    @select-group="selectGroup"
                    @edit-group="openEditGroupDialog"
                    @delete-group="confirmDeleteGroup"
                    @add-group="openAddGroupDialog"
                />
            </v-col>

            <!-- 右側成員管理 -->
            <v-col cols="12" md="8" class="pl-md-3">
                <MemberManagement
                    v-if="selectedGroup"
                    :selected-group="selectedGroup"
                    :selected-members="selectedMembers"
                    :users-data="usersData"
                    :is-loading-users="isLoadingUsers"
                    :is-placeholder-data="isUsersPlaceholderData"
                    :search-params="searchParams"
                    :updating="updating"
                    :loading="loading"
                    :has-unsaved-changes="hasUnsavedChanges"
                    @update-params="updateSearchParams"
                    @toggle-selection="toggleUserSelection"
                    @save-members="saveGroupMembers"
                    @add-group="openAddGroupDialog"
                />
                <v-card v-else elevation="2" rounded="lg" class="h-100">
                    <div class="text-center empty-state pa-12">
                        <v-icon size="80" color="grey-lighten-2">mdi-account-group</v-icon>
                        <div class="mt-6 text-h5 text-grey-darken-1">請選擇一個群組</div>
                        <div class="mt-2 text-body-1 text-grey">從左側選擇一個群組來管理其成員</div>
                        <v-btn color="primary" class="mt-6" prepend-icon="mdi-plus" @click="openAddGroupDialog">
                            新增群組
                        </v-btn>
                    </div>
                </v-card>
            </v-col>
        </v-row>

        <!-- 對話框組件 -->
        <AddGroupDialog
            v-model="showAddGroupDialog"
            :group-form="groupForm"
            :loading="creating || loading"
            @submit="createGroup"
        />

        <EditGroupDialog
            v-model="showEditGroupDialog"
            :group-form="groupForm"
            :loading="updating || loading"
            @submit="updateGroup"
        />

        <ConfirmDialog
            v-model="showConfirmDialog"
            :title="confirmDialogTitle"
            :message="confirmDialogMessage"
            @confirm="
                () => {
                    if (confirmDialogAction) confirmDialogAction();
                    showConfirmDialog = false;
                }
            "
        />
    </div>
</template>

<style scoped>
.settings-container {
    padding: 2em;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
}
</style>
