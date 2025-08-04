<script setup>
import { computed } from "vue";
import { ToastClose } from "radix-vue";
import { X } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = defineProps({
    asChild: { type: Boolean, required: false },
    as: { type: null, required: false },
    class: { type: null, required: false },
});

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;

    return delegated;
});
</script>

<template>
    <ToastClose
        v-bind="delegatedProps"
        :class="
            cn(
                'absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:text-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white group-hover:opacity-100',
                props.class
            )
        "
    >
        <X class="w-4 h-4" />
    </ToastClose>
</template>
