const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const logRouteDetails = require("../routeNameLog");
const { logActivity, AUDIT_LOG_ACTION_TYPE, AUDIT_LOG_ENTITY_TYPE } = require("../../utils/auditLog");

// 用於遮蔽API密鑰的功能，只顯示前3個字符，其餘用星號代替
function maskApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== "string" || apiKey.length <= 3) {
        return apiKey;
    }
    return apiKey.substring(0, 3) + "*".repeat(apiKey.length - 3);
}

// 遞迴遍歷對象并遮蔽所有API密鑰
function maskApiKeysInObject(obj) {
    if (!obj || typeof obj !== "object") {
        return obj;
    }

    // 處理對象
    if (!Array.isArray(obj)) {
        const result = { ...obj };
        for (const key in result) {
            if (key === "api_key") {
                result[key] = maskApiKey(result[key]);
            } else if (typeof result[key] === "object") {
                result[key] = maskApiKeysInObject(result[key]);
            }
        }
        return result;
    }

    // 處理數組
    return obj.map((item) => maskApiKeysInObject(item));
}
const AUDIT_LOG_TARGET_CATEGORY = "expert";

exports.getModelList = async (req, res) => {
    logRouteDetails("modelController.getModelList", req);
    let rsmodel = new responseModel();
    const { groupBy, includeDisabled } = req.query;
    console.info("modelController.getModelList: ", req.query);

    try {
        // 根據參數決定是否加上 GROUP BY 和 WHERE 條件
        let whereClause = includeDisabled === "true" ? "" : "WHERE is_enable = 1";
        
        let sqlstr =
            groupBy === "true"
                ? `SELECT model_name FROM model_list ${whereClause} GROUP BY model_name`
                : `SELECT * FROM model_list ${whereClause} ORDER BY id`;

        let rs = await sql.query(sqlstr);

        if (rs.rowCount > 0) {
            rsmodel.data = rs.rows;
            if (groupBy === "true") {
                rsmodel.data = [
                    { title: "All", value: "All" },
                    ...rs.rows.map((row) => ({
                        title: row.model_name,
                        value: row.model_name,
                    })),
                ];
            } else {
                // 處理API密鑰敏感信息
                rsmodel.data = maskApiKeysInObject(rsmodel.data);
            }
            rsmodel.code = 0;
        } else {
            rsmodel.data = [];
            rsmodel.code = 0;
        }
    } catch (err) {
        console.error(err);
        rsmodel.code = 1;
        rsmodel.message = "資料庫查詢失敗";
    }

    res.json(rsmodel);
};

exports.getModelListGroup = async (req, res) => {
    logRouteDetails("modelController.getModelListGroup", req);
    let rsmodel = new responseModel();
    try {
        let sqlstr = "SELECT model_name from model_list WHERE is_enable = 1 GROUP BY model_name";
        let rs = await sql.query(sqlstr);
        rsmodel.data = rs.rows;
        rsmodel.code = 0;
    } catch (error) {
        console.error(error);
    }
    res.json(rsmodel);
};

exports.getModelListByModeType = async (req, res) => {
    logRouteDetails("modelController.getModelListByModeType", req);
    let rsmodel = new responseModel();

    const modeType = req.query.modeType;
    console.info("modelController.getModelListByModeType: ", req.query);

    try {
        let sqlstr = "SELECT * from model_list WHERE is_enable = 1 and model_type = $1 ORDER BY model_name";
        let rs = await sql.query(sqlstr, [modeType]);

        if (rs.rowCount > 0) {
            // 對每個模型配置進行處理，檢查並遮蔽API密鑰
            const processedRows = rs.rows.map((row) => {
                const rowCopy = { ...row };

                // 如果config是字符串格式的JSON，先解析
                if (rowCopy.config && typeof rowCopy.config === "string") {
                    try {
                        const configObj = JSON.parse(rowCopy.config);
                        // 遮蔽API密鑰
                        const maskedConfig = maskApiKeysInObject(configObj);
                        // 轉回字符串
                        rowCopy.config = JSON.stringify(maskedConfig);
                    } catch (e) {
                        console.error("Error parsing config JSON:", e);
                    }
                } else if (rowCopy.config && typeof rowCopy.config === "object") {
                    // 如果已經是對象，直接處理
                    rowCopy.config = maskApiKeysInObject(rowCopy.config);
                }

                return rowCopy;
            });

            rsmodel.data = processedRows;
            rsmodel.code = 0;
        }
    } catch (error) {
        console.error(error);
    }

    res.json(rsmodel);
};

exports.getExpertConfigByExpertId = async (req, res) => {
    logRouteDetails("modelController.getExpertConfigByExpertId", req);
    let rsmodel = new responseModel();

    const expert_id = req.query.expertId;

    try {
        let sqlstr = "SELECT config_jsonb from expert WHERE id = $1";
        let rs = await sql.query(sqlstr, [expert_id]);

        if (rs.rowCount > 0) {
            rsmodel.data = rs.rows[0]["config_jsonb"];
            rsmodel.code = 0;
        }
    } catch (error) {
        console.error(error);
    }

    res.json(rsmodel);
};
exports.updateExpertConfig = async (req, res) => {
    logRouteDetails("modelController.updateExpertConfig", req);
    let rsmodel = new responseModel();

    try {
        let {
            model_list_id,
            expertId,
            config: updateConfig,
            defaultName,
            displayName,
            modelType,
        } = JSON.parse(req.body);
        console.info("modelController.updateExpertConfig: ", JSON.parse(req.body));
        const { top_p, max_tokens, temperature, default_system_prompt, system_prompt, frequency_penalty, base_url } =
            updateConfig;
        const currentTime = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString();
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;

            // 如果沒有傳 displayName 過來，就用預設的模型名稱當 displayName。
            if (displayName === "") {
                displayName = defaultName;
            }

            // 檢查名稱是否有重複
            if (config[modelType]) {
                let isDuplicate = Object.keys(config[modelType]).some((key) => key === displayName);
                if (isDuplicate) {
                    rsmodel.code = 1;
                    rsmodel.message = "Display name already exists";
                    rsmodel.isDuplicate = true;
                    res.json(rsmodel);
                    return;
                }
            }

            if (!config[modelType]) {
                // 如果 modelType 不存在，初始化這個新的 modelType
                config[modelType] = {};
                config[modelType]["current_config"] = displayName;
            }

            selectSql = "SELECT name FROM model_list WHERE id = $1";
            selectResult = await sql.query(selectSql, [model_list_id]);

            const newConfig = {
                model_list_id: model_list_id.toString(),
                model_name: selectResult.rows[0].name,
                model_params: {
                    top_p,
                    max_tokens,
                    temperature,
                    default_system_prompt,
                    system_prompt,
                    frequency_penalty,
                },
                create_time: currentTime,
                update_time: currentTime,
                base_url: base_url || "",
            };

            config[modelType][displayName] = newConfig;
            config[modelType]["current_config"] = displayName;
            if (modelType === "search") {
                const search_kwargs = {
                    k: 5,
                    score_threshold: 0.4,
                };
                config[modelType][displayName]["search_kwargs"] = search_kwargs;
            }

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expertId]);

            rsmodel.code = 0;
            rsmodel.message = `Successfully added new ${modelType} configuration`;
            rsmodel.data = config;

            const entityTypeMap = {
                search: AUDIT_LOG_ENTITY_TYPE.CREATE_SEARCH_MODEL,
                intention: AUDIT_LOG_ENTITY_TYPE.CREATE_INTENTION_MODEL,
                kor: AUDIT_LOG_ENTITY_TYPE.CREATE_KOR_MODEL,
                voice: AUDIT_LOG_ENTITY_TYPE.CREATE_VOICE_MODEL,
            };

            await logActivity({
                userId: uid,
                username: username || uid,
                targetId: expertId,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                actionType: AUDIT_LOG_ACTION_TYPE.CREATE,
                entityType: entityTypeMap[modelType], // 根據 modelType 動態指定
                parameters: {
                    expert_id: expertId,
                    newConfig,
                    defaultName,
                    displayName,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateExpertConfig:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

exports.updateExpertCurrentConfig = async (req, res) => {
    logRouteDetails("modelController.updateExpertCurrentConfig", req);
    let rsmodel = new responseModel();

    const { expertId, currentConfig, modelType } = JSON.parse(req.body);
    console.info("modelController.updateExpertCurrentConfig: ", JSON.parse(req.body));

    try {
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);
        const { uid = "" } = req.session.userInfo || {};

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;
            config[modelType]["current_config"] = currentConfig;

            let updateSql = `
                UPDATE expert 
                SET config_jsonb = $1, updated_by = $2
                WHERE id = $3
            `;

            await sql.query(updateSql, [config, uid, expertId]);

            rsmodel.code = 0;
            rsmodel.message = `Successfully updated ${modelType} current_config`;
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateExpertCurrentConfig:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

exports.updateExpertModelParams = async (req, res) => {
    logRouteDetails("modelController.updateExpertModelParams", req);
    let rsmodel = new responseModel();

    try {
        const { expertId, modelParams, searchKwargs, modelType, displayName } = JSON.parse(req.body);
        console.info("modelController.updateExpertModelParams: ", JSON.parse(req.body));
        const { top_p, max_tokens, temperature, default_system_prompt, system_prompt, frequency_penalty } = modelParams;
        const currentTime = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString();
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        // console.log("req.body", req.body);
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);

        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;

            // 更新特定 DISPLAYNAME
            if (config[modelType] && config[modelType][displayName]) {
                config[modelType][displayName]["update_time"] = currentTime;
                config[modelType][displayName].model_params = {
                    top_p,
                    max_tokens,
                    temperature,
                    default_system_prompt,
                    system_prompt,
                    frequency_penalty,
                };

                if (modelType === "search") {
                    let isValid = true;
                    const invalidKeys = [];
                    // 檢查 `k` 是否在 1 到 100 範圍內
                    if (searchKwargs.k < 1 || searchKwargs.k > 100) {
                        isValid = false;
                        invalidKeys.push("k");
                    }

                    // 檢查所有 `threshold` 值是否在 0.0 到 1.0 範圍內
                    const thresholdKeys = [
                        "score_threshold",
                        "cache_threshold",
                        "min_extra_chunk_cache_threshold",
                        "max_extra_chunk_cache_threshold",
                    ];

                    thresholdKeys.forEach((key) => {
                        if (searchKwargs[key] !== undefined && (searchKwargs[key] < 0.0 || searchKwargs[key] > 1.0)) {
                            isValid = false;
                            invalidKeys.push(key);
                        }
                    });

                    // 如果參數無效，回傳錯誤
                    if (!isValid) {
                        rsmodel.code = 1;
                        rsmodel.message = `參數有誤: ${invalidKeys.join(", ")}`;
                        return res.json(rsmodel);
                    }

                    // 移除值為空字串的key

                    Object.keys(searchKwargs).forEach((key) => {
                        if (searchKwargs[key] === "") {
                            delete searchKwargs[key];
                        }
                    });

                    config[modelType][displayName].search_kwargs = searchKwargs;
                }

                let updateSql = `
                    UPDATE expert
                    SET config_jsonb = $1,updated_by = $2
                    WHERE id = $3
                `;

                await sql.query(updateSql, [config, uid, expertId]);

                rsmodel.code = 0;
                rsmodel.message = `Successfully updated ${modelType} configuration`;

                const entityTypeMap = {
                    search: AUDIT_LOG_ENTITY_TYPE.UPDATE_SEARCH_MODEL,
                    intention: AUDIT_LOG_ENTITY_TYPE.UPDATE_INTENTION_MODEL,
                    kor: AUDIT_LOG_ENTITY_TYPE.UPDATE_KOR_MODEL,
                    voice: AUDIT_LOG_ENTITY_TYPE.UPDATE_VOICE_MODEL,
                };

                await logActivity({
                    userId: uid,
                    username: username || uid,
                    targetId: expertId,
                    targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                    actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
                    entityType: entityTypeMap[modelType], // 根據 modelType 動態指定
                    parameters: {
                        expert_id: expertId,
                        processParams: {
                            modelType,
                            displayName,
                            modelParams,
                            searchKwargs,
                        },
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"],
                });
            } else {
                rsmodel.code = 1;
                rsmodel.message = `Display name not found in ${modelType} configuration`;
            }
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateExpertModelParams:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

exports.exportExpertModel = async (req, res) => {
    logRouteDetails("modelController.exportExpertModel", req);
    let rsmodel = new responseModel();
    let skippedExperts = [];
    let selectSql, selectResult;

    try {
        const { expertId, modelType, displayName, modelParams } = JSON.parse(req.body);
        console.info("modelController.exportExpertModel: ", JSON.parse(req.body));
        const {
            id: model_list_id,
            top_p,
            max_tokens,
            temperature,
            system_prompt,
            frequency_penalty,
            search_kwargs,
        } = modelParams;
        const currentTime = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString();
        const { uid = "" } = req.session.userInfo || {};

        selectSql = "SELECT name FROM model_list WHERE id = $1";
        selectResult = await sql.query(selectSql, [model_list_id]);

        const model_name = selectResult.rows[0]?.name;

        for (const id of expertId) {
            selectSql = "SELECT config_jsonb, name FROM expert WHERE id = $1";
            selectResult = await sql.query(selectSql, [id]);

            if (selectResult.rowCount > 0) {
                let config = selectResult.rows[0].config_jsonb;
                let expertName = selectResult.rows[0].name;

                // 檢查名稱是否有重複
                if (config[modelType]) {
                    let isDuplicate = Object.keys(config[modelType]).some((key) => key === displayName);
                    if (isDuplicate) {
                        skippedExperts.push(expertName);
                        continue; // 略過這個 expert
                    }
                }

                if (!config[modelType]) {
                    // 如果 modelType 不存在，初始化這個新的 modelType
                    config[modelType] = {};
                    config[modelType]["current_config"] = displayName;
                }

                const newConfig = {
                    model_list_id: model_list_id,
                    model_name,
                    model_params: {
                        top_p,
                        max_tokens,
                        temperature,
                        system_prompt,
                        frequency_penalty,
                    },
                    create_time: currentTime,
                    update_time: currentTime,
                };

                config[modelType][displayName] = newConfig;
                if (modelType === "search") {
                    config[modelType][displayName]["search_kwargs"] = search_kwargs;
                }

                let updateSql = `
                    UPDATE expert 
                    SET config_jsonb = $1, updated_by = $2
                    WHERE id = $3
                `;

                await sql.query(updateSql, [config, uid, id]);

                rsmodel.code = 0;
                rsmodel.message = `Successfully added new ${modelType} configuration for expert ${id}`;
                rsmodel.data = config;
            } else {
                rsmodel.code = 1;
                rsmodel.message = `Expert with ID ${id} not found`;
            }
        }

        if (skippedExperts.length > 0) {
            rsmodel.skippedExperts = skippedExperts;
            rsmodel.message = `Skipped the following experts as they already have the displayName: ${skippedExperts.join(
                ", "
            )}`;
        }
    } catch (error) {
        console.error("Error in exportExpertModel:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

exports.deleteExpertModelByName = async (req, res) => {
    logRouteDetails("modelController.deleteExpertModelByName", req);
    let rsmodel = new responseModel();

    const { expertId, modelType, displayName } = JSON.parse(req.body);
    console.info("modelController.deleteExpertModelByName: ", JSON.parse(req.body));

    try {
        let selectSql = "SELECT config_jsonb FROM expert WHERE id = $1";
        let selectResult = await sql.query(selectSql, [expertId]);
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        if (selectResult.rowCount > 0) {
            let config = selectResult.rows[0].config_jsonb;

            // 刪除特定 DISPLAYNAME
            if (config[modelType] && config[modelType][displayName]) {
                const modelList = Object.keys(config[modelType]).filter((e) => e !== "current_config");
                if (modelList.length <= 1) {
                    rsmodel.code = 1;
                    rsmodel.message = "模型數量小於 1 時不能再刪除模型。";
                    return res.json(rsmodel);
                }

                delete config[modelType][displayName];

                // 如果刪除的模型為當前套用的模型，那就要選擇排序第 1 的模型為當前模型。
                if (config[modelType].current_config === displayName) {
                    config[modelType].current_config = modelList.filter((e) => e !== displayName)[0];
                }
                let updateSql = `
                    UPDATE expert
                    SET config_jsonb = $1, updated_by = $2
                    WHERE id = $3
                `;

                await sql.query(updateSql, [config, uid, expertId]);

                rsmodel.code = 0;
                rsmodel.message = `Successfully deleted ${displayName} from ${modelType} configuration`;

                const entityTypeMap = {
                    search: AUDIT_LOG_ENTITY_TYPE.DELETE_SEARCH_MODEL,
                    intention: AUDIT_LOG_ENTITY_TYPE.DELETE_INTENTION_MODEL,
                    kor: AUDIT_LOG_ENTITY_TYPE.DELETE_KOR_MODEL,
                    voice: AUDIT_LOG_ENTITY_TYPE.DELETE_VOICE_MODEL,
                };

                await logActivity({
                    userId: uid,
                    username: username || uid,
                    targetId: expertId,
                    targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                    actionType: AUDIT_LOG_ACTION_TYPE.DELETE,
                    entityType: entityTypeMap[modelType], // 根據 modelType 動態指定
                    parameters: {
                        expert_id: expertId,
                        modelType,
                        displayName,
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"],
                });
            } else {
                rsmodel.code = 1;
                rsmodel.message = `Display name not found in ${modelType} configuration`;
            }
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Expert not found";
        }
    } catch (error) {
        console.error("Error in updateExpertModelParams:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the data";
    }

    res.json(rsmodel);
};

exports.updateModelList = async (req, res) => {
    logRouteDetails("modelController.updateModelList", req);
    let rsmodel = new responseModel();

    try {
        const { id, is_enable, config } = JSON.parse(req.body);

        // console.info("modelController.updateModelList: ", JSON.parse(req.body));

        // 參數驗證
        if (!id) {
            rsmodel.code = 1;
            rsmodel.message = "Missing required parameter: id";
            return res.json(rsmodel);
        }

        // 檢查模型是否存在
        let checkSql = "SELECT * FROM model_list WHERE id = $1";
        let checkResult = await sql.query(checkSql, [id]);

        if (checkResult.rowCount === 0) {
            rsmodel.code = 1;
            rsmodel.message = "Model not found";
            return res.json(rsmodel);
        }

        // 準備更新的欄位和值
        let updateFields = [];
        let updateValues = [];
        let paramIndex = 1;

        if (is_enable !== undefined && is_enable !== null) {
            updateFields.push(`is_enable = $${paramIndex}`);
            updateValues.push(is_enable);
            paramIndex++;
        }

        if (config !== undefined && config !== null) {
            updateFields.push(`config = $${paramIndex}`);
            // 確保 config 是 JSON 字串格式
            updateValues.push(typeof config === 'string' ? config : JSON.stringify(config));
            paramIndex++;
        }

        if (updateFields.length === 0) {
            rsmodel.code = 1;
            rsmodel.message = "No valid fields to update";
            return res.json(rsmodel);
        }

        // 添加 id 到參數列表
        updateValues.push(id);

        // 構建更新 SQL
        const updateSql = `
            UPDATE model_list 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
        `;
        // console.log("updateSql", updateSql);
        await sql.query(updateSql, updateValues);

        // 取得更新後的資料
        let updatedResult = await sql.query("SELECT * FROM model_list WHERE id = $1", [id]);
        const updatedModel = updatedResult.rows[0];

        rsmodel.code = 0;
        rsmodel.message = "Model updated successfully";
        rsmodel.data = updatedModel;

    } catch (error) {
        console.error("Error in updateModelList:", error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while updating the model";
    }

    res.json(rsmodel);
};
