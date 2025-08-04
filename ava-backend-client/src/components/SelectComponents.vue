<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const { options } = defineProps({
    options: { type: Array, default: [] },
});
const emit = defineEmits(["select"]);


onMounted(() => {
    document.addEventListener("click", handleClick);
});
onUnmounted(() => {
    document.removeEventListener("click", handleClick);
});

function handleClick(event) {
    var myDiv = document.querySelector(".select_com");
    var targetElement = event.target;
    // 檢查點擊事件是否發生在 myDiv 以外
    if (targetElement !== myDiv && !myDiv.contains(targetElement)) {
        isOpenSelect.value = false;
    }
}

const isOpenSelect = ref(false);

const selectOption = ref({});
if(options.length > 0){
    selectOption.value = options[0];
}
async function handleChange(item) {
    if (selectOption.value === item) return;
    selectOption.value = item;
    emit("select",item.value);
}
</script>

<template>
    <div class="select_com" @click="isOpenSelect = isOpenSelect ? false : true">
        <div class="d-flex align-center">
            <span class="mr-2">{{ selectOption.title }}</span>
            <span style="font-size: 0.8rem;"><i class="fa-solid fa-angle-down"></i></span>
        </div>
        <div class="option" :class="{ option_show: isOpenSelect }">
            <div class="item" v-for="(item, index) in options" :key="index" @click="handleChange(item)">
                <span> {{ item.title }} </span>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.select_com {
    padding: 0.5rem 0.5rem;
    border-radius: 0.3rem;
    position: relative;
    cursor: pointer;
    display: inline-block;
    border: 1px solid gray;
    height: 2rem;
    
    .option {
        width: 100%;
        position: absolute;
        top: 2.5rem;
        left: 50%;
        transform: translateX(-50%);
        overflow: hidden;
        border: 1px solid gray;
        background-color: white;
        z-index: 1;
        border-radius: 0.3rem;
        text-wrap: nowrap;
        transition: 0.3s;
        display: none;
        max-height: 200px;
        overflow-y: auto;

        .item {
            cursor: pointer;
            padding: 0.5rem 0.8rem;
            // padding: 0.3rem 0.5rem;
            display: flex;
            align-items: center;
            text-decoration: none;

            &:hover {
                background-color: #eeeeee;
            }
        }
    }

    .option_show {
        display: block;
    }
}
</style>
