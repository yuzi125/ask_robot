const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const createFolder = (folder) => {
    try {
        fs.accessSync(folder);
    } catch (e) {
        fs.mkdirSync(folder, { recursive: true });
    }
};
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        createFolder(`uploads`);
        cb(null, `uploads`);
    },
    filename: function (req, file, cb) {
        cb(null, `${uuidv4()}.png`);
    },
});
exports.upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 15, // 限制文件大小為 15MB
    },
}).any();
