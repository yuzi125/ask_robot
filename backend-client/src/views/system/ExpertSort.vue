<script setup>
import { ref, inject, computed, watch } from "vue";
import { useQuery, useMutation } from "@tanstack/vue-query";
import SystemHeader from "@/components/system/SystemHeader.vue";
import { fetchExpertList } from "@/network/service";
import draggable from "vuedraggable";
import robot from "@/assets/robot.png";
import useSaveShortcut from "@/composables/useSaveShortcut";

const axios = inject("axios");
const emitter = inject("emitter");

// 查詢資料
const {
    data: expertData,
    isLoading: isFetching,
    refetch,
} = useQuery({
    queryKey: ["expertList"],
    queryFn: fetchExpertList,
    select: (data) => {
        return data.map((expert) => ({
            id: expert.id,
            name: expert.name,
            sort_order: expert.sort_order || 0,
            avatar: expert.avatar || robot,
        }));
    },
});

// 更新排序的 mutation
const { mutate, isPending: updateMutationPending } = useMutation({
    mutationFn: async (sortData) => {
        return axios.post("/expert/updateExpertSort", {
            experts: sortData.map((expert, index) => ({
                expert_id: expert.id,
                sort_order: index + 1,
            })),
        });
    },
    onSuccess: () => {
        emitter.emit("openSnackbar", {
            color: "success",
            message: "排序更新成功",
        });
        refetch();
    },
    onError: (error) => {
        emitter.emit("showMessage", {
            color: "error",
            message: "排序更新失敗",
        });
        console.error("Update failed:", error);
    },
});

const unorderedExperts = ref([]);
const orderedExperts = ref([]);

// 監聽資料變化
watch(
    expertData,
    (newData) => {
        if (newData) {
            // 分離已排序和未排序的專家
            orderedExperts.value = newData
                .filter((expert) => expert.sort_order > 0)
                .sort((a, b) => a.sort_order - b.sort_order);
            unorderedExperts.value = newData.filter((expert) => !expert.sort_order);
        }
    },
    { immediate: true }
);

// 處理拖拽結束
const handleDragEnd = () => {
    // 只更新已排序列表的順序
    orderedExperts.value = orderedExperts.value.map((expert, index) => ({
        ...expert,
        sort_order: index + 1,
    }));
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
    {
        id: "save",
        text: "儲存設定",
        icon: "mdi-content-save",
        color: "primary",
        loading: updateMutationPending.value,
        disabled: orderedExperts.value.length === 0,
    },
]);

const save = () => {
    mutate(orderedExperts.value);
};

const handleHeaderAction = (actionId) => {
    switch (actionId) {
        case "save":
            // 直接傳送整個已排序列表
            save();
            break;
        case "refresh":
            refetch();
            break;
    }
};

// 設定 ctrl+s 快捷鍵
useSaveShortcut(save);
</script>

<template>
    <div class="settings-container">
        <SystemHeader
            title="聊天室專家排序"
            subtitle="調整聊天室專家排序（按下 Ctrl+S 可以直接儲存）"
            icon="mdi-account-group"
            :actions="headerActions"
            @action="handleHeaderAction"
        />

        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title class="pb-2 text-subtitle-1 font-weight-bold"> 專家排序設定 </v-card-title>
                    <v-card-subtitle class="pb-0"> 調整聊天室專家顯示順序，拖曳調整位置後點選儲存 </v-card-subtitle>
                    <v-card-text>
                        <div class="expert-lists-container">
                            <v-row>
                                <v-col cols="12" md="6">
                                    <div class="list-wrapper">
                                        <div class="mb-3 d-flex align-center">
                                            <v-icon icon="mdi-format-list-bulleted" class="mr-2" color="primary" />
                                            <span class="text-subtitle-2 font-weight-medium">未排序專家</span>
                                        </div>
                                        <v-card variant="outlined" class="expert-list-card">
                                            <draggable
                                                v-model="unorderedExperts"
                                                class="expert-list"
                                                :group="{ name: 'experts' }"
                                                item-key="id"
                                                @end="handleDragEnd"
                                            >
                                                <template #item="{ element }">
                                                    <v-list-item
                                                        :title="element.name"
                                                        class="py-2 cursor-move"
                                                        :ripple="false"
                                                    >
                                                        <template v-slot:prepend>
                                                            <v-avatar size="32" class="mr-3 robot-avatar">
                                                                <v-img :src="element.avatar" />
                                                            </v-avatar>
                                                        </template>
                                                        <template v-slot:append>
                                                            <v-icon icon="mdi-drag" color="grey-darken-1" />
                                                        </template>
                                                    </v-list-item>
                                                </template>
                                            </draggable>
                                        </v-card>
                                    </div>
                                </v-col>

                                <v-col cols="12" md="6">
                                    <div class="list-wrapper">
                                        <div class="mb-3 d-flex align-center">
                                            <v-icon icon="mdi-format-list-numbered" class="mr-2" color="primary" />
                                            <span class="text-subtitle-2 font-weight-medium">已排序專家</span>
                                        </div>
                                        <v-card variant="outlined" class="expert-list-card">
                                            <draggable
                                                v-model="orderedExperts"
                                                class="expert-list"
                                                :group="{ name: 'experts' }"
                                                item-key="id"
                                                @end="handleDragEnd"
                                            >
                                                <template #item="{ element }">
                                                    <v-list-item
                                                        :title="element.name"
                                                        class="py-2 cursor-move"
                                                        :ripple="false"
                                                    >
                                                        <template v-slot:prepend>
                                                            <v-avatar size="32" class="mr-3 robot-avatar">
                                                                <v-img :src="element.avatar" />
                                                            </v-avatar>
                                                        </template>
                                                        <template v-slot:append>
                                                            <v-icon icon="mdi-drag" color="grey-darken-1" />
                                                        </template>
                                                    </v-list-item>
                                                </template>
                                            </draggable>
                                        </v-card>
                                    </div>
                                </v-col>
                            </v-row>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
.settings-container {
    padding: 2em;
}

.expert-list {
    height: calc(100vh - 400px);
    overflow-y: auto;
    background: white;
}

.expert-list-card {
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
}

.cursor-move {
    cursor: move;
}

.robot-avatar {
    border-radius: 50%;
    background-color: #ffffff;
}

/* 拖曳時的視覺效果 */
.sortable-drag {
    opacity: 0.5;
    background: #f5f5f5;
}

.sortable-ghost {
    opacity: 0.3;
    background: #e0e0e0;
}

@media (max-width: 960px) {
    .settings-container {
        padding: 1em;
    }
}
</style>
