<script setup>
import { onMounted, ref } from "vue";
import { inject } from "vue";
import { useLocalStorage } from "@vueuse/core";
import CrawlerTasksTab from "@/components/system/crawler/CrawlerTasksTab.vue";
import CrawlerSettingsTab from "@/components/system/crawler/CrawlerSettingsTab.vue";
import CrawlerTemplateTab from "@/components/system/crawler/CrawlerTemplateTab.vue";
import CrawlerAttachmentSettings from "@/components/system/crawler/CrawlerAttachmentSettings.vue";

const axios = inject("axios");
const emitter = inject("emitter");

// Tab 控制 - 使用 useLocalStorage 記住選項
const currentTab = useLocalStorage("crawler-manager-tab", 0);
const tabs = ["爬蟲任務", "爬蟲站點 (site_config)", "爬蟲模板 (template)", "附件下載設定"];

// 獲取站點列表 (共用資源)
const siteList = ref([]);
const successMessage = ref("");
const errorMessage = ref("");

const getCrawlerSiteList = async () => {
    try {
        const res = await axios.get("/crawlerFastAPI/getCrawlerList");
        siteList.value = res.data.data;
        successMessage.value = "成功獲取站點列表";
    } catch (error) {
        console.error("Error fetching site list:", error);
        errorMessage.value = "獲取站點列表時發生錯誤";
    }
};

onMounted(() => {
    getCrawlerSiteList();
});
</script>

<template>
    <div class="crawler-manager-view">
        <v-container fluid>
            <v-card>
                <v-tabs v-model="currentTab" align-tabs="start" color="primary" show-arrows>
                    <v-tab v-for="(tab, index) in tabs" :key="index" :value="index">
                        {{ tab }}
                    </v-tab>
                </v-tabs>

                <v-window v-model="currentTab">
                    <v-window-item :value="0">
                        <CrawlerTasksTab :site-list="siteList" :axios="axios" :emitter="emitter" />
                    </v-window-item>
                    <v-window-item :value="1">
                        <CrawlerSettingsTab :axios="axios" :emitter="emitter" />
                    </v-window-item>
                    <v-window-item :value="2">
                        <CrawlerTemplateTab />
                    </v-window-item>
                    <v-window-item :value="3">
                        <CrawlerAttachmentSettings />
                    </v-window-item>
                </v-window>
            </v-card>
        </v-container>
    </div>
</template>

<style scoped>
.crawler-manager-view {
    position: fixed;
    left: 0;
    top: 68.5px;
    width: 100%;
    height: calc(100% - 68.5px);
    background-color: #f5f5f5;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 20px;
}

@media (max-width: 960px) {
    .crawler-manager-view {
        padding: 10px;
    }
}

/* 自定義 Tab 樣式 */
:deep(.v-tab) {
    min-width: 200px;
    opacity: 0.7;
}

:deep(.v-tab--selected) {
    opacity: 1;
}

:deep(.v-tabs-bar) {
    padding-left: 16px;
}
</style>
