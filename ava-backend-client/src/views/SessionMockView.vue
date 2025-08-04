<script setup>
import { ref, inject } from "vue";
const axios = inject("axios");
const emitter = inject("emitter");
const kkk = ref("");
async function sss() {
    let rs = await axios.post("/system/sss", JSON.stringify({ kkk: kkk.value }));
    console.log(rs.data);
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}
</script>

<template>
    <div class="session_mock_view">
        <v-text-field v-model="kkk"></v-text-field>
        <v-btn width="100%" @click="sss">送出</v-btn>
    </div>
</template>

<style lang="scss" scoped>
.session_mock_view {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: white;
    overflow-y: auto;
}
</style>
