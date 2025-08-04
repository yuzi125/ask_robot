export const getFileIcon = (fileType) => {
    console.log("fileType: ", fileType);
    if (fileType === "application/pdf") {
        return "fa-solid fa-file-pdf";
    } else if (fileType.includes("word") || fileType.includes("document")) {
        return "fa-solid fa-file-word";
    } else if (fileType === "text/plain") {
        return "fa-solid fa-file-lines";
    } else if (fileType.includes("spreadsheet") || fileType.includes("excel")) {
        return "fa-solid fa-file-excel";
    } else if (fileType.includes("presentation") || fileType.includes("powerpoint")) {
        return "fa-solid fa-file-powerpoint";
    } else if (fileType.includes("image")) {
        return "fa-solid fa-file-image";
    } else if (fileType.includes("audio")) {
        return "fa-solid fa-file-audio";
    } else if (fileType.includes("video")) {
        return "fa-solid fa-file-video";
    } else if (fileType.includes("zip") || fileType.includes("compressed")) {
        return "fa-solid fa-file-zipper";
    } else {
        return "fa-solid fa-file";
    }
};

export const getFileIconTranslation = (fileType) => {
    let icon = "fa-solid fa-file";
    let color = "#607D8B"; // 默認色

    if (fileType.includes("pdf")) {
        icon = "fa-solid fa-file-pdf";
        color = "#FF5252";
    } else if (fileType.includes("word") || fileType.includes("document")) {
        icon = "fa-solid fa-file-word";
        color = "#2196F3";
    } else if (fileType.includes("text/plain")) {
        icon = "fa-solid fa-file-lines";
        color = "#A9A9A9";
    } else if (fileType.includes("spreadsheet") || fileType.includes("excel")) {
        icon = "fa-solid fa-file-excel";
        color = "#4CAF50";
    } else if (fileType.includes("presentation") || fileType.includes("powerpoint")) {
        icon = "fa-solid fa-file-powerpoint";
        color = "#FF9800";
    } else if (fileType.includes("image")) {
        icon = "fa-solid fa-file-image";
        color = "#9C27B0";
    } else if (fileType.includes("audio")) {
        icon = "fa-solid fa-file-audio";
        color = "#E91E63";
    } else if (fileType.includes("video")) {
        icon = "fa-solid fa-file-video";
        color = "#673AB7";
    } else if (fileType.includes("zip") || fileType.includes("compressed")) {
        icon = "fa-solid fa-file-zipper";
        color = "#795548";
    }

    return { icon, color };
};

// 根據檔案類型獲取圖標背景顏色

export const getIconBgColor = (fileType) => {
    if (fileType === "application/pdf") {
        return "#FF5252"; // 明亮的紅色
    } else if (fileType?.includes("word") || fileType?.includes("document")) {
        return "#2196F3"; // 微軟藍
    } else if (fileType === "text/plain") {
        return "#78909C"; // 藍灰色
    } else if (fileType?.includes("spreadsheet") || fileType?.includes("excel")) {
        return "#4CAF50"; // 綠色
    } else if (fileType?.includes("presentation") || fileType?.includes("powerpoint")) {
        return "#FF9800"; // 橙色
    } else if (fileType?.includes("image")) {
        return "#9C27B0"; // 紫色
    } else if (fileType?.includes("audio")) {
        return "#E91E63"; // 粉紅色
    } else if (fileType?.includes("video")) {
        return "#673AB7"; // 深紫色
    } else if (fileType?.includes("zip") || fileType?.includes("compressed")) {
        return "#795548"; // 棕色
    } else {
        return "#607D8B"; // 藍灰色
    }
};

// 輔助函數：根據文件名猜測文件類型
export const getFileTypeFromName = (fileName) => {
    const extension = fileName.split(".").pop().toLowerCase();

    // 常見文件類型映射
    const mimeTypes = {
        txt: "text/plain",
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        svg: "image/svg+xml",
        zip: "application/zip",
        rar: "application/x-rar-compressed",
        mp3: "audio/mpeg",
        mp4: "video/mp4",
    };

    return mimeTypes[extension] || "application/octet-stream";
};

// 輔助函數 - 根據檔案名稱獲取圖標
export const getFileIconByFileName = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();

    if (ext === "pdf") {
        return "fa-solid fa-file-pdf";
    } else if (["doc", "docx"].includes(ext)) {
        return "fa-solid fa-file-word";
    } else if (ext === "txt") {
        return "fa-solid fa-file-lines";
    } else if (["xls", "xlsx"].includes(ext)) {
        return "fa-solid fa-file-excel";
    } else if (["ppt", "pptx"].includes(ext)) {
        return "fa-solid fa-file-powerpoint";
    } else if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
        return "fa-solid fa-file-image";
    } else {
        return "fa-solid fa-file";
    }
};

// 根據檔名獲取圖標背景色
export const getIconBgColorByFileName = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();

    if (ext === "pdf") {
        return "#FF5252"; // 紅色
    } else if (["doc", "docx"].includes(ext)) {
        return "#2196F3"; // 藍色
    } else if (ext === "txt") {
        return "#78909C"; // 灰色
    } else if (["xls", "xlsx"].includes(ext)) {
        return "#4CAF50"; // 綠色
    } else if (["ppt", "pptx"].includes(ext)) {
        return "#FF9800"; // 橙色
    } else if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
        return "#9C27B0"; // 紫色
    } else {
        return "#607D8B"; // 藍灰色
    }
};

export const languages = [
    { code: "zh-TW", name: "繁體中文(zh-TW)" },
    { code: "zh-CN", name: "簡體中文(zh-CN)" },
    { code: "en", name: "英文（English）" },
    { code: "ja", name: "日文（Japanese）" },
    { code: "ko", name: "韓文（Korean）" },
    { code: "fr", name: "法文（French）" },
    { code: "de", name: "德文（German）" },
    { code: "es", name: "西班牙文（Spanish）" },
    { code: "it", name: "義大利文（Italian）" },
    { code: "pt", name: "葡萄牙文（Portuguese）" },
    { code: "ru", name: "俄文（Russian）" },
    { code: "vi", name: "越南文（Vietnamese）" },
    { code: "th", name: "泰文（Thai）" },
    { code: "id", name: "印尼文（Indonesian）" },
    { code: "tr", name: "土耳其文（Turkish）" },
    { code: "ar", name: "阿拉伯文（Arabic）" },
    { code: "hi", name: "印地文（Hindi）" },
    { code: "ms", name: "馬來文（Malay）" },
    { code: "nl", name: "荷蘭文（Dutch）" },
    { code: "sv", name: "瑞典文（Swedish）" },
];
