class AvaStream {
    constructor(options) {
        this.url = options.url;
        this.apiKey = options['api-key'];
        this.controller = "";
        this.interval = "";
        this.errorColor = "red";
        this.readyStop = false;
        this.runTime = 0;
        this.run = false;
    }
    setErrorColor(color) {
        this.errorColor = color;
    }

    async start(formData, callback) {
        let self = this;
        if(!self.run){
            self.run = true;
        }else{
            return;
        }
        clearInterval(self.interval);
        // if (!self.run) {
        //     self.run = true;
        // } else {
        //     return;
        // }
        const showMsg = (msg) => {
            // msg = [{ type: "data" }, `<p style='color:${this.errorColor}'>${msg}</p>`];
            // msg.forEach((item) => {
            //     callback({value:item});
            // });
            callback({ value: `<p style='color:${self.errorColor}'>${msg}</p>` });
            callback({ done: true });
        };
        const isValidJSON = (str) => {
            try {
                JSON.parse(str);
                return true;
            } catch (e) {
                return false;
            }
        };
        self.controller = new AbortController();
        let timeOut = 30000;
        // let runTime = 0;
        self.interval = setInterval(() => {
            self.runTime += 1000;
            if (self.runTime >= timeOut) {
                clearInterval(self.interval);
                self.controller.abort();
                self.run = false;
                console.log("api伺服器無回應，請稍後再試");
                callback({
                    error: { code: 408, message: "The API server is not responding, please try again later!" },
                });
                return;
            }
        }, 1000);
        // let body_obj = {};
        // for (var pair of formData.entries()) {
        //     body_obj[pair[0]] = pair[1];
        // }
        /* let response = await fetch('http://localhost:8081/ava/chat/user/info',{
            method:"get",
        })
        response = await response.json();
        console.log(response);
        return; */
        fetch(self.url, {
            method: "post",
            mode: "cors",
            // credentials:'include',
            body: formData,
            signal: self.controller.signal,
            headers: {
                'api-key': self.apiKey,
            },
        })
            .then(function (response) {
                if (response.redirected === true) {
                    clearInterval(self.interval);
                    console.log("/api not logged in.");
                    callback({ error: { code: 401, message: "api not logged in" } });
                    return;
                }
                if (response.status != 200) {
                    clearInterval(self.interval);
                    console.log("伺服器錯誤:" + response.status);
                    callback({ error: { code: response.status, message: "server error!" } });
                    return;
                }
                const reader = response.body.getReader();
                function processResult(result) {
                    //若有任一傳過來則計時器歸0
                    self.runTime = 0;
                    if (result.done) {
                        self.run = false;
                        self.runTime = 0;
                        self.readyStop = false;
                        clearInterval(self.interval);
                        callback({ done: true });
                        return;
                    }

                    const data = new TextDecoder("utf-8").decode(result.value);

                    console.log("收到資料 => ", data);
                    let dataArr = data.split("</end>");
                    // dataArr.forEach((item) => {
                    //     if (item !== "" && !isValidJSON(item)) {
                    //         callback({ value: item });
                    //     }
                    // });
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
                    if (!self.readyStop) {
                        reader.read().then(processResult);
                    }
                }

                reader.read().then(processResult);
            })
            .catch(function (error) {
                console.log(error.message);
                if (error.message === "The user aborted a request.") {
                    return;
                }
                callback({ error: { code: 500, message: error.message } });
            });
    }
    stop() {
        if (!this.controller) return;
        this.readyStop = true;
        setTimeout(() => {
            clearInterval(this.interval);
            this.controller.abort();
            this.run = false;
            this.readyStop = false;
        }, 100);
    }
}
