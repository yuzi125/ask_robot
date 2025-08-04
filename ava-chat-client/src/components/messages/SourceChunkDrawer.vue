# SourceChunkDrawer.vue
<script setup>
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { FileSearch2, X } from "lucide-vue-next";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import SourceChunkComponentsMember from "@/components/messages/SourceChunkComponents.vue";
import SourceChunkComponentsGuest from "@/components/kaohsiung/messages/SourceChunkComponents.vue";
import { useSystemStore } from "@/store/index";
const systemStore = useSystemStore();
const { isMobile } = systemStore;

const props = defineProps({
    data: {
        type: Array,
        default: () => [[]],
    },
    sourceChunkMode: {
        type: String,
        default: "full",
    },
    isMember: {
        type: Boolean,
        default: false,
    },
});

const isDrawerOpen = ref(false);
</script>

<template>
    <!-- 資料來源按鈕 -->
    <Button
        variant="outline"
        class="bg-[var(--chatbox-robot-bg-color)] text-[var(--chatbox-robot-text-color)] flex items-center gap-2 mb-2 rounded-xl"
        @click="isDrawerOpen = true"
    >
        <FileSearch2 class="w-4 h-4" />
        資料來源
    </Button>
    <!-- mobile Drawer -->
    <Drawer :open="isDrawerOpen && isMobile" @update:open="isDrawerOpen = $event">
        <DrawerContent class="w-[90vw] h-[90vh] max-w-[500px] mx-auto md:mx-auto md:mr-0 sm:mx-auto">
            <DrawerHeader class="flex items-center justify-between px-6 py-4 border-b">
                <DrawerTitle class="text-xl font-bold">參考來源</DrawerTitle>
                <DrawerClose
                    class="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
                >
                    <X class="w-4 h-4" />
                    <span class="sr-only">Close</span>
                </DrawerClose>
            </DrawerHeader>
            <div class="p-4 drawer-content overflow-y-auto">
                <SourceChunkComponentsMember
                    v-if="isMember"
                    :data="data"
                    :sourceChunkMode="sourceChunkMode"
                ></SourceChunkComponentsMember>
                <SourceChunkComponentsGuest
                    v-else
                    :data="data"
                    :sourceChunkMode="sourceChunkMode"
                ></SourceChunkComponentsGuest>
            </div>
        </DrawerContent>
    </Drawer>
    <!-- tablet&desktop Drawer -->
    <Drawer :open="isDrawerOpen && !isMobile" @update:open="isDrawerOpen = $event" class="right-drawer">
        <DrawerContent class="drawer-content-right">
            <DrawerHeader class="flex items-center justify-between px-6 py-4 border-b">
                <DrawerTitle class="text-xl font-bold">參考來源</DrawerTitle>
                <DrawerClose
                    class="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
                >
                    <X class="w-4 h-4" />
                    <span class="sr-only">Close</span>
                </DrawerClose>
            </DrawerHeader>

            <!-- 內容區 -->
            <div class="p-4 drawer-content overflow-y-auto">
                <SourceChunkComponentsMember
                    v-if="isMember"
                    :data="data"
                    :sourceChunkMode="sourceChunkMode"
                ></SourceChunkComponentsMember>
                <SourceChunkComponentsGuest
                    v-else
                    :data="data"
                    :sourceChunkMode="sourceChunkMode"
                ></SourceChunkComponentsGuest>
            </div>
        </DrawerContent>
    </Drawer>
</template>

<style>
.right-drawer [data-state="open"][role="dialog"] {
    padding: 0;
}

.right-drawer [data-state="open"][role="dialog"] {
    padding: 0;
}

/* 重置默認的 drawer 位置和動畫 */
.right-drawer [role="dialog"] {
    padding: 0;
    align-items: flex-start;
    justify-content: flex-end;
}

/* 背景遮罩動畫 */
.fixed.inset-0 {
    animation: none;
    opacity: 0;
}

.fixed.inset-0[data-state="open"] {
    animation: backdrop-in 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.fixed.inset-0[data-state="closed"] {
    animation: none;
    opacity: 0;
    transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-content-right {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: auto;
    width: 90vw;
    max-width: 500px;
    height: 100vh;
    margin: 0;
    background-color: var(--chat-bg-color);
    color: var(--chat-text-color);
    transform: translateX(100%);
    will-change: transform;
}

.drawer-content-right[data-state="open"] {
    animation: drawer-in 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.drawer-content-right[data-state="closed"] {
    animation: drawer-out 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* 內容區域 */
.drawer-content-right .drawer-content {
    height: calc(100vh - 73px);
    overflow-y: auto;
}

/* 動畫定義 */
@keyframes backdrop-in {
    0% {
        opacity: 0;
    }
    100% {
        opacity: 0.5;
    }
}

@keyframes drawer-in {
    0% {
        opacity: 1;
        transform: translateX(100%);
    }
    100% {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes drawer-out {
    0% {
        opacity: 1;
        transform: translateX(0);
    }
    100% {
        opacity: 1;
        transform: translateX(100%);
    }
}
</style>
