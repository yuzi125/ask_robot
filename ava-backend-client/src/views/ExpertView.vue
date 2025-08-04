<script setup>
import { computed, inject, onMounted, ref, toRefs, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
const route = useRoute();
const router = useRouter();

import { fetchBindList, fetchExpertData } from "@/network/service";

import { useQuery } from "@tanstack/vue-query";
const axios = inject("axios");

import FormComponents from "../components/FormComponents.vue";

import { useStateStore, usePermissionStore } from "../store/index";
import { storeToRefs } from "pinia";
const stateStore = useStateStore();
const { expertName, datasetsIcon, skillsIcon } = storeToRefs(stateStore);
const permissionStore = usePermissionStore();
const { actionPermissions } = storeToRefs(permissionStore);

const props = defineProps({
    expert_id: { type: String, default: "" },
});
const { expert_id } = toRefs(props, "expert_id");

const menuActive = ref([-1, -1]);
const menu = ref([
    { icon: "fa-solid fa-table", text: "概覽", link: "overview" },
    { icon: "fa-solid fa-diagram-project", text: "綁定知識庫&技能", link: "binding" },
    {
        icon: "fa-solid fa-terminal",
        icon: "fa-solid fa-terminal",
        text: "提示詞編排",
        child_open: true,
        child: [
            { icon: "fa-solid fa-magnifying-glass", text: "潤飾模組", link: "search" },
            { icon: "fa-solid fa-brain", text: "意圖模組", link: "intention" },
            { icon: "fa-solid fa-earth-americas", text: "自然語言處理", link: "kor" },
            { icon: "fa-solid fa-microphone", text: "語音模組", link: "voice" },
        ],
    },
    {
        icon: "fa-solid fa-star-half-stroke",
        text: "問答評價",
        child_open: true,
        child: [
            { icon: "fa-solid fa-chart-line", text: "統計圖表", link: "feedbackCharts" },
            { icon: "fa-solid fa-file-signature", text: "評論處理", link: "feedbackTable" },
        ],
    },
    { icon: "fa-solid fa-clock-rotate-left", text: "專家訪問紀錄", link: "record" },
    {
        icon: "fa-solid fa-bolt",
        text: "快取",
        child_open: true,
        child: [
            { icon: "fa-solid fa-chart-line", text: "統計圖表", link: "cacheCharts" },
            { icon: "fa-solid fa-save", text: "快取", link: "cache" },
        ],
    },
    { icon: "fa-solid fa-gear", text: "設定", link: "settings" },
]);

function toggleChildMenu(item, event) {
    item.child_open = !item.child_open;
}

function changePage(link, item, index, childIndex) {
    if (item.child && !isMenuCollapsed.value) {
        toggleChildMenu(item);
    } else {
        router.push(`/experts/${expert_id.value}/${link}`);
    }
    menuActive.value = [index, childIndex];
}

// 判斷權限，決定是否添加「共用參數選單」
watchEffect(() => {
    if (actionPermissions.value.allowedToUseExpertConfiguration) {
        const sharedParamsItem = { icon: "fa-solid fa-share", text: "共用參數", link: "configuration" };
        const targetNode = menu.value.find((item) => item.text === "提示詞編排" && item.child);
        if (targetNode && !targetNode.child.some((child) => child.text === sharedParamsItem.text)) {
            targetNode.child.push(sharedParamsItem);
        }
    }
});

async function init() {
    try {
        // 判斷專家是否啟用(未啟用不能用)
        const tableName = "expert";
        const recordId = props.expert_id;
        const response = await axios.get(`/common/checkRecordEnableStatus?tableName=${tableName}&recordId=${recordId}`);
        if (response.data.code === 1) {
            return router.push({ name: "not-found" });
        }

        // 設定選單active狀態
        const path = route.matched[1]?.path?.split("/")[3];
        menuActive.value = [-1, -1];
        menu.value.forEach((item, index) => {
            if (item.link === path) {
                // 檢查第一層
                menuActive.value[0] = index;
                menuActive.value[1] = -1;
            } else if (item.child) {
                const childIndex = item.child.findIndex((child) => child.link === path);
                if (childIndex !== -1) {
                    // 檢查第二層
                    menuActive.value[0] = index;
                    menuActive.value[1] = childIndex;
                }
            }
        });
    } catch (error) {
        console.error("Error init ExpertView: ", error);
    }
}

onMounted(() => {
    init();
});

// 取得專家資料
const { data: expertQueryData, refetch: refetchExpertData } = useQuery({
    queryKey: ["expert", expert_id],
    queryFn: () => fetchExpertData(expert_id.value),
});
const expertData = computed(() => expertQueryData.value || {});

// 取得綁定的知識庫&技能
const { data: bindListQueryData } = useQuery({
    queryKey: ["bindList", expert_id],
    queryFn: () => fetchBindList(expert_id.value),
});
const binds = computed(() => bindListQueryData.value?.binds || []);
const datasetsList = computed(() => binds.value.filter((f) => f.datasets_id));
const skillsList = computed(() => binds.value.filter((f) => f.skill_id));

watch(
    expertData,
    (newExpertData) => {
        expertName.value = newExpertData.name || "讀取中...";
    },
    { immediate: true }
);

// 打開技能表單
const formUpdateRef = ref(null);
function openUpdateForm() {
    let title = "查看技能";
    let placeholder = "";
    let data = [
        { type: "text", name: "icon", placeholder: "icon圖示(fontawesome class)", readonly: true },
        { type: "text", name: "name", placeholder: "技能名稱", readonly: true },
        { type: "text", name: "class_name", placeholder: "技能class", readonly: true },
        { type: "textarea", name: "config_jsonb", placeholder: "json設定", readonly: true },
    ];
    formUpdateRef.value.open({ title, placeholder, data });
}
function getSkill(skill_id) {
    axios.get(`/skill/skill?skill_id=${skill_id}`).then((rs) => {
        if (rs.data.code === 0) {
            rs = rs.data.data[0];
            const obj = {
                skill_id: rs.id,
                icon: rs.icon,
                name: rs.name,
                class_name: rs.class,
                config_jsonb: JSON.stringify(rs.config_jsonb),
            };
            formUpdateRef.value.setFormData(obj);
            openUpdateForm();
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
    });
}

// 收合選單
const isMenuCollapsed = ref(false);
function toggleMenu() {
    isMenuCollapsed.value = !isMenuCollapsed.value;
}

// 替icon menu添加link
watch(isMenuCollapsed, () => {
    const modelSettingItem = menu.value.find((item) => item.text === "提示詞編排");
    const feedbackItem = menu.value.find((item) => item.text === "問答評價");
    const cacheItem = menu.value.find((item) => item.text === "快取");
    if (isMenuCollapsed.value) {
        modelSettingItem && (modelSettingItem.link = "search");
        feedbackItem && (feedbackItem.link = "feedbackTable");
        cacheItem && (cacheItem.link = "cache");
    } else {
        modelSettingItem && delete modelSettingItem.link;
        feedbackItem && delete feedbackItem.link;
        cacheItem && delete cacheItem.link;
    }
});
</script>

<template>
    <div class="documents">
        <div class="menu" :class="{ 'menu-collapsed': isMenuCollapsed }">
            <!-- 收合按鈕 -->
            <div class="collapse-button" @click="toggleMenu">
                <v-icon size="x-large">{{ isMenuCollapsed ? "mdi-chevron-right" : "mdi-chevron-left" }}</v-icon>
            </div>

            <div class="menu-content" :class="{ 'menu-collapsed': isMenuCollapsed }">
                <!-- 標題區域 -->
                <div class="title" :class="{ 'title-collapsed': isMenuCollapsed }">
                    <router-link to="/experts"><i class="fa-solid fa-arrow-left"></i></router-link>
                    <template v-if="!isMenuCollapsed">
                        <span><i class="fa-regular fa-folder-open"></i></span>
                        <p>{{ expertData.name }}</p>
                    </template>
                </div>

                <!-- 選單列表 -->
                <ul>
                    <li v-for="(item, index) in menu" :key="item">
                        <v-tooltip
                            :text="isMenuCollapsed ? item.text : ''"
                            location="right"
                            :disabled="!isMenuCollapsed"
                        >
                            <template v-slot:activator="{ props }">
                                <div
                                    v-bind="props"
                                    :class="{ active: menuActive[0] === index }"
                                    class="item"
                                    @click="changePage(item.link, item, index)"
                                >
                                    <span><i :class="item.icon"></i></span>
                                    <!-- 如果側選單收起，則不顯示文字 -->
                                    <p v-if="!isMenuCollapsed">{{ item.text }}</p>
                                    <!-- 收合按鈕 -->
                                    <div
                                        v-if="item.child && !isMenuCollapsed"
                                        class="ml-auto d-flex"
                                        @click.stop="item.child_open = !item.child_open"
                                    >
                                        <span v-if="!item.child_open" class="ma-auto">
                                            <i class="fa-solid fa-chevron-down"></i>
                                        </span>
                                        <span v-else class="ma-auto">
                                            <i class="fa-solid fa-chevron-up"></i>
                                        </span>
                                    </div>
                                </div>
                            </template>
                        </v-tooltip>

                        <!-- 子選單也需要添加 tooltip -->
                        <div
                            v-if="item.child && !isMenuCollapsed"
                            class="child-menu"
                            :class="{ 'child-menu-open': item.child_open }"
                        >
                            <v-tooltip
                                v-for="(childItem, childIndex) in item.child"
                                :key="childItem.text"
                                :text="isMenuCollapsed ? childItem.text : ''"
                                location="right"
                                :disabled="!isMenuCollapsed"
                            >
                                <template v-slot:activator="{ props }">
                                    <div
                                        v-bind="props"
                                        class="pl-10 item"
                                        :class="{
                                            active: menuActive[0] === index && menuActive[1] === childIndex,
                                        }"
                                        @click="changePage(childItem.link, childItem, index, childIndex)"
                                    >
                                        <span><i :class="childItem.icon"></i></span>
                                        <p>{{ childItem.text }}</p>
                                    </div>
                                </template>
                            </v-tooltip>
                        </div>
                    </li>
                </ul>

                <!-- 知識庫&技能 -->
                <div v-if="!isMenuCollapsed">
                    <div class="datasets-list">
                        <div class="dataset-title">
                            <p class="dataset-icon"><i :class="datasetsIcon"></i></p>
                            <p>關聯 {{ datasetsList.length }} 個知識庫</p>
                        </div>
                        <ul>
                            <router-link
                                :to="`/datasets/${item.datasets_id}/documents`"
                                v-for="(item, index) in datasetsList"
                                :key="index"
                                style="margin: 0.2rem"
                            >
                                <p class="dataset-icon"><i :class="item.icon || datasetsIcon"></i></p>
                                <p>{{ item.name }}</p>
                            </router-link>
                        </ul>
                    </div>

                    <div class="skills-list">
                        <div class="skills-title">
                            <p class="skills-icon"><i :class="skillsIcon"></i></p>
                            <p>關聯 {{ skillsList.length }} 個技能</p>
                        </div>
                        <ul>
                            <a
                                v-for="(item, index) in skillsList"
                                :key="index"
                                style="margin: 0.2rem"
                                @click="getSkill(item.skill_id)"
                            >
                                <p class="skills-icon"><i :class="item.icon || datasetsIcon"></i></p>
                                <p>{{ item.name }}</p>
                            </a>
                        </ul>
                    </div>
                </div>
                <FormComponents ref="formUpdateRef" @send="formUpdateRef.close()"></FormComponents>
            </div>
        </div>
        <router-view class="main" :data="expertData" :refetchExpertData="refetchExpertData()"></router-view>
    </div>
</template>

<style lang="scss" scoped>
.documents {
    display: flex;
    height: 100%;
    background-color: white;
    position: relative;

    .menu {
        width: 300px;
        border-right: 1px solid #e5e7eb;
        position: relative;
        transition: 0.5s;

        .menu-content {
            width: 100%;
            height: 100%;
            overflow-y: auto;
            padding: 1.5rem;

            .title {
                display: flex;
                align-items: center;
                margin-bottom: 2rem;
                transition: 0.5s;

                &.title-collapsed {
                    margin-bottom: 1rem;
                }

                a {
                    border-radius: 50%;
                    box-shadow: 0px 3px 5px #e6e7e9;
                    border: 1px solid #e6e7e9;
                    color: #1c64f2;
                    width: 2rem;
                    height: 2rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                span {
                    display: block;
                    color: #444ce7;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    border: 1px solid #e1e8f7;
                    margin-right: 0.5rem;
                    font-size: 1rem;
                    background-color: #f5f8ff;
                    margin-left: 0.8rem;
                }

                p {
                    word-break: break-all;
                }
            }

            ul {
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 0.5rem;
                margin-top: 0.5rem;

                .item {
                    border-radius: 0.3rem;
                    padding: 0.6rem;
                    display: flex;
                    align-items: center;
                    color: #333333;
                    margin: 0.2rem 0;
                    cursor: pointer;
                    transition: all 0.2s ease;

                    span {
                        font-size: 1rem;
                        margin-right: 0.5rem;
                    }

                    p {
                        font-size: 0.9rem;
                    }

                    &:hover {
                        background-color: #e9e9eb;
                    }

                    img {
                        width: 1.5rem;
                        height: 1.5rem;
                        border-radius: 0.5rem;
                        margin-right: 0.6rem;
                        border: 1px solid #e4e5e7;
                    }
                }

                a {
                    border-radius: 0.3rem;
                    padding: 0.6rem;
                    display: flex;
                    align-items: center;
                    color: #333333;
                    margin: 0.5rem 0;
                    cursor: pointer;

                    span {
                        font-size: 1rem;
                        margin-right: 0.5rem;
                    }

                    p {
                        font-size: 0.9rem;
                    }

                    &:hover {
                        background-color: #e9e9eb;
                    }
                }

                .active {
                    background-color: #ebf5ff;
                    color: #1c64f1;

                    &:hover {
                        background-color: #ebf5ff;
                    }
                }
            }
        }
    }

    .main {
        overflow-x: auto;
        padding: 1.5rem;
        width: 100%;
    }
}

.menu-collapsed {
    &.menu {
        width: 80px;
    }
    .menu-content {
        padding: 1.5rem 0.5rem !important;
        .item {
            justify-content: center;
            padding: 0.6rem;

            span {
                margin-right: 0;
            }
        }
        .title {
            justify-content: center;
        }
    }
}

.datasets-list {
    .dataset-title {
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        font-size: 0.9rem;
        padding: 1rem 0.2rem 0 0;
        cursor: pointer;
    }
    .dataset-icon {
        color: rgb(106, 174, 233);
        margin-right: 0.5rem;
    }
}

.skills-list {
    .skills-title {
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        font-size: 0.9rem;
        padding: 1rem 0.2rem 0 0;
        cursor: pointer;
    }
    .skills-icon {
        color: rgb(104, 197, 127);
        margin-right: 0.5rem;
    }
}

.collapse-button {
    width: 20px;
    height: 100px;
    background-color: #efefef;
    border: 1px solid #e5e7eb;
    border-radius: 0 5px 5px 0;
    box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
    font-size: 12px;
    color: #737373;
    position: absolute;
    top: 50%;
    right: 0;
    transform: translate(100%, -50%);
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: 0.5s;

    &:hover {
        background-color: #f3f4f6;
    }
}

.child-menu {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
}

.child-menu-open {
    max-height: 500px;
    transition: max-height 0.3s ease-in;
}
</style>
