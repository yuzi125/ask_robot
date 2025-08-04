const { models, syncForce } = require("../orm/plz_only_run_me_once");

const sequelize = require("../orm/sequelize");
const { DataTypes, Op } = require("sequelize");

// 資料表預設值
const feedbackOptionsDefaults = require("./defaultValue/feedbackOptionsDefaults.json");
const modelListDefaults = require("./defaultValue/modelListDefaults.json");
const crawlerDefaults = require("./defaultValue/crawlerDefaults.json");
const crawlerTypeDefaults = require("./defaultValue/crawlerTypeDefaults.json");
const loginTypeDefaults = require("./defaultValue/loginTypeDefaults.json");
const promptDefaults = require("./defaultValue/promptDefaults.json");
const cronTaskDefaults = require("./defaultValue/cronTaskDefaults.json");
const chatThemeDefaults = require("./defaultValue/chatThemeDefaults.json");
const auditLogEntityTypeDefaults = require("./defaultValue/auditLogEntityType.json");
const auditLogActionTypeDefaults = require("./defaultValue/auditLogActionType.json");

const Users = require("../orm/schema/users");

// 有預設值的資料表名稱
const modelsToInsertDefaults = [
    "FeedbackOptions",
    "ModelList",
    "CrawlerType",
    "Crawler",
    "LoginType",
    "DefaultPrompt",
    "UserPasswordHistory",
    "CronTask",
    "ChatTheme",
    "AuditLogEntityType",
    "AuditLogActionType",
];

// 啟動後台伺服器時，檢查資料庫是否同步
async function syncDatabase() {
    try {
        // 使用 force: false 保持資料，如果表不存在才會新增表
        await sequelize.sync({ force: false });
        console.log("All models were synchronized successfully.");

        await insertDefaultValues(modelsToInsertDefaults);
    } catch (error) {
        console.error("Unable to sync database:", error);
    }
}

// 刪除並重構指定資料表
async function refactorDatabase(db_refactor) {
    console.debug("[DB_OPERATION] 執行刪除並重構資料表", db_refactor.map((e) => e).join(", "));
    if (db_refactor.includes("all-table")) {
        // 檢查並重置每一張表
        await syncForce();
        await insertDefaultValues(modelsToInsertDefaults);
    } else {
        // 檢查並重置指定的表
        for (const modelName of db_refactor) {
            if (models.includes(modelName)) {
                await syncForce(modelName);
                if (modelsToInsertDefaults.includes(modelName)) {
                    await insertDefaultValues([modelName]);
                }
            } else {
                console.warn(`警告：模型 "${modelName}" 不存在，已跳過。`);
            }
        }
    }

    return { code: 0 };
}

// 新增預設值方法
async function insertDefaultValues(modelNames) {
    for (const modelName of modelNames) {
        const Model = sequelize.models[modelName];
        if (!Model) {
            console.warn(`警告：模型 "${modelName}" 不存在，跳過插入預設值。`);
            continue;
        }

        // 根據模型名稱獲取對應的預設值
        let defaults;
        switch (modelName) {
            case "CronTask":
                defaults = cronTaskDefaults;
                break;
            case "FeedbackOptions":
                defaults = feedbackOptionsDefaults;
                break;
            case "ModelList":
                defaults = modelListDefaults;
                break;
            case "CrawlerType":
                defaults = crawlerTypeDefaults;
                break;
            case "Crawler":
                defaults = crawlerDefaults;
                break;
            case "LoginType":
                defaults = loginTypeDefaults;
                break;
            case "DefaultPrompt":
                defaults = promptDefaults;
                break;
            case "ChatTheme":
                defaults = chatThemeDefaults;
                break;
            case "UserPasswordHistory":
                // 根據現有的user資料去建立預設值
                const data = await Users.findAll({
                    attributes: ["id", "password"],
                    where: {
                        account: { [Op.ne]: null },
                        password: { [Op.ne]: null },
                        is_enable: 1,
                    },
                });
                const insertData = data.map((e, i) => {
                    return {
                        id: i + 1,
                        user_id: e.id,
                        old_password_1: e.password,
                    };
                });
                defaults = insertData;
                break;
            case "AuditLogEntityType":
                defaults = auditLogEntityTypeDefaults;
                break;
            case "AuditLogActionType":
                defaults = auditLogActionTypeDefaults;
                break;
            // 之後這邊可以加入其他資料表的預設值
            default:
                console.warn(`警告：模型 "${modelName}" 沒有對應的預設值。`);
                continue;
        }

        // 檢查是否需要解析特定欄位的 JSON
        const attributes = Model.getAttributes();
        const parsedDefaults = defaults.map((item) => {
            // 淺拷貝 不要修改到原始資料
            const parsedItem = { ...item };
            for (const key in attributes) {
                // 使用 DataTypes.JSON 進行比較
                if (attributes[key].type instanceof DataTypes.JSON && typeof item[key] === "string") {
                    try {
                        parsedItem[key] = JSON.parse(item[key]);
                    } catch (e) {
                        console.warn(`警告：無法解析 ${modelName} 的 ${key} 欄位 JSON。`);
                    }
                }
            }
            return parsedItem;
        });
        const existingCount = await Model.count();
        if (existingCount === 0) {
            await Model.bulkCreate(parsedDefaults);
            console.log(`${modelName} 預設值插入成功。`);
        } else {
            console.log(`${modelName} 已有資料，不需要插入預設值。`);
        }
    }
}

module.exports = {
    refactorDatabase,
    syncDatabase,
};
