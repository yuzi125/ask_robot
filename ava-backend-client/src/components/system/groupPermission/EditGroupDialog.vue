<script setup>
const props = defineProps({
    modelValue: Boolean,
    groupForm: Object,
    loading: Boolean,
});

const emit = defineEmits(["update:modelValue", "submit"]);

// 當提交表單時，將表單數據傳遞給父元件
const handleSubmit = () => {
    emit("submit", props.groupForm);
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
                <v-icon class="mr-2">mdi-account-edit</v-icon>
                <span>編輯群組</span>
            </v-card-title>

            <v-card-text class="pa-4">
                <v-form @submit.prevent="handleSubmit" class="mt-2">
                    <v-text-field
                        v-model="groupForm.groupId"
                        label="群組ID *"
                        :rules="[(v) => !!v || '請輸入群組 ID']"
                        required
                        variant="outlined"
                        disabled
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
                    :disabled="!groupForm.groupName"
                >
                    <v-icon left>mdi-content-save</v-icon>
                    儲存
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
