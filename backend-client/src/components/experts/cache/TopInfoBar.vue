<script setup>
import { watch, computed } from "vue";

const props = defineProps({
    cacheDeleteFrequency: Number,
    multiSelectMode: Boolean,
    selectAll: Boolean,
    selectedItemsCount: Number,
    expertConfigJsonData: Object,
});

const emit = defineEmits(["update:multiSelectMode", "openSettings", "deleteSelected", "toggleSelectAll"]);

const internalMultiSelectMode = computed({
    get: () => props.multiSelectMode,
    set: (value) => emit("update:multiSelectMode", value),
});

const cacheDateData = computed(() => {
    let cacheDeleteFrequency = props.expertConfigJsonData.cache_delete_frequency;

    if (cacheDeleteFrequency === undefined) {
        cacheDeleteFrequency = "-";
    }

    return {
        cacheDeleteFrequency,
    };
});

watch(
    () => props.multiSelectMode,
    (newValue) => {
        if (!newValue) {
            emit("toggleSelectAll", false);
        }
    }
);
</script>

<template>
    <v-card class="mb-4">
        <v-card-text class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
                <v-chip class="mr-4" large outlined color="grey darken-1">
                    <v-icon left>mdi-update</v-icon>
                    快取清理頻率: {{ cacheDateData.cacheDeleteFrequency }} 天
                </v-chip>
            </div>

            <div class="d-flex align-center">
                <v-btn-toggle v-model="internalMultiSelectMode" mandatory>
                    <v-btn :value="false" small>
                        <v-icon left>mdi-view-grid</v-icon>
                        瀏覽模式
                    </v-btn>
                    <v-btn :value="true" small>
                        <v-icon left>mdi-checkbox-multiple-marked-outline</v-icon>
                        多選刪除
                    </v-btn>
                    <v-menu v-if="internalMultiSelectMode" :close-on-content-click="false">
                        <template v-slot:activator="{ props }">
                            <v-btn small v-bind="props"> 操作 </v-btn>
                        </template>
                        <v-list>
                            <v-list-item @click="$emit('deleteSelected')" :disabled="selectedItemsCount === 0">
                                <v-list-item-title>刪除所選項目</v-list-item-title>
                            </v-list-item>
                            <v-list-item @click.stop>
                                <v-checkbox
                                    :model-value="selectAll"
                                    @update:model-value="$emit('toggleSelectAll', $event)"
                                    hide-details
                                    label="全選"
                                ></v-checkbox>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </v-btn-toggle>

                <v-btn icon @click="$emit('openSettings')" class="ml-2">
                    <v-icon>mdi-cog</v-icon>
                </v-btn>
            </div>
        </v-card-text>
    </v-card>
</template>
