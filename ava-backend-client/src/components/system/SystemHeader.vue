<script setup>
import { defineProps, defineEmits } from "vue";

const props = defineProps({
    title: {
        type: String,
        required: true,
    },
    subtitle: {
        type: String,
        default: "",
    },
    icon: {
        type: String,
        required: true,
    },
    iconColor: {
        type: String,
        default: "primary",
    },
    actions: {
        type: Array,
        default: () => [],
        // 每個按鈕物件的結構：
        // {
        //   id: 'unique_id',
        //   text: '按鈕文字',
        //   icon: 'mdi-icon-name',
        //   color: 'primary',
        //   variant: 'tonal',
        //   loading: false,
        //   disabled: false
        // }
    },
    loading: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["action"]);

// 觸發按鈕事件，傳遞按鈕 id
const handleAction = (actionId) => {
    emit("action", actionId);
};
</script>

<template>
    <v-card class="mb-6" :elevation="2">
        <div class="px-6 pt-4 pb-2">
            <div class="d-flex align-center">
                <div class="d-flex align-center">
                    <v-icon :icon="icon" size="32" :color="iconColor" class="mr-3"></v-icon>
                    <div>
                        <div class="text-h5 font-weight-bold">{{ title }}</div>
                        <div v-if="subtitle" class="mt-1 text-body-2 text-medium-emphasis">
                            {{ subtitle }}
                        </div>
                    </div>
                </div>
                <v-spacer></v-spacer>

                <template v-for="action in actions" :key="action.id">
                    <v-btn
                        :prepend-icon="action.icon"
                        :color="action.color || 'primary'"
                        :variant="action.variant || 'tonal'"
                        :loading="action.loading"
                        :disabled="action.disabled"
                        :class="{ 'ml-2': true }"
                        @click="handleAction(action.id)"
                    >
                        {{ action.text }}
                    </v-btn>
                </template>
            </div>
        </div>
    </v-card>
</template>
