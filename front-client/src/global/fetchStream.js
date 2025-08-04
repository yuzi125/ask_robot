const timeOut = 60000;
let controller;
let interval;

import { marked } from "marked";

const isIframe = window !== window.parent;

export function stopFetchStream() {
    clearInterval(interval);
    controller.abort();
}

export function fetchStream(formData, callback) {
    // controller = new AbortController();
    // let runTime = 0;
    // if (interval) {
    //     console.log("fetchStream  interval: ", interval);
    //     // return;
    //     console.log("runTime", runTime);
    // } else {
    //     interval = setInterval(() => {
    //         runTime += 1000;
    //         if (runTime >= timeOut) {
    //             clearInterval(interval);
    //             controller.abort();
    //             // showMsg("api伺服器無回應，請稍後再試");
    //             showMsg("Api伺服器無回應，請稍後再試");
    //             return;
    //         }
    //     }, 1000);
    // }
    controller = new AbortController();
    let timeoutId;
    function resetTimeout() {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            controller.abort();
            showMsg("系統正忙碌奔走中，請您稍待片刻，我們會盡快為您服務！", "normal");
        }, timeOut);
    }
    function showMsg(msg, type) {
        const markedMsg = marked(msg);

        if (type === "normal") {
            msg = ['{ "type": "data" }', `<div class='primary'>${markedMsg}</div>`];
        } else {
            msg = ['{ "type": "data" }', `<div class='error' style='color:red'>${markedMsg}</div>`];
        }
        msg.forEach((item) => {
            callback(item, true);
        });
        callback(true, true);
    }

    resetTimeout();

    const decoder = new TextDecoder("utf-8"); // 在外部創建一個 TextDecoder 實例

    fetch("/ava/chat/bot/avaTextGeneration", {
        method: "post",
        mode: "cors",
        body: formData,
        signal: controller.signal,
        headers: {
            isIframe: isIframe.toString(),
        },
        credentials: "include", // 設置為 'include' 以攜帶 Cookie
    })
        .then(async function (response) {
            resetTimeout(); // 重置超時

            if (response.redirected === true) {
                console.log("/api not logged in.");
                window.location.href = response.url; // TODO: keep formData in the message bar after relogin
                // window.open(response.url);
                return;
            }
            // if (response.status === 500) {
            //     showMsg("伺服器錯誤:500");
            //     clearInterval(interval);
            //     return;
            // }

            if (response.status === 400) {
                const jsonResponse = await response.json();
                if (jsonResponse.message) {
                    showMsg(`錯誤: ${jsonResponse.message}`);
                }
                clearInterval(interval);
                clearTimeout(timeoutId);
                return;
            }
            // 進入隧道模式 檢查到 401 的話要跳轉
            if (response.status === 401) {
                const jsonResponse = await response.json();
                if (jsonResponse?.Location && jsonResponse.Location !== "") {
                    window.location.href = jsonResponse.Location;
                } else {
                    if (jsonResponse?.isIframe) {
                        window.parent.postMessage({ type: "sessionExpired" }, "*");
                        // console.log("isIframe");
                    }
                }
                return;
            }

            if (response.status === 429) {
                const jsonResponse = await response.json();
                if (jsonResponse.error) {
                    const errorMessage = jsonResponse.error || "系統忙碌中，請稍後再試";
                    showMsg(errorMessage);
                    console.log(`系統忙碌中: ${jsonResponse.error}`);
                }
                clearInterval(interval);
                clearTimeout(timeoutId);
                return;
            } else if (response.status === 403) {
                const jsonResponse = await response.json();
                if (jsonResponse.error) {
                    showMsg(jsonResponse.error);
                }
                clearInterval(interval);
                clearTimeout(timeoutId);
                return;
            } else if (response.status != 200) {
                showMsg("伺服器錯誤 無法連線Api Server 錯誤代碼:" + response.status + " 請聯絡管理員");
                clearInterval(interval);
                clearTimeout(timeoutId);
                return;
            }
            // if (response.status === 302) {
            //     window.location.href = response.headers['Location']
            //     return ;
            // }
            const reader = response.body.getReader();
            let dataReceived = false;
            function processResult(result) {
                resetTimeout(); // 每次收到數據時重置超時
                //若有任一傳過來則取消計時器
                if (dataReceived === false) {
                    dataReceived = true;
                    // clearInterval(interval);
                }
                // runTime = 0;
                if (result.done) {
                    console.log("接收完畢");
                    clearInterval(interval);
                    clearTimeout(timeoutId);
                    callback(true, false);
                    return;
                }

                const data = decoder.decode(result.value, { stream: true });

                // console.log("收到資料 => ", data);
                // 每次下來都是字串
                // 或者 是<type></end>
                let dataArr = data.split("</end>");
                // console.log("dataArr: ", dataArr);
                // callback(dataArr);
                dataArr.forEach((item) => {
                    if (dataArr.length > 1) {
                        // 第二個參數 false 代表已經結束
                        callback(item, false);
                    } else if (item !== "") {
                        // 第二個參數 true 代表如果還在串流中 還沒結束
                        callback(item, true);
                    }
                    // callback(item, msg.time);
                });
                reader.read().then(processResult);
            }

            reader.read().then(processResult);
        })
        .catch(function (error) {
            clearTimeout(timeoutId);
            console.log(error.message);
            if (error.message === "The user aborted a request.") {
                // showMsg("終止連線");
                return;
            }
            if (error.name === "AbortError") {
                console.log("請求被中止");
                return;
            }
            showMsg("連線被終止，請確認是否有登入，如狀況還是無法解決，請聯絡管理員");
        });
}

//使用範例 傳回來 ===true時代表結束 一定要3個===
//////////////////////////////////////////////////////////////////////////
// const formData = new FormData();
// formData.append("message", JSON.stringify({ data: "data", type: "form" }));
// // 使用示例
// fetchWithCallback("/api", { method: "post", mode: "cors", body: formData }, (data) => {
//     if (data === true) {
//         console.log("接收完畢");
//         isWaitRes.value = false;
//         return;
//     }
//     xxx(item);
//     xxx(item,msg.time);
// });
//////////////////////////////////////////////////////////////////////////

// formData.append("expert_id", "erp");
// formData.append("expert_id", "ava");
// formData.append("expert_id", "a58d56db-2fda-4520-b4cf-7a272a4a1a62"); // ava
// formData.append("expert_id", "4373cbe5-41b0-4dba-bb75-a413fc887140"); // erp

// 生成一个足够唯一的 boundary
//   const boundary = "----WebKitFormBoundary" + Math.random().toString(16).slice(2);

// 使用循环构建请求体
//   let requestBody = '';
//   formData.keys().forEach(key => {
//     requestBody += `--${boundary}\r\n`;
//     requestBody += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
//     requestBody += `${formData.get(key)}\r\n`;
//   });
//   // 新增结束boundary
//   requestBody += `--${boundary}--`;
//   console.log('requestBody: ',requestBody);

// var myHeaders = new Headers();
// myHeaders.append('Content-Type', 'charset=utf-8');
// let body_obj ={}
// for (var pair of formData.entries()) {
//     body_obj[pair[0]] = pair[1]
// }
