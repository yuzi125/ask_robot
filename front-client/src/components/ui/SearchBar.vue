<script setup>
import { ref, inject, nextTick, computed, onMounted, onUnmounted } from "vue";
import { useStateStore } from "@/store";
import { storeToRefs } from "pinia";
const props = defineProps({
    messages: {
        type: Array,
        required: true,
    },
    virtualizer: {
        type: Object,
        required: false,
    },
});
const stateStore = useStateStore();
const { isOpenMenu, bulletinHeight } = storeToRefs(stateStore);

const isOpen = ref(false);
const searchKeyword = ref("");
const searchResults = ref([]);
const currentSearchIndex = ref(-1);
const searchInput = ref(null);

// 計算 search-container 的樣式
const searchContainerStyle = computed(() => {
    const menuWidth = isOpenMenu.value ? 0 : 283; // 判斷 menu 展開或收起的寬度
    return {
        top: bulletinHeight.value > 0 ? `calc(3em + ${bulletinHeight.value}px)` : "50px",
        left: `${menuWidth}px`,
        width: `calc(100% - ${menuWidth}px)`,
    };
});

// 接收事件開啟搜尋欄
const emitter = inject("emitter");
emitter.on("openSearchBar", async () => {
    isOpen.value = !isOpen.value;
    await nextTick(); // 等待 DOM 更新
    searchInput.value?.focus();
});

// 關閉搜尋欄
function closeSearch() {
    isOpen.value = false;
    searchKeyword.value = "";
    searchResults.value = [];
    currentSearchIndex.value = -1;
    emitter.emit("closeSearchBar");
}

// 搜尋功能
function searchMessages(keyword) {
    if (!keyword.trim()) {
        searchResults.value = [];
        currentSearchIndex.value = -1;
        return;
    }

    searchResults.value = props.messages
        .map((msg, index) => {
            const messageContent = msg.message?.data?.toString() || "";
            return messageContent.toLowerCase().includes(keyword.toLowerCase()) ? index : -1;
        })
        .filter((index) => index !== -1);

    currentSearchIndex.value = searchResults.value.length ? 0 : -1;
    if (currentSearchIndex.value >= 0) {
        scrollToSearchResult(currentSearchIndex.value);
    }
}

// 滾動至搜尋結果
function scrollToSearchResult(resultIndex) {
    const targetIndex = searchResults.value[resultIndex];
    if (targetIndex === undefined || !props.virtualizer) return;

    props.virtualizer.value.scrollToIndex(targetIndex, {
        align: "center",
        behavior: "auto",
    });
}

function nextSearchResult() {
    if (!searchResults.value.length) return;
    currentSearchIndex.value = (currentSearchIndex.value + 1) % searchResults.value.length;
    scrollToSearchResult(currentSearchIndex.value);
}

function previousSearchResult() {
    if (!searchResults.value.length) return;
    currentSearchIndex.value = (currentSearchIndex.value - 1 + searchResults.value.length) % searchResults.value.length;
    scrollToSearchResult(currentSearchIndex.value);
}

// 監聽 Ctrl + F 快捷鍵
function handleKeyDown(event) {
    if (event.ctrlKey && event.key === "f") {
        event.preventDefault(); // 阻止瀏覽器預設的 Ctrl + F 行為
        emitter.emit("openSearchBar"); // 開啟搜尋欄
    }

    if (event.key === "Enter") {
        nextSearchResult();
    }
}

onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
    <transition name="slide-down">
        <div v-if="isOpen" class="search-container" :style="searchContainerStyle">
            <div class="search-bar">
                <input
                    v-model="searchKeyword"
                    @input="searchMessages(searchKeyword)"
                    placeholder="搜尋對話..."
                    class="search-input"
                    ref="searchInput"
                />
                <div class="search-controls">
                    <template v-if="searchResults.length">
                        <span class="search-count"> {{ currentSearchIndex + 1 }}/{{ searchResults.length }} </span>
                        <button @click="previousSearchResult" class="search-nav-btn">
                            <i class="fa-solid fa-chevron-up"></i>
                        </button>
                        <button @click="nextSearchResult" class="search-nav-btn">
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </template>
                    <button @click="closeSearch" class="search-close-btn">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<style scoped>
.search-container {
    position: fixed;
    top: 50px; /* 距離頂部的固定距離 */
    z-index: 1000;
    padding: 8px;
    background: var(--bg-color);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 768px;
    margin: 0 auto;
}

.search-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--input-bg-color);
    color: var(--text-color);
}

.search-controls {
    display: flex;
    align-items: center;
    gap: 8px;
}

.search-count {
    font-size: 14px;
    color: var(--text-secondary-color);
}

.search-nav-btn,
.search-close-btn {
    padding: 4px 8px;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-color);
}

.search-nav-btn:hover,
.search-close-btn:hover {
    color: var(--primary-color);
}

.slide-down-enter-active,
.slide-down-leave-active {
    transition: all 0.3s ease;
}

.slide-down-enter-from {
    transform: translateY(-20px);
    opacity: 0;
}

.slide-down-enter-to {
    transform: translateY(0);
    opacity: 1;
}

.slide-down-leave-from {
    transform: translateY(0);
    opacity: 1;
}

.slide-down-leave-to {
    transform: translateY(-20px);
    opacity: 0;
}
</style>
