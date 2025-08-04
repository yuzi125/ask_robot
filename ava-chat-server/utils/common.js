const UserLoginRecord = require("../orm/schema/user_login_record");
const LoginType = require("../orm/schema/login_type");
const moment = require("moment");

function getCurrentTimestamp() {
    return moment().locale("zh-tw").format("YYYY-MM-DD HH:mm:ss");
}

function containsPrisonWord(text, prisonWords) {
    return prisonWords?.some((word) => text?.includes(word));
}

const decodeUnicode = (str) => {
    return str.replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16));
    });
};

const processMetaData = (metaData) => {
    try {
        const parsed = JSON.parse(metaData);
        return {
            source: parsed.source || "",
            filename: parsed.filename || "",
            originalname: decodeUnicode(parsed.originalname || ""),
            datasource_url: parsed.datasource_url || "",
            datasource_name: parsed.datasource_name || "",
            upload_documents_id: parsed.upload_documents_id || "",
            upload_folder_id: parsed.upload_folder_id || "",
            datasets_id: parsed.datasets_id || "",
            chunk_type: parsed.chunk_type || "",
            node_type: parsed.node_type || "",
            node_id: parseInt(parsed.node_id) || null,
        };
    } catch (error) {
        console.error("Error parsing meta_data:", error);
        return {};
    }
};

// 取得Login Type ID
const getLoginTypeID = async (type) => {
    const loginTypeResult = await LoginType.findOne({
        attributes: ["id"],
        where: {
            type_value: type,
        },
    });
    return loginTypeResult?.dataValues.id || null;
};

// 登入紀錄
const loginRecord = (userID, loginTypeID, name) => {
    console.log("userID, loginTypeID, name", userID, loginTypeID, name);

    try {
        UserLoginRecord.create({
            user_id: userID,
            login_type_id: loginTypeID,
            name,
        });
    } catch (error) {
        console.error("Error creating login record:", error);
    }
};

module.exports = {
    containsPrisonWord,
    processMetaData,
    getLoginTypeID,
    loginRecord,
    getCurrentTimestamp,
};
