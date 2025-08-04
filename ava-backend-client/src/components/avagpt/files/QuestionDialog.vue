<script setup>
import { ref, computed } from "vue";
import { format, formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { getFileIcon, getFileIconColor } from "@/utils/common";

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },
    selectedFile: {
        type: Object,
        default: null,
    },
});

const emit = defineEmits(["update:modelValue", "saved"]);

const getFileTypeColor = (filename) => {
    return getFileIconColor(filename);
};

const getFileTypeIcon = (filename) => {
    return getFileIcon(filename);
};

const formatDateTime = (dateString) => {
    return format(new Date(dateString), "yyyy/MM/dd HH:mm", { locale: zhTW });
};

// 計算屬性
const dialog = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value),
});

const closeDialog = () => {
    dialog.value = false;
};
</script>
<template>
    <!-- 問題詳情 Dialog -->
    <v-dialog v-model="dialog" max-width="800px" scrollable>
        <v-card v-if="selectedFile">
            <v-card-title class="d-flex align-center">
                <v-icon icon="mdi-help-circle" class="me-2" color="info" />
                <span>相關問題</span>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" @click="closeDialog" />
            </v-card-title>

            <v-card-subtitle class="pb-2">
                <div class="d-flex align-center">
                    <v-icon
                        :icon="getFileTypeIcon(selectedFile.filename)"
                        :color="getFileTypeColor(selectedFile.filename)"
                        class="me-2"
                    />
                    <span class="font-weight-medium">{{ selectedFile.filename }}</span>
                </div>
            </v-card-subtitle>

            <v-divider />

            <v-card-text style="max-height: 500px">
                <div v-if="selectedFile.questions && selectedFile.questions.length > 0">
                    <v-card
                        v-for="(question, index) in selectedFile.questions"
                        :key="question.messageId"
                        class="mb-3"
                        variant="outlined"
                    >
                        <v-card-text>
                            <div class="mb-2 d-flex justify-space-between align-start">
                                <v-chip color="primary" variant="tonal" size="small"> 問題 {{ index + 1 }} </v-chip>
                                <div class="text-caption text-grey-darken-1">
                                    {{ formatDateTime(question.createdAt) }}
                                </div>
                            </div>

                            <div class="mb-3 question-text">
                                {{ question.text }}
                            </div>
                        </v-card-text>
                    </v-card>
                </div>
                <div v-else class="py-8 text-center">
                    <v-icon icon="mdi-help-circle-outline" size="64" color="grey-lighten-1" />
                    <div class="mt-2 text-h6 text-grey-darken-1">沒有相關問題</div>
                    <div class="text-body-2 text-grey-darken-2">此文件尚未被使用者提問</div>
                </div>
            </v-card-text>

            <v-divider />

            <v-card-actions>
                <v-spacer />
                <v-btn @click="closeDialog"> 關閉 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
