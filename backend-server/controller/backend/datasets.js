const responseModel = require("../../model/responseModel");

const sql = require("../../db/pgsql");
const { Op } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

const FormData = require("form-data");
const dayjs = require("dayjs");
const { readFile, createFolder } = require("../../global/backend_upload");

const pythonAPI = require("../../utils/pythonAPI");

const { getDateList, getSearchStartTime } = require("../../utils/chart");
const { logActivity, AUDIT_LOG_ACTION_TYPE, AUDIT_LOG_ENTITY_TYPE } = require("../../utils/auditLog");

const UploadDocuments = require("../../orm/schema/upload_documents");
const ParentChunks = require("../../orm/schema/parent_chunks");
const MessageChunkMapping = require("../../orm/schema/message_chunk_mapping");
const HistoryMessage = require("../../orm/schema/history_messages");
const Expert = require("../../orm/schema/expert");
const Datasets = require("../../orm/schema/datasets");
const EmbeddingTokenLog = require("../../orm/schema/embedding_token_log");
const Datasource = require("../../orm/schema/datasource");
const DatasourceType = require("../../orm/schema/datasource_type");
const CrawlerSynchronize = require("../../orm/schema/crawler_synchronize");
const CrawlerDocuments = require("../../orm/schema/crawler_documents");

////////////////////刪除測試資料用////////////////////
//刪除uploads檔案夾與資料庫資料
const fs = require("fs");
const { filterDatasetsByPermission } = require("../../utils/permissionFilter");
const { filterDatasetsByCSCPermission } = require("../../utils/csc-permissionFilter");
const { generateUploadDocumentUpdateSQL } = require("../../utils/sqlUpdateHelper");
const logRouteDetails = require("../routeNameLog");

const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;
const SSO_TYPE = process.env.SSO_TYPE;
const AUDIT_LOG_TARGET_CATEGORY = "dataset";

// 刪除指定目錄
// const directoryPath = upload_host; // 替換成你要刪除的目錄的路徑
// function deleteFolderRecursive(directoryPath) {
//     if (fs.existsSync(directoryPath)) {
//         fs.readdirSync(directoryPath).forEach((file) => {
//             const curPath = path.join(directoryPath, file);

//             if (fs.lstatSync(curPath).isDirectory()) {
//                 // 遞歸刪除子目錄
//                 deleteFolderRecursive(curPath);
//             } else {
//                 // 刪除文件
//                 fs.unlinkSync(curPath);
//             }
//         });

//         // 刪除空目錄
//         fs.rmdirSync(directoryPath);
//     }
// }

exports.deleteDatasetsById = async function (req, res) {
    logRouteDetails("datasets.deleteDatasetsById", req);
    let rsmodel = new responseModel();
    try {
        const { id, folder_name } = req.params;
        console.info("datasets.deleteDatasetsById:", req.params);
        // 將知識庫改為不可用
        const result = await sql.query("update datasets set is_enable = 0 where id = $1", [id]);
        console.log("result", result);
        // 將知識庫與專家的關聯資料移除
        const delete_binding_result = await sql.query("DELETE FROM expert_datasets_mapping WHERE datasets_id = $1", [
            id,
        ]);
        console.log("delete_binding_result", delete_binding_result);

        // 也把排程資料刪除
        await sql.query("DELETE FROM crawler_sync_schedule WHERE dataset_id = $1", [id]);

        rsmodel.code = 0;
        await pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST, {
            ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
        });
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.create = async function (req, res) {
    logRouteDetails("datasets.create", req);
    let rsmodel = new responseModel();
    let rs;
    try {
        const { name, embedding_model, embedding_model_id, id } = JSON.parse(req.body);
        const { uid = "", name: username = "" } = req.session.userInfo || {};

        // 檢查知識庫ID是否已存在
        const namePattern = /^[a-zA-Z0-9-_]+$/;
        if (id && !namePattern.test(id)) {
            rsmodel.message = "知識庫ID只能包含數字、英文、-、_";
            res.json(rsmodel);
            return;
        }

        if (id) {
            const checkExist = await sql.query("SELECT id FROM datasets WHERE id = $1", [id]);
            if (checkExist.rowCount > 0) {

                rsmodel.code = 1;
                rsmodel.message = "知識庫 ID 已存在";
                rsmodel.data = { isDuplicated: true };
                return res.json(rsmodel);
            }
        }

        if (!name.trim()) {
            rsmodel.message = "參數不完整或格式錯誤";
            res.json(rsmodel);
            return;
        }
        
        let describe = `useful for when you want to answer queries about the ${name}`;
        let uuid = id || uuidv4();
        
         // Use provided ID or generate a new one
        let folder_name = uuidv4();
        rs = await sql.query("select value from settings where key = 'default_datasets_model_config'");
        const datasets_config = JSON.parse(rs.rows[0].value);
        
        if (embedding_model !== undefined) {
            datasets_config.embedding_model = embedding_model;
        }
        if (embedding_model_id !== undefined) {
            datasets_config.embedding_model_id = embedding_model_id;
        }

        const configJsonString = JSON.stringify(datasets_config);
        rs = await sql.query(
            'insert into datasets(id,"name",describe,config_jsonb,folder_name,created_by) values($1,$2,$3,$4,$5,$6)',
            [uuid, name, describe, configJsonString, folder_name, uid]
        );
        if (rs.rowCount === 0) return;

       
        let datasource_id = uuidv4();

        await sql.query("insert into datasource (id,datasets_id,type,is_enable) values($1,$2,$3,$4)", [
            datasource_id,
            uuid,
            "B",
            1,
        ]);

        createFolder(`${folder_name}`, "A");
        rsmodel.data = { datasets_id: uuid, folder_name: folder_name };
        rsmodel.code = 0;

        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.CREATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.CREATE_DATASET,
            targetId: uuid,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                datasets_id: uuid,
                name: name,
                describe: describe,
                config_jsonb: configJsonString,
                folder_name: folder_name,
                created_by: uid,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });

        console.log("Received data:", {
            id,
            name,
            embedding_model_id
        });
        console.log("Generated uuid:", uuid);
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getDatasetChartData = async function (req, res) {
    logRouteDetails("datasets.getDatasetChartData", req);
    let rsmodel = new responseModel();
    try {
        const { datasets_id, period, subject } = req.query;
        console.info("datasets.getDatasetChartData:", req.query);

        if (!datasets_id || !period || !subject) {
            throw new Error("參數不完整或格式錯誤");
        }

        const searchStartTime = getSearchStartTime(period);
        if (!searchStartTime) {
            throw new Error("週期格式錯誤");
        }

        let result;
        const tempData = getDateList(searchStartTime, dayjs()); // 從startTime開始到今天，建立每一天的資料
        if (subject === "embedding_cost") {
            result = await EmbeddingTokenLog.findAll({
                where: {
                    datasets_id: datasets_id,
                    create_time: {
                        [Op.gte]: searchStartTime,
                    },
                },
            });
            let dailyCostData = [];
            const currencyList = [];
            const totalCost = {};

            tempData.forEach((dayData) => {
                dayData.token = 0;
                dayData.cost = {};
            });

            if (result.length > 0) {
                result.forEach((item) => {
                    // 紀錄貨幣種類
                    if (!currencyList.includes(item.price_currency)) {
                        currencyList.push(item.price_currency);
                        // 初始化每一天該貨幣的花費為0
                        tempData.forEach((dayData) => {
                            dayData.cost[item.price_currency] = 0;
                        });
                    }
                    // 紀錄總花費
                    totalCost[item.price_currency] = (totalCost[item.price_currency] || 0) + item.price;

                    // 紀錄每日花費
                    const date = dayjs(item.create_time).format("YYYY-MM-DD");
                    const dayData = tempData.get(date);
                    if (dayData) {
                        dayData.token += item.prompt_token;
                        dayData.cost[item.price_currency] += item.price;
                    }
                });
            } else {
                // 如果沒有資料，則將每一天的費用設為0
                tempData.forEach((dayData) => {
                    dayData.cost["USD"] = 0;
                });
                totalCost["USD"] = 0;
            }

            dailyCostData = Array.from(tempData.values()).sort((a, b) =>
                dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1
            );

            rsmodel.data = {
                dailyCostData,
                totalCost,
            };
        } else {
            throw new Error("無法辨識的圖表類型");
        }

        rsmodel.code = 0;
    } catch (e) {
        console.error("datasets.getDatasetChartData error:", e);
        rsmodel.message = e.message;
        rsmodel.code = 1;
    }
    res.json(rsmodel);
};

exports.update = async function (req, res) {
    logRouteDetails("datasets.update", req);
    let rsmodel = new responseModel();
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        const parsedBody = JSON.parse(req.body);
        const { datasets_id, ...processParams } = parsedBody;
        if (!datasets_id) return;
        console.info("datasets.update:", parsedBody);
        const keys = Object.keys(processParams);
        const values = Object.values(processParams);

        let sqlstr = "update datasets set ";
        let i = 0;
        for (let key of keys) {
            if (i !== 0) sqlstr += ",";
            i++;
            sqlstr += `${key} = $${i}`;
        }
        i++;
        sqlstr += `, updated_by = $${i}`;
        i++;
        sqlstr += ` where id = $${i}`;

        let chk = await sql.query(sqlstr, [...values, uid, datasets_id]);
        if (chk.rowCount > 0) {
            rsmodel.code = 0;
        }
        // call python 呼叫重新綁定知識庫資料
        pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST, {
            ava_token: `${SESSION_KEY_PREFIX}${req.sessionID}`,
        });

        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_DATASET_CONFIG,
            targetId: datasets_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                datasets_id: datasets_id,
                processParams,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        rsmodel.message = e.message;
        rsmodel.code = 1;
        console.error(e);
    }
    res.json(rsmodel);
};

exports.sendFile = async function (req, res) {
    logRouteDetails("datasets.sendFile", req);
    let rsmodel = new responseModel();
    try {
        console.log("sendFile req.body", req.body);
        console.log("sendFile req.files", req.files);
        // 上傳到backend
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let { datasets_id, folder_name, datasource_url, datasource_name, separator, expiration_time } = req.body;
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const datasource_type = "A";
        //目前1個datasets只有一組datasource與upload_folder
        let query;
        let rs;
        // 取得 datasource_id
        query = {
            text: "select id from datasource where datasets_id = $1 and type = $2",
            values: [datasets_id, datasource_type],
        };
        rs = await sql.query(query);
        let datasource_id;
        let upload_folder_id;
        if (rs.rows[0]?.id) {
            // 有datasource_id的話沿用
            datasource_id = rs.rows[0].id;
            query = {
                text: "select id from upload_folder where datasource_id = $1",
                values: [datasource_id],
            };
            rs = await sql.query(query);
            console.log("rs.rows[0]: ", rs.rows[0]);
            upload_folder_id = rs.rows[0]?.id;
        } else {
            // 沒有就建一個
            datasource_id = uuidv4();
            query = {
                text: "insert into datasource (id,datasets_id,type,is_enable) values($1,$2,$3,$4)",
                values: [datasource_id, datasets_id, datasource_type, 1],
            };
            rs = await sql.query(query);

            upload_folder_id = uuidv4();
            query = {
                text: "insert into upload_folder (id,datasource_id) values($1,$2)",
                values: [upload_folder_id, datasource_id],
            };
            rs = await sql.query(query);
            await pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST, {
                ava_token,
            });
        }
        console.log("upload_folder_id: ", upload_folder_id);

        // 分組insert upload_documents

        let files = req.files.map((m, i) => {
            // 檢查檔案類型 如果是 image 的話 type 就是 image 否則是 document
            let document_type = m.mimetype.startsWith("image/") ? "image" : "document";
            let url = Array.isArray(datasource_url) ? datasource_url[i] : datasource_url;
            let name = Array.isArray(datasource_name) ? datasource_name[i] : datasource_name;
            let exp_time = Array.isArray(expiration_time) ? expiration_time[i] : expiration_time;
            // 這邊會有 formData 轉出來 資料格式的問題 要注意
            exp_time = exp_time === "undefined" || typeof exp_time === "undefined" ? null : exp_time;
            return {
                upload_documents_id: m.filename.split(".")[0],
                filename: m.filename,
                originalname: m.originalname,
                upload_folder_id: upload_folder_id,
                datasets_id: datasets_id,
                datasource_url: url || null,
                datasource_name: name || null,
                document_type: document_type,
                separator: separator !== "null" ? separator : null,
                training_state: 2,
                created_by: uid,
                expiration_time: exp_time, // 新增的過期時間欄位
            };
        });
        console.log("files", files);
        let placeholders = [];

        files.forEach((item, index) => {
            placeholders.push(
                "(" +
                    Object.keys(item)
                        .map((_, index1) => `$${index * Object.keys(item).length + index1 + 1}`)
                        .join(",") +
                    ")"
            );
        });

        sqlstr = `insert into upload_documents(id,filename,originalname,upload_folder_id,datasets_id,datasource_url,datasource_name,document_type,separator,training_state,created_by,expiration_time) values ${placeholders.join(
            ","
        )}`;

        sqlparam = [].concat(...files.map((item) => Object.values(item)));
        await sql.query(sqlstr, sqlparam);

        // 回傳 files 的原始名稱和 id
        rsmodel.data = files.map((file) => ({ [file.originalname]: file.upload_documents_id }));
        rsmodel.code = 0;
        rsmodel.message = "Success Upload!";

        await logActivity({
            userId: uid,
            username: username || uid,
            actionType: AUDIT_LOG_ACTION_TYPE.UPLOAD,
            entityType: AUDIT_LOG_ENTITY_TYPE.UPLOAD_DOCUMENT,
            targetId: datasets_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                datasets_id: datasets_id,
                files,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.uploadText = async function (req, res) {
    logRouteDetails("datasets.uploadText", req);
    let rsmodel = new responseModel();

    try {
        if (
            !req.headers["ava-upload-token"] ||
            req.headers["ava-upload-token"] !== "53C3E39C-66D5-691B-10CB-AC54AE788175"
        ) {
            rsmodel.message = "Missing token!";
            return res.json(rsmodel);
            // return res.status(401).send("權限不足");
        }
        let { data, datasets_id, datasource_url, datasource_name, separator } = JSON.parse(req.body);
        console.info("datasets.uploadText:", JSON.parse(req.body));
        let query, rs;
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const createFile = (filePath, fileBuffer, options) => {
            try {
                fs.writeFileSync(filePath, fileBuffer, options);
            } catch (e) {
                console.error(e.response.data);
            }
        };
        const deleteFile = (filePath) => {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                console.error(e.response.data);
            }
        };

        // datasets_id = "d65bcb14-c8ce-443a-bdee-192d38377c8d";
        rs = await sql.query("select folder_name from datasets where id = $1", [datasets_id]);
        const folder_name = rs.rows[0].folder_name;

        createFolder(folder_name, "A");

        req.files = [];
        for (let i = 0; i < data.length; i++) {
            let textContent = data[i].content;
            let textFilename = data[i].filename;

            const uuid = uuidv4();
            createFile(`uploads_backend/${folder_name}/upload/${uuid}.txt`, textContent, "utf-8");

            try {
                const formData = new FormData();
                const file = readFile(`${folder_name}/upload/${uuid}.txt`);
                formData.append("file", file);
                let rs = await axios.post(process.env.DR_FILE_MGR, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    responseType: "arraybuffer",
                });
                req.files.push({
                    filename: `${uuid}.pdf`,
                    originalname: `${textFilename}.pdf`,
                    datasource_url: data[i].datasource_url,
                    datasource_name: data[i].datasource_name,
                });
                createFile(`uploads_backend/${folder_name}/upload/${uuid}.pdf`, Buffer.from(rs.data));
                deleteFile(`uploads_backend/${folder_name}/upload/${uuid}.txt`);
                // pdfArr.push(rs.data);
            } catch (error) {
                console.error(error.message);
            }
        }

        const datasource_type = "A";
        //目前1個datasets只有一組datasource與upload_folder

        query = {
            text: "select id from datasource where datasets_id = $1 and type = $2",
            values: [datasets_id, datasource_type],
        };
        rs = await sql.query(query);
        let datasource_id;
        let upload_folder_id;
        if (rs.rows[0]?.id) {
            datasource_id = rs.rows[0].id;
            query = {
                text: "select id from upload_folder where datasource_id = $1",
                values: [datasource_id],
            };
            rs = await sql.query(query);
            upload_folder_id = rs.rows[0]?.id;
        } else {
            datasource_id = uuidv4();
            query = {
                text: "insert into datasource (id,datasets_id,type,is_enable) values($1,$2,$3,$4)",
                values: [datasource_id, datasets_id, datasource_type, 1],
            };
            rs = await sql.query(query);

            upload_folder_id = uuidv4();
            query = {
                text: "insert into upload_folder (id,datasource_id) values($1,$2)",
                values: [upload_folder_id, datasource_id],
            };
            rs = await sql.query(query);
        }

        //分組insert
        let files = req.files.map((m) => ({
            upload_documents_id: m.filename.split(".")[0],
            filename: m.filename,
            originalname: m.originalname,
            upload_folder_id: upload_folder_id,
            datasets_id: datasets_id,
            datasource_url: m.datasource_url,
            datasource_name: m.datasource_name,
        }));
        let placeholders = [];
        files.forEach((item, index) => {
            placeholders.push(
                "(" +
                    Object.keys(item)
                        .map((_, index1) => `$${index * Object.keys(item).length + index1 + 1}`)
                        .join(",") +
                    ")"
            );
        });
        let sqlstr = `insert into upload_documents(id,filename,originalname,upload_folder_id,datasets_id,datasource_url,datasource_name) values ${placeholders.join(
            ","
        )}`;

        let sqlparam = [].concat(...files.map((item) => Object.values(item)));
        let chk = await sql.query(sqlstr, sqlparam);
        // let count = chk.rowCount;
        // let chk1 = await sql.query("update datasets where id = $2", [datasets_id]);
        /////////////////////////// 打python api ///////////////////////////

        rs = await pythonAPI.uploadDocuments(
            datasets_id,
            upload_folder_id,
            folder_name,
            files,
            process.env.PYTHON_API_HOST,
            ava_token
        );

        let rsData = rs.data.data;
        if (rs.data.code === 200) {
            let sqlstr = "update upload_documents set training_state = 1 where ";
            let sqlparam = [];
            // for (let obj of rs.data.data) {
            for (let i = 0; i < rsData.length; i++) {
                let obj = rsData[i].split(".")[0];
                if (i !== 0) sqlstr += " or ";
                sqlstr += ` id = $${i + 1}`;
                sqlparam.push(obj);
            }
            let chk2 = await sql.query(sqlstr, sqlparam);
        } else {
            rsmodel.message = rs.data.message;
            return res.json(rsmodel);
        }

        console.log("rsData", rsData);

        //建立索引

        // rs = await sql.query("select filename from upload_documents where datasets_id = $1 and training_state = 1",[datasets_id]);
        // const filenames = rs.rows.map(m=>m.filename);
        const filenames = rsData;

        // 現在不用呼叫 indexing 了 只需要把 training_state 改成 2 就好 python 會自動去做 training_state 為 2 的文件
        // rs = await pythonAPI.activateIndexing(
        //     folder_name,
        //     filenames,
        //     process.env.PYTHON_API_HOST,
        //     separator,
        //     datasource_type,
        //     ava_token
        // );
        if (filenames?.length > 0) {
            let sqlstr = "update upload_documents set training_state = 2, separator = $1 where";
            let sqlparam = [];
            // for (let obj of rs.data.data) {
            sqlparam.push(separator);
            for (let i = 0; i < filenames.length; i++) {
                let obj = filenames[i].split(".")[0];
                if (i !== 0) sqlstr += " or ";
                sqlstr += ` id = $${i + 2}`;
                sqlparam.push(obj);
            }
            await sql.query(sqlstr, sqlparam);
        } else {
            rsmodel.message = rs.data.message;
            return res.json(rsmodel);
        }

        rsmodel.code = 200;
        rsmodel.message = "Success Upload!";
        rsmodel.data = filenames;

        /////////////////////////// 打python api ///////////////////////////
    } catch (e) {
        console.error(e);
        rsmodel.message = "未知錯誤";
    }
    res.json(rsmodel);
};

exports.filesIndexing = async function (req, res) {
    logRouteDetails("datasets.filesIndexing", req);
    let rsmodel = new responseModel();
    try {
        const { datasets_id, separator } = JSON.parse(req.body);
        console.info("datasets.filesIndexing:", JSON.parse(req.body));

        let rs;
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        // const childFolder = "upload";
        // const targetFolderPath = `${upload_host}/${folder_name}/${childFolder}`;
        rs = await sql.query("select folder_name from datasets where id = $1", [datasets_id]);
        const folder_name = rs.rows[0].folder_name;

        rs = await sql.query("select filename from upload_documents where datasets_id = $1 and training_state = 1", [
            datasets_id,
        ]);
        const filenames = rs.rows.map((m) => m.filename.split(".")[0] + ".pdf");
        const datasource_type = "A";

        // 現在不用呼叫 indexing 了 只需要把 training_state 改成 2 就好 python 會自動去做 training_state 為 2 的文件
        // rs = await pythonAPI.activateIndexing(
        //     folder_name,
        //     filenames,
        //     process.env.PYTHON_API_HOST,
        //     separator,
        //     datasource_type,
        //     ava_token
        // );

        if (filenames?.length > 0) {
            // 上傳檔案的時候也要更新 separator
            let sqlstr = "update upload_documents set training_state = 2, separator = $1 where";
            let sqlparam = [];
            // 因為 file 可能會有多筆 所以讓 separator 先放在第一個
            sqlparam.push(separator);
            // for (let obj of rs.data.data) {
            for (let i = 0; i < filenames.length; i++) {
                let obj = filenames[i].split(".")[0];
                if (i !== 0) sqlstr += " or ";
                sqlstr += ` id = $${i + 2}`;
                sqlparam.push(obj);
            }

            await sql.query(sqlstr, sqlparam);
        } else {
            rsmodel.message = rs.data.message;
            return res.json(rsmodel);
        }
        rsmodel.code = 0;
    } catch (e) {
        console.error(e.message);
    }
    res.json(rsmodel);
};

exports.getDatasets = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("datasets.getDatasets", req);
    let rsmodel = new responseModel();
    try {
        let { datasets_id } = req.query;
        let userNo = req.session.userInfo.user_no;
        const compNo = req.session.userInfo.comp_no;

        let rs;
        // 有 datasets_id 的情況
        if (datasets_id) {
            rs = await sql.query(
                `
                SELECT 
                    datasets.*,
                    created_user.name AS created_by_name,
                    updated_user.name AS updated_by_name,
                    COALESCE(datasets.config_jsonb->>'sort_priority', '0')::int AS sort_priority,
                    COALESCE(experts.expert, '{}') AS experts,
                    COALESCE(documents_counts.documents_count, 0) AS documents_count,
                    COALESCE(training_state_3_counts.success_count, 0) AS success_count,
                    COALESCE(form_counts.form_count, 0) AS form_count
                FROM datasets
                LEFT JOIN users AS created_user 
                    ON datasets.created_by = created_user.id
                LEFT JOIN users AS updated_user 
                    ON datasets.updated_by = updated_user.id
                LEFT JOIN (
                    SELECT datasets_id, ARRAY_AGG(json_build_object('avatar', expert.avatar, 'name', expert.name)) AS expert
                    FROM expert_datasets_mapping
                    JOIN expert ON expert.id = expert_datasets_mapping.expert_id
                    GROUP BY datasets_id
                ) AS experts ON datasets.id = experts.datasets_id
                LEFT JOIN (
                    SELECT datasets_id, COUNT(*) AS documents_count
                    FROM upload_documents
                    WHERE is_enable = 1
                    GROUP BY datasets_id
                ) AS documents_counts ON datasets.id = documents_counts.datasets_id
                LEFT JOIN (
                    SELECT datasets_id, COUNT(*) AS success_count
                    FROM upload_documents
                    WHERE training_state = 3 AND is_enable = 1
                    GROUP BY datasets_id
                ) AS training_state_3_counts ON datasets.id = training_state_3_counts.datasets_id
                LEFT JOIN (
                    SELECT dataset_id, COUNT(*) AS form_count
                    FROM form_binding_association
                    GROUP BY dataset_id
                ) AS form_counts ON datasets.id = form_counts.dataset_id
                WHERE datasets.is_enable = 1 AND datasets.id = $1
                ORDER BY sort_priority DESC, datasets.create_time DESC;
                `,
                [datasets_id]
            );
        } else {
            // 沒有 datasets_id 的情況
            rs = await sql.query(
                `
                    SELECT 
                        datasets.*,
                        created_user.name AS created_by_name,
                        updated_user.name AS updated_by_name,
                        COALESCE(datasets.config_jsonb->>'sort_priority', '0')::int AS sort_priority,
                        COALESCE(experts.expert, '{}') AS experts,
                        COALESCE(documents_counts.documents_count, 0) AS documents_count,
                        COALESCE(training_state_3_counts.success_count, 0) AS success_count,
                        COALESCE(form_counts.form_count, 0) AS form_count,
                        COALESCE(crawler_site_counts.crawler_site_count, 0) AS crawler_site_count
                    FROM datasets
                    LEFT JOIN users AS created_user 
                        ON datasets.created_by = created_user.id
                    LEFT JOIN users AS updated_user 
                        ON datasets.updated_by = updated_user.id
                    LEFT JOIN (
                        SELECT datasets_id, ARRAY_AGG(json_build_object('avatar', expert.avatar, 'name', expert.name)) AS expert
                        FROM expert_datasets_mapping
                        JOIN expert ON expert.id = expert_datasets_mapping.expert_id
                        GROUP BY datasets_id
                    ) AS experts ON datasets.id = experts.datasets_id
                    LEFT JOIN (
                        SELECT datasets_id, COUNT(*) AS documents_count
                        FROM upload_documents
                        WHERE is_enable = 1
                        GROUP BY datasets_id
                    ) AS documents_counts ON datasets.id = documents_counts.datasets_id
                    LEFT JOIN (
                        SELECT datasets_id, COUNT(*) AS success_count
                        FROM upload_documents
                        WHERE training_state = 3 AND is_enable = 1
                        GROUP BY datasets_id
                    ) AS training_state_3_counts ON datasets.id = training_state_3_counts.datasets_id
                    LEFT JOIN (
                        SELECT dataset_id, COUNT(*) AS form_count
                        FROM form_binding_association
                        GROUP BY dataset_id
                    ) AS form_counts ON datasets.id = form_counts.dataset_id
                    LEFT JOIN (
                        SELECT ds.datasets_id, COUNT(DISTINCT cs.crawler_id) AS crawler_site_count
                        FROM datasource ds
                        JOIN crawler_synchronize cs ON ds.id = cs.datasource_id
                        GROUP BY ds.datasets_id
                    ) AS crawler_site_counts ON datasets.id = crawler_site_counts.datasets_id
                    WHERE datasets.is_enable = 1
                    ORDER BY sort_priority DESC, datasets.create_time DESC;
                `
            );
        }

        // 取得權限設置並進行過濾
        const { rows } = await sql.query(
            "SELECT value FROM settings WHERE key='knowledge_permission' and value is not null"
        );
        const knowledgePermission = JSON.parse(rows[0].value);

        if (knowledgePermission) {
            if (SSO_TYPE === "csc") {
                rs.rows = await filterDatasetsByCSCPermission(rs.rows, compNo, userNo, knowledgePermission);
            } else {
                rs.rows = filterDatasetsByPermission(rs.rows, userNo, knowledgePermission);
            }
        }

        rsmodel.data = rs.rows;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.expertList = async function (req, res) {
    logRouteDetails("datasets.expertList", req);
    let rsmodel = new responseModel();
    try {
        let { datasets_id } = req.query;
        console.info("datasets.expertList:", req.query);

        let sqlstr = `select * from expert_datasets_mapping a
        left join expert b on a.expert_id = b.id where a.datasets_id = $1 AND is_enable = 1`;
        let sqlparam = [datasets_id];
        let rs = await sql.query(sqlstr, sqlparam);

        rsmodel.data = rs.rows;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getDatasetsOverview = async function (req, res) {
    logRouteDetails("datasets.getDatasetsOverview", req);
    let rsmodel = new responseModel();
    try {
        let { datasets_id } = req.query;

        if (!datasets_id) {
            throw new Error("請求參數不完整");
        }

        const responseData = {
            cost: {
                tokens: 0,
            },
            upload: {
                files: 0,
                images: 0,
            },
            crawler: {
                sites: 0,
                files: 0,
            },
        };

        // 步驟一 取出花費
        const costData = await EmbeddingTokenLog.findAll({
            where: {
                datasets_id: datasets_id,
            },
            attributes: ["id", "prompt_token", "price", "price_currency"],
        });

        if (costData.length > 0) {
            costData.forEach((item) => {
                responseData.cost.tokens += item.prompt_token;
                if (responseData.cost[item.price_currency]) {
                    responseData.cost[item.price_currency] += item.price;
                } else {
                    responseData.cost[item.price_currency] = item.price;
                }
            });
        } else {
            responseData.cost.USD = 0;
        }
        // 步驟二 取得上傳文件數量
        const fileData = await UploadDocuments.findAll({
            where: {
                datasets_id: datasets_id,
                is_enable: 1,
            },
            attributes: ["id", "originalname", "document_type"],
        });
        if (fileData.length > 0) {
            responseData.upload.files = fileData.filter((item) => item.document_type === "document").length;
            responseData.upload.images = fileData.filter((item) => item.document_type === "image").length;
        }
        // 步驟三 取得爬蟲資料
        const crawlerTypeCode = await DatasourceType.findOne({
            where: {
                name: "crawler",
            },
            attributes: ["id"],
        });
        const datasource = await Datasource.findOne({
            where: {
                datasets_id: datasets_id,
                type: crawlerTypeCode.id,
            },
            attributes: ["id"],
        });
        if (datasource) {
            const crawlerSites = await CrawlerSynchronize.findAll({
                where: {
                    datasource_id: datasource.id,
                    training_state: 3,
                },
                attributes: ["id", "crawler_id"],
            });
            const sites = [...new Set(crawlerSites.map((item) => item.crawler_id))];
            responseData.crawler.sites = sites.length;

            // 取得每個crawler_id中最大的id
            const maxIds = crawlerSites.reduce((acc, curr) => {
                if (!acc[curr.crawler_id] || curr.id > acc[curr.crawler_id]) {
                    acc[curr.crawler_id] = curr.id;
                }
                return acc;
            }, {});
            const ids = Object.values(maxIds);
            const crawlerDocuments = await CrawlerDocuments.count({
                where: {
                    crawler_synchronize_id: {
                        [Op.in]: ids,
                    },
                    is_enable: 1,
                    training_state: 3,
                },
            });
            responseData.crawler.files = crawlerDocuments;
        } else {
            responseData.crawler.sites = 0;
            responseData.crawler.files = 0;
        }

        rsmodel.data = responseData;
        rsmodel.code = 0;
    } catch (e) {
        rsmodel.code = 1;
        rsmodel.message = "取得資料失敗";
        console.error("取得知識庫概覽資料失敗", e);
    }
    res.json(rsmodel);
};

exports.getDatasetsChunks = async function (req, res) {
    logRouteDetails("datasets.getDatasetsChunks", req);
    let rsmodel = new responseModel();
    try {
        let { datasets_id } = req.query;
        console.info("datasets.getDatasetsChunks:", req.query);
        // 使用ORM查詢ParentChunks表中meta_data欄位包含指定datasets_id的資料
        const chunks = await ParentChunks.count({
            where: {
                meta_data: {
                    datasets_id: datasets_id,
                },
            },
        });

        rsmodel.data = {
            chunks: chunks,
        };
        rsmodel.code = 0;
    } catch (e) {
        console.error("取得 chunks 資料時發生錯誤: ", e);
        rsmodel.code = 1;
        rsmodel.message = "取得 chunks 資料時發生錯誤: " + e.message;
    }
    res.json(rsmodel);
};

exports.getDocuments = async function (req, res) {
    logRouteDetails("datasets.getDocuments", req);
    let rsmodel = new responseModel();
    // "UserUpload": 用戶上傳的文件。
    // "FormUpload": 表單上傳的文件。
    // "FormBoundDocument": 被綁定表單的文件。
    // "UnboundDocument": 未被綁定表單的文件。

    /**
     * 有在 upload_documents 表 或 有在 form_binding_association 然後 binding_type 是 2 (UserUpload)
     * 有在 upload_documents 表 並且 form_binding_association 的 binding_type 是 1 的 (FormUpload)
     * 有在 upload_documents 表 並且 form_binding_association 的 binding_type 是 2 的 (FormBoundDocument)
     * 有在 upload_documents 表 但沒有在 form_binding_association 裡面的 (UnboundDocument)
     */

    try {
        let datasets_id = req.params.datasets_id;
        const { menu } = require("../../model/dbConvertModel");
        let rs = await sql.query(
            `SELECT 
                ud.id, 
                ud.originalname, 
                ud.is_enable, 
                ud.filename, 
                ud.training_state, 
                ud.create_time, 
                ud.update_time, 
                ud.separator,
                ud.datasource_name,
                ud.datasource_url,
                ud.expiration_time,
                ud.created_by,
                ud.updated_by,
                CONCAT_WS('_',
                    created_ult.user_info_json->>'depNo',
                    created_ult.auth_id,
                    created_user.name
                ) AS created_by_name,
                CONCAT_WS('_',
                    updated_ult.user_info_json->>'depNo',
                    updated_ult.auth_id,
                    updated_user.name
                ) AS updated_by_name,
                CASE 
                    WHEN (ud.id IS NOT NULL and (fba.binding_type IS NULL OR fba.binding_type = 2))
                    THEN 'UserUpload' 
                    WHEN (ud.id IS NOT NULL and fba.binding_type = 1)
                    THEN 'FormUpload'
                END as upload_type,
                CASE 
                    WHEN (ud.id IS NOT NULL and fba.binding_type = 2)
                    THEN 'FormBoundDocument' 
                    WHEN (ud.id IS NOT NULL and fba.document_id IS NULL)
                    THEN 'UnboundDocument'
                END as file_status,
                fba.binding_type
            FROM upload_documents ud
            LEFT JOIN form_binding_association fba 
                ON ud.id = fba.document_id
            LEFT JOIN users AS created_user 
                ON ud.created_by = created_user.id
            LEFT JOIN users AS updated_user 
                ON ud.updated_by = updated_user.id
            LEFT JOIN user_login_type AS created_ult 
                ON ud.created_by = created_ult.user_id
            LEFT JOIN user_login_type AS updated_ult 
                ON ud.updated_by = updated_ult.user_id
            WHERE ud.datasets_id = $1`,
            [datasets_id]
        );
        // at time zone 'utc' as create_time
        let rs1 = (await sql.query('select "name",describe from datasets where id = $1', [datasets_id])).rows[0];
        for (let obj of rs.rows) {
            obj.training_state_str = menu[obj.training_state];
        }

        rs1.documents = rs.rows;

        rsmodel.data = rs1;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getDocument = async function (req, res) {
    logRouteDetails("datasets.getDocument", req);
    let rsmodel = new responseModel();
    try {
        let datasets_id = req.params.datasets_id;
        let documents_id = req.params.documents_id;
        let rs = await sql.query("select is_enable,originalname from upload_documents where id = $1", [documents_id]);

        rsmodel.data = rs.rows[0];
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getChunks = async function (req, res) {
    logRouteDetails("datasets.getChunks", req);
    let rsmodel = new responseModel();
    try {
        let document_id = req.params.document_id;
        console.info("datasets.getChunks:", req.params);

        // 檢查document_id是否存在
        if (!document_id) {
            throw new Error("缺少document_id參數");
        }

        // 先找出datasets_id
        let rs = await UploadDocuments.findOne({
            where: { id: document_id },
            attributes: ["datasets_id"],
        });

        if (!rs) {
            throw new Error("無法找到對應的datasets_id");
        }

        const datasets_id = rs.dataValues.datasets_id;

        // 再透過document_id以及datasets_id去問Python，取得 parent_chunks 的ids
        rs = await pythonAPI.getParentNodeIds(process.env.PYTHON_API_HOST, document_id, datasets_id);

        if (!rs || !rs.data || !rs.data.data) {
            throw new Error("無法從Python API取得ParentNodeIdList");
        }

        const ParentNodeIdList = rs.data.data;

        // 去oarent_chunks表取得chunks資料。
        rs = await ParentChunks.findAll({
            where: { id: ParentNodeIdList },
            attributes: ["id", "page_content"],
        });

        if (!rs || rs.length === 0) {
            throw new Error("無法取得parent_chunks的chunk資料");
        }

        const resultArray = rs.map((item) => ({
            id: item.id,
            page_content: item.page_content,
        }));

        // 資料排序與返回資料
        rsmodel.data = resultArray;
        rsmodel.code = 0;
    } catch (e) {
        console.error("取得chunks資料發生錯誤", e);
        rsmodel.code = 1;
        rsmodel.message = e.message || "取得chunks資料時發生錯誤";
    }
    res.json(rsmodel);
};

exports.editChunk = async function (req, res) {
    logRouteDetails("datasets.editChunk", req);
    let rsmodel = new responseModel();
    try {
        let { fileID, chunkID, newContent } = JSON.parse(req.body);
        console.info("datasets.editChunk:", JSON.parse(req.body));

        rsmodel.code = 0;
        rsmodel.message = "儲存成功。";
    } catch (error) {
        rsmodel.message = "儲存新chunk內容過程發生錯誤。";
        console.error("Edit chunk fail.", error);
    }
    res.json(rsmodel);
};

exports.editDocumentSource = async function (req, res) {
    logRouteDetails("datasets.editDocumentSource", req);
    let rsmodel = new responseModel();
    try {
        let { datasets_id, document_id, datasource_url, datasource_name, expiration_time } = JSON.parse(req.body);
        console.info("datasets.editDocumentSource:", JSON.parse(req.body));

        const { uid = "" } = req.session.userInfo || {};

        // 檢查document_id是否存在
        if (!document_id) {
            throw new Error("缺少document_id參數");
        }

        // 從upload_documents查詢資料
        const documentData = await sql.query(
            "SELECT datasource_name, datasource_url FROM upload_documents WHERE id = $1",
            [document_id]
        );

        if (documentData.rows.length === 0) {
            throw new Error("找不到對應的document_id資料");
        }
        const { datasource_name: dbDatasourceName, datasource_url: dbDatasourceUrl } = documentData.rows[0];

        // 檢查 name 和 url 是不是一樣 如果都一樣就不要送 python 了
        if (dbDatasourceName === datasource_name && dbDatasourceUrl === datasource_url) {
            let sqlstr = "UPDATE upload_documents SET updated_by = $1, expiration_time = $2 WHERE id = $3";
            let sqlparam = [uid, expiration_time, document_id];
            let rs = await sql.query(sqlstr, sqlparam);

            if (rs.rowCount === 0) {
                throw new Error("更新 upload_documents 表失敗");
            }

            rsmodel.code = 0;
            rsmodel.message = "datasource_name 和 datasource_url 相同，已更新 updated_by 和 expiration_time";
            return res.json(rsmodel);
        }

        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const folderName = (await sql.query("select folder_name from datasets where id = $1", [datasets_id])).rows[0]
            .folder_name;

        const fileToDeactivate = {
            folder_name: folderName,
            operation_files: [
                {
                    upload_documents_id: document_id,
                    is_delete: 0,
                },
            ],
        };

        const pythonUploadResult = await pythonAPI.updateDocumentStatus(
            fileToDeactivate,
            process.env.PYTHON_API_HOST,
            ava_token
        );

        if (pythonUploadResult.data.code === 200) {
            // 更新upload_documents表

            let sqlstr =
                "update upload_documents set datasource_url = $1, datasource_name = $2, training_state = $3, updated_by = $4, expiration_time = $5 where id = $6";
            let sqlparam = [datasource_url, datasource_name, 2, uid, expiration_time, document_id];
            let rs = await sql.query(sqlstr, sqlparam);

            if (rs.rowCount === 0) {
                throw new Error("更新upload_documents表失敗");
            }
        }

        rsmodel.code = 0;
        rsmodel.message = "更新成功";
    } catch (error) {
        rsmodel.message = "edit document source fail.";
        console.log("edit document source fail.", error.message);
    }

    res.json(rsmodel);
};

exports.updateDocument = async function (req, res) {
    logRouteDetails("datasets.updateDocument", req);
    let rsmodel = new responseModel();
    try {
        // 這裡的 id 是 upload_documents 的 id

        let { datasets_id, id, state } = JSON.parse(req.body);
        console.info("datasets.updateDocument:", JSON.parse(req.body));

        const folder_name = (await sql.query("select folder_name from datasets where id = $1", [datasets_id])).rows[0]
            .folder_name;
        const datasource_type = "A";
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        if (state) {
            //如果是打開則送這個打開檔案的本體過去 並不重新訓練
            let obj = (await sql.query("select * from upload_documents where id = $1", [id])).rows[0];
            const formData = new FormData();
            formData.append("folder_name", folder_name);
            let file = readFile(`${folder_name}/${obj.filename}`);
            formData.append("filenames", obj.filename);

            formData.append("ava_token", ava_token);

            formData.append("originalnames", obj.originalname);
            formData.append("files", file);

            let rs = await axios.post(`${process.env.PYTHON_API_HOST}/uploads`, formData);
            if (rs.data.code === 200) {
                state = state ? 1 : 0;
                await sql.query("update upload_documents set is_enable = $1 where id = $2", [state, id]);
            } else {
                rsmodel.message = rs.data.message;
                res.json(rsmodel);
                return;
            }

            // 現在不用呼叫 indexing 了 只需要把 training_state 改成 2 就好 python 會自動去做 training_state 為 2 的文件
            // rs = await pythonAPI.activateIndexing(
            //     folder_name,
            //     [obj.filename],
            //     process.env.PYTHON_API_HOST,
            //     "",
            //     datasource_type,
            //     ava_token
            // );
            if (rs.data.code === 200) {
                state = state ? 1 : 0;
                let chk = await sql.query(
                    "update upload_documents set is_enable = $1,training_state = 2 where id = $2",
                    [state, id]
                );
                if (chk.rowCount !== 1) {
                    rsmodel.message = "未變更";
                    res.json(rsmodel);
                    return;
                }
            } else {
                rsmodel.message = rs.data.message;
                res.json(rsmodel);
                return;
            }
        } else {
            //如果是關閉則送全部沒關閉的 並重新訓練
            let rs = await sql.query("select * from upload_documents where datasets_id = $1 and is_enable = 1", [
                datasets_id,
            ]);
            let files = rs.rows;
            let filenames = files.map((m) => m.filename).filter((f) => f.split(".")[0] !== id);

            let pythonFiles = files.map((m) => ({
                folder_name: folder_name,
                filename: m.filename,
                originalname: m.originalname,
            }));
            const formData = new FormData();
            formData.append("folder_name", folder_name);
            formData.append("ava_token", ava_token);
            for (let obj of pythonFiles) {
                let file = readFile(`${folder_name}/${obj.filename}`);
                formData.append("filenames", obj.filename);
                formData.append("originalnames", obj.originalname);
                formData.append("files", file);
            }
            rs = await axios.post(`${process.env.PYTHON_API_HOST}/uploads`, formData);
            let rsData = rs.data.data;
            if (rs.data.code === 200) {
                let sqlstr = "update upload_documents set training_state = 1 where ";
                let sqlparam = [];
                // for (let obj of rs.data.data) {
                for (let i = 0; i < rsData.length; i++) {
                    let obj = rsData[i].split(".")[0];
                    if (i !== 0) sqlstr += " or ";
                    sqlstr += ` id = $${i + 1}`;
                    sqlparam.push(obj);
                }
                let chk2 = await sql.query(sqlstr, sqlparam);
            } else {
                rsmodel.message = rs.data.message;
                res.json(rsmodel);
                return;
            }

            // 現在不用呼叫 indexing 了 只需要把 training_state 改成 2 就好 python 會自動去做 training_state 為 2 的文件
            // rs = await pythonAPI.activateIndexing(
            //     folder_name,
            //     filenames,
            //     process.env.PYTHON_API_HOST,
            //     "",
            //     datasource_type,
            //     ava_token
            // );
            if (rs.data.code === 200) {
                let sqlstr =
                    "update upload_documents set training_state = 2 where is_enable = 1 and id != $1 and datasets_id = $2";
                let sqlparam = [id, datasets_id];
                let chk2 = await sql.query(sqlstr, sqlparam);
                state = state ? 1 : 0;
                let chk = await sql.query("update upload_documents set is_enable = $1 where id = $2", [state, id]);
                if (chk.rowCount !== 1) {
                    rsmodel.message = "未變更";
                    res.json(rsmodel);
                    return;
                }
            } else {
                rsmodel.message = rs.data.message;
                res.json(rsmodel);
                return;
            }
        }
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.delDocument = async function (req, res) {
    logRouteDetails("datasets.delDocument", req);
    let rsmodel = new responseModel();
    try {
        const { id, datasets_id } = req.params;
        console.info("datasets.delDocument:", req.params);
        const folder_name = (await sql.query("select folder_name from datasets where id = $1", [datasets_id])).rows[0]
            .folder_name;

        let rs = await sql.query("select * from upload_documents where datasets_id = $1 and is_enable = 1", [
            datasets_id,
        ]);
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        let files = rs.rows;
        let filenames = files.map((m) => m.filename).filter((f) => f.split(".")[0] !== id);
        let pythonFiles = files.map((m) => ({
            folder_name: folder_name,
            filename: m.filename,
            originalname: m.originalname,
        }));
        const formData = new FormData();
        formData.append("folder_name", folder_name);
        formData.append("ava_token", ava_token);
        for (let obj of pythonFiles) {
            let file = readFile(`${folder_name}/${obj.filename}`);
            formData.append("filenames", obj.filename);
            formData.append("originalnames", obj.originalname);
            formData.append("files", file);
        }
        rs = await axios.post(`${process.env.PYTHON_API_HOST}/uploads`, formData);
        let rsData = rs.data.data;
        if (rs.data.code === 200) {
            let sqlstr = "update upload_documents set training_state = 1 where ";
            let sqlparam = [];
            // for (let obj of rs.data.data) {
            for (let i = 0; i < rsData.length; i++) {
                let obj = rsData[i].split(".")[0];
                if (i !== 0) sqlstr += " or ";
                sqlstr += ` id = $${i + 1}`;
                sqlparam.push(obj);
            }
            let chk2 = await sql.query(sqlstr, sqlparam);
        } else {
            rsmodel.message = rs.data.message;
            res.json(rsmodel);
            return;
        }

        // 現在不用呼叫 indexing 了 只需要把 training_state 改成 2 就好 python 會自動去做 training_state 為 2 的文件
        // const datasource_type = "A";
        // rs = await pythonAPI.activateIndexing(
        //     folder_name,
        //     filenames,
        //     process.env.PYTHON_API_HOST,
        //     "",
        //     datasource_type,
        //     ava_token
        // );
        if (rs.data.code === 200) {
            let sqlstr =
                "update upload_documents set training_state = 2 where is_enable = 1 and id != $1 and datasets_id = $2";
            let sqlparam = [id, datasets_id];
            let chk2 = await sql.query(sqlstr, sqlparam);
            let chk = await sql.query("delete from upload_documents where id = $1", [id]);

            if (chk.rowCount !== 1) {
                rsmodel.message = "未變更";
                res.json(rsmodel);
                return;
            }
        } else {
            rsmodel.message = rs.data.message;
            res.json(rsmodel);
            return;
        }
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
};

exports.updateDocumentStatus = async function (req, res) {
    logRouteDetails("datasets.updateDocumentStatus", req);
    let rsmodel = new responseModel();
    try {
        const { updateData, datasets_id } = JSON.parse(req.body);
        console.info("datasets.updateDocumentStatus:", JSON.parse(req.body));
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        const folderName = (await sql.query("select folder_name from datasets where id = $1", [datasets_id])).rows[0]
            .folder_name;
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;

        if (!folderName) {
            console.error("未找到知識庫ID，請聯絡管理員");
            rsmodel.message = "未找到知識庫ID，請聯絡管理員";
            res.json(rsmodel);
            return;
        }

        // 新增檢查所有檔案 ID 是否存在於 upload_documents 表中
        const allFileIds = updateData.map((item) => item.id);
        const query = {
            text: `SELECT id FROM upload_documents WHERE id = ANY($1::varchar[])`,
            values: [allFileIds],
        };
        const result = await sql.query(query);

        if (result.rows.length !== allFileIds.length) {
            console.error("未找到所有的文件ID");
            rsmodel.message = "未找到所有的文件ID";
            res.json(rsmodel);
            return;
        }

        fileToDeactivate = {
            folder_name: folderName,
            operation_files: [],
        };
        let files = [];
        let upload_files_id = [];
        for (let obj of updateData) {
            if (obj.state == 2) {
                upload_files_id.push(obj.id);
            } else {
                fileToDeactivate.operation_files.push({
                    upload_documents_id: obj.id,
                    is_delete: obj.state == 5 ? 1 : 0,
                    updated_by: uid,
                });
            }
        }

        if (upload_files_id.length !== 0) {
            const params = upload_files_id.map((_, index) => `$${index + 1}`).join(", ");
            const query = {
                text: `SELECT * FROM upload_documents WHERE id IN (${params})`,
                values: upload_files_id,
            };
            let filenames = [];
            let filesSeparate = [];
            rs = await sql.query(query);

            for (let obj of rs.rows) {
                files.push({
                    upload_documents_id: obj.id,
                    filename: obj.filename,
                    originalname: obj.originalname,
                    upload_folder_id: obj.update_folder_id,
                    datasets_id: obj.datasets_id,
                    datasource_url: obj.datasource_url,
                    datasource_name: obj.datasource_name,
                    separator: obj.separator,
                    updated_by: uid,
                });
                filenames.push(obj.filename);
                // 因為啟動的時候 不同的檔案會有不同的 separator 所以要依序將檔案的 separator 用 push 的方式保持順序一致
                filesSeparate.push(obj.separator);
            }

            const { sqlstr, sqlparam } = generateUploadDocumentUpdateSQL(files, true, 2);

            await sql.query(sqlstr, sqlparam);

            // ENABLE
            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.ENABLE,
                entityType: AUDIT_LOG_ENTITY_TYPE.ENABLE_DOCUMENT,
                targetId: datasets_id,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    datasets_id: datasets_id,
                    files,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        }

        // 禁用(刪除) 還是會 call python api
        if (fileToDeactivate.operation_files.length !== 0) {
            // 構建 SQL 語句，用來更新 updated_by
            const { sqlstr, sqlparam } = generateUploadDocumentUpdateSQL(fileToDeactivate.operation_files, false);

            await sql.query(sqlstr, sqlparam);
            const pythonUploadResult = await pythonAPI.updateDocumentStatus(
                fileToDeactivate,
                process.env.PYTHON_API_HOST,
                ava_token
            );

            if (pythonUploadResult.data.code != 200) {
                console.warn("檔案上傳失敗");
                rsmodel.message = "檔案上傳失敗";
                res.json(rsmodel);
                return;
            }

            // DISABLE
            await logActivity({
                userId: uid,
                username: username || uid,
                actionType: AUDIT_LOG_ACTION_TYPE.DISABLE,
                entityType: AUDIT_LOG_ENTITY_TYPE.DISABLE_DOCUMENT,
                targetId: datasets_id,
                targetCategory: AUDIT_LOG_TARGET_CATEGORY,
                parameters: {
                    datasets_id: datasets_id,
                    fileToDeactivate,
                },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        }
        rsmodel.message = "更新成功";
        rsmodel.code = 0;
    } catch (error) {
        console.error(error);
        rsmodel.message = "發生錯誤 " + error;
        rsmodel.code = 1;
    }
    res.json(rsmodel);
};

exports.updateFileState = async function (req, res) {
    logRouteDetails("datasets.updateFileState", req);
    let rsmodel = new responseModel();
    try {
        let { data } = JSON.parse(req.body);
        console.info("datasets.updateFileState:", JSON.parse(req.body));

        if (data.length === 0) return;

        let sqlstr = "update upload_documents set training_state = case";
        let sqlparam = [];
        let whereClause = " where ";

        for (let i = 0; i < data.length; i++) {
            let fileObj = data[i];
            let fileId = fileObj.filename.split(".")[0];

            sqlstr += ` when id = $${sqlparam.length + 1} then ${fileObj.status}`;
            sqlparam.push(fileId);

            if (i !== 0) whereClause += " or ";
            whereClause += `id = $${sqlparam.length}`;
        }

        sqlstr += ` end${whereClause}`;

        let chk = await sql.query(sqlstr, sqlparam);
        if (chk.rowCount > 0) {
            rsmodel.code = 0;
        }
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

/**
 * 獲取知識庫的內容替換啟用狀態
 */
exports.getEnableContentReplacement = async function (req, res) {
    logRouteDetails("datasets.getEnableContentReplacement", req);
    let rsmodel = new responseModel();
    try {
        const { datasets_id } = req.params;
        const query = {
            text: "SELECT config_jsonb FROM datasets WHERE id = $1 limit 1",
            values: [datasets_id],
        };

        const result = await sql.query(query);
        if (result.rows.length === 0) {
            rsmodel.message = "找不到知識庫";
            res.json(rsmodel);
            return;
        }

        const config_jsonb = result.rows[0].config_jsonb || {};
        const enable = config_jsonb.hasOwnProperty("enable_content_replacement_list")
            ? config_jsonb.enable_content_replacement_list
            : true;
        rsmodel.code = 0;
        rsmodel.data = {
            enable_content_replacement_list: enable,
        };

        // 記錄審計日誌
        await logActivity({
            userId: req.session?.userInfo?.uid || "系統",
            username: req.session?.userInfo?.name || "系統操作",
            actionType: AUDIT_LOG_ACTION_TYPE.READ,
            entityType: AUDIT_LOG_ENTITY_TYPE.DATASETS_CONFIG,
            targetId: datasets_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                datasets_id,
                config_key: "enable_content_replacement_list",
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (error) {
        console.error(error);
        rsmodel.message = "發生錯誤: " + error.message;
    }
    res.json(rsmodel);
};

/**
 * 更新知識庫的內容替換啟用狀態
 */
exports.updateEnableContentReplacement = async function (req, res) {
    logRouteDetails("datasets.updateEnableContentReplacement", req);
    let rsmodel = new responseModel();
    try {
        const { datasets_id, enable_content_replacement_list } = JSON.parse(req.body);
        const checkQuery = {
            text: "SELECT config_jsonb FROM datasets WHERE id = $1",
            values: [datasets_id],
        };
        const checkResult = await sql.query(checkQuery);
        if (checkResult.rows.length === 0) {
            rsmodel.message = "找不到知識庫";
            res.json(rsmodel);
            return;
        }

        let config_jsonb = checkResult.rows[0].config_jsonb || {};
        const enable = !(config_jsonb.hasOwnProperty("enable_content_replacement_list")
            ? config_jsonb.enable_content_replacement_list
            : true);
        config_jsonb.enable_content_replacement_list = enable;
        const updateQuery = {
            text: "UPDATE datasets SET config_jsonb = $1 WHERE id = $2",
            values: [config_jsonb, datasets_id],
        };
        await sql.query(updateQuery);

        try {
            await pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST, `${SESSION_KEY_PREFIX}${req.sessionID}`);
        } catch (apiError) {
            console.warn("重新載入知識庫API呼叫失敗，但配置已更新", apiError);
        }

        rsmodel.code = 0;
        rsmodel.data = { enable_content_replacement_list: enable };
        rsmodel.message = enable_content_replacement_list ? "已啟用內容替換" : "已停用內容替換";

        // 記錄審計日誌
        await logActivity({
            userId: req.session?.userInfo?.uid || "系統",
            username: req.session?.userInfo?.name || "系統操作",
            actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.DATASETS_CONFIG,
            targetId: datasets_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            parameters: {
                datasets_id,
                config_key: "enable_content_replacement_list",
                new_value: enable_content_replacement_list,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (error) {
        console.error(error);
        rsmodel.message = "發生錯誤: " + error.message;
    }
    res.json(rsmodel);
};

exports.getDatasource = async function (req, res) {
    logRouteDetails("datasets.getDatasource", req);
    let rsmodel = new responseModel();
    try {
        const { datasets_id } = req.query;
        let rs;
        // if(datasets_id){
        //     const query = { text: `select a.id,a.mark,a.name from datasource_type a left join datasource b on a.id=b.type where b.datasets_id = $1`,values:[datasets_id]};
        //     rs = await sql.query(query);
        //     rs = rs.rows;
        // }else{
        const query = { text: `select id,mark,"name" from datasource_type` };
        rs = await sql.query(query);
        rs = rs.rows;
        // }
        rsmodel.code = 0;
        rsmodel.data = rs;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getDatasetUsageData = async function (req, res) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    logRouteDetails("datasets.getDatasetUsageData", req);
    let rsmodel = new responseModel();
    try {
        const { expertId, startDate, endDate } = req.query;

        // 檢查時間
        const formatDate = (date, isStart) => {
            if (!date) {
                if (isStart) {
                    throw new Error("起始日期為必填");
                } else {
                    return dayjs().format("YYYY-MM-DD HH:mm:ss");
                }
            }

            if (!dayjs(date).isValid()) {
                throw new Error(`${isStart ? "起始" : "結束"}日期格式錯誤(請輸入YYYY-MM-DD HH:mm:ss)`);
            }

            return date.replace(/\s/g, "").length > 10
                ? dayjs(date).format("YYYY-MM-DD HH:mm:ss")
                : dayjs(date)[isStart ? "startOf" : "endOf"]("day").format("YYYY-MM-DD HH:mm:ss");
        };

        const searchStartTime = formatDate(startDate, true);
        const searchEndTime = formatDate(endDate, false);

        // HistoryMessage 表取值
        const messageData = await HistoryMessage.findAll({
            attributes: ["id", "expert_id"],
            where: {
                ...(expertId && { expert_id: expertId }),
                create_time: { [Op.between]: [searchStartTime, searchEndTime] },
            },
        });

        const messageDataMap = new Map(messageData.map((m) => [m.id, m]));
        const messageIds = messageData.map((m) => m.id);
        const expertIds = new Set(messageData.map((m) => m.expert_id));

        // MessageChunkMapping 表取值
        const messageChunkMappingData = await MessageChunkMapping.findAll({
            attributes: ["message_id", "dataset_id"],
            where: { message_id: { [Op.in]: messageIds } },
        });

        const datasetIds = new Set(messageChunkMappingData.map((m) => m.dataset_id));
        messageChunkMappingData.forEach((m) => {
            const target = messageDataMap.get(m.message_id);
            target.dataset_id = m.dataset_id;
        });

        // 過濾掉沒有 dataset_id 的資料
        const simplifiedMessageData = Array.from(messageDataMap.values()).filter((m) => m.dataset_id);
        const simplifiedMessageDataMap = new Map();
        simplifiedMessageData.forEach((m) => {
            const key = `${m.expert_id}-${m.dataset_id}`;
            const target = simplifiedMessageDataMap.get(key);
            if (target) {
                target.dataset_useage_count++;
            } else {
                simplifiedMessageDataMap.set(key, {
                    id: uuidv4(),
                    expert_id: m.expert_id,
                    dataset_id: m.dataset_id,
                    dataset_useage_count: 1,
                });
            }
        });

        // 並行查詢 Expert 和 Datasets
        const [expertData, datasetsData] = await Promise.all([
            Expert.findAll({ attributes: ["id", "name"], where: { id: { [Op.in]: Array.from(expertIds) } } }),
            Datasets.findAll({ attributes: ["id", "name"], where: { id: { [Op.in]: Array.from(datasetIds) } } }),
        ]);

        simplifiedMessageDataMap.forEach((m) => {
            m.expert_name = expertData.find((expert) => expert.id === m.expert_id)?.name || null;
            m.dataset_name = datasetsData.find((dataset) => dataset.id === m.dataset_id)?.name || null;
            m.start_date = searchStartTime;
            m.end_date = searchEndTime;
        });

        rsmodel.code = 0;
        rsmodel.data = Array.from(simplifiedMessageDataMap.values());
    } catch (e) {
        console.error("Error in getting dataset usage data.", e);
        rsmodel.code = 1;
        rsmodel.message = e.message;
    }
    res.json(rsmodel);
};

exports.getDocumentsByDatasetId = async function (req, res) {
    logRouteDetails("documents.getDocumentsByDatasetId", req);

    let rsmodel = new responseModel();

    try {
        // Get dataset_id from query parameters
        const datasets_id = req.query.datasets_id;

        if (!datasets_id) {
            rsmodel.code = 400;
            rsmodel.message = "Missing required parameter: dataset_id";
            return res.json(rsmodel);
        }

        // Define training state mapping
        const trainingStateMap = {
            0: "上傳失敗",
            1: "上傳成功",
            2: "建索引中",
            3: "建立成功",
            4: "禁用",
            5: "已刪除",
            7: "工作執行中",
            99: "檔案毀損",
        };

        // Query for documents by dataset_id
        const result = await sql.query(
            `SELECT 
                ud.id, 
                ud.originalname, 
                ud.training_state, 
                ud.is_enable,
                ud.create_time,
                ud.update_time,
                created_user.name AS created_by_name,
                updated_user.name AS updated_by_name
            FROM upload_documents ud
            LEFT JOIN users AS created_user 
                ON ud.created_by = created_user.id
            LEFT JOIN users AS updated_user
                ON ud.updated_by = updated_user.id
            WHERE ud.datasets_id = $1`,
            [datasets_id]
        );

        // Transform the results to include the text version of training_state
        const documents = result.rows.map((doc) => ({
            id: doc.id,
            name: doc.originalname,
            status: trainingStateMap[doc.training_state] || "未知狀態",
            status_code: doc.training_state,
            is_enable: doc.is_enable === 1 ? true : false,
            created_by: doc.created_by_name,
            updated_by: doc.updated_by_name,
            create_time: doc.create_time,
            update_time: doc.update_time,
        }));

        rsmodel.data = documents;
        rsmodel.code = 0;
    } catch (e) {
        console.error("Error in getDocumentsByDatasetId:", e);
        rsmodel.code = 500;
        rsmodel.message = "Internal server error";
    }

    res.json(rsmodel);
};
