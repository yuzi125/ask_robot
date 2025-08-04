const bcrypt = require("bcrypt");

// 散列密碼
async function encryption(pwd) {
    const saltRounds = 10; // 密碼散列過程中的迭代次數
    try {
        const hash = await bcrypt.hash(pwd, saltRounds);
        return hash;
    } catch (error) {
        throw err;
    }
}
// 比對
async function comparePWD(inputPWD, storedHash) {
    try {
        const isMatch = await bcrypt.compare(inputPWD, storedHash);
        return isMatch;
    } catch (error) {
        throw err;
    }
}

module.exports = { encryption, comparePWD };
