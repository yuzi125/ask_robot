<script setup>
defineProps({
    label: {
        type: String,
        required: true,
    },
    modelValue: {
        type: String,
        required: true,
    },
});

defineEmits(["update:modelValue"]);
</script>

<template>
    <div class="list d-flex text-no-wrap">
        <p class="mt-3 mr-3 text-h6" style="width: 150px">{{ label }}</p>
        <v-select
            :label="`請選擇${label}`"
            :items="['開啟', '關閉']"
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            density="comfortable"
            variant="outlined"
            hide-details
        ></v-select>
    </div>
</template>
