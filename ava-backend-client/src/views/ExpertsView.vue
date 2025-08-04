<script setup>
import { ref, inject, computed, onMounted, watch, nextTick, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import FormComponents from "../components/FormComponents.vue";
import { useQuery } from "@tanstack/vue-query";
import { usePermissionChecker } from "@/composables";
import { useVirtualizer } from "@tanstack/vue-virtual";

const { canPerformAction: canCreateExpert } = usePermissionChecker("allowedToCreateExpert");
const axios = inject("axios");
const router = useRouter();

// 設定每行顯示的卡片數量 (響應式)
const cardsPerRow = ref(4); // 預設值，會根據螢幕寬度自動調整
const isManuallySet = ref(false);
const lastContainerWidth = ref(0);
const scrollContainerWidth = ref(0);
const ROW_HEIGHT = 140; // 每行高度
const searchQuery = ref("");

async function fetchAllExperts() {
    let response = await axios.get("/expert/expert");
    if (response.data.code === 0) {
        return response.data.data;
    } else {
        throw new Error(response.data.message);
    }
}

const {
    data: allExperts,
    isLoading,
    isError,
    error,
} = useQuery({
    queryKey: ["experts"],
    queryFn: fetchAllExperts,
});

const scrollContainerRef = ref(null);

// 自動調整每行顯示的卡片數量
const updateCardsPerRow = () => {
    // 如果使用者手動設定過，就不自動調整
    if (isManuallySet.value) return;
    
    const containerWidth = scrollContainerRef.value?.clientWidth || window.innerWidth;

    // 根據容器寬度動態調整每行卡片數量
    if (containerWidth > 1800) {
        cardsPerRow.value = 6; // 大螢幕顯示6個
    } else if (containerWidth > 1500) {
        cardsPerRow.value = 5; // 中等大螢幕顯示5個
    } else if (containerWidth > 1200) {
        cardsPerRow.value = 4; // 標準螢幕顯示4個
    } else if (containerWidth > 900) {
        cardsPerRow.value = 3; // 小螢幕顯示3個
    } else if (containerWidth > 600) {
        cardsPerRow.value = 2; // 平板顯示2個
    } else {
        cardsPerRow.value = 1; // 手機顯示1個
    }
};

// 根據搜尋過濾數據
const filteredExperts = computed(() => {
    if (!allExperts.value) return [];

    if (!searchQuery.value.trim()) {
        return allExperts.value;
    }

    const query = searchQuery.value.toLowerCase();
    return allExperts.value.filter((expert) => expert.name?.toLowerCase().includes(query));
});

// 將"新增"按鈕納入計算，創建一個合併的數據源
const combinedData = computed(() => {
    if (!filteredExperts.value) return [];

    let result = [...filteredExperts.value];

    // 如果用戶可以創建專家，則在結果的開頭加入一個占位符
    if (canCreateExpert.value) {
        result.unshift({ id: "add-card", isAddCard: true });
    }

    return result;
});

// 將數據分為行
const rows = computed(() => {
    if (!combinedData.value.length) return [];

    const rowCount = Math.ceil(combinedData.value.length / cardsPerRow.value);
    const result = [];

    for (let i = 0; i < rowCount; i++) {
        const startIdx = i * cardsPerRow.value;
        const endIdx = Math.min(startIdx + cardsPerRow.value, combinedData.value.length);
        result.push(combinedData.value.slice(startIdx, endIdx));
    }

    return result;
});

// 設置虛擬滾動 (基於行)
const rowVirtualizer = computed(() => {
    if (!rows.value.length) return null;

    return useVirtualizer({
        count: rows.value.length,
        getScrollElement: () => scrollContainerRef.value,
        estimateSize: () => ROW_HEIGHT, // 每行的高度
        overscan: 3, // 預加載的行數
    });
});

// 獲取虛擬行
const virtualRows = computed(() => {
    return rowVirtualizer.value?.value?.getVirtualItems() || [];
});

// 總高度
const totalHeight = computed(() => {
    return rowVirtualizer.value?.value?.getTotalSize() || 0;
});

// 卡片寬度計算 (考慮內容寬度，確保卡片不被截斷)
const cardWidth = computed(() => {
    scrollContainerWidth.value = scrollContainerRef.value?.clientWidth || window.innerWidth;
    // 減去padding和margin的空間
    const availableWidth = scrollContainerWidth.value - 80;
    return availableWidth / cardsPerRow.value - 16; // 每個卡片減去margin
});

// 當容器大小變化時，重新計算虛擬滾動
const updateVirtualizer = () => {
    const currentWidth = window.innerWidth;

    scrollContainerWidth.value = scrollContainerRef.value?.clientWidth || window.innerWidth;
    
    // 只有真正的視窗大小改變才清除手動設定
    if (lastContainerWidth.value !== 0 && currentWidth !== lastContainerWidth.value) {
        isManuallySet.value = false;
        localStorage.removeItem('experts-cards-per-row');
        localStorage.removeItem('experts-is-manually-set');
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
        localStorage.setItem('experts-cards-per-row', newValue.toString());
        localStorage.setItem('experts-is-manually-set', 'true');
    }
};

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 監聽窗口大小變化
onMounted(() => {
    // 從 localStorage 讀取使用者設定
    const savedCardsPerRow = localStorage.getItem('experts-cards-per-row');
    const savedIsManuallySet = localStorage.getItem('experts-is-manually-set');
    
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
    window.addEventListener("resize", debouncedUpdate);
    onBeforeUnmount(() => window.removeEventListener("resize", debouncedUpdate));
});

const previousCardsPerRow = ref(cardsPerRow.value);
watch(cardsPerRow, (newValue) => {
    // 解決點同一個兩次的話，會變成undefined的問題
    if (newValue === null || newValue === undefined) {
        cardsPerRow.value = previousCardsPerRow.value;
    } else {
        previousCardsPerRow.value = newValue;
    }

    // 當cardsPerRow變化時，重新計算虛擬滾動
    nextTick(() => {
        rowVirtualizer.value?.value?.measure();
    });
});

const addBtn = ref({ header: "建立專家", description: "建立後可綁定知識庫" });

const formRef = ref(null);
function openForm() {
    let title = "開始建立一個新專家";
    let placeholder = "專家中還沒有提示詞，你可以在今後任何時候修改提示詞。";
    let data = [
        { type: "text", name: "expertId", required: false, placeholder: "專家ID (選填)" },
        { type: "text", name: "name", required: true, placeholder: "專家名稱 (必填)" },
    ];
    formRef.value.open({ title, placeholder, data });
}
async function createExperts(data) {
    try {
        const namePattern = /^[a-zA-Z0-9-_]+$/;
        if (data.expertId && !namePattern.test(data.expertId)) {
            formRef.value.showError("專家ID只能包含數字、英文、-、_");
            return;
        }

        let rs = await axios.post(
            "/expert/create",
            JSON.stringify({
                expertId: data.expertId || null,
                name: data.name,
            })
        );

        if (rs.data.code === 0) {
            const expertId = rs.data.data;
            formRef.value.close();
            router.push(`/experts/${expertId}/settings`);
        } else if (rs.data.code === 1 && rs.data.data?.isDuplicated) {
            formRef.value.showError("此專家ID已存在，請使用其他ID。");
        } else {
            formRef.value.showError(rs.data.message || "創建專家失敗");
        }
    } catch (error) {
        formRef.value.showError("創建專家時發生錯誤");
    }
}
</script>

<template>
    <div class="expert_view">
        <!-- 搜尋和控制區域 -->
        <div class="control-panel">
            <div class="search-container">
                <div class="search-input-wrapper">
                    <i class="fa-solid fa-magnifying-glass search-icon"></i>
                    <input type="text" v-model="searchQuery" class="search-input" placeholder="搜尋專家..." />
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
            <!-- 虛擬滾動容器 -->
            <template v-if="isLoading">
                <v-row class="d-flex justify-space-between">
                    <v-col v-for="n in 4" :key="n" cols="12" sm="6" md="4" lg="3">
                        <v-skeleton-loader type="image, list-item-two-line" />
                    </v-col>
                </v-row>
            </template>

            <div v-else-if="rows.length > 0" class="virtual-list-container" :style="{ height: `${totalHeight}px` }">
                <div
                    v-for="virtualRow in virtualRows"
                    :key="virtualRow.index"
                    class="row"
                    :style="{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${ROW_HEIGHT}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                    }"
                >
                    <!-- 每行的卡片 -->
                    <div
                        v-for="(item, colIndex) in rows[virtualRow.index]"
                        :key="item.id"
                        class="col"
                        :style="{
                            width: `${cardWidth}px`,
                            flex: `0 0 ${cardWidth}px`,
                        }"
                    >
                        <!-- 新增按鈕卡片 -->
                        <div v-if="item.isAddCard" class="card add_card" @click="openForm">
                            <div class="card_top add_card_top">
                                <span><i class="fa-solid fa-plus"></i></span>
                                <p>{{ addBtn.header }}</p>
                            </div>
                            <div class="card_center add_card_center">
                                <p>{{ addBtn.description }}</p>
                            </div>
                        </div>

                        <!-- 專家卡片 -->
                        <template v-else>
                            <template
                                v-if="
                                    item.created_by_name || item.created_by || item.updated_by_name || item.updated_by
                                "
                            >
                                <v-tooltip
                                    location="top"
                                    :text="
                                        (item.created_by_name || item.created_by
                                            ? `建立者：${item.created_by_name || item.created_by}\n`
                                            : '') +
                                        (item.updated_by_name || item.updated_by
                                            ? `更新者：${item.updated_by_name || item.updated_by}`
                                            : '')
                                    "
                                >
                                    <template v-slot:activator="{ props }">
                                        <router-link v-bind="props" :to="`/experts/${item.id}/overview`" class="card">
                                            <div class="card_top">
                                                <img :src="item.avatar" alt="" />
                                                <p>{{ item.name }}</p>
                                            </div>
                                            <div class="card_center">
                                                <!-- <p>{{ item.describe }}</p> -->
                                            </div>
                                            <div class="card_bottom">
                                                <div class="item">
                                                    <span class="datasets"
                                                        ><i class="fa-solid fa-diagram-project"></i
                                                    ></span>
                                                    <p class="">{{ item.datasets_count }}知識庫</p>
                                                </div>
                                                <div class="item">
                                                    <span class="skill"
                                                        ><i class="fa-solid fa-diagram-project"></i
                                                    ></span>
                                                    <p class="">{{ item.skill_count }}技能</p>
                                                </div>
                                            </div>
                                        </router-link>
                                    </template>
                                </v-tooltip>
                            </template>
                            <router-link v-else :to="`/experts/${item.id}/overview`" class="card">
                                <div class="card_top">
                                    <img :src="item.avatar" alt="" />
                                    <p>{{ item.name }}</p>
                                </div>
                                <div class="card_center">
                                    <!-- <p>{{ item.describe }}</p> -->
                                </div>
                                <div class="card_bottom">
                                    <div class="item">
                                        <span class="datasets"><i class="fa-solid fa-diagram-project"></i></span>
                                        <p class="">{{ item.datasets_count }}知識庫</p>
                                    </div>
                                    <div class="item">
                                        <span class="skill"><i class="fa-solid fa-diagram-project"></i></span>
                                        <p class="">{{ item.skill_count }}技能</p>
                                    </div>
                                </div>
                            </router-link>
                        </template>
                    </div>
                </div>
            </div>

            <div v-else-if="isLoading" class="status-message">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
                <div class="mt-3">正在載入專家列表...</div>
            </div>
            <div v-else-if="isError" class="status-message">
                <v-icon color="error" size="large">fa-solid fa-triangle-exclamation</v-icon>
                <div class="mt-3">載入失敗: {{ error.message }}</div>
            </div>
            <div v-else-if="searchQuery && filteredExperts.length === 0" class="status-message">
                <v-icon color="info" size="large">fa-solid fa-search</v-icon>
                <div class="mt-3">沒有符合 "{{ searchQuery }}" 的專家</div>
            </div>
            <div v-else-if="allExperts && allExperts.length === 0" class="status-message">
                <v-icon color="info" size="large">fa-solid fa-user</v-icon>
                <div class="mt-3">目前沒有專家，請點擊"建立專家"按鈕創建一個新的專家。</div>
            </div>
        </div>

        <FormComponents ref="formRef" @send="createExperts"></FormComponents>
    </div>
</template>

<style lang="scss" scoped>
$color1: rgb(106, 174, 233);
$color2: rgb(104, 197, 127);
$color3: rgb(139, 139, 139);
$primary-color: #1c64f1;
$light-gray: #f9fafb;
$border-color: #e0e0e0;

.datasets {
    color: $color1 !important;
}
.skill {
    color: $color2 !important;
}

.expert_view {
    position: relative;
    height: calc(100vh - 75px);
    width: 100%;
    overflow: hidden;
    padding: 1rem 2rem;
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
}

.virtual-list-container {
    position: relative;
    width: 100%;
}

.row {
    display: flex;
    flex-wrap: nowrap;
    width: 100%;
    gap: 1rem;
    padding: 0 0.5rem;
}

/* .col {
    margin-bottom: 1rem;
} */

.card {
    width: 100%;
    border-radius: 0.7rem;
    background-color: white;
    cursor: pointer;
    transition: 0.25s;
    padding: 1rem;
    box-shadow: 0px 1px 5px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    height: 120px;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    border: 3px solid rgba($color: $color1, $alpha: 0.5);

    &:hover {
        box-shadow: 0px 8px 15px rgba($color: $color1, $alpha: 0.3);
        border: 3px solid rgba($color: $color1, $alpha: 0.7);
    }

    .card_top {
        display: flex;
        align-items: center;
        height: 40px;
        margin-bottom: 0.5rem;

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
        }
    }
}

.add_card {
    background-color: #eceef1;
    border: 1px solid #e4e5e7;

    &:hover {
        background-color: white;
        box-shadow: 0px 8px 10px rgba($color: $color3, $alpha: 0.3);
        border: 2px solid rgba($color: $color3, $alpha: 0.5);
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
</style>
