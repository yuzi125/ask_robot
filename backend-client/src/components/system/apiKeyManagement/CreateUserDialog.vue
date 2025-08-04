<script setup>
import { ref, computed } from "vue";
import { useAPIKeyData } from "@/composables/useAPIKeyData";
// import VirtualAutocomplete from "./VirtualAutocomplete.vue";
import VirtualAutocomplete from "@/components/common/VirtualAutocomplete.vue";

const props = defineProps({
    modelValue: {
        type: Boolean,
        required: true,
    },
    creating: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["update:modelValue", "create"]);

// 獲取使用者列表
const { users, loadingUsers, usersError } = useAPIKeyData();

const form = ref(null);
const formData = ref({
    userId: null,
    domains: [],
    description: "",
});

const pathRules = [
    (v) => {
        if (!v || v.length === 0) return true;
        return !!v || "請輸入路徑", (v) => v === "*" || /^\/[a-zA-Z0-9\/-]*$/.test(v) || "請輸入有效的路徑";
    },
];

// 網域驗證規則
const domainRules = [
    (v) => {
        if (!v || v.length === 0) return true;
        return (
            v.every((domain) => /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(domain)) ||
            "請輸入有效的網域"
        );
    },
];

// 獲取選中的使用者資訊
const selectedUser = computed(() => {
    if (!formData.value.userId || !users.value) return null;
    return users.value.find((user) => user.id === formData.value.userId);
});

// 建立 API Key
const handleCreate = async () => {
    const { valid } = await form.value?.validate();

    if (!valid || !selectedUser.value) return;

    emit("create", {
        userId: formData.value.userId,
        userName: selectedUser.value.name,
        domains: formData.value.domains,
        description: formData.value.description,
        paths: formData.value.paths,
    });

    closeDialog();
};

// 關閉對話框
const closeDialog = () => {
    emit("update:modelValue", false);
    resetForm();
};

// 重置表單
const resetForm = () => {
    formData.value = {
        userId: null,
        domains: [],
        description: "",
    };
    form.value?.reset();
};

const handleDomainUpdate = (newValue) => {
    if (!newValue) return;

    // 確保所有值都是字符串
    formData.value.domains = newValue.map((item) => (typeof item === "object" ? item.title : item));
};

const handlePathUpdate = (newValue) => {
    if (!newValue) return;

    formData.value.paths = newValue.map((item) => (typeof item === "object" ? item.title : item));
};
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600">
        <v-card>
            <v-card-title>新增 API Key</v-card-title>
            <v-card-text>
                <v-form ref="form" @submit.prevent="handleCreate">
                    <v-row>
                        <v-col cols="12">
                            <VirtualAutocomplete
                                v-model="formData.userId"
                                :items="users || []"
                                item-title="name"
                                item-value="id"
                                label="選擇使用者"
                                :rules="[(v) => !!v || '請選擇使用者']"
                                :loading="loadingUsers"
                                required
                            />
                        </v-col>

                        <v-col cols="12">
                            <v-combobox
                                v-model="formData.domains"
                                label="網域白名單"
                                chips
                                multiple
                                closable-chips
                                :rules="domainRules"
                                hint="輸入網域後按 Enter 新增"
                                persistent-hint
                                @update:model-value="handleDomainUpdate"
                            >
                                <template v-slot:chip="{ props, item }">
                                    <v-chip v-bind="props" :closable="true">
                                        {{ typeof item === "object" ? item.title : item }}
                                    </v-chip>
                                </template>
                            </v-combobox>
                        </v-col>
                        <v-col cols="12">
                            <v-combobox
                                v-model="formData.paths"
                                label="API 路徑"
                                chips
                                multiple
                                closable-chips
                                :rules="pathRules"
                                hint="輸入路徑後按 Enter 新增"
                                persistent-hint
                                @update:model-value="handlePathUpdate"
                            >
                                <template v-slot:chip="{ props, item }">
                                    <v-chip v-bind="props" :closable="true">
                                        {{ typeof item === "object" ? item.title : item }}
                                    </v-chip>
                                </template>
                            </v-combobox>
                        </v-col>
                        <v-col cols="12">
                            <v-textarea
                                v-model="formData.description"
                                label="用途說明"
                                placeholder="請描述此 API Key 的用途"
                                rows="3"
                            ></v-textarea>
                        </v-col>
                    </v-row>
                </v-form>
            </v-card-text>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="grey darken-1" @click="closeDialog" :disabled="creating"> 關閉 </v-btn>
                <v-btn color="primary" @click="handleCreate" :loading="creating" :disabled="!formData.userId">
                    建立
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
