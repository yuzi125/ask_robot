<script setup>
import { defineProps, defineEmits } from "vue";
import emptyStatusNoData from "@/assets/no_data.png";

const props = defineProps({
    canCreateHere: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        default: "尚未同步任何網站",
    },
    description: {
        type: String,
        default: "目前還沒有同步任何網站的資料。同步後的網站資訊將會顯示在這裡，方便您查詢和管理已爬取的內容。",
    },
    actionButtonText: {
        type: String,
        default: "開始同步新網站",
    },
    imageUrl: {
        type: String,
        default: "",
    },
    imageAlt: {
        type: String,
        default: "空數據插圖",
    },
});

const emit = defineEmits(["action"]);

const onAction = () => {
    emit("action");
};
</script>

<template>
    <v-container class="pa-0" fluid>
        <v-row no-gutters align="center" justify="center">
            <v-col cols="12">
                <v-card
                    flat
                    tile
                    class="justify-center px-4 py-12 d-flex flex-column align-center fill-height"
                    color="transparent"
                >
                    <v-img
                        :src="emptyStatusNoData"
                        :alt="imageAlt"
                        contain
                        height="200"
                        width="200"
                        class="mb-8"
                    ></v-img>
                    <h2 class="mb-4 text-center text-h4 font-weight-bold">
                        {{ title }}
                    </h2>
                    <p class="mb-8 text-center text-body-1 description">
                        {{ description }}
                    </p>
                    <v-btn
                        v-if="canCreateHere"
                        color="primary"
                        x-large
                        rounded
                        @click="onAction"
                        class="px-6 mb-4"
                        min-width="200"
                    >
                        {{ actionButtonText }}
                    </v-btn>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.description {
    max-width: 600px;
    width: 100%;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.6;
    color: rgba(0, 0, 0, 0.6);
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    text-align: justify;
    text-justify: inter-word;
    word-break: keep-all;
}

.fill-height {
    padding: 0 !important;
}

.v-btn {
    text-transform: none;
}
</style>
