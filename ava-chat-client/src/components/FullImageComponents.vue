<script setup>
import { ref } from "vue";
const props = defineProps({
    src: { type: String, default: "" },
});

const isFull = ref(false);
function showFullImg() {
    isFull.value = true;
}
</script>

<template>
    <div class="image" @click="showFullImg">
        <img :src="src" alt="" />
    </div>
    <transition name="fullImg">
        <div v-if="isFull" class="fullImg" @click="isFull = false">
            <img :src="src" alt="" />
        </div>
    </transition>
</template>

<style lang="scss" scoped>
.image {
    border-radius: 0.7rem;
    overflow: hidden;
    width: 220px;
    height: 150px;
    background-color: white;
    img {
        cursor: pointer;
        width: 220px;
        height: 150px;
        object-fit: contain;
    }
}
.fullImg {
    // transform: translateY(100%);
    // opacity: 0;
    // transition: 0.3s;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100;
    border-radius: 0;
    background-color: black;
    display: flex;
    align-items: center;
    cursor: pointer;
    img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background-color: white;
    }
}

.fullImg-enter-from {
    opacity: 0;
    transform: translateY(100%);
}
.fullImg-enter-active {
    transition: 0.3s;
}
.fullImg-enter-to {
    opacity: 1;
    transform: translateY(0);
}

.fullImg-leave-from {
    opacity: 1;
    transform: translateY(0);
}
.fullImg-leave-active {
    transition: 0.3s;
}
.fullImg-leave-to {
    opacity: 0;
    transform: translateY(100%);
}
</style>
