<script setup>
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ref, computed, inject, nextTick, watch } from "vue";
import { FileText, Earth, Link } from "lucide-vue-next";
import { marked } from "marked";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { UseWindowSize } from "@vueuse/components";
import { storeToRefs } from "pinia";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
    DialogContent,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { useSettingsStore } from "@/store";

const { toast } = useToast();

const emitter = inject("emitter");

const currentFullUrl = window.location.href;
const urlObj = new URL(currentFullUrl);
const domain = urlObj.origin;

const settingsStore = useSettingsStore();
const { show_dataset_name } = storeToRefs(settingsStore);

const props = defineProps({
    data: { type: Array, default: () => [[]] },
    sourceChunkMode: { type: String, default: "full" },
});

const sourceData = computed(() => {
    return props.data.map((chunkGroup) => {
        // 確保 chunkGroup 是一個陣列
        const chunks = Array.isArray(chunkGroup) ? chunkGroup : [chunkGroup];
        return {
            chunks: chunks,
            metadata: chunks[0]?.metadata || {},
        };
    });
});

const dialogContent = ref({
    chunks: [],
    metadata: null,
});

const showMarkdown = ref(true);
const targetRef = ref(null);

// Process content (remove HTML tags and handle Markdown image links)
const processContent = (text) => {
    let processed = text.replace(/<[^>]*>/g, "");
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
        return `![${alt}](${url.replace(/\s+/g, "")})`;
    });
    return processed.replace(/\\n/g, "\n");
};

const parseMarkdown = (text) => {
    try {
        // 設定 marked 的選項，不支援刪除線
        const renderer = new marked.Renderer();
        renderer.del = (text) => `~~${text}~~`;

        // 使用自訂 renderer 解析 Markdown
        let html = marked(text, { renderer });

        return html;
    } catch (error) {
        console.error("Error parsing Markdown:", error);
        return text; // 若解析失敗，返回原始文本
    }
};

// Toggle Markdown display
const toggleMarkdown = () => {
    showMarkdown.value = !showMarkdown.value;
};

// Remove HTML tags
const removeHtmlTags = (text) => {
    return text?.replace(/<[^>]*>/g, "")?.replace(/\\n/g, "\n");
};

const scrollToTarget = () => {
    if (targetRef.value) {
        const rect = targetRef.value.getBoundingClientRect();
        if (rect.top !== 0 && rect.left !== 0) {
            targetRef.value.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            setTimeout(scrollToTarget, 100);
        }
    } else {
        setTimeout(scrollToTarget, 100);
    }
};

// 更新 handleCardClick 函數
const handleCardClick = async (chunkGroup) => {
    const metadata = chunkGroup.chunks[0][0]?.metadata;

    const title = metadata?.datasource_url
        ? metadata.datasource_name
        : metadata?.originalname?.replace(/\..*/, "") || "Untitled";

    // 將檔案內的chunks組成同一個陣列，中間間隔插入間隔物件資料
    const chunks = [];
    chunkGroup.chunks.forEach((chunkGroup, index) => {
        if (index === 0) {
            chunks.push(...chunkGroup);
        } else {
            chunks.push({ hasChunkGap: true });
            chunks.push(...chunkGroup);
        }
    });
    // 確保 chunks 是一個陣列
    const processedChunks = chunks.map((chunk) => {
        if (chunk.hasChunkGap) {
            return {
                ...chunk,
                processedContentPlainText: "...",
                processedContentMarkdown: "...",
            };
        } else {
            const processedContentPlainText = processContent(chunk.content);
            const processedContentMarkdown = parseMarkdown(processedContentPlainText);
            return {
                ...chunk,
                processedContentPlainText,
                processedContentMarkdown,
            };
        }
    });

    dialogContent.value = {
        chunks: processedChunks,
        metadata: metadata,
        title: title,
    };

    nextTick(() => {
        setTimeout(scrollToTarget, 300);
    });
};

// 限制字元顯示
const textEclipse = (text, length) => {
    const removeHtmlTagsText = removeHtmlTags(text);
    return removeHtmlTagsText?.length > length ? removeHtmlTagsText?.slice(0, length) + "..." : removeHtmlTagsText;
};

// 取得 url domain
const getUrlDomain = (url) => {
    if (!url) return url;
    try {
        const match = url.match(/^(?:https?:)?(?:\/\/)?([^\/\?]+)/i);
        return match && match[1] ? match[1] : url;
    } catch (error) {
        return url;
    }
};

// 取得完整 url
const getFullUrl = (url) => {
    if (!url) return "#";
    return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
};

// source chunk 滾輪事件
const scrollAreaRef = ref(null);
const handleWheel = (event) => {
    if (scrollAreaRef.value) {
        // 阻止 y 軸滾動
        event.preventDefault();
        // 只允許 x 軸滾動
        scrollAreaRef.value.scrollLeft += event.deltaY;
    }
};

// 監聽滾動區域的變化
watch(
    () => scrollAreaRef.value,
    (newVal) => {
        if (newVal) {
            const checkScroll = () => {
                if (newVal.scrollWidth > newVal.clientWidth) {
                    newVal.addEventListener("wheel", handleWheel);
                } else {
                    newVal.removeEventListener("wheel", handleWheel);
                }
            };

            // 初始檢查
            checkScroll();

            // 監聽窗口大小變化
            window.addEventListener("resize", checkScroll);

            // 清理函數
            return () => {
                newVal.removeEventListener("wheel", handleWheel);
                window.removeEventListener("resize", checkScroll);
            };
        }
    },
    { immediate: true }
);

// 外層的卡片要顯示的文字 把 markdown 跟 html tag 去掉
const stripMarkdownAndHtml = (text) => {
    if (!text) {
        return "";
    }
    try {
        let plainText = marked(text);
        let strippedText = plainText.replace(/<[^>]*?>/g, "");
        strippedText = strippedText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line)
            .join("\n")
            .replace(/[ \t]+/g, " ");
        return strippedText;
    } catch (error) {
        console.error("Error stripping Markdown and HTML:", error);
    }
};

// 更改檔案副檔名
const changeFileExtension = (filename, originalname, crawler_attachment_id) => {
    const originalExtension = originalname?.split(".").pop();
    const baseFilename = filename?.split(".").slice(0, -1).join(".");

    if (crawler_attachment_id) {
        return `${baseFilename}.${originalExtension}?attachmentId=${crawler_attachment_id}`;
    }
    return `${baseFilename}.${originalExtension}`;
};

// 簡化版卡片點擊事件
const handleSimplifiedCardClick = (chunkGroup) => {
    const metadata = chunkGroup.chunks[0][0]?.metadata;

    if (metadata?.datasource_url) {
        window.open(getFullUrl(metadata.datasource_url), "_blank");
    } else if (!metadata.is_downloadable) {
        toast({
            title: "提示",
            description: "此檔案不提供下載功能",
            variant: "warning",
        });

        return;
    } else if (metadata?.filename) {
        window.location.href = `${domain}/ava/backend/download/${changeFileExtension(
            metadata.filename,
            metadata.originalname
        )}`;
    }
};

// 開啟外部連結 因為用 :href 會有 xss 的問題
const openExternalLink = (url) => {
    emitter.emit("openUrl", url);
};

// 取得 Tooltip 內容
const getTooltipContent = (metadata) => {
    const { datasource_url, datasource_name, originalname, chunk_type, crawler_title } = metadata || {};

    // 要是有 crawler_title 就顯示 crawler_title，沒有的話就顯示 datasource_url
    const titleToDisplay = crawler_title || datasource_url || "";

    if (chunk_type === "crawler") {
        const nameParts = datasource_name?.split("-") || [];
        if (nameParts.length > 1) {
            if (nameParts[0]?.trim() === nameParts[1]?.trim()) {
                return [nameParts[0], datasource_url || ""];
            }
            return [nameParts[0], nameParts[1], titleToDisplay || ""];
        } else {
            return [datasource_name || "", titleToDisplay || ""];
        }
    } else if (datasource_url && datasource_name) {
        return [datasource_name, datasource_url];
    } else {
        return [originalname || ""];
    }
};

// 開啟 dialog 時，會因為沒辦法關閉 Tooltip 而造成畫面殘留，因此需要手動控制 Tooltip 狀態。
const isDialogOpen = ref(false);
const tooltipStates = ref({});

watch(
    () => sourceData.value,
    (newSourceData) => {
        newSourceData.forEach((chunkGroup) => {
            // 確保 chunks 是一個數組
            const chunks = Array.isArray(chunkGroup.chunks) ? chunkGroup.chunks : [chunkGroup.chunks];
            chunks.forEach((chunk) => {
                if (chunk && chunk.id && !tooltipStates.value[chunk.id]) {
                    tooltipStates.value[chunk.id] = false;
                }
            });
        });
    },
    { immediate: true }
);
// 監聽 dialog 開關狀態
watch(isDialogOpen, (newValue) => {
    if (!newValue) {
        // 當 Dialog 關閉時，重置所有 Tooltip 狀態
        Object.keys(tooltipStates.value).forEach((key) => {
            tooltipStates.value[key] = false;
        });
    }
});

// 設置 Tooltip 狀態
const setTooltipState = (id, state) => {
    if (tooltipStates.value.hasOwnProperty(id)) {
        tooltipStates.value[id] = state;
    }
};

// 計算單一檔案資料來源是否含多個chunks
const countFileChunks = (fileChunksData) => {
    let num = 0;
    fileChunksData.forEach((chunksGroup) => {
        num += chunksGroup.length;
    });
    return num;
};
</script>

<template>
    <UseWindowSize v-slot="{ width }">
        <TooltipProvider :delayDuration="100">
            <Dialog v-model:open="isDialogOpen">
                <hr class="p-1" />
                <div class="w-full">
                    <div class="space-y-2">
                        <!-- Loading state -->
                        <template v-if="sourceChunkMode === 'loading'">
                            <div class="space-y-2">
                                <div
                                    v-for="i in 3"
                                    :key="i"
                                    class="p-4 rounded-xl border border-gray-200 dark:border-gray-700"
                                >
                                    <div class="flex items-center">
                                        <Skeleton class="mr-3 w-5 h-5 rounded-full" />
                                        <div class="flex-1">
                                            <Skeleton class="mb-2 w-3/4 h-4" />
                                            <Skeleton class="w-1/2 h-3" />
                                        </div>
                                        <Skeleton class="w-16 h-6 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </template>

                        <!-- Full mode -->
                        <template v-else-if="sourceChunkMode === 'full'">
                            <div class="space-y-3 w-full">
                                <div v-for="(chunkGroup, index) in sourceData" :key="index" class="w-full">
                                    <Tooltip :open="tooltipStates[chunkGroup.chunks[0]?.id]">
                                        <TooltipTrigger
                                            @mouseenter="setTooltipState(chunkGroup.chunks[0][0]?.id, true)"
                                            @mouseleave="setTooltipState(chunkGroup.chunks[0][0]?.id, false)"
                                            class="block w-full"
                                        >
                                            <DialogTrigger as-child>
                                                <div class="relative w-full" @click="handleCardClick(chunkGroup)">
                                                    <!-- 堆疊效果背景 -->
                                                    <div
                                                        v-if="countFileChunks(chunkGroup.chunks) > 1"
                                                        class="absolute inset-0 bg-gray-300 rounded-lg shadow-md transform rotate-1 dark:bg-gray-600"
                                                        style="top: 2px; left: 2px; right: -2px; bottom: -2px"
                                                    ></div>

                                                    <Card
                                                        class="w-full bg-[var(--chatbox-robot-bg-color)] relative z-10 transition-colors cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700"
                                                    >
                                                        <CardContent class="p-4 w-full">
                                                            <div class="flex items-start w-full text-justify">
                                                                <!-- Icon -->
                                                                <div class="datasource-link">
                                                                    <template
                                                                        v-if="
                                                                            chunkGroup.chunks[0][0]?.metadata
                                                                                ?.crawler_title
                                                                        "
                                                                    >
                                                                        <a
                                                                            @click.stop
                                                                            :href="
                                                                                chunkGroup.chunks[0][0].metadata
                                                                                    .datasource_url
                                                                            "
                                                                            target="_blank"
                                                                        >
                                                                            <Earth
                                                                                class="datasource-link-icon icon-hover"
                                                                            />
                                                                        </a>
                                                                    </template>
                                                                    <template
                                                                        v-else-if="
                                                                            chunkGroup.chunks[0][0]?.metadata
                                                                                ?.datasource_url
                                                                        "
                                                                    >
                                                                        <a
                                                                            @click.stop
                                                                            :href="
                                                                                chunkGroup.chunks[0][0].metadata
                                                                                    .datasource_url
                                                                            "
                                                                            target="_blank"
                                                                        >
                                                                            <Link
                                                                                class="datasource-link-icon icon-hover"
                                                                            />
                                                                        </a>
                                                                    </template>
                                                                    <template v-else>
                                                                        <a
                                                                            class="text-[var(--chat-text-color)]"
                                                                            @click.stop="
                                                                                chunkGroup.chunks[0][0].metadata
                                                                                    ?.is_downloadable !== false &&
                                                                                    openExternalLink(
                                                                                        `${domain}/ava/backend/download/${changeFileExtension(
                                                                                            chunkGroup.chunks[0][0]
                                                                                                .metadata.filename,
                                                                                            chunkGroup.chunks[0][0]
                                                                                                .metadata.originalname,
                                                                                            chunkGroup.chunks[0][0]
                                                                                                .metadata
                                                                                                ?.crawler_attachment_id
                                                                                        )}`
                                                                                    )
                                                                            "
                                                                        >
                                                                            <FileText
                                                                                class="datasource-link-icon icon-hover"
                                                                            />
                                                                        </a>
                                                                    </template>
                                                                </div>

                                                                <!-- index -->
                                                                <div
                                                                    class="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 mr-1 text-xs font-bold text-[var(--chat-text-color)] bg-[color-mix(in_srgb,var(--chat-text-color)_10%,transparent)] rounded-full"
                                                                >
                                                                    {{ index + 1 }}
                                                                </div>

                                                                <!-- Content -->
                                                                <div class="flex-1 w-full min-w-0">
                                                                    <div
                                                                        class="text-[var(--chat-text-color)] font-medium text-sm sm:text-base w-full"
                                                                    >
                                                                        {{
                                                                            chunkGroup.chunks[0][0]?.metadata
                                                                                ?.datasource_name
                                                                                ? chunkGroup.chunks[0][0]?.metadata
                                                                                      ?.datasource_name
                                                                                : textEclipse(
                                                                                      stripMarkdownAndHtml(
                                                                                          chunkGroup.chunks[0][0]?.content?.trim()
                                                                                      ),
                                                                                      50
                                                                                  )
                                                                        }}
                                                                    </div>

                                                                    <div
                                                                        class="mt-1 w-full text-xs text-gray-500 truncate sm:text-sm"
                                                                    >
                                                                        <template
                                                                            v-if="
                                                                                chunkGroup.chunks[0][0]?.metadata
                                                                                    ?.crawler_title
                                                                            "
                                                                        >
                                                                            {{
                                                                                chunkGroup.chunks[0][0].metadata
                                                                                    .crawler_title
                                                                            }}
                                                                        </template>
                                                                        <template
                                                                            v-else-if="
                                                                                chunkGroup.chunks[0][0]?.metadata
                                                                                    ?.datasource_url
                                                                            "
                                                                        >
                                                                            {{
                                                                                getUrlDomain(
                                                                                    chunkGroup.chunks[0][0].metadata
                                                                                        .datasource_url
                                                                                )
                                                                            }}
                                                                        </template>
                                                                        <template
                                                                            v-else-if="
                                                                                chunkGroup.chunks[0][0]?.metadata
                                                                                    ?.originalname
                                                                            "
                                                                        >
                                                                            {{
                                                                                chunkGroup.chunks[0][0].metadata
                                                                                    .originalname
                                                                            }}
                                                                        </template>
                                                                    </div>

                                                                    <div
                                                                        class="flex items-center my-2"
                                                                        v-if="
                                                                            chunkGroup.chunks[0][0]?.metadata
                                                                                ?.datasets_name && show_dataset_name
                                                                        "
                                                                    >
                                                                        <Badge
                                                                            variant="outline"
                                                                            class="text-[var(--chat-text-color)] bg-[var(--chat-bg-color)]"
                                                                        >
                                                                            {{
                                                                                chunkGroup.chunks[0][0].metadata
                                                                                    .datasets_name
                                                                            }}
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                <!-- Counter Badge -->
                                                                <div
                                                                    v-if="countFileChunks(chunkGroup.chunks) > 1"
                                                                    class="flex-shrink-0 px-2 py-1 ml-3 text-xs bg-gray-100 rounded-full dark:bg-gray-700"
                                                                >
                                                                    {{ countFileChunks(chunkGroup.chunks) }} 個片段
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            </DialogTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p
                                                v-for="(line, index) in getTooltipContent(
                                                    chunkGroup.chunks[0][0].metadata
                                                )"
                                                :key="index"
                                            >
                                                {{ line }}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        </template>

                        <!-- Simplified version -->
                        <template v-else-if="sourceChunkMode === 'simple'">
                            <div class="space-y-3 w-full">
                                <div v-for="(chunkGroup, index) in sourceData" :key="index" class="w-full">
                                    <Tooltip>
                                        <TooltipTrigger class="block w-full">
                                            <div class="relative w-full" @click="handleSimplifiedCardClick(chunkGroup)">
                                                <Card
                                                    class="w-full bg-[var(--chatbox-robot-bg-color)] relative z-10 transition-colors cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700"
                                                >
                                                    <CardContent class="p-4 w-full">
                                                        <div class="flex items-start w-full text-justify">
                                                            <!-- Icon -->
                                                            <div class="datasource-link">
                                                                <template
                                                                    v-if="
                                                                        chunkGroup.chunks[0][0].metadata?.crawler_title
                                                                    "
                                                                >
                                                                    <Earth class="datasource-link-icon" />
                                                                </template>
                                                                <template
                                                                    v-else-if="
                                                                        chunkGroup.chunks[0][0].metadata?.datasource_url
                                                                    "
                                                                >
                                                                    <Link class="datasource-link-icon" />
                                                                </template>
                                                                <template v-else>
                                                                    <FileText class="datasource-link-icon" />
                                                                </template>
                                                            </div>

                                                            <!-- index -->
                                                            <div
                                                                class="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 mr-1 text-xs font-bold text-[var(--chat-text-color)] bg-[color-mix(in_srgb,var(--chat-text-color)_10%,transparent)] rounded-full"
                                                            >
                                                                {{ index + 1 }}
                                                            </div>

                                                            <!-- Content -->
                                                            <div class="flex-1 min-w-0">
                                                                <div
                                                                    class="text-[var(--chat-text-color)] font-medium text-sm sm:text-base"
                                                                >
                                                                    {{
                                                                        chunkGroup.chunks[0][0].metadata
                                                                            ?.datasource_name
                                                                            ? chunkGroup.chunks[0][0].metadata
                                                                                  ?.datasource_name
                                                                            : chunkGroup.chunks[0][0].metadata
                                                                                  ?.originalname
                                                                    }}
                                                                </div>
                                                                <div
                                                                    class="mt-1 text-xs text-gray-500 truncate sm:text-sm"
                                                                >
                                                                    <template
                                                                        v-if="
                                                                            chunkGroup.chunks[0][0].metadata
                                                                                ?.crawler_title
                                                                        "
                                                                    >
                                                                        {{
                                                                            chunkGroup.chunks[0][0].metadata
                                                                                .crawler_title
                                                                        }}
                                                                    </template>
                                                                    <template
                                                                        v-else-if="
                                                                            chunkGroup.chunks[0][0].metadata
                                                                                ?.datasource_url
                                                                        "
                                                                    >
                                                                        {{
                                                                            getUrlDomain(
                                                                                chunkGroup.chunks[0][0].metadata
                                                                                    .datasource_url
                                                                            )
                                                                        }}
                                                                    </template>
                                                                    <template
                                                                        v-else-if="
                                                                            chunkGroup.chunks[0][0].metadata
                                                                                ?.originalname
                                                                        "
                                                                    >
                                                                        {{
                                                                            chunkGroup.chunks[0][0].metadata
                                                                                .originalname
                                                                        }}
                                                                    </template>
                                                                </div>
                                                                <div
                                                                    class="flex items-center my-2"
                                                                    v-if="
                                                                        chunkGroup.chunks[0][0]?.metadata
                                                                            ?.datasets_name && show_dataset_name
                                                                    "
                                                                >
                                                                    <Badge
                                                                        variant="outline"
                                                                        class="text-[var(--chat-text-color)] bg-[var(--chat-bg-color)]"
                                                                    >
                                                                        {{
                                                                            chunkGroup.chunks[0][0].metadata
                                                                                .datasets_name
                                                                        }}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p
                                                v-for="(line, index) in getTooltipContent(
                                                    chunkGroup.chunks[0][0].metadata
                                                )"
                                                :key="index"
                                            >
                                                {{ line }}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Dialog content -->
                <DialogContent
                    class="flex flex-col sm:max-w-[800px] bg-[var(--chat-bg-color)] text-[var(--chat-text-color)] p-0 max-h-[90dvh] w-[95vw] sm:w-[90vw]"
                >
                    <!-- Header -->
                    <DialogHeader class="flex-shrink-0 p-4 pb-0 sm:px-6">
                        <DialogTitle>
                            <div class="flex justify-between items-center" :class="{ '!text-left': width < 600 }">
                                <div>
                                    <span class="text-sm sm:text-base">{{
                                        width >= 600 ? dialogContent.title : textEclipse(dialogContent.title, 20)
                                    }}</span>
                                    <div class="flex items-center mt-2 text-xs">
                                        <span class="inline-block mr-1 w-3 h-3 bg-primary-chunk"></span>
                                        <span class="mr-3">主要 Chunk</span>
                                        <span class="inline-block mr-1 w-3 h-3 bg-secondary-chunk"></span>
                                        <span>其他 Chunk</span>
                                    </div>
                                </div>
                                <div class="flex gap-2 items-center mt-2 max-sm:gap-0 sm:mt-0 sm:mr-5 max-sm:mr-8">
                                    <Switch
                                        id="preview"
                                        v-model="showMarkdown"
                                        @update:checked="toggleMarkdown"
                                        :checked="showMarkdown"
                                        class="scale-90 customSwitch"
                                    />
                                    <div for="preview" class="w-[60px]">{{ showMarkdown ? "預覽" : "純文字" }}</div>
                                </div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <!-- Content -->
                    <div class="overflow-y-auto flex-grow px-4 py-4 sm:px-6">
                        <div class="pr-2 h-full">
                            <template v-if="dialogContent.chunks">
                                <div
                                    v-for="(chunk, index) in dialogContent.chunks"
                                    :key="index"
                                    :class="[
                                        'p-3 mb-4 rounded',
                                        chunk.is_target ? 'bg-primary-chunk' : 'bg-secondary-chunk',
                                        chunk.hasChunkGap ? 'bg-chunk-gap' : null,
                                    ]"
                                >
                                    <div v-if="showMarkdown" v-dompurify-html="chunk.processedContentMarkdown"></div>
                                    <pre v-else class="content-pre">{{ chunk.processedContentPlainText }}</pre>
                                </div>
                            </template>
                        </div>
                    </div>

                    <!-- Footer -->
                    <DialogFooter
                        class="flex-shrink-0 flex text-[var(--chat-text-color)] flex-col !justify-between w-full p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700"
                    >
                        <div class="flex flex-col gap-2 mb-4 text-xs sm:gap-1 sm:text-sm sm:mb-0">
                            <span v-if="dialogContent.metadata?.page_title && dialogContent.metadata?.page_url">
                                附件原始頁面:
                                <a
                                    class="text-[var(--chat-text-color)] underline-offset-4"
                                    @click.stop="openExternalLink(dialogContent.metadata.page_url)"
                                >
                                    {{ dialogContent.metadata.page_title }}
                                </a>
                            </span>
                            <span
                                v-if="dialogContent.metadata?.datasource_url && dialogContent.metadata?.datasource_name"
                            >
                                外部連結:
                                <a
                                    class="text-[var(--chat-text-color)] underline-offset-4"
                                    @click.stop="openExternalLink(dialogContent.metadata.datasource_url)"
                                >
                                    {{ dialogContent.metadata.datasource_name }}
                                </a>
                            </span>
                            <span v-if="dialogContent.metadata?.filename">
                                <template v-if="dialogContent.metadata.is_downloadable">
                                    <span>檔案下載: </span>
                                    <a
                                        class="text-[var(--chat-text-color)] underline-offset-4"
                                        @click.stop="
                                            openExternalLink(
                                                `${domain}/ava/backend/download/${changeFileExtension(
                                                    dialogContent.metadata.filename,
                                                    dialogContent.metadata.originalname,
                                                    dialogContent.metadata?.crawler_attachment_id
                                                )}`
                                            )
                                        "
                                        >{{ dialogContent.metadata.originalname }}</a
                                    >
                                </template>
                                <template v-else>
                                    <span>檔案來源: </span>
                                    <span>{{ dialogContent.metadata.originalname }}</span>
                                </template>
                            </span>
                        </div>
                        <div class="flex justify-end items-center">
                            <DialogClose as-child>
                                <Button variant="ghost" class="text-xs text-gray-600 sm:text-sm">關閉</Button>
                            </DialogClose>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    </UseWindowSize>
</template>

<style scoped lang="scss">
.content-pre {
    white-space: pre-wrap;
    white-space: -moz-pre-wrap;
    white-space: -pre-wrap;
    white-space: -o-pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
    overflow-x: hidden;
    line-height: 1.5;
    max-width: 100%;
    box-sizing: border-box;
}

.theme-border {
    border: 1px solid color-mix(in srgb, var(--chat-text-color) 50%, transparent);
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.light .customSwitch[aria-checked="false"] {
    background-color: theme("colors.gray.400") !important;
}

.dark .customSwitch[aria-checked="true"] {
    background-color: #fff !important;
}

.dark .customSwitch[aria-checked="false"] {
    background-color: theme("colors.gray.300") !important;
}

.bg-primary-chunk {
    background-color: rgba(59, 130, 246, 0.3) !important;
}

/* .bg-primary-chunk {
    background-color: rgba(96, 165, 250, 0.2) !important;
} */

/* .light .bg-secondary-chunk {
    background-color: rgba(209, 213, 219, 0.5) !important;
} */

.bg-secondary-chunk {
    background-color: rgba(107, 114, 128, 0.3) !important;
}

.light .bg-chunk-gap {
    background-color: rgba(233, 207, 207, 0.5) !important;
}

.dark .bg-chunk-gap {
    background-color: rgba(101, 39, 39, 0.3) !important;
}

.datasource-link {
    position: absolute;
    right: 10px;
    bottom: 10px;
    .datasource-link-icon {
        @apply w-5 h-5 text-gray-500;
    }
    .icon-hover {
        &:hover {
            color: var(--navigation-text-color);
        }
    }
}
</style>
