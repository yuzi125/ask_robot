import { inject } from "vue";
export const apiKeyUtils = () => {
    const emitter = inject("emitter");
    const maskApiKey = (key) => {
        if (!key) return "";
        if (key.length <= 11) return key;
        return `${key.slice(0, 7)}...${key.slice(-4)}`;
    };

    // 複製到剪貼板
    const copyApiKey = async (key) => {
        try {
            await navigator.clipboard.writeText(key);
            emitter.emit("openSnackbar", { message: "複製成功", color: "success" });
            return true;
        } catch (err) {
            console.error("複製失敗:", err);
            return false;
        }
    };

    // 狀態顏色
    const getStatusColor = (status) => {
        return status ? "success" : "error";
    };

    // 狀態文字
    const getStatusText = (status) => {
        return status ? "使用中" : "已停用";
    };

    // 日期格式化
    const formatDate = (date) => {
        if (!date) return "";
        return new Date(date).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // 網域驗證
    const isValidDomain = (domain) => {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
        return domainRegex.test(domain);
    };

    return {
        maskApiKey,
        copyApiKey,
        getStatusColor,
        getStatusText,
        formatDate,
        isValidDomain,
    };
};
