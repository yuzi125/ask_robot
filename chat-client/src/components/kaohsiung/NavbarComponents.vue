<script setup>
import { toRefs, inject, onMounted, ref, computed, watch, nextTick, watchEffect } from "vue";
import { useUserStore, useStateStore, useSettingsStore, useApiStatusStore } from "@/store";
import { storeToRefs } from "pinia";
import { stopFetchStream } from "@/global/fetchStream";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import NotificationCenter from "@/components/NotificationCenter.vue";
import SwitchComponents from "@/components/SwitchComponents.vue";
import AdjustFont from "@/components/ui/AdjustFont.vue";
import AdjustZoom from "@/components/ui/AdjustZoom.vue";
import AdjustTheme from "@/components/ui/AdjustTheme.vue";
import { clearLocalStorageKeepKey } from "@/utils/common";
import TipDropdown from "@/components/ui/TipDropdown.vue";
import { BellIcon } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

const userStore = useUserStore();
const { nickname, user_type, contactList, uid } = storeToRefs(userStore);
const stateStore = useStateStore();
const { changePartner } = stateStore;
const { bulletinHeight } = storeToRefs(stateStore);
const apiStatusStore = useApiStatusStore();
const settingsStore = useSettingsStore();
const { bulletin, theme, system_version } = storeToRefs(settingsStore);

const emit = defineEmits(["switch"]);
const props = defineProps({
    isOpen: { type: Boolean, default: false },
    chatPartner: { type: Object, default: {} },
});
const bulletinRef = ref(null);
const { isOpen, chatPartner } = toRefs(props);

const axios = inject("axios");
const emitter = inject("emitter");

const isLightTheme = ref(false);

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

function switchMenu() {
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
    // location.reload();
}

const isOpenSelect = ref(false);
const isOpenSetting = ref(false);

const defaultSettings = ref([{ title: "清空聊天", click: clearData }]);

const settings = computed(() => {
    let settingsArray = [...defaultSettings.value]; // 複製預設設定
    // if (!isIframe) {
    //     if (user_type.value === "guest") {
    //         settingsArray.push({ title: "中冠登入aa", click: ssologin });
    //         settingsArray.push({ title: "中鋼SSO", click: cscSSO });
    //     } else {
    //         settingsArray.push({ title: "登出", click: signOut });
    //     }
    // }
    return settingsArray;
});

// if (isIframe) {
//     // 這邊什麼都不做
// } else {
//     if (user_type.value === "guest") {
//         settings.value.push({ title: "中冠登入", click: ssologin });
//         settings.value.push({ title: "中鋼SSO", click: cscSSO });
//     } else {
//         settings.value.push({ title: "登出", click: signOut });
//     }
// }

async function cscSSO() {
    let rs = await axios.post("/user/login", JSON.stringify({ login_type: "csc_sso" }));
    console.log(rs.data);
}

async function ssologin() {
    let rs = await axios.post("/user/login", JSON.stringify({ login_type: "icsc_sso" }));
    console.log(rs.data);
}
async function signOut() {
    await axios.get("/user/logout");
    clearLocalStorageKeepKey();
    // localStorage.clear();
    // location.reload();
}

const showNotificationCenter = ref(false);
const hasUnreadNotifications = ref(false);

// 檢查未讀通知
const checkUnreadNotifications = async () => {
    try {
        const response = await axios.get("/system/checkUnread");
        hasUnreadNotifications.value = response.data.data.hasUnread;
    } catch (error) {
        console.error("檢查未讀通知失敗:", error);
    }
};

document.addEventListener("click", function (event) {
    var myDiv = document.querySelector(".chatPartner");
    var targetElement = event.target;
    // 檢查點擊事件是否發生在 myDiv 以外
    if (targetElement !== myDiv && !myDiv.contains(targetElement)) {
        isOpenSelect.value = false;
    }

    var myDiv = document.querySelector(".setting");
    var targetElement = event.target;
    // 檢查點擊事件是否發生在 myDiv 以外
    if (targetElement !== myDiv && !myDiv.contains(targetElement)) {
        isOpenSetting.value = false;
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
});

function handleSearchClick() {
    emitter.emit("openSearchBar");
}
</script>

<template>
    <div class="navbar_com">
        <p class="icon_left">
            <!-- <i class="fa-solid fa-bars"></i> -->
        </p>
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
            </div>
        </div>

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
                    <DropdownMenuItem class="block xl:hidden">
                        <p class="username">{{ nickname }}</p>
                    </DropdownMenuItem>
                    <!-- 一般選項 -->
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
            v-if="bulletin.system_bulletin"
            :style="{ backgroundColor: bulletin.system_bulletin_color_back }"
        >
            <p :style="{ color: bulletin.system_bulletin_color }">
                {{ bulletin.system_bulletin }}
            </p>
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
    // z-index: 1;
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
        z-index: 10000;
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
        // left: 50%;
        // transform: translateX(-50%);
        // z-index: 2;
        // &:hover {
        //     background-color: var(--secondary-color);
        // }
        .avatar {
            width: 1.5rem;
            height: 1.5rem;
            border-radius: 50%;
            object-fit: contain;
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
        z-index: 10000;
        .username {
            padding: 0.3rem;
            border-radius: 0.3rem;
        }
        .icon {
            padding: 0.3rem 0.3rem;
            cursor: pointer;
        }
        .option {
            position: absolute;
            top: 2rem;
            right: 0;
            overflow: auto;
            white-space: nowrap;
            box-shadow: 1px 1px 5px gray;
            background-color: var(--primary-color);
            z-index: 2;
            border-radius: 0.3rem;
            text-wrap: nowrap;
            display: none;
            max-width: 300px;
            .item {
                cursor: pointer;
                padding: 0.5rem 0.8rem;
                // padding: 0.3rem 0.5rem;
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
            display: block;
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
            word-break: break-all;
        }
    }
}
</style>
