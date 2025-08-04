<script setup>
import { ref, inject, computed, watchEffect, onMounted, onUnmounted, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
const axios = inject("axios");
const emitter = inject("emitter");

import AddUser from "../../components/system/AddUser.vue";
import AddGroup from "../../components/system/AddGroup.vue";
import UserChips from "../../components/system/UserChips.vue";
import ConfirmComponents from "@/components/ConfirmComponents.vue";
import { fetchAllGroups } from "@/network/permission";

// Tab 設定
const tab = ref("permission");
const tabList = ref(["後台頁面", "前台聊天室", "專家", "知識庫", "建立功能", "批量修改"]);

// 取得所有使用者資料
// const userList = ref([]);
const searchUser = ref({
    authIDs: [],
    input: "",
});

const { data: userList, isLoading } = useQuery({
    queryKey: ["userList"],
    queryFn: async () => {
        const { data } = await axios.get("/system/getUsers");
        return data.data;
    },
});

watchEffect(() => {
    if (isLoading.value) return;

    let users = [];
    if (!userList.value) return;

    if (searchUser.value.input) {
        users = userList.value.filter(
            (user) => user.name.match(searchUser.value.input) || user.user_no.match(searchUser.value.input)
        );
    } else {
        users = userList.value;
    }
    searchUser.value.authIDs = users.map((user) => user.user_no);
});

function userFilter(users) {
    if (!users || users.length === 0) return [];

    // 分離使用者和群組
    const userIDs = users.filter((id) => !id.startsWith("#"));
    const groupIDs = users.filter((id) => id.startsWith("#"));

    // 過濾使用者
    const filteredUsers = userIDs.filter((authID) => searchUser.value.authIDs.includes(authID));

    // 合併過濾後的使用者和所有群組
    return [...filteredUsers, ...groupIDs];
}

// 取得權限設置表
const originPermissionSetting = ref({});
const permissionSetting = ref({});
async function getPermissionSetting() {
    const response = await axios.get("/system/getPermissionSetting");

    if (response && response.data && response.data.code === 0) {
        originPermissionSetting.value = JSON.parse(response.data.data);
        permissionSetting.value = JSON.parse(response.data.data);
    } else {
        emitter.emit("openSnackbar", { message: "取得權限清單失敗。", color: "error" });
    }
}
getPermissionSetting();

// 取得專家、知識庫清單
const experts = ref([]);
const datasets = ref([]);
async function getExpertsAndDatasets() {
    const resData = await axios.get("/system/getExpertsAndDatasets");
    try {
        experts.value = resData.data.data.experts;
        datasets.value = resData.data.data.datasets;
    } catch (error) {
        experts.value = [];
        datasets.value = [];
        emitter.emit("openSnackbar", { message: "取得專家與知識庫清單失敗。", color: "error" });
    }
}
getExpertsAndDatasets();

// 後台頁面設定
const pagePermissionKeys = [
    { key: "home", label: "首頁" },
    { key: "usermanage", label: "使用者管理" },
    { key: "systemsets", label: "系統設定" },
    { key: "experts", label: "專家" },
    { key: "datasets", label: "知識庫" },
    { key: "skills", label: "技能商店" },
    { key: "forms", label: "表單" },
    { key: "ava-gpt", label: "AVA-GPT" },
];

// 聊天室專家設定
const selectedChatExpert = ref(null);
const selectableChatExperts = computed(() => {
    const usedChatExperts = Object.keys(permissionSetting.value.chatExperts);
    const result = experts.value.filter((e) => !usedChatExperts.includes(e.id));
    return result || [];
});

function getExpertName(expertID) {
    const expert = experts.value.find((e) => e.id === expertID);
    return expert?.name || expertID;
}

function getDatasetName(datasetID) {
    const dataset = datasets.value.find((e) => e.id === datasetID);
    return dataset?.name || datasetID;
}

function addChatExpert() {
    permissionSetting.value.chatExperts[selectedChatExpert.value] = [];
    selectedChatExpert.value = null;
}

// 後台專家權限設定
const selectedExpert = ref(null);
const selectableExperts = computed(() => {
    const usedExperts = Object.keys(permissionSetting.value.experts);
    const result = experts.value.filter((e) => !usedExperts.includes(e.id));
    return result || [];
});

function addExpert() {
    permissionSetting.value.experts[selectedExpert.value] = [];
    selectedExpert.value = null;
}

// 後台知識庫權限設定
const selectedDataset = ref(null);
const selectableDataset = computed(() => {
    const usedDatasets = Object.keys(permissionSetting.value.datasets);
    const result = datasets.value.filter((e) => !usedDatasets.includes(e.id));
    return result || [];
});

function addDataset() {
    permissionSetting.value.datasets[selectedDataset.value] = [];
    selectedDataset.value = null;
}

// 建立功能設定
const actionPermissionKeys = [
    { key: "allowedToCreateExpert", label: "建立專家權限" },
    { key: "allowedToCreateDataset", label: "建立知識庫權限" },
    { key: "allowedToCreateAndCancelCrawler", label: "建立與取消爬蟲權限" },
    { key: "allowedToUploadDocument", label: "上傳文件權限" },
    { key: "allowedToDownloadCrawlerLog", label: "下載爬蟲LOG" },
    { key: "allowedToUseExpertConfiguration", label: "使用專家共用參數" },
    { key: "allowedToViewChangelog", label: "查看版本更新記錄" },
    { key: "allowedToUploadChangelog", label: "上傳版本更新記錄" },
];

// 儲存權限設定
async function savePermission(type) {
    const reqBody = {
        type: type,
        newValue: permissionSetting.value[type],
    };

    const rs = await axios.put("/system/updatePermissionSetting", btoa(JSON.stringify(reqBody)));

    // 如果成功，那就要重取設定表資料。
    if (rs && rs.data && rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "更新成功。", color: "success" });
        getPermissionSetting();
    } else {
        emitter.emit("openSnackbar", { message: "更新失敗。", color: "success" });
    }
}

// 還原到預設值
function resetPermission(type, target) {
    if (originPermissionSetting.value[type][target]) {
        permissionSetting.value[type][target] = [...originPermissionSetting.value[type][target]];
    } else {
        delete permissionSetting.value[type][target];
    }
}
function resetEntirePage(type) {
    permissionSetting.value[type] = JSON.parse(JSON.stringify(originPermissionSetting.value[type]));
}

// 添加&移除使用者
function addUser(type, target, users) {
    if (permissionSetting.value[type][target]) {
        permissionSetting.value[type][target].push(...users);
    } else {
        permissionSetting.value[type][target] = [];
        permissionSetting.value[type][target].push(...users);
    }
}

function addGroup(type, target, groups) {
    if (permissionSetting.value[type][target]) {
        permissionSetting.value[type][target].push(...groups);
    } else {
        permissionSetting.value[type][target] = [];
        permissionSetting.value[type][target].push(...groups);
    }
}

function deleteUser(type, target, index) {
    permissionSetting.value[type][target].splice(index, 1);
}

// 批量編輯權限
const selectedMultiUsers = ref([]);
const multiSettingData = ref({
    pagePermissions: [],
    actionPermissions: [],
    chatExperts: [],
    experts: [],
    datasets: [],
    skills: [],
});
const actionName = {
    allowedToCreateExpert: "建立專家",
    allowedToCreateDataset: "建立知識庫",
    allowedToCreateAndCancelCrawler: "建立與取消爬蟲",
    allowedToUploadDocument: "上傳文件",
    allowedToDownloadCrawlerLog: "下載爬蟲LOG",
    allowedToUseExpertConfiguration: "使用專家共用參數",
    allowedToViewChangelog: "查看版本更新記錄",
    allowedToUploadChangelog: "上傳版本更新記錄",
};

async function saveMultiPermission() {
    const reqBody = {
        users: selectedMultiUsers.value,
        settingTargets: multiSettingData.value,
    };
    const rs = await axios.put("/system/setMultiUsersPermission", btoa(JSON.stringify(reqBody)));

    // 如果成功，那就要重取設定表資料。
    if (rs && rs.data && rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "批量修改成功。", color: "success" });

        selectedMultiUsers.value = [];
        multiSettingData.value.pagePermissions = [];
        multiSettingData.value.actionPermissions = [];
        multiSettingData.value.chatExperts = [];
        multiSettingData.value.experts = [];
        multiSettingData.value.datasets = [];

        getPermissionSetting();
    } else {
        emitter.emit("openSnackbar", { message: "批量修改失敗。", color: "error" });
    }
}

// 確認視窗
const confirmElement = ref(null);
const confirmTitle = ref("確定要變更嗎 ?");
const confirmMsg = ref("變更後不可回覆，如要繼續請點擊確認。");
const confirmTarget = ref("");
function openConfirmDialog(target) {
    confirmTarget.value = target;
    confirmElement.value.open();
}
function confirmSave() {
    if (confirmTarget.value === "multi-users") {
        saveMultiPermission();
    } else {
        savePermission(confirmTarget.value);
    }
}

// 顯示使用者權限
const displayUser = ref(null);
const displayUserPermission = computed(() => {
    if (displayUser.value) {
        let permission = {
            pagePermissions: [],
            actionPermissions: [],
            chatExperts: [],
            experts: [],
            datasets: [],
            skills: [],
        };

        Object.entries(originPermissionSetting.value).forEach(([mainName, targets]) => {
            Object.entries(targets).forEach(([targetName, value]) => {
                const hasUser = value.includes(displayUser.value);
                if (hasUser) {
                    permission[mainName].push(targetName);
                }
            });
        });

        console.log("p", permission);

        return permission;
    } else {
        return {};
    }
});

// 顯示群組權限
const displayGroup = ref(null);
const displayGroupPermission = computed(() => {
    if (displayGroup.value) {
        let permission = {
            pagePermissions: [],
            actionPermissions: [],
            chatExperts: [],
            experts: [],
            datasets: [],
            skills: [],
        };

        Object.entries(originPermissionSetting.value).forEach(([mainName, targets]) => {
            Object.entries(targets).forEach(([targetName, value]) => {
                const hasGroup = value.includes(displayGroup.value);
                if (hasGroup) {
                    permission[mainName].push(targetName);
                }
            });
        });

        return permission;
    } else {
        return {};
    }
});

// 匯入使用者權限
function importUserSetting() {
    multiSettingData.value = JSON.parse(JSON.stringify(displayUserPermission.value));
}

// 匯入群組權限
function importGroupSetting() {
    multiSettingData.value = JSON.parse(JSON.stringify(displayGroupPermission.value));
}

// 偵測視窗寬度
const isLargeScreen = ref(window.innerWidth > 1280);
function updateWindowWidth() {
    isLargeScreen.value = window.innerWidth > 1280;
}
onMounted(() => {
    window.addEventListener("resize", updateWindowWidth);
});

onUnmounted(() => {
    window.removeEventListener("resize", updateWindowWidth);
});

const currentPage = ref(1);
const searchInput = ref("");

// 取得群組資料
const { data: groupList, refetch: refetchGroup } = useQuery({
    queryKey: ["groupList", "page"],
    queryFn: async () => {
        const response = await fetchAllGroups({ mode: "", page: currentPage.value, search: searchInput.value });
        return response;
    },
});

// 建立群組 mapping
const groupMapping = computed(() => {
    if (!groupList.value) return {};
    const mapping = {};
    if (Array.isArray(groupList.value)) {
        groupList.value.forEach((group) => {
            mapping[`#${group.groupId}`] = {
                name: group.groupName,
                id: group.groupId,
            };
        });
    }
    if (Array.isArray(groupList.value.groups)) {
        groupList.value.groups.forEach((group) => {
            mapping[`#${group.groupId}`] = {
                name: group.groupName,
                id: group.groupId,
            };
        });
    }
    return mapping;
});

const groups = computed(() => {
    if (!groupList.value) return [];
    if (Array.isArray(groupList.value)) {
        return groupList.value;
    }
    if (Array.isArray(groupList.value.groups)) {
        return groupList.value.groups;
    }
    return [];
});

const pagination = computed(() => {
    if (!groupList.value) return {};
    if (groupList.value.pagination) {
        return groupList.value.pagination;
    }
    return {};
});

const handleSearchInput = (input) => {
    searchInput.value = input;
    currentPage.value = 1;
    refetchGroup();
};

const handlePageChange = (page) => {
    currentPage.value = page;
    refetchGroup();
};

// 修改 UserChips 的顯示邏輯
function getUserOrGroupName(id) {
    if (id.startsWith("#")) {
        return groupMapping.value[id] ? `${groupMapping.value[id].name}(${groupMapping.value[id].id})` : id;
    }
    const user = userList.value?.find((u) => u.user_no === id);
    return user ? `${user.name}(${user.user_no})` : id;
}
</script>

<template>
    <div class="wrap">
        <v-tabs v-model="tab" bg-color="transparent" color="blue" grow>
            <v-tab v-for="item in tabList" :key="item" :text="item" :value="item"></v-tab>
        </v-tabs>

        <v-tabs-window v-model="tab">
            <v-tabs-window-item v-for="(item, index) in tabList" :key="item" :value="item">
                <v-card color="#F5F5F5" flat class="overflow-y-auto">
                    <v-card-text>
                        <div v-if="index === 0">
                            <p class="mb-3 text-center">後台頁面顯示設定 : 只有被指定的使用者可以進入該頁面。</p>
                            <div class="justify-center mb-3 d-flex align-center ga-3 sticky-controls">
                                <v-text-field
                                    clearable
                                    label="搜尋使用者"
                                    variant="outlined"
                                    max-width="150"
                                    hide-details
                                    density="compact"
                                    v-model="searchUser.input"
                                ></v-text-field>
                                <v-btn
                                    @click="openConfirmDialog('pagePermissions')"
                                    variant="tonal"
                                    prepend-icon="mdi-content-save-check"
                                    color="primary"
                                >
                                    儲存設定
                                </v-btn>
                                <v-btn
                                    @click="resetEntirePage('pagePermissions')"
                                    variant="tonal"
                                    prepend-icon="mdi-restore-alert"
                                >
                                    還原本頁設定
                                </v-btn>
                            </div>
                            <v-divider class="mb-6"></v-divider>
                            <div v-if="permissionSetting.pagePermissions">
                                <div
                                    v-for="page in pagePermissionKeys"
                                    :key="'page-' + page.key"
                                    class="single-setting-wrap"
                                >
                                    <div class="title-wrap">
                                        <p class="title">{{ page.label }}</p>
                                        <AddUser
                                            :userList="userList"
                                            :selectedUsers="permissionSetting.pagePermissions[page.key]"
                                            :originalUsers="originPermissionSetting.pagePermissions[page.key]"
                                            @addUser="(e) => addUser('pagePermissions', page.key, e)"
                                        />
                                        <AddGroup
                                            :selectedGroups="permissionSetting.pagePermissions[page.key]"
                                            :groupList="groups"
                                            :pagination="pagination"
                                            @addGroup="(e) => addGroup('pagePermissions', page.key, e)"
                                            @pageChange="handlePageChange"
                                            @searchInput="handleSearchInput"
                                        />
                                        <v-btn
                                            class="ml-auto"
                                            @click="resetPermission('pagePermissions', page.key)"
                                            variant="tonal"
                                            prepend-icon="mdi-cached"
                                        >
                                            還原設定
                                        </v-btn>
                                    </div>
                                    <UserChips
                                        :userList="userList"
                                        :users="userFilter(permissionSetting.pagePermissions[page.key])"
                                        :originalUsers="userFilter(originPermissionSetting.pagePermissions[page.key])"
                                        :groupMapping="groupMapping"
                                        @deleteUser="
                                            (user) =>
                                                (permissionSetting.pagePermissions[page.key] =
                                                    permissionSetting.pagePermissions[page.key].filter(
                                                        (u) => u !== user
                                                    ))
                                        "
                                        @restoreUser="(user) => permissionSetting.pagePermissions[page.key].push(user)"
                                    />
                                </div>
                            </div>
                        </div>
                        <div v-else-if="index === 1">
                            <p class="mb-6 text-center">
                                前台聊天室顯示設定 :
                                無設定值時代表所有使用者都能看見；有特別設定時只有指定使用者能看見。
                            </p>
                            <div class="mb-3 d-flex align-center ga-3 sticky-controls">
                                <v-select
                                    v-model="selectedChatExpert"
                                    :items="selectableChatExperts"
                                    item-title="name"
                                    item-value="id"
                                    label="選擇想要新增的聊天室"
                                    filterable
                                    max-width="300"
                                    hide-details
                                ></v-select>
                                <v-btn
                                    @click="addChatExpert()"
                                    variant="tonal"
                                    prepend-icon="mdi-arrow-down-bold-circle-outline"
                                    color="primary"
                                    :disabled="!selectedChatExpert"
                                >
                                    新增聊天室權限設定
                                </v-btn>
                                <v-text-field
                                    class="ml-auto"
                                    clearable
                                    label="搜尋使用者"
                                    variant="outlined"
                                    max-width="150"
                                    hide-details
                                    density="compact"
                                    v-model="searchUser.input"
                                ></v-text-field>
                                <v-btn
                                    @click="openConfirmDialog('chatExperts')"
                                    variant="tonal"
                                    prepend-icon="mdi-content-save-check"
                                    color="primary"
                                >
                                    儲存設定
                                </v-btn>
                                <v-btn
                                    @click="resetEntirePage('chatExperts')"
                                    variant="tonal"
                                    prepend-icon="mdi-restore-alert"
                                >
                                    還原本頁設定
                                </v-btn>
                            </div>
                            <v-divider class="mb-6"></v-divider>
                            <div v-if="permissionSetting.chatExperts">
                                <div
                                    v-for="(expertID, index) in Object.keys(permissionSetting.chatExperts)"
                                    :key="'chat-expert-' + expertID"
                                    class="single-setting-wrap"
                                >
                                    <div class="title-wrap">
                                        <p class="title">{{ getExpertName(expertID) }}</p>
                                        <AddUser
                                            :userList="userList"
                                            :selectedUsers="permissionSetting.chatExperts[expertID]"
                                            :originalUsers="originPermissionSetting.chatExperts[expertID]"
                                            @addUser="(e) => addUser('chatExperts', expertID, e)"
                                        />
                                        <AddGroup
                                            :selectedGroups="permissionSetting.chatExperts[expertID]"
                                            :groupList="groups"
                                            :pagination="pagination"
                                            @addGroup="(e) => addGroup('chatExperts', expertID, e)"
                                            @pageChange="handlePageChange"
                                            @searchInput="handleSearchInput"
                                        />

                                        <v-btn
                                            @click="resetPermission('chatExperts', expertID)"
                                            variant="tonal"
                                            prepend-icon="mdi-cached"
                                        >
                                            還原設定
                                        </v-btn>
                                        <v-btn
                                            class="ml-auto"
                                            @click="delete permissionSetting.chatExperts[expertID]"
                                            color="error"
                                            variant="tonal"
                                            prepend-icon="mdi-delete-circle-outline"
                                        >
                                            移除設定
                                        </v-btn>
                                    </div>
                                    <UserChips
                                        :userList="userList"
                                        :users="userFilter(permissionSetting.chatExperts[expertID])"
                                        :originalUsers="userFilter(originPermissionSetting.chatExperts[expertID])"
                                        :groupMapping="groupMapping"
                                        @deleteUser="
                                            (user) =>
                                                (permissionSetting.chatExperts[expertID] =
                                                    permissionSetting.chatExperts[expertID].filter((u) => u !== user))
                                        "
                                        @restoreUser="(user) => permissionSetting.chatExperts[expertID].push(user)"
                                    />
                                </div>
                            </div>
                        </div>
                        <div v-else-if="index === 2">
                            <p class="mb-6 text-center">
                                後台專家權限設定 :
                                無設定值時代表所有使用者都能編輯該專家；有特別設定時只有被指定的使用者能看見與編輯。
                            </p>
                            <div class="mb-3 d-flex align-center ga-3 sticky-controls">
                                <v-select
                                    v-model="selectedExpert"
                                    :items="selectableExperts"
                                    item-title="name"
                                    item-value="id"
                                    label="選擇想要新增的專家"
                                    filterable
                                    max-width="300"
                                    hide-details
                                ></v-select>
                                <v-btn
                                    @click="addExpert()"
                                    variant="tonal"
                                    prepend-icon="mdi-arrow-down-bold-circle-outline"
                                    color="primary"
                                    :disabled="!selectedExpert"
                                >
                                    新增專家權限設定
                                </v-btn>
                                <v-text-field
                                    class="ml-auto"
                                    clearable
                                    label="搜尋使用者"
                                    variant="outlined"
                                    max-width="150"
                                    hide-details
                                    density="compact"
                                    v-model="searchUser.input"
                                ></v-text-field>
                                <v-btn
                                    @click="openConfirmDialog('experts')"
                                    variant="tonal"
                                    prepend-icon="mdi-content-save-check"
                                    color="primary"
                                >
                                    儲存設定
                                </v-btn>
                                <v-btn
                                    @click="resetEntirePage('experts')"
                                    variant="tonal"
                                    prepend-icon="mdi-restore-alert"
                                >
                                    還原本頁設定
                                </v-btn>
                            </div>
                            <v-divider class="mb-6"></v-divider>
                            <div v-if="permissionSetting.experts">
                                <div
                                    v-for="(expertID, index) in Object.keys(permissionSetting.experts)"
                                    :key="'expert-' + expertID"
                                    class="single-setting-wrap"
                                >
                                    <div class="title-wrap">
                                        <p class="title">{{ getExpertName(expertID) }}</p>
                                        <AddUser
                                            :userList="userList"
                                            :selectedUsers="permissionSetting.experts[expertID]"
                                            :originalUsers="originPermissionSetting.experts[expertID]"
                                            @addUser="(e) => addUser('experts', expertID, e)"
                                        />
                                        <AddGroup
                                            :selectedGroups="permissionSetting.experts[expertID]"
                                            :groupList="groups"
                                            :pagination="pagination"
                                            @addGroup="(e) => addGroup('experts', expertID, e)"
                                            @pageChange="handlePageChange"
                                            @searchInput="handleSearchInput"
                                        />
                                        <v-btn
                                            @click="resetPermission('experts', expertID)"
                                            variant="tonal"
                                            prepend-icon="mdi-cached"
                                        >
                                            還原設定
                                        </v-btn>
                                        <v-btn
                                            class="ml-auto"
                                            @click="delete permissionSetting.experts[expertID]"
                                            color="error"
                                            variant="tonal"
                                            prepend-icon="mdi-delete-circle-outline"
                                        >
                                            移除設定
                                        </v-btn>
                                    </div>
                                    <UserChips
                                        :userList="userList"
                                        :users="userFilter(permissionSetting.experts[expertID])"
                                        :originalUsers="userFilter(originPermissionSetting.experts[expertID])"
                                        :groupMapping="groupMapping"
                                        @deleteUser="
                                            (user) =>
                                                (permissionSetting.experts[expertID] = permissionSetting.experts[
                                                    expertID
                                                ].filter((u) => u !== user))
                                        "
                                        @restoreUser="(user) => permissionSetting.experts[expertID].push(user)"
                                    />
                                </div>
                            </div>
                        </div>
                        <div v-else-if="index === 3">
                            <p class="mb-6 text-center">
                                後台知識庫權限設定 :
                                無設定值時代表所有使用者都能看到該知識庫；有特別設定時只有被指定的使用者能看見該知識庫。
                            </p>
                            <div class="mb-3 d-flex align-center ga-3 sticky-controls">
                                <v-select
                                    v-model="selectedDataset"
                                    :items="selectableDataset"
                                    item-title="name"
                                    item-value="id"
                                    label="選擇想要新增的知識庫"
                                    filterable
                                    max-width="300"
                                    hide-details
                                ></v-select>
                                <v-btn
                                    @click="addDataset()"
                                    variant="tonal"
                                    prepend-icon="mdi-arrow-down-bold-circle-outline"
                                    color="primary"
                                    :disabled="!selectedDataset"
                                >
                                    新增知識庫權限設定
                                </v-btn>
                                <v-text-field
                                    class="ml-auto"
                                    clearable
                                    label="搜尋使用者"
                                    variant="outlined"
                                    max-width="150"
                                    hide-details
                                    density="compact"
                                    v-model="searchUser.input"
                                ></v-text-field>
                                <v-btn
                                    @click="openConfirmDialog('datasets')"
                                    variant="tonal"
                                    prepend-icon="mdi-content-save-check"
                                    color="primary"
                                >
                                    儲存設定
                                </v-btn>
                                <v-btn
                                    @click="resetEntirePage('datasets')"
                                    variant="tonal"
                                    prepend-icon="mdi-restore-alert"
                                >
                                    還原本頁設定
                                </v-btn>
                            </div>
                            <v-divider class="mb-6"></v-divider>
                            <div v-if="permissionSetting.datasets">
                                <div
                                    v-for="(datasetID, index) in Object.keys(permissionSetting.datasets)"
                                    :key="'dataset-' + datasetID"
                                    class="single-setting-wrap"
                                >
                                    <div class="title-wrap">
                                        <p class="title">{{ getDatasetName(datasetID) }}</p>
                                        <AddUser
                                            :userList="userList"
                                            :selectedUsers="permissionSetting.datasets[datasetID]"
                                            :originalUsers="originPermissionSetting.datasets[datasetID]"
                                            @addUser="(e) => addUser('datasets', datasetID, e)"
                                        />
                                        <AddGroup
                                            :selectedGroups="permissionSetting.datasets[datasetID]"
                                            :groupList="groups"
                                            :pagination="pagination"
                                            @addGroup="(e) => addGroup('datasets', datasetID, e)"
                                            @pageChange="handlePageChange"
                                            @searchInput="handleSearchInput"
                                        />
                                        <v-btn
                                            @click="resetPermission('datasets', datasetID)"
                                            variant="tonal"
                                            prepend-icon="mdi-cached"
                                        >
                                            還原設定
                                        </v-btn>
                                        <v-btn
                                            class="ml-auto"
                                            @click="delete permissionSetting.datasets[datasetID]"
                                            color="error"
                                            variant="tonal"
                                            prepend-icon="mdi-delete-circle-outline"
                                        >
                                            移除設定
                                        </v-btn>
                                    </div>
                                    <UserChips
                                        :userList="userList"
                                        :users="userFilter(permissionSetting.datasets[datasetID])"
                                        :originalUsers="userFilter(originPermissionSetting.datasets[datasetID])"
                                        :groupMapping="groupMapping"
                                        @deleteUser="
                                            (user) =>
                                                (permissionSetting.datasets[datasetID] = permissionSetting.datasets[
                                                    datasetID
                                                ].filter((u) => u !== user))
                                        "
                                        @restoreUser="(user) => permissionSetting.datasets[datasetID].push(user)"
                                    />
                                </div>
                            </div>
                        </div>
                        <div v-else-if="index === 4">
                            <p class="mb-3 text-center">新增、刪除專家/知識庫與爬蟲。</p>
                            <div class="justify-center mb-3 d-flex align-center ga-3 sticky-controls">
                                <v-text-field
                                    clearable
                                    label="搜尋使用者"
                                    variant="outlined"
                                    max-width="150"
                                    hide-details
                                    density="compact"
                                    v-model="searchUser.input"
                                ></v-text-field>
                                <v-btn
                                    @click="openConfirmDialog('actionPermissions')"
                                    variant="tonal"
                                    prepend-icon="mdi-content-save-check"
                                    color="primary"
                                >
                                    儲存設定
                                </v-btn>
                                <v-btn
                                    @click="resetEntirePage('actionPermissions')"
                                    variant="tonal"
                                    prepend-icon="mdi-restore-alert"
                                >
                                    還原本頁設定
                                </v-btn>
                            </div>
                            <v-divider class="mb-6"></v-divider>
                            <div v-if="permissionSetting.actionPermissions">
                                <!-- 新嘗試 -->
                                <div
                                    v-for="action in actionPermissionKeys"
                                    :key="'action-' + action"
                                    class="single-setting-wrap"
                                >
                                    <div class="title-wrap">
                                        <p class="title">{{ action.label }}</p>
                                        <AddUser
                                            :userList="userList"
                                            :selectedUsers="permissionSetting.actionPermissions[action.key]"
                                            :originalUsers="originPermissionSetting.actionPermissions[action.key]"
                                            @addUser="(e) => addUser('actionPermissions', action.key, e)"
                                        />
                                        <AddGroup
                                            :selectedGroups="permissionSetting.actionPermissions[action.key]"
                                            :groupList="groups"
                                            :pagination="pagination"
                                            @addGroup="(e) => addGroup('actionPermissions', action.key, e)"
                                            @pageChange="handlePageChange"
                                            @searchInput="handleSearchInput"
                                        />
                                        <v-btn
                                            class="ml-auto"
                                            @click="resetPermission('actionPermissions', action.key)"
                                            variant="tonal"
                                            prepend-icon="mdi-cached"
                                        >
                                            還原設定
                                        </v-btn>
                                    </div>
                                    <UserChips
                                        :userList="userList"
                                        :users="userFilter(permissionSetting.actionPermissions[action.key])"
                                        :originalUsers="
                                            userFilter(originPermissionSetting.actionPermissions[action.key])
                                        "
                                        :groupMapping="groupMapping"
                                        @deleteUser="
                                            (user) =>
                                                (permissionSetting.actionPermissions[action.key] =
                                                    permissionSetting.actionPermissions[action.key].filter(
                                                        (u) => u !== user
                                                    ))
                                        "
                                        @restoreUser="
                                            (user) => permissionSetting.actionPermissions[action.key].push(user)
                                        "
                                    />
                                </div>
                            </div>
                        </div>
                        <div v-else-if="index === 5">
                            <p class="mb-3 text-center">批量選擇使用者/群組並修改權限</p>
                            <div class="sticky-controls">
                                <AddUser
                                    :userList="userList"
                                    :selectedUsers="selectedMultiUsers"
                                    :selectionMode="true"
                                    @addUser="(e) => selectedMultiUsers.push(...e)"
                                />

                                <AddGroup
                                    :groupList="groups"
                                    :pagination="pagination"
                                    :selectedGroups="selectedMultiUsers"
                                    :selectionMode="true"
                                    @addGroup="(e) => selectedMultiUsers.push(...e)"
                                    @pageChange="handlePageChange"
                                    @searchInput="handleSearchInput"
                                />
                                <v-btn
                                    class="ml-6"
                                    @click="openConfirmDialog('multi-users')"
                                    variant="tonal"
                                    prepend-icon="mdi-content-save-check"
                                    color="primary"
                                    :disabled="selectedMultiUsers.length === 0"
                                >
                                    儲存批量設定
                                </v-btn>
                            </div>
                            <v-divider :thickness="20" class="border-opacity-0"></v-divider>
                            <UserChips
                                :selectUserMode="true"
                                :userList="userList"
                                :users="selectedMultiUsers"
                                :originalUsers="[]"
                                :groupMapping="groupMapping"
                                @deleteUser="
                                    (user) => {
                                        selectedMultiUsers = selectedMultiUsers.filter((u) => u !== user);
                                    }
                                "
                                @getUserPermission="(user) => (displayUser = user)"
                            />
                            <v-row class="mt-3">
                                <v-col :cols="isLargeScreen ? '6' : '12'" class="multi-setting-left">
                                    <div class="multi-permission-setting-wrap">
                                        <p class="multi-setting-subtitle">批量權限設置</p>
                                        <!-- 後台頁面 -->
                                        <div>
                                            <p>後台頁面權限</p>
                                            <div class="flex-wrap d-flex">
                                                <v-checkbox
                                                    v-for="page in pagePermissionKeys"
                                                    :key="'page-' + page.key"
                                                    v-model="multiSettingData.pagePermissions"
                                                    :label="page.label"
                                                    :value="page.key"
                                                    hide-details
                                                ></v-checkbox>
                                            </div>
                                        </div>
                                        <!-- 前台聊天室 -->
                                        <div class="mt-6">
                                            <p>前台聊天室</p>
                                            <v-expansion-panels>
                                                <v-expansion-panel>
                                                    <v-expansion-panel-title>
                                                        <template v-slot:default="{ expanded }">
                                                            <v-row no-gutters>
                                                                <v-col class="justify-start d-flex" cols="6">
                                                                    目前已選
                                                                    {{ multiSettingData.chatExperts.length }} 個聊天室
                                                                </v-col>
                                                                <v-col class="text-grey" cols="6">
                                                                    <v-fade-transition leave-absolute>
                                                                        <span v-if="expanded" key="0">
                                                                            請挑選要開通的前台聊天室
                                                                        </span>
                                                                        <span v-else key="1"> 點擊展開 </span>
                                                                    </v-fade-transition>
                                                                </v-col>
                                                            </v-row>
                                                        </template>
                                                    </v-expansion-panel-title>
                                                    <v-expansion-panel-text>
                                                        <v-row>
                                                            <v-col
                                                                cols="6"
                                                                md="4"
                                                                lg="3"
                                                                v-for="expert in experts"
                                                                :key="'expert-' + expert.id"
                                                            >
                                                                <v-checkbox
                                                                    v-model="multiSettingData.chatExperts"
                                                                    :label="expert.name"
                                                                    :value="expert.id"
                                                                    density="compact"
                                                                    hide-details
                                                                ></v-checkbox>
                                                            </v-col>
                                                        </v-row>
                                                    </v-expansion-panel-text>
                                                </v-expansion-panel>
                                            </v-expansion-panels>
                                        </div>
                                        <!-- 專家 -->
                                        <div class="mt-6">
                                            <p>專家</p>
                                            <v-expansion-panels>
                                                <v-expansion-panel>
                                                    <v-expansion-panel-title>
                                                        <template v-slot:default="{ expanded }">
                                                            <v-row no-gutters>
                                                                <v-col class="justify-start d-flex" cols="6">
                                                                    目前已選
                                                                    {{ multiSettingData.experts.length }} 個專家
                                                                </v-col>
                                                                <v-col class="text-grey" cols="6">
                                                                    <v-fade-transition leave-absolute>
                                                                        <span v-if="expanded" key="0">
                                                                            請挑選要開通的專家
                                                                        </span>
                                                                        <span v-else key="1"> 點擊展開 </span>
                                                                    </v-fade-transition>
                                                                </v-col>
                                                            </v-row>
                                                        </template>
                                                    </v-expansion-panel-title>
                                                    <v-expansion-panel-text>
                                                        <v-row>
                                                            <v-col
                                                                cols="6"
                                                                md="4"
                                                                lg="3"
                                                                v-for="expert in experts"
                                                                :key="'expert-' + expert.id"
                                                            >
                                                                <v-checkbox
                                                                    v-model="multiSettingData.experts"
                                                                    :label="expert.name"
                                                                    :value="expert.id"
                                                                    density="compact"
                                                                    hide-details
                                                                ></v-checkbox>
                                                            </v-col>
                                                        </v-row>
                                                    </v-expansion-panel-text>
                                                </v-expansion-panel>
                                            </v-expansion-panels>
                                        </div>
                                        <!-- 知識庫 -->
                                        <div class="mt-6">
                                            <p>知識庫</p>
                                            <v-expansion-panels>
                                                <v-expansion-panel>
                                                    <v-expansion-panel-title>
                                                        <template v-slot:default="{ expanded }">
                                                            <v-row no-gutters>
                                                                <v-col class="justify-start d-flex" cols="6">
                                                                    目前已選
                                                                    {{ multiSettingData.datasets.length }} 個知識庫
                                                                </v-col>
                                                                <v-col class="text-grey" cols="6">
                                                                    <v-fade-transition leave-absolute>
                                                                        <span v-if="expanded" key="0">
                                                                            請挑選要開通的知識庫
                                                                        </span>
                                                                        <span v-else key="1"> 點擊展開 </span>
                                                                    </v-fade-transition>
                                                                </v-col>
                                                            </v-row>
                                                        </template>
                                                    </v-expansion-panel-title>
                                                    <v-expansion-panel-text>
                                                        <v-row>
                                                            <v-col
                                                                cols="6"
                                                                md="4"
                                                                lg="3"
                                                                v-for="dataset in datasets"
                                                                :key="'dataset-' + dataset.id"
                                                            >
                                                                <v-checkbox
                                                                    v-model="multiSettingData.datasets"
                                                                    :label="dataset.name"
                                                                    :value="dataset.id"
                                                                    density="compact"
                                                                    hide-details
                                                                ></v-checkbox>
                                                            </v-col>
                                                        </v-row>
                                                    </v-expansion-panel-text>
                                                </v-expansion-panel>
                                            </v-expansion-panels>
                                        </div>
                                        <!-- 建立功能 -->
                                        <div class="mt-6">
                                            <p>建立功能</p>
                                            <div class="flex-wrap d-flex">
                                                <v-checkbox
                                                    v-for="action in Object.keys(actionName)"
                                                    :key="'action-' + action"
                                                    v-model="multiSettingData.actionPermissions"
                                                    :label="actionName[action]"
                                                    :value="action"
                                                    hide-details
                                                ></v-checkbox>
                                            </div>
                                        </div>
                                    </div>
                                </v-col>
                                <v-col :cols="isLargeScreen ? '6' : '12'" class="multi-setting-right">
                                    <v-btn
                                        class="import-btn"
                                        :prepend-icon="isLargeScreen ? 'mdi-arrow-left-thick' : 'mdi-arrow-up-bold'"
                                        color="primary"
                                        variant="tonal"
                                        @click="importUserSetting"
                                        :disabled="!displayUser"
                                    >
                                        匯入
                                        <v-tooltip activator="parent" location="top">套用使用者權限設定</v-tooltip>
                                    </v-btn>

                                    <div class="relative multi-permission-setting-wrap">
                                        <p class="multi-setting-subtitle">使用者權限預覽</p>
                                        <!-- 後台頁面 -->
                                        <div v-if="displayUserPermission.pagePermissions">
                                            <p>後台頁面權限</p>
                                            <div class="flex-wrap d-flex">
                                                <v-checkbox
                                                    v-for="page in pagePermissionKeys"
                                                    :key="'page-' + page.key"
                                                    :model-value="
                                                        displayUserPermission.pagePermissions.includes(page.key)
                                                    "
                                                    :label="page.label"
                                                    hide-details
                                                    readonly
                                                    disabled
                                                ></v-checkbox>
                                            </div>
                                        </div>
                                        <!-- 前台聊天室 -->
                                        <div v-if="displayUserPermission.chatExperts" class="mt-6">
                                            <p>前台聊天室</p>
                                            <v-expansion-panels>
                                                <v-expansion-panel>
                                                    <v-expansion-panel-title>
                                                        <template v-slot:default="{ expanded }">
                                                            <v-row no-gutters>
                                                                <v-col class="justify-start d-flex" cols="6">
                                                                    目前已選
                                                                    {{ displayUserPermission.chatExperts.length }}
                                                                    個聊天室
                                                                </v-col>
                                                                <v-col class="text-grey" cols="6">
                                                                    <v-fade-transition leave-absolute>
                                                                        <span v-if="expanded" key="0"> 點擊收闔 </span>
                                                                        <span v-else key="1"> 點擊展開 </span>
                                                                    </v-fade-transition>
                                                                </v-col>
                                                            </v-row>
                                                        </template>
                                                    </v-expansion-panel-title>
                                                    <v-expansion-panel-text>
                                                        <v-row>
                                                            <v-col
                                                                cols="6"
                                                                md="4"
                                                                lg="3"
                                                                v-for="expertID in displayUserPermission.chatExperts"
                                                                :key="'expert-' + expertID"
                                                            >
                                                                <v-checkbox
                                                                    :model-value="true"
                                                                    :label="getUserOrGroupName(expertID)"
                                                                    density="compact"
                                                                    readonly
                                                                    color="success"
                                                                    hide-details
                                                                    disabled
                                                                ></v-checkbox>
                                                            </v-col>
                                                        </v-row>
                                                    </v-expansion-panel-text>
                                                </v-expansion-panel>
                                            </v-expansion-panels>
                                        </div>
                                        <!-- 專家 -->
                                        <div v-if="displayUserPermission.experts" class="mt-6">
                                            <p>專家</p>
                                            <v-expansion-panels>
                                                <v-expansion-panel>
                                                    <v-expansion-panel-title>
                                                        <template v-slot:default="{ expanded }">
                                                            <v-row no-gutters>
                                                                <v-col class="justify-start d-flex" cols="6">
                                                                    目前已選
                                                                    {{ displayUserPermission.experts.length }} 個專家
                                                                </v-col>
                                                                <v-col class="text-grey" cols="6">
                                                                    <v-fade-transition leave-absolute>
                                                                        <span v-if="expanded" key="0"> 點擊收闔 </span>
                                                                        <span v-else key="1"> 點擊展開 </span>
                                                                    </v-fade-transition>
                                                                </v-col>
                                                            </v-row>
                                                        </template>
                                                    </v-expansion-panel-title>
                                                    <v-expansion-panel-text>
                                                        <v-row>
                                                            <v-col
                                                                cols="6"
                                                                md="4"
                                                                lg="3"
                                                                v-for="expertID in displayUserPermission.experts"
                                                                :key="'expert-' + expertID"
                                                            >
                                                                <v-checkbox
                                                                    :model-value="true"
                                                                    :label="getUserOrGroupName(expertID)"
                                                                    density="compact"
                                                                    readonly
                                                                    color="success"
                                                                    hide-details
                                                                    disabled
                                                                ></v-checkbox>
                                                            </v-col>
                                                        </v-row>
                                                    </v-expansion-panel-text>
                                                </v-expansion-panel>
                                            </v-expansion-panels>
                                        </div>
                                        <!-- 知識庫 -->
                                        <div v-if="displayUserPermission.datasets" class="mt-6">
                                            <p>知識庫</p>
                                            <v-expansion-panels>
                                                <v-expansion-panel>
                                                    <v-expansion-panel-title>
                                                        <template v-slot:default="{ expanded }">
                                                            <v-row no-gutters>
                                                                <v-col class="justify-start d-flex" cols="6">
                                                                    目前已選
                                                                    {{ displayUserPermission.datasets.length }} 個知識庫
                                                                </v-col>
                                                                <v-col class="text-grey" cols="6">
                                                                    <v-fade-transition leave-absolute>
                                                                        <span v-if="expanded" key="0"> 點擊收闔 </span>
                                                                        <span v-else key="1"> 點擊展開 </span>
                                                                    </v-fade-transition>
                                                                </v-col>
                                                            </v-row>
                                                        </template>
                                                    </v-expansion-panel-title>
                                                    <v-expansion-panel-text>
                                                        <v-row>
                                                            <v-col
                                                                cols="6"
                                                                md="4"
                                                                lg="3"
                                                                v-for="datasetID in displayUserPermission.datasets"
                                                                :key="'dataset-' + datasetID"
                                                            >
                                                                <v-checkbox
                                                                    :model-value="true"
                                                                    :label="getUserOrGroupName(datasetID)"
                                                                    density="compact"
                                                                    readonly
                                                                    color="success"
                                                                    hide-details
                                                                    disabled
                                                                ></v-checkbox>
                                                            </v-col>
                                                        </v-row>
                                                    </v-expansion-panel-text>
                                                </v-expansion-panel>
                                            </v-expansion-panels>
                                        </div>
                                        <!-- 建立功能 -->
                                        <div v-if="displayUserPermission.actionPermissions" class="mt-6">
                                            <p>建立功能</p>
                                            <div class="flex-wrap d-flex">
                                                <v-checkbox
                                                    v-for="action in Object.keys(actionName)"
                                                    :key="'action-' + action"
                                                    :model-value="
                                                        displayUserPermission.actionPermissions.includes(action)
                                                    "
                                                    :label="actionName[action]"
                                                    hide-details
                                                    readonly
                                                    color="success"
                                                    disabled
                                                ></v-checkbox>
                                            </div>
                                        </div>
                                        <div
                                            v-if="Object.entries(displayUserPermission).length === 0"
                                            class="mt-12 text-center"
                                        >
                                            請選擇一個使用者
                                        </div>
                                    </div>
                                </v-col>
                            </v-row>
                        </div>
                    </v-card-text>
                </v-card>
            </v-tabs-window-item>
        </v-tabs-window>
    </div>
    <ConfirmComponents
        ref="confirmElement"
        type="warning"
        :title="confirmTitle"
        :message="confirmMsg"
        :confirmBtn="true"
        @confirm="confirmSave()"
        saveBtnName="確認"
        closeBtnName="取消"
    ></ConfirmComponents>
</template>

<style lang="scss" scoped>
.wrap {
    padding: 12px;
    background: white;
}

.title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.title {
    font-size: 1.3rem;
    font-weight: 700;
}

.user-box {
    background: white;
    border: 1px solid rgb(200, 200, 200);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.user-chip {
    padding: 6px 12px;
    background: #bbdefb;
    border-radius: 12px;
    position: relative;
}

.user-chip-delete {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 20px;
    aspect-ratio: 1/1;
    border-radius: 50%;
    background: black;
    position: absolute;
    top: 0;
    right: 0;
    transform: translate(40%, -40%);
    cursor: pointer;
}

.single-setting-wrap {
    margin-bottom: 28px;
}

.multi-setting-left {
    padding-right: 60px;
    @media (max-width: 1280px) {
        padding: 12px; // v-col 的預設 padding
        padding-bottom: 30px;
    }
}

.multi-setting-right {
    position: relative;
    padding-left: 60px;
    @media (max-width: 1280px) {
        padding: 12px; // v-col 的預設 padding
        padding-top: 30px;
    }

    .import-btn {
        position: absolute;
        z-index: 1;
        left: -44px;
        top: 50%;
        transform: translateY(-50%);
        @media (max-width: 1280px) {
            left: 50%;
            top: 0;
            transform: translate(-50%, -50%);
        }
    }
}

.multi-permission-setting-wrap {
    background: white;
    padding: 12px;
    border-radius: 10px;
    border: 2px solid #8080804a;
    height: 100%;
    position: relative;
    overflow: hidden;
}

.multi-setting-subtitle {
    margin-top: 12px;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 700;
    color: gray;
    text-decoration: underline;
    text-underline-offset: 4px;
}

.sticky-controls {
    position: sticky;
    top: -16px;
    background-color: #f5f5f5;
    z-index: 100;
    padding: 16px 0;
}

.v-card-text {
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    position: relative;
}

.sticky-controls::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #f5f5f5;
    z-index: -1;
}
</style>
