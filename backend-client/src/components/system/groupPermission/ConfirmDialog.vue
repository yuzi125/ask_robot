<script setup>
const props = defineProps({
    modelValue: Boolean,
    title: String,
    message: String,
});

const emit = defineEmits(["update:modelValue", "confirm"]);
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="400px">
        <v-card rounded="lg">
            <v-card-title class="text-white rounded-t-lg bg-error pa-4">
                <v-icon class="mr-2">mdi-alert</v-icon>
                {{ title }}
            </v-card-title>
            <v-card-text class="pt-5 pa-4">
                {{ message }}
            </v-card-text>
            <v-card-actions class="pt-0 pa-4">
                <v-spacer></v-spacer>
                <v-btn variant="text" color="grey" @click="$emit('update:modelValue', false)">取消</v-btn>
                <v-btn variant="elevated" color="error" @click="$emit('confirm')"> 確定 </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
