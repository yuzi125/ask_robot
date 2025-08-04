<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

const props = defineProps({
    groupList: {
        type: Array,
        default: () => [],
    },
    selectedGroups: {
        type: Array,
        default: () => [],
    },
    selectionMode: {
        type: Boolean,
        default: false,
    },
    originalGroups: {
        type: Array,
        default: () => [],
    },
    pagination: {
        type: Object,
        default: () => { totalPages: 0 },
    },
});

const isActive = ref(false);
const parentRef = ref(null);
const rowVirtualizer = ref(null);
const isVirtualizerEnabled = ref(true);

const displayGroups = computed(() => {
    if (!props.selectedGroups || props.selectedGroups.length === 0) {
        const notOriginalGroups = props.groupList.filter((e) => !props.originalGroups?.includes(`#${e.groupId}`));
        return filterGroups(notOriginalGroups);
    }
    const notSelectedGroups = props.groupList.filter(
        (e) => !props.selectedGroups.includes(`#${e.groupId}`) && !props.originalGroups?.includes(`#${e.groupId}`)
    );
    return filterGroups(notSelectedGroups);
});

function filterGroups(groups) {
    return groups.filter((group) => {
        if (!searchInput.value) return true;
        return group.groupName.match(searchInput.value) || group.groupId.match(searchInput.value);
    });
}

const addGroupList = ref([]);
function clickGroup(group) {
    if (addGroupList.value.find((e) => e.groupId === group.groupId)) {
        const index = addGroupList.value.indexOf(group);
        addGroupList.value.splice(index, 1);
    } else {
        addGroupList.value.push(group);
    }
}

const emits = defineEmits(["addGroup", "pageChange", "searchInput"]);
function sendNewGroups() {
    const list = addGroupList.value.map((e) => `#${e.groupId}`);
    emits("addGroup", list);
    addGroupList.value = [];
    searchInput.value = "";
    isActive.value = false;
}

const searchInput = ref("");

function handleClear() {
    searchInput.value = "";
    if (rowVirtualizer.value) {
        rowVirtualizer.value.value.measure();
    }
}

function initializeVirtualizer() {
    rowVirtualizer.value = useVirtualizer({
        count: displayGroups.value.length,
        getScrollElement: () => parentRef.value,
        estimateSize: () => 55,
        enabled: isVirtualizerEnabled.value,
    });
}

onMounted(() => {
    initializeVirtualizer();
});

watch(
    [displayGroups, searchInput],
    async ([newDisplayGroups, newSearchInput]) => {
        if (!rowVirtualizer.value) return;

        isVirtualizerEnabled.value = false;

        rowVirtualizer.value = useVirtualizer({
            count: newDisplayGroups.length,
            getScrollElement: () => parentRef.value,
            estimateSize: () => 55,
            enabled: true,
        });

        isVirtualizerEnabled.value = true;
        
    },
    { deep: true }
);

watch(searchInput, (newValue) => {
    emits('searchInput', newValue);
});


const virtualRows = computed(() => {
    if (!rowVirtualizer.value || !displayGroups.value.length) return [];
    return rowVirtualizer.value.value.getVirtualItems().filter((row) => row.index < displayGroups.value.length);
});

const totalSize = computed(() => {
    if (!rowVirtualizer.value || !displayGroups.value.length) return 0;
    return rowVirtualizer.value.value.getTotalSize();
});

onBeforeUnmount(() => {
    rowVirtualizer.value = null;
});


function handlePageChange(page) {
    emits("pageChange", page);
}

</script>

<template>
    <v-btn
        :class="props.selectionMode ? 'ml-2' : ''"
        color="warning"
        @click="isActive = true"
        variant="tonal"
        prepend-icon="mdi-account-multiple-plus-outline"
    >
        {{ props.selectionMode ? "選擇群組" : "新增群組" }}
    </v-btn>

    <v-dialog v-model="isActive" max-width="600">
        <v-card prepend-icon="mdi-account-multiple-plus-outline" title="選擇群組">
            <v-card-text>
                <p class="mb-3 title">已選擇群組 :</p>
                <div class="select-area">
                    <div
                        class="selected-group-chip"
                        v-for="(group, index) in addGroupList"
                        :key="'group' + group.groupId"
                    >
                        {{ group.groupName }}({{ group.groupId }})
                        <div @click="addGroupList.splice(index, 1)" id="activator-target" class="group-chip-delete">
                            <i class="fa-solid fa-xmark" style="color: #ffffff"></i>
                        </div>
                    </div>
                    <p v-if="addGroupList.length == 0">尚未選取群組</p>
                </div>
                <div class="mb-3 justify-space-between d-flex align-center">
                    <p class="title">可選群組 :</p>
                    <v-text-field
                        clearable
                        @click:clear="handleClear"
                        label="搜尋群組名稱或ID"
                        variant="outlined"
                        max-width="250"
                        hide-details
                        density="compact"
                        v-model="searchInput"
                    ></v-text-field>
                </div>
                <div ref="parentRef" class="select-area virtual-list" style="height: 400px; overflow: auto">
                    <div
                        v-if="rowVirtualizer"
                        :style="{
                            height: `${totalSize}px`,
                            width: '100%',
                            position: 'relative',
                        }"
                    >
                        <div
                            v-for="virtualRow in virtualRows"
                            :key="virtualRow.key"
                            :style="{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                            }"
                        >
                            <div
                                v-if="displayGroups[virtualRow.index]"
                                @click="clickGroup(displayGroups[virtualRow.index])"
                                :class="[
                                    'group-chip',
                                    addGroupList.includes(displayGroups[virtualRow.index]) ? 'active-chip' : '',
                                ]"
                            >
                                {{
                                    `${displayGroups[virtualRow.index].groupName}(${
                                        displayGroups[virtualRow.index].groupId
                                    })`
                                }}
                            </div>
                        </div>
                    </div>
                    <p v-if="displayGroups.length == 0">無可選群組</p>
                </div>
            </v-card-text>
            <v-pagination
                v-if="pagination.totalPages > 0"
                v-model="pagination.page"
                :length="pagination.totalPages"
                :total-visible="7"
                density="default"
                class="mt-0"
                @update:modelValue="handlePageChange"
            ></v-pagination>
            <template v-slot:actions>
                <div class="ml-auto">
                    <v-btn color="grey darken-1" @click="isActive = false"> 關閉 </v-btn>
                    <v-btn
                        :disabled="addGroupList.length == 0"
                        variant="text"
                        color="success"
                        text="加入"
                        @click="sendNewGroups()"
                    ></v-btn>
                </div>
            </template>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.select-area {
    border: 1px solid gray;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
    max-height: 400px;
    overflow-y: auto;
}

.virtual-list {
    overflow-y: auto;
    overflow-x: hidden;
    contain: strict;
}

.group-chip {
    padding: 6px 12px;
    background: #bbdefb;
    border-radius: 12px;
    cursor: pointer;
}

.selected-group-chip {
    padding: 6px 12px;
    background: #e8f5e9;
    border-radius: 12px;
    position: relative;
    cursor: pointer;
}

.active-chip {
    background: #90a4ae;
}

.title {
    font-size: 1.1rem;
    font-weight: 700;
}

.group-chip-delete {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 20px;
    aspect-ratio: 1/1;
    border-radius: 50%;
    background: black;
    position: absolute;
    top: 0;
    right: 0;
    transform: translate(40%, -40%);
    cursor: pointer;
}

.group-chip-delete:hover {
    background: red;
}
</style>
