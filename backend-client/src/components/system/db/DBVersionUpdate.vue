<script setup>
import { ref, inject, watch, onMounted } from "vue";
import ConfirmComponents from "@/components/ConfirmComponents.vue";
const axios = inject("axios");
const emitter = inject("emitter");

const sql_filenames = ref([]);
const sql_filename = ref("");
const js_filenames = ref([]);
const js_filename = ref({});
const db_js_title = ref([]);
const updateDBV_finish = ref(true);
const updateDBN_finish = ref(true);
const updateDBT_finish = ref(true);

const confirmValue = ref({});
const confirm_com = ref(null);

onMounted(() => {
    getDBList();
    getDBRefactorList();
});

async function getDBRefactorList() {
    let rs = await axios.post("/system/db", JSON.stringify({ db_js_list: true }));
    rs = rs.data.data;
    rs = rs.map((m) => {
        return { title: `${m.filename} ${m.is_used ? "(已使用)" : ""}`, value: m.filename };
    });
    js_filenames.value = rs;
    js_filename.value = rs[0].value;
}

async function getDBList() {
    let rs = await axios.post("/system/db", JSON.stringify({ db_list: true }));
    sql_filenames.value = rs.data.data;
    sql_filename.value = rs.data.data[0];
}

watch(js_filename, (newV) => {
    axios.post("/system/db", JSON.stringify({ db_js_title: newV })).then((rs) => {
        db_js_title.value = rs.data.data;
    });
});

async function updateDBV() {
    updateDBV_finish.value = false;
    let rs = await axios.post("/system/db", JSON.stringify({ db_update: sql_filename.value }));
    updateDBV_finish.value = true;
    console.log(rs.data);
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "成功執行update", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: "發生錯誤", color: "error" });
    }
}

async function updateDBR() {
    updateDBN_finish.value = false;
    let rs = await axios.post("/system/db", JSON.stringify({ db_js: js_filename.value }));
    updateDBN_finish.value = true;
    if (rs.data.code === 0) {
        console.log(rs.data.data);
        emitter.emit("openSnackbar", { message: rs.data.data, color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message || "發生錯誤", color: "error" });
    }
    getDBRefactorList();
}

async function updateDBT() {
    updateDBT_finish.value = false;
    let rs = await axios.post("/system/db", JSON.stringify({ db_trigger: true }));
    updateDBT_finish.value = true;
    if (rs.data.code === 0) {
        console.log(rs.data);
        emitter.emit("openSnackbar", { message: "成功執行trigger", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: "發生錯誤", color: "error" });
    }
}

const confirmOpen = function (item) {
    confirmValue.value = { message: `確認要更新資料庫版本${sql_filename.value}嗎?`, confirm: updateDBV };
    confirm_com.value.open(item);
};

const confirm2Open = function (item) {
    confirmValue.value = { message: `確認執行js需求嗎?`, confirm: updateDBR };
    confirm_com.value.open(item);
};

const confirm1Open = function (item) {
    confirmValue.value = { message: `確認要更新資料庫trigger嗎?`, confirm: updateDBT };
    confirm_com.value.open(item);
};
</script>

<template>
    <div class="db_version_update">
        <v-autocomplete
            class="mx-4 mt-10"
            label="選擇檔案"
            :items="sql_filenames"
            v-model="sql_filename"
        ></v-autocomplete>
        <v-Btn :loading="!updateDBV_finish" class="mx-4 my-2" @click="confirmOpen">更新資料庫版本</v-Btn>

        <v-autocomplete
            class="mx-4 mt-10"
            label="選擇檔案"
            :items="js_filenames"
            v-model="js_filename"
            item-title="title"
            item-value="value"
        ></v-autocomplete>
        <v-card-text>
            <p>功能:</p>
            <br />
            <p v-for="(item, index) in db_js_title" :key="index">{{ item }}</p>
        </v-card-text>
        <v-btn :loading="!updateDBN_finish" class="mx-4 my-2 text-none" @click="confirm2Open"
            >執行{{ js_filename }}
        </v-btn>

        <v-Btn :loading="!updateDBT_finish" class="mx-4 my-10 text-none" @click="confirm1Open">更新資料庫Trigger</v-Btn>

        <ConfirmComponents
            ref="confirm_com"
            type="info"
            :message="confirmValue.message"
            :confirmBtn="true"
            @confirm="confirmValue.confirm"
            saveBtnName="確認"
            closeBtnName="關閉"
        ></ConfirmComponents>
    </div>
</template>

<style lang="scss" scoped>
.db_version_update {
    padding: 20px;
}
</style>
