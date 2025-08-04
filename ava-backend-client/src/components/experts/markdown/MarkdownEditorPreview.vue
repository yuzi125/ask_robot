<script setup>
import { ref, onMounted, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

const props = defineProps({
    modelValue: {
        type: String,
        default: "",
    },
    avatar: {
        type: Object,
        default: {
            text: "./robot.png",
        },
    },
});

const emit = defineEmits(["update:modelValue"]);

const markdownContent = ref(props.modelValue);
const renderedContent = ref("");

const updatePreview = () => {
    renderedContent.value = marked(markdownContent.value);
};

watch(
    () => props.modelValue,
    (newValue) => {
        if (newValue !== markdownContent.value) {
            markdownContent.value = newValue;
            updatePreview();
        }
    }
);

onMounted(() => {
    updatePreview();
});
</script>

<template>
    <v-card outlined height="100%">
        <v-card-title class="title">預覽</v-card-title>
        <v-card-text class="pt-4">
            <v-row>
                <v-col cols="2">
                    <v-avatar color="surface-variant" :image="props.avatar.text" size="36"></v-avatar>
                </v-col>
                <v-col cols="10">
                    <div class="mkd" v-dompurify-html="renderedContent"></div>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.v-card {
    display: flex;
    flex-direction: column;
}

.v-card__text {
    flex-grow: 1;
    overflow-y: auto;
}

.title {
    background-color: #e3f2fd;
}
</style>
