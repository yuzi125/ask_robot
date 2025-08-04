<script setup>
import { inject, onMounted, ref, toRefs } from "vue";
const emitter = inject("emitter");

const props = defineProps({
    data: { type: Object, default: {} },
});
const { data } = toRefs(props);
function pushData(item) {
    // emitter.emit("pushExpandableQaData", { data: item, type: "question", time: data.value.time });
    emitter.emit("pushData", { data: item.question, type: "text" });
}
</script>

<template>
    <div class="expandable_qa" v-if="data.length">
        <!-- @click="emit('pushData', { data: value, type: 'text' })" -->
        <div class="title">
            <span><i class="fa-solid fa-layer-group"></i></span>
            <p>與您搜尋的類似</p>
        </div>
        <div class="item" @click="pushData(item)" v-for="(item, index) in data" :key="index">
            <p>{{ item.question }}</p>
            <span><i class="fa-solid fa-plus"></i></span>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.expandable_qa {
    .item {
        display: flex;
        align-items: center;
        border-top: 1px solid var(--secondary-color);
        justify-content: space-between;
        padding: 0.8rem 0;
        cursor: pointer;
        span {
            display: block;
            padding: 0 0.3rem;
        }
    }
    .title {
        font-size: 1.5rem;
        padding: 1rem 0;
        display: flex;
        align-items: center;
        span {
            // font-size: 1rem;
            margin-right: 0.5rem;
        }
    }
}
</style>
