const pythonAPI = require("../utils/pythonAPI");

async function deactivateDocuments(fileToDeactivate, userNo = "系統", sql) {
    if (fileToDeactivate.length === 0) {
        return { message: "沒有需要停用的文檔", code: 0 };
    }

    try {
        const documentIds = fileToDeactivate.operation_files.map((file) => file.upload_documents_id);

        const updateQuery = `
            UPDATE upload_documents
            SET training_state = $2, updated_by = $1, update_time = NOW()
            WHERE id = ANY($3)
        `;

        await sql.query(updateQuery, [userNo, 8, documentIds]);

        const pythonUploadResult = await pythonAPI.updateDocumentStatus(fileToDeactivate, process.env.PYTHON_API_HOST);

        if (pythonUploadResult.data.code !== 200) {
            throw new Error("Python API 檔案刪除失敗");
        }

        return { message: "文檔已成功停用", code: 0 };
    } catch (error) {
        console.error("停用文檔時發生錯誤:", error);
        return { message: "停用文檔失敗", code: 1, error: error.message };
    }
}

module.exports = {
    deactivateDocuments,
};
