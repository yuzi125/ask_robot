/**
 * 通用 SQL 更新函數
 * @param {Array} files - 包含需要更新的文件資訊的陣列
 * @param {Boolean} updateTrainingState - 是否更新 training_state
 * @param {Number} trainingStateValue - training_state 的值 (如果需要更新)
 * @returns {Object} - 包含生成的 SQL 字串和 SQL 參數的物件
 */
function generateUploadDocumentUpdateSQL(files, updateTrainingState = false, trainingStateValue = 1) {
    let sqlstr = "update upload_documents set ";
    let sqlparam = [];
    let fieldCount = files.length;

    // 如果需要更新 training_state，則添加對應的 SQL 語句
    if (updateTrainingState) {
        sqlstr += "training_state = $1, "; // 固定 training_state 為第一個佔位符
    }

    sqlstr += "updated_by = case ";

    // 構建 case when 語句
    files.forEach((file, i) => {
        let paramIndexId = updateTrainingState ? i + 2 : i + 1; // 如果有 training_state，則需要從 $2 開始
        let paramIndexUpdatedBy = fieldCount + (updateTrainingState ? i + 2 : i + 1); // updated_by 的佔位符
        sqlstr += `when id = $${paramIndexId} then $${paramIndexUpdatedBy} `;
        sqlparam.push(file["upload_documents_id"]); // 推入 id
    });

    // 結束 case when 語句並加入 where 子句
    sqlstr += "end where id in (";

    // 構建 where 子句中的 id 列表
    for (let i = 0; i < files.length; i++) {
        if (i !== 0) sqlstr += ", ";
        let paramIndexId = updateTrainingState ? i + 2 : i + 1;
        sqlstr += `$${paramIndexId}`; // id 的佔位符
    }
    sqlstr += ")";

    // 如果需要更新 training_state，將其值推入參數的第一位
    if (updateTrainingState) {
        sqlparam.unshift(trainingStateValue); // 推入 training_state 的值到第一位
    }

    // 最後推入所有 updated_by 值
    files.forEach((file) => {
        sqlparam.push(file["updated_by"]); // 推入 updated_by 值
    });

    return { sqlstr, sqlparam };
}

module.exports = { generateUploadDocumentUpdateSQL };
