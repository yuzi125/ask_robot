// processManager.js
const childProcesses = [];

// 加入子進程
function addChildProcess(child) {
    childProcesses.push(child);
}

// 關閉所有子進程
function terminateAll() {
    console.log("Terminating all child processes...");
    childProcesses.forEach((child) => {
        try {
            child.kill("SIGTERM"); // 發送結束信號
        } catch (err) {
            console.error(`Failed to kill child process: ${err.message}`);
        }
    });
}

// 匯出管理方法
module.exports = {
    addChildProcess,
    terminateAll,
};
