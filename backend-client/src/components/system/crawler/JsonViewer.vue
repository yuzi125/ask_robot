<script setup>
import { computed } from "vue";

const props = defineProps({
    data: {
        type: Object,
        required: true,
    },
});

const formattedJSON = computed(() => {
    if (!props.data) return "";
    return JSON.stringify(props.data, null, 2)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            function (match) {
                let cls = "number";
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = "key";
                    } else {
                        cls = "string";
                    }
                } else if (/true|false/.test(match)) {
                    cls = "boolean";
                } else if (/null/.test(match)) {
                    cls = "null";
                }
                return '<span class="' + cls + '">' + match + "</span>";
            }
        );
});
</script>

<template>
    <v-sheet class="mt-4 json-display" elevation="2">
        <div class="pa-4">
            <h3 class="mb-2">資料顯示</h3>
            <pre v-html="formattedJSON"></pre>
        </div>
    </v-sheet>
</template>

<style scoped>
.json-display {
    max-height: 600px;
    overflow-y: auto;
    background-color: #ffffff;
    border-radius: 8px;
}

pre {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: "Courier New", Courier, monospace;
    font-size: 14px;
    line-height: 1.5;
}

/* JSON 語法高亮的顏色 */
:deep(.key) {
    color: #a31515;
    font-weight: bold;
}

:deep(.string) {
    color: #0451a5;
}

:deep(.number) {
    color: #098658;
}

:deep(.boolean) {
    color: #0000ff;
}

:deep(.null) {
    color: #800080;
}
</style>
