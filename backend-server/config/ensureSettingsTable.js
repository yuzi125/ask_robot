const Settings = require("../orm/schema/settings");
const defaultSettings = require("./defaultSettings");

async function ensureSettingsTable() {
    try {
        // 確保資料表與模型同步
        await Settings.sync();
        console.log("sync Settings table completed.");
        // 檢查並新增預設值
        for (const [key, { value, remark }] of Object.entries(defaultSettings)) {
            const [setting, created] = await Settings.findOrCreate({
                where: { key },
                defaults: { value, remark },
            });

            if (created) {
                console.log(`Created default setting: ${key}`);
            }
        }

        console.log("Database settings initialization completed.");
    } catch (error) {
        console.error("Error initializing database settings:", error);
    }
}

module.exports = ensureSettingsTable;
