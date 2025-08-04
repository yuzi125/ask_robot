<script setup>
import { computed, watch } from "vue";
const props = defineProps({
    modelValue: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(["update:modelValue", "changeDataStatus"]);

const invalidValue = computed(() => {
    return props.modelValue.length > 50;
});

watch(invalidValue, (newValue) => {
    emit("changeDataStatus", {
        invalid: newValue,
        name: "chatInputPlaceholder",
    });
});
</script>

<template>
    <div class="list d-flex text-no-wrap">
        <p class="mt-3 mr-3 text-h6" style="width: 150px">輸入框提示文字</p>
        <v-text-field
            :label="`請填寫輸入框提示文字`"
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            density="comfortable"
            variant="outlined"
            :hide-details="!invalidValue"
            :error-messages="invalidValue ? '提示內容不得超過50個字' : null"
        ></v-text-field>
    </div>
</template>
