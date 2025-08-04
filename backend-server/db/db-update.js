const pgsql = require("./pgsql");
const fs = require("fs");

const filePath = "./log/sql.log";

const chkLogFolder = function () {
    if (!fs.existsSync("./log")) {
        console.log("建立");
        fs.mkdirSync("./log");
    }
};

const updatedb = async function (sqlArr = []) {
    chkLogFolder();
    if (!Array.isArray(sqlArr)) {
        sqlArr = [sqlArr];
    }
    let rsArr = [];
    for (let i = 0; i < sqlArr.length; i++) {
        let sql = sqlArr[i];
        if (sql === "") continue;
        try {
            console.debug(`[DB_OPERATION] 執行SQL: ${sql}`); // 增加日誌訊息
            let rs = await pgsql.query(sql);
            rsArr.push(rs);
            let message = `${getTime()} - success=>${rs.command || "success"} - sql=>${sql}`;

            fs.appendFileSync(filePath, message + "\r\n", (err) => {
                if (err) {
                    console.error("[DB_OPERATION] 寫入日誌文件時發生錯誤:", err);
                }
            });
        } catch (e) {
            try {
                let message = `${getTime()} - error=>${e.message} - sql=>${sql}`;
                fs.appendFileSync(filePath, message + "\r\n", (err) => {
                    if (err) {
                        console.error("[DB_OPERATION] 寫入日誌文件時發生錯誤:", err);
                    }
                });
            } catch (error) {
                console.error("[DB_OPERATION] 處理錯誤時發生錯誤:", error);
            }
        }
    }
    try {
        fs.appendFileSync(filePath, "\r\n", (err) => {
            if (err) {
                console.error("[DB_OPERATION] 寫入日誌文件時發生錯誤:", err);
            }
        });
    } catch (error) {
        console.error("[DB_OPERATION] 處理結束時發生錯誤:", error);
    }
    return rsArr;
};

function getTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

module.exports = updatedb;
