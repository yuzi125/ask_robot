const { Writable } = require("stream");
const crypto = require("crypto");

function getSecureRandomInt(min, max) {
    return crypto.randomInt(min, max);
}

function getContentType(response) {
    const rawHeaders = response.request.res.rawHeaders;
    for (let i = 0; i < rawHeaders.length; i += 2) {
        if (rawHeaders[i].toLowerCase() === "content-type") {
            return rawHeaders[i + 1].toLowerCase();
        }
    }
    return null;
}

function isEventStream(response) {
    const contentType = getContentType(response);
    return contentType && contentType.includes("text/event-stream");
}

function isJSON(s) {
    try {
        return JSON.parse(s);
    } catch (error) {
        return false;
    }
}

function createWritableStream(res, isStreaming, stream, enableCacheStreamingReply) {
    let data = "";
    return new Writable({
        write(chunk, encoding, callback) {
            const chunkStr = chunk.toString();

            if (stream === "false") {
                data += chunk.toString();
                callback();
            } else {
                if (isStreaming) {
                    // 串流數據：直接發送
                    res.write(chunkStr);
                    callback();
                } else if (enableCacheStreamingReply) {
                    // 快取數據且啟用了串流式回覆：使用 slowSend
                    slowSend(res, chunkStr, callback);
                } else {
                    // 快取數據但未啟用串流式回覆：直接發送
                    res.write(chunkStr);
                    callback();
                }
            }
        },
        final(callback) {
            if (stream === "false") {
                let arr = data.split("</end>");
                for (let i = 0; i < arr.length; i++) {
                    let temp = isJSON(arr[i]);
                    if (temp) {
                        arr[i] = temp;
                        if (arr[i].type === "data") {
                            arr[i].data = arr[i + 1];
                            arr.splice(i + 1, 1);
                        }
                    }
                }
                arr.pop();
                res.json(arr);
            } else {
                res.end();
            }
            callback();
        },
    });
}
function slowSend(res, data, callback) {
    const parts = data.split("</end>");

    const sendSlowly = (index) => {
        if (index >= parts.length) {
            callback();
            return;
        }

        let part = parts[index].trim();

        if (part.startsWith('{"type": "data"}')) {
            // 對於 "data" 類型，保留 {"type": "data"} 並逐字符發送剩餘內容
            res.write('{"type": "data"}');
            res.write("</end>");
            part = parts[index + 1];
            const content = part.replace('{"type": "data"}', "").trim();

            // 設定 1 秒 不然會撞到 res.write('{"type": "data"}');
            setTimeout(() => {
                sendCharByChar(res, content, () => {
                    res.write("</end>");
                    // 發送完訊息後 把這筆訊息從陣列移除 不然會有一模一樣的訊息
                    parts.splice(index + 1, 1);
                    setTimeout(() => sendSlowly(index + 1), 50);
                });
            }, 1000);
        } else {
            // 其他類型直接發送
            res.write(part);
            res.write("</end>");
            setTimeout(() => sendSlowly(index + 1), 50);
        }
    };

    sendSlowly(0);
}

function sendCharByChar(res, content, callback) {
    const chars = content.split("");
    let index = 0;

    const sendNextChars = () => {
        if (index >= chars.length) {
            callback();
            return;
        }

        // 決定這次要發送的字符數量（1到5之間的隨機數）
        const charsToSend = Math.min(getSecureRandomInt(1, 6), chars.length - index);
        // 發送決定的字符數量
        const chunk = chars.slice(index, index + charsToSend).join("");
        res.write(chunk);

        // 更新索引
        index += charsToSend;

        // 設置下一次發送的延遲
        // 我們可以根據發送的字符數量來調整延遲，使總體速度保持相對一致
        const delay = 10 * charsToSend;
        setTimeout(sendNextChars, delay);
    };

    sendNextChars();
}

module.exports = {
    isEventStream,
    createWritableStream,
};
