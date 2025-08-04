<script setup>
import { ref, inject, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
const router = useRouter();
const route = useRoute();

const props = defineProps({
    menu: { type: Array, default: [] },
    width: { type: String, default: "100%" },
});
// const emit = defineEmits(["confirm"]);

const menuActive = ref([-1, -1]);

watch

watch(route, (newV) => {
    console.log(newV.matched[0].path);
});
function changePage(item, layer) {
    let link = item.link;
    if (!link && layer === 0) {
        item.child_open = item.child_open ? false : true;
    }
    if(link){
        console.log(`${link}`);
    }
    // router.push(`/datasets/${datasets_id.value}/${link}`);
}
</script>

<template>
    <div class="menu_com" :style="`width:${width}`">
        <ul>
            <li v-for="(item, index) in menu" :key="item">
                <div
                    :class="{ active: menuActive[0] === index && menuActive[1] === -1 }"
                    class="item"
                    @click="changePage(item, 0)"
                >
                    <span><i :class="item.icon"></i></span>
                    <p>{{ item.text }}</p>
                    <div
                        class="ml-auto d-flex"
                        v-if="item.child"
                        @click.stop="item.child_open = item.child_open ? false : true"
                    >
                        <span v-if="!item.child_open" class="ma-auto"><i class="fa-solid fa-chevron-down"></i></span>
                        <span v-else class="ma-auto"><i class="fa-solid fa-chevron-up"></i></span>
                    </div>
                </div>
                <div class="overflow-hidden" :style="item.child_open ? 'height:auto' : 'height:0'" style="transition: .3s;">
                    <div
                        v-for="(item1, index1) in item.child"
                        :key="index1"
                        class="item pl-10"
                        :class="{ active: menuActive[1] === index1 }"
                        @click="changePage(item1)"
                    >
                        <span><i :class="item1.icon"></i></span>
                        <p>{{ item1.text }}</p>
                    </div>
                </div>
            </li>
        </ul>
    </div>
</template>

<style lang="scss" scoped>
$color3: rgb(139, 139, 139);

.menu_com {
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    // width: 300px;
    border-right: 1px solid #e5e7eb;
    overflow-y: auto;

    ul {
        // border-bottom: 1px solid #e5e7eb;
        padding-bottom: 0.5rem;
        margin-top: 0.5rem;
        .item {
            border-radius: 0.3rem;
            padding: 0.6rem;
            display: flex;
            align-items: center;
            color: #333333;
            margin: 0.2rem 0;
            cursor: pointer;

            span {
                font-size: 1rem;
                margin-right: 0.5rem;
            }
            p {
                font-size: 0.9rem;
            }
            &:hover {
                background-color: #e9e9eb;
            }
            img {
                width: 1.5rem;
                height: 1.5rem;
                border-radius: 0.5rem;
                margin-right: 0.6rem;
                border: 1px solid #e4e5e7;
            }
        }
        .active {
            background-color: #ebf5ff;
            color: #1c64f1;
            &:hover {
                background-color: #ebf5ff;
            }
        }
    }
}
</style>
