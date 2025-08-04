<script setup>
import { defineProps, defineEmits } from "vue";
import KnowledgeCard from "./KnowledgeCard.vue";

const props = defineProps({
    items: Array,
    multiSelectMode: Boolean,
    selectedItems: Array,
});

const emit = defineEmits(["toggleSelection", "openDialog"]);

const isSelected = (item) => {
    return props.selectedItems.some((i) => i.id === item.id);
};
</script>

<template>
    <v-row>
        <v-col v-for="item in items.items" :key="item.id" cols="12" sm="6" md="4" lg="3">
            <KnowledgeCard
                :item="item"
                :multiSelectMode="multiSelectMode"
                :isSelected="isSelected(item)"
                @toggleSelection="$emit('toggleSelection', item)"
                @openDialog="$emit('openDialog', item)"
            />
        </v-col>
    </v-row>
</template>
