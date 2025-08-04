// fileProcessController.js
const responseModel = require("../../model/responseModel");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const logRouteDetails = require("../routeNameLog");

// file service 的 url
const fileServiceUrl = process.env.AVA_FILE_SERVICE_URL || "http://127.0.0.1:8090";
const pythonApiHost = process.env.PYTHON_API_HOST || "http://127.0.0.1:5001/ava/api";
const sessionKeyPrefix = process.env.SESSION_KEY_PREFIX || "ava:";

exports.uploadFilesLlmApi = async (req, res) => {
    logRouteDetails("fileProcessController.uploadFilesLlmApi", req);
    const rsmodel = new responseModel();
    try {
        if (!req.files || req.files.length === 0) {
            rsmodel.message = "No files uploaded";
            rsmodel.success = false;
            return res.status(400).json(rsmodel);
        }

        const { message, model_list_id } = req.body;
        if (!message) {
            rsmodel.message = "Missing required parameters";
            rsmodel.success = false;
            return res.status(400).json(rsmodel);
        }

        const formData = new FormData();
        formData.append("message", message);
        model_list_id && formData.append("model_list_id", model_list_id);
        for (const file of req.files) {
            formData.append("files", fs.createReadStream(file.path), {
                filename: file.filename,
                contentType: file.mimetype,
            });
        }

        let response;
        try {
            let ava_token = `${sessionKeyPrefix}${req.sessionID}`;
            formData.append("ava_token", ava_token);
            
            response = await axios.post(`${pythonApiHost}/uploadFilesLlmApi`, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
            });
        } catch (err) {
            console.error(`Error uploading chat files: ${err.message}`);
            rsmodel.code = 1;
            rsmodel.message = `Error uploading chat files: ${err.message}`;
            rsmodel.data = { error: err.message };
        }

        // 使用file-service
        // const response = await axios.post(`${fileServiceUrl}/backend/uploadFilesLlmApi`, formData, {
        //     headers: {
        //         ...formData.getHeaders(),
        //     },
        // });

        for (const file of req.files) {
            fs.unlink(file.path, (err) => {
                if (err) console.error(`Error deleting temp file ${file.path}:`, err);
            });
        }        

        if (response.data.code === 200) {
            rsmodel.code = 0;
            rsmodel.message = "Files uploaded successfully";
            rsmodel.data = response.data.message;
        } else {
            rsmodel.code = 1;
            rsmodel.message = "Files uploaded failed";
            rsmodel.data = response.data.message;
        }
    } catch (error) {
        console.error("Error uploading files:", error);
        rsmodel.code = 1;
        rsmodel.message = "Error uploading files";
        rsmodel.data = { error: error.message };
    }
    res.json(rsmodel);
};
