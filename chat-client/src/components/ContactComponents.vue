<script setup>
import { useUserStore, useStateStore, useSettingsStore } from "../store/index";
import { storeToRefs } from "pinia";
import { inject, watch, computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
const userStore = useUserStore();
const { uid, contactList, avatar, nickname, user_no } = storeToRefs(userStore);
const stateStore = useStateStore();
const { chatPartner, isOpenMenu } = storeToRefs(stateStore);
const { changePartner } = stateStore;

const settingsStore = useSettingsStore();
const { system_version } = storeToRefs(settingsStore);

const axios = inject("axios");
const emitter = inject("emitter");

const router = useRouter();

onMounted(() => {
    console.log("onMounted");
    emitter.on("iframe_setExpert", (expert_id) => {
        try {
            console.log("before chatPartner: ", chatPartner.value);
            const chatPartnerInfo = contactList.value.find((f) => f.expertId === expert_id);
            // console.log("chatPartnerInfo", chatPartnerInfo.roomId);
            chatPartner.value.expertId = expert_id;
            chatPartner.value.roomId = chatPartnerInfo.roomId;
            chatPartner.value.nickname = chatPartnerInfo.nickname;
            chatPartner.value.avatar = chatPartnerInfo.avatar;
            router.push(`/b/${chatPartnerInfo.roomId}`);
        } catch (error) {
            console.error("error", error);
        }
        // if (chatPartner.value.expertId === expert_id) return;
        // let item = contactList.value.find((f) => f.expertId === expert_id);
        // isOpenMenu.value = true;
        // setTimeout(() => {
        //     changePartner(item);
        // }, 300);
    });

    emitter.on("iframe_setShowExpert", (experts) => {
        try {
            // 過濾出專家
            console.log("contactList", contactList);
            const filterExperts = contactList.value.filter((f) => experts.includes(f.expertId));
            if (filterExperts.length === 0) return;
            console.log("call", contactList);
            // 取得第一個專家的 roomId
            const expert_id = filterExperts[0].expertId;
            const roomId = contactList.value.find((f) => f.expertId === expert_id).roomId;
            contactList.value = filterExperts;

            // 幫使用者切換到第一個專家
            router.push(`/b/${roomId}`);
        } catch (error) {
            console.error("error", error);
        }
    });
});

watch(contactList, (newValue) => {
    changePartner(newValue[0]);
});

const botList = computed(() => {
    return contactList.value.filter((f) => f.identity === "bot");
});
const userList = computed(() => {
    return contactList.value.filter((f) => f.identity === "user");
});

async function signOut() {
    await axios.get("/user/logout");
    localStorage.clear();
    location.reload();
}

function getLink(item) {
    let link = "/";
    if (item.identity === "bot") {
        link += `b/${item.roomId || "creating"}/`;
    } else if (item.identity === "user") {
        link += `u/${item.roomId || "creating"}/`;
    }
    return link;
}

function setFavicon(iconPath, type = "image/svg+xml") {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    link.type = type;
    link.href = iconPath;
}
watch(chatPartner, (newValue) => {
    if (newValue.avatar) {
        setFavicon(newValue.avatar);
    } else {
        setFavicon("/ava/avaClient/robot.png");
    }
});
</script>

<template>
    <div class="contactList">
        <div class="list">
            <router-link
                :to="getLink(item)"
                v-for="(item, index) in botList"
                class="item"
                :class="{ active: item.roomId && chatPartner.roomId === item.roomId }"
                :key="index"
                @click="changePartner(item)"
            >
                <div class="avatar">
                    <img :src="item.avatar" alt="" />
                    <!-- <p v-if="item.identity === 'bot'"><i class="fa-solid fa-star"></i></p> -->
                </div>
                <div class="dep_no" v-if="item.dep_no">
                    <p>{{ item.dep_no }}</p>
                </div>
                <div class="nickname">
                    <p>{{ item.nickname }}</p>
                </div>
            </router-link>
            <!-- <div class="hr"></div>
            <router-link :to="getLink(item)" v-for="(item, index) in userList" class="item"
                :class="{ active: chatPartner.roomId == item.roomId }" :key="index" @click="changePartner(item)">
                <div class="avatar">
                    <img :src="item.avatar" alt="" />
                    <p v-if="item.identity === 'bot'"><i class="fa-solid fa-star"></i></p>
                </div>
                <div class="dep_no" v-if="item.dep_no">
                    <p>{{ item.dep_no }}</p>
                </div>
                <div class="nickname">
                    <p>{{ item.nickname }}</p>
                </div>

            </router-link> -->
        </div>
        <!-- <router-link
            :to="`/b/${contactList[0]?.roomId}`"
            class="item"
            :class="{ active: chatPartner.roomId == contactList[0]?.roomId }"
            @click="changePartner('b', contactList[0])"
        >
            <div class="avatar">
                <img :src="systemAvatar" alt="" />
                <p><i class="fa-solid fa-star"></i></p>
            </div>
            <div class="nickname">
                <p>{{ systemName }}</p>
            </div>
        </router-link> -->
        <!-- <router-link
            :to="`/u/${item.roomId || 'creating'}`"
            v-for="item in contactList.slice(1, contactList.length)"
            class="item"
            :class="{ active: chatPartner.roomId == item.roomId }"
            :key="item"
            @click="changePartner('u', item)"
        >
            <div class="avatar">
                <img :src="item.avatar" alt="" />
            </div>
            <div class="nickname">
                <p>{{ item.nickname }}</p>
            </div>
        </router-link> -->
        <div class="w-full text-[var(--text-color)] px-3 py-2 bg-[var(--tertiary-color)]">
            <!-- Main Container -->
            <div class="flex relative gap-3 items-center">
                <!-- Avatar -->
                <div class="flex-shrink-0">
                    <img :src="avatar" alt="" class="object-cover w-8 h-8 bg-white rounded-full" />
                </div>

                <!-- Text Content -->
                <div class="flex-1 min-w-0">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                        <!-- User No -->
                        <div v-if="user_no" class="text-sm truncate">
                            {{ user_no }}
                            <v-tooltip activator="parent" location="top" max-width="900">
                                {{ user_no }}
                            </v-tooltip>
                        </div>

                        <!-- Nickname -->
                        <div class="text-sm truncate">
                            {{ nickname }}
                            <v-tooltip activator="parent" location="top" max-width="900">
                                {{ nickname }}
                            </v-tooltip>
                        </div>
                    </div>
                </div>

                <!-- Version -->
                <div class="flex-shrink-0 text-xs font-medium text-[var(--text-color)] opacity-80">
                    v{{ system_version }}
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
::-webkit-scrollbar {
    width: 4px;
    height: 3px;
}

.contactList {
    width: 100%;
    height: 100%;
    padding-top: 1rem;
    background-color: var(--navigation-bg-color);
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .list {
        overflow-y: auto;

        .hr {
            width: 90%;
            height: 2px;
            background-color: var(--secondary-color);
            border-radius: 2px;
            margin: 0 auto;
        }
    }

    .item {
        color: var(--navigation-text-color);
        text-decoration: none;
        display: flex;
        align-items: center;
        cursor: pointer;
        border-radius: 0.3rem;
        margin: 0.2rem 0.5rem;
        padding: 0.5rem 0.5rem;

        &:hover {
            background-color: var(--room-list-active);
            /* filter: brightness(0.8); */
            opacity: 0.8;
        }

        .avatar {
            margin-right: 1rem;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;

            img {
                width: 2rem;
                height: 2rem;
                object-fit: cover;
                border-radius: 50%;
                background-color: white;
            }

            p {
                position: absolute;
                right: 0;
                bottom: 0;
                color: orange;
                display: flex;
                font-size: 0.8rem;
            }
        }

        .dep_no {
            margin-right: 0.5rem;
        }
    }

    .active {
        background-color: var(--room-list-active);
    }
}

.list_bottom {
    width: 100%;
    color: var(--text-color);
    display: flex;
    padding: 0.5rem 0.5rem;
    align-items: center;
    justify-content: space-between;
    // background-color: rgb(87, 84, 84);
    background-color: var(--tertiary-color);

    .version-info {
        position: absolute;
        right: 0.5rem;
        bottom: 0.1rem;
        color: var(--text-color);
        font-size: 0.7rem;
        font-weight: bold;
    }

    .my_info {
        display: flex;
        align-items: center;
        overflow: hidden;
        margin-bottom: 6px;
        margin-left: 0.3rem;

        .avatar {
            flex-shrink: 0;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;

            img {
                width: 2rem;
                height: 2rem;
                object-fit: cover;
                border-radius: 50%;
                background-color: white;
            }
        }

        .user_info {
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            overflow: hidden;
            margin-left: 1rem;
        }

        .user_no {
            font-size: 1rem;
            margin-right: 0.3rem;
            margin-bottom: 0.25rem;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            max-width: 100%;
            line-height: 1.2;
            padding-bottom: 0.1rem;
        }

        .nickname {
            font-size: 1rem;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            max-width: 100%;
            line-height: 1.2;
            padding-bottom: 0.1rem;
        }

        .sign_out {
            font-size: 1.2rem;
            cursor: pointer;
            margin-right: 0.5rem;
            margin-left: 1rem;
        }
    }
}
</style>
