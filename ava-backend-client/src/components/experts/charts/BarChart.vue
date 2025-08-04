<template>
    <div>
        <apexchart v-if="options && series" :options="options" :series="series" height="300"></apexchart>
    </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    data: {
        type: Array,
        required: true,
        default: [],
    },
    title: {
        type: String,
        default: "",
    },
});

const series = computed(() => {
    const errorData = props.data?.map((item) => parseInt(item.錯誤 || 0));
    const noAnswerData = props.data?.map((item) => parseInt(item.無答案 || 0));
    return [
        { name: "錯誤", data: errorData },
        { name: "無答案", data: noAnswerData },
    ];
});

const options = computed(() => {
    console.log("options", props.data);
    // const categories = props.data.map((item) => item.date);
    const maxValue = Math.max(...series.value[0].data, ...series.value[1].data);

    let tickAmount;
    if (maxValue <= 1) {
        tickAmount = 1;
    } else if (maxValue <= 5) {
        tickAmount = maxValue + 1;
    } else {
        tickAmount = 5;
    }

    return {
        chart: {
            type: "bar",
            stacked: true,
        },
        plotOptions: {
            bar: {
                horizontal: true,
            },
        },
        stroke: {
            width: 1,
            colors: ["#fff"],
        },
        xaxis: {
            // categories: categories,
            tickAmount,
            labels: {
                formatter: function (val) {
                    return Math.round(val);
                },
            },
        },
        tooltip: {
            y: {
                formatter: function (val) {
                    return val + " 次";
                },
            },
        },
        fill: {
            opacity: 1,
        },
        legend: {
            position: "top",
            horizontalAlign: "left",
            offsetX: 40,
        },
        colors: ["#E4003A", "#606676"],
        title: {
            text: props.title,
            align: "center",
        },
    };
});
</script>
