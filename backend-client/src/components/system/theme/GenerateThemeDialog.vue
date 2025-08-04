<script setup>
import { ref, watch } from "vue";
import PreviewChat from "./PreviewChat.vue";
import user from "@/assets/user_man.png";
import robot from "@/assets/robot.png";

const props = defineProps({
    modelValue: Boolean,
    generating: Boolean,
    generatedTheme: {
        type: Object,
        default: null,
    },
});

const emit = defineEmits(["update:modelValue", "generate", "save-generated-theme"]);

const prompt = ref("");

// 添加編輯用的 ref
const editedName = ref("");
const editedRemark = ref("");

// 預覽用的資料
const previewMenuItems = [
    { icon: "mdi-account-group", text: "高市府智能客服" },
    { icon: "mdi-briefcase", text: "運動發展局-專家" },
];

const previewMessages = [
    {
        avatar: user,
        text: "歡迎使用",
    },
    {
        avatar: robot,
        text: "哈囉哈囉",
    },
];

// 新增其他必要的 props
const activePanel = ref(null);
const username = ref("使用者");

const handleGenerate = () => {
    emit("generate", prompt.value);
};

const handleSaveTheme = () => {
    emit("save-generated-theme", {
        ...props.generatedTheme,
        name: editedName.value,
        remark: editedRemark.value,
    });
    prompt.value = "";
};

// 新增處理 section-click 的方法
const handleSectionClick = () => {
    // 在預覽模式下，不需要實際處理點擊事件
    return;
};

// 當 generatedTheme 改變時，初始化編輯值
watch(
    () => props.generatedTheme,
    (newTheme) => {
        if (newTheme) {
            editedName.value = newTheme.name;
            editedRemark.value = newTheme.remark;
        }
    },
    { immediate: true }
);
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="1200">
        <v-card>
            <v-card-title class="d-flex align-center pa-4">
                <v-icon icon="mdi-robot" color="primary" class="mr-2" />
                <span class="text-h5">AI生成主題</span>
            </v-card-title>

            <v-card-text class="pa-4">
                <div class="d-flex" style="gap: 24px">
                    <!-- 左側：輸入和說明 -->
                    <div class="flex-grow-0" style="width: 400px">
                        <template v-if="!generatedTheme">
                            <p class="mb-4 text-body-1">描述你想要的主題風格，AI 將為你生成對應的配色方案。</p>
                            <p class="mb-2 text-body-2 text-medium-emphasis">例如：</p>
                            <ul class="mb-4 text-body-2 text-medium-emphasis">
                                <li>我想要一個充滿海洋風格的主題，使用深淺藍色系</li>
                                <li>幫我生成一個森林風格的主題，以綠色為主色調</li>
                                <li>我需要一個溫暖的秋季主題，使用橙色和棕色</li>
                            </ul>
                            <v-textarea
                                v-model="prompt"
                                label="描述你想要的主題風格"
                                variant="outlined"
                                rows="3"
                                counter
                                :disabled="generating"
                            ></v-textarea>
                        </template>

                        <template v-if="generatedTheme">
                            <v-alert color="success" icon="mdi-check-circle" variant="tonal" class="mb-4">
                                AI 已為你生成了主題配色！
                            </v-alert>
                            <div class="rounded theme-preview pa-4 bg-grey-lighten-4">
                                <v-text-field
                                    v-model="editedName"
                                    label="主題名稱"
                                    variant="outlined"
                                    class="mb-2"
                                ></v-text-field>
                                <v-text-field v-model="editedRemark" label="主題備註" variant="outlined"></v-text-field>
                            </div>
                        </template>
                    </div>

                    <!-- 右側：預覽區域 -->
                    <div v-if="generatedTheme" class="flex-grow-1">
                        <p class="mb-4 text-subtitle-1 font-weight-medium">主題預覽：</p>
                        <v-card class="preview-container">
                            <PreviewChat
                                :colors="generatedTheme.colors"
                                :menu-items="previewMenuItems"
                                :messages="previewMessages"
                                :username="username"
                                :active-panel="activePanel"
                                @section-click="handleSectionClick"
                            />
                        </v-card>
                    </div>
                </div>
            </v-card-text>

            <v-card-actions class="pa-4">
                <v-spacer></v-spacer>
                <v-btn color="grey" variant="text" @click="$emit('update:modelValue', false)">
                    {{ generatedTheme ? "取消" : "關閉" }}
                </v-btn>
                <template v-if="!generatedTheme">
                    <v-btn color="primary" :loading="generating" @click="handleGenerate" :disabled="!prompt">
                        生成主題
                    </v-btn>
                </template>
                <template v-else>
                    <v-btn color="primary" @click="handleGenerate" :loading="generating" variant="text" class="mr-2">
                        重新生成
                    </v-btn>
                    <v-btn color="success" @click="handleSaveTheme">儲存此主題</v-btn>
                </template>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.preview-container {
    height: 500px;
    overflow: hidden;
}
</style>
