<script setup>
import { ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";

const props = defineProps({
    modelItem: {
        type: Object,
        required: true,
    },
    dialog: {
        type: Boolean,
        required: true,
    },
});

const emit = defineEmits(["update:dialog", "export"]);

const localDialog = ref(props.dialog);
const selectedExperts = ref([]);
const displayName = ref("");

const { data: experts } = useQuery({
    queryKey: ["experts"],
});

watch(
    () => props.dialog,
    (newValue) => {
        localDialog.value = newValue;
        if (newValue) {
            // 当对话框打开时，重置表单
            displayName.value = props.modelItem.displayName;
            selectedExperts.value = [];
        }
    }
);

function updateDialog(value) {
    emit("update:dialog", value);
}

function close() {
    updateDialog(false);
}

function exportModel() {
    if (selectedExperts.value.length > 0 && displayName.value) {
        emit("export", {
            expertId: selectedExperts.value.map((expert) => expert.id),
            displayName: displayName.value,
            modelItem: props.modelItem,
        });
        // close();
    }
}
</script>
<template>
    <v-dialog v-model="localDialog" max-width="500px" @update:model-value="updateDialog">
        <v-card>
            <v-card-title class="text-white text-h5 bg-primary"> 匯出模型 </v-card-title>
            <v-card-text class="pt-4">
                <v-alert type="info" variant="tonal" class="mb-4" density="compact">
                    此功能允許您將當前模型的參數匯出至其他專家的模型。請選擇目標專家並設置顯示名稱。
                </v-alert>
                <v-container>
                    <v-row>
                        <v-col cols="12">
                            <v-combobox
                                v-model="selectedExperts"
                                :items="experts"
                                item-title="name"
                                item-value="id"
                                label="專家名稱"
                                multiple
                                chips
                                closable-chips
                                variant="outlined"
                                :rules="[(v) => v.length > 0 || '請選擇至少一位專家']"
                            >
                                <template v-slot:prepend-inner>
                                    <v-icon size="small">mdi-account-multiple</v-icon>
                                </template>
                            </v-combobox>
                        </v-col>
                        <v-col cols="12">
                            <v-text-field
                                v-model="displayName"
                                label="顯示名稱"
                                required
                                variant="outlined"
                                :rules="[(v) => !!v || '請輸入顯示名稱']"
                            >
                                <template v-slot:prepend-inner>
                                    <v-icon size="small">mdi-tag</v-icon>
                                </template>
                            </v-text-field>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text>
            <v-divider></v-divider>
            <v-card-actions class="pa-4">
                <v-spacer></v-spacer>
                <v-btn color="grey" variant="text" @click="close">取消</v-btn>
                <v-btn
                    color="primary"
                    variant="text"
                    @click="exportModel"
                    :disabled="selectedExperts.length === 0 || !displayName"
                >
                    匯出
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
