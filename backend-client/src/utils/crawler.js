export const getChipColor = (training_state) => {
    switch (training_state) {
        case 1:
            return "info";
        case 2:
            return "warning";
        case 3:
            return "success";
        case 8:
            return "secondary";
        case 4:
        case 6:
        case 9:
        case 97:
        case 98:
        case 99:
            return "error";
        default:
            return "warning";
    }
};

export const getChipText = (training_state) => {
    switch (training_state) {
        case 1:
            return "爬蟲執行中";
        case 2:
            return "建立索引中";
        case 3:
            return "索引建立成功";
        case 4:
            return "禁用";
        case 6:
            return "已移除";
        case 7:
            return "正在執行中";
        case 8:
            return "爬蟲無資料";
        case 9:
            return "爬蟲已取消";
        case 10:
            return "系統處理中";
        case 97:
            return "系統錯誤";
        case 98:
            return "爬蟲執行失敗";
        case 99:
            return "文件錯誤";
        default:
            return "上傳成功";
    }
};

export const trainingStateOptions = [
    { title: "爬蟲執行中", value: 1 },
    { title: "建立索引中", value: 2 },
    { title: "索引建立成功", value: 3 },
    { title: "禁用", value: 4 },
    { title: "已移除", value: 6 },
    { title: "正在執行中", value: 7 },
    { title: "爬蟲無資料", value: 8 },
    { title: "爬蟲已取消", value: 9 },
    { title: "系統處理中", value: 10 },
    { title: "系統錯誤", value: 97 },
    { title: "爬蟲執行失敗", value: 98 },
    { title: "文件錯誤", value: 99 },
];

export const fileExtensionOptions = [
    { title: "PDF", value: "pdf" },
    { title: "DOCX", value: "docx" },
    { title: "DOC", value: "doc" },
    { title: "XLSX", value: "xlsx" },
    { title: "XLS", value: "xls" },
    { title: "PPTX", value: "pptx" },
    { title: "PPT", value: "ppt" },
    { title: "TXT", value: "txt" },
    { title: "CSV", value: "csv" },
    { title: "其他", value: "other" },
];

export const formatDeltaToHtml = (delta) => {
    const html = ['<div class="json-diff-container">'];

    const formatValue = (val) => {
        if (val === undefined) return '<span class="diff-undefined">undefined</span>';
        if (val === null) return '<span class="diff-null">null</span>';

        try {
            if (typeof val === "object") {
                return `<pre class="diff-code">${JSON.stringify(val, null, 2)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;")}</pre>`;
            }

            if (typeof val === "string") {
                return `<span class="diff-string">"${val
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;")}"</span>`;
            }

            if (typeof val === "number") {
                return `<span class="diff-number">${val}</span>`;
            }

            if (typeof val === "boolean") {
                return `<span class="diff-boolean">${val}</span>`;
            }

            return String(val)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        } catch (e) {
            return String(val)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
    };

    const formatPath = (path) => {
        return `<span class="diff-path">${path.replace(/\./g, '<span class="path-dot">.</span>')}</span>`;
    };

    const formatNode = (delta, path = "", isArrayItem = false) => {
        if (!delta) return;

        // 處理數組
        if (delta._t === "a") {
            for (const key in delta) {
                if (key === "_t") continue;

                const val = delta[key];
                const itemPath = isArrayItem
                    ? path
                    : (path ? `${path}.` : "") + (key.startsWith("_") ? key.substr(1) : key);

                // 處理移動操作
                if (Array.isArray(val) && val[2] === 3) {
                    html.push(`
                        <div class="diff-line diff-moved">
                                ${formatPath(itemPath)}
                                <div class="diff-operation">
                                <span class="diff-info-label">移動:</span>
                                <span class="diff-info">項目從索引 ${val[1]} 移動到索引 ${
                        key.startsWith("_") ? key.substr(1) : key
                    }</span>
                            </div>
                        </div>`);
                    continue;
                }

                // 處理刪除操作
                if (key.startsWith("_")) {
                    if (Array.isArray(val) && val[2] === 0) {
                        html.push(
                            `<div class="diff-line diff-removed">
                            ${formatPath(itemPath)}
                            <div class="diff-operation">
                                <span class="diff-info-label">刪除:</span>
                                <div class="diff-value-container">
                                ${formatValue(val[0])}
                                </div>
                            </div>
                            </div>`
                        );
                    }
                    continue;
                }

                // 處理新增操作
                if (Array.isArray(val) && val.length === 1) {
                    html.push(`<div class="diff-line diff-added">
            ${formatPath(itemPath)}
            <div class="diff-operation">
              <span class="diff-info-label">新增:</span>
              <div class="diff-value-container">
                ${formatValue(val[0])}
              </div>
            </div>
          </div>`);
                    continue;
                }

                // 處理修改操作
                if (Array.isArray(val) && val.length === 2) {
                    html.push(`<div class="diff-line diff-changed">
            ${formatPath(itemPath)}
            <div class="diff-operation">
             
              <div class="diff-comparison">
                <div class="diff-old-container">
                  <div class="diff-label">修改前</div>
                  <div class="diff-value-container">
                    ${formatValue(val[0])}
                  </div>
                </div>
                <div class="diff-arrow">→</div>
                <div class="diff-new-container">
                  <div class="diff-label">修改後</div>
                  <div class="diff-value-container">
                    ${formatValue(val[1])}
                  </div>
                </div>
              </div>
            </div>
          </div>`);
                    continue;
                }

                // 遞歸處理嵌套對象
                if (typeof val === "object" && val !== null) {
                    formatNode(val, itemPath, true);
                }
            }
            return;
        }

        // 處理對象
        for (const key in delta) {
            const val = delta[key];
            const itemPath = path ? `${path}.${key}` : key;

            // 處理新增操作
            if (Array.isArray(val) && val.length === 1) {
                html.push(`<div class="diff-line diff-added">
          ${formatPath(itemPath)}
          <div class="diff-operation">
            <span class="diff-info-label">新增:</span>
            <div class="diff-value-container">
              ${formatValue(val[0])}
            </div>
          </div>
        </div>`);
                continue;
            }

            // 處理刪除操作
            if (Array.isArray(val) && val.length === 3 && val[2] === 0) {
                html.push(`<div class="diff-line diff-removed">
          ${formatPath(itemPath)}
          <div class="diff-operation">
            <span class="diff-info-label">刪除:</span>
            <div class="diff-value-container">
              ${formatValue(val[0])}
            </div>
          </div>
        </div>`);
                continue;
            }

            // 處理修改操作
            if (Array.isArray(val) && val.length === 2) {
                html.push(`<div class="diff-line diff-changed">
          ${formatPath(itemPath)}
          <div class="diff-operation">
           
            <div class="diff-comparison">
              <div class="diff-old-container">
                <div class="diff-label">修改前</div>
                <div class="diff-value-container">
                  ${formatValue(val[0])}
                </div>
              </div>
              <div class="diff-arrow">→</div>
              <div class="diff-new-container">
                <div class="diff-label">修改後</div>
                <div class="diff-value-container">
                  ${formatValue(val[1])}
                </div>
              </div>
            </div>
          </div>
        </div>`);
                continue;
            }

            // 遞歸處理嵌套對象
            if (typeof val === "object" && val !== null) {
                formatNode(val, itemPath);
            }
        }
    };

    formatNode(delta);
    html.push("</div>");

    return html.join("");
};

// 估計變更數量
export const estimateChangesCount = (delta) => {
    let count = 0;

    const countChanges = (obj) => {
        if (!obj) return;

        if (obj._t === "a") {
            // 處理數組
            for (const key in obj) {
                if (key === "_t") continue;

                const value = obj[key];
                if (Array.isArray(value)) {
                    count++; // 數組元素的每個變化都計數
                } else if (typeof value === "object") {
                    countChanges(value);
                }
            }
        } else if (typeof obj === "object") {
            // 處理對象
            for (const key in obj) {
                const value = obj[key];
                if (Array.isArray(value)) {
                    count++; // 對象屬性的每個變化都計數
                } else if (typeof value === "object") {
                    countChanges(value);
                }
            }
        }
    };

    countChanges(delta);
    return count;
};

export const formatGitStyleDiff = (originalObj, modifiedObj) => {
    // 將兩個對象轉換為格式化的 JSON 字符串
    const originalLines = JSON.stringify(originalObj, null, 2).split("\n");
    const modifiedLines = JSON.stringify(modifiedObj, null, 2).split("\n");

    // 創建差異數組
    const diff = [];
    let inChange = false;
    let changeStart = 0;
    let originalIndex = 0;
    let modifiedIndex = 0;

    // 最大行數，用於行號顯示
    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    const lineNumWidth = String(maxLines).length;

    // 創建行號格式化函數
    const formatLineNum = (num) => {
        return String(num).padStart(lineNumWidth, " ");
    };

    // 逐行比較找出差異
    while (originalIndex < originalLines.length || modifiedIndex < modifiedLines.length) {
        const originalLine = originalIndex < originalLines.length ? originalLines[originalIndex] : null;
        const modifiedLine = modifiedIndex < modifiedLines.length ? modifiedLines[modifiedIndex] : null;

        if (originalLine === modifiedLine) {
            // 行相同，添加上下文行
            if (inChange) {
                inChange = false;
            }
            diff.push({
                type: "context",
                content: originalLine,
                originalNum: originalIndex + 1,
                modifiedNum: modifiedIndex + 1,
            });
            originalIndex++;
            modifiedIndex++;
        } else {
            // 行不同，處理差異
            if (!inChange) {
                inChange = true;
                changeStart = diff.length;
            }

            // 嘗試找到下一個匹配點
            let nextMatchOriginal = -1;
            let nextMatchModified = -1;
            let originalLookAhead = originalIndex;
            let modifiedLookAhead = modifiedIndex;

            const maxLookAhead = 10; // 最大向前查找行數

            for (let i = 1; i <= maxLookAhead && originalLookAhead + i < originalLines.length; i++) {
                const lookAheadLine = originalLines[originalLookAhead + i];
                const modifiedPos = modifiedLines.indexOf(lookAheadLine, modifiedIndex);
                if (modifiedPos !== -1 && modifiedPos - modifiedIndex <= maxLookAhead) {
                    nextMatchOriginal = originalLookAhead + i;
                    nextMatchModified = modifiedPos;
                    break;
                }
            }

            if (nextMatchOriginal === -1) {
                for (let i = 1; i <= maxLookAhead && modifiedLookAhead + i < modifiedLines.length; i++) {
                    const lookAheadLine = modifiedLines[modifiedLookAhead + i];
                    const originalPos = originalLines.indexOf(lookAheadLine, originalIndex);
                    if (originalPos !== -1 && originalPos - originalIndex <= maxLookAhead) {
                        nextMatchOriginal = originalPos;
                        nextMatchModified = modifiedLookAhead + i;
                        break;
                    }
                }
            }

            if (nextMatchOriginal !== -1) {
                // 找到了下一個匹配點，添加刪除和添加行
                for (let i = originalIndex; i < nextMatchOriginal; i++) {
                    diff.push({
                        type: "delete",
                        content: originalLines[i],
                        originalNum: i + 1,
                        modifiedNum: null,
                    });
                }

                for (let i = modifiedIndex; i < nextMatchModified; i++) {
                    diff.push({
                        type: "add",
                        content: modifiedLines[i],
                        originalNum: null,
                        modifiedNum: i + 1,
                    });
                }

                originalIndex = nextMatchOriginal;
                modifiedIndex = nextMatchModified;
            } else {
                // 沒有找到匹配點，假設當前行被修改
                if (originalIndex < originalLines.length) {
                    diff.push({
                        type: "delete",
                        content: originalLines[originalIndex],
                        originalNum: originalIndex + 1,
                        modifiedNum: null,
                    });
                    originalIndex++;
                }

                if (modifiedIndex < modifiedLines.length) {
                    diff.push({
                        type: "add",
                        content: modifiedLines[modifiedIndex],
                        originalNum: null,
                        modifiedNum: modifiedIndex + 1,
                    });
                    modifiedIndex++;
                }
            }
        }
    }

    // 生成 HTML
    let html = '<div class="diff-container">';

    // 添加表頭
    html += `
    <div class="diff-header">
      <div class="diff-file-info">模板配置變更</div>
      <div class="diff-file-paths">
        <div class="diff-original">原始配置</div>
        <div class="diff-modified">修改後配置</div>
      </div>
    </div>
  `;

    // 添加差異內容
    html += '<div class="diff-content">';

    for (let i = 0; i < diff.length; i++) {
        const line = diff[i];
        const originalNum = line.originalNum !== null ? formatLineNum(line.originalNum) : "";
        const modifiedNum = line.modifiedNum !== null ? formatLineNum(line.modifiedNum) : "";

        if (line.type === "context") {
            html += `
        <div class="diff-line diff-context">
          <div class="diff-line-num diff-line-num-original">${originalNum}</div>
          <div class="diff-line-num diff-line-num-modified">${modifiedNum}</div>
          <div class="diff-line-content">${escapeHtml(line.content)}</div>
        </div>
      `;
        } else if (line.type === "delete") {
            html += `
        <div class="diff-line diff-delete">
          <div class="diff-line-num diff-line-num-original">${originalNum}</div>
          <div class="diff-line-num diff-line-num-modified"></div>
          <div class="diff-line-content"><span class="diff-delete-marker">-</span>${escapeHtml(line.content)}</div>
        </div>
      `;
        } else if (line.type === "add") {
            html += `
        <div class="diff-line diff-add">
          <div class="diff-line-num diff-line-num-original"></div>
          <div class="diff-line-num diff-line-num-modified">${modifiedNum}</div>
          <div class="diff-line-content"><span class="diff-add-marker">+</span>${escapeHtml(line.content)}</div>
        </div>
      `;
        }
    }

    html += "</div>"; // 關閉 diff-content
    html += "</div>"; // 關閉 diff-container

    return html;
};

// 輔助函數：轉義 HTML 特殊字符
const escapeHtml = (text) => {
    if (text === null) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/ /g, "&nbsp;")
        .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
};
