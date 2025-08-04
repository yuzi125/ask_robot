<script setup>
import { defineProps, defineEmits } from "vue";

const props = defineProps({
    item: Object,
    multiSelectMode: Boolean,
    isSelected: Boolean,
});

const emit = defineEmits(["toggleSelection", "openDialog"]);

const handleClick = () => {
    if (props.multiSelectMode) {
        emit("toggleSelection");
    } else {
        emit("openDialog");
    }
};

const truncateText = (text, length) => {
    return text.length > length ? text.slice(0, length) + "..." : text;
};
</script>

<template>
    <v-card @click="handleClick" :class="{ selected: isSelected }" elevation="2" hover>
        <v-card-title class="subtitle-1"> Q: {{ truncateText(item.question, 15) }} </v-card-title>
        <v-card-text>
            <p class="mb-2">A: {{ truncateText(item.answer, 15) }}</p>
            <v-row class="space-between align-center" no-gutters>
                <v-col>
                    <v-chip x-small>Chunks: {{ item.related_chunk_ids.length }} </v-chip>
                </v-col>
                <v-col v-if="multiSelectMode" cols="auto">
                    <v-checkbox
                        :model-value="isSelected"
                        @change="$emit('toggleSelection')"
                        @click.stop
                        hide-details
                        dense
                    ></v-checkbox>
                </v-col>
            </v-row>
            <v-row class="mt-2 chip-row">
                <v-col class="d-flex justify-space-between">
                    <v-chip class="model-chip custom-x-small" color="primary">模型名稱: {{ item.model_name }}</v-chip>
                    <v-chip class="usage-chip model-chip custom-x-small">使用次數: {{ item.usage_count }}</v-chip>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.v-card.selected {
    border: 2px solid var(--v-primary-base);
}

.v-card:hover {
    transform: translateY(-2px);
    transition: transform 0.2s ease-in-out;
}

.model-chip {
    font-size: 0.625rem;
}

.custom-x-small {
    height: 25px !important; /* 降低高度 */
    padding: 0 6px !important; /* 減少內邊距 */
}
</style>
