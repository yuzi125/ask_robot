const sql = require("../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const { createFolder } = require("../global/backend_upload");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");
const createDataset = async () => {
    let rs;
    try {
        const name = "測試用知識庫-功能狀態測試(healthCheck)";
        const uid = "healthCheck";
        const datasource_type = "A";

        // 先查詢是否已經有相同 name 的 datasets
        rs = await sql.query("select * from datasets where name = $1", [name]);

        let datasets_id;
        let upload_folder_id;
        let datasource_id;
        let folder_name;

        // 已經建立過知識庫了
        if (rs.rows[0]?.id) {
            // 有datasets_id的話沿用
            datasets_id = rs.rows[0].id;
            folder_name = rs.rows[0].folder_name;

            rs = await sql.query("select id from datasource where datasets_id = $1 and type = $2", [
                datasets_id,
                datasource_type,
            ]);

            if (rs.rows[0]?.id) {
                // 有datasource_id的話沿用
                datasource_id = rs.rows[0].id;
                rs = await sql.query("select id from upload_folder where datasource_id = $1", [datasource_id]);
                console.log("rs.rows[0]: ", rs.rows[0]);
                upload_folder_id = rs.rows[0]?.id;
            }
        } else {
            datasets_id = uuidv4();
            folder_name = uuidv4();
            datasource_id = uuidv4();
            upload_folder_id = uuidv4();

            rs = await sql.query("select value from settings where key = 'default_datasets_model_config'");
            const datasets_config = JSON.parse(rs.rows[0].value);
            const configJsonString = JSON.stringify(datasets_config);

            rs = await sql.query(
                'insert into datasets(id,"name",config_jsonb,folder_name,created_by) values($1,$2,$3,$4,$5)',
                [datasets_id, name, configJsonString, folder_name, uid]
            );

            rs = await sql.query("insert into datasource (id,datasets_id,type,is_enable) values($1,$2,$3,$4)", [
                datasource_id,
                datasets_id,
                datasource_type,
                1,
            ]);

            rs = await sql.query("insert into upload_folder (id,datasource_id) values($1,$2)", [
                upload_folder_id,
                datasource_id,
            ]);
        }

        if (rs.rowCount === 0) return;
        createFolder(`${folder_name}`, "A");
        return { id: datasets_id, folder_name: folder_name, upload_folder_id: upload_folder_id };
    } catch (e) {
        console.error(e);
    }
};

const uploadDocuments = async (folder_name, datasets_id, upload_folder_id, FILE_NAME, FILE_PATH) => {
    let rs;
    try {
        const filename = uuidv4();
        const formData = new FormData();
        formData.append("folder_path", folder_name);
        formData.append("resource_type", "doc");
        formData.append("files", fs.createReadStream(FILE_PATH), `${filename}.txt`);

        const apiUrl = `${process.env.AVA_FILE_SERVICE_URL}/upload/doc`;
        await axios.post(apiUrl, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        if (fs.existsSync(FILE_PATH)) {
            fs.unlinkSync(FILE_PATH);
            console.log(`${FILE_NAME} 文件已刪除`);
        }

        const documentType = "document";
        const created_by = "healthCheck";

        rs = await sql.query(
            "insert into upload_documents(id,filename,originalname,datasets_id,upload_folder_id,document_type,created_by) values($1,$2,$3,$4,$5,$6,$7)",
            [filename, `${filename}.txt`, FILE_NAME, datasets_id, upload_folder_id, documentType, created_by]
        );

        return rs;
    } catch (error) {
        console.error(error.message);
    }
};

const getDownloadFileInfo = async () => {
    const name = "測試用知識庫-功能狀態測試(healthCheck)";

    let rs;
    // 先查詢是否已經有相同 name 的 datasets
    rs = await sql.query("select * from datasets where name = $1", [name]);

    const datasets_id = rs.rows[0]?.id;
    const folder_name = rs.rows[0]?.folder_name;

    rs = await sql.query("select * from upload_documents where datasets_id = $1 order by create_time desc limit 1", [
        datasets_id,
    ]);
    const filename = rs.rows[0]?.filename;
    const originalname = rs.rows[0]?.originalname;

    return { folder_name, filename, originalname };
};

const getDocumentStatus = async () => {
    const name = "測試用知識庫-功能狀態測試(healthCheck)";

    let rs;
    // 先查詢是否已經有相同 name 的 datasets
    rs = await sql.query("select * from datasets where name = $1", [name]);

    const datasets_id = rs.rows[0]?.id;

    rs = await sql.query("select * from upload_documents where datasets_id = $1 order by create_time desc limit 1", [
        datasets_id,
    ]);

    const id = rs.rows[0]?.id;
    const state = rs.rows[0]?.training_state;

    return { datasets_id, id, state };
};

module.exports = {
    createDataset,
    uploadDocuments,
    getDownloadFileInfo,
    getDocumentStatus,
};
