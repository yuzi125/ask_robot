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

// permissions:str[], compNo:str, userId:str
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

// 檢查 permission 的 datasets 權限是否包含 userId
async function validateDatasetsPermission(datasetsId, compNo, userId, permissions) {
    return await validatePermission(permissions.datasets[datasetsId], compNo, userId);
    // return (
    //     permissions.datasets && permissions.datasets[datasetsId] && permissions.datasets[datasetsId].includes(userId)
    // );
}

// 檢查 permission 的 experts 權限是否包含 userId
async function validateExpertPermission(expertId, compNo, userId, permissions) {
    return await validatePermission(permissions.experts[expertId], compNo, userId);
    // return permissions.experts && permissions.experts[expertId] && permissions.experts[expertId].includes(userId);
}

// 檢查 permission 的 skills 權限是否包含 userId
async function validateSkillPermission(skillId, userId, permissions) {
    return await validatePermission(permissions.skills[skillId], compNo, userId);
    // return permissions.skills && permissions.skills[skillId] && permissions.skills[skillId].includes(userId);
}


// 根據使用者權限過濾專家
async function filterExpertsByCSCPermission(experts, compNo, userId, permissions) {
    const filteredExperts = [];
    for (const expert of experts) {
        if (!permissions.experts || !permissions.experts[expert.id]) {
            filteredExperts.push(expert);
            continue;
        }
        const hasPermission = await validateExpertPermission(expert.id, compNo, userId, permissions);
        if (hasPermission) {
            filteredExperts.push(expert);
        }
    }
    return filteredExperts;
}

// 根據使用者權限過濾 datasets
async function filterDatasetsByCSCPermission(datasets, compNo, userId, permissions) {
    const filteredDatasets = [];
    for (const dataset of datasets) {
        // 優先檢查 datasets_id，否則檢查 id
        const datasetId = dataset.datasets_id || dataset.id;

        // 如果 datasets_id 或 id 不在權限列表中，保留該數據
        if (!permissions.datasets || !permissions.datasets[datasetId]) {
            filteredDatasets.push(dataset);
            continue;
        }

        // 如果 datasets_id 或 id 在權限列表中，檢查是否有權限
        const hasPermission = await validateDatasetsPermission(datasetId, compNo, userId, permissions);
        if (hasPermission) {
            filteredDatasets.push(dataset);
        }
    };
    return filteredDatasets;
}
// 根據使用者權限過濾 skills
async function filterSkillsByCSCPermission(skills, compNo, userId, permissions) {
    const filteredSkills = [];
    for (const skill of skills) {
        const skillId = skill.skill_id || skill.dataValues.id;

        // 如果技能ID不在權限列表中，保留該技能
        if (!permissions.skills || !permissions.skills[skillId]) {
            filteredSkills.push(skill);
            continue;
        }
        // 如果技能ID在權限列表中，檢查是否有權限
        const hasPermission = await validateSkillPermission(skillId, compNo, userId, permissions);
        if (hasPermission) {
            filteredSkills.push(skill);
        }
    };
    return filteredSkills;
}

/**
 * 根據使用者權限過濾 binds
 * 在專家綁定知識庫的地方 如果已綁定的知識庫或技能 使用者沒有權限 則 disabled: true
 **/
async function filterBindsByCSCPermission(binds, compNo, userNo, knowledgePermission) {
    return binds.map(async (bind) => {
        // 如果存在 datasets_id，檢查 datasets 權限
        if (bind.datasets_id) {
            const datasetId = bind.datasets_id;

            // 檢查此 datasets_id 是否存在於權限表中
            if (knowledgePermission.datasets.hasOwnProperty(datasetId)) {
                const hasPermission = await validateDatasetsPermission(datasetId, compNo, userNo, knowledgePermission.datasets[datasetId]);

                if (!hasPermission) {
                    // 如果使用者沒有此 datasets_id 的權限，加入 disabled: true
                    bind.disabled = true;
                } else {
                    // 如果有權限，確保 disabled 為 false
                    bind.disabled = false;
                }
            } else {
                // 如果 datasets_id 沒有在權限表裡，disabled 預設為 false
                bind.disabled = false;
            }
        }

        // 如果存在 skill_id，檢查 skills 權限 (假設未來可能有 knowledgePermission.skills)
        if (bind.skill_id) {
            const skillId = bind.skill_id;

            // 假設未來有 `knowledgePermission.skills` 權限設定
            if (knowledgePermission.skills && knowledgePermission.skills.hasOwnProperty(skillId)) {
                const hasPermission = await validateSkillPermission(skillId, compNo, userNo, knowledgePermission.skills[skillId]);

                if (!hasPermission) {
                    // 如果使用者沒有此 skill_id 的權限，加入 disabled: true
                    bind.disabled = true;
                } else {
                    // 如果有權限，確保 disabled 為 false
                    bind.disabled = false;
                }
            } else {
                // 如果 skill_id 沒有在權限表裡，disabled 預設為 false
                bind.disabled = false;
            }
        }

        return bind;
    });
}
// function filterBindSkillsByPermission(skills, userNo, knowledgePermission) {
//     return skills.map((skill) => {
//         // 取出每個 skill 的 datasetId 進行權限檢查
//         const skillId = skill.id; // 假設每個 skill 也有 datasets_id
//         if (knowledgePermission.datasets.hasOwnProperty(skillId)) {
//             const hasPermission = knowledgePermission.datasets[skillId]?.includes(userNo);

//             if (!hasPermission) {
//                 // 如果沒有權限，則加上 disabled: true
//                 skill.dataValues.disabled = true;
//             } else {
//                 // 如果有權限，確保 disabled 為 false
//                 skill.dataValues.disabled = false;
//             }
//         } else {
//             // 如果 id 沒有在權限表裡，disabled 預設為 false
//             skill.dataValues.disabled = false;
//         }

//         return skill;
//     });
// }

module.exports = {
    filterDatasetsByCSCPermission,
    filterExpertsByCSCPermission,
    filterBindsByCSCPermission,
    filterSkillsByCSCPermission,
    validatePermission,
};
