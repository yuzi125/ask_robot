<script setup>
import { inject, onMounted, ref } from "vue";
const emitter = inject("emitter");

const data = ref([]);

onMounted(() => {
    emitter.on("pushHints", (msg) => {
        data.value = msg;
    });
});

function pushData(data) {
    emitter.emit("pushData", { data: data, type: "text" });
}
</script>

<template>
    <transition name="recommendbox">
        <div class="recommendbox" v-if="data.length">
            <!-- @click="emit('pushData', { data: value, type: 'text' })" -->
            <div class="item" @click="pushData(value)" v-for="value in data" :key="value">
                <p>{{ value }}</p>
            </div>
        </div>
    </transition>
</template>

<style lang="scss" scoped>
.recommendbox {
    display: flex;
    background-color: var(--primary-color);
    padding: 0.5rem 0.5rem;

    .item {
        // background-color: var(--secondary-color);
        // transition: 0.3s;
        background-color: #3c45ff;
        color: white;
        padding: 0.5rem 0.5rem;
        border-radius: 2rem;
        margin: 0 0.2rem;
        cursor: pointer;
        border: none;
        font-size: 1rem;
        // opacity: 0.7;
        display: flex;
        align-items: center;
        &:hover {
            opacity: 1;
        }
    }
}
.recommendbox-enter-from {
    opacity: 0;
}
.recommendbox-enter-active {
    transition: 0.3s;
}
.recommendbox-enter-to {
    opacity: 1;
}
// .recommendbox-leave-from {
//     opacity: 1;
// }
// .recommendbox-leave-active {
//     transition: 0.3s;
// }
// .recommendbox-leave-to {
//     opacity: 0;
// }
</style>
