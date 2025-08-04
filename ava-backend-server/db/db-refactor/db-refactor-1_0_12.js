const sql = require("../pgsql");
const { modelMap, models } = require("../../orm/plz_only_run_me_once");
const fs = require("fs");
const path = require("path");

const js_title = [
    "將最新備份json轉換後新增到重建的表",
    "請確認是否已經",
    "1.執行db-backup.js",
    "2.備份資料表下載",
    "3.刪除並重建好model",
];

const js_program = async function () {
    try {
        let rs, table;
        /* const readFile = async function (filename) {
            rs = fs.readdirSync("db/db-backup");
            rs = rs.map((m) => parseInt(m));
            let lastFolder = Math.max(...rs);
            let folderpath = `db/db-backup/${lastFolder}`;
            let file = fs.readFileSync(`${folderpath}/${filename}`, "utf-8");
            return file;
        }; */

        //找到最新備份的資料夾
        let allFolder = fs.readdirSync("db/db-backup");
        allFolder = allFolder.filter((f) => !isNaN(f)).map((m) => parseInt(m));
        let lastFolder = Math.max(...allFolder);
        //讀取備份的json
        const readFile = function (filename) {
            const filepath = path.join(__dirname, `../db-backup/${lastFolder}/${filename}`);
            let file = fs.readFileSync(`${filepath}`, "utf-8");
            return JSON.parse(file);
        };

        /* 本地資料庫模擬正式機後 這邊將正式機的資料塞入 才能確實模擬把資料取出整理後塞入新創的表 
        function isJSONObject(obj) {
            return typeof obj === "object" && obj !== null;
        }
        const createTable = async function (tablename) {
            let file = readFile(`${tablename}.json`);
            if (file.length === 0) return;
            const logFile = ['bot_messages','model_token_log'];
            if(logFile.includes(tablename)){
                file = file.filter((_,i)=>i<10);   
            }
            let placeholders = [];
            file.forEach((item, index) => {
                placeholders.push(
                    "(" +
                        Object.keys(item)
                            .map((_, index1) => `$${index * Object.keys(item).length + index1 + 1}`)
                            .join(",") +
                        ")"
                );
            });
            placeholders = placeholders.join(",");
            let keys = `(${Object.keys(file[0]).join(",")})`;
            let values = file.map((m) => Object.values(m)).flatMap((fm) => fm);

            values = values.map((m) => (isJSONObject(m) ? JSON.stringify(m) : m));

            let query = {
                text: `insert into ${tablename}${keys} values ${placeholders}`,
                values: values,
            };
            // console.log(query);
            await sql.query(query);
        };
        await createTable("users");
        await createTable("user_rooms");
        await createTable("user_messages");
        await createTable("settings");
        await createTable("history_messages");
        await createTable("datasets");
        await createTable("datasource_type");
        await createTable("datasource");
        await createTable("upload_folder");
        await createTable("upload_documents");
        await createTable("expert");
        await createTable("bot_messages");
     
        await createTable("recommend_preset");
        await createTable("recommend_history");
        await createTable("recommend_custom");
        await createTable("model_token_log");

        await createTable("skill");
        await createTable("expert_skill_mapping");
        await createTable("expert_datasets_mapping");
        await createTable("embedding_token_log");
        await createTable("crawler");
        await createTable("crawler_synchronize");
        await createTable("crawler_documents");
        await createTable("crawler_documents_qa"); */

        const restore = async function (filename, modelname) {
            rs = readFile(filename);
            console.log(rs[0]);
            table = modelMap.get(modelname);
            await table.bulkCreate(rs);
        };

        //獲取orm的指定model
        table = modelMap.get("UserLoginType");
        //先建立users表建立前的資料
        await table.bulkCreate([{ type_name: "遊客登入" }, { type_name: "中鋼sso" }]);
        table = modelMap.get("UserInfoType");
        await table.bulkCreate([
            { type_name: "工號" },
            { type_name: "名稱" },
            { type_name: "頭像" },
            { type_name: "職稱" },
            { type_name: "信箱" },
            { type_name: "公司" },
            { type_name: "部門" },
            { type_name: "性別" },
            { type_name: "生日" },
            { type_name: "帳號類別" },
        ]);
        //讀取備份的users表json轉換成新的users表格式，分別塞入不同表
        rs = readFile("users.json");
        const users = rs.map((m) => {
            return {
                id: m.uid,
                user_type_id: 2,
            };
        });
        table = modelMap.get("Users");
        await table.bulkCreate(users);
        table = modelMap.get("UserInfo");
        const user_ids = users.map((m) => m.id);
        for (let uid of user_ids) {
            let user = rs.find((f) => f.uid === uid);
            let userInfo = [
                { user_id: uid, info_type_id: 1, value: user.user_no || "" },
                { user_id: uid, info_type_id: 2, value: user.nickname || "" },
                { user_id: uid, info_type_id: 3, value: user.avatar || "" },
                { user_id: uid, info_type_id: 4, value: user.post_no || "" },
                { user_id: uid, info_type_id: 5, value: user.e_mail || "" },
                { user_id: uid, info_type_id: 6, value: user.comp_no || "" },
                { user_id: uid, info_type_id: 7, value: user.dep_no || "" },
                { user_id: uid, info_type_id: 8, value: user.sex || "" },
                { user_id: uid, info_type_id: 9, value: user.birthday || "" },
                { user_id: uid, info_type_id: 10, value: user.id_type || "" },
            ];
            await table.bulkCreate(userInfo);
        }

        //將資料塞回 很多uid變了要另外做
        rs = readFile('user_rooms.json');
        table = modelMap.get('UserRooms');
        rs = rs.map(m=>{
            return {
                room_id:m.room_id,
                user1_id:m.user1_uid,
                user2_id:m.user2_uid,
                create_time:m.create_time,
                update_time:m.update_time
            }
        })
        await table.bulkCreate(rs);

        rs = readFile('user_messages.json');
        rs = rs.map(m=>{
            return {
                room_id:m.room_id,
                from_id:m.from_uid,
                to_id:m.to_uid,
                message:m.message,
                message_type:m.message_type,
                create_time:m.create_time,
                update_time:m.update_time
            }
        })
        //原本有重複的用bulkCreate會全加不進
        for(let item of rs ){
            let keys = Object.keys(item).join(",");
            let values = Object.values(item);
            let query = {
                text:`insert into user_messages(${keys}) values($1,$2,$3,$4,$5,$6,$7)`,
                values:values
            }
            console.log(query);
            sql.query(query).then(rs=>{}).catch(err=>{});
        }

        await restore("settings.json", "Settings");
        await restore("history_messages.json", "HistoryMessage");
        await restore("datasets.json", "Datasets");
        await restore("datasource_type.json", "DatasourceType");
        await restore("datasource.json", "Datasource");
        await restore("upload_folder.json", "UploadFolder");
        await restore("upload_documents.json", "UploadDocuments");
        await restore("expert.json", "Expert");

        rs = readFile("bot_messages.json");
        table = modelMap.get("BotMessage");
        rs.forEach(item=>{
            item.users_id = item.users_uid;
            delete item.users_uid
        })
        await table.bulkCreate(rs);

        await restore("recommend_preset.json", "RecommendPreset");
        rs = readFile("recommend_history.json");
        table = modelMap.get("RecommendHistory");
        rs.forEach(item=>{
            item.users_id = item.users_uid;
            delete item.users_uid
        })
        await table.bulkCreate(rs);

        rs = readFile("recommend_custom.json");
        table = modelMap.get("RecommendCustom");
        rs.forEach(item=>{
            item.users_id = item.users_uid;
            delete item.users_uid
        })
        await table.bulkCreate(rs);

        rs = readFile("model_token_log.json");
        table = modelMap.get("ModelTokenLog");
        rs.forEach(item=>{
            item.users_id = item.users_uid;
            delete item.users_uid
        })
        await table.bulkCreate(rs);

        await restore("skill.json", "Skill");

        // await restore("expert_skill_mapping.json", "ExpertSkillMapping");
        // await restore("expert_datasets_mapping.json", "ExpertDatasetsMapping");
        await restore("embedding_token_log.json", "EmbeddingTokenLog");
        // await restore("crawler.json", "Crawler");
        // await restore("crawler_synchronize.json", "CrawlerSynchronize");
        // await restore("crawler_documents.json", "CrawlerDocuments");
        // await restore("crawler_documents_qa.json", "CrawlerDocumentsQa");

        //調整順序用
        let old_table_arr = [
            "users",
            "user_rooms",
            "user_messages",
            "settings",
            "history_messages",
            "datasets",
            "datasource_type",
            "datasource",
            "upload_folder",
            "upload_documents",
            "expert",
            "bot_messages",
            "recommend_preset",
            "recommend_history",
            "recommend_custom",
            "model_token_log",
            // "expert_users_mapping",
            "skill",
            "expert_skill_mapping",
            "expert_datasets_mapping",
            "embedding_token_log",
            // "group_history",
            "crawler",
            "crawler_synchronize",
            "crawler_documents",
            "crawler_documents_qa",
            // "group_type",
            // "group_user",
            // "message",
            // "message_type",
            // "documents",
        ];
        return `已將原本資料轉換格式後新增回表`;
    } catch (error) {
        console.error(error);
        return `${error.message}`;
    }
    // `INSERT INTO upload_documents (id,filename,originalname,create_time,update_time,is_enable,training_state,datasets_id)
    // SELECT id,filename,originalname,create_time,update_time,is_enable,training_state,datasets_id from documents`,
};
module.exports = { js_title, js_program };
