<script setup>
import { ref, inject, onMounted, computed } from "vue";
import { storeToRefs } from "pinia";
import { useStateStore } from "../store/index";
const emitter = inject("emitter");
const stateStore = useStateStore();
const { showTags, showTagsContainer } = storeToRefs(stateStore);

const isOpen = ref(false);
onMounted(() => {
    emitter.on("openScrollBottom", (boo) => {
        isOpen.value = !boo;
    });
});

const topPosition = computed(() => {
    if (showTagsContainer.value) {
        return showTags.value ? '-4.3rem' : '-2rem';
    }
    return '-2rem';
});

function slideBottom(event) {
    event.preventDefault();
    event.stopPropagation();
    emitter.emit("slideBottom", event);
}
</script>

<template>
    <div class="slide_btn" v-if="isOpen" :style="{ top: topPosition }">
        <span @mousedown="slideBottom"><i class="fa-solid fa-arrow-down"></i></span>
    </div>
</template>

<style lang="scss" scoped>
.slide_btn {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    span {
        margin: 0 auto;
        background-color: var(--secondary-color);
        color: var(--text-color);
        border-radius: 50%;
        border: 1px solid var(--tertiary-color);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 2rem;
        height: 2rem;
        cursor: pointer;
    }
}
</style>
