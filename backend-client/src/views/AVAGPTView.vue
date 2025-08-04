<script setup>
import { ref, onMounted, onUnmounted, inject, toRefs, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePermissionChecker } from "@/composables";

const { canPerformAction: canViewSuperAdmin } = usePermissionChecker("allowedToViewSuperAdmin");

const route = useRoute();
const router = useRouter();
const emitter = inject("emitter");

const menuActive = ref([-1, -1]);

const controller = new AbortController();
const menu = ref([
    { icon: "fa-solid fa-table", text: "概覽", link: "overview" },

    { icon: "fa-solid fa-wallet", text: "餘額管理", link: "balance" },
    ...(canViewSuperAdmin.value
        ? [
              { icon: "fa-solid fa-comment-dots", text: "聊天歷史", link: "chat" },
              { icon: "fa-solid fa-folder-open", text: "文件清單", link: "files" },
              { icon: "fa-solid fa-share-nodes", text: "聊天分享連結", link: "share-links" },
          ]
        : []),
]);

onMounted(() => {
    init();
});

onUnmounted(() => {
    controller.abort();
});

async function init() {
    try {
        const currentPath = route.path.split("/").pop();
        menuActive.value = [-1, -1]; // 重置 menuActive

        menu.value.forEach((item, index) => {
            if (item.link === currentPath) {
                menuActive.value[0] = index;
                menuActive.value[1] = -1;
            } else if (item.child) {
                let childIndex = item.child.findIndex((f) => f.link === currentPath);
                if (childIndex !== -1) {
                    menuActive.value[0] = index;
                    menuActive.value[1] = childIndex;
                }
            }
        });

        if (menuActive.value[0] === -1) {
            menuActive.value = [0, -1];
        }
    } catch (error) {
        console.error("Error : ", error);
    }
}

watch(route, (newRoute) => {
    const currentPath = newRoute.path.split("/").pop();
    menu.value.forEach((item, index) => {
        if (item.link === currentPath) {
            menuActive.value[0] = index;
            menuActive.value[1] = -1;
        } else if (item.child) {
            let childIndex = item.child.findIndex((f) => f.link === currentPath);
            if (childIndex !== -1) {
                menuActive.value[0] = index;
                menuActive.value[1] = childIndex;
            }
        }
    });
});

function toggleChildMenu(item, event) {
    item.child_open = !item.child_open;
}

function changePage(link, item, index, childIndex = -1) {
    if (item.child && !isMenuCollapsed.value) {
        toggleChildMenu(item);
    } else {
        router.push(`/ava-gpt/${link}`);
    }
    menuActive.value = [index, childIndex];
}

const isMenuCollapsed = ref(false);

function toggleMenu() {
    isMenuCollapsed.value = !isMenuCollapsed.value;

    setTimeout(() => {
        emitter.emit("resize");
    }, 500);
}
</script>
<template>
    <div class="ava-gpt-view">
        <div class="menu" :class="{ 'menu-collapsed': isMenuCollapsed }">
            <div class="collapse-button" @click="toggleMenu">
                <v-icon size="x-large">{{ isMenuCollapsed ? "mdi-chevron-right" : "mdi-chevron-left" }}</v-icon>
            </div>
            <div class="menu-content" :class="{ 'menu-collapsed': isMenuCollapsed }">
                <div class="title" :class="{ 'title-collapsed': isMenuCollapsed }">
                    <router-link to="/datasets"><i class="fa-solid fa-arrow-left"></i></router-link>
                    <template v-if="!isMenuCollapsed">
                        <span><i class="fa-solid fa-robot"></i></span>
                        <p>AVA-GPT</p>
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
            </div>
        </div>
        <router-view class="main" :class="{ 'main-shifted': isMenuCollapsed }"></router-view>
    </div>
</template>

<style lang="scss" scoped>
.ava-gpt-view {
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
