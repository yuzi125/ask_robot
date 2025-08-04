<script setup>
defineProps({
    theme: {
        type: String,
        required: true,
    },
});

defineEmits(["update:theme"]);
</script>

<template>
    <div class="list d-flex text-no-wrap">
        <p class="mt-3 mr-3 text-h6" style="width: 150px">聊天室介面風格</p>
        <v-select
            label="請選擇聊天室介面風格"
            :items="['淺色', '深色']"
            :model-value="theme"
            @update:model-value="$emit('update:theme', $event)"
        ></v-select>
    </div>
</template>
