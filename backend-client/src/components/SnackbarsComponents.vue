<script setup>
/**
 * success=>成功訊息
 * info=>警告訊息
 * warning=>提示訊息
 * error=>錯誤訊息
 */
import { ref } from "vue";

// const props = defineProps({
//     data: { type: Object, default: {} },
// });
// const emit = defineEmits([""]);

// const snackbar = ref({ show: false, message: "", color: "" });
const snackbars = ref([]);

const create = function (item) {
    //只留一個
    snackbars.value.forEach((f) => (f.theone = false));
    item.theone = true;
    //以上暫時無解決
    snackbars.value.push(item);
    snackbars.value = snackbars.value.filter((item) => item.show);
};
defineExpose({ create });
</script>

<template>
    <div class="snackbars_box">
        <div v-for="(item, index) in snackbars" :key="index" class="item">
            <v-snackbar :timeout="2000" v-model="item.show" :color="item.color" v-if="item.theone">
                {{ item.message }}
                <template v-slot:actions>
                    <v-btn icon="mdi-close" @click="item.show = false"> </v-btn>
                </template>
            </v-snackbar>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.snackbars_box {
    // overflow: hidden;
    // position: fixed;
    // left: 0;
    // top: 0;
    // background-color: red;
    // width: 10%;
    // height: 100%;
}
</style>
