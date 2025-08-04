<template>
    <div>
        <apexchart type="line" height="350" :options="chartOptions" :series="series"></apexchart>
    </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
//   import VueApexCharts from 'vue3-apexcharts';

const chartOptions = ref({});
const series = ref([]);

onMounted(() => {
    // 這裡設置 options 和 series

    chartOptions.value = {
        chart: {
            type: "line",
            height: 350,
        },
        series: [
            {
                name: "花費金額(USD)",
                type: "column",
                data: [0.00897, 0.0323, 0.00753],
            },
            {
                name: "輸入token數",
                type: "line",
                data: [1749, 6100, 1380],
            },
            {
                name: "輸出token數",
                type: "line",
                data: [15, 120, 42],
            },
        ],
        stroke: {
            width: [0, 3, 3],
        },
        markers: {
            size: [0, 8, 8],
            strokeWidth: 2,
            hover: {
                size: 9,
            },
        },
        xaxis: {
            categories: ["2024-07-16", "2024-07-17", "2024-07-18"],
            labels: {
                rotate: 0,
            },
        },
        yaxis: [
            {
                title: {
                    text: "Token數",
                },
            },
            {
                opposite: true,
                title: {
                    text: "花費金額",
                },
            },
        ],
        tooltip: {
            shared: true,
            intersect: false,
        },
        legend: {
            position: "bottom",
        },
        colors: ["#008FFB", "#00E396", "#FEB019"],
        plotOptions: {
            bar: {
                borderRadius: 4,
                columnWidth: "30%",
            },
        },
    };
    series.value = [
        {
            name: "花費金額(USD)",
            type: "column",
            data: [0.00897, 0.0323, 0.00753],
        },
        {
            name: "輸入token數",
            type: "line",
            data: [1749, 6100, 1380],
        },
        {
            name: "輸出token數",
            type: "line",
            data: [15, 120, 42],
        },
    ];
});
</script>
