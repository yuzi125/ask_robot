<script setup>
import { ref, computed, watch } from "vue";
import { useAPIKeyData } from "@/composables/useAPIKeyData";

const props = defineProps({
    modelValue: {
        type: Boolean,
        required: true,
    },
    user: {
        type: Object,
        default: () => ({}),
    },
});

const emit = defineEmits(["update:modelValue", "update-common-settings"]);

// 獲取使用者列表
const { users, loadingUsers, usersError } = useAPIKeyData();

const form = ref(null);
const formData = ref({
    description: "",
});

// 建立 API Key
const handleUpdate = async () => {
    const { valid } = await form.value?.validate();

    if (!valid) return;

    emit("update-common-settings", {
        keyId: props.user.api_key_id,
        description: formData.value.description,
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
        description: "",
    };
    form.value?.reset();
};

watch(
    () => props.user,
    (newUser) => {
        if (newUser) {
            formData.value.description = newUser.description;
        }
    }
);
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600">
        <v-card>
            <v-card-title>一般設定</v-card-title>
            <v-card-text>
                <v-form ref="form" @submit.prevent="handleUpdate">
                    <v-row>
                        <v-col cols="12">
                            <v-textarea
                                v-model="formData.description"
                                label="用途說明"
                                placeholder="請描述此 API Key 的用途"
                                rows="3"
                                no-resize
                            ></v-textarea>
                        </v-col>
                    </v-row>
                </v-form>
            </v-card-text>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="grey darken-1" @click="closeDialog"> 關閉 </v-btn>
                <v-btn color="primary" @click="handleUpdate"> 儲存 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
