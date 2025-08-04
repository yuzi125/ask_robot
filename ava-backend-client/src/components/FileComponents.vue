<script setup>
// import { ref } from "vue";
import { usefileStore } from "../store/index";
import { storeToRefs } from "pinia";
const fileStore = usefileStore();
const { icons } = storeToRefs(fileStore);

const props = defineProps({
    filename: { type: String, default: "", required: true },
    filesize: { type: Number, default: 0, required: false },
    scale: { type: Number, default: 1, required: false },
    bold: { type: Boolean, default: false, required: false },
});

//型別單位提取
function convertType(filename) {
    let arr = filename.split(".");
    return arr[arr.length - 1];
}
//大小單位轉換
function convertSize(size) {
    //大於1024*1024則單位是MB
    let kb = 1024;
    let mb = 1048576;
    if (size > mb) {
        return `${(size / mb).toFixed(2)}MB`;
    } else {
        return `${(size / kb).toFixed(2)}KB`;
    }
}
</script>

<template>
    <div class="file_com">
        <template v-for="item in icons" :key="item">
            <span
                class="file_icon"
                :style="{ color: item.color, fontSize: `calc(1.1rem * ${scale})` }"
                v-if="convertType(filename) === item.type"
            >
                <i :class="item.icon"></i>
            </span>
        </template>
        <p class="file_name" :class="{ bold: bold }" :style="{ fontSize: `calc(0.9rem * ${scale})` }">
            {{ filename }}
        </p>
        <p v-if="filesize" class="file_size">{{ convertSize(filesize) }}</p>
    </div>
</template>

<style lang="scss" scoped>
.file_com {
    display: flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    padding: 0.3rem 0;

    .file_icon {
        flex: 0 0 auto;
        margin: 0 0.3rem;
        display: block;
        font-size: 1.1rem;
    }

    .file_name {
        flex: 1;
        min-width: 0;
        margin: 0 0.3rem;
        font-size: 0.9rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
    }

    .bold {
        font-weight: bold;
    }

    .file_size {
        flex: 0 0 auto;
        margin: 0 0.3rem;
        font-size: 0.7rem;
        color: gray;
        white-space: nowrap;
    }
}
</style>
