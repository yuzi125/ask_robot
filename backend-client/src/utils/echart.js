import * as echarts from "echarts";
import * as XLSX from "xlsx";
import dayjs from "dayjs";

function bytesToGiB(bytes) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2);
}

// 將統計資料轉換為html - table格式
export function dataSourceTable(opt, chartType) {
    const axisData = opt.xAxis[0].data;
    const series = opt.series;

    // 生成表格頭部
    let table =
        '<table style="width:100%;text-align:center;border-collapse:collapse;"><tbody>' +
        '<tr style="background-color:#f2f2f2;font-weight:bold;text-wrap: nowrap;">' +
        '<td style="padding:5px;border:1px solid #ddd;">日期</td>';

    series.forEach(function (serie) {
        table += '<td style="padding:5px;border:1px solid #ddd;">' + serie.name + "</td>";
    });

    table += "</tr>";

    // 生成表格內容
    for (let i = 0, l = axisData.length; i < l; i++) {
        table += "<tr>" + '<td style="padding:5px;border:1px solid #ddd;">' + axisData[i] + "</td>";

        series.forEach(function (serie) {
            table += '<td style="padding:5px;border:1px solid #ddd;">' + (serie.data[i] || "-") + "</td>";
        });

        table += "</tr>";
    }

    table += "</tbody></table>";

    return table;
}

// 計算總花費
export function priceTotalTitle(data) {
    try {
        let str = "";
        Object.keys(data).forEach((currency, i) => {
            str += `${i === 0 ? "" : "、"}${currency} ${data[currency].toFixed(5)}`;
        });

        return str;
    } catch (error) {
        return "";
    }
}

export function getLightThemeLokiChart(sortedData, selectedLevels, daysDiff) {
    return {
        backgroundColor: "#ffffff",
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: "8%",
            containLabel: true,
        },
        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: "line",
                lineStyle: {
                    color: "#e0e0e0", // 調整十字線顏色
                    type: "dashed",
                },
            },
            backgroundColor: "rgba(255, 255, 255, 0.95)", // 調整提示框背景
            borderColor: "#e0e0e0", // 調整提示框邊框
            textStyle: {
                color: "#333", // 調整提示框文字顏色
            },
            formatter: function (params) {
                const time = params[0].axisValue;
                const date = new Date(sortedData[params[0].dataIndex].timestamp);
                const dateStr = date.toLocaleDateString();

                let result = `${dateStr} ${time}<br/>`;
                params.forEach((param) => {
                    if (selectedLevels.value.has(param.seriesName)) {
                        result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
                    }
                });
                return result;
            },
        },
        legend: {
            show: false,
        },
        xAxis: {
            type: "category",
            boundaryGap: true,
            data: sortedData.map((item) => {
                const date = new Date(item.timestamp);
                return date.toLocaleString("zh-TW", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                });
            }),
            axisLine: {
                lineStyle: {
                    color: "#e0e0e0", // 調整坐標軸顏色
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#f5f5f5", // 調整網格線顏色
                    type: "dashed",
                },
            },
            axisTick: {
                show: true,
                alignWithLabel: true,
                interval: (index) => {
                    if (daysDiff > 1) {
                        // 跨天時每小時顯示一個刻度
                        const date = new Date(sortedData[index].timestamp);
                        return date.getMinutes() === 0;
                    }
                    return true; // 同一天內顯示所有刻度
                },
            },
            minorTick: {
                show: daysDiff <= 1, // 只在同一天內顯示次要刻度
                splitNumber: 4,
                length: 2,
                lineStyle: {
                    color: "#f0f0f0",
                    width: 1,
                },
            },
            axisLabel: {
                color: "#666",
                fontSize: 11,
                interval: (index, value) => {
                    // 現在 value 已經是格式化後的字符串

                    const minute = parseInt(value.split(":")[1]);

                    if (daysDiff > 1) {
                        // 跨天時每小時顯示一個刻度
                        return minute === 0;
                    } else {
                        // 同一天內每5分鐘顯示一個刻度
                        return minute % 5 === 0;
                    }
                },
            },
            minorSplitLine: {
                show: true,
                lineStyle: {
                    color: "#f9f9f9", // 調整次要網格線顏色
                    type: "dotted",
                },
            },
            zoomAndScroll: true,
            dataZoom: [
                {
                    type: "inside",
                    start: 0,
                    end: 100,
                },
                {
                    show: true,
                    type: "slider",
                    bottom: 10,
                    height: 20,
                    start: 0,
                    end: 100,
                },
            ],
        },
        yAxis: {
            type: "value",
            axisLine: {
                show: false,
            },
            axisTick: {
                show: false,
            },
            splitLine: {
                lineStyle: {
                    color: "#f5f5f5", // 調整網格線顏色
                    type: "dashed",
                },
            },
            axisLabel: {
                color: "#666", // 調整軸標籤文字顏色
                fontSize: 11,
            },
        },
        series: [
            {
                name: "debug",
                type: "bar",
                stack: "total",
                data: sortedData.map((item) => (selectedLevels.value.has("debug") ? item.debug : 0)),
                itemStyle: {
                    color: "#64B5F6", // 亮色系的藍色
                },
                barWidth: "30%",
                emphasis: {
                    itemStyle: {
                        color: "#42A5F5", // hover時的藍色
                    },
                },
            },
            {
                name: "error",
                type: "bar",
                stack: "total",
                data: sortedData.map((item) => (selectedLevels.value.has("error") ? item.error : 0)),
                itemStyle: {
                    color: "#EF5350", // 亮色系的紅色
                },
                barWidth: "30%",
                emphasis: {
                    itemStyle: {
                        color: "#E53935", // hover時的紅色
                    },
                },
            },
            {
                name: "info",
                type: "bar",
                stack: "total",
                data: sortedData.map((item) => (selectedLevels.value.has("info") ? item.info : 0)),
                itemStyle: {
                    color: "#81C784", // 亮色系的綠色
                },
                barWidth: "30%",
                emphasis: {
                    itemStyle: {
                        color: "#66BB6A", // hover時的綠色
                    },
                },
            },
            {
                name: "warning",
                type: "bar",
                stack: "total",
                data: sortedData.map((item) => (selectedLevels.value.has("warning") ? item.warn : 0)),
                itemStyle: {
                    color: "#FFB74D", // 亮色系的橙色
                },
                barWidth: "30%",
                emphasis: {
                    itemStyle: {
                        color: "#FFA726", // hover時的橙色
                    },
                },
            },
        ],
    };
}

export function getDarkThemeLokiChart(sortedData, selectedLevels, daysDiff) {
    return {
        backgroundColor: "#1c1c1c",
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: "8%",
            containLabel: true,
        },
        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: "line",
                lineStyle: {
                    color: "#666",
                    type: "dashed",
                },
            },
            backgroundColor: "rgba(50,50,50,0.9)",
            borderColor: "#333",
            textStyle: {
                color: "#fff",
            },
            formatter: function (params) {
                const time = params[0].axisValue;
                const date = new Date(sortedData[params[0].dataIndex].timestamp);
                const dateStr = date.toLocaleDateString();

                let result = `${dateStr} ${time}<br/>`;
                params.forEach((param) => {
                    if (selectedLevels.value.has(param.seriesName)) {
                        result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
                    }
                });
                return result;
            },
        },
        legend: {
            show: false,
        },
        xAxis: {
            type: "category",
            boundaryGap: true,
            data: sortedData.map((item) => {
                const date = new Date(item.timestamp);
                return date.toLocaleString("zh-TW", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                });
            }),
            axisLine: {
                lineStyle: {
                    color: "#333",
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#333",
                    type: "dashed",
                    opacity: 0.3,
                },
            },
            axisTick: {
                show: true,
                alignWithLabel: true,
                interval: (index) => {
                    if (daysDiff > 1) {
                        // 跨天時每小時顯示一個刻度
                        const date = new Date(sortedData[index].timestamp);
                        return date.getMinutes() === 0;
                    }
                    return true; // 同一天內顯示所有刻度
                },
            },
            minorTick: {
                show: daysDiff <= 1, // 只在同一天內顯示次要刻度
                splitNumber: 4,
                length: 2,
                lineStyle: {
                    color: "#444",
                    width: 1,
                },
            },
            axisLabel: {
                color: "#999",
                fontSize: 11,
                interval: (index, value) => {
                    // 現在 value 已經是格式化後的字符串

                    const minute = parseInt(value.split(":")[1]);

                    if (daysDiff > 1) {
                        // 跨天時每小時顯示一個刻度
                        return minute === 0;
                    } else {
                        // 同一天內每5分鐘顯示一個刻度
                        return minute % 5 === 0;
                    }
                },
            },
            minorSplitLine: {
                show: true,
                lineStyle: {
                    color: "#333",
                    type: "dotted",
                    opacity: 0.2,
                },
            },
            zoomAndScroll: true,
            dataZoom: [
                {
                    type: "inside",
                    start: 0,
                    end: 100,
                },
                {
                    show: true,
                    type: "slider",
                    bottom: 10,
                    height: 20,
                    start: 0,
                    end: 100,
                },
            ],
        },
        yAxis: {
            type: "value",
            axisLine: {
                show: false,
            },
            axisTick: {
                show: false,
            },
            splitLine: {
                lineStyle: {
                    color: "#333",
                    type: "dashed",
                },
            },
            axisLabel: {
                color: "#999",
                fontSize: 11,
            },
        },
        series: [
            {
                name: "debug",
                type: "bar",
                stack: "total",
                data: sortedData.map((item) => (selectedLevels.value.has("debug") ? item.debug : 0)),
                itemStyle: {
                    color: "#2373B9",
                },
                barWidth: "30%",
                emphasis: {
                    itemStyle: {
                        color: "#2D8CF0",
                    },
                },
            },
            {
                name: "error",
                type: "bar",
                stack: "total",
                data: sortedData.map((item) => (selectedLevels.value.has("error") ? item.error : 0)),
                itemStyle: {
                    color: "#F03E3E",
                },
                barWidth: "30%",
                emphasis: {
                    itemStyle: {
                        color: "#FF4D4F",
                    },
                },
            },
            {
                name: "info",
                type: "bar",
                stack: "total",
                data: sortedData.map((item) => (selectedLevels.value.has("info") ? item.info : 0)),
                itemStyle: {
                    color: "#67C23A",
                },
                barWidth: "30%",
                emphasis: {
                    itemStyle: {
                        color: "#85CE61",
                    },
                },
            },
            {
                name: "warning",
                type: "bar",
                stack: "total",
                data: sortedData.map((item) => (selectedLevels.value.has("warning") ? item.warn : 0)),
                itemStyle: {
                    color: "#E6A23C",
                },
                barWidth: "30%",
                emphasis: {
                    itemStyle: {
                        color: "#FAAD14",
                    },
                },
            },
        ],
    };
}

export function getFileSystemSpaceChartOption(data) {
    const series = data.fileSystem.map((fs) => ({
        name: fs.name,
        type: "line",
        smooth: true,
        symbol: "none",
        sampling: "lttb",
        emphasis: {
            focus: "series",
        },
        lineStyle: {
            width: 2,
        },
        areaStyle: {
            opacity: 0.1,
        },
        data: fs.data.map((item) => [new Date(item.time).getTime(), parseFloat(bytesToGiB(item.value))]),
    }));

    return {
        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: "cross",
                animation: false,
                label: {
                    backgroundColor: "#6a7985",
                },
            },
            formatter: function (params) {
                const time = new Date(params[0].data[0]).toLocaleTimeString();
                let result = `${time}<br/>`;
                params.forEach((param) => {
                    result += `${param.marker} ${param.seriesName}: ${param.data[1]} GiB<br/>`;
                });
                return result;
            },
        },
        legend: {
            type: "scroll", // 添加滾動功能
            data: data.fileSystem.map((fs) => fs.name),
            top: 30, // 將圖例移到頂部
            left: "center",
            textStyle: {
                color: "#666",
            },
        },
        title: {
            left: "center",
            text: "Filesystem Space Available",
            top: 0,
            textStyle: {
                color: "#374151",
            },
        },
        toolbox: {
            feature: {
                dataZoom: {
                    yAxisIndex: "none",
                },
                restore: {},
                saveAsImage: {},
            },
            right: 10,
            top: 0,
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: 60, // 增加底部空間給 dataZoom
            top: 80, // 增加頂部空間給 legend
            containLabel: true,
        },
        xAxis: {
            type: "time",
            boundaryGap: false,
            axisLine: {
                lineStyle: {
                    color: "#d1d5db",
                },
            },
            axisLabel: {
                color: "#6b7280",
                formatter: function (value) {
                    const date = new Date(value);
                    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#e5e7eb",
                    type: "dashed",
                },
            },
        },
        yAxis: {
            type: "value",
            name: "GiB",
            nameLocation: "middle",
            nameGap: 50,
            boundaryGap: [0, "10%"],
            axisLine: {
                show: true,
                lineStyle: {
                    color: "#d1d5db",
                },
            },
            axisLabel: {
                color: "#6b7280",
                formatter: "{value} GiB",
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#e5e7eb",
                    type: "dashed",
                },
            },
        },
        dataZoom: [
            {
                type: "inside",
                start: 0,
                end: 100,
            },
            {
                start: 0,
                end: 100,
                bottom: 10, // 調整 dataZoom 的位置
                handleIcon:
                    "path://M306.1,413c0,2.2-1.8,4-4,4h-59.8c-2.2,0-4-1.8-4-4V200.8c0-2.2,1.8-4,4-4h59.8c2.2,0,4,1.8,4,4V413z",
                handleSize: "110%",
                handleStyle: {
                    color: "#d3d3d3",
                },
                textStyle: {
                    color: "#6b7280",
                },
                borderColor: "#90a4ae",
            },
        ],
        series: series,
        media: [
            {
                query: {
                    maxWidth: 768,
                },
                option: {
                    grid: {
                        top: 90, // 在小螢幕上給圖例更多空間
                        bottom: 60,
                        left: "3%",
                        right: "4%",
                    },
                    legend: {
                        top: 25,
                        padding: [5, 10],
                    },
                },
            },
        ],
    };
}

export function getTCPConnectionsChartOption(data) {
    const chartData = data.tcpConnections[0].data.map((item) => [
        new Date(item.time).getTime(),
        Math.floor(item.value),
    ]);

    return {
        tooltip: {
            show: true,
            trigger: "axis",
            axisPointer: {
                type: "cross",
                animation: false,
                label: {
                    backgroundColor: "#6a7985",
                },
            },
        },

        title: {
            left: "center",
            text: "TCP Connections",
            textStyle: {
                color: "#374151",
            },
        },
        toolbox: {
            feature: {
                dataZoom: {
                    yAxisIndex: "none",
                },
                restore: {},
                saveAsImage: {},
            },
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "15%",
            top: "15%",
            containLabel: true,
        },
        xAxis: {
            type: "time",
            boundaryGap: false,
            axisLine: {
                lineStyle: {
                    color: "#d1d5db",
                },
            },
            axisLabel: {
                color: "#6b7280",
                formatter: function (value) {
                    const date = new Date(value);
                    return `${String(date.getHours()).padStart(2, "0")}:00`;
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#e5e7eb",
                    type: "dashed",
                },
            },
        },
        yAxis: {
            type: "value",
            boundaryGap: [0, "10%"],
            axisLine: {
                show: true,
                lineStyle: {
                    color: "#d1d5db",
                },
            },
            axisLabel: {
                color: "#6b7280",
                formatter: function (value) {
                    return Math.floor(value);
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#e5e7eb",
                    type: "dashed",
                },
            },
        },
        dataZoom: [
            {
                type: "inside",
                start: 0,
                end: 100,
                zoomLock: false,
            },
            {
                start: 0,
                end: 100,
                handleIcon:
                    "path://M306.1,413c0,2.2-1.8,4-4,4h-59.8c-2.2,0-4-1.8-4-4V200.8c0-2.2,1.8-4,4-4h59.8c2.2,0,4,1.8,4,4V413z",
                handleSize: "110%",
                handleStyle: {
                    color: "#d3d3d3",
                },
                textStyle: {
                    color: "#6b7280",
                },
                borderColor: "#90a4ae",
            },
        ],
        series: [
            {
                name: "TCP Connections",
                type: "line",
                smooth: true,
                symbol: "none",
                sampling: "lttb",
                emphasis: {
                    focus: "series",
                },
                itemStyle: {
                    color: "#22c55e",
                },
                lineStyle: {
                    width: 2,
                    color: "#22c55e",
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        {
                            offset: 0,
                            color: "rgba(34, 197, 94, 0.25)",
                        },
                        {
                            offset: 1,
                            color: "rgba(34, 197, 94, 0.05)",
                        },
                    ]),
                },
                data: chartData,
            },
        ],
    };
}

export function getDiskIOChartOption(data) {
    // 準備數據序列
    const series = data
        .map((device) => [
            // 讀取數據
            {
                name: `${device.device} - Reads completed`,
                type: "line",
                smooth: true,
                symbol: "none",
                sampling: "lttb",
                emphasis: {
                    focus: "series",
                },
                lineStyle: {
                    width: 1,
                    color: "#22c55e", // 綠色
                },
                areaStyle: {
                    opacity: 0.1,
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: "rgba(34, 197, 94, 0.25)" },
                        { offset: 1, color: "rgba(34, 197, 94, 0.05)" },
                    ]),
                },
                data: device.data.reads.map((point) => [point.time, point.value]),
            },
            // 寫入數據
            {
                name: `${device.device} - Writes completed`,
                type: "line",
                smooth: true,
                symbol: "none",
                sampling: "lttb",
                emphasis: {
                    focus: "series",
                },
                lineStyle: {
                    width: 1,
                    color: "#f59e0b", // 黃色
                },
                areaStyle: {
                    opacity: 0.1,
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: "rgba(245, 158, 11, 0.25)" },
                        { offset: 1, color: "rgba(245, 158, 11, 0.05)" },
                    ]),
                },
                data: device.data.writes.map((point) => [point.time, point.value]),
            },
        ])
        .flat();

    return {
        backgroundColor: "#ffffff",
        title: {
            left: "center",
            text: "Disk IOps",
            top: 0,
            textStyle: {
                color: "#374151",
            },
        },
        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: "cross",
                label: {
                    backgroundColor: "#6a7985",
                },
            },
            formatter: function (params) {
                const time = new Date(params[0].data[0]).toLocaleString();
                let result = `${time}<br/>`;
                params.forEach((param) => {
                    result += `${param.marker} ${param.seriesName}: ${param.data[1].toFixed(2)} io/s<br/>`;
                });
                return result;
            },
        },
        legend: {
            type: "scroll",
            top: 20,
            textStyle: {
                color: "#666666",
            },
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: 60, // 增加底部空間給 dataZoom
            top: 80, // 增加頂部空間給 legend
            containLabel: true,
        },
        xAxis: {
            type: "time",
            boundaryGap: false,
            axisLine: {
                lineStyle: {
                    color: "#d1d5db",
                },
            },
            axisLabel: {
                color: "#6b7280",
                formatter: function (value) {
                    const date = new Date(value);
                    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#e5e7eb",
                    type: "dashed",
                },
            },
        },
        yAxis: {
            type: "value",

            nameLocation: "end",
            nameTextStyle: {
                color: "#666666",
                align: "right",
            },
            axisLine: {
                lineStyle: {
                    color: "#d1d5db",
                },
            },
            axisLabel: {
                color: "#6b7280",
                formatter: function (value) {
                    return `${value} io/s`;
                },
            },
            splitLine: {
                lineStyle: {
                    color: "#e5e7eb",
                    type: "dashed",
                },
            },
        },
        dataZoom: [
            {
                type: "inside",
                start: 0,
                end: 100,
            },
            {
                start: 0,
                end: 100,
                bottom: 20,
                height: 20,
                borderColor: "transparent",
                backgroundColor: "#f3f4f6",
                fillerColor: "rgba(107, 114, 128, 0.1)",
                handleIcon:
                    "path://M306.1,413c0,2.2-1.8,4-4,4h-59.8c-2.2,0-4-1.8-4-4V200.8c0-2.2,1.8-4,4-4h59.8c2.2,0,4,1.8,4,4V413z",
                handleSize: "110%",
                handleStyle: {
                    color: "#d1d5db",
                    borderColor: "#9ca3af",
                },
                textStyle: {
                    color: "#6b7280",
                },
                selectedDataBackground: {
                    lineStyle: {
                        color: "#9ca3af",
                    },
                    areaStyle: {
                        color: "#f3f4f6",
                    },
                },
            },
        ],
        series: series,
        media: [
            {
                query: {
                    maxWidth: 768,
                },
                option: {
                    grid: {
                        top: 90, // 在小螢幕上給圖例更多空間
                        bottom: 60,
                        left: "3%",
                        right: "4%",
                    },
                    legend: {
                        top: 25,
                        padding: [5, 10],
                    },
                },
            },
        ],
    };
}

// 產生Excel檔案
export function echartExportExcel(jsonData, fileName) {
    const data = jsonData;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

// Excel SVG圖示
export function excelIconPath() {
    return "M30 26v9h-4.18c.12-.38.18-.78.18-1.2V26H30zM30 37v9H17c-1.65 0-3-1.35-3-3v-5h7.8c1.03 0 1.98-.37 2.71-1H30zM32 26H48V35H32zM32 37h16v6c0 1.65-1.35 3-3 3H32V37zM30 15v9h-4v-7.8c0-.42-.06-.82-.18-1.2H30zM32 15H48V24H32zM30 4v9h-5.49c-.73-.63-1.68-1-2.71-1H14V7c0-1.65 1.35-3 3-3H30zM48 7v6H32V4h13C46.65 4 48 5.35 48 7zM21.8 36H4.2C2.985 36 2 35.015 2 33.8V16.2C2 14.985 2.985 14 4.2 14h17.6c1.215 0 2.2.985 2.2 2.2v17.6C24 35.015 23.015 36 21.8 36zM7.968 19l3.494 5.978L7.631 31h2.863l2.521-4.716L15.548 31h2.821L14.6 25l3.685-6H15.61l-2.455 4.505L10.832 19H7.968z";
}

export function refreshIconPath() {
    return "M7.5 14.5C3.63401 14.5 0.5 11.366 0.5 7.5C0.5 5.26904 1.54367 3.28183 3.1694 2M7.5 0.5C11.366 0.5 14.5 3.63401 14.5 7.5C14.5 9.73096 13.4563 11.7182 11.8306 13M11.5 10V13.5H15M0 1.5H3.5V5";
}

// 產生Excel檔案名稱
export function getExcelFileName(category, fileName, startDate, endDate, hideNoData = false) {
    const str1 = category ? `_${category}` : "";
    const str2 = fileName ? `_${fileName}` : "";
    const str3 = startDate ? `_${startDate}` : "";
    const str4 = endDate ? `_${endDate}` : "";
    const str5 = hideNoData ? "_(不包含無資料的日期)" : "";
    return `智能客服${str1}${str2}${str3}${str4}${str5}`;
}

// 將週期轉換成起訖日期
export function getDateFromPeriod(period) {
    let startDate = "";
    let endDate = "";
    const num = parseInt(period.split(" ")[0]);
    const unit = period.split(" ")[1] || "";
    if (unit.includes("day")) {
        if (num === 0 || num === 1) {
            startDate = dayjs().format("YYYY-MM-DD");
        } else {
            startDate = dayjs()
                .subtract(num - 1, "day")
                .format("YYYY-MM-DD");
        }
        endDate = dayjs().format("YYYY-MM-DD");
    } else if (unit.includes("mons")) {
        const num = parseInt(period.split(" ")[0]);
        startDate = dayjs().subtract(num, "month").subtract(-1, "day").format("YYYY-MM-DD");
        endDate = dayjs().format("YYYY-MM-DD");
    } else if (num && unit === "") {
        startDate = dayjs()
            .subtract(num - 1, "day")
            .format("YYYY-MM-DD");
        endDate = dayjs().format("YYYY-MM-DD");
    }
    return { startDate, endDate };
}
