export function clearLocalStorageKeepKey(SSO_TYPE) {
    const keysToKeep = [
        "chatZoom-",
        "chatFontSize-",
        "ava-theme-",
        "msg_",
        "context_",
        "tunnel_",
        "_iframeXY",
        "_iframeSize",
    ];

    // 保存要保留的值
    const savedValues = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (shouldKeepKey(key, keysToKeep)) {
            savedValues[key] = localStorage.getItem(key);
        }
    }

    // 清除所有 localStorage
    localStorage.clear();

    // 恢復要保留的值
    Object.keys(savedValues).forEach((key) => {
        localStorage.setItem(key, savedValues[key]);
    });

    if (!SSO_TYPE?.toLowerCase() === "kcg") {
        location.reload();
    }
}

export function shouldKeepKey(key, patterns) {
    return patterns.some((pattern) => {
        if (pattern.endsWith("-") || pattern.endsWith("_")) {
            // 處理前綴匹配
            return key.startsWith(pattern);
        } else if (pattern.startsWith("_")) {
            // 處理後綴匹配
            return key.endsWith(pattern);
        } else {
            // 處理精確匹配
            return key === pattern;
        }
    });
}

export function getRedirectUrl() {
    const currentFullUrl = window.location.href;
    const urlObj = new URL(currentFullUrl);
    const domain = urlObj.origin;
    if (domain.includes("localhost")) {
        return "http://localhost:5000/ava/avaClient/";
    } else {
        return `${domain}/ava/avaClient/`;
    }
}

// export function formatChatContent(content) {
//     if (typeof content !== "string") {
//         console.error("Unexpected content type:", typeof content);
//         return String(content);
//     }

//     // 移除字符串首尾的方括號（如果存在）
//     content = content.replace(/^\[|\]$/g, "");

//     // 分割內容，保留引號內的內容完整
//     const splitContent = content.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];

//     let result = [];
//     let currentItem = "";
//     let isInQuotes = false;

//     const parseJSON = (item) => {
//         try {
//             return JSON.parse(item);
//         } catch (e) {
//             return item;
//         }
//     };

//     for (let item of splitContent) {
//         item = item.trim().replace(/^"|"$/g, "");

//         if (item === '"{\\') {
//             isInQuotes = true;
//             currentItem = "{";
//         } else if (isInQuotes && item.endsWith('}"')) {
//             isInQuotes = false;
//             currentItem += item.slice(0, -1);
//             result.push(parseJSON(currentItem));
//             currentItem = "";
//         } else if (isInQuotes) {
//             currentItem += item;
//         } else if (item.startsWith("{") || item.startsWith("[")) {
//             result.push(parseJSON(item));
//         } else if (item === "") {
//             // 忽略空字符串
//         } else {
//             if (currentItem && !currentItem.endsWith(".")) {
//                 currentItem += " ";
//             }
//             currentItem += item;
//             if (item.endsWith(".") || item === ":") {
//                 result.push(currentItem.trim());
//                 currentItem = "";
//             }
//         }
//     }

//     if (currentItem) {
//         result.push(currentItem.trim());
//     }

//     // 將結果轉換為格式化的 HTML
//     const formattedResult = result
//         .map((item) => {
//             if (typeof item === "object") {
//                 return `<pre>${JSON.stringify(item, null, 2)}</pre>`;
//             } else if (typeof item === "string") {
//                 // 轉換 Markdown 風格的鏈接
//                 item = item.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
//                 if (item.match(/^\d+\./)) {
//                     return `<li>${item}</li>`;
//                 } else {
//                     return `<p>${item}</p>`;
//                 }
//             }
//             return item;
//         })
//         .join("\n");

//     return `<div class="structured-content">${formattedResult}</div>`;
// }

export function formatDate(dateString) {
    try {
        // 移除 "Z" 並解析日期，將其視為本地時間
        const localDate = new Date(dateString.replace("Z", ""));

        // 獲取年、月、日
        const year = localDate.getFullYear();
        const month = (localDate.getMonth() + 1).toString().padStart(2, "0");
        const day = localDate.getDate().toString().padStart(2, "0");

        // 獲取小時、分鐘和秒
        let hours = localDate.getHours().toString().padStart(2, "0");
        const minutes = localDate.getMinutes().toString().padStart(2, "0");
        const seconds = localDate.getSeconds().toString().padStart(2, "0");

        // 組合成最終的字符串
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        console.error("錯誤日期格式", error);
        return "無效日期";
    }
}

export function responseNumberFormat(resNum) {
    const number = Number(resNum);
    if (isNaN(number)) {
        return 0;
    }
    return number;
}

export function formatNumber(number) {
    try {
        // 檢查是否為有效數字
        if (isNaN(number) || number === null || number === undefined) {
            return "--";
        }

        // 檢查是否為小數
        if (Number.isInteger(number)) {
            if (number > 1000000000) {
                return (number / 1000000000).toFixed(2) + "B";
            } else if (number > 1000000) {
                return (number / 1000000).toFixed(2) + "M";
            } else {
                // 整數 - 只加上千分位符號
                return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            }
        } else {
            // 小數 - 先將數字格式化到小數點後4位
            const formattedNumber = Number(number).toFixed(4);
            // 將數字分成整數和小數部分
            const [integerPart, decimalPart] = formattedNumber.toString().split(".");
            // 只對整數部分添加千分位符號
            const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            // 如果有小數部分則加回去
            return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
        }
    } catch (error) {
        console.error("數字格式化錯誤", error);
        return "無效數字";
    }
}

export const SUPPORTED_EXTENSIONS = {
    office: ["docx", "xlsx", "pptx"],
    text: ["txt"],
    image: ["jpg", "jpeg", "png", "gif", "webp", "bmp"],
};

// icon 與顏色對應表
const fileTypeMap = [
    { ext: [".pdf"], icon: "fa-solid fa-file-pdf", color: "red" },
    { ext: [".doc", ".docx", ".odt"], icon: "fa-solid fa-file-word", color: "blue" },
    { ext: [".xls", ".xlsx", ".ods"], icon: "fa-solid fa-file-excel", color: "green" },
    { ext: [".png", ".jpg", ".jpeg"], icon: "fa-solid fa-file-image", color: "deep-purple" },
    { ext: [".zip", ".rar"], icon: "fa-solid fa-file-zipper", color: "grey-darken-1" },
    { ext: [".js"], icon: "fa-brands fa-js", color: "yellow-darken-2" },
    { ext: [".css"], icon: "fa-brands fa-css3-alt", color: "light-blue-darken-1" },
    { ext: [".html"], icon: "fa-brands fa-html5", color: "orange-darken-2" },
    { ext: [".php"], icon: "fa-brands fa-php", color: "indigo" },
    { ext: [".py"], icon: "fa-brands fa-python", color: "blue-grey-darken-1" },
    { ext: [".java"], icon: "fa-brands fa-java", color: "deep-orange" },
    { ext: [".c"], icon: "fa-brands fa-c", color: "blue-grey" },
    { ext: [".cpp"], icon: "fa-brands fa-cplusplus", color: "cyan" },
];

// 取得 icon
export function getFileIcon(filename) {
    const ext = filename.toLowerCase();
    const match = fileTypeMap.find(({ ext: exts }) => exts.some((e) => ext.endsWith(e)));
    return match ? match.icon : "fa-solid fa-file-lines";
}

// 取得 icon 顏色（Vuetify class）
export function getFileIconColor(filename) {
    const ext = filename.toLowerCase();
    const match = fileTypeMap.find(({ ext: exts }) => exts.some((e) => ext.endsWith(e)));
    return match ? match.color : "grey";
}

export function getFileExtension(filename, type = "all") {
    const extension = filename.split(".").pop().toLowerCase();

    if (type === "all") {
        const allExtensions = Object.values(SUPPORTED_EXTENSIONS).flat();
        return allExtensions.includes(extension);
    }

    return SUPPORTED_EXTENSIONS[type]?.includes(extension) || false;
}

export function getOutputText(outputData) {
    try {
        let formattedOutput = JSON.parse(outputData);

        // 新格式：直接是物件且包含 return_message
        if (typeof formattedOutput === "object" && !Array.isArray(formattedOutput) && formattedOutput.return_message) {
            return formattedOutput.return_message;
        }

        // 舊格式：陣列格式
        if (Array.isArray(formattedOutput)) {
            let outputText = "";
            let startCombine = false;
            let endCombine = false;
            formattedOutput.forEach((item) => {
                if (item.match(`{"type": "data"}`)) {
                    startCombine = true;
                } else if (item.match(`{"type":`) && startCombine) {
                    endCombine = true;
                } else if (startCombine && !endCombine) {
                    outputText += item;
                }
            });
            return outputText || "查無回覆內容。";
        }

        return "查無回覆內容。";
    } catch (error) {
        console.error("解析輸出數據錯誤:", error);
        return "查無回覆內容。";
    }
}
