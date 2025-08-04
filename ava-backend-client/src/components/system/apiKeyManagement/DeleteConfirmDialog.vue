<script setup>
import { ref, computed } from "vue";

const props = defineProps({
    modelValue: {
        type: Boolean,
        required: true,
    },
    user: {
        type: Object,
        default: () => ({}),
    },
    deleting: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["update:modelValue", "confirm"]);

// 對話框控制
const dialog = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value),
});

const hasActiveServices = computed(() => {
    return props.user?.usage_count > 0;
});

// 執行刪除
const confirmDelete = () => {
    emit("confirm", {
        apiKeyId: props.user.api_key_id,
    });
    closeDialog();
};

// 關閉對話框
const closeDialog = () => {
    dialog.value = false;
};
</script>

<template>
    <v-dialog v-model="dialog" max-width="500">
        <v-card>
            <v-card-title class="headline"> 確認刪除使用者 </v-card-title>

            <v-card-text>
                <p class="mb-4">您確定要刪除使用者「{{ user?.User.name }}」嗎？</p>

                <div v-if="user?.ApiKeyDomains?.length > 0" class="mb-4">
                    <div class="mb-2 text-subtitle-2">目前已設定的網域：</div>
                    <v-chip-group>
                        <v-chip
                            v-for="domain in user.ApiKeyDomains"
                            :key="domain.id"
                            size="small"
                            color="grey"
                            variant="outlined"
                        >
                            {{ domain.domain }}
                        </v-chip>
                    </v-chip-group>
                </div>

                <v-alert type="warning" variant="tonal" class="mb-0">
                    <template v-slot:prepend>
                        <v-icon color="warning">mdi-alert</v-icon>
                    </template>
                    <div class="font-weight-medium">此操作不可復原</div>
                    <div class="text-body-2">所有使用此 API Key 的服務將立即停止運作。</div>
                </v-alert>

                <v-expand-transition>
                    <div v-if="hasActiveServices" class="mt-4">
                        <v-alert color="error" variant="outlined" density="compact">
                            <template v-slot:prepend>
                                <v-icon color="error">mdi-alert-circle</v-icon>
                            </template>
                            <div class="font-weight-medium">檢測到活躍的服務</div>
                            <div class="text-body-2">
                                過去 24 小時內有 {{ user?.usage_count || 0 }} 次 API 調用，
                                請確認所有相依服務已經更新設定。
                            </div>
                        </v-alert>
                    </div>
                </v-expand-transition>
            </v-card-text>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="grey-darken-1" variant="text" @click="closeDialog" :disabled="deleting"> 取消 </v-btn>
                <v-btn color="error" @click="confirmDelete" :loading="deleting" :disabled="deleting"> 確認刪除 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
