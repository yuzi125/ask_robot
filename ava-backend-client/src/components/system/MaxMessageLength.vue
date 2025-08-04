<script setup>
import { computed, watch } from "vue";
const props = defineProps(["modelValue"]);

const emit = defineEmits(["update:modelValue", "changeDataStatus"]);

const invalidValue = computed(() => {
    return !Number.isInteger(Number(props.modelValue)) || Number(props.modelValue) < 1;
});

watch(invalidValue, (newValue) => {
    emit("changeDataStatus", {
        invalid: newValue,
        name: "maxMessageLength",
    });
});
</script>

<template>
    <div class="list d-flex text-no-wrap">
        <p class="mt-3 mr-3 text-h6" style="width: 150px">最大輸入字數</p>
        <v-text-field
            :label="`請填寫最大輸入字數`"
            type="number"
            min="1"
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            density="comfortable"
            variant="outlined"
            :hide-details="!invalidValue"
            :error-messages="invalidValue ? '請填寫大於1的整數' : null"
        ></v-text-field>
    </div>
</template>
