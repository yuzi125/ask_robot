const express = require("express");
const expressWs = require("express-ws");
const router = express.Router();
expressWs(router);
const connections = {};

router.ws("/", function (ws, req) {
    // console.log(req);
    ws.on("message", function (data) {
        try {
            let obj = JSON.parse(data);
            switch (obj.cmd) {
                case "init":
                    init(obj, ws);
                    break;
            }
        } catch (error) {
            console.error(error);
        }
    });
});
async function init(obj, ws) {
    if (!ws["roomId"]) {
        ws["roomId"] = obj.data.roomId;
        // ws.send(JSON.stringify({ cmd: "contactList", data: ws["userInfo"] }));
    }
}

module.exports = router;
