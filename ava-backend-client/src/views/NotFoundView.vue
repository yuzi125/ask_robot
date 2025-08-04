<script setup>
import { useRouter } from "vue-router";
import NotFound from "@/assets/404.png";

const router = useRouter();

const onAction = () => {
    router.push("/");
};
</script>

<template>
    <v-empty-state :image="NotFound">
        <template v-slot:headline>
            <div class="mt-2 mb-2 text-h4" data-cy="404-headline">404 - 頁面不存在</div>
        </template>

        <template v-slot:text>
            <div class="text-body-2 font-weight-medium text-medium-emphasis">抱歉，您請求的頁面不存在。</div>

            <div class="text-body-2 font-weight-medium text-medium-emphasis">
                可能是輸入了錯誤的網址，或者該頁面已被移除。
            </div>
        </template>

        <template v-slot:actions>
            <v-spacer></v-spacer>
            <v-btn @click="onAction" color="primary" text> 返回首頁 </v-btn>
            <v-spacer></v-spacer>
        </template>
    </v-empty-state>
</template>

<style scoped>
.fill-height {
    height: 100vh;
}

.v-btn {
    text-transform: none;
}

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
    text-align: center;
    text-justify: inter-word;
}
</style>
