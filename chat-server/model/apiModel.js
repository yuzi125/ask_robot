const crypto = require("crypto");

let data2 = `
# 标题\n

## 二级标题

这是一段普通的文本，**加粗**、*斜体*，还有 [链接](https://www.example.com)。  
這是第二段  
這是第三段  

- 无序列表项 1
- 无序列表项 2
- 无序列表项 3

1. 有序列表项 1
2. 有序列表项 2
3. 有序列表项 3

> 这是一个引用块。

![图片](https://i.imgur.com/66BapGH.jpeg)

\`\`\`js
console.log("Hello, world!");
\`\`\`
---

**表格：**

| 姓名   | 年龄 | 职业       |
|--------|------|------------|
| Alice  | 30   | 工程师     |
| Bob    | 28   | 设计师     |
| Carol  | 25   | 作家       |

---

*斜体* 和 **加粗**。
<img src="x" onerror="alert('not happening')">
`;

let data1 = `根據公司的《出差管理規定》文件，出差人應於返回服務地點後五日內報支旅費。  \n\n出差人應填寫「從業人員出差報支單」，連同簽派單一起提交給協理（含）以上主管核簽，然後送管理處登記審核。
如果因公務超出預計出差天數，需要經原核准人核准。
如果逾期不報支，管理處會以書面催報兩次，如果仍不辦理，出差人預支的旅費將在其薪給項下扣回，不得再行補報。
此外，根據附表一中的報支標準，出差人的膳費、宿費及什費的報支金額根據職級有所不同。具體的報支標準請參考附表。
請注意，出差人返回服務地點當日不得報支宿費。
參考這個 <a href='https://imgur.com/search/score?q=one+peace' target='_blank'>圖片網站</a> 以及這個 <a href='https://www.npmjs.com/package/uuid' target='_blank'>uuid網站</a>。`;

let data = `下面是根據2021年2月為止，根據全球票房資料所列出的史上最賣座的<a href='https://zh.wikipedia.org/zh-tw/全球最高電影票房收入列表' target='_blank'>電影前10名</a>：
\n\n| 排名 | 電影名稱 | 上映年份 | 全球票房收入（億美元） |\n|------|---------|---------|----------------------|\n| 1    | 阿凡達    | 2009    | 27.84                |\n| 2    | 復仇者聯盟 | 2012    | 22.80                |\n| 3    | 復仇者聯盟：終局之戰 | 2019 | 27.36                |\n| 4    | 無敵破壞王 | 2012    | 19.60                |\n| 5    | Jurassic World: 神隱關卡 | 2015 | 16.74                |\n| 6    | 魔髮奇緣  |
\n\n <a href='http://localhost:8082/download/036c757a-f631-423e-984c-92576be494da.xlsx'>下載</a>
\n\n <a href='http://localhost:8082/download/61112e34-5715-45b5-baa1-453d4c910445.txt'>下載</a>`;

let image = { src: "https://i.imgur.com/yozbBhh.jpeg", title: "統計圖", alt: "統計圖" };

let charts = {
    title: "營收趨勢圖",
    // preset: "近1年",
    search: ["近1年", "近2年", "近3年"],
    type: ["線圖", "長條圖"],
    option: getOption(),
};

function getSecureRandomInt(min, max) {
    return crypto.randomInt(min, max);
}

function getOption() {
    let option = {
        title: {
            // text: "Stacked Line",
        },
        tooltip: {
            trigger: "axis",
        },
        legend: {
            data: [],
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            containLabel: true,
        },
        toolbox: {
            feature: {
                // saveAsImage: {},
            },
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: [],
        },
        yAxis: {
            type: "value",
        },
        series: [],
    };
    let series = [
        { name: "工程案", data: [] },
        { name: "維護案", data: [] },
    ];
    series.forEach((item) => {
        for (let i = 0; i < 36; i++) {
            item.data.push(getSecureRandomInt(0, 300));
        }
    });
    let total = { name: "總計", data: [] };
    for (let i = 0; i < 36; i++) {
        total.data.push(series[0].data[i] + series[1].data[i]);
    }
    series.push(total);
    series.forEach((item) => {
        option.legend.data.push(item.name);
        option.series.push({ name: item.name, type: "line", stack: "Total", data: item.data });
    });
    for (let i = 0; i < 36; i++) {
        option.xAxis.data.push(i + 1 + "");
    }

    return option;
}

function getOption1() {
    let option1 = {
        tooltip: {
            trigger: "axis",
            axisPointer: {
                // Use axis to trigger tooltip
                type: "shadow", // 'shadow' as default; can also be 'line' or 'shadow'
            },
        },
        legend: {},
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            containLabel: true,
        },
        xAxis: {
            type: "value",
        },
        yAxis: {
            type: "category",
            data: ["經理部門", "一級主管", "二級主管", "三級主管", "四級主管", "專業職位", "非操作", "操作基層"],
        },
        series: [
            {
                name: "高中職以下",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [20, 25, 10, 30, 15, 25, 15, 10],
                data: [],
            },
            {
                name: "專科",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [20, 25, 15, 25, 20, 10, 25, 10],
                data: [],
            },
            {
                name: "學士",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [20, 25, 25, 20, 20, 20, 10, 30],
                data: [],
            },
            {
                name: "碩士",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [20, 15, 25, 15, 25, 25, 25, 25],
                data: [],
            },
            {
                name: "博士",
                type: "bar",
                stack: "total",
                label: {
                    show: true,
                },
                emphasis: {
                    focus: "series",
                },
                // data: [20, 10, 25, 10, 20, 20, 25, 25],
                data: [],
            },
        ],
    };
    function splitIntoFiveParts() {
        const result = [];
        let remaining = 100;

        for (let i = 0; i < 4; i++) {
            // 生成一個隨機整數，範圍是 1 到剩餘的數字減 4（確保不會分配太大）
            const part = getSecureRandomInt(1, remaining - (4 - i));
            result.push(part);
            remaining -= part;
        }

        // 最後一份是剩餘的數字
        result.push(remaining);

        return result;
    }
    option1.yAxis.data.forEach(() => {
        let arr = splitIntoFiveParts();
        option1.series.forEach((item, index) => {
            item.data.push(arr[index]);
        });
    });
    return option1;
}

let charts_line = { title: "屆退趨勢圖", series: {}, preset: "近2年" };

let charts_stacked = { title: "各層級人員學歷分布" };

let hint = ["長條圖", "線圖"];

let nowDate = new Date();
let month = nowDate.getMonth() + 1;
let day = nowDate.getDate();

let card = {
    form: {
        title: "請填寫預約會議室資料",
        data: [
            { name: "subject", title: "請輸入會議室的使用目的", required: false, type: "text" },
            {
                name: "dateSelect",
                title: "請選擇日期(近3日)",
                required: true,
                type: "select",
                option: [
                    { show: `2023年${month}月${day}號`, value: `2023${month}${day}` },
                    { show: `2023年${month}月${day + 1}號`, value: `2023${month}${day + 1}` },
                    { show: `2023年${month}月${day + 2}號`, value: `2023${month}${day + 2}` },
                ],
            },
            { type: "hidden", data: "隨便傳神麼，下次收到form時會拿到這次送出的" },
        ],
    },
    data: [
        {
            id: "i001",
            title: "1801會議室",
            items: [
                {
                    text: "09:00~10:00",
                    value: "09:00~10:00 1801",
                },
                {
                    text: "10:00~11:00",
                    value: "10:00~11:00 1801",
                },
                {
                    text: "11:00~12:00",
                    value: "11:00~12:00 1801",
                },
                {
                    text: "12:00~13:00",
                    value: "12:00~13:00 1801",
                },
            ],
        },
        {
            id: "i003",
            title: "1803會議室",
            items: [
                {
                    text: "09:00~10:00",
                    value: "09:00~10:00 1803",
                },
                {
                    text: "10:00~11:00",
                    value: "10:00~11:00 1802",
                },
            ],
        },
        {
            id: "i004",
            title: "1804會議室",
            items: [
                {
                    text: "09:00~10:00",
                    value: "09:00~10:00 1804",
                },
                {
                    text: "10:00~11:00",
                    value: "10:00~11:00 1804",
                },
            ],
        },
    ],
};

let iframe1 = {
    title: "屆退趨勢圖",
    url: "../../src/iframs/iframe.html?search=近1年",
    needHorizontal: true,
    needReload: true,
    shareJobId: "35123",
};

let iframe = {
    title: "Bootstrap",
    url: "https://getbootstrap.com/docs/5.3/getting-started/download/",
    // url: "https://prod.icsc.com.tw/erp/ds/jsp/dsjjPortal.jsp",
    needHorizontal: false,
    needReload: false,
    shareJobId: "35123",
};

let form = {
    title: "請填寫預約火車資料",
    btnConfirm: { title: "確認送出" },
    btnCancel: { title: "取消操作" },
    data: [
        {
            name: "dateSelect",
            title: "請選擇日期(近3日)",
            required: false,
            type: "select",
            option: [
                { show: `2023年${month}月${day}號`, value: `2023${month}${day}` },
                { show: `2023年${month}月${day + 1}號`, value: `2023${month}${day + 1}` },
                { show: `2023年${month}月${day + 2}號`, value: `2023${month}${day + 2}` },
            ],
        },
        {
            name: "routeSelect",
            title: "請選擇路線(目前有的)",
            required: false,
            type: "select",
            option: [
                { show: `高雄市火車站 到 台北火車站`, value: `高雄火車站~台北火車站` },
                { show: `高雄市火車站 到 新北火車站`, value: `高雄火車站~新北火車站` },
                { show: `高雄市火車站 到 新竹火車站`, value: `高雄火車站~新竹火車站` },
            ],
        },

        { type: "hidden", data: "" },
    ],
};
/* let form = {
    title: "請填寫預約火車資料",
    btnConfirm: { title: "確認送出" },
    btnCancel: { title: "取消操作" },
    data: [
        {
            name: "dateSelect",
            title: "請選擇日期(近3日)",
            required: false,
            type: "select",
            option: [
                { show: `2023年${month}月${day}號`, value: `2023${month}${day}` },
                { show: `2023年${month}月${day + 1}號`, value: `2023${month}${day + 1}` },
                { show: `2023年${month}月${day + 2}號`, value: `2023${month}${day + 2}` },
            ],
        },
        {
            name: "testInput",
            title: "測試輸入",
            required: false,
            type: "text",
            text: "預設值",
        },
        {
            type: "p",
            data: "123測試",
        },
        {
            name: "routeSelect",
            title: "請選擇路線(目前有的)",
            required: false,
            type: "select",
            option: [
                { show: `高雄市火車站 到 台北火車站`, value: `高雄火車站~台北火車站` },
                { show: `高雄市火車站 到 新北火車站`, value: `高雄火車站~新北火車站` },
                { show: `高雄市火車站 到 新竹火車站`, value: `高雄火車站~新竹火車站` },
            ],
        },

        { type: "hidden", data: "" },
    ],
}; */

exports.apiModel = {
    data2,
    data1,
    data,
    image,
    charts,
    getOption,
    getOption1,
    hint,
    card,
    iframe1,
    iframe,
    form,
    charts_line,
    charts_stacked,
};

// let dataArr = data4.split("");
// let dataArr = [];
// for (let i = 0; i < data5.length; i += 10) {
//     dataArr.push(data5.slice(i, i + 10));
// }
/* res.write(JSON.stringify({ type: "data" }));
            res.write("</end>");
            for (let i = 0; i < dataArr.length; i++) {
                res.write(dataArr[i]);
                await delay(1);
            }
            res.write("</end>"); */
// res.write(JSON.stringify({ type: "image", data: image }));
// res.write("</end>");
// res.write(JSON.stringify({ type: "card", data: card }));
// res.write("</end>");
/* res.write(
                JSON.stringify({
                    type: "form",
                    data: [
                        { name: "subject", title: "請輸入會議室的使用目的", required: true, type: "text" },
                        { name: "password", title: "請輸入密碼", required: true, type: "password" },
                        // { name: "file", title: "請選擇檔案", required: false, type: "file" },
                        // { name: "date", title: "請選擇日期", required: false, type: "date" },
                        // {
                        //     name: "dateSelect",
                        //     title: "請選擇日期",
                        //     required: false,
                        //     type: "select",
                        //     option: [
                        //         { show: "2023年9月7號", value: "20230907" },
                        //         { show: "2023年9月8號", value: "20230908" },
                        //         { show: "2023年9月9號", value: "20230909" },
                        //     ],
                        // },
                        { type: "hidden", data: "隨便傳神麼，下次收到form時會拿到這次送出的" },
                    ],
                })
            );
            res.write("</end>"); */
// res.write(JSON.stringify({ type: "charts_stacked", data: charts_stacked }));
// res.write("</end>");
// res.write(JSON.stringify({ type: "charts_line", data: charts_line }));
// res.write("</end>");
// res.write(JSON.stringify({ type: "iframe", data: iframe2 }));
// res.write("</end>");
// res.write(JSON.stringify({ type: "iframe", data: iframe }));
// res.write("</end>");
// res.write(JSON.stringify({ type: "charts", data: charts }));
// res.write("</end>");

// context = { data: "隨便傳送啥 只要符合json格式字串" };
// res.write(JSON.stringify({ type: "context", data: context }));
// res.write("</end>");

// res.write(JSON.stringify({ type: "context", data: {} }));
// res.write("</end>");
// res.write(JSON.stringify({ type: "hint", data: hint }));
// res.write("</end>");
