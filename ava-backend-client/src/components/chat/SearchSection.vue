<script setup>
import { ref, reactive, onMounted } from "vue";

const props = defineProps({
    isLoading: Boolean,
    searchExpanded: Boolean,
});

const emit = defineEmits(["apply-filter", "toggle-search-section", "switch-change"]);

const userTypes = ["遊客", "member", "webapi"];

const searchParams = reactive({
    startDate: "",
    endDate: "",
    selectedUserType: "遊客",
    enabledDeleteExpert: false,
});

const toggleSearchSection = () => {
    emit("toggle-search-section");
};

onMounted(() => {
    // Set default start date to 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    searchParams.startDate = threeMonthsAgo.toISOString().split("T")[0];
});

const applyFilter = () => {
    emit("apply-filter", searchParams);
};
</script>

<template>
    <div class="sidebar search-section border-right" :class="{ collapsed: !searchExpanded }">
        <v-card flat height="100%" class="d-flex flex-column">
            <v-card-title class="py-2 d-flex justify-space-between align-center">
                搜尋功能
                <v-btn icon small @click="toggleSearchSection" class="toggle-btn">
                    <v-icon>{{ searchExpanded ? "mdi-chevron-left" : "mdi-chevron-right" }}</v-icon>
                </v-btn>
                <v-checkbox
                    v-model="searchParams.enabledDeleteExpert"
                    @change="applyFilter"
                    label="顯示已刪除的專家"
                    hide-details
                    dense
                    class="ma-0 pa-0"
                ></v-checkbox>
            </v-card-title>
            <v-card-text v-show="searchExpanded" class="flex-grow-1">
                <v-text-field
                    v-model="searchParams.startDate"
                    type="date"
                    label="開始日期"
                    dense
                    outlined
                    hide-details
                    class="mb-4"
                ></v-text-field>
                <v-text-field
                    v-model="searchParams.endDate"
                    type="date"
                    label="結束日期"
                    dense
                    outlined
                    hide-details
                    class="mb-4"
                ></v-text-field>
                <v-btn-toggle
                    v-model="searchParams.selectedUserType"
                    mandatory
                    class="mb-4 d-flex justify-space-between"
                >
                    <v-btn v-for="type in userTypes" :key="type" :value="type" text small class="flex-grow-1">
                        {{ type }}
                    </v-btn>
                </v-btn-toggle>
                <v-btn color="primary" block @click="applyFilter" :loading="isLoading" class="mt-2" outlined
                    >篩選</v-btn
                >
            </v-card-text>
        </v-card>
    </div>
</template>

<style scoped>
.search-section {
    height: 100vh;
    transition: all 0.3s ease;
}

.v-slide-y-transition-enter-active,
.v-slide-y-transition-leave-active {
    transition: all 0.3s ease;
}

.search-section {
    height: calc(100vh - 68px);
    display: flex;
    flex-direction: column;
}

.border-right {
    border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.toggle-btn {
    position: absolute;
    right: -20px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    background-color: white !important;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
}

.rotate-icon {
    transform: rotate(90deg);
}

.transition-fast-in-fast-out {
    transition: all 0.2s ease;
}

.sidebar.collapsed .v-card-text,
.sidebar.collapsed .v-card-title > *:not(.toggle-btn) {
    display: none;
}

.sidebar.collapsed .toggle-btn {
    right: -20px;
    background-color: white !important;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
}

.sidebar {
    position: relative;
    flex: 0 0 25%;
    max-width: 25%;
    transition: all 0.3s ease;
    will-change: flex, max-width;
}

.sidebar.collapsed {
    flex: 0 0 40px;
    max-width: 40px;
}
</style>
