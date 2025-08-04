<script setup>
import { ref, toRefs, onMounted, inject } from "vue";
import ConfirmComponents from "../components/ConfirmComponents.vue";
import { useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
const router = useRouter();
const stateStore = useStateStore();
const { datasetsName, datasetsDescribe } = storeToRefs(stateStore);

const props = defineProps({
    datasets_id: { type: String, default: {} },
});

const inputIcon = ref("");
const inputName = ref("");
const inputDescribe = ref("");

const axios = inject("axios");
const { datasets_id } = toRefs(props);

const folder_name = ref("");
async function getDatasetInfo() {
    let rs = await axios.get(`/datasets/datasets?datasets_id=${datasets_id.value}`);
    let data = rs.data.data[0];
    folder_name.value = data.folder_name;
    datasetsName.value = data.name;
    datasetsDescribe.value = data.describe;
    inputIcon.value = data.icon;
    datasets_id.value = data.id;
    inputName.value = data.name;
    inputDescribe.value = data.describe;
}

onMounted(() => {
    getDatasetInfo();
});
const confirm_com = ref(null);
const confirmOpen = function (item, folder_name) {
    confirm_com.value.open({ id: item, folder_name });
};
const deleteDatasetsById = async function (item) {
    console.log("item", item);
    let rs = await axios.delete(`/datasets/deleteDatasetsById/${item.id}/${item.folder_name}`);
    if (rs.data.code === 0) {
        router.push("/datasets");
    }
};
const snackbar = ref(false);

async function save() {
    let rs = await axios.put(
        "/datasets/update",
        JSON.stringify({
            datasets_id: datasets_id.value,
            icon: inputIcon.value,
            name: inputName.value,
            describe: inputDescribe.value,
        })
    );
    if (rs.data.code === 0) {
        snackbar.value = true;
        datasetsName.value = inputName.value;
        datasetsDescribe.value = inputDescribe.value;
    }
}
</script>

<template>
    <div class="datasets_set_com">
        <v-snackbar :timeout="2000" v-model="snackbar"> 已保存 </v-snackbar>
        <div class="title">
            <p>知識庫設定</p>
            <span>在這裡您可以修改知識庫的工作方式以及其他設定</span>
        </div>
        <form class="main" @submit.prevent="save">
            <div class="item">
                <label
                    >知識庫ID
                    <v-tooltip activator="parent" location="top">可以查看該知識庫的ID</v-tooltip>
                </label>
                <input type="text" v-model="datasets_id" disabled />
            </div>
            <div class="item">
                <label
                    >icon圖示
                    <v-tooltip activator="parent" location="top">可設定fontawesome上的icon class</v-tooltip>
                </label>
                <input type="text" v-model="inputIcon" />
            </div>
            <div class="item">
                <label>知識庫名稱</label>
                <input type="text" v-model="inputName" />
            </div>
            <div class="item">
                <label>知識庫描述</label>
                <textarea name="" id="" cols="30" rows="10" v-model="inputDescribe"></textarea>
            </div>

            <div class="item">
                <label>文件夾名稱</label>
                <p>{{ folder_name }} <span>(無法修改)</span></p>
            </div>
            <v-btn class="text-none mr-4" color="blue-darken-4" @click="save">保存</v-btn>

            <v-btn
                class="text-none mf-4"
                color="red-darken-3"
                data-cy="delete-datasets-btn"
                @click="confirmOpen(datasets_id, folder_name)"
                >刪除知識庫</v-btn
            >

            <ConfirmComponents
                ref="confirm_com"
                type="warning"
                message="將不可復原，確認要刪除嗎?"
                :confirmBtn="true"
                @confirm="deleteDatasetsById"
                saveBtnName="確認刪除"
                closeBtnName="關閉"
                data-cy="confirm-delete-datasets-btn"
            ></ConfirmComponents>
        </form>
    </div>
</template>

<style lang="scss" scoped>
.datasets_set_com {
    padding: 1.5rem;
    .title {
        margin-bottom: 1rem;
        p {
            font-size: 1.3rem;
            margin-bottom: 1rem;
        }
        span {
            font-size: 0.9rem;
            color: #777777;
        }
    }
    .main {
        overflow: auto;
        .item {
            display: flex;
            margin: 2rem 0;
            label {
                padding: 0.5rem;
                margin: 0 2rem;
                white-space: nowrap;
                min-width: 8rem;
            }
            input {
                background-color: #f3f4f6;
                border-radius: 0.5rem;
                padding: 0.5rem;
                width: 100%;
                min-width: 250px;
                max-width: 500px;
            }
            textarea {
                background-color: #f3f4f6;
                border-radius: 0.5rem;
                resize: none;
                padding: 0.5rem;
                width: 100%;
                min-width: 250px;
                max-width: 500px;
            }
            p {
                background-color: #f3f4f6;
                border-radius: 0.5rem;
                padding: 0.5rem;
                width: 100%;
                min-width: 250px;
                max-width: 500px;
                span {
                    color: #999999;
                }
            }
           
        }
    }
}
</style>
