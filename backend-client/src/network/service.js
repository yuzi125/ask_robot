import axios from "@/global/axios";

/**
 * GET 的放這裡
 */

export const fetchExpertData = async (expert_id) => {
    const response = await axios.get(`/expert/expert?expert_id=${expert_id}`);
    return response.data.data[0];
};

export const fetchBindList = async (expert_id) => {
    const response = await axios.get(`/expert/bindList/${expert_id}`);
    return response.data.data;
};

export const fetchExpertList = async () => {
    const response = await axios.get("/expert/expert");
    return response.data.data;
};

export const fetchModelList = async (groupBy = false) => {
    const url = groupBy ? "/model/getModelList?groupBy=true" : "/model/getModelList";

    const response = await axios.get(url);
    return response.data;
};

export const fetchExpertListByModelType = async (modeType) => {
    const response = await axios.get("/model/getModelListByModeType", {
        params: {
            modeType,
        },
    });

    return response.data.data;
};

export const fetchExpertConfigJsonbByExpertId = async (expertId) => {
    const response = await axios.get("/model/getExpertConfigByExpertId", {
        params: {
            expertId,
        },
    });

    return response.data.data;
};

export const fetchUsersWithExperts = async (params) => {
    const response = await axios.get("/usermanage/getUsersWithExperts", {
        params: {
            userType: params.selectedUserType,
            startDate: params.startDate,
            endDate: params.endDate,
            enabledDeleteExpert: params.enabledDeleteExpert,
            page: params.page,
            pageSize: params.pageSize,
            searchQuery: params.searchQuery,
        },
    });
    return response.data;
};

export const fetchUserExpertChat = async (params) => {
    const response = await axios.get("/usermanage/getUserExpertChat", {
        params: {
            userId: params.userId,
            expertId: params.expertId,
            page: params.page,
            pageSize: params.pageSize,
            startDate: params.startDate,
            endDate: params.endDate,
            searchQuery: params.searchQuery,
        },
    });
    return response.data;
};

export const fetchUserExpertChatDates = async (params) => {
    const response = await axios.get("/usermanage/getUserExpertChatDates", {
        params: {
            userId: params.userId,
            expertId: params.expertId,
            startDate: params.startDate,
            endDate: params.endDate,
            searchQuery: params.searchQuery,
        },
    });
    return response.data;
};

export const fetchExpertsWithoutSelf = async (expertId) => {
    const response = await axios.get("/expert/getExpertIdAndNameWithoutSelf", {
        params: { expertId },
    });
    return response.data.data;
};

export const fetchCacheKnowledgeList = async (
    expertId,
    page = 1,
    itemsPerPage = 12,
    searchQuery = "",
    selectedModel,
    sortField,
    sortOrder
) => {
    const response = await axios.get("/expert/getCachedKnowledgeWithRelatedContent", {
        params: {
            expertId,
            page,
            itemsPerPage,
            searchTerm: searchQuery,
            selectedModel,
            sortField,
            sortOrder,
        },
    });
    return response.data;
};
export const fetchCacheChart = async (params) => {
    const response = await axios.post("/expert/cacheChart", JSON.stringify(params));
    return response;
};

export const fetchExpertConfigJsonByExpertId = async (expertId) => {
    const response = await axios.get("/expert/expert", {
        params: { expertId },
    });

    return response.data.data;
};

// 專家頁面，取得使用者評價資訊。
export const fetchUserFeedbackByExpertId = async (data) => {
    const response = await axios.get("/feedback", {
        params: data,
    });

    return response.data.data;
};

// 取得feedback options
export const fetchFeedbackOptions = async () => {
    const response = await axios.get("/feedbackOptions");

    return response.data.data;
};

// 取得feedback admin process
export const fetchFeedbackAdminProcess = async (id) => {
    const response = await axios.get(`/feedbackAdminProcess/${id}`);
    return response;
};

// 取得Google Sheets 連結
export const getGoogleSheetsLink = async () => {
    const response = await axios.get("/getGoogleSheetsLink");
    return response;
};

// feedback匯出
export const exportFeedback = async (params) => {
    const response = await axios.post("/exportFeedback", params);
    return response;
};

// 取得chunks內容
export const fetchChunksContent = async (params) => {
    const response = await axios.post(`/fetchChunksContent`, params);
    return response;
};

// 取得爬蟲文件內容
export const fetchCrawlerDocumentContent = async (
    datasets_id,
    sync_crawler_id,
    page,
    itemsPerPage,
    searchTerm,
    trainingStates,
    crawlerSyncLog
) => {
    const response = await axios.get(`/crawler/${datasets_id}/syncCrawler/${sync_crawler_id}`, {
        params: { page, itemsPerPage, searchTerm, trainingStates, crawlerSyncLog },
    });
    return response.data;
};

// 取得爬蟲附件內容
export const fetchCrawlerAttachmentContent = async (
    datasets_id,
    sync_crawler_id,
    page,
    itemsPerPage,
    searchTerm,
    trainingStates,
    fileExtension
) => {
    const response = await axios.get(`/crawler/${datasets_id}/syncCrawlerAttachment/${sync_crawler_id}`, {
        params: { page, itemsPerPage, searchTerm, trainingStates, fileExtension },
    });
    return response.data;
};

// 取得爬蟲文件標題
export const fetchCrawlerDocumentTitle = async (
    datasets_id,
    sync_crawler_id,
    page,
    itemsPerPage,
    searchTerm,
    trainingStates
) => {
    const response = await axios.get(`/crawler/${datasets_id}/syncCrawler/${sync_crawler_id}/byTitle`, {
        params: { page, itemsPerPage, searchTerm, trainingStates },
    });
    return response.data;
};

export const fetchCrawlerSyncInfo = async (datasets_id, sync_crawler_id) => {
    const response = await axios.get(`/crawler/${datasets_id}/syncCrawler/${sync_crawler_id}/syncCrawlerInfo`);
    return response.data;
};
export const fetchCrawlerSyncInfoByCrawlerId = async (datasets_id, crawler_id) => {
    const response = await axios.get(`/crawler/${datasets_id}/syncCrawler/${crawler_id}/syncCrawlerInfoByCrawlerId`);
    return response.data;
};

export const fetchCrawlerAttachmentSyncInfo = async (datasets_id, sync_crawler_attachment_id) => {
    const response = await axios.get(
        `/crawler/${datasets_id}/syncCrawlerAttachment/${sync_crawler_attachment_id}/syncCrawlerAttachmentInfo`
    );
    return response.data;
};

// 取得爬蟲清單
export const fetchCrawlerList = async (datasets_id) => {
    const response = await axios.get(`/crawler/list?datasetsId=${datasets_id}`);
    if (response.data.code === 0) {
        return response.data.data;
    } else {
        throw new Error(response.data.message);
    }
};

export const fetchCrawlerAttachmentSiteList = async (datasets_id) => {
    const response = await axios.get(`/crawler/attachment/list?datasetsId=${datasets_id}`);

    if (response.data.code === 0) {
        return response.data.data;
    } else {
        throw new Error(response.data.message);
    }
};

// 取得爬蟲同步清單
export const getCrawlerSyncList = async (datasets_id, type = "crawler") => {
    const response = await axios.get(`/crawler/${datasets_id}/syncCrawler?type=${type}`);

    if (response.data.code === 0) {
        return response.data.data;
    } else {
        throw new Error(response.data.message);
    }
};

// 取得爬蟲附件同步清單
export const getCrawlerAttachmentSyncList = async (datasets_id) => {
    const response = await axios.get(`/crawler/${datasets_id}/syncCrawlerAttachment`);

    // 新增：模擬附件數據生成器
    const generateAttachments = (count, siteId) => {
        const types = [
            { ext: ".pdf", prefix: "施政計畫" },
            { ext: ".docx", prefix: "會議記錄" },
            { ext: ".xlsx", prefix: "預算報告" },
            { ext: ".jpg", prefix: "活動照片" },
            { ext: ".zip", prefix: "資料壓縮檔" },
        ];

        const attachments = [];
        for (let i = 0; i < count; i++) {
            const typeIndex = Math.floor(Math.random() * types.length);
            const type = types[typeIndex];
            const year = 100 + Math.floor(Math.random() * 12);
            const fileSize = (Math.random() * 5 + 0.5).toFixed(1);
            const fileUnit = Math.random() > 0.7 ? "MB" : "KB";

            attachments.push({
                id: `${siteId}-${i}`,
                name: `${year}年${type.prefix}_${Math.floor(Math.random() * 1000)}${type.ext}`,
                size: `${fileSize} ${fileUnit}`,
                date: `2023-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(
                    Math.floor(Math.random() * 28) + 1
                ).padStart(2, "0")}`,
                selected: Math.random() > 0.7, // 隨機選擇一些附件
            });
        }

        return attachments;
    };

    if (response.data.code === 0) {
        return response.data.data;
    } else {
        throw new Error(response.data.message);
    }
};

// 取得爬蟲同步清單 by dataset_id
export const getSyncCrawlerListByDatasetCrawlerId = async (datasets_id, crawler_id, params = {}) => {
    const { page = 1, perPage = 10, search = "", states = [] } = params;

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append("page", page);
    queryParams.append("perPage", perPage);

    if (search) {
        queryParams.append("search", search);
    }

    if (states.length > 0) {
        queryParams.append("states", states.join(","));
    }

    const response = await axios.get(`/crawler/${datasets_id}/syncCrawlerLog/${crawler_id}?${queryParams.toString()}`);

    if (response.data.code === 0) {
        return response.data.data;
    } else {
        throw new Error(response.data.message);
    }
};

// 取得爬蟲同步狀態
export const fetchCrawlerSyncTrainingState = async (sync_id) => {
    const response = await axios.get(`/crawler/syncCrawler/${sync_id}`);
    if (response.data.code === 0) {
        return response.data.data;
    } else {
        throw new Error(response.data.message);
    }
};

// 取得爬蟲附件同步狀態
export const fetchCrawlerAttachmentSyncTrainingState = async (sync_id) => {
    const response = await axios.get(`/crawler/syncCrawlerAttachment/${sync_id}`);
    if (response.data.code === 0) {
        return response.data.data;
    } else {
        throw new Error(response.data.message);
    }
};

// 取得datasets overview
export const fetchDatasetsOverview = async (datasets_id) => {
    const response = await axios.get(`/datasets/overview?datasets_id=${datasets_id}`);
    return response.data.data;
};

// 取得datasets chunks
export const fetchDatasetsChunks = async (datasets_id) => {
    const response = await axios.get(`/datasets/chunks?datasets_id=${datasets_id}`);
    return response.data.data;
};

// 取得datasets 嵌入成本
export const fetchDatasetChartData = async (datasets_id, period, subject) => {
    const response = await axios.get(
        `/datasets/chartData?datasets_id=${datasets_id}&period=${period}&subject=${subject}`
    );
    return response.data;
};

/**
 * POST & PUT & DELETE 的放這裡
 */

export const updateExpertConfig = async (model_list_id, expertId, config, defaultName, displayName, modelType) => {
    const response = await axios.put(
        "/model/updateExpertConfig",
        JSON.stringify({
            model_list_id,
            expertId,
            config,
            defaultName,
            modelType,
            displayName,
        })
    );

    return response.data;
};

export const updateExpertCurrentConfig = async (expertId, currentConfig, modelType) => {
    const response = await axios.put(
        "/model/updateExpertCurrentConfig",
        JSON.stringify({
            expertId,
            currentConfig,
            modelType,
        })
    );

    return response.data;
};

export const updateExpertModelParams = async (expertId, modelParams, displayName, modelType, searchKwargs = {}) => {
    let params = {
        expertId,
        modelType,
        displayName,
        modelParams,
    };

    if (modelType === "search") {
        params = {
            ...params,
            searchKwargs,
        };
    }

    const response = await axios.put("/model/updateExpertModelParams", JSON.stringify(params));
    return response.data;
};

export const updateShowExpertRecommendation = async (expertId, showExpertRecommendation) => {
    const response = await axios.put(
        "/expert/updateExpertSharedConfig",
        JSON.stringify({ expertId, showExpertRecommendation })
    );
    if (response.data.code === 0) {
        return response.data;
    }
    return {};
};

export const updateShowDatasetName = async (expertId, showDatasetName) => {
    const response = await axios.put("/expert/updateExpertSharedConfig", JSON.stringify({ expertId, showDatasetName }));
    if (response.data.code === 0) {
        return response.data;
    }
    return {};
};

export const updateTranslationExpert = async (expertId, translationExpert) => {
    const response = await axios.put("/expert/updateExpertSharedConfig", JSON.stringify({ expertId, translationExpert }));
    if (response.data.code === 0) {
        return response.data;
    }
    return {};
};

export const updateEnableContextHistory = async (expertId, enableContextHistory) => {
    const response = await axios.put(
        "/expert/updateExpertSharedConfig",
        JSON.stringify({ expertId, enableContextHistory })
    );
    if (response.data.code === 0) {
        return response.data;
    }
    return {};
};

export const updateExpertRecommendation = async (expertId, recommendationExpertsId) => {
    const response = await axios.put(
        "/expert/updateExpertSharedConfig",
        JSON.stringify({ expertId, recommendationExpertsId })
    );
    if (response.data.code === 0) {
        return response.data;
    }
    return {};
};

export const updateLinkChunkLevel = async (expertId, linkChunkLevel) => {
    const response = await axios.put("/expert/updateExpertSharedConfig", JSON.stringify({ expertId, linkChunkLevel }));
    if (response.data.code === 0) {
        return response.data;
    }
    return {};
};

export const updateExpertConfigJsonCache = async (expertId, configJsonCache) => {
    const response = await axios.put(
        "/expert/updateExpertConfigJsonCache",
        JSON.stringify({ expertId, configJsonCache })
    );

    return response.data;
};

export const exportExpertModel = async (expertId, modelType, displayName, modelParams) => {
    const response = await axios.put(
        "/model/exportExpertModel",
        JSON.stringify({ expertId, modelType, displayName, modelParams })
    );

    return response.data;
};

export const deleteExpertModelByName = async (expertId, modelType, displayName) => {
    const response = await axios.delete("/model/deleteExpertModelByName", {
        data: {
            expertId,
            modelType,
            displayName,
        },
    });
    return response.data;
};

export const deleteCacheKnowledge = async (expertId, knowledgeId = []) => {
    const response = await axios.delete("/expert/deleteCachedKnowledge", {
        data: {
            expertId,
            knowledgeId,
        },
    });
    return response.data;
};

export const updateAdminProcess = async (params) => {
    const response = await axios.post("/feedbackProcess", JSON.stringify(params));
    return response;
};

export const updateFeedbackTags = async (params) => {
    const response = await axios.put("/updateFeedbackTags", JSON.stringify(params));
    return response;
};

export const fetchFeedbackChart = async (params) => {
    const response = await axios.post("/feedbackChart", JSON.stringify(params));
    return response;
};

export const getChunkByLinkLevel = async (params) => {
    const response = await axios.post("/expert/getChunkByLinkLevel", JSON.stringify(params));
    return response;
};

// 封鎖IP相關
export const getBanIPList = async () => {
    const response = await axios.get("/system/getBanIpList");
    return response;
};

export const addBannedIP = async (params) => {
    const response = await axios.post("/system/createBanIpListItem", JSON.stringify(params));
    return response;
};

export const editBanIP = async (params) => {
    const response = await axios.put("/system/updateBanIpListItem", JSON.stringify(params));
    return response;
};

export const deleteBanIP = async (params) => {
    const response = await axios.delete("/system/deleteBanIpListItem", { data: params });
    return response;
};

export const updateBanRuleSettings = async (params) => {
    const response = await axios.put("/system/updateBanRuleSettings", JSON.stringify(params));
    return response;
};

// LINE BOT 相關
export const getExpertsAndSetting = async () => {
    const response = await axios.get("/system/getExpertsAndSetting");
    return response;
};

export const updateLineExpert = async (params) => {
    const response = await axios.put("/system/setLineExpert", JSON.stringify(params));
    return response;
};

export const updateLineSetting = async (params) => {
    const response = await axios.put("/system/updateLineSetting", JSON.stringify(params));
    return response;
};
