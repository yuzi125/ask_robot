<script setup>
import { ref, inject, computed } from "vue";
import ConfirmComponents from "@/components/ConfirmComponents.vue";

const axios = inject("axios");
const emitter = inject("emitter");

const refactor_list = ref([]);
const refactor_value = ref("");
const refactorTableSelectedModels = ref([]);
const refactortable_finish = ref(true);
const search = ref("");

const props = defineProps({
    initialTableModels: {
        type: Array,
        default: () => [],
    },
});

// 當接收到初始模型列表時，設置到本地的 refactor_list
const fetchTableModelList = async () => {
    if (props.initialTableModels && props.initialTableModels.length > 0) {
        refactor_list.value = [...props.initialTableModels];
    } else {
        await getTableModelList();
    }
};

// 取得資料表模型列表
async function getTableModelList() {
    try {
        let rs = await axios.post("/system/db", JSON.stringify({ db_refactor_list: true }));
        refactor_list.value = rs.data.data;
        refactor_list.value.unshift("all-table");
        refactor_value.value = rs.data.data[0];
    } catch (error) {
        console.error("無法獲取資料表模型列表:", error);
        emitter.emit("openSnackbar", { message: "無法獲取資料表模型列表", color: "error" });
    }
}

// 強制刪除並重建資料表
const deleteAndCreateTable = async () => {
    refactortable_finish.value = false;
    try {
        const rs = await axios.post("/system/db", JSON.stringify({ db_refactor: refactorTableSelectedModels.value }));
        if (rs.data.code === 0) {
            emitter.emit("openSnackbar", { message: "重建成功", color: "success" });
        }
    } catch (error) {
        console.error("Error rebuilding tables:", error);
        emitter.emit("openSnackbar", { message: "重建失敗", color: "error" });
    } finally {
        refactortable_finish.value = true;
    }
};

// 過濾資料表列表
const filteredRefactorList = computed(() => {
    const filteredList = refactor_list.value.filter((item) => item !== "all-table");

    if (!search.value) return filteredList;

    return filteredList.filter((item) => item.toLowerCase().includes(search.value.toString().toLowerCase()));
});

function onClear() {
    search.value = "";
}

// 確認相關
const confirmValue = ref({});
const confirm_com = ref(null);

const confirmDeleteAndCreate = function () {
    confirmValue.value = {
        message: `確認強制刪除資料表並重建model?`,
        confirm: deleteAndCreateTable,
    };
    confirm_com.value.open();
};

// 生命週期
fetchTableModelList();
</script>

<template>
    <div class="refactor-table-component">
        <v-combobox
            v-model="refactorTableSelectedModels"
            :items="refactor_list"
            label="選擇model"
            multiple
            chips
            closable-chips
            class="mx-4 mt-10"
            hint="如果選擇 all-table 的話，就只會以 all-table 為主。"
            persistent-hint
        >
            <template v-slot:prepend-item>
                <v-list-item>
                    <v-text-field
                        v-model="search"
                        label="搜尋資料表名稱"
                        hide-details
                        clearable
                        @click:clear="onClear"
                    ></v-text-field>
                </v-list-item>
                <v-divider class="mt-2"></v-divider>
            </template>
        </v-combobox>

        <v-btn
            :loading="!refactortable_finish"
            class="mx-4 my-2 text-none"
            @click="confirmDeleteAndCreate"
            :disabled="refactorTableSelectedModels.length === 0"
        >
            強制刪除資料表並重建Model
        </v-btn>

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
.refactor-table-component {
    margin-bottom: 20px;
}
</style>
