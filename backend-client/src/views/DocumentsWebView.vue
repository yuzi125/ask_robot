<script setup>
import { ref, onMounted, inject } from "vue";
import { useRouter } from "vue-router";
import { format } from "date-fns";
import ConfirmComponents from "../components/ConfirmComponents.vue";

const emitter = inject("emitter");
const axios = inject("axios");

const router = useRouter();

const props = defineProps({
    datasets_id: { type: String, default: {} },
});

onMounted(() => {
    getDocumentsQA();
});

const crawlerList = ref([]);
async function getDocumentsQA() {
    let rs = await axios.get(`/crawler/${props.datasets_id}/syncWeb`);
    if (rs.data.code === 0) {
        rs = rs.data.data;
        if (rs.length === 0) {
            crawlerList.value = "";
        } else {
            crawlerList.value = rs;
        }
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}
function goAddSource() {
    router.push(`/datasets/${props.datasets_id}/source?active=1`);
}
async function goRouter(id) {
    router.push(`/datasets/${props.datasets_id}/syncweb/${id}`);
}
const confirm_com = ref(null);
const confirmOpen = function (item, is_new) {
    item.is_new = is_new || false;
    confirm_com.value.open(item);
};
async function syncWeb(item) {
    item.loading = true;
    let rs = await axios.post(
        "/crawler/syncWeb",
        JSON.stringify({ crawlerId: item.crawlerId, datasetsId: props.datasets_id, is_new: item.is_new }),
        {
            headers: { "Content-Type": "application/json" },
        }
    );
    item.loading = false;
    getDocumentsQA();
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "同步成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}
</script>

<template>
    <div class="doc_qa_view">
        <div class="pa-6">
            <p class="mb-3 text-h6">網站</p>
            <span style="font-size: 0.9rem; color: #777777">知識庫已同步的網站都在這裡顯示，可查詢已同步的QA</span>
        </div>
        <div class="pa-6">
            <v-btn prepend-icon="fa-solid fa-plus" class="bg-blue" @click="goAddSource">同步網站QA</v-btn>
        </div>
        <div v-if="crawlerList === ''" class="pa-4 text-center mx-6" style="background-color: #dddddd">查無資料</div>
        <div class="syncWeb pa-4">
            <div
                v-for="(item, index) in crawlerList"
                :key="index"
                @click="goRouter(item.id)"
                class="item ma-2 pa-5 rounded-lg d-flex align-center justify-space-between"
                style="border: 1px solid #e6e7e9"
            >
                <div class="mr-10">
                    <p class="mb-3">{{ item.title }}</p>
                    <p class="mb-3" style="font-size: 0.8rem; color: #777777">同步站點: {{ item.domain }}</p>
                    <p style="font-size: 0.8rem; color: #777777">
                        最後同步時間: {{ format(new Date(item.last_time), "yyyy-MM-dd HH:mm:ss") }}
                    </p>
                </div>
                <div class="d-flex flex-column align-end">
                    <!-- <span v-if="item.training_state === 2" class="before-mark" style="--before-mark-color: orange"
                        >同步中</span
                    >
                    <span v-else-if="item.training_state === 3" class="before-mark" style="--before-mark-color: #38c55f"
                        >同步成功</span
                    > -->
                    <v-chip v-if="item.training_state === 1" color="orange" size="small">上傳成功</v-chip>
                    <v-chip v-else-if="item.training_state === 2" color="orange" size="small">同步中</v-chip>
                    <v-chip v-else-if="item.training_state === 3" color="green" size="small">同步成功</v-chip>
                    <div class="d-flex mt-3">
                        <v-btn
                            @click.stop="confirmOpen(item, true)"
                            :loading="item.loading"
                            class="mr-3"
                            color="green-lighten-1"
                            >同步(新)</v-btn
                        >
                        <v-btn @click.stop="confirmOpen(item)" :loading="item.loading" color="green-lighten-1"
                            >同步</v-btn
                        >
                    </div>
                </div>
            </div>
        </div>
        <ConfirmComponents
            ref="confirm_com"
            type="info"
            message="確認要同步站點嗎?"
            :confirmBtn="true"
            @confirm="syncWeb"
            saveBtnName="確認"
            closeBtnName="關閉"
        ></ConfirmComponents>
    </div>
</template>

<style lang="scss" scoped>
.syncWeb {
    display: flex;
    flex: 1 1 500px;
    flex-wrap: wrap;
    .item {
        min-width: 500px;
        width: 500px;
        cursor: pointer;
    }
}
</style>
