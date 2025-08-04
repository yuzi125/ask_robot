<script setup>
import { ref, watch, computed } from "vue";

const props = defineProps({
    modelValue: {
        type: [Number, Boolean, Array, Object],
        required: true,
    },
    options: {
        type: Array,
        required: true,
    },
    label: {
        type: String,
        required: true,
    },
    multiple: {
        type: Boolean,
        default: false,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    chips: {
        type: Boolean,
        default: false,
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

const titleKey = computed(() => {
    return props.options.length && props.options[0].name !== undefined
        ? "name"
        : "title";
});

const valueKey = computed(() => {
    return props.options.length && props.options[0].value !== undefined
        ? "value"
        : "id";
});
</script>

<template>
    <div class="selectorContainer">
        <v-select
            v-model="localValue"
            :items="options"
            :item-title="titleKey"
            :item-value="valueKey"
            :label="label"
            :multiple="multiple"
            :chips="chips"
            closable-chips
            @update:modelValue="handleSelection"
            :disabled="disabled"
        >
            <!-- 有需要自訂 chip 標籤能使用 -->
            <!-- <template v-if="chips" v-slot:chip="{ props, item }">
                <v-chip v-bind="props" closable>
                    {{ item.raw.name ?? item.raw.title ?? '未知項目' }}
                </v-chip>
            </template> -->
        </v-select>
    </div>
</template>

<style scoped>
.selectorContainer {
    flex: 1;
}
</style> 