<script setup>
import { ref, watch, toRefs, nextTick } from "vue";
const props = defineProps({
    state: { type: Boolean, default: false },
    id: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["change"]);

const { state, id } = toRefs(props);
const openSwitch = ref(false);
async function changeState() {
    await nextTick();
    let data = { id: id.value, state: openSwitch.value };
    emit("change", data);
}
watch(state,(newV)=>{
    openSwitch.value=newV;
})
const input = ref(null);
const label = ref(null);
</script>

<template>
    <div class="switch_com" @click.stop>
        <input
            ref="input"
            type="checkbox"
            class="switchinput"
            v-model="openSwitch"
            style="display: none"
            @click="changeState"
            :disabled="disabled"
        />
        <label ref="label" @click="input.click" class="switchbox" :class="{ disabled: disabled }">
            <p class="open" :class="{ active: openSwitch }"><i class="fa-regular fa-sun"></i></p>
            <p class="close" :class="{ active: !openSwitch }"><i class="fa-regular fa-moon"></i></p>
            <div class="switch"></div>
        </label>
    </div>
</template>

<style lang="scss" scoped>
.switchbox {
    cursor: pointer;
    background-color: #575964;
    width: 54px;
    height: 28px;
    border-radius: 2rem;
    display: flex;
    align-items: center;
    transition: 0.2s;
    position: relative;
    .open {
        position: absolute;
        left: 0.5rem;
        opacity: 0;
        color: white;
        // font-size: 0.8rem;
    }
    .close {
        position: absolute;
        right: 0.5rem;
        opacity: 0;
        color: white;
        // font-size: 0.8rem;
    }
    .active {
        opacity: 1;
        transition: 0.5s;
    }
}
.disabled {
    opacity: 0.4;
}
.switchbox .switch {
    background-color: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    position: absolute;
    transition: 0.2s;
}
.switchinput:checked + .switchbox {
    background-color: #FF6B01;
}
.switchinput:checked + .switchbox .switch {
    left: calc(100% - 24px - 2px);
}
.switchinput:not(:checked) + .switchbox .switch {
    left: 2px;
}
</style>
