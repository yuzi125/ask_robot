import axios from "@/global/axios";

// 獲取所有群組
export const fetchAllGroups = async ({ page = 1, pageSize = 10, search = "", mode }) => {
    // 確保參數作為查詢字符串傳遞
    const response = await axios.get(`/permission/groups`, {
        params: {
            page,
            pageSize,
            search,
            mode,
        },
        paramsSerializer: (params) => {
            return Object.entries(params)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join("&");
        },
    });

    if (response.data.code !== 0) {
        throw new Error(response.data.message || "獲取群組資料失敗");
    }
    return response.data.data;
};

// 獲取使用者清單(帶分頁和搜尋)
export const fetchUsers = async ({ page = 1, pageSize = 10, search = "" }) => {
    // 確保參數作為查詢字符串傳遞
    const response = await axios.get(`/permission/users`, {
        params: {
            page,
            pageSize,
            search,
        },
        paramsSerializer: (params) => {
            return Object.entries(params)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join("&");
        },
    });

    if (response.data.code !== 0) {
        throw new Error(response.data.message || "獲取使用者清單失敗");
    }
    return response.data.data;
};

// 獲取單一群組
export const fetchGroupById = async (groupId) => {
    const response = await axios.get(`/permission/groups/${groupId}`);
    if (response.data.code !== 0) {
        throw new Error(response.data.message || "獲取群組詳細資料失敗");
    }
    return response.data.data;
};

// 創建新群組
export const createGroup = async (groupData) => {
    const response = await axios.post(`/permission/groups`, groupData);
    if (response.data.code !== 0) {
        throw new Error(response.data.message || "創建群組失敗");
    }
    return response.data.data;
};

// 更新群組 (包含成員更新)
export const updateGroup = async ({ groupId, ...groupData }) => {
    const response = await axios.put(`/permission/groups/${groupId}`, groupData);
    if (response.data.code !== 0) {
        throw new Error(response.data.message || "更新群組失敗");
    }
    return response.data.data;
};

// 刪除群組
export const deleteGroup = async (groupId) => {
    const response = await axios.delete(`/permission/groups/${groupId}`);
    if (response.data.code !== 0) {
        throw new Error(response.data.message || "刪除群組失敗");
    }
    return response.data;
};

// 新增使用者至群組
export const addUserToGroup = async ({ groupId, userNo }) => {
    const response = await axios.post(`/permission/groups/${groupId}/users`, { userNo });
    if (response.data.code !== 0) {
        throw new Error(response.data.message || "新增使用者至群組失敗");
    }
    return response.data.data;
};

// 從群組移除使用者
export const removeUserFromGroup = async ({ groupId, userNo }) => {
    const response = await axios.delete(`/permission/groups/${groupId}/users/${userNo}`);
    if (response.data.code !== 0) {
        throw new Error(response.data.message || "從群組移除使用者失敗");
    }
    return response.data.data;
};
