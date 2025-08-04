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

// 檢查 permission 的 datasets 權限是否包含 userId
function validateDatasetsPermission(datasetsId, userId, permissions) {
    return (
        permissions.datasets && permissions.datasets[datasetsId] && permissions.datasets[datasetsId].includes(userId)
    );
}

// 檢查 permission 的 experts 權限是否包含 userId
function validateExpertPermission(expertId, userId, permissions) {
    return permissions.experts && permissions.experts[expertId] && permissions.experts[expertId].includes(userId);
}

// 檢查 permission 的 skills 權限是否包含 userId
function validateSkillPermission(expertId, userId, permissions) {
    return permissions.skills && permissions.skills[expertId] && permissions.skills[expertId].includes(userId);
}

// 根據使用者權限過濾專家
function filterExpertsByPermission(experts, userId, permissions) {
    return experts.filter((expert) => {
        // 如果專家ID不在權限列表中，保留該專家
        if (!permissions.experts || !permissions.experts[expert.id]) {
            return true;
        }
        // 如果專家ID在權限列表中，檢查是否有權限
        return validateExpertPermission(expert.id, userId, permissions);
    });
}

// 根據使用者權限過濾 datasets
function filterDatasetsByPermission(datasets, userId, permissions) {
    return datasets.filter((dataset) => {
        // 優先檢查 datasets_id，否則檢查 id
        const datasetId = dataset.datasets_id || dataset.id;

        // 如果 datasets_id 或 id 不在權限列表中，保留該數據
        if (!permissions.datasets || !permissions.datasets[datasetId]) {
            return true;
        }

        // 如果 datasets_id 或 id 在權限列表中，檢查是否有權限
        return validateDatasetsPermission(datasetId, userId, permissions);
    });
}
// 根據使用者權限過濾 skills
function filterSkillsByPermission(skills, userId, permissions) {
    // console.log("skilled", skills);
    return skills.filter((skill) => {
        const skillId = skill.skill_id || skill.dataValues.id;

        // 如果技能ID不在權限列表中，保留該技能
        if (!permissions.skills || !permissions.skills[skillId]) {
            return true;
        }
        // 如果技能ID在權限列表中，檢查是否有權限
        return validateSkillPermission(skillId, userId, permissions);
    });
}

/**
 * 根據使用者權限過濾 binds
 * 在專家綁定知識庫的地方 如果已綁定的知識庫或技能 使用者沒有權限 則 disabled: true
 **/
function filterBindsByPermission(binds, userNo, knowledgePermission) {
    return binds.map((bind) => {
        // 如果存在 datasets_id，檢查 datasets 權限
        if (bind.datasets_id) {
            const datasetId = bind.datasets_id;

            // 檢查此 datasets_id 是否存在於權限表中
            if (knowledgePermission.datasets.hasOwnProperty(datasetId)) {
                const hasPermission = knowledgePermission.datasets[datasetId].includes(userNo);

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
                const hasPermission = knowledgePermission.skills[skillId].includes(userNo);

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
    filterDatasetsByPermission,
    filterExpertsByPermission,
    filterBindsByPermission,
    filterSkillsByPermission,
};
