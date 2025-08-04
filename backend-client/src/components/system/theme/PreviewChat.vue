<!-- components/system/theme/PreviewPanel.vue -->
<script setup>
import { computed } from "vue";
import robot from "@/assets/robot.png";
const props = defineProps({
    colors: {
        type: Object,
        required: true,
    },
    activePanel: {
        type: [String, null],
        default: null,
    },
    menuItems: {
        type: Array,
        required: true,
    },
    messages: {
        type: Array,
        required: true,
    },
    username: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(["section-click"]);

const handleSectionClick = (section, event) => {
    emit("section-click", section, event);
};

// 將 hex 顏色轉換為 rgba
const hexToRgba = (hex, alpha = 1) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 計算淡化後的背景色
const lightInputAreaBg = computed(() => {
    return hexToRgba(props.colors.inputArea.bg, 0.8); // 0.8 是透明度，可以調整
});
</script>

<template>
    <div class="preview-layout d-flex">
        <div
            class="navigation-wrapper"
            :class="{ 'highlight-area': activePanel === 'navigation' }"
            :style="{ backgroundColor: colors.navigation.bg, cursor: 'pointer' }"
            @click="(e) => handleSectionClick('navigation', e)"
        >
            <v-list class="pa-0 h-100" :style="{ backgroundColor: colors.navigation.bg }">
                <v-list-item
                    v-for="(item, index) in menuItems"
                    :key="index"
                    :title="item.text"
                    class="py-2"
                    :style="{
                        color: colors.navigation.text,
                        backgroundColor: index === 0 ? colors.navigation.roomActiveBg : '',
                    }"
                >
                    <template v-slot:prepend>
                        <v-avatar size="32" class="mr-3 robot-avatar">
                            <v-img :src="robot" />
                        </v-avatar>
                    </template>
                </v-list-item>
            </v-list>
        </div>

        <div class="chat-main-content">
            <div
                class="px-4 py-2 d-flex align-center top-bar justify-space-between"
                :class="{ 'highlight-area': activePanel === 'topBar' }"
                :style="{ backgroundColor: colors.topBar.bg, cursor: 'pointer' }"
                @click="(e) => handleSectionClick('topBar', e)"
            >
                <div>
                    <v-icon :style="{ color: colors.topBar.text }" icon="mdi-menu"></v-icon>
                </div>
                <div class="d-flex align-center">
                    <v-img width="32" :src="robot" class="mr-2 robot-avatar" />
                    <span :style="{ color: colors.topBar.text }">高市府智能客服</span>
                </div>
                <div class="d-flex align-center">
                    <span :style="{ color: colors.topBar.text }">{{ username }} </span>
                    <v-icon :style="{ color: colors.topBar.text }" icon="mdi-dots-vertical"></v-icon>
                </div>
            </div>

            <div
                class="chat-area"
                :class="{ 'highlight-area': activePanel === 'chatArea' }"
                :style="{ backgroundColor: colors.chatArea.bg, cursor: 'pointer' }"
                @click="(e) => handleSectionClick('chatArea', e)"
            >
                <div class="pa-4">
                    <div
                        v-for="(message, index) in messages"
                        :key="index"
                        class="mb-4 message-wrapper"
                        :class="{ 'justify-end': message.avatar.includes('user') }"
                    >
                        <div
                            class="message-content"
                            :class="{ 'user-message': message.avatar.includes('user') }"
                            :style="{
                                color: colors.chatArea.text,
                            }"
                        >
                            <div class="d-flex align-center">
                                <template v-if="!message.avatar.includes('user')">
                                    <v-avatar size="32" class="mr-3 robot-avatar">
                                        <v-img :src="message.avatar" />
                                    </v-avatar>
                                </template>
                                <span
                                    class="message-text"
                                    :style="{
                                        backgroundColor: message.avatar.includes('user')
                                            ? colors.chatArea.userBg
                                            : colors.chatArea.robotBg,
                                        color: message.avatar.includes('user')
                                            ? colors.chatArea.userText
                                            : colors.chatArea.robotText,
                                    }"
                                    >{{ message.text }}

                                    <div class="d-flex align-center">
                                        <a
                                            v-if="!message.avatar.includes('user')"
                                            class="number-btn"
                                            :style="{
                                                backgroundColor: colors.chatArea.robotBtn,
                                                color: colors.chatArea.robotBtnText,
                                            }"
                                        >
                                            1
                                        </a>
                                        <a
                                            v-if="!message.avatar.includes('user')"
                                            class="long-link-btn"
                                            :style="{
                                                backgroundColor: colors.chatArea.robotLongBtn,
                                                color: colors.chatArea.robotLongBtnText,
                                            }"
                                        >
                                            長文字連結按鈕
                                            <i
                                                class="ml-1 fa-solid fa-arrow-up-right-from-square"
                                                style="font-size: 0.75rem"
                                            ></i>
                                        </a>
                                    </div>
                                </span>

                                <template v-if="message.avatar.includes('user')">
                                    <v-avatar size="32" class="ml-3 user-avatar">
                                        <v-img :src="message.avatar" />
                                    </v-avatar>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                :class="{ 'highlight-area': activePanel === 'inputArea' }"
                :style="{
                    backgroundColor: colors.inputArea.bg,
                    cursor: 'pointer',
                }"
                @click="(e) => handleSectionClick('inputArea', e)"
            >
                <v-container fluid class="px-4 py-2">
                    <div class="d-flex align-center">
                        <v-text-field
                            hide-details
                            variant="outlined"
                            density="compact"
                            class="mr-2 input-area-text-field"
                            :style="{
                                backgroundColor: colors.base.secondary,
                            }"
                        >
                            <span :style="{ color: colors.inputArea.text }">範例文字範例文字</span>
                        </v-text-field>
                        <v-btn icon class="ml-2" color="primary">
                            <v-icon>mdi-arrow-up</v-icon>
                        </v-btn>
                    </div>
                </v-container>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.preview-layout {
    width: 100%;
    height: 100%;
}

.chat-main-content {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
}

.navigation-wrapper {
    width: 250px;
    height: 100%;
    /* border-right: 1px solid #424242; */
}

/* .input-area-text-field {
    border: 1px solid #ffffff;
    border-radius: 24px;
} */

.top-bar {
    height: 64px;
    /* border-bottom: 1px solid #424242; */
}

.chat-area {
    flex: 1;
    overflow-y: auto;
}

.color-btn {
    background-color: #1e1e1e !important;
}

.message-wrapper {
    display: flex;
    width: 100%;
}

.message-content {
    max-width: 80%;
    padding: 12px;
    border-radius: 8px;
}

.robot-avatar {
    border-radius: 50%;
    background-color: #ffffff;
}

.user-avatar {
    border-radius: 50%;
    background-color: #ffffff;
}

.message-text {
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;

    .long-link-btn {
        margin-left: 6px;
        padding: 0.5rem;
        border-radius: 0.3rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .number-btn {
        margin-left: 6px;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
}

.highlight-area {
    position: relative;

    &::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border: 2px solid #ffe31a;
        border-radius: 4px;
        pointer-events: none;
        z-index: 1;
    }
}
</style>
