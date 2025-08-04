<script setup>
import { ref, inject } from "vue";

const axios = inject("axios");
const emitter = inject("emitter");

const vector_input = ref("");
const vector_output = ref("");
const expertList = ref([]);
const isExpertListLoading = ref(false);

const stressTestData = ref({
    expert: null,
    concurrent: 5,
    duration: 30,
});

const vectorSearchData = ref({
    query: "",
    expert: null,
});

const word2vectorData = ref({
    word: "",
    embedding_model: "text-embedding-3-large",
});

async function getExpertList() {
    isExpertListLoading.value = true;
    let rs = await axios.get("/expert/expert");
    expertList.value = rs.data.data;
    isExpertListLoading.value = false;
}

async function stressTest() {
    let rs = await axios.post("/stressTest", JSON.stringify(stressTestData.value));
    console.log(rs.data);
}

async function vectorSearch() {
    let rs = await axios.post("/vectorSearch", {
        query: vectorSearchData.value.query,
        expert_id: vectorSearchData.value.expert.id,
    });
    console.log(rs.data);
}

async function word2vector() {
    let rs = await axios.post("/word2vector", JSON.stringify(word2vectorData.value));
    console.log(rs.data);
}

async function updateVectorDB() {
    let rs = await axios.post("/vectorDB/query", JSON.stringify({ vector_input: vector_input.value }));
    if (rs.data.code === 0) {
        vector_output.value = rs.data.data;
        emitter.emit("openSnackbar", { message: "成功執行，請查看console", color: "success" });
        console.log(rs.data.data);
    } else {
        vector_output.value = rs.data.message;
        emitter.emit("openSnackbar", { message: rs.data.message || "發生錯誤", color: "error" });
        console.log(rs.data.message);
    }
}

// 初始化專家列表
getExpertList();
</script>

<template>
    <div class="vector_operations">
        <v-sheet rounded="lg" elevation="4" class="pa-4">
            <h2 class="mb-4 text-h5 font-weight-bold">向量資料庫操作</h2>

            <div class="add_text pa-4">
                <v-textarea
                    rows="15"
                    no-resize
                    clearable
                    clear-icon="mdi-close-circle"
                    append-inner-icon="mdi-arrow-right-thick"
                    @click:append-inner="updateVectorDB"
                    v-model="vector_input"
                ></v-textarea>
            </div>

            <v-divider class="my-4"></v-divider>

            <h3 class="mb-4 text-h6">壓力測試</h3>
            <v-combobox
                v-model="stressTestData.expert"
                :items="expertList"
                item-title="name"
                item-value="id"
                label="選擇專家"
                chips
                outlined
                dense
                return-object
                hide-details
                :loading="isExpertListLoading"
            ></v-combobox>
            <v-text-field class="my-4" v-model="stressTestData.concurrent" label="concurrent"></v-text-field>
            <v-text-field class="my-4" v-model="stressTestData.duration" label="duration"></v-text-field>
            <v-btn @click="stressTest" color="primary">執行壓力測試</v-btn>

            <v-divider class="my-4"></v-divider>

            <h3 class="mb-4 text-h6">向量搜尋</h3>
            <v-combobox
                v-model="vectorSearchData.expert"
                :items="expertList"
                item-title="name"
                item-value="id"
                label="選擇專家"
                chips
                outlined
                dense
                return-object
                hide-details
                :loading="isExpertListLoading"
            ></v-combobox>
            <v-text-field class="my-4" v-model="vectorSearchData.query" label="query"></v-text-field>
            <v-btn @click="vectorSearch" color="primary">執行向量搜尋</v-btn>

            <v-divider class="my-4"></v-divider>

            <h3 class="mb-4 text-h6">向量轉換</h3>
            <v-text-field class="my-4" v-model="word2vectorData.word" label="word"></v-text-field>
            <v-text-field class="my-4" v-model="word2vectorData.embedding_model" label="embedding_model"></v-text-field>
            <v-btn @click="word2vector" color="primary">執行向量轉換</v-btn>
        </v-sheet>
    </div>
</template>

<style lang="scss" scoped>
.vector_operations {
    padding: 20px;
}
</style>
