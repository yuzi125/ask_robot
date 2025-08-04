<script setup>
import { ref, computed, watch } from "vue";
import InputComponents from "@/components/InputComponents.vue";

const props = defineProps({
    modelValue: {
        type: Array,
        required: true,
    },
    scope: {
        type: String,
        default: "",
    },
    globalWords: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits(["update:modelValue"]);

const textAreaContent = ref(props.modelValue.join("\n"));
const error = ref("");
let originalContent = props.modelValue.join("\n");
const edit = ref(false);
const localModelValue = ref([...props.modelValue]);
const loading = ref(false);

const textPrisonData = ref({
    text: props.modelValue.join("\n"),
    name: "text_prison_words",
    edit: false,
    isJson: false,
});

const removeWord = (index) => {
    const newArray = [...localModelValue.value];
    newArray.splice(index, 1);
    updateModelValue(newArray);
};

const updateModelValue = (newValue) => {
    localModelValue.value = newValue;
    emit("update:modelValue", newValue);
    textAreaContent.value = newValue.join("\n");
    originalContent = textAreaContent.value;
    textPrisonData.value.text = newValue.join("\n");
};

const handleInputUpdate = (item) => {
    loading.value = true;
    const newArray = item.text.split("\n").filter((word) => word.trim() !== "");
    updateModelValue(newArray);
    loading.value = false;
};

const containerStyle = computed(() => {
    return props.scope === "global" ? { paddingBottom: "2rem" } : {};
});

watch(
    () => props.modelValue,
    (newValue) => {
        localModelValue.value = [...newValue];
        textAreaContent.value = newValue.join("\n");
        originalContent = textAreaContent.value;
        textPrisonData.value.text = newValue.join("\n");
    },
    { deep: true }
);
</script>

<template>
    <div class="textPrisonContainer" :style="containerStyle">
        <div class="section-header">
            <span class="text-h6 font-weight-medium">禁用詞設定</span>
            <div class="tooltip-wrapper">
                <span class="mdi mdi-help-circle text-grey"></span>
                <v-tooltip activator="parent" location="right"
                    >當使用者輸入的訊息有包含禁用詞內的文字，即回覆尚未了解過相關知識。</v-tooltip
                >
            </div>
        </div>

        <template v-if="scope === 'expert'">
            <div class="mb-4">
                <h3 class="mb-2 text-subtitle-1 font-weight-bold">全域禁用詞</h3>
                <div class="mb-4 chipContainer" v-if="globalWords.length >= 1">
                    <v-chip
                        v-for="(word, index) in globalWords"
                        :key="'global-' + word + index"
                        class="ma-1 custom-chip"
                        color="primary"
                        label
                        variant="elevated"
                    >
                        <v-icon icon="mdi-message-text-lock" start class="mr-1"></v-icon>
                        {{ word }}
                    </v-chip>
                </div>

                <p v-else class="text-body-2 text-grey">尚未設定全域禁用詞</p>
            </div>

            <div class="mb-4">
                <h3 class="mb-2 text-subtitle-1 font-weight-bold">專家禁用詞</h3>
            </div>
        </template>

        <div class="mb-4 chipContainer" v-if="localModelValue.length >= 1">
            <v-chip
                v-for="(word, index) in localModelValue"
                :key="word + index"
                class="ma-1 custom-chip"
                :color="scope === 'expert' ? 'secondary' : 'primary'"
                label
                closable
                variant="elevated"
                @click:close="removeWord(index)"
            >
                <v-icon icon="mdi-message-text-lock" start class="mr-1"></v-icon>
                {{ word }}
            </v-chip>
        </div>

        <!-- 使用 InputComponents 替換原來的 v-textarea -->
        <InputComponents
            :loading="loading"
            :data="textPrisonData"
            @send="handleInputUpdate"
            multiline
            :rows="5"
            :label="scope === 'expert' ? '請輸入專家禁用詞（每行一個詞）' : '請輸入禁用詞（每行一個詞）'"
            hint="每行輸入一個禁用詞，系統將自動轉換為陣列格式"
        />

        <div v-if="error" class="mt-2 error-message red--text">
            {{ error }}
        </div>
    </div>
</template>

<style lang="scss" scoped>
.textPrisonContainer {
    display: flex;
    flex-direction: column;
    width: 100%;
    position: relative;
}

.section-header {
    display: flex;
    align-items: center;
    margin-bottom: 1.25rem;

    .text-h6 {
        color: #3a4173;
        font-weight: 500;
        margin-right: 8px;
    }

    .tooltip-wrapper {
        display: inline-flex;
        align-items: center;
        position: relative;

        .mdi-help-circle {
            opacity: 0.7;
            transition: opacity 0.2s;
            font-size: 1.1rem;
            cursor: pointer;

            &:hover {
                opacity: 1;
            }
        }
    }
}

.chipContainer {
    display: flex;
    flex-wrap: wrap;
    padding: 10px;
    background-color: #f5f5f5;
    border-radius: 8px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chipContainer--readonly {
    background-color: transparent;
    box-shadow: none;
    padding: 0;
}

.error-message {
    font-size: 0.875rem;
}

.custom-chip {
    font-weight: 500;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
}

.custom-chip:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

:deep(.custom-chip .v-chip__close) {
    opacity: 0.7;
    transition: opacity 0.3s ease;
}

:deep(.custom-chip:hover .v-chip__close) {
    opacity: 1;
}

.w-100 {
    width: 100%;
}

:deep(.v-field__input) {
    color: rgba(0, 0, 0, 0.87);
    font-size: 0.95rem;
}

:deep(.v-label) {
    color: rgba(0, 0, 0, 0.6);
    font-size: 0.95rem;
    font-weight: 500;
}

:deep(.v-field--focused .v-label) {
    color: #6576db;
}

:deep(.v-field--focused .v-field__outline) {
    color: #6576db;
}

:deep(.v-field) {
    border-radius: 8px;
    transition: all 0.3s ease;
}
</style>
