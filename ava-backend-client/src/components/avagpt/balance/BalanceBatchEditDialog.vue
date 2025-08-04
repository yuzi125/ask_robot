<script setup>
import { ref, computed, watch, inject } from "vue";
import { useMutation } from "@tanstack/vue-query";

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },
    selectedUsers: {
        type: Array,
        default: () => [],
    },
    balances: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits(["update:modelValue", "saved"]);

const axios = inject("axios");
const emitter = inject("emitter");

// 響應式資料
const form = ref(null);
const loading = ref(false);

// 更新欄位選擇
const updateFields = ref({
    tokenCredits: false,
    autoRefillEnabled: false,
    refillAmount: false,
    refillInterval: false,
});

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

const selectedUsersList = computed(() => {
    return props.balances.filter((balance) => props.selectedUsers.includes(balance._id));
});

const hasAnyUpdateField = computed(() => {
    return Object.values(updateFields.value).some((field) => field);
});

// 批次更新 mutation
const batchUpdateMutation = useMutation({
    mutationFn: async (data) => {
        const { data: response } = await axios.put("/avaGPT/balance/batch", data);
        if (response.code !== 200) {
            throw new Error(response.message);
        }
        return response;
    },
    onSuccess: () => {
        emit("saved");
        emitter.emit("openSnackbar", { message: "成功批次更新餘額", color: "success" });
        closeDialog();
    },
});

// 方法
const closeDialog = () => {
    dialog.value = false;
    resetForm();
};

const resetForm = () => {
    updateFields.value = {
        tokenCredits: false,
        autoRefillEnabled: false,
        refillAmount: false,
        refillInterval: false,
    };

    formData.value = {
        tokenCredits: 0,
        autoRefillEnabled: false,
        refillAmount: 1000,
        refillIntervalValue: 30,
        refillIntervalUnit: "days",
    };
};

const saveBatchChanges = async () => {
    if (!form.value) return;

    const { valid } = await form.value.validate();
    if (!valid) return;

    if (!hasAnyUpdateField.value) return;

    // 建立更新資料
    const updateData = {
        userIds: selectedUsersList.value.map((user) => user.userId),
    };

    if (updateFields.value.tokenCredits) {
        updateData.tokenCredits = formData.value.tokenCredits;
    }
    if (updateFields.value.autoRefillEnabled) {
        updateData.autoRefillEnabled = formData.value.autoRefillEnabled;
    }
    if (updateFields.value.refillAmount) {
        updateData.refillAmount = formData.value.refillAmount;
    }
    if (updateFields.value.refillInterval) {
        updateData.refillIntervalValue = formData.value.refillIntervalValue;
        updateData.refillIntervalUnit = formData.value.refillIntervalUnit;
    }

    loading.value = true;
    try {
        await batchUpdateMutation.mutateAsync(updateData);
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

// 監聽對話框開啟，重置表單
watch(
    () => props.modelValue,
    (newValue) => {
        if (newValue) {
            resetForm();
        }
    }
);
</script>

<template>
    <v-dialog v-model="dialog" max-width="700" persistent>
        <v-card>
            <v-card-title class="d-flex align-center bg-primary-lighten-5">
                <v-icon icon="mdi-account-multiple-plus" color="primary" class="me-2" />
                <span class="text-h6">批次編輯 Balance 設定</span>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" @click="closeDialog" />
            </v-card-title>

            <v-card-text class="pt-4">
                <!-- 選中的使用者列表 -->
                <v-card variant="outlined" class="mb-4">
                    <v-card-title class="py-2 text-subtitle-1">
                        <v-icon icon="mdi-account-group" class="me-2" />
                        選中的使用者 ({{ selectedUsersList.length }} 個)
                    </v-card-title>
                    <v-card-text class="pt-2">
                        <div class="flex-wrap d-flex ga-2">
                            <v-chip
                                v-for="user in selectedUsersList"
                                :key="user._id"
                                size="small"
                                variant="outlined"
                                color="primary"
                            >
                                <v-avatar start>
                                    {{ user.userName.charAt(0).toUpperCase() }}
                                </v-avatar>
                                {{ user.userName }}
                            </v-chip>
                        </div>
                    </v-card-text>
                </v-card>

                <v-form ref="form" @submit.prevent="saveBatchChanges">
                    <v-row>
                        <!-- 更新選項 -->
                        <v-col cols="12">
                            <div class="mb-2 text-subtitle-2">選擇要更新的欄位：</div>
                            <v-row>
                                <v-col cols="6" md="4">
                                    <v-checkbox
                                        v-model="updateFields.tokenCredits"
                                        label="Token Credits"
                                        density="compact"
                                        hide-details
                                    />
                                </v-col>
                                <v-col cols="6" md="4">
                                    <v-checkbox
                                        v-model="updateFields.autoRefillEnabled"
                                        label="自動補充狀態"
                                        density="compact"
                                        hide-details
                                    />
                                </v-col>
                                <v-col cols="6" md="4">
                                    <v-checkbox
                                        v-model="updateFields.refillAmount"
                                        label="補充數量"
                                        density="compact"
                                        hide-details
                                    />
                                </v-col>
                                <v-col cols="6" md="4">
                                    <v-checkbox
                                        v-model="updateFields.refillInterval"
                                        label="補充間隔"
                                        density="compact"
                                        hide-details
                                    />
                                </v-col>
                            </v-row>
                        </v-col>

                        <v-col cols="12">
                            <v-divider />
                        </v-col>

                        <!-- Token Credits -->
                        <v-col cols="12" v-if="updateFields.tokenCredits">
                            <v-text-field
                                v-model.number="formData.tokenCredits"
                                label="Token Credits"
                                type="number"
                                variant="outlined"
                                :rules="updateFields.tokenCredits ? [rules.required, rules.nonNegative] : []"
                                prepend-inner-icon="fa-solid fa-coins"
                                hint="1000 credits = $0.001 USD"
                                persistent-hint
                            />
                        </v-col>

                        <!-- 自動補充開關 -->
                        <v-col cols="12" v-if="updateFields.autoRefillEnabled">
                            <v-switch
                                v-model="formData.autoRefillEnabled"
                                label="啟用自動補充"
                                color="primary"
                                inset
                                hide-details
                            />
                        </v-col>

                        <!-- 補充數量 -->
                        <v-col cols="12" v-if="updateFields.refillAmount">
                            <v-text-field
                                v-model.number="formData.refillAmount"
                                label="補充數量"
                                type="number"
                                variant="outlined"
                                :rules="updateFields.refillAmount ? [rules.required, rules.positive] : []"
                                prepend-inner-icon="mdi-plus-circle"
                                hint="每次自動補充的 Token Credits 數量"
                                persistent-hint
                            />
                        </v-col>

                        <!-- 補充間隔 -->
                        <template v-if="updateFields.refillInterval">
                            <v-col cols="6">
                                <v-text-field
                                    v-model.number="formData.refillIntervalValue"
                                    label="補充間隔"
                                    type="number"
                                    variant="outlined"
                                    :rules="updateFields.refillInterval ? [rules.required, rules.positive] : []"
                                    prepend-inner-icon="mdi-clock"
                                />
                            </v-col>

                            <v-col cols="6">
                                <v-select
                                    v-model="formData.refillIntervalUnit"
                                    label="時間單位"
                                    :items="timeUnits"
                                    variant="outlined"
                                    :rules="updateFields.refillInterval ? [rules.required] : []"
                                />
                            </v-col>
                        </template>

                        <!-- 批次操作預覽 -->
                        <v-col cols="12" v-if="hasAnyUpdateField">
                            <v-alert type="info" variant="tonal" class="mb-0">
                                <div class="text-body-2">
                                    <strong>批次更新預覽：</strong>
                                </div>
                                <ul class="mt-2 mb-0">
                                    <li v-if="updateFields.tokenCredits">
                                        Token Credits 將設定為：{{ formatTokenCredits(formData.tokenCredits) }}
                                    </li>
                                    <li v-if="updateFields.autoRefillEnabled">
                                        自動補充將{{ formData.autoRefillEnabled ? "啟用" : "停用" }}
                                    </li>
                                    <li v-if="updateFields.refillAmount">
                                        補充數量將設定為：{{ formatTokenCredits(formData.refillAmount) }}
                                    </li>
                                    <li v-if="updateFields.refillInterval">
                                        補充間隔將設定為：每 {{ formData.refillIntervalValue }}
                                        {{ getUnitText(formData.refillIntervalUnit) }}
                                    </li>
                                </ul>
                                <div class="mt-2 text-caption">將影響 {{ selectedUsersList.length }} 個使用者</div>
                            </v-alert>
                        </v-col>

                        <!-- 無選擇提示 -->
                        <v-col cols="12" v-if="!hasAnyUpdateField">
                            <v-alert type="warning" variant="tonal" class="mb-0"> 請至少選擇一個要更新的欄位 </v-alert>
                        </v-col>
                    </v-row>
                </v-form>
            </v-card-text>

            <v-card-actions class="px-6 pb-4 sticky-bottom">
                <v-spacer />
                <v-btn @click="closeDialog" :disabled="loading"> 關閉 </v-btn>
                <v-btn color="primary" @click="saveBatchChanges" :loading="loading" :disabled="!hasAnyUpdateField">
                    批次更新
                </v-btn>
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
