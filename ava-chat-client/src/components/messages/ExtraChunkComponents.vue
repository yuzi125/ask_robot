<script setup>
import { inject, ref } from "vue";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Layers, Plus } from 'lucide-vue-next';

const emitter = inject("emitter");
const props = defineProps({
    data: { type: Array, default: [] },
});
const extraChunk = props.data;

function pushData(item) {
    emitter.emit("pushData", { data: item, type: "text" });
}
</script>
<template>
        <hr class="p-1">
    <div class="expandable_qa">
        <!-- @click="emit('pushData', { data: value, type: 'text' })" -->
        <div class="flex items-center pb-2 text-2xl font-semibold">
                <Layers class="mr-2" />
                別人也在問
            </div>
        <div class="item" @click="pushData(item)" v-for="(item, index) in extraChunk" :key="index">
            <p>{{ item }}</p>
            <span><i class="fa-solid fa-plus"></i></span>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.expandable_qa {
    .item {
        display: flex;
        align-items: center;
        border-top: 1px solid var(--secondary-color);
        justify-content: space-between;
        padding: 0.8rem 0;
        cursor: pointer;
        span {
            display: block;
            padding: 0 0.3rem;
        }
    }
    .title {
        font-size: 1.5rem;
        padding: 1rem 0;
        display: flex;
        align-items: center;
        span {
            // font-size: 1rem;
            margin-right: 0.5rem;
        }
    }
}
</style>
