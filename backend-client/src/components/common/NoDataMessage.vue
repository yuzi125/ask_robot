<script setup>
import { computed } from "vue";

const props = defineProps({
    totalCount: {
        type: Number,
        required: true,
    },
    filteredCount: {
        type: Number,
        required: true,
    },
    isSearching: {
        type: Boolean,
        default: false,
    },
    searchTerm: {
        type: String,
        default: "",
    },
    noDataMessage: {
        type: String,
        default: "尚未有資料。",
    },
    noSearchResultMessage: {
        type: String,
        default: "沒有找到符合搜索條件的結果。",
    },
});

const showMessage = computed(() => props.filteredCount === 0);

const messageType = computed(() => (props.isSearching ? "warning" : "info"));

const messageText = computed(() => {
    if (props.totalCount === 0) {
        return props.noDataMessage;
    } else if (props.isSearching) {
        return `${props.noSearchResultMessage} 搜尋詞: "${props.searchTerm}"`;
    }
    return props.noDataMessage;
});
</script>

<template>
    <v-row v-if="showMessage">
        <v-col cols="12">
            <v-alert :type="messageType" :text="messageText" class="rounded-lg"></v-alert>
        </v-col>
    </v-row>
</template>
