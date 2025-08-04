<script setup>
import { ref, toRefs, watchEffect, inject, watch, onMounted } from "vue";
import InputComponents from "../components/InputComponents.vue";
import ConfirmComponents from "../components/ConfirmComponents.vue";
import MarkdownEditorPreview from "@/components/experts/markdown/MarkdownEditorPreview.vue";
import PopularTags from "@/components/system/PopularTags.vue";
import { useRoute, useRouter } from "vue-router";
import { marked } from "marked";
const axios = inject("axios");
const emitter = inject("emitter");
const route = useRoute();
const router = useRouter();

const props = defineProps({
    data: { type: Object, default: {} },
    refetchExpertData: { type: Function },
});
const { data } = toRefs(props, "data");
const id = ref({});
const name = ref({});
const avatar = ref({});
const url = ref({});
const welcome = ref({});
const renderedWelcome = ref("");
const sourceChunkMode = ref({});

const sourceDisplayOptions = [
    { text: "完整", attr: "full" },
    { text: "簡易", attr: "simple" },
];

watchEffect(() => {
    id.value = { text: data.value.id, attr: "id" };
    name.value = { text: data.value.name, attr: "name" };
    avatar.value = { text: data.value.avatar, attr: "avatar" };
    url.value = { text: data.value.url, attr: "url" };
    welcome.value = { text: data.value.welcome, attr: "welcome" };
    sourceChunkMode.value = {
        text: data.value.source_chunk_mode || "full",
        attr: "source_chunk_mode",
    };
});

watchEffect(() => {
    renderedWelcome.value = marked(welcome.value.text || "");
});

async function updateExpert(item) {
    const { attr, text } = item;
    const obj = {};
    obj[attr] = text;
    obj["id"] = data.value.id;
    let rs = await axios.put("/expert/expert", JSON.stringify(obj));
    if (rs.data.code === 0) {
        data.value[attr] = text;
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
        props.refetchExpertData();
    }
}

const delExpert = async function (item) {
    let rs = await axios.delete(`/expert/expert/${item.expert_id}`);
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "刪除成功", color: "success" });
        router.replace("/experts");
    }
};
const confirm_com = ref(null);
const confirmOpen = function (item) {
    confirm_com.value.open(item);
};

const popularTags = ref([]);

const getPopularTagsIconList = async function () {
    let rs = await axios.get(`/expert/getPopularTagsIconList?expert_id=${data.value.id}`);
    popularTags.value = rs.data.data;
}

watch(() => data.value.id, (newId) => {
    if (newId) {
        getPopularTagsIconList();
    }
});

const updateSetting = async function (endpoint, data, successMessage) {
    let rs = await axios.put(endpoint, data);
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: successMessage, color: "success" });
    }
};
// 更新專家-熱門標籤
const updatePopularTags = async function (newTags) {
    await updateSetting("/expert/updatePopularTags", { popular_tags: newTags, expert_id: data.value.id }, "熱門標籤設定已更新");
    popularTags.value = newTags;
};

onMounted(() => {
    getPopularTagsIconList();
});
</script>

<template>
    <div class="expertset_view">
        <div class="list">
            <label class="mb-1 text-h6 d-flex">專家ID</label>
            <InputComponents :data="id" @send="updateExpert" :disabled="true"></InputComponents>
            <label class="mb-1 text-h6 d-flex">專家名稱</label>
            <InputComponents :data="name" @send="updateExpert"></InputComponents>
            <label class="mb-1 text-h6 d-flex">頭像</label>
            <InputComponents :data="avatar" @send="updateExpert"></InputComponents>
            <label class="mb-1 text-h6 d-flex">專家網址(url)</label>
            <InputComponents :data="url" @send="updateExpert"></InputComponents>
            <label class="mb-1 text-h6 d-flex">參考來源顯示方式</label>
            <v-select
                v-model="sourceChunkMode.text"
                :items="sourceDisplayOptions"
                item-title="text"
                item-value="attr"
                @update:modelValue="updateExpert(sourceChunkMode)"
            ></v-select>
            <!-- 新增熱門標籤組件 -->
            <PopularTags v-model="popularTags" @update:modelValue="updatePopularTags" scope="expert" :expert_id="data.value ? data.value.id : null"/>
            <label class="mb-1 text-h6 d-flex">歡迎詞</label>

            <v-container fluid class="pa-0 main-container">
                <v-row no-gutters class="fill-height">
                    <v-col cols="12" md="6" class="pr-md-2 d-flex flex-column">
                        <InputComponents
                            :data="welcome"
                            @send="updateExpert"
                            multiline
                            :preview="true"
                        ></InputComponents>
                    </v-col>
                    <v-col cols="12" md="6" class="pl-md-2">
                        <MarkdownEditorPreview v-model="welcome.text" :avatar="avatar" />
                    </v-col>
                </v-row>
            </v-container>

            <v-btn class="text-none mf-4" color="red-darken-3" @click="confirmOpen(route.params)">刪除專家 </v-btn>
            <ConfirmComponents
                ref="confirm_com"
                type="warning"
                message="將不可復原，確認要刪除嗎?"
                :confirmBtn="true"
                @confirm="delExpert"
                saveBtnName="確認刪除"
                closeBtnName="關閉"
            ></ConfirmComponents>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.expertset_view {
    // border-left: 1px solid #e5e7eb;
    padding: 2rem;
    width: 100%;
    height: 100%;

    .list {
        min-width: 500px;
        max-width: 800px;
        label {
            display: flex;
            // font-size: 1.2rem;
            // margin-bottom: 1rem;
        }
    }
}
@media (max-width: 960px) {
    .v-col-md-6 {
        padding-right: 0 !important;
        padding-left: 0 !important;
    }
}

.main-container {
    height: 100%; /* 或設置一個固定高度，如 600px */
}

.fill-height {
    height: 100%;
}
</style>
