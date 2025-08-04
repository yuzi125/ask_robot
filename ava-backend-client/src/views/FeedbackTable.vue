<script setup>
import { ref, computed, inject, onMounted, onUnmounted, nextTick, watch } from "vue";
const emitter = inject("emitter");
import { useRoute } from "vue-router";
const route = useRoute();

import dayjs from "dayjs";
import {
    fetchFeedbackAdminProcess,
    fetchUserFeedbackByExpertId,
    fetchFeedbackOptions,
    fetchChunksContent,
} from "@/network/service";

import DetailDialog from "@/components/experts/feedback/DetailDialog.vue";

import { storeToRefs } from "pinia";
import { useFeedbackStore } from "@/store/index";
const feedbackStore = useFeedbackStore();
const { feedbackData, feedbackOptions } = storeToRefs(feedbackStore);

// 選擇日期區間
const startDate = ref(dayjs().subtract(7, "day").format("YYYY-MM-DD"));
const endDate = ref(dayjs().format("YYYY-MM-DD"));

watch(
    () => startDate.value,
    () => {
        getFeedback();
    }
);
watch(
    () => endDate.value,
    () => {
        getFeedback();
    }
);

// 取得使用者評價
const loadingTableData = ref(false);
async function getFeedback() {
    // 檢查資料
    if (!startDate.value || !endDate.value) {
        return;
    }
    loadingTableData.value = true;
    const res = await fetchUserFeedbackByExpertId({
        expertID: route.params.expert_id,
        startDate: startDate.value,
        endDate: endDate.value,
    });
    feedbackData.value = res;
    loadingTableData.value = false;
    updateScrollState();
}
getFeedback();

const operatorOptions = ref([]);
const userOptions = ref([]);
// 取得feedback options
async function getFeedbackOptions() {
    const res = await fetchFeedbackOptions();
    feedbackOptions.value = res;
    operatorOptions.value = res.filter((e) => e.status === "admin").sort((a, b) => a.id - b.id);
    userOptions.value = res.filter((e) => e.status.match("user")).sort((a, b) => a.id - b.id);
    updateStorage();

    try {
        // 移除舊版的儲存格式"userFeedbackTags"(這段 2024/12/18 可以移除。)
        if (localStorage.getItem("userFeedbackTags")) {
            localStorage.removeItem("userFeedbackTags");
        }

        // 如果第一次使用，localStorage沒有selectedFeedbackTags，預設全選負評tags。
        if (localStorage.getItem("selectedFeedbackTags") === null) {
            selectedUserOptions.value = res.filter((e) => e.status.match("user_negative")).map((e) => e.id);
            saveSelectedUserOptions();
        }

        operatorOptions.value = res.filter((e) => e.status.match("admin"));
        if (localStorage.getItem("operatorFeedbackStatus") === null) {
            selectedOperatorOptions.value = operatorOptions.value.map((e) => e.id);
            saveSelectedOperatorOptions();
        }
    } catch (error) {
        console.error(error);
    }
}

// 更新localStorage中已儲存的選項(把不能用的去掉)
function updateStorage() {
    if (localStorage.getItem("selectedFeedbackTags")) {
        const storageTags = JSON.parse(localStorage.getItem("selectedFeedbackTags"));

        const serverTags = feedbackOptions.value.map((e) => e.id);
        const newStorageTags = storageTags.filter((e) => serverTags.includes(e));
        localStorage.setItem("selectedFeedbackTags", JSON.stringify(newStorageTags));
    }
    if (localStorage.getItem("operatorFeedbackStatus")) {
        const storageTags = JSON.parse(localStorage.getItem("operatorFeedbackStatus"));
        const serverTags = feedbackOptions.value.map((e) => e.id);
        const newStorageTags = storageTags.filter((e) => serverTags.includes(e));
        localStorage.setItem("operatorFeedbackStatus", JSON.stringify(newStorageTags));
    }
}

const getStatusName = (code) => {
    const option = operatorOptions.value.find((e) => e.id === code);
    return option?.name || "--";
};

const feedbackHeaders = ref([
    { title: "順序", value: "index", sortable: false },
    { title: "提問", value: "question", sortable: true },
    { title: "內容", value: "comment" },
    { title: "好評/負評", value: "feedback_type", sortable: true },
    { title: "評論Tag", value: "selectOptions", sortable: true },
    { title: "來源", value: "datasets", sortable: true },
    { title: "狀態", value: "status", sortable: true },
    { title: "評論時間", value: "create_time", sortable: true },
]);

const selectedUserOptions = ref([]);
const selectedOperatorOptions = ref([]);
const searchDataset = ref("");
const searchQuestion = ref("");
const searchContent = ref("");

const feedbackDataList = computed(() => {
    let displayData = feedbackData.value;
    // 第一道過濾 :使用者評論
    if (selectedUserOptions.value.length > 0) {
        displayData = displayData.filter((e) => {
            const result = e.userProcess.options.some((tag) => selectedUserOptions.value.includes(tag));
            return result ? 1 : 0;
        });
    } else {
        return [];
    }

    // 第二道過濾 :輸入的資料
    if (searchDataset.value) {
        displayData = displayData.filter((e) => {
            const result = e.datasets.some((dataset) => {
                return dataset.name?.match(searchDataset.value);
            });
            return result ? 1 : 0;
        });
    }
    if (searchQuestion.value) {
        displayData = displayData.filter((e) => {
            const result = e.question?.match(searchQuestion.value);
            return result ? 1 : 0;
        });
    }
    if (searchContent.value) {
        displayData = displayData.filter((e) => {
            const result = e.userProcess.comment?.match(searchContent.value);
            return result ? 1 : 0;
        });
    }

    // 第三道過濾 :評論狀態
    if (selectedOperatorOptions.value.length > 0) {
        displayData = displayData.filter((e) => selectedOperatorOptions.value.includes(e.status));
    } else {
        return [];
    }
    return displayData.sort((a, b) => new Date(b.create_time) - new Date(a.create_time));
});
// 每頁幾筆資料
const itemsPerPage = ref(10);

// 視窗互動相關
const openDialog = ref(false);
const dialogData = ref(null);
const processHistory = ref([]);
const dialogActiveKey = ref(0);
const handleOpenDialog = async (item) => {
    // 取得管理者處理歷程
    if (item.id) {
        const rs = await fetchFeedbackAdminProcess(item.id);
        const chunksData = await fetchChunksContent({ sourceChunks: item.source_chunk_content });
        try {
            processHistory.value = rs.data.data || [];
            item.source_chunk_content = chunksData.data.data;
        } catch (error) {
            console.error(error);
            processHistory.value = [];
        }
    }

    // 賦值給詳細視窗
    dialogData.value = JSON.parse(JSON.stringify(item));
    // 提示給dialog(將一些元件初始化)
    dialogActiveKey.value++;
    openDialog.value = true;
};
const handleCloseDialog = () => {
    processHistory.value = [];
    openDialog.value = false;
};

// 處理成功後要刷新資訊
const handleProcessSuccess = async () => {
    // 重取管理者處理歷程
    try {
        getFeedback();
        const rs = await fetchFeedbackAdminProcess(dialogData.value.id);
        processHistory.value = rs.data.data || [];
    } catch (error) {
        console.error(error);
        processHistory.value = [];
    }
};

const tableRef = ref(null);
const scrollAmount = ref(300);
const isScrolledToEnd = ref(false);
const isScrolledToStart = ref(true);
const animationDuration = 150;
const currentPage = ref(1);

const getScrollContainer = () => {
    if (tableRef.value && tableRef.value.$el) {
        return tableRef.value.$el.querySelector(".v-table__wrapper");
    }
    return null;
};

const scrollTo = (container, targetScrollLeft) => {
    const start = container.scrollLeft;
    const change = targetScrollLeft - start;
    const startTime = performance.now();

    const animateScroll = (currentTime) => {
        const elapsedTime = currentTime - startTime;
        if (elapsedTime < animationDuration) {
            const progress = elapsedTime / animationDuration;
            container.scrollLeft = start + change * easeInOutQuad(progress);
            requestAnimationFrame(animateScroll);
        } else {
            container.scrollLeft = targetScrollLeft;
            checkScrollPosition();
        }
    };

    requestAnimationFrame(animateScroll);
};

// 神奇小魔法
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

const scrollRight = () => {
    const container = getScrollContainer();
    if (container) {
        const targetScrollLeft = container.scrollLeft + scrollAmount.value;
        scrollTo(container, targetScrollLeft);
    }
};

const scrollLeft = () => {
    const container = getScrollContainer();
    if (container) {
        const targetScrollLeft = container.scrollLeft - scrollAmount.value;
        scrollTo(container, targetScrollLeft);
    }
};

const checkScrollPosition = () => {
    const container = getScrollContainer();
    if (container) {
        const { scrollLeft, scrollWidth, clientWidth } = container;
        isScrolledToEnd.value = scrollLeft + clientWidth >= scrollWidth - 1;
        isScrolledToStart.value = scrollLeft <= 1;
    }
};

const updateScrollState = () => {
    nextTick(() => {
        checkScrollPosition();
    });
};

const handleTableOptionsUpdate = (options) => {
    if (options.page !== currentPage.value) {
        currentPage.value = options.page;
        nextTick(() => {
            updateScrollState();
        });
    }
};
onMounted(() => {
    loadSelectedUserOptions();
    loadSelectedOperatorOptions();
    getFeedbackOptions();
    nextTick(() => {
        const container = getScrollContainer();
        if (container) {
            container.addEventListener("scroll", checkScrollPosition);
            checkScrollPosition();
            updateScrollState();
        }
    });
});

onUnmounted(() => {
    const container = getScrollContainer();
    if (container) {
        container.removeEventListener("scroll", checkScrollPosition);
    }
});

// todo: 整合在一起
const loadSelectedUserOptions = () => {
    const savedSelection = localStorage.getItem("selectedFeedbackTags");
    if (savedSelection !== null) {
        selectedUserOptions.value = JSON.parse(savedSelection);
    }
};

const loadSelectedOperatorOptions = () => {
    const savedSelection = localStorage.getItem("operatorFeedbackStatus");
    if (savedSelection !== null) {
        selectedOperatorOptions.value = JSON.parse(savedSelection);
    }
};

const saveSelectedUserOptions = () => {
    localStorage.setItem("selectedFeedbackTags", JSON.stringify(selectedUserOptions.value));
};

const saveSelectedOperatorOptions = () => {
    localStorage.setItem("operatorFeedbackStatus", JSON.stringify(selectedOperatorOptions.value));
};

watch(selectedUserOptions, saveSelectedUserOptions, { deep: true });
watch(selectedOperatorOptions, saveSelectedOperatorOptions, { deep: true });

const hoveredRow = ref(null);
const hoverIndex = ref(null);
const hoverIndexContent = ref(null);

function getTagNames(options) {
    const nameList = options.map((e) => {
        const target = feedbackOptions.value.find((tag) => tag.id === e);
        if (target) {
            return target.name;
        } else {
            return "--";
        }
    });
    return nameList.join(",");
}

// 額外添加的功能
const showHistoryMessageId = ref(false);
watch(
    () => searchQuestion.value,
    () => {
        if (searchQuestion.value === "openID") {
            showHistoryMessageId.value = true;
            alert("已打開history_message_id顯示");
            localStorage.setItem("showHistoryMessageId", true);
        } else if (searchQuestion.value === "closeID") {
            showHistoryMessageId.value = false;
            alert("已關閉history_message_id顯示");
            localStorage.removeItem("showHistoryMessageId");
        }
    }
);
onMounted(() => {
    if (localStorage.getItem("showHistoryMessageId")) {
        showHistoryMessageId.value = true;
    }
});
</script>

<template>
    <div style="display: flex; flex-direction: column">
        <div class="table-top">
            <div class="flex-wrap mb-3 d-flex ga-6">
                <div class="date-search-box">
                    <v-text-field
                        type="date"
                        label="開始日期"
                        v-model="startDate"
                        min="2024-07-01"
                        :max="endDate"
                        hide-details
                        onkeydown="return false;"
                    />
                </div>
                <div class="date-search-box">
                    <v-text-field
                        type="date"
                        label="結束日期"
                        v-model="endDate"
                        :min="startDate"
                        :max="dayjs().format('YYYY-MM-DD')"
                        hide-details
                        onkeydown="return false;"
                    />
                </div>
            </div>
            <div class="flex-wrap d-flex ga-6">
                <div class="search-box">
                    <v-text-field
                        v-model="searchQuestion"
                        label="搜尋提問"
                        prepend-inner-icon="mdi-magnify"
                        variant="solo-filled"
                        flat
                        hide-details
                    ></v-text-field>
                </div>
                <div class="search-box">
                    <v-text-field
                        v-model="searchContent"
                        label="搜尋內容"
                        prepend-inner-icon="mdi-magnify"
                        variant="solo-filled"
                        flat
                        hide-details
                    ></v-text-field>
                </div>
                <div class="search-box">
                    <v-text-field
                        v-model="searchDataset"
                        label="搜尋知識庫"
                        prepend-inner-icon="mdi-magnify"
                        variant="solo-filled"
                        flat
                        hide-details
                    ></v-text-field>
                </div>
                <div class="search-box">
                    <v-select
                        v-model="selectedUserOptions"
                        label="搜尋評論TAG"
                        :items="userOptions"
                        item-title="name"
                        item-value="id"
                        multiple
                        hide-details
                    >
                        <template v-slot:selection="{ item, index }">
                            <v-chip v-if="index < 1">
                                <span>{{ item.title }}</span>
                            </v-chip>
                            <span v-if="index === 1" class="text-grey text-caption align-self-center">
                                (+{{ selectedUserOptions.length - 1 }})
                            </span>
                        </template>
                    </v-select>
                </div>
                <div class="search-box">
                    <v-select
                        v-model="selectedOperatorOptions"
                        label="搜尋評論狀態"
                        :items="operatorOptions"
                        item-title="name"
                        item-value="id"
                        multiple
                        hide-details
                    >
                        <template v-slot:selection="{ item, index }">
                            <v-chip v-if="index < 1">
                                <span>{{ item.title }}</span>
                            </v-chip>
                            <span v-if="index === 1" class="text-grey text-caption align-self-center">
                                (+{{ selectedOperatorOptions.length - 1 }})
                            </span>
                        </template>
                    </v-select>
                </div>
            </div>
        </div>
        <div class="scrollable-table-container">
            <v-data-table
                class="elevation-1 data-table scrollable-table"
                :headers="feedbackHeaders"
                :items="feedbackDataList"
                fixed-header
                fixed-footer
                item-value="name"
                v-model:items-per-page="itemsPerPage"
                items-per-page-text="每頁評論數"
                ref="tableRef"
                :loading="loadingTableData"
                :loading-text="`資料讀取中...`"
                no-data-text="無相關評論。"
                @update:options="handleTableOptionsUpdate"
            >
                <template v-slot:[`item`]="{ item, index }">
                    <tr
                        :class="{ 'hovered-row': hoveredRow === index }"
                        @mouseover="hoveredRow = index"
                        @mouseleave="hoveredRow = null"
                        @click="handleOpenDialog(item)"
                    >
                        <!-- 順序 -->
                        <td>
                            <div>
                                {{ index + 1 + "." }}
                                <span v-if="showHistoryMessageId">({{ item.history_messages_id }})</span>
                            </div>
                        </td>
                        <!-- 提問 -->
                        <td
                            :class="{ 'hovered-link': hoverIndex === index }"
                            @mouseover="hoverIndex = index"
                            @mouseleave="hoverIndex = null"
                        >
                            <div>
                                <span class="truncate-text">{{ item.question }}</span>
                            </div>
                            <v-tooltip activator="parent" location="top" max-width="900">{{ item.question }}</v-tooltip>
                        </td>
                        <!-- 內容 -->
                        <td
                            :class="{ 'hovered-link': hoverIndexContent === index }"
                            @mouseover="hoverIndexContent = index"
                            @mouseleave="hoverIndexContent = null"
                        >
                            <div>
                                <span class="truncate-text">{{ item.userProcess.comment || "--" }}</span>
                            </div>
                            <v-tooltip activator="parent" location="top" max-width="900">
                                <span style="white-space: pre-wrap">{{
                                    item.userProcess.comment || "--"
                                }}</span></v-tooltip
                            >
                        </td>
                        <!-- 好評 / 負評 -->
                        <td>
                            <div>
                                <span v-if="item.feedback_type.match('positive')">
                                    <i class="fa-solid fa-thumbs-up" style="color: #4caf50"></i>
                                </span>
                                <span v-else>
                                    <i class="fa-solid fa-thumbs-down" style="color: #f44336"></i>
                                </span>
                                {{ item.feedback_type.match("positive") ? "好評" : "負評" }}
                            </div>
                        </td>
                        <!-- 評論Tag -->
                        <td>
                            <div class="chips-single-line">
                                <div v-for="(feedbackTag, index) in item.userProcess.options">
                                    <v-chip
                                        v-show="index < 2"
                                        :color="item.feedback_type.match('positive') ? 'success' : 'red'"
                                    >
                                        {{ feedbackOptions.find((e) => e.id === feedbackTag)?.name || "--" }}
                                    </v-chip>
                                    <span v-if="index === 2">{{ `(+ ${item.userProcess.options.length - 2})` }}</span>
                                </div>
                                <v-tooltip activator="parent" location="top">{{
                                    getTagNames(item.userProcess.options)
                                }}</v-tooltip>
                            </div>
                        </td>
                        <!-- 來源 -->
                        <td>
                            <div v-for="dataset in item.datasets" :key="dataset.id">
                                <v-chip v-if="dataset.id" color="info">{{ dataset.name }}</v-chip>
                                <v-chip v-else color="info">無</v-chip>
                            </div>
                        </td>
                        <!-- 狀態 -->
                        <td>
                            <div>
                                <v-chip>{{ getStatusName(item.status) }}</v-chip>
                            </div>
                        </td>
                        <!-- 評論時間 -->
                        <td>
                            <div class="text-no-wrap">{{ dayjs(item.create_time).format("YYYY-MM-DD HH:mm:ss") }}</div>
                        </td>
                    </tr>
                </template>
            </v-data-table>
            <transition name="fade">
                <div v-if="!isScrolledToStart" class="scroll-button scroll-left" @click="scrollLeft">
                    <v-icon>mdi-chevron-left</v-icon>
                </div>
            </transition>
            <transition name="fade">
                <div v-if="!isScrolledToEnd" class="scroll-button scroll-right" @click="scrollRight">
                    <v-icon>mdi-chevron-right</v-icon>
                </div>
            </transition>
        </div>
        <!-- 詳細視窗 -->
        <DetailDialog
            :openDialog="openDialog"
            :dialogActiveKey="dialogActiveKey"
            :dialogData="dialogData"
            :processHistory="processHistory"
            :operatorOptions="operatorOptions"
            :feedbackOptions="feedbackOptions"
            @handleCloseDialog="handleCloseDialog"
            @handleProcessSuccess="handleProcessSuccess"
        />
    </div>
</template>

<style scoped>
/* 表格 */
.table-top {
    padding: 12px 0px;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    .search-box {
        width: 210px;
    }
    .date-search-box {
        width: 140px;
    }
}

:deep(.v-table > .v-table__wrapper > table > thead > tr > th) {
    background-color: #f5f5f5;
    font-size: 1rem;
    padding: 12px 12px;
}

:deep(.v-table > .v-table__wrapper > table > thead > tr > th > div) {
    height: 100%;
}

:deep(.v-data-table-header__content) span {
    white-space: nowrap;
}

:deep(.v-table .v-table__wrapper > table > tbody > tr > td) {
    height: auto;
    padding: 12px 12px;
}

.operator {
    .detail {
        color: #29b6f6;
    }
    .detail:hover {
        cursor: pointer;
    }
}

.chips-single-line {
    cursor: pointer;
    display: flex;
    align-items: center;
    white-space: nowrap;
    gap: 6px;
}

.truncate-text {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 150px;
    word-wrap: break-word;
    word-break: break-all;
    white-space: normal;
}

.scrollable-table {
    width: 100%;
    flex: 3;
    overflow: hidden;
    max-height: 63vh;
}

.scroll-button {
    position: absolute;
    top: 55px;
    height: calc(100% - 115px);
    bottom: 0;
    width: 40px;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.1);
    transition: background-color 0.3s;
    cursor: pointer;
}

.scroll-button:hover {
    background-color: rgba(0, 0, 0, 0.2);
}

.scroll-right {
    right: 0;
}

.scroll-left {
    left: 0;
}

.content-container {
    overflow: visible !important;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.scroll-button .v-icon {
    font-size: 24px;
}

.scrollable-table-container {
    position: relative;
    overflow: hidden;
}

.hovered-row {
    background-color: #f2f7ff; /* 背景顏色，可根據需求調整 */
    cursor: pointer;
}

.hovered-link {
    color: rgb(0, 81, 255);
    text-decoration: underline;
    cursor: pointer;
}
</style>
