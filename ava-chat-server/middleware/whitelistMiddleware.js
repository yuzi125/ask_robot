const Settings = require("../orm/schema/settings");
// 檢查請求來源是否在白名單中

async function getWhitelist() {
    try {
        const setting = await Settings.findOne({
            where: { key: "whitelist" },
        });
        return setting ? setting.value : [];
    } catch (error) {
        console.log("getWhitelist", error);
    }
}

async function checkWhitelist(referer) {
    try {
        const whitelist = JSON.parse(await getWhitelist());

        if (!referer) {
            return false;
        }
        const url = new URL(referer);
        const origin = `${url.protocol}//${url.host}`;

        return whitelist.includes(origin);
    } catch (error) {
        console.log("checkWhitelist", error);
    }
}

async function whitelistMiddleware(req, res, next) {
    try {
        if (process.env.ENABLE_WHITELIST === "true") {
            const referer = req.headers.referer;
            if (await checkWhitelist(referer)) {
                res.setHeader("Access-Control-Allow-Origin", referer);
                next();
            } else {
                res.status(403).send("Access Denied");
            }
        } else {
            next();
        }
    } catch (error) {
        console.log("whitelistMiddleware error:", error);
    }
}

module.exports = whitelistMiddleware;
