<script setup>
import { useRouter } from "vue-router";
const router = useRouter();
import { useSettingsStore, useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
const settingsStore = useSettingsStore();
const stateStore = useStateStore();
const { is_maintenance } = storeToRefs(settingsStore);
const { db_error } = storeToRefs(stateStore);

if (is_maintenance.value === "0" && !db_error.value) {
    router.push("/");
}
</script>

<template>
    <div class="flex flex-col items-center justify-center w-full h-full gap-3 text-lg font-bold">
        <img class="w-20 h-20 swing" src="../../public/robot.png" alt="" />
        <p class="">親愛的用戶，您好：</p>
        <p>系統正在維護中，我們會盡快完成維護，謝謝您的耐心等待與理解。</p>
    </div>
</template>

<style scope>
@keyframes swing {
    0% {
        transform: rotate(-10deg);
    }
    50% {
        transform: rotate(10deg);
    }
    100% {
        transform: rotate(-10deg);
    }
}

.swing {
    display: inline-block;
    animation: swing 2s ease-in-out infinite;
}
</style>
