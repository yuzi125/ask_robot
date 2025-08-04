<script setup>
import { ref } from "vue";
import MenuComponents from "../components/MenuComponents.vue";

const menu = ref([
    {
        icon: "fa-solid fa-database",
        text: "系統用量",
        child: [
            { icon: "fa-solid fa-file-lines", text: "文件", link: "documents" },
            { icon: "fa-solid fa-earth-americas", text: "網站", link: "syncweb" },
        ],
        child_open: true,
    },
]);
</script>

<template>
    <div class="overview_view">
        <MenuComponents :menu="menu" :width="'300px'"></MenuComponents>
        <router-view class="main"></router-view>
    </div>
</template>

<style lang="scss" scoped>
$color3: rgb(139, 139, 139);

.overview_view {
    background-color: white;
    height: 100%;
    display: flex;
    .main {
        overflow-x: auto;
        width: 100%;
    }
}
</style>
