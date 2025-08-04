const responseModel = require("../../model/responseModel");
const fs = require("fs");
const path = require("path");

exports.getFilenames = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let files = fs.readdirSync(path.join(__dirname, "../../log"));
        files = files.reverse();
        rsmodel.code = 0;
        rsmodel.data = files;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getFile = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        let { filename, count } = req.query;
        const file = fs.readFileSync(path.join(__dirname, `../../log/${filename}`), "utf-8");

        const level_color = [
            { level: "LOG", color: "white" },
            { level: "INFO", color: "blue" },
            { level: "ERROR", color: "red" },
            { level: "WARNING", color: "yellow" },
            { level: "DEBUG", color: "orange" },
        ];
        const regex =
            /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (.*?) - (.*?) - (.*?)(?=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} -|\s*$|(?=\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] -))/gm;
        let rsArr = [];
        let match;
        while ((match = regex.exec(file)) !== null) {
            let color = level_color.find((f) => f.level === match[3]).color;
            rsArr.push({ time: match[1], level: match[3], module: match[2], message: match[4], color: color });
        }
        if (count) {
            rsArr = rsArr.slice(-1 * count);
        }

        rsmodel.code = 0;
        rsmodel.data = rsArr;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.downloadLogFile = async function (req, res) {
    try {
        let { filename } = JSON.parse(req.body); // 改從 req.body 取得文件名
        const filePath = path.join(__dirname, `../../log/${filename}`);

        // 檢查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).send("文件不存在");
        }

        // 設置返回的文件類型和文件名
        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
        res.setHeader("Content-Type", "text/plain");

        // 將文件流發送給前端
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (e) {
        console.error(e);
        res.status(500).send("伺服器錯誤，無法下載文件");
    }
};
