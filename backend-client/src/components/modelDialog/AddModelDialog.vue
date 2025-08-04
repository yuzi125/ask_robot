<template>
    <v-dialog v-model="localDialog" max-width="500px" @update:model-value="updateDialog">
        <v-card>
            <v-card-title>新增模型</v-card-title>
            <v-card-text>
                <v-select v-model="model.name" :items="modelOptions" label="模型名稱"></v-select>
                <v-text-field v-model="model.displayName" label="顯示名稱"></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="blue darken-1" text @click="close">取消</v-btn>
                <v-btn color="blue darken-1" text @click="add">新增</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from "vue";

const props = defineProps({
    dialog: Boolean,
    modelOptions: Array,
});

const emit = defineEmits(["update:dialog", "add"]);

const localDialog = ref(props.dialog);
const model = ref({ name: "", displayName: "" });

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

function add() {
    emit("add", model.value);
    close();
}
</script>
