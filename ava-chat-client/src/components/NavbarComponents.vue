<script setup>
import { toRefs, inject, ref, computed, watch, nextTick, watchEffect, onMounted } from "vue";
import { useUserStore, useStateStore, useSettingsStore, useApiStatusStore } from "../store";
import { storeToRefs } from "pinia";
import { useRoute } from "vue-router";
import TipDropdown from "./ui/TipDropdown.vue";
import AdjustFont from "./ui/AdjustFont.vue";
import AdjustZoom from "./ui/AdjustZoom.vue";
import AdjustTheme from "./ui/AdjustTheme.vue";
import NotificationCenter from "./NotificationCenter.vue";
import { clearLocalStorageKeepKey } from "@/utils/common";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { BellIcon } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
const route = useRoute();
const userStore = useUserStore();
const { nickname, user_type, contactList, uid } = storeToRefs(userStore);
const stateStore = useStateStore();
const { changePartner } = stateStore;
const { bulletinHeight } = storeToRefs(stateStore);
const apiStatusStore = useApiStatusStore();
const settingsStore = useSettingsStore();
const { bulletin, theme } = storeToRefs(settingsStore);
const emit = defineEmits(["switch"]);
const props = defineProps({
    isOpen: { type: Boolean, default: false },
    chatPartner: { type: Object, default: {} },
});
const bulletinRef = ref(null);
const { isOpen, chatPartner } = toRefs(props);

const axios = inject("axios");
const emitter = inject("emitter");

const single = computed(() => route.query.single == "true");
const showNotificationCenter = ref(false);
const hasUnreadNotifications = ref(false);
const showBulletin = ref(true);

// 檢查未讀通知
const checkUnreadNotifications = async () => {
    try {
        const response = await axios.get("/system/checkUnread");
        hasUnreadNotifications.value = response.data.data.hasUnread;
    } catch (error) {
        console.error("檢查未讀通知失敗:", error);
    }
};

function switchMenu() {
    if (single.value) return;

    if (isOpen.value) {
        emit("switch", false);
    } else {
        emit("switch", true);
    }
}
async function clearData() {
    // localStorage.clear();
    await axios.post(
        "/clearTest",
        JSON.stringify({
            partner: chatPartner.value.partner,
            roomId: chatPartner.value.roomId,
        })
    );
    clearLocalStorageKeepKey(chatPartner.value.roomId);
    emitter.emit("clearData");
    // queryClient.invalidateQueries({ queryKey: ["messages", chatPartner.value.roomId] });
    // location.reload();
}
const botList = computed(() => {
    return contactList.value.filter((f) => f.identity === "bot" && f.expertId !== chatPartner.value.expertId);
});

const isOpenSelect = ref(false);
const isOpenSetting = ref(false);

const defaultSettings = ref([{ title: "清空聊天", click: clearData }]);

// const settings = ref([{ title: "清空聊天", click: clearData }]);

const isIframe = window !== window.parent;

const settings = computed(() => {
    let settingsArray = [...defaultSettings.value]; // 複製預設設定
    if (!isIframe) {
        if (user_type.value === "guest") {
            settingsArray.push({ title: "中冠登入", click: ssologin });
            settingsArray.push({ title: "中鋼SSO", click: cscSSO });
        } else {
            settingsArray.push({ title: "登出", click: signOut });
        }
    }
    return settingsArray;
});

async function cscSSO() {
    let rs = await axios.post("/user/login", JSON.stringify({ login_type: "csc_sso" }));
    console.log(rs.data);
}

async function ssologin() {
    let rs = await axios.post("/user/login", JSON.stringify({ login_type: "icsc_sso" }));
    console.log(rs.data);
}

async function signOut() {
    const response = await axios.get("/user/logout");
    if (response.status === 200 && response.data?.SSO_TYPE?.toLowerCase() === "kcg") {
        const redirectUrl = response.data.Location;
        window.location.href = redirectUrl;
        clearLocalStorageKeepKey("kcg");
    } else {
        clearLocalStorageKeepKey();
    }
}

document.addEventListener("click", function (event) {
    var myDiv = document.querySelector(".chatPartner");
    var targetElement = event.target;
    // 檢查點擊事件是否發生在 myDiv 以外
    if (targetElement !== myDiv && !myDiv.contains(targetElement)) {
        isOpenSelect.value = false;
    }

    var settingDiv = document.querySelector(".setting");
    var selectContainer = document.querySelector(".select-container");
    var targetElement = event.target;

    // 檢查點擊事件是否發生在 setting div 或 select-container 以外
    if (
        targetElement !== settingDiv &&
        !settingDiv.contains(targetElement) &&
        (!selectContainer || (!selectContainer.contains(targetElement) && targetElement !== selectContainer))
    ) {
        isOpenSetting.value = false;
    }
});

// 取得 公告 的高度並將它設定到 store 中
watchEffect(() => {
    if (bulletin.value.system_bulletin) {
        nextTick(() => {
            if (bulletinRef.value) {
                bulletinHeight.value = bulletinRef.value.offsetHeight;
            } else {
                console.log("bulletinRef is not available yet");
            }
        });
    }
});

onMounted(() => {
    apiStatusStore.registerRequest();
    try {
        checkUnreadNotifications();
    } catch (error) {
        console.log("onMounted error", error);
    } finally {
        apiStatusStore.markRequestComplete();
    }

    emitter.on("unreadNotification", () => {
        checkUnreadNotifications();
    });

    emitter.on("logout", (value) => {
        signOut();
    });
});

function closeBulletin() {
    showBulletin.value = false;
}

function handleSearchClick() {
    emitter.emit("openSearchBar");
}
</script>

<template>
    <div class="navbar_com">
        <span class="icon_left" @click="switchMenu">
            <div v-if="!single">
                <i class="fa-solid fa-bars"></i>
            </div>
        </span>

        <!-- <div class="hint_type">
            <div class="select" @click="isOpenSelect = isOpenSelect ? false : true">
                <p>{{ selectValue }}</p>
                <span><i class="fa-solid fa-angle-down"></i></span>
            </div>
            <div class="option" :class="{ option_show: isOpenSelect }">
                <p
                    class="item"
                    v-for="item in data.type"
                    :key="item"
                    @click="
                        isOpenSelect = false;
                        selectValue = item;
                        pushEchartsData();
                    "
                >
                    {{ item }}
                </p>
            </div>
        </div> -->
        <div class="flex items-center middle-menu">
            <div
                class="chatPartner"
                :class="{ select_hover: chatPartner.partner === 'bot' }"
                @click="isOpenSelect = isOpenSelect ? false : true"
            >
                <img class="avatar" :src="chatPartner.avatar" alt="頭像" />
                <p v-if="chatPartner.dep_no" class="dep_no">{{ chatPartner.dep_no }}</p>
                <p v-if="chatPartner.nickname" class="nickname">
                    <span>{{ chatPartner.nickname }}</span>
                </p>

                <span v-if="chatPartner.partner === 'bot' && !single"><i class="fa-solid fa-angle-down"></i></span>
                <!-- <v-tooltip location="right">123</v-tooltip> -->

                <div
                    v-if="chatPartner.partner === 'bot' && !single"
                    class="option"
                    :class="{ option_show: isOpenSelect }"
                >
                    <router-link
                        :to="`/b/${item.roomId || 'creating'}/`"
                        class="item"
                        v-for="(item, index) in botList"
                        :key="index"
                        @click="changePartner(item)"
                    >
                        <img class="avatar" :src="item.avatar" alt="頭像" />
                        <span> {{ item.nickname }} </span>
                    </router-link>
                </div>
            </div>
            <TipDropdown :chatPartner="chatPartner" />
        </div>

        <!-- <p class="icon_right"><i class="fa-solid fa-ellipsis-vertical"></i></p> -->
        <div class="setting">
            <Button variant="ghost" size="icon" @click="showNotificationCenter = true" class="relative">
                <div class="relative">
                    <BellIcon class="w-5 h-5" />
                    <span
                        v-if="hasUnreadNotifications"
                        class="absolute w-2 h-2 bg-red-500 rounded-full -top-1 -right-1"
                    />
                </div>
            </Button>
            <!-- <Button variant="ghost" size="icon" @click="handleSearchClick" class="relative">
                <i class="fa-solid fa-magnifying-glass"></i>
            </Button> -->

            <p class="hidden xl:block username">{{ nickname }}</p>

            <DropdownMenu>
                <DropdownMenuTrigger as="div">
                    <span class="icon">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </span>
                </DropdownMenuTrigger>

                <DropdownMenuContent class="w-56 bg-[var(--secondary-color)]">
                    <!-- 一般選項 -->

                    <DropdownMenuItem class="block xl:hidden">
                        <p class="username">{{ nickname }}</p>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator class="block xl:hidden" />
                    <DropdownMenuItem
                        v-for="(item, index) in settings"
                        :key="index"
                        @click="item.click"
                        class="hover:bg-[var(--primary-color)]"
                    >
                        {{ item.title }}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <!-- 字體大小調整 -->
                    <div class="px-2 py-2">
                        <AdjustFont />
                    </div>

                    <!-- 縮放調整 -->
                    <div class="px-2 py-2">
                        <AdjustZoom />
                    </div>

                    <!-- 主題調整 -->
                    <div class="px-2 py-2">
                        <AdjustTheme />
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <NotificationCenter v-model="showNotificationCenter" />
        </div>

        <div
            class="bulletin"
            ref="bulletinRef"
            v-if="bulletin.system_bulletin && showBulletin"
            :style="{ backgroundColor: bulletin.system_bulletin_color_back }"
        >
            <p :style="{ color: bulletin.system_bulletin_color }">
                {{ bulletin.system_bulletin }}
            </p>
            <button @click="closeBulletin" :style="{ color: bulletin.system_bulletin_color }">×</button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.navbar_com {
    width: 100%;
    height: 3rem;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    background-color: var(--navbar-bg-color);
    color: var(--navbar-text-color);
    .icon_left {
        font-size: 1.5rem;
        cursor: pointer;
    }
    .middle-menu {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        z-index: 100000;
    }
    .icon_right {
        font-size: 1.5rem;
        cursor: pointer;
    }
    .select_hover:hover {
        background-color: var(--secondary-color);
        cursor: pointer;
    }
    .chatPartner {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0.3rem 0.5rem;
        border-radius: 0.3rem;
        position: relative;
        .avatar {
            width: 1.5rem;
            height: 1.5rem;
            border-radius: 50%;
            object-fit: cover;
            margin-right: 0.5rem;
            background-color: white;
        }
        .dep_no {
            font-size: 1.3rem;
            font-weight: bold;
            margin-right: 0.5rem;
        }
        .nickname {
            font-size: 1.3rem;
            font-weight: bold;
            margin-right: 0.5rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-wrap: nowrap;
        }
        .option {
            position: absolute;
            top: 2.5rem;
            white-space: nowrap;
            overflow-y: auto;
            overflow-x: hidden;
            box-shadow: 1px 1px 5px gray;
            background-color: var(--primary-color);
            z-index: 2;
            border-radius: 0.3rem;
            text-wrap: nowrap;
            display: none;
            max-width: 300px;
            max-height: 500px;
            .item {
                cursor: pointer;
                padding: 0.5rem 0.8rem;
                display: flex;
                align-items: center;
                text-decoration: none;
                color: var(--text-color);

                &:hover {
                    background-color: var(--secondary-color);
                }
            }
        }
        .option_show {
            /* position: relative; */
            z-index: 99999;
            display: block;
        }
    }
    .setting {
        display: flex;
        align-items: center;
        position: relative;

        .username {
            padding: 0.3rem;
            border-radius: 0.3rem;
        }

        .icon {
            padding: 0.3rem 0.3rem;
            cursor: pointer;
            display: flex;
            align-items: center;
        }
    }
    .bulletin {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        top: 3rem;
        /* height: 100px; */
        padding: 0.3rem;
        z-index: 9999;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba($color: orange, $alpha: 0.8);
        max-width: 768px;
        // background-color: rgba($color: #ee9e9d, $alpha: 0.9);
        p {
            flex: 1;
            text-align: center;
            word-break: break-all;
        }
        button {
            margin-left: auto;
            background: none;
            border: none;
            cursor: pointer;
        }
    }
}
</style>
