<script setup>
import { ref, computed } from "vue";

const props = defineProps(["users", "userList", "selectUserMode", "originalUsers", "groupMapping"]);
const emits = defineEmits(["deleteUser", "getUserPermission", "restoreUser"]);

const displayUsers = computed(() => {
    return [...new Set([...props.originalUsers, ...props.users])];
});

function getUserOrGroupName(id) {
    if (id.startsWith("#")) {
        return props.groupMapping?.[id] ? `#${props.groupMapping[id].name}(${props.groupMapping[id].id})` : id;
    }
    const user = props.userList?.find((u) => u.user_no === id);
    return user ? `${user.name}(${user.user_no})` : id;
}

const selectedUser = ref(null);
function selectUser(user) {
    if (props.selectUserMode) {
        if (selectedUser.value === user) {
            selectedUser.value = null;
        } else {
            selectedUser.value = user;
        }
        emits("getUserPermission", selectedUser.value);
    }
}

function getChipColor(user) {
    if (props.selectUserMode) {
        return selectedUser.value === user ? "selected" : "select-user";
    }
    if (isDeletedUser(user)) {
        return "deleted-user";
    }
    if (isNewUser(user)) {
        return "new-user";
    }
}

function isDeletedUser(user) {
    return props.originalUsers.includes(user) && !props.users.includes(user);
}

function isNewUser(user) {
    return !props.originalUsers.includes(user);
}
</script>

<template>
    <div class="user-box">
        <div
            class="user-chip"
            :class="getChipColor(user)"
            v-for="(user, index) in displayUsers"
            :key="'user-manage-user' + user"
            @click="selectUser(user)"
        >
            <span class="user-chip-name">
                <span class="new-user-plus" v-if="isNewUser(user) && !props.selectUserMode">+</span>
                {{ getUserOrGroupName(user) }}
            </span>

            <div v-if="!isDeletedUser(user)" class="user-chip-delete" @click="emits('deleteUser', user)">
                <i class="fa-solid fa-xmark" style="color: #ffffff"></i>
            </div>
            <div v-else class="user-chip-restore" @click="emits('restoreUser', user)">
                <i class="fa-solid fa-rotate-right" style="color: #ffffff"></i>
            </div>
        </div>
        <p class="no-user-text" v-if="users.length === 0">尚未選擇任何使用者</p>
    </div>
    <p class="select-user-tip" v-if="users.length !== 0 && props.selectUserMode">點擊可以預覽使用者權限</p>
</template>

<style scoped>
.user-box {
    background: white;
    border: 1px solid rgb(200, 200, 200);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    max-height: 200px;
    overflow-y: auto;
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

.user-chip-delete:hover {
    background: red;
}

.user-chip-restore {
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

.user-chip-restore:hover {
    background: red;
}

.no-user-text {
    color: gray;
    font-weight: 700;
    display: flex;
    align-items: center;
}

.select-user-tip {
    color: gray;
    margin-left: 12px;
}

.select-user {
    cursor: pointer;
}

.select-user:hover {
    background: #d9eeff;
}

.selected {
    background: #3ac7ff;
}

.new-user {
    background: #ffc986;
}

.deleted-user {
    background: #ff8e8e;
    text-decoration: line-through;
}

.user-chip-name {
    user-select: none;
}

.new-user-plus {
    font-weight: 900;
}
</style>
