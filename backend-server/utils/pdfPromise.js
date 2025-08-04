const fs = require("fs");

const savePDF = function (doc, filename) {
    return new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(filename);
        doc.pipe(stream);
        doc.end();
        stream.on("finish", () => {
            console.log(`PDF saved as ${filename}`);
            resolve();
        });
        stream.on("error", (error) => {
            reject(error);
        });
    });
};

module.exports = { savePDF };
