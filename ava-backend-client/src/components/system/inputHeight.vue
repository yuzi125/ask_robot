<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps(["modelValue"]);

const emit = defineEmits(["update:modelValue", "changeDataStatus"]);

const minValue = ref(1);
const maxValue = ref(10);

const invalidValue = computed(() => {
    return (
        !Number.isInteger(Number(props.modelValue)) ||
        Number(props.modelValue) < minValue.value ||
        Number(props.modelValue) > maxValue.value
    );
});

watch(invalidValue, (newValue) => {
    emit("changeDataStatus", {
        invalid: newValue,
        name: "chatInputHeight",
    });
});
</script>

<template>
    <div class="list d-flex text-no-wrap">
        <p class="mt-3 mr-3 text-h6" style="width: 150px">輸入框高度</p>
        <v-text-field
            type="number"
            :min="minValue"
            :max="maxValue"
            label="請填寫輸入框高度"
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            density="comfortable"
            variant="outlined"
            :hide-details="!invalidValue"
            :error-messages="invalidValue ? `請填寫 ${minValue} 到 ${maxValue} 之間的整數` : null"
        ></v-text-field>
    </div>
</template>
