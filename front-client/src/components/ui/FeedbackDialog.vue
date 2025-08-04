<script setup>
import { ref, computed, watch } from "vue";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { storeToRefs } from "pinia";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStateStore } from "@/store/index";
const stateStore = useStateStore();
const { is_tunnel } = storeToRefs(stateStore);
const props = defineProps({
    item: {
        type: Object,
        required: true,
    },
    feedbackOptions: {
        type: Array,
        required: true,
    },
});

const emit = defineEmits(["feedbackSubmitted", "fetchFeedback"]);

const isDialogOpen = ref(false);
const feedbackType = ref("");
const selectedOptions = ref([]);
const comment = ref("");

watch(feedbackType, (newType, oldType) => {
    if (newType !== oldType) {
        selectedOptions.value = [];
    }
});

const dialogTitle = computed(() => {
    if (props.item.feedback_id) {
        return feedbackType.value === "user_positive" ? "更新正面評價" : "更新負面評價";
    }
    return feedbackType.value === "user_positive" ? "留下正面評價" : "留下負面評價";
});

const filteredOptions = computed(() => {
    return props.feedbackOptions.filter((option) => option.status === feedbackType.value);
});

const positiveIconClass = computed(() => {
    return props.item.feedback_type === "user_positive" ? "fa-solid fa-thumbs-up" : "fa-regular fa-thumbs-up";
});

const negativeIconClass = computed(() => {
    return props.item.feedback_type === "user_negative" ? "fa-solid fa-thumbs-down" : "fa-regular fa-thumbs-down";
});

const positiveButtonClass = computed(() => {
    return {
        "text-gray-500": true,
        "hover:text-blue-500": true,
        "text-blue-500": props.item.feedback_id && props.item.feedback_type === "user_positive",
    };
});

const negativeButtonClass = computed(() => {
    return {
        "text-gray-500": true,
        "hover:text-red-500": true,
        "text-red-500": props.item.feedback_id && props.item.feedback_type === "user_negative",
    };
});

const isSubmitDisabled = computed(() => {
    return selectedOptions.value.length === 0;
});

function openDialog(type) {
    feedbackType.value = type;
    if (props.item.feedback_id) {
        emit("fetchFeedback", props.item.feedback_id, (existingFeedback) => {
            if (existingFeedback) {
                selectedOptions.value =
                    existingFeedback.feedbackOptionsIds.filter((id) => {
                        const option = props.feedbackOptions.find((opt) => opt.id === id);
                        return option && option.status === type;
                    }) || [];
                comment.value = existingFeedback.comment || "";
            } else {
                resetForm();
            }
            isDialogOpen.value = true;
        });
    } else {
        resetForm();
        isDialogOpen.value = true;
    }
}

function closeDialog() {
    isDialogOpen.value = false;
    if (!props.item.feedback_id) {
        resetForm();
    }
}

function handleOptionChange() {
    if (selectedOptions.value.length === 0) {
        comment.value = "";
    }
}

function resetForm() {
    selectedOptions.value = [];
    comment.value = "";
}

function processDatasourceInfo(sourceChunks) {
    let resultData = [];
    // sourceChunks 為chunks來源的最外層包裝
    sourceChunks.forEach((file) => {
        // 第二層為每一個file內的chunks資訊
        file.forEach((chunks) => {
            // chunks為file內一組一組的chunk小組
            chunks.forEach((chunk) => {
                const hasData = resultData.find((e) => e.datasets_id === chunk.metadata.datasets_id);
                if (!hasData) {
                    resultData.push({
                        datasets_id: chunk.metadata.datasets_id,
                        datasource_type: chunk.metadata.datasource_type,
                    });
                }
            });
        });
    });

    return resultData;
    // const uniqueDataSources = new Map();

    // sourceChunks.forEach((bigChunk) => {
    //     bigChunk.forEach((chunk) => {
    //         const datasets_id = chunk.metadata?.datasets_id;
    //         const datasource_type = chunk.metadata?.datasource_type || "A";

    //         if (datasets_id) {
    //             const key = `${datasets_id}-${datasource_type}`;

    //             if (!uniqueDataSources.has(key)) {
    //                 uniqueDataSources.set(key, {
    //                     datasets_id,
    //                     datasource_type,
    //                 });
    //             }
    //         }
    //     });
    // });

    // return Array.from(uniqueDataSources.values());
}

function submitFeedback() {
    if (isSubmitDisabled.value) {
        return; // 如果按鈕被禁用，直接返回
    }

    const sourceChunksRaw = props.item.message[1]?.source_chunk;
    const sourceChunks = Array.isArray(sourceChunksRaw) ? sourceChunksRaw : [];
    const datasourceInfo = sourceChunks.length > 0 ? processDatasourceInfo(sourceChunks) : [];

    const feedbackData = {
        feedbackId: props.item.feedback_id,
        answer: props.item.message[0]?.data ?? "",
        feedbackOptionsIds: selectedOptions.value,
        sourceChunkIds: sourceChunks.map((file) =>
            file.map((chunks) =>
                chunks.map((chunk) => {
                    const newChunk = { ...chunk };
                    delete newChunk.metadata;
                    delete newChunk.content;
                    delete newChunk.score;
                    return newChunk;
                })
            )
        ),
        datasetsIds: datasourceInfo.map((e) => e.datasets_id),
        uploadDocumentsIds: getDocumentsIDs(sourceChunks),
        comment: comment.value,
        feedbackType: feedbackType.value,
        datasourceInfo: datasourceInfo,
        historyMessagesId: props.item.history_message_id,
    };

    // 移除空字符串或未定義的值
    feedbackData.sourceChunkIds = feedbackData.sourceChunkIds.filter(Boolean);
    feedbackData.datasetsIds = feedbackData.datasetsIds.filter(Boolean);
    feedbackData.uploadDocumentsIds = feedbackData.uploadDocumentsIds.filter(Boolean);

    emit("feedbackSubmitted", feedbackData);
    closeDialog();
}

function getDocumentsIDs(sourceChunks) {
    let resultData = [];
    // sourceChunks 為chunks來源的最外層包裝
    sourceChunks.forEach((file) => {
        // 第二層為每一個file內的chunks資訊
        file.forEach((chunks) => {
            // chunks為file內一組一組的chunk小組
            chunks.forEach((chunk) => {
                const hasData = resultData.includes(chunk.metadata.upload_documents_id);
                if (!hasData) {
                    resultData.push(chunk.metadata.upload_documents_id);
                }
            });
        });
    });

    return resultData;
}

//  檢查回答的P標籤內是否含class名稱error；如果包含，前端要把評論按鈕隱藏起來。
function checkNotError(item) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(item.message[0].data, "text/html");

        if (doc.querySelector("p.error")) {
            return false;
        }
        return true;
    } catch (error) {
        console.error("檢查訊息內容有誤", error);
        return false;
    }
}
</script>

<template>
    <div>
        <!-- Thumbs up and down buttons -->
        <TooltipProvider :delayDuration="100">
            <div
                v-if="item.history_message_id && !item.feedback_id && checkNotError(item) && !is_tunnel"
                class="ml-2 space-x-2"
            >
                <Tooltip>
                    <TooltipTrigger>
                        <button
                            @click="openDialog('user_positive')"
                            class="text-gray-500 hover:text-blue-500"
                            :class="positiveButtonClass"
                        >
                            <i :class="positiveIconClass"></i>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>給予正面評價</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <button
                            @click="openDialog('user_negative')"
                            class="text-gray-500 hover:text-red-500"
                            :class="negativeButtonClass"
                        >
                            <i :class="negativeIconClass"></i>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>給予負面評價</p>
                    </TooltipContent>
                </Tooltip>

                <!-- <span v-if="item.feedback_id" class="text-sm text-gray-500">已評論</span> -->
            </div>
        </TooltipProvider>

        <!-- Feedback Dialog -->
        <AlertDialog :open="isDialogOpen" @update:open="isDialogOpen = $event">
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{{ dialogTitle }}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {{ item.feedback_id ? "更新您的評價" : "請選擇評價選項並留下您的意見" }}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div class="grid gap-4">
                    <div class="space-y-2">
                        <Label>評價選項(複選)</Label>
                        <div v-for="option in filteredOptions" :key="option.id" class="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                :id="option.id.toString()"
                                :value="option.id"
                                v-model="selectedOptions"
                                @change="handleOptionChange"
                                class="w-5 h-5 text-blue-600 form-checkbox"
                            />
                            <Label :for="option.id.toString()">{{ option.name }}</Label>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <Label for="comment">詳細評價</Label>
                        <Textarea
                            id="comment"
                            v-model="comment"
                            :disabled="selectedOptions.length === 0"
                            placeholder="請先選擇評價選項，然後在此輸入詳細評價"
                        />
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel @click="closeDialog">取消</AlertDialogCancel>
                    <AlertDialogAction :disabled="isSubmitDisabled" @click="submitFeedback">{{
                        item.feedback_id ? "更新評分" : "完成評分"
                    }}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
</template>
