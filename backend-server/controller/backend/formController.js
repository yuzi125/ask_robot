const responseModel = require("../../model/responseModel");
const sql = require("../../db/pgsql");
const { v4: uuidv4 } = require("uuid");
const { createFolder } = require("../../global/backend_upload");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const axios = require("axios");
const pythonAPI = require("../../utils/pythonAPI");
const { savePDF } = require("../../utils/pdfPromise");
const { logActivity, AUDIT_LOG_ACTION_TYPE, AUDIT_LOG_ENTITY_TYPE } = require("../../utils/auditLog");
const logRouteDetails = require("../routeNameLog");
const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX;

const AUDIT_LOG_TARGET_CATEGORY = "form";

exports.getPresetFormConfig = async function (req, res) {
    logRouteDetails("formController.getPresetFormConfig", req);
    let rsmodel = new responseModel();
    try {
        rsmodel.data = {};
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};
exports.create = async function (req, res) {
    logRouteDetails("formController.create", req);
    let rsmodel = new responseModel();
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let { form_name, form_description, form_config } = JSON.parse(req.body);
        console.info("formController.create:", JSON.parse(req.body));
        if (!form_name.trim() || !form_description.trim() || !form_config.trim()) {
            rsmodel.message = "參數不完整或格式錯誤";
            res.json(rsmodel);
            return;
        }
        form_config = JSON.parse(form_config);

        const uuid = uuidv4();
        await sql.query(
            "insert into form_configuration(id,form_name,form_description,form_config,created_by) values($1,$2,$3,$4,$5)",
            [uuid, form_name, form_description, form_config, uid]
        );

        rsmodel.data = { form_id: uuid };
        rsmodel.code = 0;

        await logActivity({
            userId: uid,
            username: username || uid,
            targetId: uuid,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            actionType: AUDIT_LOG_ACTION_TYPE.CREATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.CREATE_FORM,
            parameters: {
                form_id: uuid,
                form_name,
                form_description,
                form_config,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.getForm = async function (req, res) {
    logRouteDetails("formController.getForm", req);
    let rsmodel = new responseModel();
    try {
        let { form_id } = req.query;
        console.info("formController.getForm:", req.query);
        let sqlstr = `
            select 
                a.id,
                a.form_name,
                a.form_description,
                a.form_config,
                a.create_time,
                a.created_by,
                a.updated_by,
                created_user.name AS created_by_name,
                updated_user.name AS updated_by_name,
                (select count(*) from form_binding_association b where b.form_id = a.id) as files,
                (
                    select json_agg(json_build_object('name', d.name, 'icon', d.icon))
                    from datasets d
                    where d.id in (select b.dataset_id from form_binding_association b where b.form_id = a.id)
                ) as datasets
            from 
                form_configuration a
            LEFT JOIN users AS created_user 
                ON a.created_by = created_user.id
            LEFT JOIN users AS updated_user 
                ON a.updated_by = updated_user.id
            where 
                a.is_enable = 1
        `;
        sqlparam = [];
        if (form_id) {
            sqlstr += " and a.id = $1";
            sqlparam.push(form_id);
        }
        let rs = await sql.query(sqlstr, sqlparam);
        rs = rs.rows;
        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e);
    }
    res.json(rsmodel);
};

exports.updateForm = async function (req, res) {
    logRouteDetails("formController.updateForm", req);
    let rsmodel = new responseModel();
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        let { form_id, form_name, form_description, form_config } = JSON.parse(req.body);
        console.info("formController.updateForm:", JSON.parse(req.body));
        if (!form_id.trim() || !form_name.trim() || !form_description.trim() || !form_config.trim()) {
            rsmodel.message = "參數不完整或格式錯誤";
            res.json(rsmodel);
            return;
        }
        form_config = JSON.parse(form_config);

        let rs = await sql.query(
            "update form_configuration set form_name = $1,form_description = $2,form_config = $3,updated_by = $4 where id = $5",
            [form_name, form_description, form_config, uid, form_id]
        );
        // let rs1 = await axios.post(`${process.env.PYTHON_API_HOST}/reloadDatasets`, {});
        // await pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST);
        rsmodel.code = 0;

        await logActivity({
            userId: uid,
            username: username || uid,
            targetId: form_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            actionType: AUDIT_LOG_ACTION_TYPE.UPDATE,
            entityType: AUDIT_LOG_ENTITY_TYPE.UPDATE_FORM,
            parameters: {
                form_id,
                form_name,
                form_description,
                form_config,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error(e.message);
    }
    res.json(rsmodel);
};

exports.deleteForm = async function (req, res) {
    logRouteDetails("formController.deleteForm", req);
    let rsmodel = new responseModel();
    try {
        const { uid = "", name: username = "" } = req.session.userInfo || {};
        console.info("formController.deleteForm:", JSON.parse(req.body));
        let { form_id } = JSON.parse(req.body);
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        if (!form_id.trim()) {
            rsmodel.message = "缺少form_id";
            res.json(rsmodel);
            return;
        }
        // 變更表單狀態
        let rs = await sql.query('update form_configuration set "is_enable" = 0,updated_by = $1 where id = $2', [
            uid,
            form_id,
        ]);
        // 刪除綁定相關資料
        let bindingFiles = await sql.query("SELECT * FROM form_binding_association WHERE form_id = $1", [form_id]);
        if (bindingFiles && bindingFiles.rows.length > 0) {
            for (let i = 0; i < bindingFiles.rows.length; i++) {
                let row = bindingFiles.rows[i];
                let { form_id, document_id } = row;
                let datasets_id = row.dataset_id;
                await pythonAPI.unbindFormDoc(
                    form_id,
                    datasets_id,
                    document_id,
                    process.env.PYTHON_API_HOST,
                    ava_token
                );
            }
        }
        // let rs1 = await axios.post(`${process.env.PYTHON_API_HOST}/reloadDatasets`, {});
        // await pythonAPI.reloadDatasets(process.env.PYTHON_API_HOST);
        rsmodel.code = 0;

        await logActivity({
            userId: uid,
            username: username || uid,
            targetId: form_id,
            targetCategory: AUDIT_LOG_TARGET_CATEGORY,
            actionType: AUDIT_LOG_ACTION_TYPE.DELETE,
            entityType: AUDIT_LOG_ENTITY_TYPE.DELETE_FORM,
            parameters: {
                form_id,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
    } catch (e) {
        console.error("It has some trouble in deleting form.", e.message);
    }
    res.json(rsmodel);
};

exports.getBindingList = async function (req, res) {
    logRouteDetails("formController.getBindingList", req);
    let rsmodel = new responseModel();
    try {
        let { dataset_id } = req.query;
        console.info("formController.getBindingList:", req.query);
        let sqlstr =
            "select id,form_name,form_description,form_config,create_time from form_configuration where is_enable = 1";
        sqlparam = [];
        if (dataset_id) {
            sqlstr += " and id = $1";
            sqlparam.push(form_id);
        }
        let rs = await sql.query(sqlstr, sqlparam);
        rs = rs.rows;
        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e.message);
    }
    res.json(rsmodel);
};

// 表單綁定資料集
exports.bindFormDataset = async function (req, res) {
    logRouteDetails("formController.bindFormDataset", req);
    let rsmodel = new responseModel();
    /**
     * 流程:
     * 1. 拿到datasets_id後 因為是多值 所以一筆一筆處理
     * 2. 檢查datasource是否存在，不存在則建立
     * 3. 檢查upload_folder是否存在，不存在則建立
     * 4. 透過 datasers_id 撈出 folder_name
     * 5. 建立form產出的document儲存到node與DB
     * 6. 透過pythonAPI綁定 datasets跟form
     * 7. 更新upload_documents的training_state
     */
    try {
        let { form_id, datasets_id, form_name, form_description, datasource_url, datasource_name, separator } =
            JSON.parse(req.body);
        const { uid = "" } = req.session.userInfo || {};
        console.info("formController.bindFormDataset:", JSON.parse(req.body));
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        const binding_type = 1;
        //若沒有document_id要建立一個空pdf綁定
        let rs;
        console.log("dataset_id: ", datasets_id);
        // 1.拿到datasets_id後 因為是多值 所以一筆一筆處理
        for (let i = 0; i < datasets_id.length; i++) {
            // 2. 檢查datasource是否存在，不存在則建立
            rs = await sql.query(
                "select a.id datasource_id,b.id upload_folder_id from datasource a left join upload_folder b on a.id = b.datasource_id where a.datasets_id = $1 and a.type = 'A'",
                [datasets_id[i]]
            );
            rs = rs.rows[0];
            //檢查 upload_folder_id 跟 datasource_id 是否存在，沒有則建立
            let upload_folder_id, datasource_id;
            if (!rs || !rs.datasource_id) {
                datasource_id = uuidv4();
                await sql.query("insert into datasource(id,datasets_id,type,is_enable) values($1,$2,$3,$4)", [
                    datasource_id,
                    datasets_id[i],
                    "A",
                    1,
                ]);
            } else {
                datasource_id = rs.datasource_id;
            }

            // 3. 檢查upload_folder是否存在，不存在則建立
            if (!rs || !rs.upload_folder_id) {
                upload_folder_id = uuidv4();
                await sql.query("insert into upload_folder(id,datasource_id) values($1,$2)", [
                    upload_folder_id,
                    datasource_id,
                ]);
            } else {
                upload_folder_id = rs.upload_folder_id;
            }

            // 4. 透過 datasets_id 撈出 folder_name
            rs = await sql.query("select folder_name from datasets where id = $1", [datasets_id[i]]);
            const folder_name = rs.rows[0]?.folder_name;
            createFolder(folder_name, "A");

            // 5. 建立form產出的document儲存到node與DB
            const upload_documents_id = uuidv4();
            const filename = `${upload_documents_id}.pdf`;
            const originalname = `${form_name}.pdf`;
            await sql.query(
                "insert into upload_documents(id,filename,originalname,upload_folder_id,datasets_id,created_by) values($1,$2,$3,$4,$5,$6)",
                [upload_documents_id, filename, originalname, upload_folder_id, datasets_id[i], uid]
            );
            //建立檔案
            const doc = new PDFDocument();
            // 加載字體
            doc.font("./resource/NotoSansCJKtc-Regular.otf");
            doc.text(form_description, 100, 100);
            await savePDF(doc, `uploads_backend/${folder_name}/upload/${filename}`);

            // 6. 透過pythonAPI綁定 datasets跟form
            rs = await pythonAPI.bindFormDataset(
                datasets_id[i],
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
                process.env.PYTHON_API_HOST,
                ava_token
            );
            if (rs.data.code === 201) {
                // 7. 更新upload_documents的training_state
                let sqlstr = "update upload_documents set training_state = 2 where id = $1";
                sqlparam = [upload_documents_id];
                await sql.query(sqlstr, sqlparam);
            } else {
                rsmodel.message = rs.data.message;
                return res.json(rsmodel);
            }
        }
        rsmodel.code = 0;
    } catch (e) {
        console.error(e.message);
        if (e.code === "23505") {
            rsmodel.message = "重複綁定";
        } else {
            rsmodel.message = e.message;
        }
    }
    res.json(rsmodel);
};

exports.bindMultipleFormDoc = async function (req, res) {
    logRouteDetails("formController.bindMultipleFormDoc", req);
    let rsmodel = new responseModel();
    let rs;
    try {
        let { files, formInfo } = JSON.parse(req.body);
        const { uid = "" } = req.session.userInfo || {};
        console.info("formController.bindMultipleFormDoc:", JSON.parse(req.body));
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        for (let i = 0; i < files.length; i++) {
            rs = await pythonAPI.bindFormDataset(
                files[i]["datasets_id"],
                formInfo["form_id"],
                files[i]["id"],
                formInfo["form_name"],
                formInfo["form_description"],
                files[i]["originalname"],
                files[i]["filename"],
                files[i]["upload_folder_id"],
                files[i]["datasource_url"],
                files[i]["datasource_name"],
                files[i]["separator"],
                process.env.PYTHON_API_HOST,
                ava_token
            );
            if (rs.data.code === 201) {
                // 7. 更新upload_documents的training_state
                let sqlstr = "update upload_documents set training_state = 2,updated_by = $1 where id = $2";
                sqlparam = [uid, files[i]["id"]];
                await sql.query(sqlstr, sqlparam);
            } else {
                rsmodel.message = rs.data.message;
                return res.json(rsmodel);
            }
        }
        rsmodel.code = 0;
        res.json(rsmodel);
    } catch (error) {
        rsmodel.code = 0;
        if (error.code === "23505") {
            rsmodel.message = "重複綁定";
        } else {
            rsmodel.message = error.message;
        }
    }
};

exports.bindFormDoc = async function (req, res) {
    logRouteDetails("formController.bindFormDoc", req);
    let rsmodel = new responseModel();
    try {
        let { form_id, datasets_id, document_id } = JSON.parse(req.body);
        console.info("formController.bindFormDoc:", JSON.parse(req.body));
        let success = true;
        let messages = [];
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        for (let i = 0; i < form_id.length; i++) {
            let rs = await pythonAPI.bindFormDoc(
                form_id[i],
                datasets_id,
                document_id,
                process.env.PYTHON_API_HOST,
                ava_token
            );
            if (rs.data.code === 200) {
                console.log("rs.data.message: ", rs.data.message);
                messages.push(`表單 ${form_id[i]} 綁定成功`);
            } else {
                console.log("rs.data.message: ", rs.data.message);
                success = false;
                messages.push(`表單 ${form_id[i]} 綁定失敗: ${rs.data.message}`);
            }
        }

        rsmodel.message = messages.join("\n");
        rsmodel.code = success ? 0 : 1;
    } catch (e) {
        console.error(e.message);
        rsmodel.message = e.message;
        rsmodel.code = 1;
    }

    res.json(rsmodel);
};

exports.getBindingAssociationForm = async function (req, res) {
    logRouteDetails("formController.getBindingAssociationForm", req);
    let rsmodel = new responseModel();
    try {
        let { document_id } = JSON.parse(req.body);
        console.info("formController.getBindingAssociationForm:", JSON.parse(req.body));
        let sqlstr = `SELECT form_binding_association.id,form_binding_association.form_id,dataset_id,document_id,binding_type,form_name 
            FROM form_binding_association 
            LEFT JOIN form_configuration on form_binding_association.form_id = form_configuration.id
            WHERE form_binding_association.document_id = $1`;
        sqlparam = [document_id];
        let rs = await sql.query(sqlstr, sqlparam);
        rs = rs.rows;
        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e.message);
    }
    res.json(rsmodel);
};

exports.getBindingAssociationFile = async function (req, res) {
    logRouteDetails("formController.getBindingAssociationFile", req);
    let rsmodel = new responseModel();
    try {
        let { form_id } = JSON.parse(req.body);
        console.info("formController.getBindingAssociationFile:", JSON.parse(req.body));
        let sqlstr = `SELECT datasets.name as datasets_name,form_binding_association.id,form_binding_association.form_id,dataset_id,document_id,binding_type,upload_documents.originalname as document_name 
            FROM form_binding_association 
            LEFT JOIN form_configuration on form_binding_association.form_id = form_configuration.id
            LEFT JOIN datasets on form_binding_association.dataset_id = datasets.id
            LEFT JOIN upload_documents on form_binding_association.document_id = upload_documents.id
            WHERE form_binding_association.form_id = $1`;
        sqlparam = [form_id];
        let rs = await sql.query(sqlstr, sqlparam);
        rs = rs.rows;
        rsmodel.data = rs;
        rsmodel.code = 0;
    } catch (e) {
        console.error(e.message);
    }
    res.json(rsmodel);
};

exports.unbindFormDoc = async function (req, res) {
    logRouteDetails("formController.unbindFormDoc", req);
    let rsmodel = new responseModel();
    try {
        let { form_id, datasets_id, document_id } = JSON.parse(req.body);
        console.info("formController.unbindFormDoc:", JSON.parse(req.body));
        let ava_token = `${SESSION_KEY_PREFIX}${req.sessionID}`;
        await pythonAPI.unbindFormDoc(form_id, datasets_id, document_id, process.env.PYTHON_API_HOST, ava_token);
        rsmodel.code = 0;
    } catch (e) {
        console.error(e.message);
    }
    res.json(rsmodel);
};

exports.getDocumentsByDatasetId = async function (req, res) {
    logRouteDetails("formController.getDocumentsByDatasetId", req);
    let rsmodel = new responseModel();
    try {
        let { datasets_id } = req.query;
        console.info("formController.getDocumentsByDatasetId:", req.query);
        if (!Array.isArray(datasets_id)) {
            datasets_id = [datasets_id];
        }
        let sqlstr = `
            SELECT ud.*, d.name as dataset_name
            FROM upload_documents ud
            JOIN datasets d ON ud.datasets_id = d.id
            LEFT JOIN form_binding_association fba ON ud.id = fba.document_id
            WHERE ud.datasets_id = ANY($1) and ud.is_enable = 1
            AND fba.document_id IS NULL
        `;
        let rs = await sql.query(sqlstr, [datasets_id]);
        console.log("rs", rs.rows);
        let organizedData = rs.rows.reduce((acc, curr) => {
            const { dataset_name, ...docData } = curr;
            if (!acc[dataset_name]) {
                acc[dataset_name] = [];
            }
            acc[dataset_name].push(docData);
            return acc;
        }, {});

        // rs = rs.rows;
        console.log("org", organizedData);
        rsmodel.data = organizedData;
        rsmodel.code = 0;
    } catch (e) {
        console.log(e.message);
        console.error(e.message);
        rsmodel.code = 1;
        rsmodel.message = "An error occurred while fetching and organizing documents";
    }
    res.json(rsmodel);
};
