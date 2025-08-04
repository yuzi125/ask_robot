<script setup>
import { ref, computed, watch, reactive, inject } from "vue";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/vue-query";
import { useRoute } from "vue-router";
import { useDebounceFn } from "@vueuse/core";
import {
    fetchCacheKnowledgeList,
    deleteCacheKnowledge,
    fetchExpertConfigJsonbByExpertId,
    updateExpertConfigJsonCache,
    fetchModelList,
    getChunkByLinkLevel,
} from "@/network/service";
import { useCacheStore } from "@/store";
import { storeToRefs } from "pinia";

const cacheStore = useCacheStore();
const { chunksData, loadingChunksData } = storeToRefs(cacheStore);

const emitter = inject("emitter");

import TopInfoBar from "@/components/experts/cache/TopInfoBar.vue";
import QueryControlBar from "@/components/experts/cache/QueryControlBar.vue";
import CardList from "@/components/experts/cache/CardList.vue";
import DetailDialog from "@/components/experts/cache/DetailDialog.vue";
import SettingsDialog from "@/components/experts/cache/SettingsDialog.vue";
import EmptyStateSearch from "@/components/common/EmptyStateSearch.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";

const route = useRoute();
const queryClient = useQueryClient();
const expertId = route.params.expert_id;

const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(12);
const multiSelectMode = ref(false);
const selectedItems = ref([]);
const selectAll = ref(false);
const dialogVisible = ref(false);
const selectedItem = ref(null);
const previewMode = ref(true);
const settingsDialogVisible = ref(false);
const cacheDeleteFrequency = ref(1);
const cacheExpirationTime = ref(7);
const tempCacheDeleteFrequency = ref(1);
const tempCacheExpirationTime = ref(7);
const sortField = ref("update_time");
const sortOrder = ref("desc");

const debouncedSearch = useDebounceFn((value) => {
    searchQuery.value = value;
    currentPage.value = 1;
}, 500);

const selectedModel = ref([]);

const { data: modelList } = useQuery({
    queryKey: ["modelListGroup"],
    queryFn: () => fetchModelList(true),
});

const {
    data: cacheKnowledgeResponse,
    isPlaceholderData,
    isSuccess,
    isLoading,
    refetch,
    isFetching,
} = useQuery({
    queryKey: ["cacheKnowledge", expertId, currentPage, itemsPerPage, searchQuery, selectedModel, sortField, sortOrder],
    queryFn: () =>
        fetchCacheKnowledgeList(expertId, {
            page: currentPage.value,
            itemsPerPage: itemsPerPage.value,
            searchQuery: searchQuery.value,
            selectedModel: selectedModel.value,
            sortField: sortField.value,
            sortOrder: sortOrder.value,
        }),
    placeholderData: keepPreviousData,
});

const cacheKnowledge = computed(() => cacheKnowledgeResponse.value?.data || []);
const modelListData = computed(() => modelList?.value?.data || []);

const totalItems = computed(() => cacheKnowledgeResponse.value?.data?.total_items || 0);
const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage.value));

const hasNoSearchResults = computed(() => {
    return (
        !isLoading.value &&
        cacheKnowledge.value.items.length === 0 &&
        (searchQuery.value.trim() !== "" || (selectedModel.value?.length > 0 && !selectedModel.value.includes("All")))
    );
});

const hasNoData = computed(() => {
    return (
        !isLoading.value &&
        cacheKnowledge.value.items.length === 0 &&
        !searchQuery.value.trim() &&
        (!selectedModel.value?.length || selectedModel.value.includes("All"))
    );
});
const { data: expertConfigJson } = useQuery({
    queryKey: ["cacheKnowledgeExpertConfigJson", expertId],
    queryFn: () => fetchExpertConfigJsonbByExpertId(expertId),
});

const handlePageChange = (newPage) => {
    currentPage.value = newPage;
};

const handleItemsPerPageChange = (newItemsPerPage) => {
    itemsPerPage.value = newItemsPerPage;
    currentPage.value = 1;
};

const handleSearchQueryChange = (newQuery) => {
    debouncedSearch(newQuery);
};

const resetDeleteFrequency = () => {
    // tempCacheDeleteFrequency.value = cacheDeleteFrequency.value;
};

const handleFiltersChanged = (filters) => {
    searchQuery.value = filters.searchQuery;
    selectedModel.value = filters.selectedModel;
    sortField.value = filters.sortField;
    sortOrder.value = filters.sortOrder;
    currentPage.value = 1; // 重置頁碼
};

const expertConfigJsonData = computed(() => {
    const data = expertConfigJson?.value || [];
    return reactive(data);
});

const toggleSelection = (item) => {
    const index = selectedItems.value.findIndex((i) => i.id === item.id);
    if (index > -1) {
        selectedItems.value.splice(index, 1);
    } else {
        selectedItems.value.push(item);
    }
};

const openDialog = async (item) => {
    selectedItem.value = item;

    chunksData.value = [];
    loadingChunksData.value = true;
    dialogVisible.value = true;

    const rs = await getChunkByLinkLevel({
        chunkIds: item.related_chunk_ids || [],
        linkLevel: item.link_level || 0,
    });

    if (rs.data && rs.data.code === 0) {
        chunksData.value = rs.data.data;
    }
    loadingChunksData.value = false;
};

const closeDialog = () => {
    dialogVisible.value = false;
    selectedItem.value = null;
    previewMode.value = true;
};

const deleteItem = async (id) => {
    await deleteCacheKnowledge(expertId, [id]);
    queryClient.invalidateQueries({ queryKey: ["cacheKnowledge", expertId] });
    dialogVisible.value = false;
    emitter.emit("openSnackbar", { message: "成功刪除項目", color: "success" });
};

const deleteSelectedItems = async () => {
    const multipleDeleteId = selectedItems.value.map((item) => item.id);
    await deleteCacheKnowledge(expertId, multipleDeleteId);
    queryClient.invalidateQueries({ queryKey: ["cacheKnowledge", expertId] });
    emitter.emit("openSnackbar", { message: "成功刪除所選項目", color: "success" });
    selectedItems.value = [];
    selectAll.value = false;
};

const openSettingsDialog = () => {
    tempCacheDeleteFrequency.value = cacheDeleteFrequency.value;
    tempCacheExpirationTime.value = cacheExpirationTime.value;
    settingsDialogVisible.value = true;
};

const saveSettings = async (cacheDateData) => {
    await updateExpertConfigJsonCache(expertId, cacheDateData);
    queryClient.invalidateQueries({ queryKey: ["cacheKnowledgeExpertConfigJson", expertId] });
    if (cacheDateData.cache_delete_frequency === "") {
        emitter.emit("openSnackbar", { message: "成功重設", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: "成功保存", color: "success" });
    }
};

const clearAllCache = async () => {
    await deleteCacheKnowledge(expertId);
    emitter.emit("openSnackbar", { message: "成功刪除所有快取資料", color: "success" });
    queryClient.invalidateQueries({ queryKey: ["cacheKnowledge", expertId] });
    selectedItems.value = [];
    selectAll.value = false;
};

const handleToggleSelectAll = (value) => {
    selectAll.value = value;
    if (value) {
        selectedItems.value = [...cacheKnowledge.value.items];
    } else {
        selectedItems.value = [];
    }
};

watch(multiSelectMode, (newValue) => {
    if (!newValue) {
        selectedItems.value = [];
        selectAll.value = false;
    }
});

watch(
    [cacheKnowledge, selectedItems],
    () => {
        selectAll.value =
            cacheKnowledge.value.items.length > 0 && selectedItems.value.length === cacheKnowledge.value.items.length;
    },
    { deep: true }
);
</script>

<template>
    <v-container>
        <TopInfoBar
            :cacheDeleteFrequency="cacheDeleteFrequency"
            :cacheExpirationTime="cacheExpirationTime"
            v-model:multiSelectMode="multiSelectMode"
            :selectAll="selectAll"
            :selectedItemsCount="selectedItems.length"
            :expertConfigJsonData="expertConfigJsonData"
            @openSettings="openSettingsDialog"
            @deleteSelected="deleteSelectedItems"
            @toggleSelectAll="handleToggleSelectAll"
        />

        <QueryControlBar
            v-model="searchQuery"
            v-model:selectedModel="selectedModel"
            :modelListData="modelListData"
            v-model:sortField="sortField"
            v-model:sortOrder="sortOrder"
            @filtersChanged="handleFiltersChanged"
        />
        <template v-if="!isSuccess || isPlaceholderData">
            <v-row class="d-flex justify-space-between">
                <v-col v-for="n in 5" :key="n" cols="12" sm="6" md="4" lg="3">
                    <v-skeleton-loader type="card" />
                </v-col>
            </v-row>
        </template>

        <CardList
            v-else
            :items="cacheKnowledge"
            :multiSelectMode="multiSelectMode"
            :selectedItems="selectedItems"
            @toggleSelection="toggleSelection"
            @openDialog="openDialog"
        />

        <EmptyStateSearch v-if="hasNoSearchResults" />
        <EmptyStateNoData
            v-else-if="hasNoData"
            headline="暫無快取數據"
            actionText="重新獲取快取數據"
            actionIcon="fa-solid fa-rotate-right"
            text="目前沒有可用的快取數據，請重新產生或獲取資料。"
            :actionCallback="refetch"
            :isLoading="isFetching"
        />

        <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="7"
            @update:modelValue="handlePageChange"
            class="mt-4"
        />

        <DetailDialog
            v-model="dialogVisible"
            :selectedItem="selectedItem"
            :previewMode="previewMode"
            @close="closeDialog"
            @delete="deleteItem"
            @togglePreview="previewMode = !previewMode"
        />

        <SettingsDialog
            v-model="settingsDialogVisible"
            :cacheDeleteFrequency="tempCacheDeleteFrequency"
            :cacheExpirationTime="tempCacheExpirationTime"
            :expertConfigJsonData="expertConfigJsonData"
            @save="saveSettings"
            @clearCache="clearAllCache"
        />

        <v-fade-transition>
            <v-btn
                v-if="multiSelectMode && selectedItems.length > 0"
                color="error"
                @click="deleteSelectedItems"
                class="float-btn"
                fab
                large
            >
                刪除所選項目
            </v-btn>
        </v-fade-transition>
    </v-container>
</template>

<style scoped>
.float-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
}
</style>
