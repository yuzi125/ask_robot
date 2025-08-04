<script setup>
const props = defineProps({
    label: {
        type: String,
        required: true,
    },
    colorValue: {
        type: String,
        required: true,
    },
    colorPickerValue: {
        type: Boolean,
        required: true,
    },
    swatches: {
        type: Array,
        required: true,
    },
});

const emit = defineEmits(["update:color", "update:colorPickerValue"]);
</script>

<template>
    <div class="mb-2 d-flex align-center">
        <span class="mr-2 text-caption" style="min-width: 80px">{{ label }}：</span>
        <!-- <div class="mr-2 color-preview-wrapper">
            <div class="color-preview-box" :style="{ backgroundColor: colorValue }"></div>
        </div> -->
        <v-text-field :value="colorValue" readonly hide-details density="compact" class="mr-2"></v-text-field>
        <v-menu
            :model-value="colorPickerValue"
            :close-on-content-click="false"
            @update:model-value="$emit('update:colorPickerValue', $event)"
        >
            <template v-slot:activator="{ props }">
                <v-btn icon v-bind="props" class="color-btn" variant="text">
                    <div class="color-preview-box" :style="{ backgroundColor: colorValue }"></div>
                </v-btn>
            </template>
            <v-card>
                <v-color-picker
                    :model-value="colorValue"
                    :swatches="swatches"
                    show-swatches
                    @update:model-value="$emit('update:color', $event)"
                ></v-color-picker>
            </v-card>
        </v-menu>
    </div>
</template>

<style scoped>
.color-btn {
    background: #eeeeee !important;
    border-radius: 4px !important;
    width: 36px;
    height: 36px;
}

.color-preview-wrapper {
    display: flex;
    align-items: center;
}

.color-preview-box {
    width: 24px;
    height: 24px;
    border-radius: 3px;
    border: 1px solid #243642;
    transition: all 0.3s ease;
}

.color-preview-box:hover {
    transform: scale(1.1);
}
</style>
