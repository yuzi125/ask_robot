export function clearLocalStorageKeepKey(roomId, SSO_TYPE) {
    const keysToKeep = [
        "chatZoom-",
        "chatFontSize-",
        "ava-theme-",
        "ava-theme",
        "msg_",
        "context_",
        "tunnel_",
        "_iframeSize",
        "iframeChatPartnerRoomId",
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

    // 清空單一聊天室訊息
    localStorage.removeItem(`msg_${roomId}`);
    localStorage.removeItem(`context_${roomId}`);
    localStorage.removeItem(`tunnel_${roomId}`);

    if (SSO_TYPE?.toLowerCase() !== "kcg") {
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
