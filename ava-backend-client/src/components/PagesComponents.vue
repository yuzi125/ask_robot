<script setup>
import { ref, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import SelectComponents from "./SelectComponents.vue";

const router = useRouter();
const route = useRoute();

const props = defineProps({
    list: { type: Array, default: [] },
    searchs: { type: Array, default: [] },
});

const emit = defineEmits(["list"]);

onMounted(() => {
    // initParams();
    initPages();
});

const pages = ref("");
const page = ref(1);
const limit = ref(10);
const search = ref("");
const maxLimit = 150;

function initParams() {
    //初始化參數
    limit.value = route.query.limit;
    page.value = route.query.page;
    if (!limit.value || !page.value) {
        limit.value = 10;
        page.value = 1;
    }
    // router.replace(`${route.path}?limit=${limit.value}&page=${page.value}`);
    // limit.value = parseInt(limit.value);
    // page.value = parseInt(page.value);
}

let searchList;
let pageList = [];
function initPages() {
    //初始化分頁
    let tempList;
    if (search.value) {
        tempList = searchList;
    } else {
        tempList = props.list;
    }
    limit.value = limit.value > 0 ? limit.value : 1;
    pages.value = Math.ceil(tempList.length / limit.value);
    let end = limit.value * page.value;
    let start = end - limit.value;
    let list = tempList.filter((_, i) => i >= start && i < end);
    pageList = list;
    emit("list", pageList);
}
async function changePage(index) {
    if (index < 1 || index > pages.value) return;
    page.value = index;
    // router.replace(`${route.path}?limit=${limit.value}&page=${page.value}`);
    initPages();
}
watch(limit, (newV, oldV) => {
    if (isNaN(newV)) {
        limit.value = oldV;
        return;
    }
    if (!newV || newV == 0) return;
    if (newV > maxLimit) {
        limit.value = maxLimit;
    }
    // router.replace(`${route.path}?limit=${newV}&page=${page.value}`);
    page.value = 1;
    initPages();
});

watch(search, (newV) => {
    if (!newV) {
        emit("list", pageList);
    } else {
        // searchList = props.list.filter((f) => f[props.search].indexOf(newV) !== -1);
        searchList = props.list.filter((f) => {
            let boo = false;
            props.searchs.forEach((item) => {
                if (f[item].indexOf(newV) !== -1) {
                    boo = true;
                }
            });
            return boo;
        });
        emit("list", searchList);
    }
    page.value = 1;
    initPages();
});

const options = ref([
    { title: "10", value: 10 },
    { title: "25", value: 25 },
    { title: "50", value: 50 },
    { title: "100", value: 100 },
]);
</script>

<template>
    <div class="pages_com">
        <div class="title d-flex align-center justify-space-between px-6 py-3">
            <slot name="title"></slot>
            <div class="filter d-flex" v-if="list?.length > 0">
                <div class="limit mr-3">
                    <label>每頁數量: </label>
                    <!-- <input type="text" v-model="limit" /> -->
                    <SelectComponents :options="options" @select="limit = $event"></SelectComponents>
                </div>
                <div class="search">
                    <label>搜尋: </label>
                    <input type="text" v-model="search" />
                </div>
            </div>
        </div>
        <div v-if="pageList.length === 0" class="pa-4 text-center mx-6" style="background-color: #dddddd">查無資料</div>
        <slot name="content"></slot>

        <footer class="d-flex justify-space-between px-6 py-3">
            <div>
                <slot name="footer"></slot>
            </div>
            <div class="pages" v-if="pages">
                <!-- <div class="mr-auto d-flex align-center">
                    <p>頁數:</p>
                    <input type="text" class="border rounded pa-2 ml-2 w-25" v-model="page" />
                </div> -->
                <span class="pages_btn" @click="changePage(1)"><i class="fa-solid fa-angles-left"></i></span>
                <span class="pages_btn mr-3" @click="changePage(page - 1)"><i class="fa-solid fa-angle-left"></i></span>
                <span v-if="page > 3" class="mark3 mx-1"><i class="fa-solid fa-ellipsis"></i></span>
                <div v-for="(item, index) in pages" :key="index">
                    <p
                        v-if="item < page + 3 && item > page - 3"
                        class="pages_btn"
                        :class="{ active_btn: page === item }"
                        @click="changePage(item)"
                    >
                        {{ item }}
                    </p>
                </div>
                <span v-if="page < pages - 2" class="mark3 mx-1"><i class="fa-solid fa-ellipsis"></i></span>
                <span class="pages_btn ml-3" @click="changePage(page + 1)"
                    ><i class="fa-solid fa-angle-right"></i
                ></span>
                <span class="pages_btn" @click="changePage(pages)"><i class="fa-solid fa-angles-right"></i></span>
            </div>
        </footer>
    </div>
</template>

<style lang="scss" scoped>
.pages_com {
    position: relative;
    .title {
        position: sticky;
        top: 0;
        z-index: 1;
        background-color: white;
        .filter {
            input {
                border: 1px solid gray;
                border-radius: 0.3rem;
                padding: 0.3rem 0.5rem;
            }
            .limit {
                input {
                    width: 5rem;
                }
            }
            .search {
                input {
                    height: 2rem;
                }
            }
        }
    }
    footer{
        position: sticky;
        background-color: white;
        bottom: 0;
        .pages {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            .pages_btn {
                background-color: white;
                border: 1px solid #2196f3;
                color: #2196f3;
                border-radius: 0.2rem;
                // width: 1.5rem;
                padding: 0 0.5rem;
                height: 1.5rem;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                margin: 0 0.1rem;
                &:hover {
                    background-color: #ebf5ff;
                }
            }
            .active_btn {
                background-color: #2196f3;
                color: white;
                &:hover {
                    background-color: #2196f3;
                }
            }
        }
    }
}
</style>
