const sql = require("../pgsql");

const js_title = ["將每個datasets建立upload專屬的datasource與upload_folder", "轉移資料表 document => upload_document"];

const js_program = async function () {
    let rs;
    rs = await sql.query("select id from upload_documents");
    console.log(rs.rowCount);

    rs = await sql.query("select id from datasets");
    rs = rs.rows.map((m) => m.id);
    let arr = [];
    for (let datasets_id of rs) {
        let obj = {};
        obj.datasets_id = datasets_id;
        let rs1 = await sql.query(
            "insert into datasource (id,datasets_id,type,is_enable) values(gen_random_uuid(),$1,$2,$3) returning id",
            [datasets_id, "A", 1]
        );
        let datasource_id = rs1.rows[0]?.id;
        if (datasource_id) {
            rs1 = await sql.query(
                "insert into upload_folder (id,datasource_id) values(gen_random_uuid(),$1) returning id",
                [datasource_id]
            );
            let upload_folder_id = rs1.rows[0]?.id;
            obj.upload_folder_id = upload_folder_id;
            arr.push(obj);
        }
    }
    /* datasets_id=指定 type=0 */
    rs = await sql.query(
        "select id,filename,originalname,create_time,update_time,is_enable,training_state,datasets_id from documents where type = 0"
    );
    rs = rs.rows;
    for (let document of rs) {
        let upload_folder_id = arr.find((f) => f.datasets_id === document.datasets_id)?.upload_folder_id;
        document.upload_folder_id = upload_folder_id;
    }
    rs = rs.map((m) => [
        m.id,
        m.filename,
        m.originalname,
        m.create_time,
        m.update_time,
        m.is_enable,
        m.training_state,
        m.datasets_id,
        m.upload_folder_id,
    ]);

    let values = rs.map(
        (_, i) =>
            `($${i * 9 + 1},$${i * 9 + 2},$${i * 9 + 3},$${i * 9 + 4},$${i * 9 + 5},$${i * 9 + 6},$${i * 9 + 7},$${
                i * 9 + 8
            },$${i * 9 + 9})`
    );
    let query = {
        text: `insert into upload_documents (id,filename,originalname,create_time,update_time,is_enable,training_state,datasets_id,upload_folder_id) values ${values}`,
        values: rs.flatMap((fm) => fm),
    };
    rs = await sql.query(query);
    return `新增upload_documents表${rs.rowCount}列`;
    // `INSERT INTO upload_documents (id,filename,originalname,create_time,update_time,is_enable,training_state,datasets_id)
    // SELECT id,filename,originalname,create_time,update_time,is_enable,training_state,datasets_id from documents`,
};
module.exports = { js_title, js_program };
