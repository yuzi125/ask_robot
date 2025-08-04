<script setup>
import { ref, inject, computed, watch } from "vue";
import { useQuery, useMutation } from "@tanstack/vue-query";
import SystemHeader from "@/components/system/SystemHeader.vue";
import TextPrison from "@/components/system/TextPrison.vue";
import PopularTags from "@/components/system/PopularTags.vue";

const axios = inject("axios");
const emitter = inject("emitter");

// 狀態管理
const textPrisonWords = ref([]);
const popularTags = ref([]);
const isSaving = ref(false);

// 獲取系統設定
const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["chatAdvancedSettings"],
    queryFn: async () => {
        const response = await axios.get("/system/getChatSettings");
        if (response.data.code !== 0) {
            throw new Error("Failed to fetch chat settings");
        }
        return response.data.data;
    },
});

// 監聽數據變化
watch(
    () => data.value,
    (newData) => {
        if (newData) {
            textPrisonWords.value = newData.text_prison_words || [];
            popularTags.value = newData.popular_tags?.currentIcons || [];
        }
    },
    { immediate: true }
);

// 更新禁用詞
const updateTextPrison = async (newWords) => {
    try {
        const response = await axios.put("/system/updateTextPrison", {
            text_prison_words: newWords,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "禁用詞設定已更新", color: "success" });
            textPrisonWords.value = newWords;
            refetch();
        }
    } catch (error) {
        emitter.emit("openSnackbar", {
            message: error.message || "更新失敗",
            color: "error",
        });
    }
};

// 更新熱門標籤
const updatePopularTags = async (newTags) => {
    try {
        const response = await axios.put("/system/updatePopularTags", {
            popular_tags: newTags,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "熱門標籤設定已更新", color: "success" });
            popularTags.value = newTags;
            refetch();
        }
    } catch (error) {
        emitter.emit("openSnackbar", {
            message: error.message || "更新失敗",
            color: "error",
        });
    }
};

// Header Actions
const headerActions = computed(() => [
    {
        id: "refresh",
        text: "更新資料",
        icon: "mdi-refresh",
        color: "info",
        loading: isFetching.value,
    },
]);

const handleHeaderAction = (actionId) => {
    if (actionId === "refresh") {
        refetch();
    }
};
</script>

<template>
    <div class="settings-container">
        <SystemHeader
            title="聊天室進階設定"
            subtitle="設定聊天室的進階功能"
            icon="mdi-chat-plus"
            :actions="headerActions"
            @action="handleHeaderAction"
        />

        <v-row v-if="isLoading">
            <v-col cols="12" md="6">
                <v-skeleton-loader class="mx-auto" elevation="2" type="paragraph, paragraph" />
            </v-col>
            <v-col cols="12" md="6">
                <v-skeleton-loader class="mx-auto" elevation="2" type="paragraph, paragraph" />
            </v-col>
        </v-row>

        <v-container v-else class="px-0">
            <v-row>
                <!-- 禁用詞設定卡片 -->
                <v-col cols="12" md="12">
                    <v-card elevation="2">
                        <v-card-item>
                            <div class="mb-4 d-flex align-center">
                                <v-icon icon="mdi-message-text-lock" color="primary" size="24" class="mr-2" />
                                <div>
                                    <div class="text-h6">禁用詞設定</div>
                                    <div class="text-subtitle-2 text-grey">設定聊天室的禁用詞條件</div>
                                </div>
                            </div>

                            <TextPrison
                                v-model="textPrisonWords"
                                @update:modelValue="updateTextPrison"
                                scope="global"
                            />
                        </v-card-item>
                    </v-card>
                </v-col>

                <!-- 熱門標籤設定卡片 -->
                <v-col cols="12" md="12">
                    <v-card elevation="2">
                        <v-card-item>
                            <div class="mb-4 d-flex align-center">
                                <v-icon icon="mdi-tag-multiple" color="primary" size="24" class="mr-2" />
                                <div>
                                    <div class="text-h6">熱門標籤設定</div>
                                    <div class="text-subtitle-2 text-grey">設定聊天室的熱門標籤</div>
                                </div>
                            </div>

                            <PopularTags v-model="popularTags" @update:modelValue="updatePopularTags" scope="global" />
                        </v-card-item>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
    </div>
</template>

<style scoped>
.settings-container {
    padding: 2em;
}

@media (max-width: 960px) {
    .settings-container {
        padding: 1em;
    }
}
</style>
