<script setup>
import { ref, onMounted, onUnmounted, inject, toRefs, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStateStore, usePermissionStore } from "../store/index";
import { storeToRefs } from "pinia";
import { usePermissionChecker } from "@/composables";
const stateStore = useStateStore();
const { datasetsName, datasetsFolderName, datasetsDescribe } = storeToRefs(stateStore);

const route = useRoute();
const router = useRouter();
const axios = inject("axios");

const props = defineProps({
    datasets_id: { type: String, default: "" },
});
const { datasets_id } = toRefs(props, "datasets_id");
const menuActive = ref([-1, -1]);
const permissionStore = usePermissionStore();
const { enableCrawler } = storeToRefs(permissionStore);
const { canPerformAction: canUploadDocument } = usePermissionChecker("allowedToUploadDocument");
const controller = new AbortController();
const menu = ref([
    { icon: "fa-solid fa-table", text: "概覽", link: "overview" },
    {
        icon: "fa-solid fa-file",
        text: "文件",
        child: [
            ...(canUploadDocument.value
                ? [{ icon: "fa-solid fa-file-arrow-up", text: "上傳文件", link: "source" }]
                : []),
            { icon: "fa-solid fa-file-lines", text: "文件清單", link: "documents" },
        ],
        child_open: true,
    },
    { icon: "fa-solid fa-terminal", text: "提示詞編排", link: "configuration", dataCy: "configuration-btn" },
    { icon: "fa-solid fa-gear", text: "設定", link: "settings", dataCy: "settings-btn" },
]);

const crawlerMenuItem = {
    icon: "fa-solid fa-spider",
    text: "爬蟲",
    child_open: true,
    child: [
        { icon: "fa-solid fa-list", text: "站點清單", link: "crawlerSite", dataCy: "crawler-site-btn" },
        { icon: "fa-solid fa-sync", text: "已同步站點", link: "syncCrawler", dataCy: "sync-crawler-btn" },
        { icon: "fa-solid fa-clock", text: "排程", link: "crawlerSchedule", dataCy: "crawler-schedule-btn" },
    ],
};

const crawlerAttachmentMenuItem = {
    icon: "fa-solid fa-paperclip",
    text: "爬蟲附件",
    child_open: true,
    child: [
        {
            icon: "fa-solid fa-list",
            text: "站點清單",
            link: "crawlerAttachmentSite",
            dataCy: "attachment-crawler-site-btn",
        },
        {
            icon: "fa-solid fa-sync",
            text: "已同步站點",
            link: "syncAttachmentCrawler",
            dataCy: "sync-attachment-crawler-btn",
        },
        {
            icon: "fa-solid fa-clock",
            text: "排程",
            link: "crawlerAttachmentSchedule",
            dataCy: "attachment-crawler-schedule-btn",
        },
    ],
};

// 監聽 canUploadDocument 的變化
watch(canUploadDocument, (newValue) => {
    const fileMenuItem = menu.value[0];
    if (newValue) {
        // 如果允許上傳且選單中還沒有上傳文件選項
        if (!fileMenuItem.child.some((item) => item.text === "上傳文件")) {
            fileMenuItem.child.unshift({ icon: "fa-solid fa-file-arrow-up", text: "上傳文件", link: "source" });
        }
    } else {
        // 如果不允許上傳且選單中有上傳文件選項，則移除
        const uploadIndex = fileMenuItem.child.findIndex((item) => item.text === "上傳文件");
        if (uploadIndex !== -1) {
            fileMenuItem.child.splice(uploadIndex, 1);
        }
    }
});

watch(enableCrawler, (newValue) => {
    if (newValue) {
        if (!menu.value.some((item) => item.text === "爬蟲")) {
            menu.value.splice(1, 0, crawlerMenuItem);
            menu.value.splice(2, 0, crawlerAttachmentMenuItem);
        }
    } else {
        const index = menu.value.findIndex((item) => item.text === "爬蟲");
        if (index !== -1) {
            menu.value.splice(index, 1);
        }
    }
});

if (enableCrawler.value) {
    menu.value.splice(1, 0, crawlerMenuItem);
    menu.value.splice(2, 0, crawlerAttachmentMenuItem);
}

onMounted(() => {
    init();
});

onUnmounted(() => {
    controller.abort();
});

const expertActive = ref(-1);
const expertData = ref([]);
async function init() {
    try {
        const tableName = "datasets";
        const recordId = props.datasets_id;
        const response = await axios.get(
            `/common/checkRecordEnableStatus?tableName=${tableName}&recordId=${recordId}`,
            { signal: controller.signal }
        );

        if (response.data.code === 1) {
            return router.push({ name: "not-found" });
        }

        const path = route.matched[1]?.path?.split("/")[3];
        menuActive.value = [-1, -1]; // 重置 menuActive
        menu.value.forEach((item, index) => {
            if (item.link === path) {
                menuActive.value[0] = index;
                menuActive.value[1] = -1;
            } else if (item.child) {
                let childIndex = item.child.findIndex((f) => f.link === path);
                if (childIndex !== -1) {
                    menuActive.value[0] = index;
                    menuActive.value[1] = childIndex;
                }
            }
        });
        let rs = await axios.get(`/datasets/expertList?datasets_id=${datasets_id.value}`, {
            signal: controller.signal,
        });
        expertData.value = rs.data.data;
        rs = await axios.get(`/datasets/datasets?datasets_id=${datasets_id.value}`, {
            signal: controller.signal,
        });
        datasetsFolderName.value = rs.data.data[0]?.folder_name;
        datasetsName.value = rs.data.data[0]?.name;
    } catch (error) {
        console.error("Error : ", error);
    }
}
watch(route, (newV) => {
    if (newV.matched[0].path === "/datasets/:datasets_id") {
        init();
    }
});
function toggleChildMenu(item, event) {
    item.child_open = !item.child_open;
}

function changePage(link, item, index, childIndex = -1) {
    if (item.child && !isMenuCollapsed.value) {
        toggleChildMenu(item);
    } else {
        router.push(`/datasets/${datasets_id.value}/${link}`);
    }
    menuActive.value = [index, childIndex];
}

const isMenuCollapsed = ref(false);
// 替Icon menu 加上 link
watch(isMenuCollapsed, () => {
    const crawlerMenuItem = menu.value.find((item) => item.text === "爬蟲");
    const fileMenuItem = menu.value.find((item) => item.text === "文件");
    if (isMenuCollapsed.value) {
        crawlerMenuItem.link = "syncCrawler";
        fileMenuItem.link = "documents";
    } else {
        delete crawlerMenuItem.link;
        delete fileMenuItem.link;
    }
});

function toggleMenu() {
    isMenuCollapsed.value = !isMenuCollapsed.value;
}
</script>
<template>
    <div class="documents">
        <div class="menu" :class="{ 'menu-collapsed': isMenuCollapsed }">
            <div class="collapse-button" @click="toggleMenu">
                <v-icon size="x-large">{{ isMenuCollapsed ? "mdi-chevron-right" : "mdi-chevron-left" }}</v-icon>
            </div>
            <div class="menu-content" :class="{ 'menu-collapsed': isMenuCollapsed }">
                <div class="title" :class="{ 'title-collapsed': isMenuCollapsed }">
                    <router-link to="/datasets"><i class="fa-solid fa-arrow-left"></i></router-link>
                    <template v-if="!isMenuCollapsed">
                        <span><i class="fa-regular fa-folder-open"></i></span>
                        <p>{{ datasetsName }}</p>
                    </template>
                </div>

                <ul>
                    <li v-for="(item, index) in menu" :key="item.text">
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
                                    :data-cy="item.dataCy"
                                >
                                    <span><i :class="item.icon"></i></span>
                                    <p v-if="!isMenuCollapsed">{{ item.text }}</p>
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

                        <div
                            v-if="item.child && !isMenuCollapsed"
                            class="child-menu"
                            :class="{ 'child-menu-open': item.child_open }"
                            :data-cy="item.dataCy"
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
                                        :class="{ active: menuActive[0] === index && menuActive[1] === childIndex }"
                                        @click="changePage(childItem.link, childItem, index, childIndex)"
                                        :data-cy="childItem.dataCy"
                                    >
                                        <span><i :class="childItem.icon"></i></span>
                                        <p>{{ childItem.text }}</p>
                                    </div>
                                </template>
                            </v-tooltip>
                        </div>
                    </li>
                </ul>

                <!-- 專家列表區域 -->
                <template v-if="!isMenuCollapsed">
                    <div class="expert-title" style="font-size: 0.9rem; padding: 1rem 0.2rem 0 0">
                        <span><i class="fa-solid fa-user-tie"></i></span>
                        <p>{{ expertData.length }} 個關聯專家</p>
                    </div>
                    <ul>
                        <router-link
                            :to="`/experts/${item.id}/binding`"
                            class="item"
                            v-for="(item, index) in expertData"
                            :key="index"
                            :class="{ active: expertActive === index }"
                            style="padding: 0.2rem"
                        >
                            <img :src="item.avatar" alt="" />
                            <p>{{ item.name }}</p>
                        </router-link>
                    </ul>
                </template>
            </div>
        </div>
        <router-view class="main" :class="{ 'main-shifted': isMenuCollapsed }"></router-view>
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

        &.menu-collapsed {
            width: 80px;
        }

        .menu-content {
            width: 100%;
            height: 100%;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            padding: 1.5rem;
            &.menu-collapsed {
                padding: 1.5rem 0.5rem;

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

        .title {
            display: flex;
            align-items: center;
            padding: 1rem 0;

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
                margin: 0 0.5rem 0 0.8rem;
                font-size: 1rem;
                background-color: #f5f8ff;
            }

            p {
                word-break: break-all;
                flex: 1;
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

            .active {
                background-color: #ebf5ff;
                color: #1c64f1;

                &:hover {
                    background-color: #ebf5ff;
                }
            }
        }

        .expert-title {
            display: flex;
            align-items: center;
            padding: 1rem 0;

            span {
                color: rgb(139, 139, 139);
                margin-right: 0.5rem;
            }
        }

        .collapse-button {
            font-size: 12px;
            color: #737373;
            position: absolute;
            top: 50%;
            right: 0;
            transform: translate(100%, -50%);
            width: 20px;
            height: 100px;
            background-color: #efefef;
            border: 1px solid #e5e7eb;
            border-radius: 0 5px 5px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 101;
            box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
            transition: 0.5s;

            &:hover {
                background-color: #f3f4f6;
            }
        }
    }

    .main {
        overflow-x: auto;
        flex: 1;
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
