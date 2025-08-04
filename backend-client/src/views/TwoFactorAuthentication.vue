<script setup>
import { ref, watch } from "vue";
import axios from "@/global/axios";
import emitter from "@/global/emitter";

import { useUserStore } from "../store/index";
import { storeToRefs } from "pinia";
const userStore = useUserStore();
const { authSetting } = storeToRefs(userStore);
const { getAuthSetting } = userStore;

const modeList = ["open-mode", "close-mode"];
const mode = ref("open-mode");

// 先檢查此User的二次驗證設定
async function checkAuthSetting() {
    if (!authSetting.value) {
        await getAuthSetting();
    }
    if (authSetting.value.useAuth === 1) {
        // 如果isEnable === 1，切換為【禁用】模式。
        mode.value = authSetting.value.isEnable ? modeList[1] : modeList[0];
    } else {
        return emitter.emit("openSnackbar", { message: "未開放此帳號使用二次登入驗證。", color: "error" });
    }

    // 【啟用】模式下，都會去建立2FA資訊
    if (mode.value === "open-mode") {
        createSecretKey();
    }
}
checkAuthSetting();

const isDataReady = ref(false);
const keyData = ref({
    qrCodeUrl: "",
    secretKey: "",
});

// 建立二次驗證資訊
async function createSecretKey() {
    const rs = await axios.post("/user/createSecretKey");
    if (rs && rs.data && rs.data.code === 0) {
        isDataReady.value = true;
        keyData.value.qrCodeUrl = rs.data.data.qrCodeUrl;
        keyData.value.secretKey = rs.data.data.secretKey;
    } else {
        emitter.emit("openSnackbar", {
            message: "建立驗證資訊時發生錯誤。",
            color: "error",
        });
    }
}

// 翻面效果
const isFlipped = ref(false);
const firstCard = ref(null);
const secondCard = ref(null);
const toggleCard = () => {
    isFlipped.value = !isFlipped.value;
    if (isFlipped.value) {
        firstCard.value.style.transform = "rotateY(180deg)";
        secondCard.value.style.transform = "rotateY(0deg)";
    } else {
        firstCard.value.style.transform = "rotateY(0deg)";
        secondCard.value.style.transform = "rotateY(180deg)";
    }
};

// 驗證code
const authCode = ref("");
const authSuccess = ref(false);
const checkBtnBuffer = ref(false);
watch(
    () => authCode.value,
    () => {
        if (authCode.value && authCode.value.length > 6) {
            authCode.value = authCode.value.slice(0, 6);
        }
    }
);
async function authentication(action) {
    const text = authCode.value;
    if (text && text.length !== 6) {
        return emitter.emit("openSnackbar", {
            message: "驗證碼長度有誤。",
            color: "error",
        });
    }

    const rs = await axios.post("/user/authentication", { code: authCode.value, action });
    try {
        if (rs && rs.data && rs.data.data.isValid) {
            authSuccess.value = true;
        } else {
            throw new Error("驗證失敗");
        }
    } catch (error) {
        emitter.emit("openSnackbar", {
            message: "驗證失敗。",
            color: "error",
        });
        // 3秒緩衝
        checkBtnBuffer.value = true;
        setTimeout(() => {
            checkBtnBuffer.value = false;
        }, 3000);
    }
}

function backToHome() {
    if (countDownInterval) {
        clearInterval(countDownInterval);
    }
    window.location.replace("/");
}

// 驗證成功自動跳轉機制
const countDownNumber = ref(0);
let countDownInterval = null;

watch(
    () => authSuccess.value,
    () => {
        if (authSuccess.value) {
            countDownNumber.value = 5;
            countDownInterval = setInterval(() => {
                if (countDownNumber.value > 0) {
                    countDownNumber.value = countDownNumber.value - 1;
                } else {
                    clearInterval(countDownInterval); // 結束時移除 interval
                    window.location.replace("/");
                }
            }, 1000);
        }
    }
);
</script>

<template>
    <div class="wrap">
        <div v-if="mode === 'open-mode'" class="container">
            <h1 class="main-title">智慧特助 - 開啟二次驗證</h1>
            <div class="title">
                <div class="horizontal-line"></div>
                <h1 class="mx-3 text-h4">綁定您的裝置</h1>
                <div class="horizontal-line"></div>
            </div>

            <div v-if="isDataReady" class="auth-key-card-wrap">
                <div class="auth-key-card first-card" ref="firstCard">
                    <p class="mb-6">請使用您的裝置掃描下方QR code，掃描完成後請將驗證代碼輸入至下方欄位，進行驗證。</p>
                    <div class="QR-code-wrap">
                        <v-img width="250" aspect-ratio="1/1" cover :src="keyData.qrCodeUrl"></v-img>
                    </div>
                </div>
                <div class="auth-key-card second-card" ref="secondCard">
                    <p>請將下列設定金鑰輸入您的裝置，並將裝置上的驗證代碼輸入至下方欄位，進行驗證。</p>
                    <div class="auth-key">{{ keyData.secretKey || "--" }}</div>
                </div>
            </div>
            <v-skeleton-loader class="loader" v-else type="card"></v-skeleton-loader>
            <v-btn
                v-if="isDataReady"
                @click="toggleCard()"
                color="primary"
                prepend-icon="fa-solid fa-repeat"
                variant="text"
                >切換綁定方式</v-btn
            >
            <div v-if="isDataReady" class="check-component">
                <div class="mt-6 title">
                    <div class="horizontal-line"></div>
                    <h1 class="mx-3 text-h4">驗證裝置</h1>
                    <div class="horizontal-line"></div>
                </div>
                <v-text-field
                    v-if="!authSuccess"
                    v-model="authCode"
                    class="auth-key-input"
                    label="驗證碼"
                    variant="outlined"
                    length="6"
                    hide-details
                    @keyup.enter="authentication('enable')"
                ></v-text-field>
                <v-btn
                    v-if="!authSuccess"
                    :disabled="authCode.length === 0 || checkBtnBuffer"
                    @click="authentication('enable')"
                    class="auth-btn"
                    color="primary"
                    >驗證<span v-if="checkBtnBuffer">(請稍後再試...)</span></v-btn
                >
                <p v-if="authSuccess" class="auth-success-text">驗證成功</p>
            </div>
        </div>
        <div v-if="mode === 'close-mode'" class="container">
            <h1 class="main-title">智慧特助 - 關閉二次驗證</h1>
            <div class="mt-6 title">
                <div class="horizontal-line"></div>
                <h1 class="mx-3 text-h4">請驗證您的身分</h1>
                <div class="horizontal-line"></div>
            </div>
            <v-text-field
                v-if="!authSuccess"
                v-model="authCode"
                class="auth-key-input"
                label="驗證碼"
                variant="outlined"
                length="6"
                hide-details
                @keyup.enter="authentication('disable')"
            ></v-text-field>
            <v-btn
                v-if="!authSuccess"
                :disabled="authCode.length === 0 || checkBtnBuffer"
                @click="authentication('disable')"
                class="auth-btn"
                color="primary"
                >驗證<span v-if="checkBtnBuffer">(請稍後再試...)</span></v-btn
            >
            <p v-if="authSuccess" class="auth-success-text">驗證成功(已關閉二次驗證)</p>
        </div>
        <v-btn :class="authSuccess ? 'animate-button' : ''" @click="backToHome()" variant="text">
            {{ authSuccess ? `${countDownNumber}秒後將回到首頁(點擊跳轉)` : "回到首頁" }}
        </v-btn>
    </div>
</template>

<style scoped>
.wrap {
    position: absolute;
    inset: 0;
    background: white;
    text-align: center;
    overflow-y: auto;
    padding: 24px 0px;
}

.container {
    max-width: 480px;
    display: flex;
    align-items: center;
    flex-direction: column;
    margin: 24px auto;
}

.main-title {
    width: 100%;
    margin-bottom: 24px;
    font-size: 2.2rem;
    font-weight: 900;
    text-align: center;
}

.title {
    width: 100%;
    display: flex;
    align-items: center;
    margin-bottom: 24px;
}

.horizontal-line {
    border-bottom: 2px solid rgb(185, 184, 184);
    flex: 1;
}

.auth-key-card-wrap {
    width: 100%;
    aspect-ratio: 30/22;
    position: relative;
}

.loader {
    width: 100%;
}

.auth-key-card {
    text-align: center;
    font-size: 1.3rem;
    line-height: 1.3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;
    aspect-ratio: 30/22;
    background-color: white;
    position: absolute;
    backface-visibility: hidden; /* 隱藏背面 */
    transition: transform 0.8s; /* 動畫時間 */
}

.first-card {
    transform: rotateY(0deg); /* 初始狀態正面 */
}

.second-card {
    transform: rotateY(180deg); /* 初始狀態背面 */
}

.flipped {
    transform: rotateY(180deg); /* 翻轉180度 */
}

.QR-code-wrap {
    border: 1px solid gray;
    border-radius: 10px;
    overflow: hidden;
    padding: 3px;
    margin-bottom: 12px;
}

.check-component {
    width: 100%;
}

.auth-key {
    width: 100%;
    background-color: #80808030;
    padding: 12px;
    border: 1px solid gray;
    border-radius: 5px;
}

.auth-key-input {
    width: 100%;
    height: 52px;
    margin-bottom: 24px;
}

.auth-btn {
    width: 100%;
    height: 48px;
    font-size: 1.1rem;
    margin-bottom: 12px;
}

.animate-button {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.1);
    }
    100% {
        transform: scale(1);
    }
}

.auth-success-text {
    color: #00e676;
    font-size: 2rem;
    font-weight: 700;
    opacity: 0;
    transform: scale(0.5);
    animation: fadeInScale 0.5s ease-in-out forwards;
}

@keyframes fadeInScale {
    0% {
        opacity: 0;
        transform: scale(0.5);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}
</style>
