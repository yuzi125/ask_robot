import { ref, reactive } from "vue";

export function useChatMarkdown() {
    // 用來存儲已檢測過的訊息結果的映射表
    const markdownCache = reactive(new Map());

    // 複製相關的狀態
    const copyIndex = ref(-1);
    const markdownCopyIndex = ref(-1);

    // 預編譯正則表達式列表（只建立一次）
    const MARKDOWN_PATTERNS = [
        /#{1,6}\s+.+/, // 標題
        /\*\*.+?\*\*/, // 粗體（非貪婪匹配）
        /\*.+?\*/, // 斜體（非貪婪匹配）
        /`[^`]+?`/, // 行內代碼
        /```[\s\S]*?```/, // 代碼塊
        /\[.+?\]\(.+?\)/, // 鏈接（非貪婪匹配）
        /!\[.+?\]\(.+?\)/, // 圖片（非貪婪匹配）
        /^[\s]*[\*\-\+]\s+.+/m, // 無序列表
        /^[\s]*\d+\.\s+.+/m, // 有序列表
        /^[\s]*>\s.+/m, // 引用
        /\|.+?\|.+?\|/, // 表格（非貪婪匹配）
        /^[\s]*-{3,}[\s]*$/m, // 水平線
        /~~.+?~~/, // 刪除線（非貪婪匹配）
    ];

    // 快速檢查的正則表達式，用於初步篩選
    const QUICK_CHECK_PATTERN = /[#*`\[\]>\-~|]/;

    const copyMarkdownContent = (content, index) => {
        if (!content) {
            console.error("沒有找到可複製的 Markdown 內容");
            return;
        }

        navigator.clipboard
            .writeText(content)
            .then(() => {
                markdownCopyIndex.value = index;
                setTimeout(() => {
                    markdownCopyIndex.value = -1;
                }, 2000); // 2秒後重置圖標
            })
            .catch((err) => {
                console.error("無法複製 Markdown 格式: ", err);
            });
    };

    /**
     * 高效率檢測文本是否包含 Markdown 格式
     * 使用快速預檢、緩存和提早返回策略
     */
    const containsMarkdown = (text, forceCheck = false) => {
        // 快速檢查：如果不是字符串或為空，立即返回 false
        if (!text || typeof text !== "string") return false;

        // 使用緩存，避免重複檢測相同內容
        const cacheKey = text.substring(0, 50) + text.length; // 使用前50個字符+長度作為簡單的緩存鍵

        if (!forceCheck && markdownCache.has(cacheKey)) {
            return markdownCache.get(cacheKey);
        }

        // 快速檢查：尋找常見的 Markdown 標記字符，如果沒有，直接返回 false
        if (!QUICK_CHECK_PATTERN.test(text)) {
            markdownCache.set(cacheKey, false);
            return false;
        }

        // 長文本進行更精確的樣本檢查（避免檢查整個長文本）
        if (text.length > 1000) {
            // 僅檢查前500和後500個字符，對大多數情況已足夠
            const firstPart = text.substring(0, 500);
            const lastPart = text.substring(text.length - 500);

            // 如果樣本中發現 Markdown，儲存結果並返回
            for (const pattern of MARKDOWN_PATTERNS) {
                if (pattern.test(firstPart) || pattern.test(lastPart)) {
                    markdownCache.set(cacheKey, true);
                    return true;
                }
            }
        } else {
            // 對較短的文本進行完整檢查
            for (const pattern of MARKDOWN_PATTERNS) {
                if (pattern.test(text)) {
                    markdownCache.set(cacheKey, true);
                    return true;
                }
            }
        }

        // 如果沒有匹配項，儲存結果並返回 false
        markdownCache.set(cacheKey, false);
        return false;
    };

    /**
     * 優化：批次檢測多筆訊息，並在空閒時間執行
     * @param {Array} messages 訊息列表
     */
    const batchDetectMarkdown = (messages) => {
        if (!messages || !messages.length) return;

        // 使用 requestIdleCallback 在瀏覽器空閒時執行
        const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

        idleCallback(() => {
            const startTime = performance.now();
            const timeLimit = 50; // 限制每批處理的時間上限（毫秒）

            let i = 0;
            const processChunk = () => {
                while (i < messages.length) {
                    const msg = messages[i];
                    i++;

                    // 檢查訊息中的所有資料項
                    if (msg.message && Array.isArray(msg.message)) {
                        for (const item of msg.message) {
                            if (item.data) {
                                // 預先檢測並緩存結果
                                containsMarkdown(item.data);
                            }
                        }
                    }

                    // 檢查是否已超過時間限制
                    if (performance.now() - startTime > timeLimit) {
                        // 如果超過時間限制，則安排下一批處理
                        idleCallback(processChunk);
                        return;
                    }
                }
            };

            processChunk();
        });
    };

    /**
     * 複製文本內容
     */
    const copyText = (event, index) => {
        if (!event || typeof index !== "number") return;

        // 獲取要複製的文本
        const content = document.querySelector(`.messages-item-${index} .text.bot .mkd`).textContent;

        navigator.clipboard
            .writeText(content)
            .then(() => {
                copyIndex.value = index;
                setTimeout(() => {
                    copyIndex.value = -1;
                }, 2000); // 2秒後重置圖標
            })
            .catch((err) => {
                console.error("無法複製文本: ", err);
            });
    };

    /**
     * 複製 Markdown 格式
     * @param {Event} event - 點擊事件
     * @param {number} index - 訊息索引
     * @param {Array} messagesArr - 消息數組（可選，如果在父組件提供）
     */
    const copyMarkdown = (event, index, messagesArr = null) => {
        if (!event || typeof index !== "number") return;

        // 從 DOM 獲取原始 Markdown（更可靠的方法）
        console.log("event", event.target);
        const messageElement = event.target.closest(`.messages-item-${index}`);
        if (!messageElement) return;

        // 首先嘗試從事件目標找到最近的數據元素
        const dataElement = event.target.closest("[data-markdown-content]");

        if (dataElement && dataElement.getAttribute("data-markdown-content")) {
            // 如果在元素上找到了原始 Markdown 數據
            const markdownContent = dataElement.getAttribute("data-markdown-content");
            copyMarkdownContent(markdownContent, index);
            return;
        }

        // 備選方法：如果提供了訊息數組，則使用它
        if (messagesArr && Array.isArray(messagesArr)) {
            const messageData = messagesArr[index];
            if (messageData && messageData.message) {
                // 尋找包含數據的項目
                const dataItem = messageData.message.find((item) => item.data);
                if (dataItem) {
                    copyMarkdownContent(dataItem.data, index);
                    return;
                }
            }
        }

        // 最後方法：直接從 DOM 獲取顯示的文本內容（不是最佳方法，但作為後備）
        const markdownElement = messageElement.querySelector(".mkd");
        if (markdownElement) {
            // 注意：這不是原始 Markdown，而是渲染後的 HTML 的文本內容
            copyMarkdownContent(markdownElement.textContent, index);
        }

        // 複製原始 Markdown 內容
        navigator.clipboard
            .writeText(dataItem.data)
            .then(() => {
                markdownCopyIndex.value = index;
                setTimeout(() => {
                    markdownCopyIndex.value = -1;
                }, 2000); // 2秒後重置圖標
            })
            .catch((err) => {
                console.error("無法複製 Markdown 格式: ", err);
            });
    };

    // 清除緩存，用於需要時重新檢測
    const clearMarkdownCache = () => {
        markdownCache.clear();
    };

    return {
        containsMarkdown,
        copyText,
        copyMarkdown,
        batchDetectMarkdown,
        clearMarkdownCache,
        copyIndex,
        markdownCopyIndex,
    };
}
