<script setup>
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
const emitter = inject("emitter");
import { ref, onMounted, onBeforeUnmount, inject, toRefs, watch, nextTick } from "vue";
import { useApiStatusStore } from "@/store/index";
const apiStatusStore = useApiStatusStore();

const axios = inject("axios");

const expertTip = ref([]);
const dropdownMenuOpen = ref(false);
const props = defineProps({
    chatPartner: { type: Object, default: {} },
});

watch(
    () => props.chatPartner.roomId,
    async (newVal) => {
        apiStatusStore.registerRequest();
        try {
            let response = await axios.get(`/expert/tip?groupId=${newVal}`);
            expertTip.value = response.data.data;
        } catch (error) {
            console.log("onMounted error", error);
        } finally {
            apiStatusStore.markRequestComplete();
        }
    }
);

const toggleDropdown = (event) => {
    dropdownMenuOpen.value = !dropdownMenuOpen.value;
    event.stopPropagation();
};

const handleTextToUserInput = (text) => {
    if (typeof text === "object") {
        emitter.emit("pushInput", text.clickValue);
    } else {
        emitter.emit("pushInput", text);
    }

    dropdownMenuOpen.value = false;

    nextTick(() => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                emitter.emit("iframe_focusInput");
            }, 200);
        });
    });
};

const handleClickOutside = (event) => {
    // 如果點擊的是 searchSkill 的 input 就不要關閉 dropdown menu
    if (event.target.closest("#searchSkill")) {
        return;
    }
    if (!event.target.closest(".dropdown-menu")) {
        dropdownMenuOpen.value = false;
    }
};

// 使用 DropdownMenu 跟 Command 做結合，因為 CommandItem 點擊後不會關閉 DropdownMenu，所以得自己實作開關方法。
onMounted(() => {
    // 因為 DropdownMenu 是透過 click 事件來開啟的，所以這邊要監聽整個 document 的 click 事件。
    document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", handleClickOutside);
});
</script>
<template>
    <DropdownMenu :open="dropdownMenuOpen">
        <DropdownMenuTrigger
            @click="toggleDropdown"
            class="inline-flex items-center justify-center gap-x-1.5 bg-[color:var(--primary-color)] text-[color:var(--text-color)] rounded-full w-7 h-7 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 hover:opacity-80"
            >?</DropdownMenuTrigger
        >
        <DropdownMenuContent>
            <Command>
                <CommandSeparator />
                <CommandInput placeholder="搜尋技能..." id="searchSkill" />
                <DropdownMenuLabel>你可以這樣問我：</DropdownMenuLabel>
                <CommandList>
                    <!-- 未來如果需要以技能來分組的話 可以使用 CommandGroup -->
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandSeparator />
                    <CommandItem
                        v-for="(tip, index) in expertTip"
                        @click="handleTextToUserInput(tip)"
                        :key="index"
                        :value="typeof tip === 'object' ? `${tip.buttonValue}(${tip.clickValue})` : tip"
                    >
                        {{ typeof tip === "object" ? `${tip.buttonValue}(${tip.clickValue})` : tip }}
                    </CommandItem>
                    <!-- <CommandGroup heading="Suggestions"> </CommandGroup> -->
                </CommandList>
            </Command>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
