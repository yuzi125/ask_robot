<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

const props = defineProps({
    modelValue: {
        type: [String, Number, Array],
        default: () => null,
    },
    items: {
        type: Array,
        default: () => [],
    },
    itemTitle: {
        type: String,
        default: "name",
    },
    itemValue: {
        type: String,
        default: "id",
    },
    label: {
        type: String,
        default: "",
    },
    loading: {
        type: Boolean,
        default: false,
    },
    multiple: {
        type: Boolean,
        default: false,
    },
    rules: {
        type: Array,
        default: () => [],
    },
    required: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["update:modelValue"]);

const menu = ref(false);
const searchInput = ref("");
const parentRef = ref(null);
const selectedItems = ref(Array.isArray(props.modelValue) ? [...props.modelValue] : []);
const selectedItem = ref(null);

// 全選相關計算屬性
const isAllSelected = computed(() => {
    return (
        filteredItems.value.length > 0 &&
        filteredItems.value.every((item) => selectedItems.value.includes(item[props.itemValue]))
    );
});

const isIndeterminate = computed(() => {
    const selectedCount = filteredItems.value.filter((item) =>
        selectedItems.value.includes(item[props.itemValue])
    ).length;
    return selectedCount > 0 && selectedCount < filteredItems.value.length;
});

// 監聽 modelValue 變化
watch(
    () => props.modelValue,
    (newValue) => {
        if (props.multiple) {
            selectedItems.value = Array.isArray(newValue) ? [...newValue] : [];
        } else {
            selectedItem.value = props.items.find((item) => item[props.itemValue] === newValue) || null;
        }
    },
    { deep: true }
);

// 過濾顯示項目
const filteredItems = computed(() => {
    return props.items.filter((item) => {
        const searchTerm = searchInput.value.toLowerCase();
        const itemText = item[props.itemTitle].toLowerCase();
        const itemNo = item.user_no?.toLowerCase() || "";
        return !searchTerm || itemText.includes(searchTerm) || itemNo.includes(searchTerm);
    });
});

// 設置虛擬滾動
const rowVirtualizer = ref(null);

function initializeVirtualizer() {
    rowVirtualizer.value = useVirtualizer({
        count: filteredItems.value.length,
        getScrollElement: () => parentRef.value,
        estimateSize: () => 48,
        overscan: 5,
    });
}

onMounted(() => {
    initializeVirtualizer();
});

watch([filteredItems, searchInput], () => {
    initializeVirtualizer();
});

// 顯示文本
const displayText = computed(() => {
    if (props.multiple) {
        return selectedItems.value
            .map((id) => {
                const item = props.items.find((i) => i[props.itemValue] === id);
                return item ? item[props.itemTitle] : "";
            })
            .filter((name) => name !== "")
            .join(", ");
    } else {
        if (!props.modelValue) return "";
        const item = props.items.find((item) => item[props.itemValue] === props.modelValue);
        return item ? item[props.itemTitle] : "";
    }
});

// 選擇項目
function selectItem(item) {
    if (props.multiple) {
        const value = item[props.itemValue];
        const index = selectedItems.value.indexOf(value);

        if (index === -1) {
            selectedItems.value.push(value);
        } else {
            selectedItems.value.splice(index, 1);
        }
        emit("update:modelValue", [...selectedItems.value]);
    } else {
        selectedItem.value = item;
        emit("update:modelValue", item[props.itemValue]);
        menu.value = false;
    }
    if (!props.multiple) {
        searchInput.value = "";
    }
}

// 全選功能
function toggleSelectAll() {
    if (isAllSelected.value) {
        // 取消全選
        const filteredValues = filteredItems.value.map((item) => item[props.itemValue]);
        selectedItems.value = selectedItems.value.filter((id) => !filteredValues.includes(id));
    } else {
        // 全選
        const newSelectedItems = new Set(selectedItems.value);
        filteredItems.value.forEach((item) => {
            newSelectedItems.add(item[props.itemValue]);
        });
        selectedItems.value = Array.from(newSelectedItems);
    }
    emit("update:modelValue", [...selectedItems.value]);
}

// 清除選擇
function clearSelection() {
    if (props.multiple) {
        selectedItems.value = [];
        emit("update:modelValue", []);
    } else {
        selectedItem.value = null;
        emit("update:modelValue", null);
    }
    searchInput.value = "";
}
</script>

<template>
    <v-menu v-model="menu" :close-on-content-click="false">
        <template v-slot:activator="{ props: menuProps }">
            <v-text-field
                :model-value="displayText"
                :label="label"
                :rules="rules"
                :required="required"
                readonly
                v-bind="menuProps"
                clearable
                @click:clear="clearSelection"
                :loading="loading"
            >
                <template v-slot:append>
                    <v-icon :icon="menu ? 'mdi-chevron-up' : 'mdi-chevron-down'"></v-icon>
                </template>
            </v-text-field>
        </template>

        <v-card min-width="300">
            <v-card-text class="pa-2">
                <v-text-field
                    v-model="searchInput"
                    label="搜尋"
                    density="compact"
                    variant="outlined"
                    class="mb-2"
                    clearable
                />

                <!-- 全選功能 -->
                <div v-if="multiple && filteredItems.length > 0" class="px-2 py-1">
                    <v-checkbox
                        :model-value="isAllSelected"
                        :indeterminate="isIndeterminate"
                        label="全選"
                        density="compact"
                        hide-details
                        @click="toggleSelectAll"
                    />
                    <v-divider class="my-1"></v-divider>
                </div>

                <div ref="parentRef" style="height: 250px; overflow-y: auto">
                    <div
                        :style="{
                            height: `${rowVirtualizer?.value?.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }"
                    >
                        <template v-if="!loading">
                            <template
                                v-for="virtualRow in rowVirtualizer?.value?.getVirtualItems()"
                                :key="virtualRow.key"
                            >
                                <v-list-item
                                    :style="{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }"
                                    @click="selectItem(filteredItems[virtualRow.index])"
                                    density="compact"
                                >
                                    <template v-slot:prepend>
                                        <template v-if="multiple">
                                            <v-checkbox
                                                :model-value="
                                                    selectedItems.includes(
                                                        filteredItems[virtualRow.index][props.itemValue]
                                                    )
                                                "
                                                density="compact"
                                                hide-details
                                                @click.stop="selectItem(filteredItems[virtualRow.index])"
                                            />
                                        </template>
                                        <template v-else>
                                            <v-icon>mdi-account</v-icon>
                                        </template>
                                    </template>
                                    <v-list-item-title>
                                        {{ filteredItems[virtualRow.index][props.itemTitle] }}
                                    </v-list-item-title>
                                    <v-list-item-subtitle v-if="filteredItems[virtualRow.index].user_no">
                                        {{ filteredItems[virtualRow.index].user_no }}
                                    </v-list-item-subtitle>
                                </v-list-item>
                            </template>
                        </template>
                    </div>
                </div>

                <div v-if="loading" class="justify-center d-flex align-center" style="height: 250px">
                    <v-progress-circular indeterminate></v-progress-circular>
                </div>
            </v-card-text>
        </v-card>
    </v-menu>
</template>
