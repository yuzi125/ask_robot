<script setup>
import { ref, watch, inject } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useToast } from "@/components/ui/toast";
const { toast } = useToast();
const emitter = inject("emitter");

import { storeToRefs } from "pinia";
import { useUserStore } from "../store";
const userStore = useUserStore();
const { tempUser } = storeToRefs(userStore);

import axios from "@/global/axios";

const router = useRouter();
const route = useRoute();
const account = ref("");
const password = ref("");
const showPassword = ref(false);

const login = async () => {
    // 在這裡添加登入邏輯，例如驗證使用者憑證
    if (!account.value || !password.value) {
        return toast({
            title: "請輸入帳號與密碼",
            description: "",
            variant: "destructive",
        });
    }

    // 驗證
    let rs = await axios.post("/KSG/login", btoa(JSON.stringify({ account: account.value, password: password.value })));
    if (rs?.data?.code === 401) {
        toast({
            title: rs.data.message,
            description: "",
            variant: "destructive",
        });
    } else if (rs?.data?.code === 0) {
        toast({
            title: "登入成功",
            description: "",
            variant: "success",
        });
        router.push("/");
        emitter.emit("login_success");
    } else if (rs?.data?.code === 403) {
        if (rs.data.data && rs.data.data.isLoginBefore === 0) {
            showChangePassword.value = true;
            toast({
                title: "歡迎來到智能客服",
                description: "第一次登入請先變更密碼。",
                variant: "success",
            });
            password.value = "";
        } else if (rs.data.data && rs.data.data.passwordExpired) {
            showChangePassword.value = true;
            toast({
                title: "您的密碼已經90天未更新囉!",
                description: "請先變更密碼後，再重新登入。",
                variant: "destructive",
            });
            password.value = "";
        } else {
            toast({
                title: rs.data.message || "登入失敗。",
                description: "",
                variant: "destructive",
            });
        }
    }
};

const showChangePassword = ref(false);
if (route.query.changePassword === "true") {
    showChangePassword.value = true;
}

const showInputPWD = ref({
    firstPWD: false,
    secondPWD: false,
});
const firstInputPWD = ref("");
const secondInputPWD = ref("");
const changePWD = async () => {
    // 檢查密碼是否符合格式
    const isValid = Object.values(passwordValidation.value).every((value) => value === true);
    if (!isValid) {
        toast({
            title: "密碼格式不正確",
            description: "請再檢查一次",
            variant: "destructive",
        });
        return;
    }
    // 限制密碼只能包含大寫字母、小寫字母、數字、符號，不能包含其他字符
    const allowedWords = /^[A-Za-z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*$/;
    const hasNotAllowedWord = !allowedWords.test(firstInputPWD.value);
    if (hasNotAllowedWord) {
        toast({
            title: "包含例外字元",
            description: "僅允許英文、數字與特殊符號",
            variant: "destructive",
        });
        return;
    }

    if (firstInputPWD.value !== secondInputPWD.value) {
        toast({
            title: "兩次密碼輸入不一致",
            description: "請重新檢查後再送出",
            variant: "destructive",
        });
        return;
    }

    // 執行改密碼
    const uid = tempUser.uid;

    let rs = await axios.post(
        "/KSG/changePassword",
        btoa(JSON.stringify({ uid, account: account.value, password: firstInputPWD.value }))
    );

    if (rs && rs.data && rs.data.code === 0) {
        toast({
            title: "修改密碼成功",
            description: "請使用新密碼登入。",
            variant: "success",
        });
        showChangePassword.value = false;
    } else {
        toast({
            title: rs.data.message,
            description: "",
            variant: "destructive",
        });
    }
};

const passwordValidation = ref({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    specialSymbols: false,
});

watch(
    () => firstInputPWD.value,
    (newV) => {
        passwordValidation.value.minLength = newV.length >= 8; // 檢查長度
        passwordValidation.value.hasUppercase = /[A-Z]/.test(newV); // 檢查大寫字母
        passwordValidation.value.hasLowercase = /[a-z]/.test(newV); // 檢查小寫字母
        passwordValidation.value.hasNumber = /\d/.test(newV); // 檢查數字
        passwordValidation.value.specialSymbols = /[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(newV); // 檢查特殊符號
    }
);
</script>

<template>
    <div class="flex items-center justify-center min-h-screen bg-gray-200">
        <div class="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold text-center">
                {{ showChangePassword ? "變更密碼" : "登入-智能客服" }}
            </h2>
            <p
                v-if="showChangePassword"
                class="text-xs text-gray-500 cursor-pointer text-end hover:text-blue-500"
                @click="showChangePassword = false"
            >
                取消變更
            </p>
            <form v-if="!showChangePassword" @submit.prevent="login">
                <div>
                    <label class="block text-gray-700">帳號</label>
                    <input
                        v-model="account"
                        type="text"
                        class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="請輸入帳號"
                    />
                </div>
                <div class="mt-4">
                    <label class="block text-gray-700">密碼</label>
                    <div class="relative">
                        <input
                            v-model="password"
                            :type="showPassword ? 'text' : 'password'"
                            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="請輸入密碼"
                        />
                        <button
                            type="button"
                            class="absolute inset-y-0 right-0 flex items-center px-3"
                            @click="showPassword = !showPassword"
                        >
                            <span v-if="showPassword">
                                <i class="fa-solid fa-eye"></i>
                            </span>
                            <span v-else>
                                <i class="fa-solid fa-eye-slash"></i>
                            </span>
                        </button>
                    </div>
                </div>
                <button class="w-full px-4 py-2 mt-6 text-white bg-blue-500 rounded-md hover:bg-blue-600">登入</button>
            </form>
            <form v-else @submit.prevent="changePWD">
                <div>
                    <label class="block text-gray-700">密碼</label>
                    <div class="relative">
                        <input
                            v-model="firstInputPWD"
                            :type="showInputPWD.firstPWD ? 'text' : 'password'"
                            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="請輸入密碼"
                        />
                        <button
                            type="button"
                            class="absolute inset-y-0 right-0 flex items-center px-3"
                            @click="showInputPWD.firstPWD = !showInputPWD.firstPWD"
                        >
                            <span v-if="showInputPWD.firstPWD">
                                <i class="fa-solid fa-eye"></i>
                            </span>
                            <span v-else>
                                <i class="fa-solid fa-eye-slash"></i>
                            </span>
                        </button>
                    </div>
                </div>
                <div class="mt-4">
                    <label class="block text-gray-700">再次確認密碼</label>
                    <div class="relative">
                        <input
                            v-model="secondInputPWD"
                            :type="showInputPWD.secondPWD ? 'text' : 'password'"
                            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="請輸入密碼"
                        />
                        <button
                            type="button"
                            class="absolute inset-y-0 right-0 flex items-center px-3"
                            @click="showInputPWD.secondPWD = !showInputPWD.secondPWD"
                        >
                            <span v-if="showInputPWD.secondPWD">
                                <i class="fa-solid fa-eye"></i>
                            </span>
                            <span v-else>
                                <i class="fa-solid fa-eye-slash"></i>
                            </span>
                        </button>
                    </div>
                </div>
                <div class="mt-4 space-y-2">
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
                <button
                    :disabled="firstInputPWD === '' || secondInputPWD === ''"
                    :class="
                        firstInputPWD === '' || secondInputPWD === '' ? 'bg-blue-100' : 'bg-blue-500 hover:bg-blue-600'
                    "
                    class="w-full px-4 py-2 mt-6 text-white rounded-md"
                >
                    送出
                </button>
            </form>
        </div>
    </div>
</template>
