<script setup>
import { ref, inject, toRefs, watch } from "vue";
import { useRoute } from "vue-router";
import { format } from "date-fns";

const axios = inject("axios");
const emitter = inject("emitter");

const route = useRoute();

const props = defineProps({
    user_type: { type: String, default: "" },
});
const { user_type } = toRefs(props);

const user_name = ref("");
const start_time = ref("");
const end_time = ref("");
const last_user_time = ref(""); //目前最後一筆使用者的建立時間
const is_last_user = ref(false); //是否是最後一筆使用者
const last_msg_time = ref(""); //目前最後一筆聊天的創見時間
const is_last_msg = ref(false); //是否是最後一筆聊天

const users = ref([]);

init();
watch(user_type, () => {
    users.value = [];
    user.value = {};
    roomInfo.value = {};
    messages.value = [];
    last_user_time.value = "";
    is_last_user.value = false;
    last_msg_time.value = "";
    is_last_msg.value = false;
    start_time.value = "";
    end_time.value = "";
    init();
});

async function init() {
    let rs = await getUsers();
    users.value.push(...rs);
    initRoom();
}
//初始化房間資料
function initRoom() {
    let { u, r } = route.query;
    if (!u || !r) return;
    let item = users.value.find((f) => f.id === u);
    if (item) {
        let room_info = item.roomInfo.find((f) => f[3] === r);
        room_info = { room_id: room_info[3], title: room_info[0], icon: room_info[1], link: room_info[2] };
        changeRoom(item, room_info);
    } else {
        changeRoom();
    }
}

async function getUsers() {
    if (users.value.length !== 0) {
        last_user_time.value = users.value[users.value.length - 1].create_time;
    } else {
        last_user_time.value = "";
    }
    let rs = await axios.get(
        `/usermanage/users?user_type=${user_type.value}&user_name=${user_name.value}&start_time=${start_time.value}&end_time=${end_time.value}&last_user_time=${last_user_time.value}`
    );
    if (rs.data.code !== 0) {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        return;
    }
    rs = rs.data.data;
    rs.users.forEach((item) => {
        item.roomInfo = item.roomInfo.map((m) => [
            m.expert_name,
            m.expert_avatar,
            `${route.path}?u=${item.id}&r=${m.group_id}`,
            m.group_id,
        ]);
        item.value = [item.id];
    });

    if (rs.users.length !== 0) {
        //有加載出使用者時，判斷是否是最後一位撈出的
        let create_time = rs.users[rs.users.length - 1].create_time;
        if (create_time === last_user_time.value) {
            is_last_user.value = true;
            return [];
        } else {
            last_user_time.value = create_time;
            return rs.users;
        }
    } else {
        is_last_user.value = true;
        return [];
    }
}

function getUserName(name) {
    switch (user_type.value) {
        case "guest":
            return "遊客";
        case "member":
            return name;
        case "webapi":
            return "webapi";
    }
}
function getUserAvatar(item) {
    switch (user_type.value) {
        case "guest":
            return "../../src/assets/user_man.png";
        case "member":
            return item.avatar || item.sex === 1 ? "../../src/assets/user_man.png" : "../../src/assets/user_woman.png";
        case "webapi":
            return "../../src/assets/user_man.png";
    }
}

watch(start_time, (newV) => {
    if (newV > end_time.value) {
        end_time.value = newV;
    }
});
watch(end_time, (newV) => {
    if (newV < start_time.value) {
        start_time.value = newV;
    }
});

const messages = ref([]);
const user = ref({});
const roomInfo = ref({});

watch(roomInfo, () => {
    last_msg_time.value = "";
    is_last_msg.value = false;
});

async function changeRoom(item, room_info) {
    messages.value = [];
    user.value = [];
    if (!item) return;
    if (!room_info) return;
    let user_id = item.id;
    let room_id = room_info.room_id;
    roomInfo.value = room_info;
    let rs = await axios.get(
        `/usermanage/userMessages?user_id=${user_id}&room_id=${room_id}&start_time=${start_time.value}&end_time=${end_time.value}`
    );
    if (rs.data.code === 0) {
        rs = rs.data.data;
        user.value = item;
        messages.value = rs.chat;
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

function filterNameAndMessage() {
    init();
}
async function getMoreUsers() {
    let rs = await getUsers();
    console.log(rs);
    users.value.push(...rs);
    console.log(users.value);
}
async function getMoreMsg() {
    if (messages.value.length !== 0) {
        last_msg_time.value = messages.value[messages.value.length - 1].time;
    } else {
        last_msg_time.value = "";
    }
    let rs = await axios.get(
        `/usermanage/userMessages?user_id=${user.value.id}&room_id=${roomInfo.value.room_id}&start_time=${start_time.value}&end_time=${end_time.value}&last_msg_time=${last_msg_time.value}`
    );
    if (rs.data.code === 0) {
        rs = rs.data.data;
        messages.value.push(...rs.chat);
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
    if (rs.chat.length !== 0) {
        //有加載出聊天時，判斷是否是最後一筆撈出的
        let create_time = rs.chat[rs.chat.length - 1].time;
        if (create_time === last_msg_time.value) {
            is_last_msg.value = true;
        } else {
            last_msg_time.value = create_time;
        }
    } else {
        is_last_msg.value = true;
    }
    // is_last_msg
}
</script>

<template>
    <div class="user_manage_messages_view d-flex h-100">
        <v-card width="300" height="100%" class="ml-1 overflow-y-auto" style="min-width: 300px">
            <form class="ma-2" @submit.prevent="filterNameAndMessage">
                <div class="d-flex align-center">
                    <input v-model="start_time" type="date" class="px-2 py-1 rounded" style="border: 1px solid black" />
                    <span class="mx-1">至</span>
                    <input v-model="end_time" type="date" class="px-2 py-1 rounded" style="border: 1px solid black" />
                </div>
                <div class="mt-2 d-flex align-center">
                    <label class="mr-2 text-no-wrap">名稱:</label>
                    <input
                        v-model="user_name"
                        type="text"
                        class="px-2 py-1 rounded w-100"
                        style="border: 1px solid black"
                    />
                </div>
                <v-btn type="submit" class="mt-2 w-100">篩選</v-btn>
            </form>
            <div v-if="users.length === 0" class="justify-center py-6 ml-1 w-100 font-weight-bold d-flex align-center">
                查無人員
            </div>
            <v-list v-else v-model:opened="item.value" v-for="(item, index) in users" :key="index" nav>
                <v-list-group :value="item.value[0]">
                    <template v-slot:activator="{ props }">
                        <v-list-item
                            v-bind="props"
                            :title="
                                item.auth_id !== null
                                    ? item.auth_id + ' ' + getUserName(item.name)
                                    : getUserName(item.name)
                            "
                        >
                        </v-list-item>
                    </template>
                    <v-list-item
                        :to="link"
                        v-for="([title, icon, link, room_id], i) in item.roomInfo"
                        :key="i"
                        :title="title"
                        :prepend-icon="icon"
                        :value="link"
                        @click="changeRoom(item, { room_id, title, icon, link })"
                    >
                    </v-list-item>
                </v-list-group>
            </v-list>
            <div v-if="!is_last_user" class="mt-2 pa-2">
                <v-btn class="w-100" @click="getMoreUsers">查看更多</v-btn>
            </div>
            <div v-else class="mt-2">
                <p class="text-center border-t-sm pa-2">已達底部</p>
            </div>
        </v-card>
        <!-- <v-list class="ml-1" width="200" height="100%" :lines="false" density="compact" nav>
            <v-list-item v-for="(item, i) in users" :key="i" :value="item" color="primary" @click="changeUser(item)">
                <template v-slot:prepend>
                    <v-avatar>
                        <v-img :alt="getUserName(item.name)" :src="getUserAvatar(item)"></v-img>
                    </v-avatar>
                </template>

                <v-list-item-title v-text="getUserName(item.name)"></v-list-item-title>
            </v-list-item>
        </v-list> -->
        <div v-if="messages.length === 0" class="justify-center ml-1 w-100 d-flex align-center">
            <p v-if="!roomInfo.room_id" class="font-weight-bold">點擊列表查看對話</p>
            <p v-else class="font-weight-bold">查無對話</p>
        </div>
        <div v-else class="ml-1 overflow-x-hidden w-100">
            <div v-for="(item, index) in messages" :key="index">
                <div v-if="item.sender === 'bot'" class="pa-3 bg-grey-lighten-2">
                    <div class="d-flex">
                        <p>{{ roomInfo.title }}</p>
                        <p class="ml-3">{{ format(new Date(item.time), "yyyy-MM-dd HH:mm:ss") }}</p>
                    </div>
                    <div class="mt-1 ml-5">
                        <div v-for="(item1, index1) in item.message" :key="index1">
                            <p class="py-1">{{ item1 }}</p>
                            <v-divider v-if="index1 !== item.message.length - 1"></v-divider>
                        </div>
                    </div>
                </div>
                <div v-else class="pa-3">
                    <div class="d-flex">
                        <p>{{ getUserName(user.name) }}</p>
                        <p class="ml-3">{{ format(new Date(item.time), "yyyy-MM-dd HH:mm:ss") }}</p>
                    </div>
                    <div class="mt-1 d-flex">
                        <p>{{ item.message.data }}</p>
                    </div>
                </div>
            </div>
            <div v-if="!is_last_msg" class="mt-2 pa-2">
                <v-btn class="w-100" @click="getMoreMsg">查看更多</v-btn>
            </div>
            <div v-else class="mt-2">
                <p class="text-center border-t-sm pa-2">已達底部</p>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.user_manage_messages_view {
}
</style>
