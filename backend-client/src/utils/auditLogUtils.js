/**
 * 獲取操作類型對應的顏色配置
 * @param {string} actionType 操作類型代碼
 * @returns {Object} 顏色配置對象，包含 color（顏色名稱）和 textColor（文字顏色）
 */
export const getActionTypeColor = (actionType) => {
    // 根據操作類型代碼配置顏色
    switch (actionType) {
        case "CREATE":
            return { color: "success", textColor: "white" }; // 綠色
        case "UPDATE":
            return { color: "warning", textColor: "white" }; // 黃色
        case "DELETE":
            return { color: "error", textColor: "white" }; // 紅色
        case "READ":
            return { color: "info", textColor: "white" }; // 藍色
        case "UPLOAD":
            return { color: "secondary", textColor: "white" }; // 紫色
        case "DOWNLOAD":
            return { color: "primary", textColor: "white" }; // 主色
        case "LOGIN":
            return { color: "indigo", textColor: "white" }; // 靛藍色
        case "LOGOUT":
            return { color: "grey-darken-1", textColor: "white" }; // 灰色
        case "ENABLE":
            return { color: "teal", textColor: "white" }; // 藍綠色
        case "DISABLE":
            return { color: "amber-darken-2", textColor: "white" }; // 琥珀色
        default:
            return { color: "grey-lighten-1", textColor: "black" }; // 默認淺灰色
    }
};

/**
 * 獲取實體類型對應的顏色配置
 * @param {string} entityType 實體類型代碼
 * @returns {Object} 顏色配置對象，包含 color（顏色名稱）和 textColor（文字顏色）
 */
export const getEntityTypeColor = (entityType) => {
    // 根據操作前綴決定顏色 (CREATE_, UPDATE_, DELETE_ 等)
    if (entityType.startsWith("CREATE_")) {
        return { color: "success", textColor: "white" }; // 綠色
    } else if (entityType.startsWith("UPDATE_")) {
        return { color: "warning", textColor: "white" }; // 黃色
    } else if (entityType.startsWith("DELETE_")) {
        return { color: "error", textColor: "white" }; // 紅色
    } else if (entityType.startsWith("ENABLE_")) {
        return { color: "teal", textColor: "white" }; // 藍綠色
    } else if (entityType.startsWith("DISABLE_")) {
        return { color: "amber-darken-2", textColor: "white" }; // 琥珀色
    } else if (entityType.startsWith("UPLOAD_")) {
        return { color: "secondary", textColor: "white" }; // 紫色
    } else {
        // 如果沒有明確的操作前綴，則使用深灰色
        return { color: "grey-darken-1", textColor: "white" };
    }
};

/**
 * 獲取操作和實體類型組合的顏色配置
 * @param {string} actionType 操作類型代碼
 * @param {string} entityType 實體類型代碼
 * @returns {Object} 顏色配置對象
 */
export const getLogItemColor = (actionType, entityType) => {
    // 優先使用實體類型的顏色
    return entityType ? getEntityTypeColor(entityType) : getActionTypeColor(actionType);
};
