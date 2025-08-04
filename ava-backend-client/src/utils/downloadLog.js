// 通用的下載文件函數
export async function downloadLogFile(axios, apiPath, requestData, filename, emitter) {
    try {
        const response = await axios.post(
            apiPath, // API 路徑
            requestData, // 傳遞的參數
            {
                responseType: "blob", // 確保接收的是文件數據
                validateStatus: function (status) {
                    return (status >= 200 && status < 300) || status !== undefined;
                },
            }
        );

        // 如果請求成功，處理返回的 blob 文件
        if (response.status === 200) {
            const blob = new Blob([response.data], { type: "text/plain" });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", filename); // 設置下載文件的名稱
            document.body.appendChild(link);
            link.click();
            link.remove(); // 下載完成後移除元素
            emitter.emit("openSnackbar", { message: "文件已下載", color: "success" });
        } else {
            // 如果狀態碼不是 200，處理錯誤情況
            const reader = new FileReader();
            reader.onload = function () {
                const errorMsg = reader.result || `下載失敗: 狀態碼 ${response.status}`;
                emitter.emit("openSnackbar", { message: errorMsg, color: "error" });
                console.error("下載失敗:", errorMsg);
            };
            reader.readAsText(response.data); // 解析錯誤訊息
        }
    } catch (error) {
        if (error.response) {
            const reader = new FileReader();
            reader.onload = function () {
                const errorMsg = reader.result || "發生未知錯誤";
                emitter.emit("openSnackbar", { message: `下載失敗: ${errorMsg}`, color: "error" });
                console.error("下載失敗:", errorMsg);
            };
            reader.readAsText(error.response.data); // 將 blob 轉換為文本以顯示錯誤訊息
        } else if (error.request) {
            emitter.emit("openSnackbar", { message: "下載失敗: 沒有回應", color: "error" });
            console.error("下載失敗: 沒有回應", error.request);
        } else {
            emitter.emit("openSnackbar", { message: `下載失敗: ${error.message}`, color: "error" });
            console.error("下載失敗:", error.message);
        }
    }
}
