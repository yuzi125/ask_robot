<script setup>
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { usePermissionStore } from "../store/index";
import { storeToRefs } from "pinia";

const permissionStore = usePermissionStore();

const { enableCrawler, userPermission } = storeToRefs(permissionStore);

const route = useRoute();

const systems = ref([
    {
        title: "客戶端設定",
        value: ["Client"],
        items: [
            ["提示詞設定", "mdi-lightbulb-on", "/systemsets/recommends"],
            ["公告設定", "mdi-bullhorn", "/systemsets/bulletin"],
            ["聊天室主題設定", "mdi-palette", "/systemsets/theme"],
            ["聊天室專家排序", "mdi-sort", "/systemsets/expert_sort"],
        ],
    },
    {
        title: "系統設定",
        value: ["System"],
        items: [
            ["聊天室基本設定", "mdi-chat", "/systemsets/chat_settings"],
            ["聊天室進階設定", "mdi-chat-plus", "/systemsets/chat_advance_settings"],
            ["流量設定", "mdi-speedometer", "/systemsets/rate_limit_settings"],
            ["版本號設定", "mdi-alpha-v-circle", "/systemsets/version"],
            ["條約與公告設定", "mdi-bullhorn", "/systemsets/announcements"],
            ["API Key 管理", "mdi-key", "/systemsets/api_key_management"],
            ["模型管理", "mdi-robot", "/systemsets/model_management"],
        ],
    },
    {
        title: "系統監控",
        value: ["Monitor"],
        items: [
            ["系統健康監控", "mdi-server-network", "/systemsets/monitor"],
            ["審計日誌", "mdi-clipboard-text-clock", "/systemsets/audit_log"],
        ],
    },
]);

const crawlerScheduleItem = {
    title: "排程設定",
    value: ["Schedule"],
    items: [
        ["爬蟲排程", "mdi-spider", "/systemsets/crawler_schedule"],
        ["爬蟲附件排程", "mdi-paperclip", "/systemsets/crawler_attachment_schedule"],
    ],
};

const permissionItem = {
    title: "權限設定",
    value: ["Permission"],
    items: [
        ["使用者權限設定", "mdi-account-check-outline", "/systemsets/user-permission"],
        ["群組權限設定", "mdi-account-group", "/systemsets/group-permission"],
    ],
};

const lineBotItem = {
    title: "LINE BOT 設定",
    value: ["LineBot"],
    items: [["Line Bot 設定", "mdi-cellphone", "/systemsets/line_bot_settings"]],
};

const safetySettingItem = ["安全性設定", "mdi-shield-check", "/systemsets/safety_settings"];

const activeItem = computed(() => {
    for (const system of systems.value) {
        for (const [title, icon, link] of system.items) {
            if (link === route.path) {
                return title;
            }
        }
    }
    return "";
});

// 初始化檢查 enableCrawler 狀態
if (enableCrawler?.value) {
    systems.value.push(crawlerScheduleItem); // 如果啟用爬蟲，初始時加上排程設定
}

if (userPermission?.value) {
    systems.value.push(permissionItem);
    systems.value.push(lineBotItem);
    systems.value[1].items.push(safetySettingItem);
}
</script>

<template>
    <div class="systemsets_view">
        <v-card width="250" height="100%">
            <v-list v-model:opened="system.value" v-for="(system, index) in systems" :key="index" nav>
                <v-list-group :value="system.value[0]">
                    <template v-slot:activator="{ props }">
                        <v-list-item v-bind="props" :title="system.title"></v-list-item>
                    </template>
                    <v-list-item
                        :to="link"
                        v-for="([title, icon, link], i) in system.items"
                        :key="i"
                        :title="title"
                        :prepend-icon="icon"
                        :active="title === activeItem"
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
.systemsets_view {
    height: 100%;
    display: flex;

    :deep(.v-card) {
        overflow-y: auto;
    }

    .right_block {
        width: calc(100% - 250px);
        height: 100%;
        overflow: auto;
    }
}
</style>
