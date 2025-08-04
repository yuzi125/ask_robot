<script setup>
import { ref, inject } from "vue";
import EchartsComponents from "../components/EchartsComponents.vue";

const axios = inject("axios");

const isOpenSelect = ref(false);
const options = ref([
    { title: "今天", value: "0 day" },
    { title: "過去7天", value: "7 days" },
    { title: "過去4週", value: "28 days" },
    { title: "過去3個月", value: "3 mons" },
    { title: "過去12個月", value: "12 mons" },
]);
const selectOption = ref(options.value[1]);

async function handleChange(item) {
    if (selectOption.value === item) return;
    selectOption.value = item;
    getOverview(item);
}
async function getOverview(item) {
    /**
     * token_price  時間內token數與總花費
     * total_message  AVA每天的互動總次數
     * active_user  AVA每天有效互動的用戶數
     * model_use  時間內知識庫與技能的使用數
     */
    const period = item.value;
    const expert_id = route.params.expert_id;
    for (let i = 0; i < charts.value.length; i++) {
        const chart = charts.value[i];
        const subject = chart.subject;
        let rs = await axios.get(`/expert/overview?expert_id=${expert_id}&period=${period}&subject=${subject}`);
        if (rs.data.code === 0) {
            rs = rs.data.data;
            chart.period = item.title;
            if (rs.length === 0) {
                delete chart.detail;
                echarts_com.value[i].setOption(null);

                continue;
            }
            const fields = Object.keys(rs[0]);
            const legend = fields.filter((f, i) => i !== 0);
            const option = defaultOption;
            option.series = [];
            option.legend.data = legend;
            option.xAxis.data = rs.map((m) => m[fields[0]]);

            if (chart.subject === "token_price") {
                option.yAxis = [
                    {
                        type: "value",
                        position: "left",
                    },

                    {
                        type: "value",
                        name: "花費金額",
                        position: "right",
                        alignTicks: true,
                        // offset: 80,
                        // axisLine: {
                        //     show: false,
                        // }
                    },
                ];
            } else {
                option.yAxis = {
                    type: "value",
                };
            }
            for (let j = 0; j < legend.length; j++) {
                const series = {
                    name: legend[j],
                    type: legend[j] === "花費金額" ? "bar" : "line",
                    data: [],
                    yAxisIndex: legend[j] === "花費金額" ? 1 : 0,
                    barMaxWidth: 30,
                };
                for (let k = 0; k < rs.length; k++) {
                    series.data.push(rs[k][legend[j]]);
                }
                option.series.push(series);
                console.log("series: ", series);
            }

            if (chart.subject === "token_price") {
                const allPrice = option.series.find((f) => f.name === "花費金額").data;
                const totalTokenPrice = allPrice.reduce((a, b) => a + b, 0);
                chart.detail = totalTokenPrice.toFixed(6);
            }
            console.log("option: ", option);

            echarts_com.value[i].setOption(option);
        }
    }
}

const menuActive = ref([-1, -1]);
const menu = ref([
    {
        icon: "fa-solid fa-database",
        text: "數據源",
        link: "source",
        child: [
            { icon: "fa-solid fa-file-lines", text: "文件", link: "documents" },
            { icon: "fa-solid fa-earth-americas", text: "網站", link: "syncweb" },
        ],
        child_open: true,
    },
    { icon: "fa-solid fa-terminal", text: "提示詞編排", link: "configuration" },
    { icon: "fa-solid fa-gear", text: "設定", link: "settings" },
]);
</script>

<template>
    <div class="overview_view">
        <div class="menu">
            <ul>
                <li v-for="(item, index) in menu" :key="item">
                    <div
                        :class="{ active: menuActive[0] === index && menuActive[1] === -1 }"
                        class="item"
                        @click="changePage(item.link)"
                    >
                        <span><i :class="item.icon"></i></span>
                        <p>{{ item.text }}</p>
                        <div
                            class="ml-auto d-flex"
                            v-if="item.child"
                            @click.stop="item.child_open = item.child_open ? false : true"
                        >
                            <span v-if="!item.child_open" class="ma-auto"
                                ><i class="fa-solid fa-chevron-down"></i
                            ></span>
                            <span v-else class="ma-auto"><i class="fa-solid fa-chevron-up"></i></span>
                        </div>
                    </div>
                    <div class="overflow-hidden" :style="item.child_open ? 'height:auto' : 'height:0'">
                        <div
                            v-for="(item1, index1) in item.child"
                            :key="index1"
                            class="item pl-10"
                            :class="{ active: menuActive[1] === index1 }"
                            @click="changePage(item1.link)"
                        >
                            <span><i :class="item1.icon"></i></span>
                            <p>{{ item1.text }}</p>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
        <router-view class="main"></router-view>
        <div class="main"><p>123</p></div>
        <div class="d-flex align-center mb-5">
            <p class="text-h6 mr-3">週期</p>
            <div class="select bg-theme" @click="isOpenSelect = isOpenSelect ? false : true">
                <div class="d-flex align-center">
                    <span class="mr-2">{{ selectOption.title }}</span>
                    <span style="color: #9a9aa0"><i class="fa-solid fa-angle-down"></i></span>
                </div>
                <div class="option" :class="{ option_show: isOpenSelect }">
                    <div class="item" v-for="(item, index) in options" :key="index" @click="handleChange(item)">
                        <span> {{ item.title }} </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
$color3: rgb(139, 139, 139);

.overview_view {
    background-color: white;
    height: 100%;
    display: flex;
    .menu {
        display: flex;
        flex-direction: column;
        padding: 1.5rem;
        min-width: 300px;
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
    .main {
        overflow-x: auto;
        width: 100%;
    }
    .chartList {
        margin-top: 2rem;
        display: flex;
        flex-wrap: wrap;
        flex: 1 1 600px;

        div {
            min-width: 600px;
        }
    }

    .select {
        padding: 0.5rem 1rem;
        border-radius: 0.3rem;
        position: relative;
        cursor: pointer;

        .option {
            position: absolute;
            top: 2.5rem;
            left: 50%;
            transform: translateX(-50%);
            overflow: hidden;
            border: 0.1rem solid #f3f4f6;
            background-color: white;
            z-index: 1;
            border-radius: 0.3rem;
            text-wrap: nowrap;
            transition: 0.3s;
            display: none;
            max-height: 200px;
            overflow-y: auto;

            .item {
                cursor: pointer;
                padding: 0.5rem 0.8rem;
                // padding: 0.3rem 0.5rem;
                display: flex;
                align-items: center;
                text-decoration: none;

                &:hover {
                    background-color: #f3f4f6;
                }
            }
        }

        .option_show {
            display: block;
        }
    }
}
</style>
