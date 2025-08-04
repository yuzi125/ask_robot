<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

const props = defineProps({
    userList: {
        type: Array,
        default: () => [],
    },
    selectedUsers: {
        type: Array,
        default: () => [],
    },
    selectionMode: {
        type: Boolean,
        default: false,
    },
    originalUsers: {
        type: Array,
        default: () => [],
    },
});

const isActive = ref(false);
const parentRef = ref(null);
const rowVirtualizer = ref(null);
const isVirtualizerEnabled = ref(true);

const displayUsers = computed(() => {
    if (!props.selectedUsers || props.selectedUsers.length === 0) {
        const notOriginalUsers = props.userList.filter((e) => !props.originalUsers?.includes(e.user_no));
        return filterUsers(notOriginalUsers);
    }
    const notSelectedUsers = props.userList.filter(
        (e) => !props.selectedUsers.includes(e.user_no) && !props.originalUsers?.includes(e.user_no)
    );
    return filterUsers(notSelectedUsers);
});

function filterUsers(users) {
    return users.filter((user) => {
        if (!searchInput.value) return true;
        return user.name.match(searchInput.value) || user.user_no.match(searchInput.value);
    });
}

const addUserList = ref([]);
function clickUser(user) {
    if (addUserList.value.find((e) => e.user_no === user.user_no)) {
        const index = addUserList.value.indexOf(user);
        addUserList.value.splice(index, 1);
    } else {
        addUserList.value.push(user);
    }
}

const emits = defineEmits(["addUser"]);
function sendNewUsers() {
    const list = addUserList.value.map((e) => e.user_no);
    emits("addUser", list);
    addUserList.value = [];
    searchInput.value = "";
    isActive.value = false;
}

const searchInput = ref("");

function handleClear() {
    searchInput.value = "";
    if (rowVirtualizer.value) {
        rowVirtualizer.value.value.measure();
    }
}

function initializeVirtualizer() {
    rowVirtualizer.value = useVirtualizer({
        count: displayUsers.value.length,
        getScrollElement: () => parentRef.value,
        estimateSize: () => 55,
        enabled: isVirtualizerEnabled.value,
    });
}

onMounted(() => {
    initializeVirtualizer();
});

watch(
    [displayUsers, searchInput],
    async ([newDisplayUsers]) => {
        if (!rowVirtualizer.value) return;

        // 暫時禁用 virtualizer
        isVirtualizerEnabled.value = false;

        // 更新 count 和其他選項
        rowVirtualizer.value = useVirtualizer({
            count: newDisplayUsers.length,
            getScrollElement: () => parentRef.value,
            estimateSize: () => 55,
            enabled: true,
        });

        // 重新啟用
        isVirtualizerEnabled.value = true;
    },
    { deep: true }
);

const virtualRows = computed(() => {
    if (!rowVirtualizer.value || !displayUsers.value.length) return [];
    return rowVirtualizer.value.value.getVirtualItems().filter((row) => row.index < displayUsers.value.length);
});

const totalSize = computed(() => {
    if (!rowVirtualizer.value || !displayUsers.value.length) return 0;
    return rowVirtualizer.value.value.getTotalSize();
});

onBeforeUnmount(() => {
    rowVirtualizer.value = null;
});
</script>

<template>
    <v-btn color="success" @click="isActive = true" variant="tonal" prepend-icon="mdi-account-plus-outline">
        {{ props.selectionMode ? "選擇使用者" : "新增使用者" }}
    </v-btn>

    <v-dialog v-model="isActive" max-width="600">
        <v-card prepend-icon="mdi-account-plus-outline" title="選擇使用者">
            <v-card-text>
                <p class="mb-3 title">已選擇使用者 :</p>
                <div class="select-area">
                    <div class="selected-user-chip" v-for="(user, index) in addUserList" :key="'user' + user.user_no">
                        {{ user.name }}
                        <div @click="addUserList.splice(index, 1)" id="activator-target" class="user-chip-delete">
                            <i class="fa-solid fa-xmark" style="color: #ffffff"></i>
                        </div>
                    </div>
                    <p v-if="addUserList.length == 0">尚未選取使用者</p>
                </div>
                <div class="mb-3 justify-space-between d-flex align-center">
                    <p class="title">可選使用者 :</p>
                    <v-text-field
                        clearable
                        @click:clear="handleClear"
                        label="搜尋名稱或工號"
                        variant="outlined"
                        max-width="250"
                        hide-details
                        density="compact"
                        v-model="searchInput"
                    ></v-text-field>
                </div>
                <div ref="parentRef" class="select-area virtual-list" style="height: 400px; overflow: auto">
                    <div
                        v-if="rowVirtualizer"
                        :style="{
                            height: `${totalSize}px`,
                            width: '100%',
                            position: 'relative',
                        }"
                    >
                        <div
                            v-for="virtualRow in virtualRows"
                            :key="virtualRow.key"
                            :style="{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                            }"
                        >
                            <div
                                v-if="displayUsers[virtualRow.index]"
                                @click="clickUser(displayUsers[virtualRow.index])"
                                :class="[
                                    'user-chip',
                                    addUserList.includes(displayUsers[virtualRow.index]) ? 'active-chip' : '',
                                ]"
                            >
                                {{
                                    `${displayUsers[virtualRow.index].name}(${displayUsers[virtualRow.index].user_no})`
                                }}
                            </div>
                        </div>
                    </div>
                    <p v-if="displayUsers.length == 0">無可選使用者</p>
                </div>
            </v-card-text>
            <template v-slot:actions>
                <div class="ml-auto">
                    <v-btn color="grey darken-1" @click="isActive = false"> 關閉 </v-btn>
                    <v-btn
                        :disabled="addUserList.length == 0"
                        variant="text"
                        color="success"
                        text="加入"
                        @click="sendNewUsers()"
                    ></v-btn>
                </div>
            </template>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.select-area {
    border: 1px solid gray;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
    max-height: 400px;
    overflow-y: auto;
}

.virtual-list {
    overflow-y: auto;
    overflow-x: hidden;
    contain: strict;
}

.user-chip {
    padding: 6px 12px;
    background: #bbdefb;
    border-radius: 12px;
    cursor: pointer;
}

.selected-user-chip {
    padding: 6px 12px;
    background: #e8f5e9;
    border-radius: 12px;
    position: relative;
    cursor: pointer;
}

.active-chip {
    background: #90a4ae;
}

.title {
    font-size: 1.1rem;
    font-weight: 700;
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
</style>
