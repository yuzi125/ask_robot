<template>
    <v-dialog v-model="showDialog" max-width="800px">
        <v-card flat>
            <div class="settings-container">
                <v-card class="mx-auto pa-2" height="600px">
                    <v-list>
                        <v-list-subheader>導覽列</v-list-subheader>

                        <v-list-item
                            v-for="(item, i) in items"
                            :key="i"
                            :active="view == item.view"
                            :value="item"
                            @click="switchView(item)"
                            color="blue"
                            rounded=""
                        >
                            <template v-slot:prepend>
                                <v-icon :icon="item.icon"></v-icon>
                            </template>

                            <v-list-item-title v-text="item.text"></v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-card>
                <v-divider vertical></v-divider>
                <v-card class="right-card" flat>
                    <v-card-title>{{ viewTitle }}</v-card-title>
                    <v-card-text>
                        <component :is="currentView"></component>
                    </v-card-text>
                </v-card>
            </div>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { ref, shallowRef, defineProps, watch, onMounted, toRef, watchEffect } from "vue";

const props = defineProps({
    items: {
        type: Array,
        default: () => [],
    },
    default: {
        type: String,
        default: "",
    },
});
const defaults = toRef(props, "default");
// console.log("props", props);
const items = shallowRef(props.items);
const currentView = shallowRef(null);
const view = ref("");
const showDialog = ref(false);
const viewTitle = ref("");

onMounted(() => {
    if (props.default) {
        const defaultItem = items.value.find((item) => item.view === props.default);
        if (defaultItem) {
            switchView(defaultItem);
        }
    }
});

watchEffect(() => {
    items.value = props.items;
    const defaultItem = items.value.find((item) => item.view === defaults.value);
    if (defaultItem) {
        switchView(defaultItem);
    }
});

const closeDialog = () => {
    showDialog.value = false;
};

const openDialog = () => {
    showDialog.value = true;
};

async function switchView(item) {
    // 動態載入視圖
    view.value = item.view;
    const componentModule = await import(`../views/${item.view}.vue`);
    viewTitle.value = item.title;
    currentView.value = componentModule.default;
}

// const switchOpenDialog = (status = false) => {
//     showDialog.value = status;
// };

function switchOpenDialog(status = false) {
    showDialog.value = status;
}

defineExpose({ openDialog, closeDialog, switchView, switchOpenDialog });
</script>
<style scoped>
.settings-container {
    display: flex;
}

.left-card {
    flex: 1;
    padding: 1rem;
}

.right-card {
    flex: 3;
    padding: 1rem;
}
</style>
