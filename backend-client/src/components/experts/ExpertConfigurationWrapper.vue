<script setup>
const props = defineProps({
    title: { type: String, required: true },
    tooltip: { type: String, required: true },
    className: { type: String, default: '' }
});
</script>

<template>
    <div class="item" :class="className">
        <label class="px-2 mb-1 rounded text-h6 d-flex">
            <span class="mr-2">{{ title }}</span>
            <span class="mdi mdi-help-circle text-grey"></span>
            <v-tooltip activator="parent" location="top">{{ tooltip }}</v-tooltip>
        </label>
        <slot />
    </div>
</template>

<style scoped lang="scss">
.item {
    // background-color: #f3f4f6;
    border-radius: 0.5rem;
    padding: 0.5rem;
    width: 100%;
    min-width: 400px;
    max-width: 1000px;
    margin-bottom: 2rem;
    display: flex;
    align-items: flex-start;

    label {
        width: 30%;
        max-width: 30%;
        overflow: auto;
        margin-right: 1rem;
    }

    &.recommendExpert label,
    &.linkChunkLevel label {
        width: 23%;
    }
}
</style>
