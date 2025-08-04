<script setup>
import { ref, inject } from "vue";

const axios = inject("axios");

const openCreateUserPanel = ref(false);
const userData = ref({
    name: "",
    account: "",
    pwd: "",
});

function openCreateUser() {
    openCreateUserPanel.value = true;
}

async function createUser() {
    const { name, account, pwd } = userData.value;
    if (!name || !account || !pwd) {
        return alert("填寫不完全!");
    }

    const rs = await axios.post("/user/createUser", JSON.stringify(userData.value));
    if (rs && rs.data && rs.data.code === 0) {
        return alert("建立成功!!!");
    } else {
        return alert("建立失敗~~");
    }
}
</script>

<template>
    <div class="create_user">
        <v-btn class="ma-4" @click="openCreateUser">建立使用者帳號</v-btn>

        <div v-if="openCreateUserPanel" class="ms-6 d-flex ga-6">
            <div>
                <v-text-field v-model="userData.name" hide-details label="使用者名稱" width="300"></v-text-field>
                <v-text-field v-model="userData.account" hide-details label="使用者帳號" width="300"></v-text-field>
                <v-text-field v-model="userData.pwd" hide-details label="使用者密碼" width="300"></v-text-field>
            </div>
            <v-btn @click="createUser" color="success">建立</v-btn>
            <v-btn icon="fa-solid fa-xmark" @click="openCreateUserPanel = false"></v-btn>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.create_user {
    padding: 20px;
}
</style>
