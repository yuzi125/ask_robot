const { apiModel } = require("../model/apiModel");
//模擬等待
async function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
//存使用者們的response以便使用者打停止api時找到相對的那個再response.end()
const userRes = {};

exports.api = async function (req, res) {
    try {
        let { roomId, message, context } = req.body;
        userRes[roomId] = res;

        message = JSON.parse(message);
        if (context) {
            context = JSON.parse(context);
        }

        // 設定 Content-Type 為 text/event-stream 和 Cache-Control 為 no-cache
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });

        /* ------------------資料格式------------------ */
        const { data, charts, hint, card, iframe, form, getOption, getOption1 } = apiModel;
        const option = getOption();
        const option1 = getOption1();
        /* ------------------入口------------------ */
        switch (message.type) {
            case "charts":
                await chartsData();
                break;
            case "text":
                await textData();
                break;
            case "form":
                await formData();
                break;
        }

        async function textData() {
            // card form data iframe charts context hint
            let types = message.data.split(" ");
            if (message.data === "幫我預訂火車票") {
                res.write(JSON.stringify({ type: "form", data: form }));
                res.write("</end>");
                return;
            } else if (message.data === "幫我預訂今天火車票") {
                const now = new Date();
                const month = now.getMonth() + 1;
                const day = now.getDate();
                const textForm = JSON.parse(JSON.stringify(form));
                textForm.data.shift();
                textForm.data.find((f) => f.type === "hidden").data = `2023${month}月${day}日`;

                res.write(JSON.stringify({ type: "form", data: textForm }));
                res.write("</end>");
                return;
            }

            for (let i = 0; i < types.length; i++) {
                let item = types[i];
                switch (item) {
                    case "card":
                        // res.write(JSON.stringify({ type: "card", data: card }));
                        res.write(JSON.stringify({ type: "card" }));
                        res.write("</end>");
                        let test = JSON.stringify(card);
                        let pre = test.slice(0, 100);
                        let last = test.slice(100, test.length);
                        res.write(pre);
                        res.write(last);
                        res.write("</end>");
                        context.push({ card: card });
                        break;
                    case "form":
                        res.write(JSON.stringify({ type: "form", data: form }));
                        res.write("</end>");
                        context.push({ form: form });
                        break;
                    case "data":
                        res.write(JSON.stringify({ type: "data" }));
                        res.write("</end>");
                        for (let i = 0; i < data.length; i++) {
                            res.write(data[i]);
                            await delay(1);
                        }
                        res.write("</end>");
                        context.push({ data: data });
                        break;
                    case "iframe":
                        res.write(JSON.stringify({ type: "iframe", data: iframe }));
                        res.write("</end>");
                        context.push({ iframe: iframe });
                        break;
                    case "charts":
                        res.write(JSON.stringify({ type: "charts", data: charts }));
                        res.write("</end>");
                        context.push({ charts: charts });
                        break;
                    case "營收趨勢":
                        res.write(JSON.stringify({ type: "charts", data: charts }));
                        res.write("</end>");
                        context.push({ charts: charts });
                        break;
                    // case "context":
                    //     res.write(JSON.stringify({ type: "context", data: context }));
                    //     res.write("</end>");
                    //     break;
                    case "hint":
                        res.write(JSON.stringify({ type: "hint", data: hint }));
                        res.write("</end>");
                        break;
                    default:
                        res.write(JSON.stringify({ type: "data" }));
                        res.write("</end>");
                        const defaultData = "我不理解您的意思";
                        for (let i = 0; i < defaultData.length; i++) {
                            res.write(defaultData[i]);
                            await delay(1);
                        }
                        res.write("</end>");
                }
            }
            // res.write(JSON.stringify({ type: "context", data: context }));
            res.end();
        }
        async function chartsData() {
            if (message.data.type == "線圖") {
                switch (message.data.search) {
                    case "近1年":
                        res.write(JSON.stringify(option));
                        res.write("</end>");
                        break;
                    case "近2年":
                        res.write(JSON.stringify(option));
                        res.write("</end>");
                        break;
                    case "近3年":
                        res.write(JSON.stringify(option));
                        res.write("</end>");
                        break;
                }
            } else if (message.data.type == "長條圖") {
                switch (message.data.search) {
                    case "近1年":
                        res.write(JSON.stringify(option1));
                        res.write("</end>");
                        break;
                    case "近2年":
                        res.write(JSON.stringify(option1));
                        res.write("</end>");
                        break;
                    case "近3年":
                        res.write(JSON.stringify(option1));
                        res.write("</end>");
                        break;
                }
            }
        }
        async function formData() {
            let item = message.data;
            if (item.comVal) {
                res.write(`已幫您預約${item.comVal}，日期:${item.dateSelect}，主題:${item.subject}`);
            } else if (item.hidden !== undefined) {
                if (item.state === 0) {
                    res.write(`已取消操作`);
                } else if (item.state === 1) {
                    res.write(`已幫您預約日期${item.hidden || item.dateSelect}，路線:${item.routeSelect}`);
                }
            }
            res.write("</end>");
        }
        // setTimeout(() => {}, 3000);
        res.end();
        delete userRes[roomId];
        console.log("傳送完畢");

        //監聽客戶端close
        req.connection.on("close", () => {
            console.log("客戶關閉");
        });
    } catch (e) {
        console.error(e);
    }
};

exports.stopAPI = async function (req, res) {
    let { roomId } = req.body;
    if (userRes[roomId]) {
        userRes[roomId].end();
        delete userRes[roomId];
    }
    res.end();
};
