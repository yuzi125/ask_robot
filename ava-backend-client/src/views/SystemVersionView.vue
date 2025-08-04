<script setup>
import { ref, inject, onMounted } from "vue";
import InputComponents from "../components/InputComponents.vue";

const axios = inject("axios");
const emitter = inject("emitter");

onMounted(() => {
    init();
});

const version = ref({});

const init = async function () {
    let rs = await axios.get("/system/getSystemVersion");
    if (rs.data.code === 0) {
        version.value.text = rs.data.data;
    }
};

const updateVersion = async function (item) {
    const { text } = item;
    let rs = await axios.put("/system/updateSystemVersion", { text });
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
};
</script>

<template>
    <div class="bulletin_view">
        <div class="list d-flex text-no-wrap">
            <p class="mt-3 mr-3 text-h6">版本號</p>
            <InputComponents :data="version" @send="updateVersion"></InputComponents>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.bulletin_view {
    // border-left: 1px solid #e5e7eb;
    padding: 2rem;
    width: 100%;
    height: 100%;

    .list {
        min-width: 500px;
        max-width: 800px;
    }
}
</style>
