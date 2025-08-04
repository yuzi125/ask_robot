<script setup>
import { ref, watch } from "vue";

const props = defineProps({
    modelValue: {
        type: [Number, Boolean, Array, String, Object],
        required: true,
    },
    items: {
        type: Array,
        required: true,
    },
    label: {
        type: String,
        required: true,
    },
    itemTitle: {
        type: String,
        default: "text",
    },
    itemValue: {
        type: String,
        default: "value",
    },
    multiple: {
        type: Boolean,
        default: false,
    },
    chips: {
        type: Boolean,
        default: false,
    },
    closableChips: {
        type: Boolean,
        default: false,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    loading: {
        type: Boolean,
        default: false,
    },
    variant: {
        type: String,
        default: "outlined",
    },
    hideDetails: {
        type: [Boolean, String],
        default: "auto",
    },
});

const emit = defineEmits(["update:modelValue"]);

const localValue = ref(props.modelValue);

watch(
    () => props.modelValue,
    (newValue) => {
        localValue.value = newValue;
    },
    { immediate: true }
);

const handleSelection = (value) => {
    localValue.value = value;
    emit("update:modelValue", value);
};
</script>

<template>
    <div class="select-container">
        <v-select
            class="w-100"
            :label="label"
            :items="items"
            v-model="localValue"
            @update:modelValue="handleSelection"
            :item-title="itemTitle"
            :item-value="itemValue"
            :multiple="multiple"
            :chips="chips"
            :closable-chips="closableChips"
            :disabled="disabled"
            :loading="loading"
            :variant="variant"
            :hide-details="hideDetails"
        ></v-select>
    </div>
</template>

<style scoped>
.select-container {
    width: 100%;
}

.w-100 {
    width: 100%;
}
</style>
