const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const Feedback = require("../../orm/schema/feedback");
const FeedbackOptions = require("../../orm/schema/feedback_options");
const FeedbackProcess = require("../../orm/schema/feedback_process");
const HistoryMessages = require("../../orm/schema/history_messages");
const { Op } = require("sequelize"); // 引入 Sequelize 的運算符

exports.getFeedbackOptions = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        const feedbackOptions = await FeedbackOptions.findAll({
            attributes: ["id", "name", "status"], // 指定只回傳 id 和 name
            where: {
                status: { [Op.ne]: "admin" }, // 過濾掉 status 為 'admin' 的資料
                is_enable: 1,
            },
        });

        rsmodel.code = 0;
        rsmodel.data = feedbackOptions;
        res.json(rsmodel);
    } catch (error) {
        console.error(error.message);
        res.status(500).send(error.message);
    }
};

exports.getFeedbackByFeedbackId = async function (req, res) {
    let rsmodel = new responseModel();
    try {
        console.log("req.params", req.params);
        const feedbackId = req.params.feedback_id;
        const expertId = req.query.expertId;
        const userId = req.query.userId;
        const userType = req.query.userType;
        console.log("feedbackId", feedbackId, expertId, userId);

        const feedback = await Feedback.findOne({
            where: {
                id: feedbackId,
                expert_id: expertId,
            },
            attributes: ["feedback_type"],
        });

        if (!feedback) {
            rsmodel.code = 404;
            rsmodel.message = "Feedback not found";
            return res.status(404).json(rsmodel);
        }

        const feedbackProcess = await FeedbackProcess.findOne({
            where: {
                feedback_id: feedbackId,
                user_id: userId,
                user_type: userType,
            },
            attributes: ["feedback_options_ids", "comment"],
        });

        if (!feedbackProcess) {
            rsmodel.code = 404;
            rsmodel.message = "FeedbackProcess not found";
            return res.status(404).json(rsmodel);
        }

        rsmodel.code = 0;
        rsmodel.data = {
            feedbackType: feedback.feedback_type,
            feedbackOptionsIds: feedbackProcess.feedback_options_ids,
            comment: feedbackProcess.comment,
        };

        res.json(rsmodel);
    } catch (error) {
        console.error(error.message);
        rsmodel.code = 500;
        rsmodel.message = error.message;
        res.status(500).json(rsmodel);
    }
};

exports.createOrUpdateFeedback = async function (req, res) {
    let rsmodel = new responseModel();

    try {
        const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress).split(",")[0];
        const data = JSON.parse(req.body);

        console.log("data", data);

        let feedback, feedbackProcess;

        if (data.feedbackId) {
            // Update existing Feedback
            const [updatedRowsCount, updatedFeedbacks] = await Feedback.update(
                { feedback_type: data.feedbackType },
                {
                    where: {
                        id: data.feedbackId,
                        expert_id: data.expert_id,
                    },
                    returning: true,
                }
            );

            if (updatedRowsCount === 0) {
                throw new Error("No matching feedback found to update");
            }

            feedback = updatedFeedbacks[0];

            // Update existing FeedbackProcess
            const [updatedProcessCount, updatedProcesses] = await FeedbackProcess.update(
                {
                    feedback_options_ids: data.feedbackOptionsIds,
                    comment: data.comment,
                },
                {
                    where: {
                        feedback_id: data.feedbackId,
                        user_type: data.user_type,
                        user_id: data.user_id,
                    },
                    returning: true,
                }
            );

            if (updatedProcessCount === 0) {
                throw new Error("No matching feedback process found to update");
            }

            feedbackProcess = updatedProcesses[0];
        } else {
            // 拿到 historyMessage 的 input (question)
            const historyMessage = await HistoryMessages.findOne({
                where: { id: data.historyMessagesId },
                attributes: ["input"], // Assuming 'input' is the column name you want to retrieve
            });

            // 找不到代表 python 沒有新增這筆資料 拋出錯誤
            if (!historyMessage) {
                throw new Error(`No HistoryMessages found with id ${data.historyMessagesId}`);
            }

            const historyInput = historyMessage.input;

            // Create new Feedback
            feedback = await Feedback.create({
                question: historyInput,
                answer: data.answer,
                status: 0,
                feedback_type: data.feedbackType,
                expert_id: data.expert_id,
                datasets_ids: data.datasetsIds,
                datasource_info: data.datasourceInfo,
                source_chunk_ids: data.sourceChunkIds,
                documents_ids: data.uploadDocumentsIds,
                history_messages_id: data.historyMessagesId,
                ip: ip,
            });

            feedbackProcess = await FeedbackProcess.create({
                feedback_id: feedback.id,
                feedback_options_ids: data.feedbackOptionsIds,
                tags_id: [],
                comment: data.comment,
                user_type: "user",
                user_id: data.user_id,
            });

            if (data.historyMessagesId) {
                const [updatedHistoryCount] = await HistoryMessages.update(
                    { feedback_id: feedback.id },
                    {
                        where: { id: data.historyMessagesId },
                    }
                );

                if (updatedHistoryCount === 0) {
                    console.warn(`No HistoryMessages found with id ${data.historyMessagesId}`);
                }
            }
        }

        // Fetch feedback options with names using ORM
        const feedbackOptions = await FeedbackOptions.findAll({
            where: {
                id: data.feedbackOptionsIds,
            },
            attributes: ["id", "name"],
        });

        // Transform the result to include names
        const feedbackOptionsWithNames = data.feedbackOptionsIds.map((id) => {
            const option = feedbackOptions.find((option) => option.id === id);
            return {
                id: id,
                name: option ? option.name : null,
            };
        });

        rsmodel.data = {
            feedback: feedback.get({ plain: true }),
            feedbackProcess: feedbackProcess.get({ plain: true }),
            feedbackOptionsWithNames,
        };
        rsmodel.success = true;
        rsmodel.message = data.feedbackId ? "Feedback updated successfully" : "Feedback created successfully";
    } catch (error) {
        console.error("Error creating/updating feedback:", error);
        rsmodel.success = false;
        rsmodel.message = "Error creating/updating feedback";
        rsmodel.error = error.message;
    }

    res.json(rsmodel);
};
