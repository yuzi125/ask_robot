<script setup>
import InputComponents from "../components/InputComponents.vue";
import { useUserStore } from "../store/index";
import { ref, inject, watch } from "vue";
import { storeToRefs } from "pinia";
import router from "@/router";
const axios = inject("axios");
const emitter = inject("emitter");

const snackbar = ref({ show: false, message: "" });
const userStore = useUserStore();
const { nickname, email, image, uid, authSetting } = storeToRefs(userStore);
const nicknameObj = ref({ text: nickname.value });
const emailObj = ref({ text: email.value });
const passwordObj = ref({ text: "", edit: false });

async function changePWD(data) {
    // 檢查密碼是否符合格式
    const isValid = Object.values(passwordValidation.value).every((value) => value === true);
    if (!isValid) {
        emitter.emit("openSnackbar", { message: "密碼格式不正確，請再檢查一次。", color: "error" });
        passwordObj.value.edit = true;
        return;
    }
    // 限制密碼只能包含大寫字母、小寫字母、數字、符號，不能包含其他字符
    const allowedWords = /^[A-Za-z0-9!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*$/;
    const hasNotAllowedWord = !allowedWords.test(data.text);
    if (hasNotAllowedWord) {
        emitter.emit("openSnackbar", { message: "包含例外字元，僅允許英文、數字與特殊符號", color: "error" });
        passwordObj.value.edit = true;
        return;
    }

    // 執行改密碼
    let rs = await axios.post("/user/changePassword", { uid: uid.value, pwd: btoa(data.text) });

    if (rs && rs.data && rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

const passwordValidation = ref({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    specialSymbols: false,
});

watch(
    () => passwordObj.value.text,
    (newV) => {
        passwordValidation.value.minLength = passwordObj.value.text.length >= 8; // 檢查長度
        passwordValidation.value.hasUppercase = /[A-Z]/.test(passwordObj.value.text); // 檢查大寫字母
        passwordValidation.value.hasLowercase = /[a-z]/.test(passwordObj.value.text); // 檢查小寫字母
        passwordValidation.value.hasNumber = /\d/.test(passwordObj.value.text); // 檢查數字
        passwordValidation.value.specialSymbols = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(passwordObj.value.text); // 檢查特殊符號
    }
);

const updateUserEmail = async function (item) {
    console.log("item", item);
    const { text } = item;
    console.log("uid", uid.value);
    let rs = await axios.post("/user/update", { uid: uid.value, email: text });
    console.log("rs", rs);
    if (rs.data.code === 201) {
        item.edit = false;
        snackbar.value.show = true;
        snackbar.value.message = "修改成功";
    }
};

const updateUserName = async function (item) {
    const { text } = item;
    let rs = await axios.post("/user/update", { uid: uid.value, name: text });
    if (rs.data.code === 201) {
        nickname.value = rs.data.data;

        item.edit = false;
        snackbar.value.show = true;
        snackbar.value.message = "修改成功";
    }
};

// 二次驗證
async function toAuthPage() {
    await axios.get("/user/createJustTwoFactorAuth");
    router.push("/two-factor-authentication");
}
</script>

<template>
    <div class="datasets_set_com">
        <v-snackbar :timeout="2000" v-model="snackbar.show">已保存</v-snackbar>
        <div class="title">
            <p>修改用戶資料</p>
        </div>
        <v-avatar size="100"> <img :src="image" alt="用戶大頭貼" /></v-avatar>
        <v-form @submit.prevent="">
            <v-row>
                <v-col cols="12" class="mt-5 ma-0 pa-0">
                    <InputComponents :data="nicknameObj" @send="updateUserName"></InputComponents>
                    <!-- <v-text-field label="用戶名稱" v-model="nickname"></v-text-field> -->
                </v-col>
                <v-col cols="12" class="ma-0 pa-0">
                    <span>變更密碼</span>
                    <InputComponents
                        :data="passwordObj"
                        @send="changePWD"
                        :isPassword="true"
                        :autocomplete="true"
                    ></InputComponents>
                    <div v-if="passwordObj.edit">
                        <p>密碼格式限制</p>
                        <p :style="{ color: passwordValidation.minLength ? 'green' : 'red' }">
                            <i class="fa-regular fa-circle-check"></i> 最少8個字
                        </p>
                        <p :style="{ color: passwordValidation.hasUppercase ? 'green' : 'red' }">
                            <i class="fa-regular fa-circle-check"></i> 大寫字母：A到Z
                        </p>
                        <p :style="{ color: passwordValidation.hasLowercase ? 'green' : 'red' }">
                            <i class="fa-regular fa-circle-check"></i> 小寫字母：a到z
                        </p>
                        <p :style="{ color: passwordValidation.hasNumber ? 'green' : 'red' }">
                            <i class="fa-regular fa-circle-check"></i> 數字：0到9
                        </p>
                        <p :style="{ color: passwordValidation.specialSymbols ? 'green' : 'red' }">
                            <i class="fa-regular fa-circle-check"></i> 使用特殊字元
                        </p>
                    </div>
                </v-col>
                <v-col v-if="authSetting && authSetting.useAuth === 1" cols="12" class="ma-0 pa-0">
                    <div class="mb-3 d-flex ga-3 align-center">
                        <p class="font-weight-black">二次驗證</p>
                        <v-btn v-if="authSetting.isEnable" color="error" @click="toAuthPage()">停用二次驗證</v-btn>
                        <v-btn v-else color="success" @click="toAuthPage()">啟用二次驗證</v-btn>
                    </div>
                </v-col>
            </v-row>
        </v-form>
    </div>
</template>

<style scoped>
.datasets_set_com {
    .title {
        margin-bottom: 1rem;
        p {
            font-size: 1.3rem;
            margin-bottom: 1rem;
        }
    }
}

.two-factor-authentication-wrap {
    padding: 12px;
    border: 1px dashed black;
    border-radius: 12px;
}
</style>
