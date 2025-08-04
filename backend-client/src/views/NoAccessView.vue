<script setup>
import { useRouter } from "vue-router";
import NoAccess from "@/assets/403.png";

const router = useRouter();

const onAction = () => {
    router.push("/");
};
</script>
<template>
    <v-empty-state :image="NoAccess">
        <template v-slot:headline>
            <div class="mt-2 mb-2 text-h4">403 - 使用者無權限</div>
        </template>

        <template v-slot:text>
            <div class="text-body-2 font-weight-medium text-medium-emphasis">抱歉，您無權訪問此頁面。</div>

            <div class="text-body-2 font-weight-medium text-medium-emphasis">
                這可能是因為您沒有足夠的權限或未獲授權訪問此資源。
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
