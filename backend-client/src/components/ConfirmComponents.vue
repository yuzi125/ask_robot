<script setup>
/**
 * type
 * success=>成功訊息
 * info=>警告訊息
 * warning=>提示訊息
 * error=>錯誤訊息
 *
 * title 標題
 * message 訊息
 *
 * confirmBtn
 * 是否需要確認按鈕
 * 如果是true 會回傳confirm事件
 *
 * saveBtnName 儲存按鈕名稱
 * closeBtnName 關閉按鈕名稱
 *
 * open時將資料帶入 confirm時將帶出
 */
import { ref, onMounted } from "vue";
const props = defineProps({
    type: { type: String, default: "success" },
    title: { type: String, default: null },
    message: { type: String, default: null },
    confirmBtn: { type: Boolean, default: false },
    saveBtnName: { type: String, default: "Save" },
    closeBtnName: { type: String, default: "Close" },
    dataCy: { type: String, default: null },
});

const emit = defineEmits(["confirm"]);

const types = ref([
    { type: "success", color: "success", icon: "mdi-check-circle-outline", title: "成功" },
    { type: "info", color: "info", icon: "mdi-alert-circle-outline", title: "提示" },
    { type: "warning", color: "warning", icon: "mdi-alert-circle-outline", title: "警告" },
    { type: "error", color: "error", icon: "mdi-close-circle-outline", title: "錯誤" },
    { type: "delete", color: "red", icon: "mdi mdi-delete-circle-outline", title: "警告" },
]);

const typeIndex = ref(0);
onMounted(() => {
    typeIndex.value = types.value.findIndex((f) => f.type === props.type);
});

const dialog = ref(false);
const data = ref({});
const open = function (item) {
    dialog.value = true;
    data.value = item;
};
const confirm = function () {
    dialog.value = false;
    emit("confirm", data.value);
};

defineExpose({ open });
</script>
<!-- warning mdi-help-circle-outline -->

<template>
    <div class="confirm_com">
        <v-dialog v-model="dialog" max-width="500px">
            <v-card elevation="16" :title="title !== null ? title : types[typeIndex].title">
                <v-divider class="mt-2"></v-divider>

                <div class="text-center pa-8">
                    <v-icon
                        class="mb-6"
                        :color="types[typeIndex].color"
                        :icon="types[typeIndex].icon"
                        size="100"
                    ></v-icon>

                    <div class="text-h5 font-weight-bold">{{ message }}</div>
                </div>

                <v-divider></v-divider>

                <v-card-actions>
                    <v-spacer></v-spacer>

                    <v-btn
                        class="px-4 rounded text-none"
                        color="blue-darken-4"
                        rounded="0"
                        variant="outlined"
                        v-bind="props"
                        @click="dialog = false"
                        prepend-icon="mdi-close"
                    >
                        <span class="btn-font-size">{{ closeBtnName }}</span>
                    </v-btn>
                    <v-btn
                        class="px-4 text-white rounded text-none ms-4"
                        color="blue-darken-4"
                        rounded="0"
                        variant="flat"
                        @click="confirm"
                        prepend-icon="mdi-check"
                        :data-cy="dataCy"
                    >
                        <span class="btn-font-size">{{ saveBtnName }}</span>
                    </v-btn>
                    <!-- <v-btn color="blue-darken-1" variant="text" @click="dialog = false" class="font-weight-bold">
                        <span class="btn-font-size">{{ closeBtnName }}</span>
                    </v-btn>
                    <v-btn v-if="confirmBtn" color="blue-darken-1" variant="text" @click="confirm" class="font-weight-bold">
                        <span class="btn-font-size">{{ saveBtnName }}</span>
                    </v-btn> -->
                </v-card-actions>
                <!-- medium-emphasis -->
            </v-card>
        </v-dialog>
    </div>
</template>

<style lang="scss" scoped>
.confirm_com {
}
.btn-font-size {
}
</style>
