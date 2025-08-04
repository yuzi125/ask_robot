<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
    startDate: {
        type: String,
        required: true,
    },
    startTime: {
        type: String,
        required: true,
    },
    endDate: {
        type: String,
        required: true,
    },
    endTime: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(["update:startDate", "update:startTime", "update:endDate", "update:endTime", "update"]);

// 本地狀態
const localStartDate = ref(props.startDate);
const localStartTime = ref(props.startTime);
const localEndDate = ref(props.endDate);
const localEndTime = ref(props.endTime);

// 監聽 props 變化
watch(
    () => props.startDate,
    (newVal) => {
        localStartDate.value = newVal;
    }
);
watch(
    () => props.startTime,
    (newVal) => {
        localStartTime.value = newVal;
    }
);
watch(
    () => props.endDate,
    (newVal) => {
        localEndDate.value = newVal;
    }
);
watch(
    () => props.endTime,
    (newVal) => {
        localEndTime.value = newVal;
    }
);

const showQuickRanges = ref(false);
const searchQuery = ref("");
const currentRangeValue = ref(15 * 60 * 1000); // 預設 15 minutes

// 快速選擇選項
const quickRanges = [
    { label: "Last 5 minutes", value: 5 * 60 * 1000 },
    { label: "Last 15 minutes", value: 15 * 60 * 1000 },
    { label: "Last 30 minutes", value: 30 * 60 * 1000 },
    { label: "Last 1 hour", value: 60 * 60 * 1000 },
    { label: "Last 3 hours", value: 3 * 60 * 60 * 1000 },
    { label: "Last 6 hours", value: 6 * 60 * 60 * 1000 },
    { label: "Last 12 hours", value: 12 * 60 * 60 * 1000 },
    { label: "Last 24 hours", value: 24 * 60 * 60 * 1000 },
    { label: "Last 2 days", value: 2 * 24 * 60 * 60 * 1000 },
];

// 格式化時間顯示
const formatDateTime = (date, time) => {
    const datetime = new Date(`${date}T${time}`);
    return datetime
        .toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })
        .replace(/\//g, "-");
};

// 計算當前選擇的範圍顯示文字
const getCurrentRange = computed(() => {
    const range = quickRanges.find((r) => r.value === currentRangeValue.value);
    return range ? range.label.replace("Last ", "") : "15 minutes";
});

// 過濾快速選擇選項
const filteredQuickRanges = computed(() => {
    if (!searchQuery.value) return quickRanges;
    return quickRanges.filter((range) => range.label.toLowerCase().includes(searchQuery.value.toLowerCase()));
});

// 應用快速選擇
const applyQuickRange = (rangeValue) => {
    currentRangeValue.value = rangeValue;

    // 使用本地時間
    const end = new Date();
    const start = new Date(end.getTime() - rangeValue);

    // 確保使用本地時區格式化日期和時間
    const formatDate = (date) => {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split("T")[0];
    };

    const formatTime = (date) => {
        return date.toTimeString().split(" ")[0].slice(0, 5);
    };

    const newStartDate = formatDate(start);
    const newStartTime = formatTime(start);
    const newEndDate = formatDate(end);
    const newEndTime = formatTime(end);

    emit("update:startDate", newStartDate);
    emit("update:startTime", newStartTime);
    emit("update:endDate", newEndDate);
    emit("update:endTime", newEndTime);

    emit("update", {
        startDate: newStartDate,
        startTime: newStartTime,
        endDate: newEndDate,
        endTime: newEndTime,
    });

    showQuickRanges.value = false;
};

// 應用自定義範圍
const applyCustomRange = () => {
    emit("update:startDate", localStartDate.value);
    emit("update:startTime", localStartTime.value);
    emit("update:endDate", localEndDate.value);
    emit("update:endTime", localEndTime.value);

    emit("update", {
        startDate: localStartDate.value,
        startTime: localStartTime.value,
        endDate: localEndDate.value,
        endTime: localEndTime.value,
    });

    showQuickRanges.value = false;
};
</script>

<template>
    <div class="time-range-picker">
        <v-menu v-model="showQuickRanges" :close-on-content-click="false">
            <template v-slot:activator="{ props }">
                <div class="time-button-wrapper">
                    <v-btn v-bind="props" class="time-range-btn" variant="flat">
                        <v-icon size="small" class="mr-2">mdi-clock-outline</v-icon>
                        <span
                            >{{ formatDateTime(startDate, startTime) }} to {{ formatDateTime(endDate, endTime) }}</span
                        >
                        <v-icon size="small" class="ml-2">mdi-chevron-down</v-icon>
                    </v-btn>

                    <v-tooltip
                        activator="parent"
                        location="bottom"
                        :text="`${formatDateTime(startDate, startTime)} to ${formatDateTime(endDate, endTime)}`"
                    />
                </div>
            </template>

            <v-card width="550" class="time-range-menu pa-0">
                <div class="time-range-header pa-2 d-flex align-center">
                    <v-icon size="small" class="mr-2">mdi-clock-outline</v-icon>
                    <span>Last {{ getCurrentRange }}</span>
                    <v-icon size="small" class="ml-2">mdi-chevron-up</v-icon>
                </div>

                <v-row no-gutters>
                    <v-col cols="7" class="px-4 py-3 time-range-left">
                        <div class="mb-4 text-body-1">Absolute time range</div>

                        <div class="mb-4">
                            <div class="mb-1 text-caption">From</div>
                            <div class="d-flex">
                                <v-text-field
                                    v-model="localStartDate"
                                    type="date"
                                    density="compact"
                                    class="mr-2"
                                    hide-details
                                    variant="outlined"
                                />
                                <v-text-field
                                    v-model="localStartTime"
                                    type="time"
                                    density="compact"
                                    hide-details
                                    variant="outlined"
                                />
                            </div>
                        </div>

                        <div class="mb-4">
                            <div class="mb-1 text-caption">To</div>
                            <div class="d-flex">
                                <v-text-field
                                    v-model="localEndDate"
                                    type="date"
                                    density="compact"
                                    class="mr-2"
                                    hide-details
                                    variant="outlined"
                                />
                                <v-text-field
                                    v-model="localEndTime"
                                    type="time"
                                    density="compact"
                                    hide-details
                                    variant="outlined"
                                />
                            </div>
                        </div>

                        <div class="mt-6 d-flex">
                            <v-btn color="primary" @click="applyCustomRange"> Apply time range </v-btn>
                        </div>
                    </v-col>

                    <v-col cols="5" class="quick-ranges border-left">
                        <v-text-field
                            v-model="searchQuery"
                            placeholder="Search quick ranges"
                            density="compact"
                            hide-details
                            prepend-inner-icon="mdi-magnify"
                            variant="outlined"
                            class="mx-2 my-2"
                        />

                        <v-list density="compact" class="pa-0">
                            <v-list-item
                                v-for="range in filteredQuickRanges"
                                :key="range.value"
                                :active="currentRangeValue === range.value"
                                @click="applyQuickRange(range.value)"
                                :title="range.label"
                                class="quick-range-item"
                            />
                        </v-list>
                    </v-col>
                </v-row>
            </v-card>
        </v-menu>
    </div>
</template>

<style scoped>
.time-range-picker {
    display: inline-block;
}

.time-button-wrapper {
    display: inline-block;
}

.time-range-btn {
    background-color: #f8f9fa;
    border: 1px solid #dce1e6;
    color: #464c56;
    height: 32px;
    font-size: 13px;

    &:hover {
        background-color: #f0f2f4;
    }
}

.time-range-menu {
    border: 1px solid #dce1e6;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.time-range-header {
    background-color: #f8f9fa;
    border-bottom: 1px solid #dce1e6;
    font-size: 13px;
    color: #464c56;
}

.time-range-left {
    background-color: #ffffff;
}

.border-left {
    border-left: 1px solid #dce1e6;
}

.quick-ranges {
    background-color: #f8f9fa;
}

.quick-range-item {
    min-height: 32px !important;
    padding: 0 16px;

    &:hover {
        background-color: rgba(0, 0, 0, 0.04);
    }

    &.v-list-item--active {
        background-color: #e3f2fd;
        color: #1976d2;
    }

    :deep(.v-list-item-title) {
        font-size: 13px;
        line-height: 32px;
    }
}

.v-text-field {
    :deep(.v-field) {
        background-color: #ffffff;
        border: 1px solid #dce1e6;

        &:hover {
            border-color: #b4bac0;
        }

        &.v-field--focused {
            border-color: #1976d2;
        }
    }
}

:deep(.v-input) {
    font-size: 13px;
}
</style>
