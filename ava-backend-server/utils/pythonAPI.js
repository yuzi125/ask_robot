// pythonAPI.js

const axios = require("axios");
const FormData = require("form-data");
const { readFile, getFullFilePath } = require("../global/backend_upload");
const { datasource } = require("../model/dbConvertModel");
const fs = require("fs");
const path = require("path");

async function insertQA(data, datasets_id, crawler_id, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/insertQA`, {
        data,
        datasets_id,
        crawler_id,
        ava_token,
    });
}
async function bindQA(
    extra_qa_id,
    data,
    datasets_id,
    crawler_documents_qa_id,
    crawler_synchronize_id,
    crawler_documents_id,
    crawler_documents_extra_qa_id,
    crawler_id,
    crawler_documents_qa_hash,
    pythonApiHost,
    ava_token
) {
    if (extra_qa_id !== "") {
        return await axios.post(`${pythonApiHost}/bindQA/${extra_qa_id}`, {
            data: {
                question: data.question,
                answer: data.answer,
                is_show: data.is_show,
                datasets_id,
                crawler_documents_qa_id,
                crawler_synchronize_id,
                crawler_documents_id,
                crawler_documents_extra_qa_id,
                crawler_id,
                crawler_documents_qa_hash,
                ava_token,
            },
        });
    } else {
        return await axios.post(`${pythonApiHost}/bindQA`, {
            data,
            datasets_id,
            crawler_documents_qa_id,
            crawler_synchronize_id,
            crawler_documents_id,
            crawler_id,
            crawler_documents_qa_hash,
            ava_token,
            // crawler_documents_extra_qa_id,
        });
    }
}
async function updateQA(
    extra_qa_id,
    data,
    datasets_id,
    crawler_documents_qa_id,
    crawler_synchronize_id,
    crawler_documents_id,
    pythonApiHost,
    ava_token
) {
    const reqdata = data.map((m) => {
        return {
            question: m.question,
            answer: m.answer,
            is_show: m.is_show,
            source_name: m.source_name,
            source_url: m.source_url,
            datasets_id,
            crawler_documents_qa_id,
            crawler_synchronize_id,
            crawler_documents_id,
            ava_token,
        };
    });
    return await axios.put(`${pythonApiHost}/updateQA/${extra_qa_id}`, {
        data: reqdata,
    });
}
async function activateIndexing(folderName, filenames, pythonApiHost, separator, datasource_type, ava_token) {
    return await axios.post(`${pythonApiHost}/activateIndexing`, {
        folder_name: folderName,
        filenames: filenames,
        separator: separator,
        datasource_type: datasource_type,
        ava_token,
    });
}
async function deleteVectorDbData(folderName, key, value, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/deleteVectorDbData`, {
        folder_name: folderName,
        key: key,
        value: value,
        ava_token,
    });
}
async function activateDatabaseIndexing(crawler_synchronize_id, retrain, callbackUrl, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/activateDatabaseIndexing`, {
        crawler_synchronize_id: crawler_synchronize_id,
        retrain: retrain,
        callback_url: callbackUrl,
        ava_token,
    });
}

// 上傳的時候已經會經過 MIME type 檢查，這邊只需要檢查副檔名即可
const isImageFile = (filename) => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", "jfif", "txt"];
    return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
};

async function uploadDocuments(datasets_id, upload_folder_id, folder_name, files, pythonApiHost, ava_token) {
    // 這邊要送python 用formData裝起來 格式:
    /*
         {
              "folder_name": "folder",
              "file_infos": {
                  "key":{
                      "filename": "key",
                      "originalname": "file1.csv",
                      "datasource_url": "datasource1",
                      "datasource_name": "datasource1",
                      "upload_documents_id": "updload_document_id1",
                      "datasets_id": "datasets_id1",
                      "upload_folder_id": "upload_folder_id1",
                  }
              }
          }
      */
    // let pythonFiles = files.map((m) => ({
    //     upload_documents_id: m.upload_documents_id,
    //     filename: m.filename,
    //     originalname: m.originalname,
    // }));

    const formData = new FormData();
    formData.append("folder_name", folder_name);
    formData.append("ava_token", ava_token);

    let objPythonFiles = {};
    try {
        for (let obj of files) {
            let filename = obj.filename;
            let originalname = obj.originalname;
            if (!isImageFile(obj.originalname) && !obj.originalname.endsWith(".pdf")) {
                filename = obj.filename.replace(/\.[^.]+$/, ".pdf");
            }
            objPythonFiles[filename] = {
                filename: filename,
                originalname: originalname,
                datasource_url: "", // TODO:尚未跟前端UI串接
                datasource_name: "",
                upload_documents_id: obj.upload_documents_id,
                datasets_id: datasets_id,
                upload_folder_id: upload_folder_id,
                datasource_type: "A",
            };
        }
    } catch (error) {
        console.error("Error in objPythonFiles: ", error);
        throw error;
    }
    formData.append("file_infos", JSON.stringify(objPythonFiles));
    try {
        for (let obj of files) {
            // 透過 API 獲取檔案
            const resourceType = "doc";
            const apiUrl = `${process.env.AVA_FILE_SERVICE_URL}/download/${resourceType}`;
            const response = await axios.post(
                apiUrl,
                {
                    folder_path: folder_name,
                    filename: obj.filename,
                },
                {
                    responseType: "stream",
                }
            );

            let file = response.data;

            let fileToAppend = file;

            // 不是pdf檔，要先轉檔。
            if (!isImageFile(obj.originalname) && !obj.originalname.endsWith(".pdf")) {
                let tempFormData = new FormData();
                tempFormData.append("file", file);
                let rs = await axios.post(process.env.DR_FILE_MGR, tempFormData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    responseType: "stream",
                });

                fileToAppend = rs.data;
            }

            formData.append("files", fileToAppend);
        }
    } catch (error) {
        console.error("Error in prepare uploadDocuments: ", error);
        throw error;
    }

    try {
        const rs = await axios.post(`${pythonApiHost}/uploads`, formData);
        return rs;
    } catch (error) {
        console.error("Error in uploadDocuments: ", error);
        throw error;
    }
}

async function getParentNodeIds(pythonApiHost, document_id, datasets_id) {
    return await axios.get(`${pythonApiHost}/chunks`, {
        params: {
            datasets_id,
            upload_document_id: document_id,
        },
    });
}

async function updateDocumentStatus(filesToUpload, pythonApiHost, ava_token = "") {
    try {
        const formData = new FormData();
        formData.append("folder_name", filesToUpload.folder_name);
        formData.append("ava_token", ava_token);
        formData.append("operation_files", JSON.stringify(filesToUpload.operation_files));
        return await axios.post(
            `${pythonApiHost}/deactivateIndexing`,
            JSON.stringify({
                folder_name: filesToUpload.folder_name,
                operation_files: filesToUpload.operation_files,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in updateDocumentStatus: ", error.message);
        throw error;
    }
}

async function reloadDatasets(pythonApiHost, body) {
    return await axios.post(`${pythonApiHost}/reloadDatasets`, body);
}

async function readLogData(filename, time, count, sort, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/readLogData`, {
        filename,
        time,
        count,
        sort,
        ava_token,
    });
}

async function bindFormDoc(form_id, datasets_id, doc_id, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/form/bindFormDoc`, {
        form_id,
        datasets_id,
        doc_id,
        ava_token,
    });
}

async function bindFormDataset(
    datasets_id,
    form_id,
    upload_documents_id,
    form_name,
    form_description,
    originalname,
    filename,
    upload_folder_id,
    datasource_url,
    datasource_name,
    separator,
    pythonApiHost,
    ava_token
) {
    return await axios.post(`${pythonApiHost}/form/bindFormDataset`, {
        datasets_id,
        form_id,
        upload_documents_id,
        form_name,
        form_description,
        originalname,
        filename,
        upload_folder_id,
        datasource_url,
        datasource_name,
        separator,
        ava_token,
    });
}
async function unbindFormDoc(form_id, datasets_id, doc_id, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/form/unbindFormDoc`, {
        form_id,
        datasets_id,
        doc_id,
        ava_token,
    });
}

async function deleteCachedKnowledge(expert_id, cache_knowledge_ids, pythonApiHost, ava_token) {
    return await axios.delete(`${pythonApiHost}/cache`, {
        data: {
            expert_id,
            cache_knowledge_ids,
            ava_token,
        },
    });
}

// 整批啟用爬蟲
async function enabledAllCrawler(crawler_sync_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/syncCrawler`, {
        crawler_sync_ids,
        ava_token,
    });
}

// 整批禁用爬蟲
async function disabledAllCrawler(crawler_sync_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/disableCrawler`, {
        crawler_sync_ids,
        ava_token,
    });
}

// 整批禁用爬蟲附件
async function disabledAllCrawlerAttachment(crawler_sync_ids, datasetsId, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/disableCrawlerAttachment`, {
        crawler_attachment_synchronize_ids: crawler_sync_ids,
        dataset_id: datasetsId,
        ava_token,
    });
}

// 整批取消爬蟲
async function cancelAllCrawler(crawler_sync_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/cancelCrawler`, {
        crawler_sync_ids,
        ava_token,
    });
}

// 整批取消爬蟲附件
async function cancelAllCrawlerAttachment(crawler_sync_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/cancelCrawlerAttachment`, {
        crawler_attachment_sync_ids: crawler_sync_ids,
        ava_token,
    });
}

// 批次啟用爬蟲
async function enabledBatchCrawlerContent(dataset_id, crawler_document_content_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/syncCrawlerContent`, {
        dataset_id,
        crawler_document_content_ids,
        ava_token,
    });
}

// 批次禁用爬蟲
async function disabledBatchCrawlerContent(dataset_id, crawler_document_content_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/disableCrawlerContent`, {
        dataset_id,
        crawler_document_content_ids,
        ava_token,
    });
}

// 批次禁用爬蟲附件
async function disabledBatchCrawlerAttachmentContent(
    dataset_id,
    crawler_document_content_ids,
    pythonApiHost,
    ava_token
) {
    return await axios.post(`${pythonApiHost}/disableCrawlerAttachmentContent`, {
        dataset_id,
        crawler_attachment_ids: crawler_document_content_ids,
        ava_token,
    });
}

// 批次刪除 crawler_document
async function removeCrawlerDocument(dataset_id, crawler_document_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/removeCrawlerDocument`, {
        dataset_id,
        crawler_document_ids,
        ava_token,
    });
}
// 批次刪除 crawler_document_content
async function removeCrawlerDocumentContent(dataset_id, crawler_document_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/removeCrawlerContent`, {
        dataset_id,
        crawler_document_ids,
        ava_token,
    });
}

async function removeCrawlerAttachment(dataset_id, crawler_attachment_ids, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/removeCrawlerAttachment`, {
        dataset_id,
        crawler_attachment_ids,
        ava_token,
    });
}

async function generateTheme(prompt, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/theme_color_generation`, {
        prompt,
        ava_token,
    });
}

async function updateCrawlerDocumentExtra(datasets_id, crawler_documents_id, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/updateCrawlerExtraContent`, {
        dataset_id: datasets_id,
        crawler_document_id: crawler_documents_id,
        ava_token,
    });
}

async function vectorQuery(vector_input, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/vector/query`, {
        query: vector_input,
        ava_token,
    });
}

async function vectorSearch(query, expert_id, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/vector/search`, {
        query,
        expert_id,
        ava_token,
    });
}

async function word2vector(word, embedding_model, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/vector/word2vector`, {
        word,
        embedding_model,
        ava_token,
    });
}

async function stressTest(expert_id, concurrent, duration, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/vector/speedtest`, {
        expert_id,
        c: concurrent,
        d: duration,
        ava_token,
    });
}

async function classifyFeedback(feedbackData, pythonApiHost, ava_token) {
    return await axios.post(`${pythonApiHost}/classify_feedbacks`, {
        feedbacks: feedbackData,
        ava_token,
    });
}

module.exports = {
    activateIndexing,
    activateDatabaseIndexing,
    uploadDocuments,
    getParentNodeIds,
    reloadDatasets,
    insertQA,
    bindQA,
    updateQA,
    deleteVectorDbData,
    updateDocumentStatus,
    readLogData,
    bindFormDoc,
    bindFormDataset,
    unbindFormDoc,
    deleteCachedKnowledge,
    removeCrawlerDocument,
    removeCrawlerDocumentContent,
    removeCrawlerAttachment,
    enabledAllCrawler,
    disabledAllCrawler,
    disabledAllCrawlerAttachment,
    cancelAllCrawler,
    cancelAllCrawlerAttachment,
    enabledBatchCrawlerContent,
    disabledBatchCrawlerContent,
    disabledBatchCrawlerAttachmentContent,
    generateTheme,
    updateCrawlerDocumentExtra,
    stressTest,
    vectorQuery,
    vectorSearch,
    word2vector,
    classifyFeedback,
};
