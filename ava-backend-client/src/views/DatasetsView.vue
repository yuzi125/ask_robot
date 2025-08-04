<script setup>
import { storeToRefs } from "pinia";
import { inject, onMounted, ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import FormComponents from "../components/FormComponents.vue";
import { useStateStore } from "../store/index";
import { useQuery } from "@tanstack/vue-query";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { usePermissionChecker } from "@/composables";

const stateStore = useStateStore();
const { datasetsIcon } = storeToRefs(stateStore);

const router = useRouter();

const axios = inject("axios");
const emitter = inject("emitter");

const scrollContainerRef = ref(null);
const cardsPerRow = ref(4);
const isManuallySet = ref(false);
const lastContainerWidth = ref(0);
const scrollContainerWidth = ref(0);
const ROW_HEIGHT = 240;
const searchQuery = ref("");

const { canPerformAction: canCreateDataset } = usePermissionChecker("allowedToCreateDataset");
const { canPerformAction: canUploadDocument } = usePermissionChecker("allowedToUploadDocument");

const fetchAllDatasets = async () => {
    const response = await axios.get("/datasets/datasets");
    if (response.data.code === 0) {
        return response.data.data;
    }
    throw new Error(response.data.message);
};

const {
    data: allDatasets,
    isLoading,
    isError,
    error,
} = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchAllDatasets,
});

const filteredDatasets = computed(() => {
    if (!allDatasets.value) return [];

    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return allDatasets.value;

    return allDatasets.value.filter((dataset) => dataset.name?.toLowerCase().includes(query));
});

const combinedData = computed(() => {
    if (!filteredDatasets.value) return [];

    let result = [...filteredDatasets.value];

    if (canCreateDataset.value) {
        result.unshift({ id: "add-card", isAddCard: true });
    }

    return result.map((item) => ({
        ...item,
        tooltipText: [
            item.created_by_name || item.created_by ? `建立者：${item.created_by_name || item.created_by}` : null,
            item.updated_by_name || item.updated_by ? `更新者：${item.updated_by_name || item.updated_by}` : null,
        ]
            .filter(Boolean)
            .join("\n"),
        hasCreatorOrUpdater: !!(item.created_by_name || item.created_by || item.updated_by_name || item.updated_by),
    }));
});

const batchProcessedData = computed(() => combinedData.value || []);

const rows = computed(() => {
    const sourceData = batchProcessedData.value;
    if (!sourceData.length) return [];

    const rowCount = Math.ceil(sourceData.length / cardsPerRow.value);
    const result = [];

    for (let i = 0; i < rowCount; i++) {
        const startIdx = i * cardsPerRow.value;
        result.push(sourceData.slice(startIdx, Math.min(startIdx + cardsPerRow.value, sourceData.length)));
    }

    return result;
});

const rowVirtualizer = computed(() => {
    if (!rows.value.length) return null;

    return useVirtualizer({
        count: rows.value.length,
        getScrollElement: () => scrollContainerRef.value,
        estimateSize: () => ROW_HEIGHT,
        overscan: 5,
        initialOffset: 0,
    });
});

const optimizedVirtualRows = computed(() => {
    const virtualRows = rowVirtualizer.value?.value?.getVirtualItems() || [];
    return virtualRows.map((virtualRow) => ({
        virtualRow,
        rowData: rows.value[virtualRow.index] || [],
        style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: `${ROW_HEIGHT}px`,
            transform: `translateY(${virtualRow.start}px)`,
        },
    }));
});

const totalHeight = computed(() => rowVirtualizer.value?.value?.getTotalSize() || 0);

const cardWidth = computed(() => {
    scrollContainerWidth.value = scrollContainerRef.value?.clientWidth || 1200;
    const availableWidth = scrollContainerWidth.value - 80;
    return Math.floor(availableWidth / cardsPerRow.value - 16);
});

const updateCardsPerRow = () => {
    // 如果使用者手動設定過，就不自動調整
    if (isManuallySet.value) return;
    const containerWidth = scrollContainerRef.value?.clientWidth || window.innerWidth;

    if (containerWidth > 1800) cardsPerRow.value = 6;
    else if (containerWidth > 1500) cardsPerRow.value = 5;
    else if (containerWidth > 1200) cardsPerRow.value = 4;
    else if (containerWidth > 900) cardsPerRow.value = 3;
    else if (containerWidth > 600) cardsPerRow.value = 2;
    else cardsPerRow.value = 1;
};

const updateVirtualizer = () => {
    const currentWidth = window.innerWidth;

    scrollContainerWidth.value = scrollContainerRef.value?.clientWidth || window.innerWidth;
    
    // 只有真正的視窗大小改變才清除手動設定
    if (lastContainerWidth.value !== 0 && currentWidth !== lastContainerWidth.value) {
        isManuallySet.value = false;
        localStorage.removeItem('datasets-cards-per-row');
        localStorage.removeItem('datasets-is-manually-set');
    }

    lastContainerWidth.value = currentWidth;
    updateCardsPerRow();
    nextTick(() => {
        rowVirtualizer.value?.value?.measure();
    });
};

const onManualChange = (newValue) => {
    if (newValue !== null && newValue !== undefined) {
        isManuallySet.value = true;
        localStorage.setItem('datasets-cards-per-row', newValue.toString());
        localStorage.setItem('datasets-is-manually-set', 'true');
    }
};

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

onMounted(() => {
    // 從 localStorage 讀取使用者設定
    const savedCardsPerRow = localStorage.getItem('datasets-cards-per-row');
    const savedIsManuallySet = localStorage.getItem('datasets-is-manually-set');
    
    if (savedCardsPerRow && savedIsManuallySet === 'true') {
        cardsPerRow.value = parseInt(savedCardsPerRow);
        isManuallySet.value = true;
    }

    // 初始化視窗寬度
    lastContainerWidth.value = window.innerWidth;
    
    // 初次載入時不要清除設定，直接調用 updateCardsPerRow
    if (!isManuallySet.value) {
        updateCardsPerRow();
    }
    nextTick(() => {
        rowVirtualizer.value?.value?.measure();
    });

    const debouncedUpdate = debounce(updateVirtualizer, 100);
    
    // 監聽視窗變化
    window.addEventListener("resize", debouncedUpdate);
    
    // 監聽內部容器變化（比如側邊欄收起展開等）
    if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(debouncedUpdate);
        if (scrollContainerRef.value) {
            resizeObserver.observe(scrollContainerRef.value);
        }
        onBeforeUnmount(() => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", debouncedUpdate);
        });
    } else {
        onBeforeUnmount(() => window.removeEventListener("resize", debouncedUpdate));
    }

    // 確保初次渲染時虛擬滾動器有正確的尺寸
    nextTick(() => {
        setTimeout(() => rowVirtualizer.value?.value?.measure(), 100);
    });

    fetchEmbeddingModels();
});

const previousCardsPerRow = ref(cardsPerRow.value);
watch(cardsPerRow, (newValue) => {
    if (newValue === null || newValue === undefined) {
        cardsPerRow.value = previousCardsPerRow.value;
    } else {
        previousCardsPerRow.value = newValue;
    }

    nextTick(() => rowVirtualizer.value?.value?.measure());
});

const addDatasetsBtn = ref({
    header: "建立知識庫",
    description: "導入您自己的文本資料或通過Webhook實時寫入資料以增強LLM的上下文",
});

const formRef = ref(null);
const modelStates = ref([]);

async function fetchEmbeddingModels() {
    try {
        const response = await axios.get('/model/getModelListByModeType', {
            params: {
                modeType: 'embedding'
            }
        });
        if (response.data.code === 0 && response.data.data) {
            modelStates.value = response.data.data.map(model => {
                // The backend has already masked the API keys, just return the transformed data
                return {
                    show: `${model.name} (ID: ${model.id})`,         
                    value: model.id,
                    model_name: model.model_name,
                    embedding_model_id: model.id
                };
            });
        }
    } catch (error) {
        console.error('Failed to fetch embedding models:', error);
    }
}

function openForm() {
    
    formRef.value.open({
        title: "建立空知識庫",
        placeholder: "空知識庫中還沒有文件，你可以在今後任何時候上傳文件至該知識庫。",
        data: [
            { type: "text", name: "id", required: false, placeholder: "知識庫ID(選填)", dataCy: "datasets-id" },
            { type: "text", name: "name", required: true, placeholder: "知識庫名稱(必填)", dataCy: "datasets-name" },
            {
                type: "selectNoMultiple",
                name: "embeddingModel",
                required: true,
                placeholder: "embedding model",
                option: modelStates.value,
                dataCy: "datasets-embeddingModel",
            },
        ],
    });
}
async function createDatasets(data) {
    try {
        
        const namePattern = /^[a-zA-Z0-9-_]+$/;
        if (data.id && !namePattern.test(data.id)) {
            formRef.value.showError("知識庫ID只能包含數字、英文、-、_");
            return;
        }
        
        if (!modelStates.value.length) {
            formRef.value.showError("目前沒有可用的 embedding model，無法建立知識庫。請先新增 embedding model。");
            return;
        }

        if (!data.embeddingModel) {
            if (modelStates.value.length > 0) {
                data.embeddingModel = modelStates.value[0].value;
            }
        }
        // Find the selected model from modelStates
        const selectedModel = modelStates.value.find(model => model.value === data.embeddingModel);
        if (!selectedModel) {
            formRef.value.showError("請選擇有效的 embedding model。");
            return;
        }
    

        let rs = await axios.post(
            "/datasets/create",
            JSON.stringify({
                id: data.id || null,
                name: data.name,
                embeddingModel: selectedModel?.model_name || "text-embedding-3-large",
                embedding_model_id: selectedModel?.embedding_model_id || 85
            })
        );

        // console.log(rs.data);
        const datasets_id = rs.data.data.id;


        // const path = `/datasets/${datasets_id}/${canUploadDocument.value ? "source" : "documents"}`;
        // console.log("即將跳轉到路徑:", path);
        
        if (rs.data.code === 0) {
            formRef.value.close();
            router.push(`/datasets/${rs.data.data.datasets_id}/${canUploadDocument.value ? "source" : "documents"}`);
        } else if (rs.data.code === 1 && rs.data.data?.isDuplicated) {
            formRef.value.showError("此知識庫ID已存在，請使用其他ID。");
        } else {
            formRef.value.showError(rs.data.message || "創建知識庫失敗");
        }
        
    } catch (error) {
        console.error(error);
        formRef.value.showError("創建知識庫時發生錯誤");
    }
}
</script>

<template>
    <div class="datasets_view">
        <div class="control-panel">
            <div class="search-container">
                <div class="search-input-wrapper">
                    <i class="fa-solid fa-magnifying-glass search-icon"></i>
                    <input type="text" v-model="searchQuery" class="search-input" placeholder="搜尋知識庫..." />
                    <v-btn
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        variant="text"
                        density="compact"
                        icon="fa-solid fa-times"
                        size="small"
                        class="clear-button"
                    ></v-btn>
                </div>
            </div>
            <div class="layout-controls">
                <div class="view-mode-label">顯示模式</div>
                <v-btn-toggle v-model="cardsPerRow" @update:model-value="onManualChange" color="primary" density="comfortable" class="grid-toggle">
                    <v-btn :value="2" variant="text" class="grid-btn">
                        <i class="fa-solid fa-table-cells-large"></i>
                    </v-btn>
                    <v-btn :value="4" variant="text" class="grid-btn">
                        <i class="fa-solid fa-table-cells"></i>
                    </v-btn>
                    <v-btn :value="6" variant="text" class="grid-btn">
                        <i class="fa-solid fa-grip"></i>
                    </v-btn>
                </v-btn-toggle>
            </div>
        </div>

        <div class="scroll-container" ref="scrollContainerRef">
            <!-- 載入中狀態 -->
            <template v-if="isLoading">
                <v-row class="d-flex justify-space-between">
                    <v-col v-for="n in 4" :key="n" cols="12" sm="6" md="4" lg="3">
                        <v-skeleton-loader type="image, list-item-two-line" />
                    </v-col>
                </v-row>
            </template>

            <!-- 虛擬滾動視圖 -->
            <div v-else-if="rows.length > 0" class="virtual-list-container" :style="{ height: `${totalHeight}px` }">
                <div
                    v-for="item in optimizedVirtualRows"
                    :key="`row-${item.virtualRow.index}`"
                    class="row"
                    :style="item.style"
                >
                    <!-- 每行的卡片 -->
                    <div
                        v-for="(item, colIndex) in item.rowData"
                        :key="`${item.id || 'item'}-${colIndex}`"
                        class="col"
                        :style="{
                            width: `${cardWidth}px`,
                            flex: `0 0 ${cardWidth}px`,
                        }"
                    >
                        <!-- 新增按鈕卡片 -->
                        <div v-if="item.isAddCard" data-cy="add-datasets-btn" class="card add_card" @click="openForm">
                            <div class="card_top add_card_top">
                                <span><i class="fa-solid fa-plus"></i></span>
                                <p>{{ addDatasetsBtn.header }}</p>
                            </div>
                            <div class="card_center add_card_center">
                                <p>{{ addDatasetsBtn.description }}</p>
                            </div>
                        </div>

                        <!-- 一般資料卡片 -->
                        <template v-else>
                            <template v-if="item.hasCreatorOrUpdater">
                                <v-tooltip location="top" :text="item.tooltipText">
                                    <template v-slot:activator="{ props }">
                                        <router-link
                                            v-bind="props"
                                            :to="`/datasets/${item.id}/overview`"
                                            class="card datasets_card"
                                        >
                                            <div class="card_top">
                                                <span><i :class="item.icon || datasetsIcon"></i></span>
                                                <p>{{ item.name }}</p>
                                            </div>
                                            <div class="card_center" :class="{ 'with-priority': item.sort_priority }">
                                                <p>{{ item.describe }}</p>
                                            </div>
                                            <div class="card_priority" v-if="item.sort_priority">
                                                <div class="item">
                                                    <v-chip
                                                        variant="outlined"
                                                        size="small"
                                                        color="primary"
                                                        prepend-icon="fa-solid fa-arrow-up-right-dots"
                                                    >
                                                        <span>優先級 {{ item.sort_priority }}</span>
                                                    </v-chip>
                                                </div>
                                            </div>
                                            <div class="card_bottom">
                                                <div class="item">
                                                    <span><i class="fa-solid fa-file-lines"></i></span>
                                                    <p>{{ item.documents_count }}文件</p>
                                                </div>
                                                <div class="item">
                                                    <span style="color: rgb(122, 206, 122)">
                                                        <i class="fa-solid fa-file-circle-check"></i>
                                                    </span>
                                                    <p>{{ item.success_count }}啟用</p>
                                                </div>
                                                <div class="item">
                                                    <span
                                                        ><i class="fa-solid fa-table-list" style="color: #74c0fc"></i
                                                    ></span>
                                                    <p>{{ item.form_count }}表單</p>
                                                </div>
                                                <div class="item" v-if="item.crawler_site_count > 0">
                                                    <span><i class="fa-solid fa-spider"></i></span>
                                                    <p>{{ item.crawler_site_count }}站點</p>
                                                </div>
                                                <div class="flex-wrap item">
                                                    <span><i class="fa-solid fa-diagram-project"></i></span>
                                                    <p>{{ item.experts.length }}關聯專家</p>
                                                    <v-tooltip
                                                        v-for="expert in item.experts"
                                                        :text="expert.name"
                                                        location="top"
                                                        :key="expert.id"
                                                    >
                                                        <template v-slot:activator="{ props }">
                                                            <img
                                                                v-bind="props"
                                                                :src="expert.avatar"
                                                                :alt="expert.name"
                                                                loading="lazy"
                                                                class="expert-avatar"
                                                            />
                                                        </template>
                                                    </v-tooltip>
                                                </div>
                                            </div>
                                        </router-link>
                                    </template>
                                </v-tooltip>
                            </template>
                            <router-link v-else :to="`/datasets/${item.id}/overview`" class="card datasets_card">
                                <div class="card_top">
                                    <span><i :class="item.icon || datasetsIcon"></i></span>
                                    <p>{{ item.name }}</p>
                                </div>
                                <div class="card_center" :class="{ 'with-priority': item.sort_priority }">
                                    <p>{{ item.describe }}</p>
                                </div>
                                <div class="card_priority" v-if="item.sort_priority">
                                    <div class="item">
                                        <v-chip
                                            variant="outlined"
                                            size="small"
                                            color="primary"
                                            prepend-icon="fa-solid fa-arrow-up-right-dots"
                                        >
                                            <span>優先級 {{ item.sort_priority }}</span>
                                        </v-chip>
                                    </div>
                                </div>
                                <div class="card_bottom">
                                    <div class="item">
                                        <span><i class="fa-solid fa-file-lines"></i></span>
                                        <p>{{ item.documents_count }}文件</p>
                                    </div>
                                    <div class="item">
                                        <span style="color: rgb(122, 206, 122)">
                                            <i class="fa-solid fa-file-circle-check"></i>
                                        </span>
                                        <p>{{ item.success_count }}啟用</p>
                                    </div>
                                    <div class="item">
                                        <span><i class="fa-solid fa-table-list" style="color: #74c0fc"></i></span>
                                        <p>{{ item.form_count }}表單</p>
                                    </div>
                                    <div class="item" v-if="item.crawler_site_count > 0">
                                        <span><i class="fa-solid fa-spider"></i></span>
                                        <p>{{ item.crawler_site_count }}站點</p>
                                    </div>
                                    <div class="flex-wrap item">
                                        <span><i class="fa-solid fa-diagram-project"></i></span>
                                        <p>{{ item.experts.length }}關聯專家</p>
                                        <v-tooltip
                                            v-for="expert in item.experts"
                                            :text="expert.name"
                                            location="top"
                                            :key="expert.id"
                                        >
                                            <template v-slot:activator="{ props }">
                                                <img
                                                    v-bind="props"
                                                    :src="expert.avatar"
                                                    :alt="expert.name"
                                                    loading="lazy"
                                                    class="expert-avatar"
                                                />
                                            </template>
                                        </v-tooltip>
                                    </div>
                                </div>
                            </router-link>
                        </template>
                    </div>
                </div>
            </div>

            <div v-else-if="isLoading" class="status-message">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
                <div class="mt-3">正在載入知識庫...</div>
            </div>
            <div v-else-if="isError" class="status-message">
                <v-icon color="error" size="large">fa-solid fa-triangle-exclamation</v-icon>
                <div class="mt-3">載入失敗: {{ error.message }}</div>
            </div>
            <div v-else-if="searchQuery && filteredDatasets.length === 0" class="status-message">
                <v-icon color="info" size="large">fa-solid fa-search</v-icon>
                <div class="mt-3">沒有符合 "{{ searchQuery }}" 的知識庫</div>
            </div>
            <div v-else-if="allDatasets && allDatasets.length === 0" class="status-message">
                <v-icon color="info" size="large">fa-solid fa-database</v-icon>
                <div class="mt-3">目前沒有知識庫，請點擊"建立知識庫"按鈕創建一個新的知識庫。</div>
            </div>

            <Teleport to="body">
                <FormComponents ref="formRef" @send="createDatasets"></FormComponents>
            </Teleport>
        </div>
    </div>
</template>

<style lang="scss" scoped>
$color1: rgb(106, 174, 233);
$color2: rgb(104, 197, 127);
$primary-color: #1c64f1;
$light-gray: #f9fafb;
$border-color: #e0e0e0;

// 確保整個容器使用 3D 加速
.datasets_view {
    position: relative;
    height: calc(100vh - 75px);
    width: 100%;
    overflow: hidden;
    padding: 1rem 2rem;
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-perspective: 1000;
    perspective: 1000;
}

.control-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    padding: 0.5rem 1rem;
    flex-wrap: wrap;
    gap: 1rem;
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-container {
    flex: 1;
    max-width: 500px;
}

.search-input-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    background-color: $light-gray;
    border-radius: 8px;
    padding: 0.1rem 0.5rem;
    border: 1px solid $border-color;
    transition: all 0.2s;

    &:focus-within {
        border-color: $primary-color;
        box-shadow: 0 0 0 2px rgba($primary-color, 0.1);
    }
}

.search-input {
    width: 100%;
    padding: 0.7rem 0.5rem;
    border: none;
    font-size: 0.95rem;
    background-color: transparent;

    &:focus {
        outline: none;
    }
}

.search-icon {
    color: #6b7280;
    font-size: 0.9rem;
    margin-right: 0.5rem;
}

.clear-button {
    margin-left: auto;
}

.layout-controls {
    display: flex;
    align-items: center;
    gap: 0.7rem;
}

.view-mode-label {
    font-size: 0.9rem;
    color: #6b7280;
    margin-right: 0.3rem;
}

.grid-toggle {
    border: 1px solid $border-color;
    border-radius: 8px;
    overflow: hidden;
}

.grid-btn {
    min-width: 42px;
    width: 42px;
}

.scroll-container {
    height: calc(100% - 70px);
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch; /* 在 iOS 設備上提供慣性滾動 */
    scroll-behavior: smooth; /* 平滑滾動 */
    contain: content; /* 告訴瀏覽器此元素和它的內容盡可能獨立於文檔其餘部分 */
    will-change: scroll-position; /* 提示瀏覽器滾動位置將會改變 */
    overscroll-behavior: contain; /* 防止滾動傳播 */
}

.virtual-list-container {
    position: relative;
    width: 100%;
    will-change: height; /* 優化高度變化時的效能 */
    contain: layout style size; /* 更嚴格的包含規則 */
    transform: translateZ(0); /* 觸發GPU加速 */
}

.row {
    display: flex;
    flex-wrap: nowrap;
    width: 100%;
    gap: 0.6rem; // 減少卡片間距 (原本是1rem)
    padding: 0 0.5rem;
    will-change: transform; /* 優化變形時的效能 */
    transform: translateZ(0); /* 強制使用 GPU 加速 */
    backface-visibility: hidden; /* 防止在某些瀏覽器中閃爍 */
    contain: layout; /* 進一步限制佈局計算的範圍 */
}

.col {
    margin-bottom: 0.6rem; // 減少卡片間距 (原本是1rem)
    contain: layout style paint; /* 優化佈局與重繪 */
}

.card {
    width: 100%;
    border-radius: 0.7rem;
    background-color: white;
    cursor: pointer;
    transition: transform 0.25s, box-shadow 0.25s; /* 指定過渡屬性以提高效能 */
    padding: 1rem;
    box-shadow: 0px 1px 5px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    height: 220px;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    will-change: transform, box-shadow; /* 提前告知瀏覽器哪些屬性會變化 */
    transform: translateZ(0); /* 強制使用 GPU 加速 */

    &:hover {
        box-shadow: 0px 8px 15px rgba(0, 0, 0, 0.1);
    }

    .card_top {
        display: flex;
        align-items: center;
        height: 50px;
        /* margin-bottom: 0.5rem; */

        img {
            width: 2rem;
            height: 2rem;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
            border: 1px solid #e4e5e7;
        }
        span {
            width: 2rem;
            height: 2rem;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
            border: 1px solid #e4e5e7;
            display: flex;
            justify-content: center;
            align-items: center;
            color: $color1;
        }
    }

    .card_center {
        color: #6b7280;
        word-break: break-all;
        font-size: 0.85rem;
        line-height: 1.4;
        height: 68px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        margin-bottom: 0.7rem;

        &.with-priority {
            height: 40px; // 當有優先級時縮短描述高度
            -webkit-line-clamp: 2;
        }
    }

    .card_priority {
        margin-bottom: 0.7rem;
    }

    .card_bottom {
        color: #6b7280;
        font-size: 0.8rem;
        display: flex;
        flex-wrap: wrap;
        margin-top: auto;

        .item {
            display: flex;
            align-items: center;

            span {
                color: #98a2b3;
                margin-right: 0.3rem;
                font-size: 0.8rem;
            }

            p {
                margin-right: 1rem;
                margin-bottom: 0.5rem;
                margin-top: 0.2rem;
                white-space: nowrap;
            }
            img {
                width: 1.5rem;
                height: 1.5rem;
                border-radius: 0.5rem;
                margin-right: 0.6rem;
                border: 1px solid #e4e5e7;
            }
        }
    }
}

.add_card {
    background-color: #eceef1;
    border: 1px solid #e4e5e7;

    &:hover {
        background-color: white;
    }

    .add_card_top {
        span {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 2rem;
            height: 2rem;
            color: #6b7280;
            font-size: 0.5rem;
            border: 1px solid #e4e5e7;
            background-color: #f3f4f6;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
        }
    }
}

.datasets_card {
    border: 3px solid rgba($color: $color1, $alpha: 0.5);

    &:hover {
        box-shadow: 0px 8px 15px rgba($color: $color1, $alpha: 0.3);
        border: 3px solid rgba($color: $color1, $alpha: 0.7);
    }
}

.status-message {
    text-align: center;
    padding: 5rem 1rem;
    font-size: 1.1rem;
    color: #666;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.item :deep(.v-chip) {
    border-radius: 5px;
    margin-bottom: 5px;
}

.item :deep(.v-chip) span {
    margin-top: 3px;
    margin-right: 0 !important;
    color: #1c64f1 !important;
    font-weight: 600;
}

.expert-avatar {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.5rem;
    margin-right: 0.6rem;
    border: 1px solid #e4e5e7;
    contain: paint; /* 提升渲染性能 */
}

.loading-indicator {
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px;
    z-index: 10;
}

.loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid $color1;
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 1s linear infinite;
    margin-bottom: 5px;
}

.loading-text {
    font-size: 0.8rem;
    color: #666;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
