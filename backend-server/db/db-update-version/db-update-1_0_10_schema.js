const sqlArr = [
    `DROP TABLE public.crawler;`,
    `CREATE TABLE public.crawler (
        id varchar(50) NOT NULL, -- 爬蟲id
        config_jsonb jsonb NULL, -- 設定json
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_show int2 NOT NULL DEFAULT 1, -- 是否顯示在後台
        "domain" varchar(1000) NULL, -- 域名
        title varchar(255) NOT NULL DEFAULT 1, -- 站名
        CONSTRAINT crawler_pk PRIMARY KEY (id)
    );`,
    `COMMENT ON TABLE public.crawler IS '爬蟲';
    COMMENT ON COLUMN public.crawler.id IS '爬蟲id';
    COMMENT ON COLUMN public.crawler.config_jsonb IS '設定json';
    COMMENT ON COLUMN public.crawler.is_show IS '是否顯示在後台';
    COMMENT ON COLUMN public.crawler."domain" IS '域名';
    COMMENT ON COLUMN public.crawler.title IS '站名';`,

    `CREATE TABLE public.datasource_type (
        id varchar(2) NOT NULL, -- 來源id
        mark varchar(50) NULL, -- 來源名稱
        "name" varchar(50) NULL, -- 主表名
        CONSTRAINT datasource_type_pk PRIMARY KEY (id)
    );`,
    `COMMENT ON COLUMN public.datasource_type.id IS '來源id';
    COMMENT ON COLUMN public.datasource_type.mark IS '來源名稱';
    COMMENT ON COLUMN public.datasource_type."name" IS '主表名';`,

    `CREATE TABLE public.datasource (
        id varchar(50) NOT NULL,
        datasets_id varchar(50) NOT NULL,
        config_jsonb jsonb NULL,
        "type" varchar(2) NOT NULL,
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT datasource_pk PRIMARY KEY (id),
        CONSTRAINT datasource_un UNIQUE (datasets_id, type)
    );`,
    `COMMENT ON TABLE public.datasource IS '數據源';`,
    `ALTER TABLE public.datasource ADD CONSTRAINT datasource_fk FOREIGN KEY ("type") REFERENCES public.datasource_type(id);`,
    `ALTER TABLE public.datasource ADD CONSTRAINT datasource_fk1 FOREIGN KEY (datasets_id) REFERENCES public.datasets(id) ON DELETE CASCADE;`,

    `CREATE TABLE public.upload_folder (
        id varchar(50) NOT NULL,
        datasource_id varchar(50) NOT NULL, -- 數據源id
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "name" varchar(255) NULL, -- 資料夾名稱
        CONSTRAINT upload_folder_pk PRIMARY KEY (id)
    );`,
    `ALTER TABLE public.upload_folder ADD CONSTRAINT upload_folder_fk FOREIGN KEY (datasource_id) REFERENCES public.datasource(id) ON DELETE CASCADE;`,
    `COMMENT ON TABLE public.upload_folder IS '上傳檔案的資料表';
    COMMENT ON COLUMN public.upload_folder.datasource_id IS '數據源id';
    COMMENT ON COLUMN public.upload_folder."name" IS '資料夾名稱';`,

    `CREATE TABLE public.upload_documents (
        id varchar(50) NOT NULL,
        filename varchar(255) NOT NULL, -- 存檔名
        originalname varchar(255) NOT NULL, -- 原始名
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_enable int4 NOT NULL DEFAULT 1, -- 是否啟用
        training_state int4 NOT NULL DEFAULT 0, -- 訓練狀態¶0:上傳失敗¶1:上傳成功¶2:建索引中¶3:建立成功¶4:禁用¶5:已刪除¶99:檔案毀損
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        upload_folder_id varchar(50) NOT NULL,
        datasets_id varchar(50) NOT NULL,
        CONSTRAINT upload_documents_pk PRIMARY KEY (id)
    );`,
    `ALTER TABLE public.upload_documents ADD CONSTRAINT upload_documents_fk FOREIGN KEY (upload_folder_id) REFERENCES public.upload_folder(id) ON DELETE CASCADE;`,
    `CREATE INDEX upload_documents_datasets_id_idx ON public.upload_documents USING btree (datasets_id);
    CREATE UNIQUE INDEX upload_documents_id_idx ON public.upload_documents USING btree (id);`,
    `COMMENT ON TABLE public.upload_documents IS '資料集檔案';
    COMMENT ON COLUMN public.upload_documents.filename IS '存檔名';
    COMMENT ON COLUMN public.upload_documents.originalname IS '原始名';
    COMMENT ON COLUMN public.upload_documents.is_enable IS '是否啟用';
    COMMENT ON COLUMN public.upload_documents.training_state IS '訓練狀態
0:上傳失敗
1:上傳成功
2:建索引中
3:建立成功
4:禁用
5:已刪除
99:檔案毀損';`,

    //     `ALTER TABLE public.documents RENAME TO upload_documents;`,
    //     `ALTER TABLE public.upload_documents DROP COLUMN "type";`,
    //     `ALTER TABLE public.upload_documents ADD upload_folder_id varchar(50) NOT NULL;`,
    //     `ALTER TABLE public.upload_documents DROP CONSTRAINT documents_fk;`,
    //     `ALTER TABLE public.upload_documents ADD CONSTRAINT upload_documents_fk FOREIGN KEY (upload_folder_id) REFERENCES public.upload_folder(id) ON DELETE CASCADE;`,
    //     `DROP INDEX public.documents_datasets_id_idx;`,
    //     `CREATE INDEX upload_documents_datasets_id_idx ON public.upload_documents (datasets_id);`,
    //     `ALTER INDEX public.documents_id_idx RENAME TO upload_documents_id_idx;`,
    //     `ALTER INDEX public.documents_pk RENAME TO upload_documents_pk;`,
    //     `訓練狀態
    // 0:上傳失敗
    // 1:上傳成功
    // 2:建索引中
    // 3:建立成功
    // 4:禁用
    // 5:已刪除
    // 99:檔案毀損`,
    `ALTER TABLE public.datasets DROP COLUMN datasource;`,
    // 將documents移到upload_documents後刪除documents

    //     `ALTER TABLE public.synchronize RENAME COLUMN datasource_id TO crawler_id;
    //     COMMENT ON COLUMN public.synchronize.crawler_id IS '還未關聯爬蟲表';`,
    //     `ALTER TABLE public.synchronize RENAME COLUMN datasets_id TO datasource_id;
    //     COMMENT ON COLUMN public.synchronize.datasource_id IS '關聯資料源';`,
    //     `ALTER TABLE public.synchronize DROP COLUMN "type";`,
    //     `ALTER TABLE public.synchronize RENAME TO crawler_synchronize;`,
    //     `ALTER TABLE public.crawler_synchronize ADD CONSTRAINT crawler_synchronize_pk PRIMARY KEY (id);`,
    //     `ALTER TABLE public.crawler_synchronize ADD CONSTRAINT crawler_synchronize_fk FOREIGN KEY (datasource_id) REFERENCES public.datasource(id);`,
    //     `ALTER TABLE public.crawler_synchronize DROP COLUMN state;`,
    //     `ALTER TABLE public.crawler_synchronize ADD training_state int2 NOT NULL DEFAULT 0;`,
    //     `COMMENT ON COLUMN public.crawler_synchronize.training_state IS '訓練狀態
    // 0:上傳失敗
    // 1:上傳成功
    // 2:建索引中
    // 3:建立成功
    // 4:禁用
    // 5:已刪除
    // 99:檔案毀損';`,
    `DROP TABLE if exists public.synchronize cascade;;`,
    `CREATE TABLE public.crawler_synchronize (
        id bigserial NOT NULL, -- 自增id
        datasource_id varchar(50) NOT NULL, -- 關聯資料源
        crawler_id varchar(50) NOT NULL, -- 還未關聯爬蟲表
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        config_jsonb jsonb NULL, -- 當下同步用的tag等
        training_state int2 NOT NULL DEFAULT 0, -- 訓練狀態¶0:上傳失敗¶1:上傳成功¶2:建索引中¶3:建立成功¶4:禁用¶5:已刪除¶99:檔案毀損
        CONSTRAINT crawler_synchronize_pk PRIMARY KEY (id)
        );`,
    `ALTER TABLE public.crawler_synchronize ADD CONSTRAINT crawler_synchronize_fk FOREIGN KEY (datasource_id) REFERENCES public.datasource(id);`,
    `COMMENT ON TABLE public.crawler_synchronize IS '同步表';
    COMMENT ON COLUMN public.crawler_synchronize.id IS '自增id';
    COMMENT ON COLUMN public.crawler_synchronize.datasource_id IS '關聯資料源';
    COMMENT ON COLUMN public.crawler_synchronize.crawler_id IS '還未關聯爬蟲表';
    COMMENT ON COLUMN public.crawler_synchronize.config_jsonb IS '當下同步用的tag等';
    COMMENT ON COLUMN public.crawler_synchronize.training_state IS '訓練狀態
    0:上傳失敗
    1:上傳成功
    2:建索引中
    3:建立成功
    4:禁用
    5:已刪除
    99:檔案毀損';`,

    `CREATE TABLE public.crawler_documents (
        id varchar(50) NOT NULL,
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        filename varchar(255) NOT NULL, -- 文件名
        "date" date NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 當日
        is_enable int2 NOT NULL DEFAULT 1, -- 默認啟用
        crawler_synchronize_id int8 NOT NULL, -- 關聯同步表
        CONSTRAINT crawler_documents_pk PRIMARY KEY (id)
    );`,
    `ALTER TABLE public.crawler_documents ADD CONSTRAINT crawler_documents_fk FOREIGN KEY (crawler_synchronize_id) REFERENCES public.crawler_synchronize(id);`,
    `COMMENT ON TABLE public.crawler_documents IS '爬蟲文件表';
    COMMENT ON COLUMN public.crawler_documents.filename IS '文件名';
    COMMENT ON COLUMN public.crawler_documents."date" IS '當日';
    COMMENT ON COLUMN public.crawler_documents.is_enable IS '默認啟用';
    COMMENT ON COLUMN public.crawler_documents.crawler_synchronize_id IS '關聯同步表';`,

    `DROP TABLE public.documents_qa;`,
    `CREATE TABLE public.crawler_documents_qa (
        id varchar(50) NOT NULL,
        question_original varchar NULL, -- 原本的問題
        answer_original varchar NULL, -- 原本的答案
        question varchar NULL, -- 問題
        answer varchar NULL, -- 答案
        adorn varchar NULL, -- 修飾過的答案
        crawler_documents_id varchar(50) NOT NULL, -- 關聯爬蟲文件
        info jsonb NULL, -- 網站本身如果有qa的id
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_enable int2 NOT NULL DEFAULT 1, -- 是否啟用
        crawler_id varchar(50) NOT NULL, -- 還未關聯爬蟲id
        hash varchar(50) NOT NULL, -- qa的md5值
        CONSTRAINT crawler_documents_qa_pk PRIMARY KEY (id)
    );`,
    `COMMENT ON TABLE public.crawler_documents_qa IS '爬到的文件QA';
    COMMENT ON COLUMN public.crawler_documents_qa.question_original IS '原本的問題';
    COMMENT ON COLUMN public.crawler_documents_qa.answer_original IS '原本的答案';
    COMMENT ON COLUMN public.crawler_documents_qa.question IS '問題';
    COMMENT ON COLUMN public.crawler_documents_qa.answer IS '答案';
    COMMENT ON COLUMN public.crawler_documents_qa.adorn IS '修飾過的答案';
    COMMENT ON COLUMN public.crawler_documents_qa.crawler_documents_id IS '關聯爬蟲文件';
    COMMENT ON COLUMN public.crawler_documents_qa.info IS '網站本身如果有qa的id';
    COMMENT ON COLUMN public.crawler_documents_qa.is_enable IS '是否啟用';
    COMMENT ON COLUMN public.crawler_documents_qa.crawler_id IS '還未關聯爬蟲id';
    COMMENT ON COLUMN public.crawler_documents_qa.hash IS 'qa的md5值';`,
    `ALTER TABLE public.crawler_documents_qa ADD CONSTRAINT crawler_documents_qa_fk FOREIGN KEY (crawler_documents_id) REFERENCES public.crawler_documents(id);`,
];

// `ALTER TABLE public.documents_qa DROP CONSTRAINT documents_qa_fk;
//     ALTER TABLE public.documents_qa ADD CONSTRAINT documents_qa_fk FOREIGN KEY (documents_id) REFERENCES public.documents(id) ON DELETE CASCADE;`,
//     `ALTER TABLE public.documents_qa ADD crawler_id varchar(50) NOT NULL;
//     COMMENT ON COLUMN public.documents_qa.crawler_id IS '關聯爬蟲id';`,

module.exports = sqlArr;
