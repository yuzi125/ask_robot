<script setup>
import { ref, computed } from "vue";
import { useStateStore } from "@/store";
import { storeToRefs } from "pinia";
const props = defineProps({
    title: { type: String, default: "" },
    detail: { type: String, default: "" },
});
const emit = defineEmits(["confirm"]);
const { isOpenMenu } = storeToRefs(useStateStore());
const isOpen = ref(false);

const confirmBoxStyles = computed(() => {
    return {
        left: !isOpenMenu.value ? "283px" : "0",
        width: !isOpenMenu.value ? "calc(100% - 283px)" : "100%",
    };
});
defineExpose({ isOpen });
</script>

<template>
    <transition name="confirm">
        <div class="confirm_box" v-if="isOpen" :style="confirmBoxStyles">
            <div class="confirm">
                <div class="content">
                    <div class="title" v-if="title">
                        <p>{{ title }}</p>
                    </div>
                    <div class="detailed" v-if="detail">
                        <p>{{ detail }}</p>
                    </div>
                </div>
                <div class="btns">
                    <button @click="isOpen = false" class="no">取消</button>
                    <button @click="emit('confirm', true)" class="yes">確認</button>
                </div>
            </div>
        </div>
    </transition>
</template>

<style lang="scss" scoped>
.confirm_box {
    background-color: rgba(0, 0, 0, 0.1);

    height: 100%;
    position: fixed;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    align-items: center;
    // pointer-events: none;

    .confirm {
        // pointer-events: all;
        width: 200px;
        border-radius: 0.3rem;
        background-color: var(--primary-color);
        color: var(--text-color);
        box-shadow: 1px 1px 5px gray;
        overflow: hidden;
        .content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-bottom: 1px solid #aaaaaa;
            padding: 0.3rem;
            .title {
                padding: 0.3rem;
                font-weight: bold;
            }
            .detailed {
                padding: 0.3rem;
                font-size: 0.8rem;
            }
        }
        .btns {
            display: flex;
            height: 30px;
            button {
                flex: 1;
                border: none;
                background-color: var(--primary-color);
                color: var(--text-color);
                border-right: 1px solid #aaaaaa;
                cursor: pointer;
                &:last-child {
                    border: none;
                }
            }
            .yes {
                font-weight: bold;
                color: var(--theme-color);
            }
        }
    }
}

.confirm-enter-from {
    opacity: 0;
    transform: scale(1.1);
}
.confirm-enter-active {
    transition: 0.3s;
}
.confirm-enter-to {
    opacity: 1;
    transform: scale(1);
}
.confirm-leave-from {
    opacity: 1;
}
.confirm-leave-active {
    transition: 0.3s;
}
.confirm-leave-to {
    opacity: 0;
}
</style>
