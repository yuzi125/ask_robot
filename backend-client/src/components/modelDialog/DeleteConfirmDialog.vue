<template>
    <v-dialog v-model="localDialog" max-width="500px" @update:model-value="updateDialog">
        <v-card prepend-icon="mdi-delete" text="一旦刪除模型即無法復原，請確認是否刪除。" title="確定要刪除此模型?">
            <template v-slot:actions>
                <v-spacer></v-spacer>
                <v-btn @click="close">取消</v-btn>
                <v-btn color="error" @click="confirmDelete">刪除</v-btn>
            </template>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from "vue";

const props = defineProps({
    dialog: Boolean,
});

const emit = defineEmits(["update:dialog", "confirm"]);

const localDialog = ref(props.dialog);

watch(
    () => props.dialog,
    (newValue) => {
        localDialog.value = newValue;
    }
);

function updateDialog(value) {
    emit("update:dialog", value);
}

function close() {
    updateDialog(false);
}

function confirmDelete() {
    emit("confirm");
    close();
}
</script>
