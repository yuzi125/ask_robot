<script setup>
import { ref, onMounted } from "vue";

import { storeToRefs } from "pinia";
import { useUserStore } from "../store";
const userStore = useUserStore();
const { tempUser } = storeToRefs(userStore);

import { useToast } from "@/components/ui/toast";
const { toast } = useToast();

import axios from "@/global/axios";

// 建立一個陣列來存儲每個輸入框的值
const codes = ref(new Array(6).fill(""));

const inputRefs = ref([]); // 儲存每個輸入框的 DOM 引用

// 當輸入時，自動跳到下一個輸入框
const handleInput = (event, index) => {
    const value = event.target.value;
    if (/^\d$/.test(value)) {
        // codes.value[index] = value;
        if (index < inputRefs.value.length - 1) {
            setTimeout(() => {
                inputRefs.value[index + 1].focus(); // 跳到下一個框
            }, 0);
        }
        if (codes.value.every(val => val !== "")) {
            submitCode();
        }        
    } else {
        codes.value[index] = "";
    }
};

// 處理 backspace，跳回前一個輸入框
const handleKeydown = (event, index) => {
    if (event.key === "Backspace" && codes.value[index] === "" && index > 0) {
        inputRefs.value[index - 1].focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
        inputRefs.value[index - 1].focus();
    } else if (event.key === "ArrowRight" && index < 5) {
        inputRefs.value[index + 1].focus();
    }
};

const isButtonLocked = ref(false);
let lastExecutionTime = 0;

// 提交驗證碼
const submitCode = async (mode) => {

    // 限流
    if (!mode || mode === "button") {
        const now = Date.now();
        if (now - lastExecutionTime < 2000) { // 2 秒內不執行
            return;
        }
        lastExecutionTime = now;
    }

    if (isButtonLocked.value){
        return
    }

    const code = codes.value.join("");
    if (code.length === 6) {
        const userInfo = tempUser.value;
        const reqBody = {
            code,
            userInfo,
        };
        const rs = await axios.post("/user/authentication", reqBody);

        if (rs && rs.data) {
            if (rs.data.code === 0) {
                toast({
                    title: "驗證成功",
                    description: "",
                    variant: "success",
                });
                window.location.replace("/");
            } else if (rs.data.code === 403) {
                lockButton();
            } else {
                toast({
                    title: "驗證失敗，請再試一次。",
                    description: "",
                    variant: "destructive",
                });           
            }
        }
    } else {
        toast({
            title: "請輸入完整驗證碼",
            description: "",
            variant: "destructive",
        });
    }
};

const lockButton = () => {
    isButtonLocked.value = true;
    toast({
        title: "此帳號已被鎖定，請十五分鐘後再試。",
        description: "",
        variant: "destructive",
    });

    // 計算鎖定結束時間，並儲存在 localStorage 中
    const lockUntil = Date.now() + 15 * 60 * 1000; // 15 分鐘後的時間戳
    localStorage.setItem("lockUntil", lockUntil);

    // 設置解鎖的計時器
    setUnlockTimeout(lockUntil);    
};

const setUnlockTimeout = (lockUntil) => {
    const remainingTime = lockUntil - Date.now();

    if (remainingTime > 0) {
        // 設置計時器以在剩餘時間後解鎖
        setTimeout(() => {
            isButtonLocked.value = false;
            localStorage.removeItem("lockUntil"); // 移除鎖定時間
            toast({
                title: "解鎖成功，您現在可以再次嘗試。",
                description: "",
                variant: "success",
            });
        }, remainingTime);
    } else {
        // 如果時間已過，立即解鎖
        isButtonLocked.value = false;
        localStorage.removeItem("lockUntil");
    }
};

onMounted(async () => {
    const rs = await axios.get("/user/checkLockButton");

    if (rs && rs.data && rs.data.code === 403){
        isButtonLocked.value = true;
        const lockUntil = localStorage.getItem("lockUntil");
        setUnlockTimeout(lockUntil)

    }else if (rs && rs.data && rs.data.code === 0) {
        isButtonLocked.value = false;
        localStorage.removeItem("lockUntil");
    }
});

const goToHomePage = async () =>{
    try {
        await axios.get("/user/logout");
        window.location.replace('/'); // next({ path: '/', replace: true });
        window.history.replaceState(null, '', '/')
        window.history.pushState(null, '', '/')

    } catch (error) {
        console.error('Error clearing login:', error);
    }
}

</script>

<template>
    <div class="flex items-center justify-center min-h-screen bg-gray-200">
        <div class="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
            <h2 class="mb-4 text-2xl font-bold text-center">智能客服 - 二次驗證</h2>

            <div class="flex justify-between mb-4">
                <!-- 建立6個驗證碼輸入框 -->
                <input
                    v-for="(code, index) in codes"
                    :key="index"
                    :ref="(el) => (inputRefs[index] = el)"
                    maxlength="1"
                    type="text"
                    v-model="codes[index]"
                    class="w-12 h-12 text-center border border-gray-300 rounded-md"
                    @input="handleInput($event, index)"
                    @keydown="handleKeydown($event, index)"
                    @keyup.enter="submitCode('button')"
                />
            </div>

            <button
                @click="submitCode('button')"
                :disabled="isButtonLocked"
                class="w-full py-2 font-semibold text-white bg-blue-500 rounded-lg"
                :class="isButtonLocked ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'"
            >
                {{ isButtonLocked ? '驗證功能已鎖定' : '確認驗證碼' }}
            </button>
            <button
                @click="goToHomePage"
                class="w-full mt-4 py-2 font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800"
            >
                登出
            </button>
        </div>

    </div>
</template>
