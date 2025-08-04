<script setup>
import { ref, inject } from "vue";
const axios = inject("axios");

const items = ref([
    {
        title: "使用者聊天",
        value: ["UserMessages"],
        items: [],
    },
]);

axios.get("/usermanage/userType").then((rs) => {
    rs = rs.data.data;
    rs.forEach((item) => {
        items.value[0].items.push([
            item.type_name,
            "mdi-message-processing",
            `/usermanageold/messages/${item.type_value}`,
        ]);
    });
});
</script>

<template>
    <div class="user_manage_view">
        <v-card width="300" height="100%">
            <v-list v-model:opened="item.value" v-for="(item, index) in items" :key="index" nav>
                <v-list-group :value="item.value[0]">
                    <template v-slot:activator="{ props }">
                        <v-list-item v-bind="props" :title="item.title"></v-list-item>
                    </template>
                    <v-list-item
                        :to="link"
                        v-for="([title, icon, link], i) in item.items"
                        :key="i"
                        :title="title"
                        :prepend-icon="icon"
                        :value="title"
                    >
                    </v-list-item>
                </v-list-group>
            </v-list>
        </v-card>
        <div class="right_block">
            <router-view></router-view>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.user_manage_view {
    height: 100%;
    display: flex;

    .right_block {
        width: 100%;
        overflow: auto;
    }
}
</style>
