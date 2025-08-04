<script setup>
import { ref, computed, watch, inject } from "vue";
import { useMutation } from "@tanstack/vue-query";

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },
    balance: {
        type: Object,
        default: null,
    },
});

const emit = defineEmits(["update:modelValue", "saved"]);

const axios = inject("axios");
const emitter = inject("emitter");

// 響應式資料
const form = ref(null);
const loading = ref(false);

// 表單資料
const formData = ref({
    tokenCredits: 0,
    autoRefillEnabled: false,
    refillAmount: 1000,
    refillIntervalValue: 30,
    refillIntervalUnit: "days",
});

// 時間單位選項
const timeUnits = [
    { title: "秒", value: "seconds" },
    { title: "分鐘", value: "minutes" },
    { title: "小時", value: "hours" },
    { title: "天", value: "days" },
    { title: "週", value: "weeks" },
    { title: "月", value: "months" },
];

// 驗證規則
const rules = {
    required: (value) => !!value || value === 0 || "此欄位為必填",
    positive: (value) => value > 0 || "必須大於 0",
    nonNegative: (value) => value >= 0 || "不能為負數",
};

// 計算屬性
const dialog = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value),
});

// 更新 Balance mutation
const updateMutation = useMutation({
    mutationFn: async (data) => {
        const { data: response } = await axios.put("/avaGPT/balance/user", data);
        if (response.code !== 200) {
            throw new Error(response.message);
        }
        return response;
    },
    onSuccess: () => {
        emit("saved");
        emitter.emit("openSnackbar", { message: "成功更新餘額", color: "success" });
        closeDialog();
    },
});

// 方法
const closeDialog = () => {
    dialog.value = false;
    resetForm();
};

const resetForm = () => {
    formData.value = {
        tokenCredits: 0,
        autoRefillEnabled: false,
        refillAmount: 1000,
        refillIntervalValue: 30,
        refillIntervalUnit: "days",
    };
};

const saveBalance = async () => {
    if (!form.value) return;

    const { valid } = await form.value.validate();
    if (!valid) return;

    loading.value = true;
    try {
        await updateMutation.mutateAsync({
            userId: props.balance.userId,
            ...formData.value,
        });
    } finally {
        loading.value = false;
    }
};

// 格式化函數
const formatTokenCredits = (credits) => {
    if (credits >= 1000000) {
        return `${(credits / 1000000).toFixed(1)}M`;
    } else if (credits >= 1000) {
        return `${(credits / 1000).toFixed(1)}K`;
    }
    return credits.toString();
};

const getUnitText = (unit) => {
    const unitMap = {
        seconds: "秒",
        minutes: "分鐘",
        hours: "小時",
        days: "天",
        weeks: "週",
        months: "月",
    };
    return unitMap[unit] || unit;
};

// 監聽 balance 變化，初始化表單
watch(
    () => props.balance,
    (newBalance) => {
        if (newBalance) {
            formData.value = {
                tokenCredits: newBalance.tokenCredits || 0,
                autoRefillEnabled: newBalance.autoRefillEnabled || false,
                refillAmount: newBalance.refillAmount || 1000,
                refillIntervalValue: newBalance.refillIntervalValue || 30,
                refillIntervalUnit: newBalance.refillIntervalUnit || "days",
            };
        }
    },
    { immediate: true }
);
</script>

<template>
    <v-dialog v-model="dialog" max-width="600" persistent>
        <v-card>
            <v-card-title class="d-flex align-center bg-primary-lighten-5">
                <v-icon icon="mdi-account-edit" color="primary" class="me-2" />
                <span class="text-h6">編輯 Balance 設定</span>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" @click="closeDialog" />
            </v-card-title>

            <v-card-text class="pt-4">
                <div v-if="balance" class="mb-4">
                    <!-- 使用者資訊 -->
                    <v-card variant="outlined" class="mb-4">
                        <v-card-text class="py-3">
                            <div class="d-flex align-center">
                                <v-avatar size="40" color="primary" class="me-3">
                                    <span class="text-white">
                                        {{ balance.userName.charAt(0).toUpperCase() }}
                                    </span>
                                </v-avatar>
                                <div>
                                    <div class="font-weight-medium text-body-1">{{ balance.userName }}</div>
                                    <div class="text-caption text-grey-darken-1">{{ balance.userEmail }}</div>
                                </div>
                            </div>
                        </v-card-text>
                    </v-card>

                    <v-form ref="form" @submit.prevent="saveBalance">
                        <v-row>
                            <!-- Token Credits -->
                            <v-col cols="12">
                                <v-text-field
                                    v-model.number="formData.tokenCredits"
                                    label="Token Credits"
                                    type="number"
                                    variant="outlined"
                                    :rules="[rules.required, rules.nonNegative]"
                                    prepend-inner-icon="fa-solid fa-coins"
                                    hint="1000 credits = $0.001 USD"
                                    persistent-hint
                                />
                            </v-col>

                            <!-- 自動補充開關 -->
                            <v-col cols="12">
                                <v-switch
                                    v-model="formData.autoRefillEnabled"
                                    label="啟用自動補充"
                                    color="primary"
                                    inset
                                    hide-details
                                />
                            </v-col>

                            <!-- 自動補充設定 -->
                            <template v-if="formData.autoRefillEnabled">
                                <v-col cols="12">
                                    <v-text-field
                                        v-model.number="formData.refillAmount"
                                        label="補充數量"
                                        type="number"
                                        variant="outlined"
                                        :rules="[rules.required, rules.positive]"
                                        prepend-inner-icon="mdi-plus-circle"
                                        hint="每次自動補充的 Token Credits 數量"
                                        persistent-hint
                                    />
                                </v-col>

                                <v-col cols="6">
                                    <v-text-field
                                        v-model.number="formData.refillIntervalValue"
                                        label="補充間隔"
                                        type="number"
                                        variant="outlined"
                                        :rules="[rules.required, rules.positive]"
                                        prepend-inner-icon="mdi-clock"
                                    />
                                </v-col>

                                <v-col cols="6">
                                    <v-select
                                        v-model="formData.refillIntervalUnit"
                                        label="時間單位"
                                        :items="timeUnits"
                                        variant="outlined"
                                        :rules="[rules.required]"
                                    />
                                </v-col>

                                <!-- 補充預覽 -->
                                <v-col cols="12">
                                    <v-alert type="info" variant="tonal" class="mb-0">
                                        <div class="text-body-2">
                                            <strong>補充設定預覽：</strong>
                                            每 {{ formData.refillIntervalValue }}
                                            {{ getUnitText(formData.refillIntervalUnit) }} 自動補充
                                            {{ formatTokenCredits(formData.refillAmount) }} Token Credits
                                        </div>
                                        <div class="mt-1 text-caption">下次補充時間將在儲存後重新計算</div>
                                    </v-alert>
                                </v-col>
                            </template>
                        </v-row>
                    </v-form>
                </div>
            </v-card-text>

            <v-card-actions class="px-6 pb-4 sticky-bottom">
                <v-spacer />
                <v-btn @click="closeDialog" :disabled="loading"> 關閉 </v-btn>
                <v-btn color="primary" @click="saveBalance" :loading="loading"> 儲存 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.bg-primary-lighten-5 {
    background-color: rgba(var(--v-theme-primary), 0.05) !important;
}

.sticky-bottom {
    position: sticky;
    bottom: 0px;
    padding: 10px;
    background-color: white;
    border-top: 2px solid rgba(128, 128, 128, 0.3);
}
</style>
