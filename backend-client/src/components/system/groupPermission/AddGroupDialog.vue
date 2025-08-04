<script setup>
import { ref, inject } from "vue";

const emitter = inject("emitter");

const props = defineProps({
    modelValue: Boolean,
    groupForm: Object,
    loading: Boolean,
});

const emit = defineEmits(["update:modelValue", "submit"]);

const formRef = ref(null);

// 當提交表單時，驗證通過才 emit 表單資料
const handleSubmit = async () => {
    const isValid = await formRef.value?.validate();
    if (isValid?.valid) {
        emit("submit", props.groupForm);
    } else {
        emitter.emit("openSnackbar", { message: "群組新增失敗請檢查格式是否正確", color: "error" });
    }
};
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="500px"
        persistent
    >
        <v-card rounded="lg">
            <v-card-title class="text-white rounded-t-lg bg-primary pa-4">
                <v-icon class="mr-2">mdi-account-multiple-plus</v-icon>
                <span>新增群組</span>
            </v-card-title>

            <v-card-text class="pa-4">
                <v-form @submit.prevent="handleSubmit" class="mt-2" ref="formRef">
                    <v-text-field
                        v-model="groupForm.groupId"
                        label="群組ID *"
                        :rules="[
                            (v) => !!v || '請輸入群組 ID',
                            (v) => /^[A-Za-z0-9]*$/.test(v) || '僅能輸入英文與數字',
                        ]"
                        required
                        variant="outlined"
                        placeholder="輸入群組ID"
                        class="mb-3"
                    ></v-text-field>
                    <v-text-field
                        v-model="groupForm.groupName"
                        label="群組名稱 *"
                        :rules="[(v) => !!v || '請輸入群組名稱']"
                        required
                        variant="outlined"
                        placeholder="輸入群組顯示名稱"
                        class="mb-3"
                    ></v-text-field>
                    <v-textarea
                        v-model="groupForm.remark"
                        label="備註"
                        rows="3"
                        auto-grow
                        variant="outlined"
                        placeholder="輸入群組說明或備註（選填）"
                    ></v-textarea>
                </v-form>
            </v-card-text>

            <v-card-actions class="pt-0 pa-4">
                <v-spacer></v-spacer>
                <v-btn variant="text" color="grey" @click="$emit('update:modelValue', false)">取消</v-btn>
                <v-btn
                    variant="elevated"
                    color="primary"
                    @click="handleSubmit"
                    :loading="loading"
                    :disabled="!groupForm.groupId || !groupForm.groupName"
                >
                    儲存
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
