<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
    src: { type: String, required: true },
});

const emit = defineEmits(["rendered", "error"]);

const content = ref("");

const loadContent = async () => {
    try {
        const response = await fetch(props.src);
        const text = await response.text();
        content.value = text;
        emit("rendered");
    } catch (error) {
        console.error("Error loading txt file:", error);
        emit("error", error);
    }
};

onMounted(() => {
    loadContent();
});
</script>

<template>
    <div class="txt-preview">
        <pre class="txt-content">{{ content }}</pre>
    </div>
</template>

<style scoped>
.txt-preview {
    padding: 20px;
    height: 100%;
    width: 100%;
    overflow: auto;
    background: white;
}

.txt-content {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: monospace;
    margin: 0;
    padding: 16px;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.6;
}
</style>
