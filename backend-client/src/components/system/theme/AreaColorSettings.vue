<script setup>
import ColorPicker from "./ColorPicker.vue";

const props = defineProps({
    section: {
        type: String,
        required: true,
    },
    colors: {
        type: Object,
        required: true,
    },
    colorPickers: {
        type: Object,
        required: true,
    },
    swatches: {
        type: Array,
        required: true,
    },
});

const emit = defineEmits(["update-color", "update:colorPickers"]);

const handleColorUpdate = (type, color) => {
    emit("update-color", props.section, type, color);
};

const handleColorPickerVisibility = (type, value) => {
    emit("update:colorPickers", props.section, type, value);
};

const sectionNames = {
    navigation: "導航欄",
    topBar: "頂部欄",
    chatArea: "對話區域",
    inputArea: "輸入區域",
};
</script>

<template>
    <v-sheet rounded elevation="1" class="pa-3 input-card">
        <div class="d-flex flex-column">
            <span class="mb-4 text-h6">{{ sectionNames[section] }}</span>
            <div class="ml-2">
                <ColorPicker
                    label="背景顏色"
                    :color-value="colors[section].bg"
                    :color-picker-value="colorPickers[section].bg"
                    :swatches="swatches"
                    class="mb-2"
                    @update:color="(color) => handleColorUpdate('bg', color)"
                    @update:color-picker-value="(value) => handleColorPickerVisibility('bg', value)"
                />

                <ColorPicker
                    v-if="section !== 'chatArea'"
                    label="文字顏色"
                    :color-value="colors[section].text"
                    :color-picker-value="colorPickers[section].text"
                    :swatches="swatches"
                    @update:color="(color) => handleColorUpdate('text', color)"
                    @update:color-picker-value="(value) => handleColorPickerVisibility('text', value)"
                />

                <ColorPicker
                    v-if="section === 'navigation'"
                    label="當前聊天室顏色"
                    :color-value="colors[section].roomActiveBg"
                    :color-picker-value="colorPickers[section].roomActiveBg"
                    :swatches="swatches"
                    @update:color="(color) => handleColorUpdate('roomActiveBg', color)"
                    @update:color-picker-value="(value) => handleColorPickerVisibility('roomActiveBg', value)"
                />
            </div>
        </div>
    </v-sheet>
</template>
