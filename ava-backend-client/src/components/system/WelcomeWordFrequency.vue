<script setup>
defineProps({
    modelValue: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(["update:modelValue"]);
</script>

<template>
    <div class="list d-flex text-no-wrap">
        <p class="mt-3 mr-3 text-h6" style="width: 150px">歡迎詞更新頻率</p>
        <v-text-field
            label="請輸入歡迎詞更新頻率"
            :model-value="modelValue"
            @update:model-value="(value) => emit('update:modelValue', value)"
            density="comfortable"
            variant="outlined"
            hide-details
            suffix="天"
            min="1"
            max="365"
            type="number"
        ></v-text-field>
    </div>
</template>
