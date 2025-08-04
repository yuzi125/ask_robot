<script setup>
import { ref, watchEffect } from "vue";
import { inject } from "vue";

const axios = inject("axios");
const emitter = inject("emitter");

const db_input = ref("");
const db_output = ref("");
const fields_input = ref([]);

async function updateDB() {
    let rs = await axios.post("/system/db", JSON.stringify({ db_input: db_input.value }));
    if (rs.data.code === 0) {
        db_output.value = rs.data.data;
        emitter.emit("openSnackbar", { message: "成功執行，請查看console", color: "success" });
        console.log(rs.data.data);
    } else {
        db_output.value = rs.data.message;
        emitter.emit("openSnackbar", { message: rs.data.message || "發生錯誤", color: "error" });
        console.log(rs.data.message);
    }
}

async function getAllTable() {
    db_input.value = `SELECT
    table_name,
    column_name,
    data_type
FROM
    information_schema.columns
WHERE
    table_schema = 'public'
ORDER BY
    table_name,
    column_name;`;
}

async function getTableField() {
    db_input.value = `SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'your_table_name'; -- 替换为您要检索的特定表名`;
}

async function getFieldsData() {
    db_input.value = `SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name,
    ix.indexdef as index_definition
FROM
    information_schema.table_constraints tc
LEFT JOIN
    information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN
    pg_indexes ix
    ON tc.table_name = ix.tablename
WHERE
    tc.table_name = 'your_table_name'; -- 替换为您要检索的特定表名`;
}

async function getTableData() {
    db_input.value = `SELECT * FROM your_table_name`;
}

async function getTaskOperations() {
    db_input.value = `SELECT * FROM task_operations WHERE status != 'completed'`;
}

watchEffect(() => {
    let fields = db_input.value.match(/[$]/g);
    fields_input.value = [];
    fields &&
        fields.forEach((item) => {
            fields_input.value.push("");
        });
});
</script>

<template>
    <div class="db_query">
        <div class="add_text pa-4" ref="add_text">
            <v-textarea
                rows="15"
                no-resize
                clearable
                clear-icon="mdi-close-circle"
                append-inner-icon="mdi-arrow-right-thick"
                @click:append-inner="updateDB"
                v-model="db_input"
            ></v-textarea>
        </div>
        <div class="fields">
            <div class="field" v-for="(field, index) in fields_input" :key="index">
                <v-textarea rows="1" clearable clear-icon="mdi-close-circle" v-model="fields_input[index]">
                </v-textarea>
            </div>
        </div>
        <div class="justify-end mx-4 mb-4 d-flex">
            <p>回傳值請查看console =></p>
        </div>
        <div class="flex-wrap d-flex">
            <v-Btn class="ma-4" @click="getAllTable">取得所有表與欄位</v-Btn>
            <v-Btn class="ma-4" @click="getTableField">取得指定表所有欄位</v-Btn>
            <v-Btn class="ma-4" @click="getFieldsData">取得指定表約束、外鍵、索引</v-Btn>
            <v-Btn class="ma-4" @click="getTableData">檢查表資料</v-Btn>
            <v-Btn class="ma-4" @click="getTaskOperations">取得所有爬蟲排程未完成任務</v-Btn>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.db_query {
    .fields {
        display: flex;
        flex-wrap: wrap;

        .field {
            width: 100%;
        }
    }
}
</style>
