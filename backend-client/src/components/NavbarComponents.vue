<script setup>
import { ref, onMounted, inject, watchEffect, computed, watch } from "vue";
import ChangelogDialog from "./ChangelogDialog.vue";

import { useUserStore, useStateStore, usePermissionStore, useExpertStore } from "../store/index";
import { storeToRefs } from "pinia";
import { usePermissionChecker } from "@/composables";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useRoute, useRouter } from "vue-router";
const route = useRoute();
const router = useRouter();

import DialogComponents from "./DialogComponents.vue";

import { clearLocalStorageKeepKey } from "@/utils/common";
import { fetchExpertList } from "@/network/service";

const logoUrl = import.meta.env.VITE_LOGO_URL;
const dialog = ref(null);
const menuSettingItems = ref({
    default: "userSettingMenu",
    items: [
        {
            text: "帳戶設定",
            icon: "mdi-account",
            title: "設定",
            view: "userSettingMenu",
        },
        // { text: "Audience", icon: "mdi-clock", title: "設定", view: "DatasetsSetView" },
    ],
});

const { canPerformAction: canViewChangelog } = usePermissionChecker("allowedToViewChangelog");

const openTheDialog = async () => {
    await getAuthSetting();
    dialog.value.switchOpenDialog(true);
    menuSettingItems.value.default =
        menuSettingItems.value.default == "DatasetsSetView" ? "userSettingMenu" : "DatasetsSetView";
};

const logout = async () => {
    const response = await axios.post("/user/logout");

    if (response.status === 200 && response.data?.SSO_TYPE?.toLowerCase() === "kcg") {
        const redirectUrl = response.data.Location;
        window.location.href = redirectUrl;
        clearLocalStorageKeepKey("kcg");
    } else {
        clearLocalStorageKeepKey();
    }
};
const userStore = useUserStore();
const { nickname, email, image, user_no } = storeToRefs(userStore);
const { getAuthSetting } = userStore;
const stateStore = useStateStore();
const { datasetsName, expertName, datasetsIcon, skillsIcon } = storeToRefs(stateStore);

//setting store

const { updateForce } = stateStore;

//permission store
const permissionStore = usePermissionStore();
const { pagePermissions } = storeToRefs(permissionStore);
const axios = inject("axios");
const active = ref(-1);
const menu = ref([
    { icon: "fa-solid fa-house", data: ["首頁"], path: "/", id: "home" },
    { icon: "fa-solid fa-user-gear", data: ["使用者管理"], path: "/usermanage/", id: "usermanage" },
    { icon: "fa-solid fa-gears", data: ["系統設定"], path: "/systemsets/recommends", id: "systemsets" },
    { icon: "fa-solid fa-user-tie", data: ["專家"], path: "/experts", id: "experts" },
    { icon: "fa-solid fa-database", data: ["知識庫"], path: "/datasets", id: "datasets" },
    { icon: "fa-solid fa-screwdriver-wrench", data: ["技能商店"], path: "/skills", id: "skills" },
    { icon: "fa-brands fa-wpforms", data: ["表單"], path: "/forms", id: "forms" },
    { icon: "fa-solid fa-robot", data: ["AVA-GPT"], path: "/ava-gpt/overview", id: "ava-gpt" },
]);

const loading = computed(() => !pagePermissions.value || Object.keys(pagePermissions.value).length === 0);

const filteredMenu = computed(() => {
    if (loading.value) {
        return [];
    }

    return menu.value.filter((menuItem) => {
        // 檢查該選單項目是否有權限

        return menuItem.id && pagePermissions.value[menuItem.id] === true;
    });
});
function initMenu() {
    let index = filteredMenu.value.findIndex((f) => f.path === "/usermanage/");
    if (index !== -1) return;
}
const menuItems = ref([
    { title: "設定", icon: "fa-cog", click: openTheDialog },
    { title: "關於", icon: "fa-info-circle" },
]);

const menuItems2 = ref([{ title: "登出", icon: "fa-sign-out-alt", click: logout }]);

onMounted(() => {
    // active.value = 1;
    // console.log(menu.value.find((f) => f.path === route.path));
});
const route3 = ref("");
watchEffect(() => {
    let tempPath = route.path.split("/")[1];

    let tempActive = filteredMenu.value.findIndex((f) => f.path.split("/")[1] === tempPath);
    if (tempActive !== -1) {
        active.value = tempActive;
    }
    let routeArr = route.path.split("/");
    route3.value = routeArr[3];

    // 如果 path 不是 /experts/:expert_id & /datasets/:datasets_id 就清空 expertName 和 datasetsName 這樣就不會顯示在 navbar
    if (route.matched[0]?.path !== "/experts/:expert_id") {
        expertName.value = "";
    }
    if (route.matched[0]?.path !== "/datasets/:datasets_id") {
        datasetsName.value = "";
    }
});
watchEffect(() => {
    if (datasetsName.value) {
        filteredMenu.value.find((f) => f.id === "datasets").data[1] = datasetsName.value;
        getDatasets();
    } else {
        delete filteredMenu.value.find((f) => f.id === "datasets")?.data[1];
    }
    if (expertName.value) {
        filteredMenu.value.find((f) => f.id === "experts").data[1] = expertName.value;
        // getExperts();
    } else {
        delete filteredMenu.value.find((f) => f.id === "experts")?.data[1];
    }
    if (user_no.value) {
        initMenu();
    }
});
const datasetsList = ref([]);
const selfDatasetsId = computed(() => route.params.datasets_id);
function getDatasets() {
    axios.get("/datasets/datasets").then((rs) => {
        if (rs.data.code === 0) {
            datasetsList.value = rs.data.data;
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
    });
}

// ------------ tanstack version ------------
const queryClient = useQueryClient();
const prefetchExperts = async () => {
    await queryClient.prefetchQuery({
        queryKey: ["experts"],
        queryFn: fetchExpertList,
        staleTime: 1000 * 60 * 5, // 資料在 5 分鐘內不會重新請求
    });
};

const handleExpertHover = () => {
    const expertsItem = filteredMenu.value.find((item) => item.id === "experts");
    if (expertsItem) {
        prefetchExperts();
    }
};

const selfExpertId = computed(() => route.params.expert_id);

const { data: expertsList } = useQuery({
    queryKey: ["experts"],
    queryFn: () => fetchExpertList(),
    enabled: computed(() => !!selfExpertId.value && !!user_no.value),
});
watch(expertsList, (newVal) => {
    const expertStore = useExpertStore();
    expertStore.expertList = newVal;
});

const isCurrent = (id) => {
    if (selfExpertId.value) {
        return id === selfExpertId.value;
    }
    if (selfDatasetsId.value) {
        return id === selfDatasetsId.value;
    }
};

const isOpenSelect = ref(false);

document.addEventListener("click", function (event) {
    var myDiv = document.querySelector(".select");
    var targetElement = event.target;
    // 檢查點擊事件是否發生在 myDiv 以外
    if (targetElement !== myDiv && !myDiv.contains(targetElement)) {
        isOpenSelect.value = false;
    }
});
function changeExpert(id) {
    router.push(`/experts/${id}/${route3.value}`).then(() => {
        updateForce();
    });
    // setTimeout(() => {
    //     updateForce();
    // }, 10);
}
function changeDatasets(id) {
    router.push(`/datasets/${id}/${route3.value}`);
    // router.push(`/datasets/${id}/${route3.value}`).then(() => {
    //     updateForce();
    // });
    // setTimeout(() => {
    //     updateForce();
    // }, 10);
}
</script>

<template>
    <header class="navbar_com">
        <div class="logo">
            <img :src="logoUrl" alt="Logo" @click="router.push('/')" />
        </div>
        <div class="menu" v-if="!loading">
            <div
                class="item"
                v-for="(item, index) in filteredMenu"
                :key="item"
                :class="{ active: active === index }"
                @mouseenter="item.id === 'experts' && handleExpertHover()"
            >
                <router-link :to="item.path" class="px-3 py-2 d-flex align-center" @click="active = index">
                    <span class="mr-2"><i :class="item.icon"></i></span>
                    <p>{{ item.data[0] }}</p>
                </router-link>
                <span v-if="item.data[1]" class="text-grey">/</span>
                <div
                    v-if="item.data[1]"
                    class="px-2 py-1 select ma-1"
                    @click="isOpenSelect = isOpenSelect ? false : true"
                >
                    <span>{{ item.data[1] }}</span>

                    <span class="mdi mdi-chevron-down"></span>
                    <div class="option" v-if="item.id === 'datasets'" :class="{ option_show: isOpenSelect }">
                        <div
                            @click="changeDatasets(item1.id)"
                            class="item1"
                            v-for="(item1, index) in datasetsList"
                            :key="index"
                            :class="{ current: isCurrent(item1.id) }"
                        >
                            <span class="color1"><i :class="item1.icon || datasetsIcon"></i></span>
                            <span>{{ item1.name }}</span>
                        </div>
                    </div>

                    <div class="option" v-if="item.id === 'experts'" :class="{ option_show: isOpenSelect }">
                        <div
                            @click="changeExpert(item1.id)"
                            class="item1"
                            v-for="(item1, index) in expertsList"
                            :key="index"
                            :class="{ current: isCurrent(item1.id) }"
                        >
                            <img :src="item1.avatar" alt="" />

                            <span>{{ item1.name }}</span>
                        </div>
                    </div>
                    <!-- <div class="option" :class="{ option_show: isOpenSelect }">
                        <router-link
                            :to="`/b/${item.roomId || 'creating'}`"
                            class="item1"
                            v-for="item in botList"
                            :key="item"
                            @click="changePartner(item)"
                        >
                            <img class="avatar" :src="item.avatar" alt="頭像" />
                            <span> {{ item.nickname }} </span>
                        </router-link>
                    </div> -->
                </div>
            </div>
        </div>
        <div class="user">
            <ChangelogDialog v-if="canViewChangelog" />

            <v-menu open-delay="100" open-on-click class="rounded-xl">
                <template v-slot:activator="{ props }">
                    <div class="userProfile" v-bind="props">
                        <div class="avatar">
                            <p>{{ nickname?.slice(0, 1) }}</p>
                        </div>
                        <div class="nickname">{{ nickname }}</div>
                        <div class="select">
                            <p><i class="fa-solid fa-angle-down"></i></p>
                        </div>
                    </div>
                </template>
                <v-card elevation="1">
                    <v-list>
                        <v-list-item
                            :prepend-avatar="image ? image : 'user-raw.png'"
                            :title="nickname"
                            :subtitle="email"
                        >
                        </v-list-item>
                    </v-list>

                    <v-divider></v-divider>
                    <v-list>
                        <v-list-item v-for="(item, index) in menuItems" :key="index" :value="index" @click="item.click">
                            <v-list-item-title class="text-body-2 icon-spacing">
                                <i :class="['fas', item.icon, 'icon-spacing', '']"></i
                                >{{ item.title }}</v-list-item-title
                            >
                        </v-list-item>
                    </v-list>
                    <v-divider></v-divider>
                    <v-list>
                        <v-list-item
                            v-for="(item, index) in menuItems2"
                            :key="index"
                            :value="index"
                            @click="item.click"
                        >
                            <v-list-item-title class="text-body-2 icon-spacing">
                                <i :class="['fas', item.icon, 'icon-spacing']"></i>{{ item.title }}</v-list-item-title
                            >
                        </v-list-item>
                    </v-list>
                </v-card>
            </v-menu>
        </div>
        <DialogComponents
            ref="dialog"
            :items="menuSettingItems.items"
            :default="menuSettingItems.default"
        ></DialogComponents>
    </header>
</template>

<style lang="scss" scoped>
$color1: rgb(106, 174, 233);
$color2: rgb(104, 197, 127);
.color1 {
    color: $color1;
}
.color2 {
    color: $color2;
}
header.navbar_com {
    width: 100%;
    border: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;

    .logo {
        display: flex;
        align-items: center;
        // cursor: pointer;

        img {
            height: 2rem;
            &:hover {
                cursor: pointer;
            }
        }

        p {
            font-weight: bold;
            font-size: 1.2rem;
        }
        .clear {
            width: 30px;
            height: 30px;
            cursor: pointer;
        }
    }

    .menu {
        font-size: 0.9rem;
        display: flex;

        .item {
            color: #6b7280;
            border-radius: 0.7rem;
            margin: 0 0.3rem;
            display: flex;
            align-items: center;
            a {
                color: #6b7280;
            }
            span {
                word-break: break-all;
            }
            &:hover {
                background-color: #e5e7eb;
            }
            .select {
                border-radius: 0.5rem;
                cursor: pointer;
                position: relative;
                &:hover {
                    background-color: #ebf5ff;
                }
                .option {
                    position: absolute;
                    top: 2rem;
                    left: 50%;
                    transform: translateX(-50%);
                    overflow: hidden;
                    box-shadow: 0px 3px 3px #e4e5e7;
                    background-color: white;
                    z-index: 1;
                    border-radius: 0.3rem;
                    text-wrap: nowrap;
                    display: none;
                    padding: 0.3rem;
                    max-height: 300px;
                    overflow-y: auto;
                    z-index: 10;

                    .item1 {
                        cursor: pointer;
                        padding: 0.3rem 0.8rem;
                        // padding: 0.3rem 0.5rem;
                        display: flex;
                        align-items: center;
                        text-decoration: none;
                        color: #6b7280;
                        margin: 0.2rem 0;
                        border-radius: 0.3rem;
                        img {
                            width: 1.5rem;
                            height: 1.5rem;
                            border-radius: 0.3rem;
                        }
                        span {
                            margin: 0.3rem 0.3rem;
                        }

                        &:hover {
                            background-color: #e5e7eb;
                        }
                    }
                }
                .option_show {
                    display: block;
                }
            }
        }

        .active {
            background-color: white;
            box-shadow: 0px 3px 3px #e4e5e7;
            color: #1c64f2;
            a {
                color: #1c64f2;
            }

            &:hover {
                background-color: white;
            }
        }
    }

    .user {
        display: flex;
        align-items: center;
        cursor: pointer;
        border-radius: 0.7rem;
        padding: 0.3rem;
        border-radius: 3rem;

        .userProfile {
            display: flex;
            align-items: center;
            cursor: pointer;
            border-radius: 0.7rem;
            padding: 0.3rem;
            border-radius: 3rem;
        }

        &:hover {
            background-color: #e5e7eb;
        }

        .avatar {
            background-color: #1c64f2;
            color: white;
            border-radius: 50%;
            width: 2rem;
            height: 2rem;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-right: 0.5rem;
        }

        .nickname {
            font-size: 0.9rem;
        }

        .select {
            font-size: 0.6rem;
            margin: 0.5rem;
        }
    }
}

.icon-spacing {
    margin-right: 8px;
}

.current {
    background-color: rgb(240, 248, 255);
}
</style>
