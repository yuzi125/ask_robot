<script setup>
import { ref, inject, onMounted, toRefs } from "vue";
import FileComponents from "../components/FileComponents.vue";
const axios = inject("axios");
const props = defineProps({
    datasets_id: { type: String, default: "" },
    documents_id: { type: String, default: "" },
});
const { datasets_id, documents_id } = toRefs(props);
onMounted(() => {
    getDocument();
});
const data = ref({});
async function getDocument() {
    let rs = await axios.get(`/datasets/${datasets_id.value}/documents/${documents_id.value}`);
    if (rs.data.code !== 0) {
        return;
    }
    data.value = { isEnable: rs.data.data.is_enable, filename: rs.data.data.originalname };
}
</script>
<template>
    <div class="document_view">
        <div class="title">
            <router-link :to="`/datasets/${datasets_id}/documents`"><i class="fa-solid fa-arrow-left"></i></router-link>
            <FileComponents :filename="data.filename" :scale="1.3" :bold="true"></FileComponents>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.document_view {
    .title {
        display: flex;
        align-items: center;
        a {
            cursor: pointer;
            border-radius: 50%;
            box-shadow: 0px 3px 5px #e6e7e9;
            border: 1px solid #e6e7e9;
            color: #1c64f2;
            width: 2rem;
            height: 2rem;
            display: block;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            margin-right: 1rem;
            &:after {
                content: "";
                width: 1px;
                height: 1rem;
                background-color: #e6e7e9;
                position: absolute;
                right: -0.7rem;
            }
        }
    }
}
</style>
