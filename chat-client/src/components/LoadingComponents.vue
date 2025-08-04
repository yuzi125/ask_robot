<script setup>
import { ref } from "vue";
const test = ref(123);
</script>

<template>
    <div class="loading">
        <img src="../assets/loading.gif" alt="" />
    </div>
</template>

<style lang="scss" scoped>
.loading {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    img {
        width: 50px;
        height: 50px;
    }
}
</style>
