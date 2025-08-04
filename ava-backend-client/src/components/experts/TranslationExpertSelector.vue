<script setup>
import { ref, watch } from "vue";

const props = defineProps({
    translationExpert: {
        type: Boolean,
        default: false,
        required: true,
    },
});

const emit = defineEmits(["update:translationExpert"]);

// 本地選中的值
const localTranslationExpert = ref(props.translationExpert);

// 固定的選項列表
const statusOptions = [
    { title: "關閉", value: false },
    { title: "開啟", value: true },
];

watch(
    () => props.translationExpert,
    (newValue) => {
        localTranslationExpert.value = newValue;
    },
    { immediate: true }
);

const handleSelection = (value) => {
    localTranslationExpert.value = value;
    emit("update:translationExpert", value);
};
</script>
<template>
    <div class="statusSelectContainer">
        <v-select
            v-model="localTranslationExpert"
            :items="statusOptions"
            item-title="title"
            item-value="value"
            label="選擇狀態"
            @update:modelValue="handleSelection"
        />
    </div>
</template>
<style scoped>
.statusSelectContainer {
    flex: 1;
}
</style>
