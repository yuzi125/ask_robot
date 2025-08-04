const { Op } = require("sequelize");
const dayjs = require("dayjs");
const { google } = require("googleapis");

const responseModel = require("../../model/responseModel");
const logRouteDetails = require("../routeNameLog");
const sql = require("../../db/pgsql");
const pythonAPI = require("../../utils/pythonAPI");
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

const Feedback = require("../../orm/schema/feedback");
const FeedbackOptions = require("../../orm/schema/feedback_options");
const FeedbackProcess = require("../../orm/schema/feedback_process");
const UserLoginType = require("../../orm/schema/user_login_type");
const Users = require("../../orm/schema/users");
const HistoryMessages = require("../../orm/schema/history_messages");
const Datasets = require("../../orm/schema/datasets");
const Settings = require("../../orm/schema/settings");

const bureauData = require("../../config/bureauData.json");
const keyFilePath = ".../../config/achamp-ava-kaohsiung-ae4bfceb0fba.json";
const googleAuth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
});
const googleDrive = google.drive({ version: "v3", auth: googleAuth });

exports.getFeedbackOptions = async function (req, res) {
    logRouteDetails("feedbackController.getFeedbackOptions", req);
    let rsmodel = new responseModel();

    try {
        const feedbackOptions = await FeedbackOptions.findAll();

        rsmodel.code = 0;
        rsmodel.data = feedbackOptions;
        res.json(rsmodel);
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.getFeedbackAdminProcess = async function (req, res) {
    logRouteDetails("feedbackController.getFeedbackAdminProcess", req);
    let rsmodel = new responseModel();

    try {
        const { feedbackId } = req.params;
        console.info("feedbackController.getFeedbackAdminProcess: ", feedbackId);
        const feedbackAdminProcess = await FeedbackProcess.findAll({
            where: {
                feedback_id: feedbackId,
                user_type: "admin",
            },
        });

        if (feedbackAdminProcess.length > 0) {
            const userIds = feedbackAdminProcess.map((process) => process.user_id);

            const usersLoginTypes = await UserLoginType.findAll({
                where: {
                    user_id: userIds,
                },
            });

            const users = await Users.findAll({
                where: {
                    id: userIds,
                },
            });

            const userLoginTypeMap = usersLoginTypes.reduce((acc, userLogin) => {
                acc[userLogin.user_id] = userLogin.auth_id;
                return acc;
            }, {});

            const userMap = users.reduce((acc, user) => {
                acc[user.id] = user.name;
                return acc;
            }, {});

            for (let process of feedbackAdminProcess) {
                process.dataValues.auth_id = userLoginTypeMap[process.user_id] || null;
                process.dataValues.user_name = userMap[process.user_id] || null;
            }
        }

        rsmodel.code = 0;
        rsmodel.data = feedbackAdminProcess;
        res.json(rsmodel);
    } catch (error) {
        console.error(`Error fetching FeedbackAdminProcess: ${error.message}`);
        res.status(500).send(error.message);
    }
};

exports.createFeedback = async function (req, res) {
    logRouteDetails("feedbackController.createFeedback", req);
    let rsmodel = new responseModel();

    try {
        const data = JSON.parse(req.body);
        console.info("feedbackController.createFeedback: ", data);

        console.log("data", data);

        // Create Feedback
        const feedback = await Feedback.create({
            question: data.question,
            answer: data.answer,
            status: 0, // As per requirement, initial status is 0
            feedback_type: data.feedbackType,
            expert_id: data.expert_id,

            datasets_ids: data.datasetsIds,
            datasource_info: data.datasourceInfo,
            source_chunk_ids: data.sourceChunkIds,
            documents_ids: data.uploadDocumentsIds, // Assuming this corresponds to documents_ids
            history_messages_id: data.historyMessagesId,
        });

        // Create FeedbackProcess
        const feedbackProcess = await FeedbackProcess.create({
            feedback_id: feedback.id,
            feedback_options_ids: data.feedbackOptionsIds,
            comment: data.comment,
            user_type: "user",
            user_id: data.user_id,
        });

        rsmodel.data = { feedback, feedbackProcess };
        rsmodel.success = true;
        rsmodel.message = "Feedback created successfully";
    } catch (error) {
        console.error("Error creating feedback:", error);
        rsmodel.success = false;
        rsmodel.message = "Error creating feedback";
        rsmodel.error = error.message;
    }

    res.json(rsmodel);
};

exports.getFeedbackFilter = async function (req, res) {
    logRouteDetails("feedbackController.getFeedbackFilter", req);
    let rsmodel = new responseModel();
    try {
        const { expertId } = req.query;
        console.info("feedbackController.getFeedbackFilter: ", expertId);
        let sqlstr = `
            WITH feedback_data AS (
                SELECT 
                    f.id AS feedback_id,
                    f.datasets_ids,
                    fp.feedback_options_ids
                FROM 
                    feedback f
                LEFT JOIN 
                    feedback_process fp ON f.id = fp.feedback_id
                WHERE 
                    f.expert_id = $1
            ),
            datasets_info AS (
                SELECT 
                    fd.feedback_id,
                    jsonb_agg(DISTINCT jsonb_build_object('id', d.id, 'name', d.name)) AS datasets
                FROM 
                    feedback_data fd,
                    jsonb_array_elements_text(fd.datasets_ids) AS dataset_id
                JOIN 
                    datasets d ON d.id::text = dataset_id
                GROUP BY 
                    fd.feedback_id
            ),
            feedback_options_info AS (
                SELECT 
                    fd.feedback_id,
                    jsonb_agg(
                        CASE 
                            WHEN fo.status::text = 'admin' THEN
                                jsonb_build_object('id', fo.id, 'name', fo.name, 'type', 'admin')
                            WHEN fo.status::text IN ('user_positive', 'user_negative') THEN
                                jsonb_build_object('id', fo.id, 'name', fo.name, 'type', 'user')
                        END
                    ) AS options
                FROM 
                    feedback_data fd,
                    jsonb_array_elements_text(fd.feedback_options_ids) AS option_id
                JOIN 
                    feedback_options fo ON fo.id::text = option_id
                GROUP BY 
                    fd.feedback_id
            ),
            aggregated_data AS (
                SELECT 
                    jsonb_agg(DISTINCT element) AS datasets,
                    jsonb_agg(DISTINCT o) FILTER (WHERE o->>'type' = 'admin') AS admin_options,
                    jsonb_agg(DISTINCT o) FILTER (WHERE o->>'type' = 'user') AS user_options
                FROM 
                    feedback_data fd
                LEFT JOIN 
                    datasets_info di ON fd.feedback_id = di.feedback_id
                LEFT JOIN 
                    feedback_options_info foi ON fd.feedback_id = foi.feedback_id,
                LATERAL jsonb_array_elements(di.datasets) AS element,
                LATERAL jsonb_array_elements(foi.options) AS o
            )
            SELECT 
                COALESCE(datasets, '[]'::jsonb) AS datasets,
                COALESCE(admin_options, '[]'::jsonb) AS admin_options,
                COALESCE(user_options, '[]'::jsonb) AS user_options
            FROM 
                aggregated_data;
        `;

        let rs = await sql.query(sqlstr, [expertId]);
        rsmodel.data = rs.rows;
        rsmodel.code = 0;
    } catch (error) {
        console.error(error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while fetching data";
    }
    res.json(rsmodel);
};

exports.getFeedback = async function (req, res) {
    logRouteDetails("feedbackController.getFeedback", req);
    let rsmodel = new responseModel();
    try {
        const { expertID, startDate, endDate } = req.query;
        console.info("feedbackController.getFeedback: ", req.query);
        // 查詢feedback資訊
        const startTime = dayjs(startDate).startOf("day").toDate();
        const endTime = dayjs(endDate).endOf("day").toDate();

        const feedbacks = await Feedback.findAll({
            where: {
                expert_id: expertID,
                create_time: {
                    [Op.between]: [startTime, endTime],
                },
            },
        });
        let newResData = feedbacks.map((e) => e.dataValues);

        // 取得所有的 feedback_id
        const feedbackIds = newResData.map((e) => e.id);

        // 批量查詢所有相關的 feedback_process 和 history_messages 資料
        const feedbackProcesses = await sql.query(
            `SELECT 
                fp.*,
                u.name,
                ult.auth_id,
                hm.model_params
            FROM 
                feedback_process fp
            LEFT JOIN 
                users u ON fp.user_id = u.id
            LEFT JOIN 
                user_login_type ult ON fp.user_id = ult.user_id
            LEFT JOIN 
                history_messages hm ON fp.feedback_id = hm.feedback_id
            WHERE 
                fp.feedback_id = ANY($1::int[]);`,
            [feedbackIds]
        );

        // 將查詢結果轉換為 Map 以便快速查找
        const feedbackProcessMap = feedbackProcesses.rows.reduce((acc, process) => {
            if (!acc[process.feedback_id]) {
                acc[process.feedback_id] = [];
            }
            acc[process.feedback_id].push(process);
            return acc;
        }, {});

        // 更新 newResData
        newResData = await Promise.all(
            newResData.map(async (e) => {
                const userProcess = feedbackProcessMap[e.id]?.find((p) => p.user_type === "user");

                e.userProcess = userProcess
                    ? {
                          name: userProcess.name,
                          authID: userProcess.auth_id,
                          options: userProcess.feedback_options_ids,
                          comment: userProcess.comment,
                      }
                    : {};

                e.source_chunk_content = e.source_chunk_ids;
                delete e.source_chunk_ids;

                if (e.datasets_ids.length > 0) {
                    const datasetsData = await Datasets.findAll({
                        attributes: ["id", "name"],
                        where: {
                            id: e.datasets_ids,
                        },
                    });
                    e.datasets = datasetsData;
                } else {
                    e.datasets = [];
                }
                delete e.datasets_ids;

                e.model_params = userProcess ? userProcess.model_params : null;

                return e;
            })
        );

        rsmodel.data = newResData;
        rsmodel.code = 0;
    } catch (error) {
        console.error(error);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while fetching data";
    }
    res.json(rsmodel);
};

async function createSheets(sheets, spreadsheetId, feedbackMap, isNewSheet) {
    const titleRow = [
        "評論ID",
        "發問日期",
        "使用者提問",
        "智能客服回覆",
        "評論",
        "好評、負評",
        "評論標籤",
        "業務分類是否正確",
        "建議承辦局處",
        "問題分類",
        "問題描述",
        "是否新增QA到1999知識庫",
        "標準答案",
        "填寫人",
        "單位科室",
    ];

    function feedbackTypeToStr(str) {
        switch (str) {
            case "user_positive":
                return "好評";
            case "user_negative":
                return "負評";
            default:
                return "其他";
        }
    }

    function to2DStrArray(data, index, isNewSheet) {
        const values = [];
        if (isNewSheet) {
            values.push(titleRow);
        }

        let insertData = [];
        for (let key of Object.keys(data)) {
            if (key === String(index)) {
                insertData = data[key];
                break;
            }
        }

        insertData.forEach((e) => {
            values.push([
                e.id,
                e.create_time.split("T")[0],
                e.question,
                e.answer,
                e.comment,
                feedbackTypeToStr(e.feedback_type),
                e.feedback_options,
            ]);
        });
        return values;
    }

    function toInsertRowsObject(sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, rows) {
        return {
            updateCells: {
                range: {
                    sheetId: sheetId,
                    startRowIndex: startRowIndex,
                    endRowIndex: endRowIndex,
                    startColumnIndex: startColumnIndex,
                    endColumnIndex: endColumnIndex,
                },
                rows: rows.map((row) => ({
                    values: row.map((cell) => ({
                        userEnteredValue: {
                            stringValue: String(cell),
                        },
                    })),
                })),
                fields: "userEnteredValue",
            },
        };
    }

    function toInsertOptionsObject(sheetId, startRowIndex, endRowIndex, startColumnIndex, options) {
        return {
            updateCells: {
                range: {
                    sheetId: sheetId,
                    startRowIndex: startRowIndex,
                    endRowIndex: endRowIndex,
                    startColumnIndex: startColumnIndex,
                    endColumnIndex: startColumnIndex + 1,
                },
                rows: Array(endRowIndex - startRowIndex).fill({
                    values: [
                        {
                            dataValidation: {
                                condition: {
                                    type: "ONE_OF_LIST",
                                    values: options.map((option) => ({ userEnteredValue: option })),
                                },
                                showCustomUi: true,
                                strict: true,
                            },
                        },
                    ],
                }),
                fields: "dataValidation",
            },
        };
    }

    function setDefaultInsertOptionsObject(sheetId, startRowIndex, endRowIndex, startColumnIndex, defaultValue) {
        return {
            updateCells: {
                range: {
                    sheetId: sheetId,
                    startRowIndex: startRowIndex,
                    endRowIndex: endRowIndex,
                    startColumnIndex: startColumnIndex,
                    endColumnIndex: startColumnIndex + 1,
                },
                rows: Array(endRowIndex - startRowIndex).fill({
                    values: [
                        {
                            userEnteredValue: {
                                stringValue: defaultValue,
                            },
                        },
                    ],
                }),
                fields: "userEnteredValue",
            },
        };
    }

    // create new sheets and delete default sheet Sheet1
    const sheetInfoMap = {};
    try {
        // add new sheets
        if (isNewSheet) {
            addsheetRequests = [];
            first = true;
            for (let b of bureauData) {
                if (first) {
                    addsheetRequests.push({
                        updateSheetProperties: {
                            properties: {
                                title: b.bureau_name,
                            },
                            fields: "title",
                        },
                    });
                    first = false;
                    continue;
                }
                addsheetRequests.push({
                    addSheet: { properties: { title: b.bureau_name } },
                });
            }
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: addsheetRequests,
                },
            });
        }

        // 獲取工作表的 ID
        const response = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
        });

        // 顯示所有工作表及其 sheetId and rowIndex
        const sheetInfo = response.data.sheets;
        const sheetPromises = sheetInfo.map(async (sheet) => {
            const sheetName = sheet.properties.title;
            const valuesResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: sheetName,
            });

            const values = valuesResponse.data.values || [];
            const rowIndex = values.length;
            return {
                sheetId: sheet.properties.sheetId,
                title: sheetName,
                rowIndex: rowIndex,
            };
        });

        const results = await Promise.all(sheetPromises);
        results.forEach((result) => {
            sheetInfoMap[result.title] = result;
        });
    } catch (error) {
        console.error("Error create new sheet:", error);
        return "failed";
    }

    try {
        // insert data (column A~G) to sheets
        console.log("Start Data appending");
        const insertRowsRequests = [];
        const rowsNumMap = {};
        bureauData.forEach((value) => {
            strArray = to2DStrArray(feedbackMap, value.bureau_code, isNewSheet);
            rowsNumMap[value.bureau_name] = strArray.length + sheetInfoMap[value.bureau_name].rowIndex;
            insertRowsRequests.push(
                toInsertRowsObject(
                    sheetInfoMap[value.bureau_name].sheetId,
                    sheetInfoMap[value.bureau_name].rowIndex,
                    rowsNumMap[value.bureau_name],
                    0,
                    titleRow.length,
                    strArray
                )
            );
        });

        if (insertRowsRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: insertRowsRequests,
                },
            });
            console.log("Data appended (column A~G) successfully");
        }

        // set column width
        if (isNewSheet) {
            const columnWidthRequests = [];
            const defaultWidth = 80;
            bureauData.forEach((value) => {
                columnWidthRequests.push({
                    updateDimensionProperties: {
                        range: {
                            sheetId: sheetInfoMap[value.bureau_name].sheetId,
                            dimension: "COLUMNS",
                            startIndex: 0,
                            endIndex: titleRow.length,
                        },
                        properties: {
                            pixelSize: defaultWidth,
                        },
                        fields: "pixelSize",
                    },
                });

                const specialColumnWidths = [
                    { startIndex: 2, endIndex: 5, width: 3 * defaultWidth },
                    { startIndex: 9, endIndex: 13, width: 3 * defaultWidth },
                ];

                specialColumnWidths.forEach(({ startIndex, endIndex, width }) => {
                    columnWidthRequests.push({
                        updateDimensionProperties: {
                            range: {
                                sheetId: sheetInfoMap[value.bureau_name].sheetId,
                                dimension: "COLUMNS",
                                startIndex: startIndex,
                                endIndex: endIndex,
                            },
                            properties: {
                                pixelSize: width,
                            },
                            fields: "pixelSize",
                        },
                    });
                });
            });

            if (columnWidthRequests.length > 0) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: columnWidthRequests,
                    },
                });
                console.log("Column widths updated successfully");
            }
        }

        // insert options (column G,H,J,O) to sheets
        const bureauDataList = [];
        bureauDataList.push(" ");
        bureauData.forEach((b) => {
            bureauDataList.push(b.bureau_name);
        });

        const insertOptionsRequests = [];
        bureauData.forEach((value) => {
            if (rowsNumMap[value.bureau_name] > 1) {
                const startRow = sheetInfoMap[value.bureau_name].rowIndex + isNewSheet ? 1 : 0;
                insertOptionsRequests.push(
                    toInsertOptionsObject(
                        sheetInfoMap[value.bureau_name].sheetId,
                        startRow,
                        rowsNumMap[value.bureau_name],
                        7,
                        ["正確", "非本單位業務"]
                    )
                );

                insertOptionsRequests.push(
                    setDefaultInsertOptionsObject(
                        sheetInfoMap[value.bureau_name].sheetId,
                        startRow,
                        rowsNumMap[value.bureau_name],
                        7,
                        "正確"
                    )
                );

                insertOptionsRequests.push(
                    toInsertOptionsObject(
                        sheetInfoMap[value.bureau_name].sheetId,
                        startRow,
                        rowsNumMap[value.bureau_name],
                        9,
                        [
                            "未填寫",
                            "網站、知識庫有資料，但智能客服未回覆",
                            "網站、知識庫資料有誤",
                            "網站、知識庫未更新資料",
                            "網站、知識庫無資料",
                            "問題內容含專業術語",
                            "問題過於簡短",
                            "回覆內容不夠完整",
                            "回覆內容格式問題",
                            "回覆內容有誤",
                        ]
                    )
                );

                insertOptionsRequests.push(
                    setDefaultInsertOptionsObject(
                        sheetInfoMap[value.bureau_name].sheetId,
                        startRow,
                        rowsNumMap[value.bureau_name],
                        9,
                        "未填寫"
                    )
                );

                insertOptionsRequests.push(
                    toInsertOptionsObject(
                        sheetInfoMap[value.bureau_name].sheetId,
                        startRow,
                        rowsNumMap[value.bureau_name],
                        11,
                        ["新增一筆QA到1999知識庫", "否"]
                    )
                );

                insertOptionsRequests.push(
                    setDefaultInsertOptionsObject(
                        sheetInfoMap[value.bureau_name].sheetId,
                        startRow,
                        rowsNumMap[value.bureau_name],
                        11,
                        "否"
                    )
                );

                insertOptionsRequests.push(
                    toInsertOptionsObject(
                        sheetInfoMap[value.bureau_name].sheetId,
                        startRow,
                        rowsNumMap[value.bureau_name],
                        8,
                        bureauDataList
                    )
                );

                insertOptionsRequests.push(
                    setDefaultInsertOptionsObject(
                        sheetInfoMap[value.bureau_name].sheetId,
                        startRow,
                        rowsNumMap[value.bureau_name],
                        8,
                        " "
                    )
                );
            }
        });

        if (insertOptionsRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: insertOptionsRequests,
                },
            });
        }
        console.log("Option appended (column G, H, J) successfully");

        const fontRequests = [];
        bureauData.forEach((value) => {
            if (!sheetInfoMap[value.bureau_name]) {
                return;
            }
            fontRequests.push({
                repeatCell: {
                    range: {
                        sheetId: sheetInfoMap[value.bureau_name].sheetId,
                        startRowIndex: 0,
                        endRowIndex: rowsNumMap[value.bureau_name],
                        startColumnIndex: 0,
                        endColumnIndex: titleRow.length,
                    },
                    cell: {
                        userEnteredFormat: {
                            textFormat: {
                                fontFamily: "Arial",
                                fontSize: 10,
                                bold: false,
                            },
                        },
                    },
                    fields: "userEnteredFormat.textFormat",
                },
            });
        });

        if (fontRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: fontRequests,
                },
            });
        }
        console.log("Font format updated successfully");

        if (isNewSheet) {
            const cellFormatRequests = [];
            bureauData.forEach((value) => {
                cellFormatRequests.push({
                    updateBorders: {
                        range: {
                            sheetId: sheetInfoMap[value.bureau_name].sheetId,
                            startRowIndex: 0,
                            endRowIndex: 1,
                            startColumnIndex: 0,
                            endColumnIndex: titleRow.length,
                        },
                        top: { style: "SOLID", width: 1 },
                        bottom: { style: "SOLID", width: 1 },
                        left: { style: "SOLID", width: 1 },
                        right: { style: "SOLID", width: 1 },
                    },
                });
            });

            if (cellFormatRequests.length > 0) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: cellFormatRequests,
                    },
                });
            }
        }
        console.log("Cell borders updated successfully");
        console.log("Create and append data to sheets successfully");
    } catch (error) {
        console.error("Error appending data:", error);
        return "failed";
    }
    return "success";
}

async function getFeedbackGoogleSheetID(sheets) {
    const row = await Settings.findOne({
        where: {
            key: "feedback_classify_google_sheet_id",
        },
    });

    if (!row || !row.value || row.value === "") {
        try {
            console.log("create feedbackToGoogleSheet");
            const response = await sheets.spreadsheets.create({
                resource: {
                    properties: {
                        title: `問題反饋處理意見`,
                    },
                },
                fields: "spreadsheetId",
            });
            if (!response || !response.data || !response.data.spreadsheetId) {
                console.log("create feedbackToGoogleSheet failed", sheetName);
                return { success: false, isNewSheet: false, googleSheetID: "" };
            }

            await Settings.create({
                key: "feedback_classify_google_sheet_id",
                value: response.data.spreadsheetId,
            });
            return { success: true, isNewSheet: true, googleSheetID: response.data.spreadsheetId };
        } catch (error) {
            console.error("Error create empty google sheet:", error);
            return { success: false, isNewSheet: false, googleSheetID: "" };
        }
    } else {
        let googleSheetID = row.value;
        console.log("check googleSheet exist", googleSheetID);
        try {
            const response = await sheets.spreadsheets.get({
                spreadsheetId: googleSheetID,
            });
            return { success: !!response.data, isNewSheet: false, googleSheetID: googleSheetID };
        } catch (error) {
            return { success: false, isNewSheet: false, googleSheetID: "" };
        }
    }
}

async function feedbacksToGoogleSheet(feedbackMap) {
    console.log("start feedbacksToGoogleSheets");
    const authClient = await googleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });
    console.log("create sheet success");

    // create file if id not exist
    const { success, isNewSheet, googleSheetID } = await getFeedbackGoogleSheetID(sheets);
    if (!success) {
        console.log("Error getting feedback google sheet id");
        return "";
    }

    // add sheets
    try {
        const result = await createSheets(sheets, googleSheetID, feedbackMap, isNewSheet);
        if (result === "failed") {
            return "";
        }
    } catch (error) {
        console.error("Error add sheets:", error);
        return "";
    }

    // publish file
    if (isNewSheet) {
        try {
            await googleDrive.permissions.create({
                fileId: googleSheetID,
                requestBody: {
                    role: "writer",
                    type: "anyone",
                },
            });
        } catch (error) {
            console.error("Error publish spreadsheet:", error);
            return "";
        }
    }
    return googleSheetID;
}

async function feedbackClassify(reqData, ava_token) {
    /**
     * reqData = {{id1:Q1}, {id2:Q2}, ......}
     */

    /**
     * resultMap = {
     *     classId1 : [id1, id2, ....],
     *     classId2 : [...],
     *     ...
     * }
     */

    let remainData = JSON.parse(JSON.stringify(reqData));
    let resultMap = {};
    let unclassifiedIDSet = new Set();
    let retry = 3;

    for (let i = 0; i < retry; i++) {
        // send all requests at once
        const batches = [];
        for (let j = 0; j < remainData.length; j += 500) {
            batches.push(remainData.slice(j, j + 500));
        }
        const batchPromises = batches.map(async (batch) => {
            const response = await pythonAPI.classifyFeedback(batch, process.env.PYTHON_API_HOST, ava_token);
            if (response.status !== 200) {
                return { error: true, classifiedResult: {}, unclassifiedIDList: [] };
            }
            return response;
        });
        const responses = await Promise.all(batchPromises);

        // count up all results
        for (let response of responses) {
            if (!(response && response.data && response.data.code === 200)) {
                return { error: true, classifiedResult: {}, unclassifiedIDList: [] };
            }

            /**
             * message = {
             *  "classID1": ["questionID1", "questionID2", ...],
             *  "classID2": ["questionID1", "questionID2", ...],
             *  ...
             * }
             */
            const message = response.data.message;
            const unclassifiedIDList = response.data.unclassified_id_list;
            console.log("response", response.data);

            if (Array.isArray(unclassifiedIDList)) {
                unclassifiedIDList.forEach((item) => unclassifiedIDSet.add(item));
            }
            Object.keys(message).forEach((classID) => {
                if (!resultMap[classID] || !Array.isArray(resultMap[classID])) {
                    resultMap[classID] = [];
                }
                arr = Array.isArray(message[classID]) ? message[classID] : [];
                resultMap[classID].push(...arr);
            });
        }

        if (unclassifiedIDSet.size === 0) {
            break;
        }

        // record init for next round
        if (i < retry - 1) {
            remainData = {};
            unclassifiedIDSet.forEach((id) => {
                remainData[id] = reqData[id];
            });
            unclassifiedIDSet = new Set();
        }
    }

    return { error: false, classifiedResult: resultMap, unclassifiedIDSet: Array.from(unclassifiedIDSet) };
}

async function feedback(startDate, endDate, sessionID) {
    const startTime = dayjs(startDate).startOf("day");
    const endTime = dayjs(endDate).endOf("day");
    const feedbackRecords = await sql.query(
        `SELECT f.id, f.question, f.answer, f.feedback_type, f.create_time, 
                fp.feedback_options_ids, fp.comment
         FROM feedback f
         LEFT JOIN feedback_process fp 
            ON f.id = fp.feedback_id AND fp.user_type = 'user'
         WHERE f.create_time BETWEEN $1 AND $2 
            AND f.feedback_type = 'user_negative'`,
        [startTime, endTime]
    );

    const feedbackOptions = await sql.query(
        `SELECT id, name 
         FROM feedback_options 
         WHERE status IN ('user_positive', 'user_negative') 
            AND is_enable = 1`
    );

    // 建立 ID -> 名稱的對應表
    const feedbackOptionsMap = Object.fromEntries(feedbackOptions.rows.map(({ id, name }) => [id, name]));

    // 使用 map() 轉換資料
    const processedFeedback = feedbackRecords.rows.map((row) => ({
        ...row,
        feedback_options:
            row.feedback_options_ids
                ?.map((id) => feedbackOptionsMap[id])
                .filter(Boolean)
                .join(", ") || "",
    }));

    const sqlResultMap = {};
    processedFeedback.forEach((e) => {
        sqlResultMap[e.id] = {
            id: e.id,
            question: e.question,
            answer: e.answer,
            feedback_type: e.feedback_type,
            feedback_options: e.feedback_options,
            comment: e.comment,
            create_time: e.create_time,
        };
    });

    const reqData = processedFeedback.map((e) => {
        return { [e.id]: e.question };
    });

    const ava_token = `${SESSION_KEY_PREFIX}${sessionID}`;
    const { error, classifiedResult, unclassifiedIDList } = await feedbackClassify(reqData, ava_token);

    if (error) {
        return { classifyGoWrong: true, resultMap: {}, unclassifiedSet: [] };
    }

    const resultMap = {};
    for (const [classId, questionIDArray] of Object.entries(classifiedResult)) {
        if (!resultMap[classId]) {
            resultMap[classId] = [];
        }

        questionIDArray.forEach((questionID) => {
            resultMap[classId].push(sqlResultMap[questionID]);
        });
    }
    /**
     * resultMap = {
     *  "classID1": [{
     *      id: id,
     *      question: "",
     *      answer: "",
     *      create_time: "",
     *      feedback_type: "",
     *      feedback_options: "",
     *      comment: "",
     *  }, ...],
     * "classID2": [...],
     * "classID3": [],
     *  ...
     * }
     */
    return { classifyGoWrong: false, resultMap: resultMap, unclassifiedSet: unclassifiedIDList };
}

exports.getGoogleSheetsLink = async function (req, res) {
    logRouteDetails("feedbackController.getGoogleSheetsLink", req);
    let rsmodel = new responseModel();
    try {
        const sheetID = await Settings.findOne({
            where: {
                key: "feedback_classify_google_sheet_id",
            },
        });

        if (sheetID) {
            rsmodel.data = `https://docs.google.com/spreadsheets/d/${sheetID.dataValues.value}/edit?gid=0#gid=0`;
        }

        rsmodel.code = 0;
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = "Getting google sheets link go wrong.";
        console.error("Getting google sheets link go wrong.", error);
    }
    res.json(rsmodel);
};

// localhost part
exports.feedbackToGoogleSheet = async function (req, res) {
    logRouteDetails("feedbackController.feedbackToGoogleSheet", req);
    let rsmodel = new responseModel();
    try {
        const { data } = JSON.parse(req.body);
        if (!data || Object.keys(data).length === 0) {
            throw new Error("Feedback data is empty.");
        }
        const spreadsheetId = await feedbacksToGoogleSheet(data);
        if (spreadsheetId === "") {
            rsmodel.code = 1;
            rsmodel.message = "Export feedback to google sheet go wrong.";
        } else {
            rsmodel.code = 0;
            rsmodel.message = "Export feedback to google sheet success.";
            rsmodel.spreadsheetId = spreadsheetId;
        }
    } catch (error) {
        console.error("Error getting feedback service:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

// kcg part
exports.exportFeedback = async function (req, res) {
    logRouteDetails("feedbackController.exportFeedback", req);
    console.log("feedbackController.exportFeedback: ", JSON.parse(req.body));
    const { startDate, endDate } = JSON.parse(req.body);
    const rsmodel = new responseModel();
    try {
        if (!startDate || !endDate) {
            throw new Error("Start date or end date is empty.");
        }
        const { classifyGoWrong, resultMap, unclassifiedSet } = await feedback(startDate, endDate, req.sessionID);
        if (classifyGoWrong) {
            throw new Error("Classify feedback go wrong.");
        }
        rsmodel.code = 0;
        rsmodel.data = { resultMap, unclassifiedSet };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        console.error("Export feedback error:", error);
    } finally {
        res.json(rsmodel);
    }
};

exports.fetchChunksContent = async function (req, res) {
    logRouteDetails("feedbackController.fetchChunksContent", req);
    let rsmodel = new responseModel();
    try {
        const { sourceChunks } = JSON.parse(req.body);
        console.info("feedbackController.fetchChunksContent: ", sourceChunks);
        let chunkIDs = [];
        sourceChunks.forEach((file) => {
            file.forEach((chunks) => {
                chunks.forEach((chunk) => {
                    chunkIDs.push(chunk.id);
                });
            });
        });

        const contentData = await sql.query(
            "SELECT id, page_content, meta_data FROM parent_chunks WHERE id = ANY($1::bigint[])",
            [chunkIDs]
        );
        let newSourceChunks = [];
        if (contentData?.rows?.length > 0) {
            newSourceChunks = sourceChunks.map((file) =>
                file.map((chunks) =>
                    chunks.map((chunk) => {
                        const target = contentData.rows.find((e) => e.id === chunk.id);
                        if (target) {
                            chunk.content = target.page_content;
                            chunk.meta_data = target.meta_data;
                        } else {
                            chunk.content = null;
                            chunk.meta_data = null;
                        }
                        return chunk;
                    })
                )
            );
        }

        rsmodel.data = newSourceChunks;
        rsmodel.code = 0;
    } catch (error) {
        console.error("Fetching chunks content go wrong :", error);
        rsmodel.code = 1;
        rsmodel.message = "取得參考來源內容過程發生問題。";
    }
    res.json(rsmodel);
};

exports.updateFeedbackProcess = async function (req, res) {
    logRouteDetails("feedbackController.updateFeedbackProcess", req);
    let rsmodel = new responseModel();
    const { feedbackId, statusId, tagsId, userId, comment } = JSON.parse(req.body); // 假設請求中包含id和statusId
    console.info("feedbackController.updateFeedbackProcess: ", JSON.parse(req.body));

    try {
        // 找到特定ID的資料
        const feedback = await Feedback.findByPk(feedbackId, {
            attributes: ["id"],
        });

        // 如果找不到評論資料，則報錯
        if (!feedback) {
            throw new Error(`Feedback with id ${feedbackId} not found`);
        }

        // 更新status欄位
        feedback.status = statusId[0];
        const updateFeedbackResult = await feedback.save();

        // 確認feedback更新成功
        if (updateFeedbackResult) {
            // 找到特定feedback_id和user_id的feedback_process資料
            const feedbackProcess = await FeedbackProcess.findOne({
                where: {
                    feedback_id: feedbackId,
                    user_id: userId,
                    user_type: "admin",
                },
            });

            if (feedbackProcess) {
                // 更新feedback_process資料
                feedbackProcess.feedback_options_ids = statusId;
                feedbackProcess.tags_id = tagsId;
                feedbackProcess.comment = comment;
                await feedbackProcess.save();
            } else {
                // 創建新的feedback_process資料
                await FeedbackProcess.create({
                    feedback_id: feedbackId,
                    feedback_options_ids: statusId,
                    tags_id: tagsId,
                    comment: comment,
                    user_type: "admin",
                    user_id: userId,
                });
            }
        }
        rsmodel.code = 0;
        rsmodel.message = "評論處理更新成功。";
        res.json(rsmodel);
    } catch (error) {
        console.error("Error updating feedback status:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
        res.status(500).json(rsmodel);
    }
};

exports.getFeedbackChartData = async function (req, res) {
    logRouteDetails("feedbackController.getFeedbackChartData", req);
    let rsmodel = new responseModel();
    const { expertId, startTime, endTime } = JSON.parse(req.body);
    console.info("feedbackController.getFeedbackChartData: ", JSON.parse(req.body));
    try {
        const responseData = {
            dailyData: [],
            feedbackRatio: {},
        };
        // 計算 startTime 和 endTime 之間的所有日期
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

        let currentDate = startDate;

        while (currentDate <= endDate) {
            responseData.dailyData.push({
                date: currentDate.toISOString().split("T")[0], // 只保留日期部分
                totalMsg: 0,
                userPositive: 0,
                userNegative: 0,
                noFeedbackNum: 0,
                notDoneFeedbacks: 0,
            });

            // 增加一天
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let totalMsg;
        if (expertId === "all") {
            totalMsg = await HistoryMessages.findAll({
                where: {
                    create_time: {
                        [Op.between]: [new Date(startTime), new Date(endTime)],
                    },
                },
            });
        } else {
            totalMsg = await HistoryMessages.findAll({
                where: {
                    expert_id: expertId,
                    create_time: {
                        [Op.between]: [new Date(startTime), new Date(endTime)],
                    },
                },
            });
        }

        // 將 totalMsg 中的資料日期計算到 responseData.dailyData 中
        totalMsg.forEach((msg) => {
            const msgDate = msg.create_time.toISOString().split("T")[0];
            const dayData = responseData.dailyData.find((d) => d.date === msgDate);
            if (dayData) {
                dayData.totalMsg += 1;
            }
        });

        let totalFeedback;
        if (expertId === "all") {
            totalFeedback = await Feedback.findAll({
                where: {
                    create_time: {
                        [Op.between]: [new Date(startTime), new Date(endTime)],
                    },
                },
            });
        } else {
            totalFeedback = await Feedback.findAll({
                where: {
                    expert_id: expertId,
                    create_time: {
                        [Op.between]: [new Date(startTime), new Date(endTime)],
                    },
                },
            });
        }

        // 將 totalFeedback 中的資料日期計算到 responseData.dailyData 中
        totalFeedback.forEach((feedback) => {
            const feedbackDate = feedback.create_time.toISOString().split("T")[0];
            const dayData = responseData.dailyData.find((d) => d.date === feedbackDate);
            if (dayData) {
                if (feedback.feedback_type === "user_positive") {
                    dayData.userPositive += 1;
                } else if (feedback.feedback_type === "user_negative") {
                    dayData.userNegative += 1;
                }
                if (feedback.status === 0) {
                    dayData.notDoneFeedbacks += 1;
                }
            }
        });

        // 計算 noFeedbackNum
        responseData.dailyData.forEach((dayData) => {
            dayData.noFeedbackNum = dayData.totalMsg - dayData.userPositive - dayData.userNegative;
            if (dayData.noFeedbackNum < 0) {
                dayData.noFeedbackNum = 0;
            }
        });

        // 計算 feedbackRatio
        const totalMsgNum = totalMsg.length;
        const totalFeedbackNum = totalFeedback.length;
        const ratio = totalMsgNum > 0 ? Math.round((totalFeedbackNum / totalMsgNum) * 100) : 0;

        responseData.feedbackRatio = {
            totalMsgNum: totalMsgNum,
            totalFeedbackNum: totalFeedbackNum,
            ratio: ratio,
        };

        rsmodel.code = 0;
        rsmodel.message = "";
        rsmodel.data = responseData;
        res.json(rsmodel);
    } catch (error) {
        console.error("Error getting feedback chart data:", error.message);
        rsmodel.code = 1;
        rsmodel.message = error.message;
        res.status(500).json(rsmodel);
    }
};

exports.updateFeedbackTags = async function (req, res) {
    logRouteDetails("feedbackController.updateFeedbackTags", req);
    let rsmodel = new responseModel();
    const { feedbackId, feedbackTags } = JSON.parse(req.body);
    console.info("feedbackController.updateFeedbackTags: ", JSON.parse(req.body));

    try {
        // 找到特定ID的資料
        const feedback = await Feedback.findByPk(feedbackId, {
            attributes: ["id"],
        });

        // 如果找不到評論資料，則報錯
        if (!feedback) {
            throw new Error(`Feedback with id ${feedbackId} not found`);
        }

        // 更新status欄位
        feedback.feedback_tags = feedbackTags;
        await feedback.save();

        rsmodel.code = 0;
        rsmodel.message = "評論標籤更新成功。";
        res.json(rsmodel);
    } catch (error) {
        console.error("Error updating feedback tags:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
        res.status(500).json(rsmodel);
    }
};
