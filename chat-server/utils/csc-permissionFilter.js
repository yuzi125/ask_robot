/**
 * 權限過濾
 * 如果格式長這樣 代表這個知識庫沒有任何人有權限
 * {
 * "experts" : {
 *    "xxx" : []
 * },
 * "datasets": {
 *    "ced7f0e7-4364-47b7-bcc0-3bcd90ee93fa": []
 *  }
 * }
 * ------------------------------------------------
 * 如果格式長這樣 代表這個知識庫只有IT0218有權限
 * {
 * "experts" : {
 *    "xxx" : []
 * },
 * "datasets": {
 *     "ced7f0e7-4364-47b7-bcc0-3bcd90ee93fa": ["IT0218"]
 *  }
 */

const axios = require("axios");
const { redisClient } = require("../global/redisStore.js");

const CSC_API_HOST = process.env.CSC_API_HOST || "http://localhost:8080";


async function validatePermission(permissions, compNo, userId) {

    function getRedisKey(compNo, userId, groupPermissions) {
        return `csc_permission__${compNo}__${userId}__${groupPermissions.join('_')}}`
    }

    async function setRedisCache(compNo, userId, groupPermissions, seconds, ok) {
        const key = getRedisKey(compNo, userId, groupPermissions);
        console.log("hit cache with key: ", key);
        const value = ok ? "true" : "false";
        try {
            await redisClient.set(key, value, {EX: seconds});
        } catch (error) {
            console.error("Error setting Redis cache:", error);
        }
    }

    async function checkRedisCache(compNo, userId, groupPermissions) {
        const key = await getRedisKey(compNo, userId, groupPermissions);
        try {
            const result = await redisClient.exists(key);
            if (result !== 1) {
                return {ok: false, retry: true};
            }
            
            const value = await redisClient.get(key);
            console.log("hit cache with key-value pair: ", key, value);
            if (value === "true") {
                return {ok: true, retry: false};
            } else {
                return {ok: false, retry: false};
            }
        } catch (error) {
            console.error("Error checking Redis cache:", error);
            return {ok: false, retry: true}; // 發生錯誤時，retry 設為 true 重新請求
        }
    }

    if (!permissions) return false;
    const groupPermissions = permissions.filter(permission => permission.startsWith('#'));
    const userPermissions = permissions.filter(permission => !permission.startsWith('#'));

    // 檢查使用者是否在 userPermissions 中
    if (userPermissions.includes(userId)) return true;
    //  檢查使用者是否在 groupPermissions 中
    if (groupPermissions.length === 0) return false;

    // 若 compNo 是空值或空字串, 將 compNo 設為 0000 (中鋼)
    const normalizedCompNo = (!compNo || compNo === '') ? '0000' : compNo;

    const {ok, retry} = await checkRedisCache(normalizedCompNo, userId, groupPermissions);
    if (!retry) {
        return ok;
    }

    const payload = groupPermissions.map(permission => permission.replace('#', ''));
    const response = await axios({
        method: 'post',
        url: `${CSC_API_HOST}/ds/auth/checkUserAuth`,
        headers: { 'Content-Type': 'application/json','Accept': 'application/json; charset=UTF-8' },
        params: { compId: normalizedCompNo, userId: userId },
        data: JSON.stringify(payload)
    });
    
    /**
     * response.data = {"compId":str,"userId":str,"groupAuth":[{"auth":bool,"group": str}]}
     */
    if (!response || !response.data || !response.data.groupAuth || 
        !Array.isArray(response.data.groupAuth) || response.data.groupAuth.length === 0) {
        return false
    }
    console.log("checkUserAuth response", response.data);
    const pass = response.data.groupAuth.some(group => group.auth === true);
    if (pass) {
        await setRedisCache(compNo, userId, groupPermissions, 30 * 60 , true);
        return true;
    } else {
        await setRedisCache(compNo, userId, groupPermissions, 60, false);
        return false;
    }
}


// 檢查 permission 的 experts 權限是否包含 userId
async function validateExpertPermission(expertId, compNo, userId, permissions) {
    return await validatePermission(permissions.chatExperts[expertId], compNo, userId);
    // return permissions.experts && permissions.experts[expertId] && permissions.experts[expertId].includes(userId);
}



// 根據使用者權限過濾專家
async function filterExpertsByCSCPermission(experts, compNo, userId, permissions) {
    const filteredExperts = [];
    for (const expert of experts) {
        if (!permissions.experts || !permissions.chatExperts[expert.expertId]) {
            filteredExperts.push(expert);
            continue;
        }
        const hasPermission = await validateExpertPermission(expert.expertId, compNo, userId, permissions);
        if (hasPermission) {
            filteredExperts.push(expert);
        }
    }
    return filteredExperts;
}


module.exports = {
    filterExpertsByCSCPermission,
    validatePermission,
};
