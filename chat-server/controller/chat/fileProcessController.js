// fileProcessController.js
const responseModel = require("../../model/responseModel");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// file service 的 url
const fileServiceUrl = process.env.AVA_FILE_SERVICE_URL || "http://localhost:8090";
const pythonApiHost = process.env.PYTHON_API_HOST || "http://127.0.0.1:5001/ava/api";
const sessionKeyPrefix = process.env.SESSION_KEY_PREFIX || "ava:";

// 處理上傳的檔案
exports.processUploadedFile = async (req, res) => {
    const rsmodel = new responseModel();
    try {
        // 檢查是否有檔案
        if (!req.files || req.files.length === 0) {
            rsmodel.message = "No files uploaded";
            rsmodel.success = false;
            return res.status(400).json(rsmodel);
        }

        // 檢查必要參數
        const { userId, conversationId } = req.body;
        if (!userId || !conversationId) {
            rsmodel.message = "Missing required parameters: userId and conversationId";
            rsmodel.success = false;
            return res.status(400).json(rsmodel);
        }

        // 準備發送到file-service的表單數據
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("conversationId", conversationId);

        // 添加所有檔案到表單
        const pdfFilesToCleanup = []; // 儲存需要清理的 PDF 臨時檔案

        for (const file of req.files) {
            // 檢查是否為txt檔案
            const isTxt = file.mimetype === "text/plain" || file.originalname.toLowerCase().endsWith(".txt");

            // 檢查是否已經是PDF檔案
            const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");

            // 上傳原始檔案
            formData.append(file.filename, fs.createReadStream(file.path), {
                filename: file.filename,
                contentType: file.mimetype,
            });

            if (!isTxt && !isPdf) {
                try {
                    console.log(`Converting to PDF: ${file.originalname}`);

                    // 準備轉換請求的表單
                    const tempFormData = new FormData();
                    tempFormData.append("file", fs.createReadStream(file.path));

                    // 調用 API 進行文件轉換成 PDF
                    const pdfResponse = await axios.post(process.env.DR_FILE_MGR, tempFormData, {
                        headers: { "Content-Type": "multipart/form-data" },
                        responseType: "arraybuffer",
                    });

                    // 轉換完成後，將 PDF 檔案儲存在臨時目錄中
                    const pdfFilename = file.filename.replace(/\.[^.]+$/, ".pdf");
                    const pdfFilePath = path.join(__dirname, `../../tempResource/`, pdfFilename);

                    // 確保目錄存在
                    const dir = path.dirname(pdfFilePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    fs.writeFileSync(pdfFilePath, pdfResponse.data);
                    pdfFilesToCleanup.push(pdfFilePath); // 添加到清理列表

                    // 上傳轉換後的 PDF 檔案
                    formData.append(pdfFilename, fs.createReadStream(pdfFilePath), {
                        filename: pdfFilename,
                        contentType: "application/pdf",
                    });

                    console.log(`PDF file created: ${pdfFilename}`);
                } catch (conversionError) {
                    console.error(`Error converting to PDF: ${file.originalname}`, conversionError);
                    // 轉換失敗，但不中斷整個處理流程
                }
            }
        }

        // 向file-service發送上傳請求
        const response = await axios.post(`${fileServiceUrl}/chat/upload`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        // 清理臨時檔案
        for (const file of req.files) {
            fs.unlink(file.path, (err) => {
                if (err) console.error(`Error deleting temp file ${file.path}:`, err);
            });
        }

        // 清理轉換後的 PDF 臨時檔案
        for (const pdfPath of pdfFilesToCleanup) {
            fs.unlink(pdfPath, (err) => {
                if (err) console.error(`Error deleting temp PDF file ${pdfPath}:`, err);
            });
        }

        // 處理回應
        if (response.data.success) {
            rsmodel.success = true;
            rsmodel.message = "Files uploaded successfully";

            // 用於跟踪哪些原始檔案已經被轉換為 PDF
            const convertedOriginals = [];

            // 建立一個 Map 來追踪文件轉換關係，這樣只需遍歷一次文件列表
            const pdfToOriginalMap = new Map();

            // 先將所有 PDF 檔案加入 Map 中，存儲不含副檔名的檔名
            Object.keys(response.data.files).forEach((filename) => {
                if (filename.endsWith(".pdf") && !filename.startsWith(".pdf")) {
                    const baseName = filename.replace(/\.pdf$/, "");
                    pdfToOriginalMap.set(baseName, filename);
                }
            });

            // 再次遍歷找出被轉換的原始檔案
            Object.keys(response.data.files).forEach((filename) => {
                // 跳過txt檔案和已經是PDF的檔案
                if (!filename.endsWith(".txt") && !filename.endsWith(".pdf")) {
                    const baseName = filename.replace(/\.[^.]+$/, "");
                    // 如果找到對應的 PDF 檔案，則將原始檔案加入排除列表
                    if (pdfToOriginalMap.has(baseName)) {
                        convertedOriginals.push(filename);
                    }
                }
            });

            // 整理檔案資訊，回傳給前端，排除已被轉換的原始檔案
            rsmodel.data = Object.entries(response.data.files)
                .filter(([filename, info]) => !convertedOriginals.includes(filename))
                .map(([filename, info]) => ({
                    name: filename,
                    status: info.status,
                    message: info.msg,
                    path: info.path, // 檔案路徑，用於後續處理
                }));
        } else {
            rsmodel.success = false;
            rsmodel.message = "File upload failed";
            rsmodel.data = response.data;
        }
    } catch (error) {
        console.error("Error processing file upload:", error);
        rsmodel.success = false;
        rsmodel.message = "Error processing file upload";
        rsmodel.data = { error: error.message };
    }
    res.json(rsmodel);
};

// 獲取對話中的檔案列表
exports.getConversationFiles = async (req, res) => {
    const rsmodel = new responseModel();
    try {
        const { userId, conversationId } = req.params;

        if (!userId || !conversationId) {
            rsmodel.success = false;
            rsmodel.message = "Missing required parameters";
            return res.status(400).json(rsmodel);
        }

        // 向file-service請求檔案列表
        const response = await axios.get(`${fileServiceUrl}/chat/files/${userId}/${conversationId}`);

        rsmodel.success = true;
        rsmodel.message = "Files retrieved successfully";
        rsmodel.data = response.data.files;
    } catch (error) {
        console.error("Error retrieving files:", error);
        rsmodel.success = false;
        rsmodel.message = "Error retrieving files";
        rsmodel.data = { error: error.message };
    }
    res.json(rsmodel);
};

// 刪除對話中的檔案
exports.deleteConversationFiles = async (req, res) => {
    const rsmodel = new responseModel();
    try {
        const { userId, conversationId } = req.params;

        // Handle the case when req.body is empty or not JSON
        let filenames = [];
        if (req.body && Object.keys(req.body).length > 0) {
            try {
                // If body is a string, parse it; otherwise, use it directly
                const bodyData = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
                filenames = bodyData.filenames || [];
            } catch (parseError) {
                console.error("Error parsing request body:", parseError);
                // Continue with empty filenames array
            }
        }

        if (!userId || !conversationId) {
            rsmodel.success = false;
            rsmodel.message = "Missing required parameters";
            return res.status(400).json(rsmodel);
        }
        // Toward file-service request to delete files
        const response = await axios.delete(`${fileServiceUrl}/chat/files/${userId}/${conversationId}`, {
            data: { filenames },
        });

        rsmodel.success = true;
        rsmodel.message = "Files deleted successfully";
        rsmodel.data = response.data;
    } catch (error) {
        console.error("Error deleting files:", error);
        rsmodel.success = false;
        rsmodel.message = "Error deleting files";
        rsmodel.data = { error: error.message };
    }
    res.json(rsmodel);
};

// 提供檔案路徑信息給Python服務
exports.getFilePathsForAI = async (req, res) => {
    const rsmodel = new responseModel();
    try {
        const { userId, conversationId, fileIds } = req.body;

        if (!userId || !conversationId || !fileIds || !Array.isArray(fileIds)) {
            rsmodel.success = false;
            rsmodel.message = "Missing required parameters";
            return res.status(400).json(rsmodel);
        }

        // 獲取對話中的所有檔案
        const response = await axios.get(`${fileServiceUrl}/chat/files/${userId}/${conversationId}`);

        // 篩選出需要的檔案路徑
        const allFiles = response.data.files || [];
        const selectedFiles = allFiles.filter((file) => fileIds.includes(file.name));

        // 提供檔案路徑信息
        const filePaths = selectedFiles.map((file) => ({
            name: file.name,
            path: file.path,
            size: file.size,
        }));

        rsmodel.success = true;
        rsmodel.message = "File paths retrieved successfully";
        rsmodel.data = { filePaths };
    } catch (error) {
        console.error("Error retrieving file paths:", error);
        rsmodel.success = false;
        rsmodel.message = "Error retrieving file paths";
        rsmodel.data = { error: error.message };
    }
    res.json(rsmodel);
};

// 處理上傳的檔案 (翻譯文件 先分開 到時候再合併 DRY)
exports.processUploadTranslationFile = async (req, res) => {
    const rsmodel = new responseModel();
    try {
        // 檢查是否有檔案
        if (!req.files || req.files.length === 0) {
            rsmodel.message = "No files uploaded";
            rsmodel.success = false;
            return res.status(400).json(rsmodel);
        }

        // 檢查必要參數
        const { userId, conversationId, lang_out, history_message_id } = req.body;
        if (!userId || !conversationId) {
            rsmodel.message = "Missing required parameters: userId and conversationId";
            rsmodel.success = false;
            return res.status(400).json(rsmodel);
        }

        // 準備發送到file-service的表單數據
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("conversationId", conversationId);

        // 添加所有檔案到表單，同時保存原始檔名與新檔名的映射及文件資訊
        const fileInfoMap = {};
        const filePaths = [];
        const pdfFilesToCleanup = []; // 儲存需要清理的 PDF 檔案路徑

        // 處理每個上傳的檔案
        for (const file of req.files) {
            // 檢查是否是 DOCX 檔案
            const isDocx =
                file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                file.originalname.toLowerCase().endsWith(".docx");

            // 上傳原始檔案 (無論是什麼類型)
            formData.append(file.filename, fs.createReadStream(file.path), {
                filename: file.filename,
                contentType: file.mimetype,
            });

            // 保存原始檔案資訊
            fileInfoMap[file.filename] = {
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                isPDF: file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf"),
                isDocx: isDocx,
            };

            // 如果是 DOCX 檔案，需要轉換成 PDF
            if (isDocx) {
                try {
                    console.log(`Converting DOCX to PDF: ${file.originalname}`);

                    // 準備表單數據用於 DOCX 轉 PDF
                    const conversionFormData = new FormData();
                    conversionFormData.append("file", fs.createReadStream(file.path));

                    // 呼叫 DOCX 轉 PDF 服務
                    const conversionResponse = await axios.post(process.env.DR_FILE_MGR, conversionFormData, {
                        headers: { "Content-Type": "multipart/form-data" },
                        responseType: "arraybuffer",
                    });

                    // 儲存轉換後的 PDF 檔案
                    const pdfFilename = file.filename.replace(/\.[^.]+$/, ".pdf");
                    const pdfFilePath = path.join(__dirname, `../../uploads/`, pdfFilename);

                    // 確保目錄存在
                    const dir = path.dirname(pdfFilePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    fs.writeFileSync(pdfFilePath, conversionResponse.data);
                    pdfFilesToCleanup.push(pdfFilePath); // 添加到清理列表

                    // 上傳轉換後的 PDF 檔案
                    formData.append(pdfFilename, fs.createReadStream(pdfFilePath), {
                        filename: pdfFilename,
                        contentType: "application/pdf",
                    });

                    // 保存轉換後的 PDF 檔案資訊
                    fileInfoMap[pdfFilename] = {
                        originalName: file.originalname.replace(/\.[^.]+$/, ".pdf"),
                        mimetype: "application/pdf",
                        size: fs.statSync(pdfFilePath).size,
                        isPDF: true,
                        isConverted: true,
                        originalFile: file.filename,
                    };
                } catch (conversionError) {
                    console.error(`Error converting DOCX to PDF: ${file.originalname}`, conversionError);
                    // 轉換失敗，但不中斷整個處理流程
                }
            }
        }

        // 向file-service發送上傳請求
        const response = await axios.post(`${fileServiceUrl}/chat/upload`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        // 清理臨時檔案
        for (const file of req.files) {
            fs.unlink(file.path, (err) => {
                if (err) console.error(`Error deleting temp file ${file.path}:`, err);
            });
        }

        // 清理轉換後的 PDF 臨時檔案
        for (const pdfPath of pdfFilesToCleanup) {
            fs.unlink(pdfPath, (err) => {
                if (err) console.error(`Error deleting temp PDF file ${pdfPath}:`, err);
            });
        }

        // 處理回應
        if (response.data.success) {
            // 準備文件路徑列表 (只包含PDF檔案路徑)
            const pythonApiFilePaths = [];
            Object.entries(response.data.files).forEach(([filename, info]) => {
                if (info.status && info.path) {
                    const fileInfo = fileInfoMap[filename];

                    // 如果是PDF檔案或已轉換為PDF的檔案，添加到Python API的路徑列表
                    if (fileInfo && (fileInfo.isPDF || fileInfo.isConverted)) {
                        pythonApiFilePaths.push(info.path);
                    }
                }
            });

            // console.log("pythonApiFilePaths", pythonApiFilePaths);

            // 只有當有成功上傳的PDF文件時，才呼叫 Python API
            if (pythonApiFilePaths.length > 0) {
                try {
                    // 呼叫 Python API 進行文件翻譯 (只傳送PDF檔案路徑)
                    const pythonApiResponse = await axios.post(`${process.env.PYTHON_API_HOST}/document/translate`, {
                        userID: userId,
                        conversationID: conversationId,
                        file_paths: pythonApiFilePaths,
                        lang_out: lang_out,
                        history_message_id: history_message_id,
                    });
                    // 將 Python API 回應添加到我們的回應中
                    rsmodel.pythonApiResponse = pythonApiResponse.data;
                } catch (pythonApiError) {
                    console.error("Error calling Python API:", pythonApiError);
                    rsmodel.pythonApiError = {
                        message: "Failed to call Python translation API",
                        error: pythonApiError.message,
                    };
                    // 不中斷流程，仍然返回文件上傳成功
                }
            }

            rsmodel.success = true;
            rsmodel.message = "Files uploaded successfully";

            // 整理檔案資訊，回傳給前端，加入更多文件資訊
            rsmodel.data = Object.entries(response.data.files).map(([filename, info]) => {
                const fileInfo = fileInfoMap[filename] || {};

                return {
                    name: fileInfo.originalName || filename,
                    serverFileName: filename,
                    status: info.status,
                    message: info.msg,
                    path: info.path,
                    type: fileInfo.mimetype || "application/octet-stream",
                    size: fileInfo.size || 0,
                    isPDF: fileInfo.isPDF || false,
                    isConverted: fileInfo.isConverted || false,
                    originalFile: fileInfo.originalFile || null,
                };
            });
        } else {
            rsmodel.success = false;
            rsmodel.message = "File upload failed";
            rsmodel.data = response.data;
        }
    } catch (error) {
        console.error("Error processing file upload:", error);
        rsmodel.success = false;
        rsmodel.message = "Error processing file upload";
        rsmodel.data = { error: error.message };
    }
    res.json(rsmodel);
};
