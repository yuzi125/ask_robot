<script setup>
defineProps({
    modelValue: {
        type: String,
        required: true,
    },
});

defineEmits(["update:modelValue"]);
</script>

<template>
    <div class="list d-flex text-no-wrap">
        <p class="mt-3 mr-3 text-h6" style="width: 150px">使用者對話位置</p>
        <v-select
            label="請選擇對話位置"
            :items="['左側', '右側']"
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            density="comfortable"
            variant="outlined"
            hide-details
        ></v-select>
    </div>
</template>
