<script setup>
import { computed, ref } from "vue";

const props = defineProps({
    modelValue: {
        type: Boolean,
        required: true,
    },
    historyItems: {
        type: Array,
        required: true,
    },
});

const emit = defineEmits(["update:modelValue", "copy"]);

// 用於控制各記錄的展開/收起狀態
const expandedItems = ref({});

// 按日期分組的歷史記錄
const groupedHistory = computed(() => {
    const grouped = {};
    props.historyItems.forEach((item) => {
        const date = new Date(item.date).toLocaleDateString();
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(item);
    });
    return Object.entries(grouped).map(([date, items]) => ({
        date,
        items,
    }));
});

// 切換項目的展開/收起狀態
const toggleExpand = (date, index) => {
    const key = `${date}-${index}`;
    expandedItems.value[key] = !expandedItems.value[key];
};

// 檢查項目是否已展開
const isExpanded = (date, index) => {
    const key = `${date}-${index}`;
    return !!expandedItems.value[key];
};

// 複製 UUID 到剪貼簿並通知父組件
const handleCopy = (text) => {
    emit("copy", text);
};

// 更新 modelValue 以控制對話框的顯示/隱藏
const updateModelValue = (value) => {
    emit("update:modelValue", value);
};
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="updateModelValue" max-width="600px">
        <v-card>
            <v-card-title class="headline d-flex justify-space-between align-center">
                發送站點歷史記錄
                <v-btn icon @click="updateModelValue(false)">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-card-text>
                <v-expansion-panels>
                    <v-expansion-panel v-for="(group, groupIndex) in groupedHistory" :key="groupIndex">
                        <v-expansion-panel-title>
                            {{ group.date }}
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-list density="compact">
                                <v-list-item v-for="(item, itemIndex) in group.items" :key="itemIndex">
                                    <v-list-item-title class="subtitle-2">
                                        {{ new Date(item.date).toLocaleTimeString() }}
                                    </v-list-item-title>
                                    <v-list-item-subtitle class="d-flex align-center">
                                        <span class="uuid-text" @click="handleCopy(item.uuid)">
                                            UUID: {{ item.uuid }}
                                        </span>

                                        <v-btn icon x-small class="ml-2" variant="text" @click="handleCopy(item.uuid)">
                                            <v-icon>mdi-content-copy</v-icon>
                                        </v-btn>
                                    </v-list-item-subtitle>
                                    <v-list-item-subtitle>
                                        <template v-if="item.sites.length <= 3 || isExpanded(group.date, itemIndex)">
                                            <v-chip
                                                v-for="site in item.sites"
                                                :key="site.site_id"
                                                class="mt-1 mr-1"
                                                size="x-small"
                                                label
                                            >
                                                {{ site.title }}
                                            </v-chip>
                                        </template>
                                        <template v-else>
                                            <v-chip
                                                v-for="site in item.sites.slice(0, 3)"
                                                :key="site.site_id"
                                                class="mt-1 mr-1"
                                                size="x-small"
                                                label
                                            >
                                                {{ site.title }}
                                            </v-chip>
                                            <v-btn x-small text @click="toggleExpand(group.date, itemIndex)">
                                                顯示更多 ({{ item.sites.length - 3 }})
                                            </v-btn>
                                        </template>
                                    </v-list-item-subtitle>
                                </v-list-item>
                            </v-list>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.uuid-text {
    cursor: pointer;
    &:hover {
        text-decoration: underline;
    }
}

:deep(.v-list-item-subtitle) {
    padding: 5px !important;
}

:deep(.v-expansion-panel-text__wrapper) {
    padding: 0px !important;
}
</style>
