<template>
    <v-card class="rounded-lg model-card" elevation="2">
        <v-card-item>
            <template v-slot:prepend>
                <v-avatar :color="colors.primary" size="40">
                    <v-icon color="white" size="24">mdi-cube-outline</v-icon>
                </v-avatar>
            </template>
            <v-card-title class="text-body-1 font-weight-bold">{{ item.displayName }}</v-card-title>
            <v-card-subtitle class="text-caption">{{ item.model_name }}</v-card-subtitle>
        </v-card-item>
        <v-card-text class="pt-0">
            <v-row dense class="date-info-container">
                <v-col cols="6" class="pr-1">
                    <v-hover v-slot="{ isHovering, props }">
                        <v-card flat class="date-card" :class="{ 'border-create': true }" v-bind="props">
                            <v-tooltip
                                :text="getTooltipText(item.create_time)"
                                location="top"
                                :model-value="isHovering && isValidDate(item.create_time)"
                            >
                                <template v-slot:activator="{ props }">
                                    <v-card-text class="pa-2" v-bind="props">
                                        <div class="d-flex flex-column">
                                            <div class="d-flex align-center justify-space-between">
                                                <span class="text-caption font-weight-medium">建立</span>
                                                <v-icon size="small" :color="colors.create">mdi-calendar-plus</v-icon>
                                            </div>
                                            <span class="text-body-2 font-weight-medium">
                                                {{ getDisplayDate(item.create_time) }}
                                            </span>
                                        </div>
                                    </v-card-text>
                                </template>
                            </v-tooltip>
                        </v-card>
                    </v-hover>
                </v-col>
                <v-col cols="6" class="pl-1">
                    <v-hover v-slot="{ isHovering, props }">
                        <v-card flat class="date-card" :class="{ 'border-update': true }" v-bind="props">
                            <v-tooltip
                                :text="getTooltipText(item.update_time)"
                                location="top"
                                :model-value="isHovering && isValidDate(item.update_time)"
                            >
                                <template v-slot:activator="{ props }">
                                    <v-card-text class="pa-2" v-bind="props">
                                        <div class="d-flex flex-column">
                                            <div class="d-flex align-center justify-space-between">
                                                <span class="text-caption font-weight-medium">更新</span>
                                                <v-icon size="small" :color="colors.update">mdi-calendar-clock</v-icon>
                                            </div>
                                            <span class="text-body-2 font-weight-medium">
                                                {{ getDisplayDate(item.update_time) }}
                                            </span>
                                        </div>
                                    </v-card-text>
                                </template>
                            </v-tooltip>
                        </v-card>
                    </v-hover>
                </v-col>
            </v-row>
            <v-checkbox
                :model-value="selectedModelUuid === item.uuid"
                :disabled="selectedModelUuid === item.uuid"
                @change="selectModel(item.uuid)"
                label="選擇為當前模型"
                hide-details
                density="compact"
                class="mt-3"
                :color="colors.primary"
            ></v-checkbox>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions>
            <v-spacer></v-spacer>
            <v-tooltip text="匯出模型設定" location="top">
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        icon="mdi-file-export"
                        variant="text"
                        :color="colors.export"
                        @click="exportItem(item)"
                    ></v-btn>
                </template>
            </v-tooltip>
            <v-tooltip text="編輯模型" location="top">
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        icon="mdi-pencil"
                        variant="text"
                        :color="colors.edit"
                        @click="editItem(item)"
                    ></v-btn>
                </template>
            </v-tooltip>
            <v-tooltip text="刪除模型" location="top">
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        icon="mdi-delete"
                        variant="text"
                        :color="colors.delete"
                        @click="deleteItem(item)"
                    ></v-btn>
                </template>
            </v-tooltip>
        </v-card-actions>
    </v-card>
</template>

<script setup>
import { formatDate } from "@/utils/common";
import { defineProps, defineEmits, reactive, computed } from "vue";
import { useDisplay } from "vuetify";

const props = defineProps({
    item: {
        type: Object,
        required: true,
    },
    selectedModelUuid: {
        type: String,
        default: "",
    },
});

const emit = defineEmits(["select", "edit", "delete", "export"]);

const colors = reactive({
    primary: "#1976D2",
    create: "#43A047",
    update: "#1E88E5",
    export: "#FFA000",
    edit: "#5E35B1",
    delete: "#D32F2F",
});

const { mobile } = useDisplay();

const isValidDate = (dateString) => {
    return dateString !== null && dateString !== undefined && !isNaN(new Date(dateString).getTime());
};

const getDisplayDate = (dateString) => {
    if (!isValidDate(dateString)) return "-";
    const date = new Date(dateString.replace("Z", ""));
    if (mobile.value) {
        return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date
            .getDate()
            .toString()
            .padStart(2, "0")}`;
    } else {
        return formatDate(dateString);
    }
};

const getTooltipText = (dateString) => {
    return isValidDate(dateString) ? formatDate(dateString) : "日期未設定";
};
const formatDateResponsive = computed(() => (dateString) => {
    const date = new Date(dateString.replace("Z", ""));
    if (mobile.value) {
        return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date
            .getDate()
            .toString()
            .padStart(2, "0")}`;
    } else {
        return formatDate(dateString);
    }
});

function selectModel(uuid) {
    emit("select", uuid);
}

function exportItem(item) {
    emit("export", item);
}

function editItem(item) {
    emit("edit", item);
}

function deleteItem(item) {
    emit("delete", item);
}
</script>

<style scoped>
.model-card {
    transition: all 0.3s ease;
    border: 1px solid #e0e0e0;
    height: 100%;
}

.model-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

.date-info-container {
    margin-top: 8px;
}

.date-card {
    border-radius: 8px;
    transition: all 0.3s ease;
    background-color: transparent !important;
}

.date-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.border-create {
    border: 2px solid #43a047 !important;
}

.border-update {
    border: 2px solid #1e88e5 !important;
}
</style>
