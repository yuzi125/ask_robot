<script setup>
import { ref, inject, onMounted, computed, watch } from "vue";

import InputComponents from "../components/InputComponents.vue";
import ConfirmComponents from "../components/ConfirmComponents.vue";
import SystemHeader from "@/components/system/SystemHeader.vue";

const axios = inject("axios");
const emitter = inject("emitter");

onMounted(() => {
    init();
    getExperts();
});

// 提示詞清單
const recommendList = ref([]);
const init = async function () {
    let rs = await axios.get("/clientsets/recommend");
    if (rs.data.code === 0) {
        recommendList.value = rs.data.data.sort((a, b) => {
            return b.id - a.id;
        });
    }
};

// 專家清單
const expertList = ref([]);
const expert_id = ref("");
async function getExperts() {
    let rs = await axios.get("/expert/expert");
    expertList.value = rs.data.data;
}
const selectExpert = function (expert) {
    expert_id.value = expert.id;
};
const expertRecommendList = computed(() => {
    return recommendList.value.filter((f) => f.expert_id === expert_id.value);
});

// 新增提示詞
const add_text = ref(null);
const add_input = ref("");
const toggleInput = function () {
    add_text.value.classList.toggle("open_add_text");
};
watch(expert_id, () => {
    add_text.value.classList.remove("open_add_text");
    add_input.value = "";
});
const insertRecommend = async function () {
    if (!add_input.value.trim()) {
        emitter.emit("openSnackbar", { message: "不能為空", color: "warning" });
        return;
    }
    let rs = await axios.post("/clientsets/recommend", { text: add_input.value, expert_id: expert_id.value });
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "新增成功", color: "success" });
        toggleInput();
        add_input.value = "";
        recommendList.value.unshift(rs.data.data);
    }
};

// 更新提示詞
const updateRecommend = async function (item) {
    const { id, text } = item;
    let rs = await axios.put("/clientsets/recommend", { id, text });
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    }
};

// 刪除提示詞
const delRecommend = async function (item) {
    let rs = await axios.delete(`/clientsets/recommend/${item.id}`);
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "刪除成功", color: "success" });
    }
    const index = recommendList.value.findIndex((f) => f.id === item.id);
    if (index !== -1) {
        recommendList.value.splice(index, 1);
    }
};

// 確認刪除
const confirm_com = ref(null);
const confirmOpen = function (item) {
    confirm_com.value.open(item);
};
</script>

<template>
    <div class="recommend_view">
        <SystemHeader title="專家提示詞設定" subtitle="新增、編輯與刪除專家提示詞" icon="mdi-lightbulb-on" />
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title class="pb-2 text-subtitle-1 font-weight-bold"> 提示詞設定 </v-card-title>
                    <v-card-subtitle class="pb-0"> 選擇專家，設定提示詞 </v-card-subtitle>
                    <v-card-text>
                        <v-row>
                            <v-col cols="12" md="6">
                                <div class="mb-3 d-flex align-center">
                                    <v-icon icon="mdi-account-group" class="mr-2" color="primary" />
                                    <span class="text-subtitle-2 font-weight-medium">專家清單</span>
                                </div>
                                <v-card variant="outlined">
                                    <v-list class="list-wrapper">
                                        <v-list-item
                                            v-for="(expert, i) in expertList"
                                            :key="i"
                                            :value="expert"
                                            color="primary"
                                            @click="selectExpert(expert)"
                                        >
                                            <template v-slot:prepend>
                                                <v-avatar size="32" class="mr-3">
                                                    <v-img :src="expert.avatar" />
                                                </v-avatar>
                                            </template>
                                            <v-list-item-title v-text="expert.name"></v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-card>
                            </v-col>

                            <v-col cols="12" md="6">
                                <div class="mb-3 position-relative d-flex align-center">
                                    <v-icon icon="mdi-format-list-numbered" class="mr-2" color="primary" />
                                    <span class="text-subtitle-2 font-weight-medium">提示詞清單</span>
                                    <v-btn
                                        class="bottom-0 right-0 position-absolute"
                                        append-icon="fa-solid fa-plus"
                                        @click="toggleInput"
                                        :disabled="!expert_id"
                                    >
                                        新增提示詞
                                    </v-btn>
                                </div>
                                <v-card variant="outlined">
                                    <div class="list-wrapper">
                                        <div class="add_text ma-3" ref="add_text">
                                            <v-textarea
                                                rows="2"
                                                variant="underlined"
                                                no-resize
                                                clearable
                                                clear-icon="mdi-close-circle"
                                                append-inner-icon="mdi-arrow-right-thick"
                                                @click:append-inner="insertRecommend"
                                                v-model="add_input"
                                                placeholder="請輸入提示詞"
                                            ></v-textarea>
                                        </div>
                                        <div class="ma-3" v-for="(item, index) in expertRecommendList" :key="index">
                                            <InputComponents
                                                :data="item"
                                                :variant="'underlined'"
                                                :rows="2"
                                                @send="updateRecommend"
                                                @del="confirmOpen"
                                                :btnDel="true"
                                                multiline
                                            ></InputComponents>
                                        </div>
                                        <div class="justify-center d-flex">
                                            <p v-if="!expert_id">請先選擇專家</p>
                                            <p v-else-if="expert_id && expertRecommendList.length === 0">
                                                尚未設定任何提示詞
                                            </p>
                                        </div>
                                    </div>
                                </v-card>
                            </v-col>
                        </v-row>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
        <ConfirmComponents
            ref="confirm_com"
            type="info"
            message="將不可復原，確認要刪除嗎?"
            :confirmBtn="true"
            @confirm="delRecommend"
            saveBtnName="確認"
            closeBtnName="關閉"
        ></ConfirmComponents>
    </div>
</template>

<style lang="scss" scoped>
.recommend_view {
    padding: 2rem;
    width: 100%;
    height: 100%;

    .add_text {
        width: calc(100% - 2rem);
        height: 0;
        transition: 0.3s;
        overflow: hidden;
    }
    .open_add_text {
        height: 95px;
    }
}

.list-wrapper {
    min-height: 300px;
    height: calc(100vh - 400px);
    max-height: 600px;
    overflow-y: auto;
}
</style>
