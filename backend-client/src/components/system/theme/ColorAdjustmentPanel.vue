<script setup>
import AreaColorSettings from "@/components/system/theme/AreaColorSettings.vue";
import ColorPicker from "@/components/system/theme/ColorPicker.vue";

const props = defineProps({
    width: Number,
    modelValue: {
        // for v-tabs
        type: [String, Number],
        default: "base",
    },
    activePanelValue: {
        // for v-expansion-panels
        type: [String, null],
        default: null,
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
    sections: {
        type: Object,
        required: true,
    },
});
const emit = defineEmits(["update:modelValue", "update:activePanelValue", "update-color", "update:color-pickers"]);
const handleColorUpdate = (section, type, color) => {
    emit("update-color", section, type, color);
};

const handleColorPickerVisibility = (section, type, value) => {
    emit("update:color-pickers", section, type, value);
};
</script>

<template>
    <div :style="{ width: width > 1600 ? '400px' : '100%' }" class="border-r">
        <v-tabs
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            color="primary"
            align-tabs="center"
            grow
        >
            <v-tab value="base">
                <v-icon icon="mdi-palette" class="mr-2"></v-icon>
                基礎顏色
            </v-tab>
            <v-tab value="areas">
                <v-icon icon="mdi-view-dashboard" class="mr-2"></v-icon>
                區域顏色
            </v-tab>
        </v-tabs>
        <v-divider></v-divider>

        <div class="pa-4">
            <v-window :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
                <!-- 基礎顏色設定頁面 -->
                <v-window-item value="base">
                    <div class="mb-6">
                        <div class="mb-4 d-flex align-center">
                            <span class="text-subtitle-1 font-weight-medium">基礎顏色設定</span>
                        </div>
                        <v-divider class="mb-4"></v-divider>
                        <div class="px-2">
                            <ColorPicker
                                v-for="(label, type) in {
                                    primary: '主要顏色',
                                    secondary: '第二顏色',
                                    tertiary: '第三顏色',
                                }"
                                :key="type"
                                :label="label"
                                :color-value="colors.base[type]"
                                :color-picker-value="colorPickers.base[type]"
                                :swatches="swatches"
                                class="mb-4"
                                @update:color="(color) => handleColorUpdate('base', type, color)"
                                @update:color-picker-value="(value) => handleColorPickerVisibility('base', type, value)"
                            />
                        </div>
                    </div>

                    <!-- 對話框設定 -->
                    <div>
                        <div class="mb-4 d-flex align-center">
                            <v-icon icon="mdi-message-text" color="primary" class="mr-2"></v-icon>
                            <span class="text-subtitle-1 font-weight-medium">對話框設定</span>
                        </div>
                        <v-divider class="mb-4"></v-divider>
                        <div class="px-2">
                            <!-- 機器人對話框 -->
                            <div class="mb-4">
                                <v-chip color="primary" size="small" class="mb-2" variant="flat">機器人對話框</v-chip>
                                <ColorPicker
                                    label="背景顏色"
                                    :color-value="colors.chatArea.robotBg"
                                    :color-picker-value="colorPickers.chatArea.robotBg"
                                    :swatches="swatches"
                                    class="mb-2"
                                    @update:color="(color) => handleColorUpdate('chatArea', 'robotBg', color)"
                                    @update:color-picker-value="
                                        (value) => handleColorPickerVisibility('chatArea', 'robotBg', value)
                                    "
                                />
                                <ColorPicker
                                    label="文字顏色"
                                    :color-value="colors.chatArea.robotText"
                                    :color-picker-value="colorPickers.chatArea.robotText"
                                    :swatches="swatches"
                                    class="mb-4"
                                    @update:color="(color) => handleColorUpdate('chatArea', 'robotText', color)"
                                    @update:color-picker-value="
                                        (value) => handleColorPickerVisibility('chatArea', 'robotText', value)
                                    "
                                />
                                <ColorPicker
                                    label="按鈕字體"
                                    :color-value="colors.chatArea.robotBtnText"
                                    :color-picker-value="colorPickers.chatArea.robotBtnText"
                                    :swatches="swatches"
                                    class="mb-4"
                                    @update:color="(color) => handleColorUpdate('chatArea', 'robotBtnText', color)"
                                    @update:color-picker-value="
                                        (value) => handleColorPickerVisibility('chatArea', 'robotBtnText', value)
                                    "
                                />
                                <ColorPicker
                                    label="按鈕背景"
                                    :color-value="colors.chatArea.robotBtn"
                                    :color-picker-value="colorPickers.chatArea.robotBtn"
                                    :swatches="swatches"
                                    class="mb-4"
                                    @update:color="(color) => handleColorUpdate('chatArea', 'robotBtn', color)"
                                    @update:color-picker-value="
                                        (value) => handleColorPickerVisibility('chatArea', 'robotBtn', value)
                                    "
                                />
                                <ColorPicker
                                    label="長文字按鈕字體"
                                    :color-value="colors.chatArea.robotLongBtnText"
                                    :color-picker-value="colorPickers.chatArea.robotLongBtnText"
                                    :swatches="swatches"
                                    class="mb-4"
                                    @update:color="(color) => handleColorUpdate('chatArea', 'robotLongBtnText', color)"
                                    @update:color-picker-value="
                                        (value) => handleColorPickerVisibility('chatArea', 'robotLongBtnText', value)
                                    "
                                />
                                <ColorPicker
                                    label="長文字按鈕背景"
                                    :color-value="colors.chatArea.robotLongBtn"
                                    :color-picker-value="colorPickers.chatArea.robotLongBtn"
                                    :swatches="swatches"
                                    class="mb-4"
                                    @update:color="(color) => handleColorUpdate('chatArea', 'robotLongBtn', color)"
                                    @update:color-picker-value="
                                        (value) => handleColorPickerVisibility('chatArea', 'robotLongBtn', value)
                                    "
                                />
                            </div>

                            <!-- 使用者對話框 -->
                            <div>
                                <v-chip color="primary" size="small" class="mb-2" variant="flat">使用者對話框</v-chip>
                                <ColorPicker
                                    label="背景顏色"
                                    :color-value="colors.chatArea.userBg"
                                    :color-picker-value="colorPickers.chatArea.userBg"
                                    :swatches="swatches"
                                    class="mb-2"
                                    @update:color="(color) => handleColorUpdate('chatArea', 'userBg', color)"
                                    @update:color-picker-value="
                                        (value) => handleColorPickerVisibility('chatArea', 'userBg', value)
                                    "
                                />
                                <ColorPicker
                                    label="文字顏色"
                                    :color-value="colors.chatArea.userText"
                                    :color-picker-value="colorPickers.chatArea.userText"
                                    :swatches="swatches"
                                    @update:color="(color) => handleColorUpdate('chatArea', 'userText', color)"
                                    @update:color-picker-value="
                                        (value) => handleColorPickerVisibility('chatArea', 'userText', value)
                                    "
                                />
                            </div>
                        </div>
                    </div>
                </v-window-item>

                <!-- 區域顏色設定頁面 -->
                <v-window-item value="areas">
                    <div class="mb-4 text-subtitle-1 font-weight-medium">區域顏色設定</div>
                    <v-expansion-panels
                        :model-value="activePanelValue"
                        @update:model-value="$emit('update:activePanelValue', $event)"
                        variant="accordion"
                    >
                        <v-expansion-panel v-for="section in Object.keys(sections)" :key="section" :value="section">
                            <v-expansion-panel-title>
                                <v-icon :icon="sections[section].icon" class="mr-2"></v-icon>
                                {{ sections[section].title }}
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <AreaColorSettings
                                    :section="section"
                                    :colors="colors"
                                    :color-pickers="colorPickers"
                                    :swatches="swatches"
                                    @update-color="handleColorUpdate"
                                    @update:color-pickers="handleColorPickerVisibility"
                                />
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>
                </v-window-item>
            </v-window>
        </div>
    </div>
</template>
