<script setup>
import { onMounted, provide, ref } from "vue";
import NavbarComponents from "./components/NavbarComponents.vue";
import SnackbarsComponents from "./components/SnackbarsComponents.vue";
import { useStateStore, useSettingStore } from "./store/index";
import { storeToRefs } from "pinia";
import { VueQueryDevtools } from "@tanstack/vue-query-devtools";
import { sanitizeUrl } from "@braintree/sanitize-url";
import ProgressBar from "./components/ProgressBar.vue";
const stateStore = useStateStore();
const { routeKey } = storeToRefs(stateStore);
import { useRoute } from "vue-router";
const route = useRoute();

//setting store
const settingStore = useSettingStore();
const { maxFileSize, maxImageSize, sessionLimit, banIpExpireDate } = storeToRefs(settingStore);

import axios from "./global/axios";
import emitter from "./global/emitter";

provide("axios", axios);
provide("emitter", emitter);

onMounted(() => {
    ui_init();
    event_init();
    checkBrowserType();
    openUrl();
});
function ui_init() {
    let navbarHieght = document.querySelector(".container1").clientHeight;
    document.querySelector(".container2").style.height = `calc(100% - ${navbarHieght}px)`;
}
function event_init() {
    emitter.on("openSnackbar", (msg) => {
        const snackbar = { show: true, message: msg.message, color: msg.color };
        snackbars.value.create(snackbar);
    });
}

function openUrl() {
    emitter.on("openUrl", (url) => {
        // 清洗 URL
        let sanitizedUrl = sanitizeUrl(url);

        // 判斷是否是相對路徑的下載 URL
        if (!sanitizedUrl.startsWith("http://") && !sanitizedUrl.startsWith("https://")) {
            if (sanitizedUrl.startsWith("/")) {
                // 如果是相對路徑，保持原樣
                sanitizedUrl = url;
            } else {
                // 如果不是相對路徑，則添加協議
                sanitizedUrl = `http://${sanitizedUrl}`;
            }
        }

        // 驗證清洗後的 URL 是否有效
        if (sanitizedUrl !== "about:blank") {
            // 檢查 URL 是否包含下載路徑的特徵
            if (sanitizedUrl.includes("/download/")) {
                // 如果是下載 URL，直接導航到該 URL
                window.location.href = sanitizedUrl;
            } else {
                // 否則在新分頁中打開
                window.open(sanitizedUrl, "_blank");
            }
        } else {
            console.warn("Invalid URL after sanitization:", url);
        }
    });
}

async function init() {
    let rs = await axios.get("/system/getSettings");
    if (rs.data.code === 0) {
        rs = rs.data.data;
        maxFileSize.value = rs.maxFileSize;
        maxImageSize.value = rs.maxImageSize;
        sessionLimit.value = rs.sessionLimit;
        banIpExpireDate.value = rs.banIpExpireDate;
    }
}
init();
/* color=>success,info,warning,error */
// const snackbar = ref({ show: false, message: "", color: "" });
const snackbars = ref(null);

// 檢查目前的瀏覽器(目前只支援Chrome與Edge)
const checkBrowserType = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Edg") > -1) {
        return;
    } else if (userAgent.indexOf("Chrome") > -1) {
        return;
    } else {
        console.log("不支援的瀏覽器: ", userAgent);
        emitter.emit("openSnackbar", {
            message: "不支援的瀏覽器 : 請使用Chrome或Edge瀏覽器",
            color: "error",
        });
    }
};
</script>

<template>
    <ProgressBar color="#3498db" />
    <div class="wrap">
        <div v-if="!route.path.match('two-factor-authentication')" class="container1">
            <NavbarComponents></NavbarComponents>
        </div>
        <div class="container2">
            <router-view :key="routeKey"></router-view>
        </div>
        <SnackbarsComponents ref="snackbars"></SnackbarsComponents>
    </div>
    <VueQueryDevtools />
</template>

<style lang="scss">
.wrap {
    width: 100%;
    height: 100vh;
}
</style>
